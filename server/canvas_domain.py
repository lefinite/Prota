"""Pure v1/v2 document contracts; keep parity with canvas-domain.js."""
import copy
import hashlib
import json
import math
import re

TYPES = {'group', 'board', 'text', 'note', 'rect', 'ellipse', 'image'}
# Keep verbatim with canvas-domain.js FLOW_SHAPES and flow-shapes.js KINDS.
FLOW_SHAPES = ('terminator', 'process', 'decision', 'subprocess', 'connector', 'document', 'rounded-rect', 'database',
               'hexagon-notched', 'hexagon-arrow', 'parallelogram', 'speech-bubble', 'triangle-right', 'triangle',
               'trapezoid', 'star', 'hexagon', 'pentagon', 'octagon', 'arrow-right', 'arrow-both', 'cloud', 'callout',
               'brace', 'cross')


def identity(value):
    return isinstance(value, str) and re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', value) is not None


def number(value, low, high):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value) and low <= value <= high


def validate_pinned_state(p):
    def fail():
        raise ValueError('画板固定状态无效')
    if not isinstance(p, dict) or p.get('version') != 1 or isinstance(p.get('version'), bool) or not number(p.get('adapterVersion'), 1, 2**53 - 1) or int(p['adapterVersion']) != p['adapterVersion'] or not isinstance(p.get('route'), str) or len(p['route']) > 2048 or 'data' not in p:
        fail()
    path = re.split(r'[?#]', p['route'])[0]
    if not path or any(not re.fullmatch(r'[a-zA-Z0-9_.-]+', s) or s in ('.', '..') for s in path.split('/')):
        fail()
    ui = p.get('ui')
    if not isinstance(ui, dict) or not isinstance(ui.get('controls'), list) or not isinstance(ui.get('scroll'), list) or not number(ui.get('x'), -1e7, 1e7) or not number(ui.get('y'), -1e7, 1e7):
        fail()
    def selector(s):
        return isinstance(s, str) and 0 < len(s) <= 4096
    for c in ui['controls']:
        if not isinstance(c, dict) or not selector(c.get('selector')) or not isinstance(c.get('type'), str) or c.get('tag') not in ('input', 'textarea', 'select', 'details') or c['type'] in ('password', 'file', 'hidden'):
            fail()
        if c['tag'] == 'details':
            if not isinstance(c.get('open'), bool): fail()
        elif c['tag'] == 'select':
            if not isinstance(c.get('selected'), list) or any(not isinstance(v, bool) for v in c['selected']): fail()
        elif not isinstance(c.get('value'), str) or not isinstance(c.get('checked'), bool): fail()
    for s in ui['scroll']:
        if not isinstance(s, dict) or not selector(s.get('selector')) or not number(s.get('x'), -1e7, 1e7) or not number(s.get('y'), -1e7, 1e7): fail()
    def data(v, depth=0):
        if depth > 40: fail()
        if v is None or isinstance(v, (str, bool)): return
        if isinstance(v, (int, float)):
            if not math.isfinite(v): fail()
            return
        if isinstance(v, list):
            for item in v: data(item, depth + 1)
        elif isinstance(v, dict):
            for key, value in v.items():
                if key in ('__proto__', 'constructor', 'prototype'): fail()
                data(value, depth + 1)
        else: fail()
    data(p)
    # Match JS's UTF-16 length, including non-BMP text.
    if len(json.dumps(p, ensure_ascii=False, separators=(',', ':')).encode('utf-16-le')) // 2 > 262144: fail()


