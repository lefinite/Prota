"""Narrow, optimistic edits to the current version's tracking manifest."""
import json
import re
from copy import deepcopy
from pathlib import Path
from threading import RLock
from datetime import datetime, timezone
from server.workspace import atomic_json

LOCK = RLock()


def apply_edit(root, payload):
    scope = payload.get('scope', {})
    values = [scope.get(key, '') for key in ('projectId', 'pageId', 'version')]
    if any(not isinstance(v, str) or not re.fullmatch(r'[A-Za-z0-9_-]+', v) for v in values) or not re.fullmatch(r'v\d+', values[2]):
        raise ValueError('页面版本无效')
    root = Path(root).resolve()
    file = root.joinpath('src', 'pages', *values, 'tracking', 'events.json')
    if any(p.is_symlink() for p in [file, *file.parents] if p != root and root in p.parents) or root not in file.resolve().parents:
        raise ValueError('埋点文件路径无效')
    with LOCK:
        current = json.loads(file.read_text(encoding='utf-8'))
        if any(current.get('scope', {}).get(k) != scope.get(k) for k in ('projectId', 'pageId', 'version')):
            raise ValueError('埋点方案与页面版本不匹配')
        if current != payload.get('expectedManifest'):
            return 409, {'error': '埋点方案已更新，请重新加载后再操作。'}
        updated = deepcopy(current)
        action, identity = payload.get('action'), payload.get('id')
        events = updated['events']
        event = next((e for e in events if e['id'] == identity), None)
        screen = next((s for s in updated.get('screens', []) if s['id'] == identity), None)
        if action == 'valid_event':
            if event is None:
                raise ValueError('事件不存在')
            event['reviewStatus'] = 'valid'
        elif action == 'valid_screen':
            if screen is None:
                raise ValueError('页面不存在')
            screen['status'] = 'reviewed'
            screen['reviewedByUser'] = True
        elif action == 'delete_event':
            if event is None:
                raise ValueError('事件不存在')
            deleted = updated.setdefault('review', {}).setdefault('deletedEvents', [])
            deleted.append({'event': event, 'index': events.index(event), 'deletedAt': datetime.now(timezone.utc).isoformat()})
            events.remove(event)
        elif action == 'restore_event':
            deleted = updated.get('review', {}).get('deletedEvents', [])
            item = next((e for e in reversed(deleted) if e['event']['id'] == identity), None)
            if item is None or event is not None:
                raise ValueError('事件无法撤销删除')
            events.insert(min(item['index'], len(events)), item['event'])
            deleted.remove(item)
        else:
            raise ValueError('不支持的埋点操作')
        # Recheck immediately before the atomic write; never replace a newer Agent edit.
        if json.loads(file.read_text(encoding='utf-8')) != current:
            return 409, {'error': '埋点方案已更新，请重新加载后再操作。'}
        atomic_json(file, updated)
        return 200, {'manifest': updated}


def mutate(handler, workspace):
    if not handler.workspace_local() or not handler.headers.get('Content-Type', '').startswith('application/json'):
        return handler.workspace_reply(403, {'error': '只能在本机修改埋点方案。'})
    if workspace.bridge_locked():
        return handler.workspace_reply(423, {'error': '工作区正在切换。'})
    try:
        size = int(handler.headers.get('Content-Length', '0'))
        if not 0 < size <= 10 * 1024 * 1024:
            raise ValueError('埋点请求大小无效')
        payload = json.loads(handler.rfile.read(size))
        if not isinstance(payload, dict):
            raise ValueError('埋点请求无效')
        code, result = apply_edit(workspace.workspace_root(), payload)
        return handler.workspace_reply(code, result)
    except (ValueError, OSError, TypeError, KeyError) as error:
        return handler.workspace_reply(400, {'error': str(error)})
