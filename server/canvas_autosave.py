"""Durable manual edits, independent of the canvas iframe and Agent writes."""
import copy
import json
import threading
from pathlib import Path
from server.canvas_transactions import LOCK, page_lock, safe_path, atomic_bytes
from server.canvas_domain import validate_document

JOURNAL = '.canvas-autosave.json'


def read_document(directory):
    raw = safe_path(directory, 'canvas-data.js').read_text(encoding='utf-8').strip()
    if not raw.startswith('window.PROTA_CANVAS = '):
        raise ValueError('画布正在写入，手动修改已独立保存')
    return validate_document(json.loads(raw[len('window.PROTA_CANVAS = '):].removesuffix(';')))


def journal_path(directory):
    target = directory / JOURNAL
    if target.is_symlink():
        raise ValueError('自动保存记录不能是符号链接')
    return target


def read_journal(directory):
    target = journal_path(directory)
    return json.loads(target.read_text(encoding='utf-8')) if target.exists() else {'runs': [], 'operations': {}, 'pending': False}


def write_journal(directory, journal):
    atomic_bytes(journal_path(directory), json.dumps(journal, ensure_ascii=False).encode())


def changes(before, after):
    """Only explicit manual changes become protected fields; stable IDs address collections."""
    operations = {}
    missing = object()
    def walk(a, b, path, fallback=None):
        if a == b:
            return
        if isinstance(a, dict) and isinstance(b, dict):
            for key in a.keys() | b.keys():
                if not path and key in {'revision', 'schemaVersion'}:
                    continue
                walk(a.get(key, missing), b.get(key, missing), path + [key], fallback)
        elif len(path) == 1 and path[0] in {'nodes', 'edges'} and isinstance(b, list):
            old = {node['id']: node for node in a} if isinstance(a, list) else {}
            new = {node['id']: node for node in b}
            for id in old.keys() | new.keys():
                walk(old.get(id, missing), new.get(id, missing), path + [id], new.get(id))
            if list(old) != list(new):
                operations[json.dumps(['$order', path[0]])] = {'value': list(new)}
        else:
            operation = {'delete': True} if b is missing else {'value': copy.deepcopy(b)}
            if fallback is not None:
                operation['node'] = copy.deepcopy(fallback)
            operations[json.dumps(path)] = operation
    walk(before, after, [])
    return operations


def apply_operations(document, operations):
    result = copy.deepcopy(document)
    for encoded, operation in operations.items():
        path = json.loads(encoded)
        if path[0] == '$order':
            items = result.get(path[1], [])
            order = operation['value']
            indexed = {item['id']: item for item in items}
            result[path[1]] = [indexed[id] for id in order if id in indexed] + [item for item in items if item['id'] not in order]
            continue
        target = result
        if path[0] in {'nodes', 'edges'} and len(path) > 1:
            items = result.setdefault(path[0], [])
            node = next((item for item in items if item['id'] == path[1]), None)
            if len(path) == 2:
                if node is not None:
                    items.remove(node)
                if not operation.get('delete'):
                    items.append(copy.deepcopy(operation['value']))
                continue
            if node is None:
                node = copy.deepcopy(operation['node'])
                items.append(node)
            target = node
            path = path[2:]
        for key in path[:-1]:
            if not isinstance(target.get(key), dict):
                target[key] = {}
            target = target[key]
        if operation.get('delete'):
            target.pop(path[-1], None)
        else:
            target[path[-1]] = copy.deepcopy(operation['value'])
    ids = {node['id'] for node in result['nodes']}
    for node in result['nodes']:
        if node.get('parentId') and node['parentId'] not in ids:
            node['parentId'] = None
    if 'edges' in result:
        result['edges'] = [edge for edge in result['edges'] if edge['fromInstanceId'] in ids and edge['toInstanceId'] in ids]
    return validate_document(result)


def record_edits(directory, params):
    before, state = validate_document(params['baseline']), validate_document(params['state'])
    journal = read_journal(directory)
    # Keep the accumulated overlay while any Agent owns this canvas. Outside a
    # run, retain the latest receipt for crash recovery without freezing future edits.
    if not journal['runs'] and not journal['pending']:
        journal['operations'] = {}
    for key, value in changes(before, state).items():
        path = json.loads(key)
        for previous in list(journal['operations']):
            other = json.loads(previous)
            if other[:len(path)] == path:
                del journal['operations'][previous]
        journal['operations'][key] = value
    journal.update(pending=True, context={key: params[key] for key in ('projectId', 'pageId', 'version')})
    write_journal(directory, journal)  # fsync precedes the ordinary layout write.
    return journal


def reconcile(root, context, run_id=None, begin=False):
    from server.canvas_store import save_canvas
    directory = safe_path(root, '/'.join(['src', 'pages', context['projectId'], context['pageId'], context['version']]))
    if not (directory / 'canvas-data.js').is_file():
        return
    with LOCK, page_lock(directory.parent):
        journal = read_journal(directory)
        if begin:
            if not journal['runs'] and not journal['pending']:
                journal['operations'] = {}
            if run_id not in journal['runs']:
                journal['runs'].append(run_id)
            journal['context'] = context
            write_journal(directory, journal)
            return
        if run_id and run_id in journal['runs']:
            journal.setdefault('finishingRuns', [])
            if run_id not in journal['finishingRuns']:
                journal['finishingRuns'].append(run_id)
                write_journal(directory, journal)
        if not journal['operations']:
            if run_id in journal['runs']:
                journal['runs'].remove(run_id)
                write_journal(directory, journal)
            return
        current = read_document(directory)
        updated = apply_operations(current, journal['operations'])
    # save_canvas owns the cross-process page lock; don't recursively flock it.
    if updated != current:
        code, _ = save_canvas(root, dict(context, baseline=current, revision=current['revision'], state=updated))
        if code != 200:
            return  # Keep durable operations for the next background attempt.
    with LOCK, page_lock(directory.parent):
        latest = read_journal(directory)
        # A newer manual receipt must remain pending until it too is reconciled.
        if latest['operations'] != journal['operations']:
            return
        latest['pending'] = False
        latest['runs'] = [id for id in latest['runs'] if id not in latest.get('finishingRuns', [])]
        latest['finishingRuns'] = []
        write_journal(directory, latest)


def start_worker(root_provider, locked=lambda: False):
    def work():
        while True:
            try:
                if not locked():
                    root = Path(root_provider())
                    for file in (root / 'src/pages').glob('*/*/v*/' + JOURNAL):
                        relative = file.relative_to(root)
                        if file.is_symlink() or any((root / part).is_symlink() for part in relative.parents if str(part) != '.'):
                            continue
                        journal = json.loads(file.read_text(encoding='utf-8'))
                        if journal['pending'] or journal['runs']:
                            reconcile(root, journal['context'])
            except (ValueError, OSError, KeyError, TypeError):
                pass  # Partial Agent writes retry; the durable receipt stays intact.
            threading.Event().wait(0.5)
    thread = threading.Thread(target=work, name='canvas-autosave', daemon=True)
    thread.start()
    return thread


if __name__ == '__main__':
    import sys
    data = json.load(sys.stdin)
    reconcile(Path(data['root']), data['context'], data['runId'], data['action'] == 'begin')