def validate_document(state):
    if not isinstance(state, dict) or isinstance(state.get('schemaVersion'), bool) or state.get('schemaVersion') not in (1, 2):
        raise ValueError('不支持的画布格式')
    revision = state.get('revision', 0)
    if not number(revision, 0, 2**53 - 1) or int(revision) != revision:
        raise ValueError('画布 revision 无效')
    viewport = state.get('viewport')
    if not isinstance(viewport, dict) or not number(viewport.get('x'), -1e7, 1e7) or not number(viewport.get('y'), -1e7, 1e7) or not number(viewport.get('zoom'), .05, 4):
        raise ValueError('画布视角无效')
    nodes = state.get('nodes')
    if not isinstance(nodes, list) or len(nodes) > 1000:
        raise ValueError('画布最多容纳 1000 个对象')
    ids = set()
    for node in nodes:
        if not isinstance(node, dict) or node.get('type') not in TYPES or not identity(node.get('id')) or node['id'] in ids:
            raise ValueError('画布对象无效')
        ids.add(node['id'])
        if any(not number(node.get(k), low, 1e7) for k, low in [('x', -1e7), ('y', -1e7), ('width', 16), ('height', 16)]):
            raise ValueError('画布坐标或尺寸无效')
        if node.get('parentId') is not None and not isinstance(node['parentId'], str):
            raise ValueError('画布容器无效')
        for key in ('text', 'name', 'src', 'color'):
            if key in node and not isinstance(node[key], str):
                raise ValueError('对象属性无效')
        if 'flowShape' in node and (node['type'] != 'rect' or not isinstance(node['flowShape'], str) or node['flowShape'] not in FLOW_SHAPES):
            raise ValueError('流程图形状无效')
        if 'strokeColor' in node and (not isinstance(node['strokeColor'], str) or not re.fullmatch(r'#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})', node['strokeColor'])):
            raise ValueError('描边颜色无效')
        if 'strokeWidth' in node and not number(node['strokeWidth'], .5, 10):
            raise ValueError('描边宽度无效')
        if 'pinnedState' in node:
            if node['type'] != 'board':
                raise ValueError('仅画板支持固定状态')
            validate_pinned_state(node['pinnedState'])
        src = node.get('src', '')
        if node['type'] == 'board' and src and not re.fullmatch(r'boards/[a-zA-Z0-9_-]+/index\.html', src):
            raise ValueError('画板只能引用本版本 boards 目录')
        if node['type'] == 'image' and src and not (re.match(r'^data:image/(png|jpeg|webp|gif);base64,', src) or re.fullmatch(r'assets/[a-zA-Z0-9_.-]+', src)):
            raise ValueError('图片必须保存在当前版本')
        clone_from = node.get('cloneFrom')
        if 'cloneFrom' in node and (node['type'] != 'board' or not isinstance(clone_from, str) or not re.fullmatch(r'boards/[a-zA-Z0-9_-]+/index\.html', clone_from)):
            raise ValueError('复制画板来源无效')
        for key, low, high in [('opacity', 0, 1), ('radius', 0, 1000), ('fontSize', 8, 400), ('fontWeight', 100, 900), ('padding', 0, 10000)]:
            if key in node and not number(node[key], low, high):
                raise ValueError('样式属性无效')
        if 'textAlign' in node and node['textAlign'] not in ('left', 'center', 'right', 'justify'):
            raise ValueError('文字对齐属性无效')
        if state['schemaVersion'] == 2 and node['type'] == 'board':
            if not identity(node.get('boardId')) or 'boardRevisionId' not in node or (node['boardRevisionId'] is not None and not identity(node['boardRevisionId'])):
                raise ValueError('画板版本身份无效')
            if 'boardVersionId' in node and (not isinstance(node['boardVersionId'], str) or not re.fullmatch(r'v[1-9]\d*', node['boardVersionId'])):
                raise ValueError('画板版本号无效')
            if 'originBoardId' in node and not identity(node['originBoardId']):
                raise ValueError('画板来源身份无效')
    by_id = {node['id']: node for node in nodes}
    for node in nodes:
        seen = set()
        while node.get('parentId'):
            if node['id'] in seen:
                raise ValueError('画布层级存在循环')
            seen.add(node['id'])
            node = by_id.get(node['parentId'])
            if not node or node['type'] not in ('board', 'group'):
                raise ValueError('画布容器无效')
    if state['schemaVersion'] == 2 or 'edges' in state:
        edges = state.get('edges')
        if not isinstance(edges, list) or len(edges) > 10000:
            raise ValueError('画布连线无效')
        ids = set()
        for edge in edges:
            if not isinstance(edge, dict) or not identity(edge.get('id')) or edge['id'] in ids or not identity(edge.get('fromInstanceId')) or not identity(edge.get('toInstanceId')):
                raise ValueError('画布连线身份无效')
            if 'label' in edge and (not isinstance(edge['label'], str) or len(edge['label']) > 200):
                raise ValueError('连线文案最多 200 字')
            if 'kind' in edge and edge['kind'] not in ('main', 'secondary', 'exception'):
                raise ValueError('连线类型无效')
            if 'color' in edge and (not isinstance(edge['color'], str) or not re.fullmatch(r'#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})', edge['color'])):
                raise ValueError('连线颜色无效')
            for key in ('fromPort', 'toPort'):
                if key in edge and edge[key] not in ('auto', 'left', 'right', 'top', 'bottom'):
                    raise ValueError('连线连接位置无效')
            for key in ('fromAnchor', 'toAnchor'):
                anchor = edge.get(key)
                if anchor is not None:
                    if (not isinstance(anchor, dict) or not all(isinstance(anchor.get(k), str) for k in ('selector', 'tag', 'text', 'page', 'src'))
                            or not 1 <= len(anchor['selector']) <= 1024 or len(anchor['tag']) > 40 or len(anchor['text']) > 256 or len(anchor['page']) > 2048
                            or not re.fullmatch(r'boards/[a-zA-Z0-9_-]+/index\.html', anchor['src'])):
                        raise ValueError('控件连接点无效')
            route = edge.get('manualRoute')
            if route is not None:
                if (not isinstance(route, list) or not 2 <= len(route) <= 256
                        or any(not isinstance(p, dict) or not number(p.get('x'), -1e7, 1e7) or not number(p.get('y'), -1e7, 1e7) for p in route)
                        or any(p['x'] != q['x'] and p['y'] != q['y'] for p, q in zip(route, route[1:]))):
                    raise ValueError('连线折点无效')
            if 'fontSize' in edge and not number(edge['fontSize'], 8, 64):
                raise ValueError('连线字号无效')
            ids.add(edge['id'])
    return state


