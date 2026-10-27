"""Pure v1/v2 document contracts; keep parity with canvas-domain.js."""
import copy
import hashlib
import json
import math
import re

TYPES = {'group', 'board', 'text', 'note', 'rect', 'ellipse', 'image'}


def identity(value):
    return isinstance(value, str) and re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', value) is not None


def number(value, low, high):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value) and low <= value <= high


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
    if state['schemaVersion'] == 2:
        edges = state.get('edges')
        if not isinstance(edges, list) or len(edges) > 10000:
            raise ValueError('画布连线无效')
        ids = set()
        for edge in edges:
            if not isinstance(edge, dict) or not identity(edge.get('id')) or edge['id'] in ids or not identity(edge.get('fromInstanceId')) or not identity(edge.get('toInstanceId')):
                raise ValueError('画布连线身份无效')
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


def schema_enabled(root):
    """Explicit workspace opt-in; malformed or absent configuration stays off."""
    from pathlib import Path
    root = Path(root)
    try:
        workspace = json.loads((root / 'workspace.json').read_text())
        configuration = json.loads((root / 'data/canvas-features.json').read_text())
        workspace_id = workspace.get('id')
        allowed = configuration.get('testWorkspaceIds', [])
        return isinstance(workspace_id, str) and bool(workspace_id) and isinstance(allowed, list) and workspace_id in allowed and configuration.get('overrides', {}).get('canvasSchemaV2') is True
    except (OSError, ValueError, TypeError, AttributeError):
        return False
