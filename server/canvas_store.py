"""Page-owned infinite canvas persistence. No writes outside an existing version."""
import json
import math
import re
import threading
import shutil
import time
import base64
import hashlib
from pathlib import Path
from server import workspace

LOCK = threading.Lock()
PREFIX = 'window.PROTA_CANVAS = '
TYPES = {'group', 'board', 'text', 'note', 'rect', 'ellipse', 'image'}


def validate_state(state):
    if not isinstance(state, dict) or state.get('schemaVersion') != 1:
        raise ValueError('不支持的画布格式')
    viewport = state.get('viewport')
    if not isinstance(viewport, dict):
        raise ValueError('缺少画布视角')
    for key in ('x', 'y', 'zoom'):
        value = viewport.get(key)
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or abs(value) > 10000000:
            raise ValueError('画布视角无效')
    if not .05 <= viewport['zoom'] <= 4:
        raise ValueError('缩放范围无效')
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
    by_id = {node['id']: node for node in nodes}
    for node in nodes:
        for key, low, high in [('opacity', 0, 1), ('radius', 0, 1000), ('fontSize', 8, 400), ('fontWeight',100,900), ('padding',0,10000)]:
            if key in node and (not isinstance(node[key], (float, int)) or not math.isfinite(node[key]) or not low <= node[key] <= high):
                raise ValueError('样式属性无效')
        if 'textAlign' in node and node['textAlign'] not in {'left','center','right','justify'}:
            raise ValueError('文字对齐属性无效')
        seen = set()
        parent = node
        while parent.get('parentId'):
            if parent['id'] in seen:
                raise ValueError('画布层级不能循环')
            seen.add(parent['id'])
            parent = by_id.get(parent['parentId'])
            if not parent or parent['type'] not in {'board', 'group'}:
                raise ValueError('画布容器无效')
        clone_from = node.get('cloneFrom')
        if clone_from and (node['type'] != 'board' or not isinstance(clone_from, str) or not re.fullmatch(r'boards/[a-zA-Z0-9_-]+/index\.html', clone_from)):
            raise ValueError('复制画板来源无效')
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
        assets = []
        for node in state['nodes']:
            if node['type'] != 'image' or not node.get('src', '').startswith('data:'):
                continue
            match = re.fullmatch(r'data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\r\n]+)', node['src'])
            if not match:
                raise ValueError('图片内容无效')
            try:
                content = base64.b64decode(match.group(2), validate=True)
            except ValueError:
                raise ValueError('图片编码无效')
            if len(content) > 4 * 1024 * 1024:
                raise ValueError('图片超过 4 MB')
            asset_dir = directory / 'assets'
            if asset_dir.is_symlink():
                raise ValueError('素材目录不能是符号链接')
            asset_dir.mkdir(exist_ok=True)
            filename = hashlib.sha256(content).hexdigest() + '.' + match.group(1)
            target = asset_dir / filename
            if target.is_symlink():
                raise ValueError('素材不能是符号链接')
            if not target.exists():
                target.write_bytes(content)
            node['src'] = 'assets/' + filename
            assets.append({'id': node['id'], 'src': node['src']})
        # Duplicated runnable boards get independent code, never alias the source.
        for node in state['nodes']:
            if not node.get('cloneFrom'):
                continue
            source = (directory / node['cloneFrom']).parent
            destination = (directory / node['src']).parent
            if directory not in source.resolve().parents or directory not in destination.resolve().parents:
                raise ValueError('画板目录越界')
            if destination.exists():
                if destination.is_symlink():
                    raise ValueError('画板不能包含符号链接')
                continue
            if source.is_symlink() or any(p.is_symlink() for p in source.rglob('*')):
                raise ValueError('画板不能包含符号链接')
            if not (source / 'index.html').is_file():
                raise ValueError('源画板文件不存在，无法复制')
            if not destination.exists():
                shutil.copytree(source, destination)
        history = directory / '.canvas-history'
        if history.is_symlink():
            raise ValueError('恢复目录无效')
        history.mkdir(exist_ok=True)
        (history / f'{time.time_ns()}.js').write_text(raw + '\n', encoding='utf-8')
        for obsolete in sorted(history.glob('*.js'))[:-10]:
            obsolete.unlink()
        state['revision'] = current.get('revision', 0) + 1
        serialized = json.dumps(state, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
        temporary = file.with_suffix('.js.tmp')
        if temporary.is_symlink():
            raise ValueError('无效的临时文件')
        temporary.write_text(PREFIX + serialized + ';\n', encoding='utf-8')
        # Asset / board copies can take time. Recheck immediately before replacing the layout,
        # since external Agent writes do not participate in this process's lock.
        if file.read_text(encoding='utf-8').strip() != raw:
            temporary.unlink(missing_ok=True)
            return 409, {'error': '保存期间出现外部更新，本机修改已保留，请选择恢复或读取最新版本。'}
        temporary.replace(file)
    return 200, {'revision': state['revision'], **({'assets': assets} if assets else {})}


def upgrade_runtime(root, params, template):
    """Upgrade editor chrome only; retain document and user assets, back up old runtime."""
    parts = [params.get(key, '') for key in ('projectId', 'pageId', 'version')]
    if not all(isinstance(p, str) and re.fullmatch(r'[a-zA-Z0-9_-]+', p) for p in parts) or not re.fullmatch(r'v\d+', parts[2]):
        raise ValueError('页面路径无效')
    root = Path(root).resolve()
    directory = root.joinpath('src/pages', *parts).resolve()
    if root not in directory.parents or not (directory/'canvas-data.js').is_file():
        raise ValueError('无限画布不存在')
    with LOCK:
        backup = directory/'.canvas-runtime-backup'
        if backup.is_symlink():
            raise ValueError('备份目录无效')
        backup.mkdir(exist_ok=True)
        filenames = ['icons.js', 'LICENSE.lucide', 'canvas-core.js', 'styles.css', 'app.js', 'README.md', 'index.html']
        template = Path(template)
        # Validate the whole editor bundle before changing any installed resource.
        for filename in filenames:
            if not (template/filename).is_file():
                raise ValueError(f'编辑器安装包不完整，缺少 {filename}')
        for filename in filenames:
            target = directory/filename
            if target.is_symlink():
                raise ValueError('编辑器文件不能是符号链接')
            if target.exists() and not (backup/filename).exists():
                shutil.copy2(target, backup/filename)
        staged = []
        for filename in filenames:
            target = directory/filename
            temporary = directory/(filename+'.upgrade.tmp')
            if temporary.is_symlink():
                raise ValueError('临时文件无效')
            shutil.copyfile(template/filename, temporary)
            staged.append((temporary,target))
        # Dependencies first, HTML entry last. No partial bundle is installed if staging fails.
        for temporary,target in staged:
            temporary.replace(target)
    return {'runtimeVersion': 4}