def migrate_v1(state, project_id, page_id):
    result = copy.deepcopy(state)
    for node in result['nodes']:
        if node['type'] == 'board':
            source = json.dumps(['prota-board-v1', project_id, page_id, node['id']], separators=(',', ':'), ensure_ascii=False)
            if not node.get('boardId'):
                node['boardId'] = 'b_' + hashlib.sha256(source.encode()).hexdigest()[:32]
            node.setdefault('boardRevisionId', None)
    result['schemaVersion'] = 2
    result.setdefault('edges', [])
    return result


MIGRATIONS = {1: migrate_v1}


def migrate_document(document, project_id='', page_id=''):
    validate_document(document)
    result = copy.deepcopy(document)
    while result['schemaVersion'] < 2:
        result = MIGRATIONS[result['schemaVersion']](result, project_id, page_id)
    return validate_document(result)


def feature_enabled(root, name):
    """Shipped features default on; workspace overrides retain an explicit rollback."""
    default = name in {'canvasSchemaV2', 'boardRevisions'}
    from pathlib import Path
    root = Path(root)
    try:
        workspace = json.loads((root / 'workspace.json').read_text())
        configuration = json.loads((root / 'data/canvas-features.json').read_text())
        workspace_id = workspace.get('id')
        allowed = configuration.get('testWorkspaceIds', [])
        if isinstance(workspace_id, str) and workspace_id and isinstance(allowed, list) and workspace_id in allowed:
            overrides = configuration.get('overrides', {})
            if name in overrides:
                return overrides[name] is True
        return default
    except (OSError, ValueError, TypeError, AttributeError):
        return default


def schema_enabled(root):
    return feature_enabled(root, 'canvasSchemaV2')
