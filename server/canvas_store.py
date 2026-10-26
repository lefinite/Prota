"""Page-owned infinite canvas persistence. No writes outside an existing version."""
import json
import math
import re
import threading
from pathlib import Path
from server import workspace

LOCK = threading.Lock()
PREFIX = 'window.PROTA_CANVAS = '
TYPES = {'board', 'text', 'note', 'rect', 'ellipse', 'image'}


def validate_state(state):
    if not isinstance(state, dict) or state.get('schemaVersion') != 1:
        raise ValueError('不支持的画布格式')
    nodes = state.get('nodes')
    if not isinstance(nodes, list) or len(nodes) > 1000:
        raise ValueError('画布最多容纳 1000 个对象')
    ids = set()
    for node in nodes:
        if not isinstance(node, dict) or node.get('type') not in TYPES:
            raise ValueError('未知画布对象')
        identity = node.get('id', '')
        if not isinstance(identity, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', identity) or identity in ids:
            raise ValueError('对象 ID 无效或重复')
        ids.add(identity)
        for key in ('x', 'y', 'width', 'height'):
            value = node.get(key)
            if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or abs(value) > 10000000:
                raise ValueError('对象尺寸或位置无效')
            if key in ('width', 'height') and value < 16:
                raise ValueError('对象尺寸过小')
        for key in ('text', 'name', 'src', 'color'):
            if key in node and not isinstance(node[key], str):
                raise ValueError('对象属性无效')
        src = node.get('src', '')
        if node['type'] == 'board' and src and not re.fullmatch(r'boards/[a-zA-Z0-9_-]+/index\.html', src):
            raise ValueError('画板只能引用本版本 boards 目录')
        if node['type'] == 'image' and src and not (re.match(r'^data:image/(png|jpeg|webp|gif);base64,', src) or re.fullmatch(r'assets/[a-zA-Z0-9_.-]+', src)):
            raise ValueError('图片必须保存在当前版本或嵌入画布')
    return state


def save_canvas(root, params):
    parts = [params.get(key, '') for key in ('projectId', 'pageId', 'version')]
    if not all(isinstance(part, str) and re.fullmatch(r'[a-zA-Z0-9_-]+', part) for part in parts) or not re.fullmatch(r'v\d+', parts[2]):
        raise ValueError('页面路径无效')
    root = Path(root).resolve()
    directory = root.joinpath('src', 'pages', *parts).resolve()
    if root not in directory.parents or not directory.is_dir():
        raise ValueError('页面版本不存在')
    file = directory / 'canvas-data.js'
    if file.is_symlink() or not file.is_file():
        raise ValueError('该页面不是无限画布')
    state = validate_state(params.get('state'))
    with LOCK:
        raw = file.read_text(encoding='utf-8').strip()
        if not raw.startswith(PREFIX):
            raise ValueError('无法识别画布文件')
        current = json.loads(raw[len(PREFIX):].removesuffix(';'))
        if current.get('revision', 0) != params.get('revision'):
            return 409, {'error': '画布已被其他窗口或 AI 修改。请导出当前布局备份，再刷新后继续。'}
        # Compare the full original document as well: agents may keep its revision unchanged.
        if params.get('baseline') != current:
            return 409, {'error': '画布文件已有外部修改。请导出备份后刷新。'}
        state['revision'] = current.get('revision', 0) + 1
        serialized = json.dumps(state, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
        temporary = file.with_suffix('.js.tmp')
        if temporary.is_symlink():
            raise ValueError('无效的临时文件')
        temporary.write_text(PREFIX + serialized + ';\n', encoding='utf-8')
        temporary.replace(file)
    return 200, {'revision': state['revision']}
