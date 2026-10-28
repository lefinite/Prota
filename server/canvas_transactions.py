"""Page-local filesystem transactions shared by layout saves and board history.

The durable journal precedes every mutation. An interrupted partial transaction
rolls back; a fully installed transaction finishes its commit. Recovery never
overwrites a target changed by an external writer. No automatic garbage collection.
"""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import threading
import uuid

LOCK = threading.RLock()


class Conflict(ValueError):
    pass


def relative(value):
    if not isinstance(value, str) or not value or '\\' in value or '\x00' in value:
        raise ValueError('资源路径无效')
    parts = value.split('/')
    if any(not part or part in ('.', '..') or part.startswith('.') for part in parts):
        raise ValueError('资源路径越界或隐藏')
    return PurePosixPath(value)


def safe_path(root, value):
    root = Path(root)
    parts = relative(value).parts
    target = root
    if root.is_symlink():
        raise ValueError('目录不能是符号链接')
    for part in parts:
        target = target / part
        if target.is_symlink():
            raise ValueError('资源不能包含符号链接')
    if root.resolve() not in target.resolve().parents:
        raise ValueError('资源越界')
    return target


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fingerprint(path):
    path = Path(path)
    if path.is_symlink():
        raise ValueError('事务资源不能包含符号链接')
    if not path.exists():
        return None
    if path.is_file():
        return 'f:' + digest(path.read_bytes())
    if not path.is_dir():
        raise ValueError('不支持的事务资源')
    entries = []
    for item in sorted(path.rglob('*')):
        if item.is_symlink():
            raise ValueError('事务资源不能包含符号链接')
        entries.append([item.relative_to(path).as_posix(), 'd' if item.is_dir() else fingerprint(item)])
    return 'd:' + digest(json.dumps(entries, separators=(',', ':')).encode())


def sync_directory(path):
    if os.name != 'nt':
        descriptor = os.open(path, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


def atomic_bytes(path, data):
    path = Path(path)
    if path.is_symlink():
        raise ValueError('事务文件不能是符号链接')
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.parent / ('.' + uuid.uuid4().hex + '.tmp')
    try:
        with temporary.open('xb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(path)
        sync_directory(path.parent)
    finally:
        temporary.unlink(missing_ok=True)


def write_journal(transaction, journal):
    atomic_bytes(transaction / 'journal.json', json.dumps(journal, ensure_ascii=False).encode())


@contextmanager
def page_lock(page):
    page = Path(page)
    directory = page / '.board-transactions'
    if directory.is_symlink():
        raise ValueError('事务目录不能是符号链接')
    directory.mkdir(exist_ok=True)
    path = directory / 'lock'
    if path.is_symlink():
        raise ValueError('事务锁不能是符号链接')
    with path.open('a+b') as stream:
        if os.name == 'nt':
            import msvcrt
            if path.stat().st_size == 0:
                stream.write(b'0'); stream.flush()
            stream.seek(0); msvcrt.locking(stream.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(stream, fcntl.LOCK_EX)
        try:
            yield
        finally:
            if os.name == 'nt':
                stream.seek(0); msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream, fcntl.LOCK_UN)


def sync_resource(path):
    path = Path(path)
    files = [path] if path.is_file() else [p for p in path.rglob('*') if p.is_file()]
    for file in files:
        with file.open('rb') as stream:
            os.fsync(stream.fileno())
    if path.is_dir():
        for directory in sorted((p for p in path.rglob('*') if p.is_dir()), reverse=True):
            sync_directory(directory)
        sync_directory(path)
    sync_directory(path.parent)


def copy_resource(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if Path(source).is_dir():
        shutil.copytree(source, destination)
    else:
        shutil.copy2(source, destination)


def journal_target(page, operation):
    value = operation['target']
    # Journals cannot write operational directories or arbitrary page documents.
    parts = relative(value).parts
    valid = (len(parts) == 2 and parts[0] == 'board-history' and parts[1] == 'index.json') or (len(parts) == 3 and parts[0] == 'board-history')
    import re
    valid = valid or (len(parts) >= 2 and re.fullmatch(r'v\d+', parts[0]) and (parts[1] == 'canvas-data.js' or parts[1] not in {'index.html', 'app.js', 'styles.css', 'canvas-core.js', 'canvas-domain.js', 'canvas-connections.js', 'README.md', 'icons.js', 'marked.js', 'markdown.js'}))
    if not valid:
        raise ValueError('事务目标不在允许范围内')
    return safe_path(page, value)


def install_operation(page, transaction, operation, ordinal):
    target = journal_target(page, operation)
    current = fingerprint(target)
    if current != operation['before']:
        raise Conflict('事务目标出现外部更新，未覆盖外部内容')
    staged = transaction / 'after' / str(ordinal)
    if fingerprint(staged) != operation['after']:
        raise ValueError('事务暂存内容校验失败')
    target.parent.mkdir(parents=True, exist_ok=True)
    if current is not None:
        displaced = transaction / 'displaced' / str(ordinal)
        displaced.parent.mkdir(exist_ok=True)
        target.replace(displaced)
    staged.replace(target)
    sync_directory(target.parent)


def quarantine(page, transaction):
    trash = page / '.board-trash'
    if trash.is_symlink():
        raise ValueError('回收站不能是符号链接')
    trash.mkdir(exist_ok=True)
    destination = trash / transaction.name
    if destination.exists() or destination.is_symlink():
        raise ValueError('回收站事务 ID 冲突')
    transaction.replace(destination)
    sync_directory(trash)


def rollback(page, transaction, journal):
    # Preflight all targets before undoing any, so an external change is never erased.
    for ordinal, operation in enumerate(journal['operations']):
        target = journal_target(page, operation)
        current = fingerprint(target)
        absent_displaced = current is None and (transaction / 'displaced' / str(ordinal)).exists()
        if current not in (operation['before'], operation['after']) and not absent_displaced:
            journal['phase'] = 'conflict'; write_journal(transaction, journal)
            raise Conflict('中断事务存在外部修改，已保留全部恢复材料，请先处理事务 ' + transaction.name)
    journal['phase'] = 'rolling-back'; write_journal(transaction, journal)
    for ordinal in reversed(range(len(journal['operations']))):
        operation = journal['operations'][ordinal]
        target = journal_target(page, operation)
        if fingerprint(target) == operation['before']:
            continue
        if target.exists():
            saved = transaction / 'quarantine' / str(ordinal)
            saved.parent.mkdir(exist_ok=True)
            target.replace(saved)
        if operation['before'] is not None:
            backup = transaction / 'before' / str(ordinal)
            if fingerprint(backup) != operation['before']:
                raise ValueError('事务恢复材料校验失败')
            prepared = transaction / ('rollback-' + str(ordinal))
            if prepared.exists() and fingerprint(prepared) != operation['before']:
                prepared.replace(transaction / ('incomplete-rollback-' + uuid.uuid4().hex))
            if not prepared.exists():
                copy_resource(backup, prepared)
                sync_resource(prepared)
            prepared.replace(target)
        sync_directory(target.parent)
    journal['phase'] = 'rolled-back'; write_journal(transaction, journal)
    quarantine(page, transaction)


def recover_transactions(page):
    """Caller holds LOCK and page_lock. Kept public for offline recovery tooling."""
    page = Path(page)
    directory = page / '.board-transactions'
    if directory.is_symlink():
        raise ValueError('事务目录无效')
    recovered = []
    if not directory.exists():
        return recovered
    for transaction in sorted(directory.iterdir()):
        if transaction.name == 'lock':
            continue
        if transaction.is_symlink() or not transaction.is_dir():
            raise ValueError('未知的事务目录')
        if transaction.name.startswith(('prota-board-stage-', 'prota-canvas-save-')):
            quarantine(page, transaction); recovered.append(transaction.name); continue
        if len(transaction.name) != 32 or any(c not in '0123456789abcdef' for c in transaction.name):
            raise ValueError('未知的事务目录')
        journal_file = transaction / 'journal.json'
        if journal_file.is_symlink():
            raise ValueError('事务日志不能是符号链接')
        if not journal_file.exists():
            quarantine(page, transaction); recovered.append(transaction.name); continue
        journal = json.loads(journal_file.read_text())
        if journal.get('phase') == 'conflict':
            raise Conflict('请先处理冲突事务 ' + transaction.name)
        operations = journal['operations']
        complete = bool(operations) and all(fingerprint(journal_target(page, op)) == op['after'] for op in operations)
        if (complete and journal['phase'] not in {'rolling-back', 'rollback-requested'}) or journal['phase'] == 'committed':
            journal['phase'] = 'committed'; write_journal(transaction, journal); quarantine(page, transaction)
        else:
            rollback(page, transaction, journal)
        recovered.append(transaction.name)
    return recovered


def inspect_transactions(page):
    """Read-only recovery inventory; caller holds the page lock."""
    result = []
    directory = Path(page) / '.board-transactions'
    for transaction in sorted(directory.iterdir()):
        if transaction.name == 'lock':
            continue
        if transaction.is_symlink() or not transaction.is_dir():
            raise ValueError('事务目录无效')
        journal_file = transaction / 'journal.json'
        if journal_file.is_symlink():
            raise ValueError('事务日志无效')
        if not journal_file.exists():
            result.append({'transactionId': transaction.name, 'phase': 'preparing', 'current': {}})
            continue
        journal = json.loads(journal_file.read_text())
        result.append({'transactionId': transaction.name, 'phase': journal['phase'],
                       'current': {op['target']: fingerprint(journal_target(page, op)) for op in journal['operations']}})
    return result


def resolve_transaction(page, transaction_id, expected_current):
    """Explicit rollback choice with a lease on every target; preserve external bytes first."""
    if not isinstance(transaction_id, str) or len(transaction_id) != 32 or any(c not in '0123456789abcdef' for c in transaction_id):
        raise ValueError('事务 ID 无效')
    transaction = Path(page) / '.board-transactions' / transaction_id
    if transaction.is_symlink() or not transaction.is_dir():
        raise ValueError('事务不存在')
    journal_file = transaction / 'journal.json'
    if journal_file.is_symlink():
        raise ValueError('事务日志无效')
    journal = json.loads(journal_file.read_text())
    if journal.get('phase') != 'conflict':
        raise Conflict('只有已确认的冲突事务允许显式选择回滚')
    actual = {op['target']: fingerprint(journal_target(page, op)) for op in journal['operations']}
    if expected_current != actual:
        raise Conflict('恢复确认后文件又有变化，请重新检查恢复材料')
    for ordinal, operation in enumerate(journal['operations']):
        value = actual[operation['target']]
        if value in (operation['before'], operation['after']):
            continue
        if value is not None:
            target = journal_target(page, operation)
            backup = transaction / 'external-current' / (str(ordinal) + '-' + uuid.uuid4().hex)
            copy_resource(target, backup); sync_resource(backup)
            if fingerprint(backup) != value or fingerprint(target) != value:
                raise Conflict('备份外部更新期间文件仍在变化')
            journal.setdefault('externalBackups', []).append({'target': operation['target'], 'path': backup.relative_to(transaction).as_posix(), 'fingerprint': value})
        operation['originalAfter'] = operation['after']
        operation['after'] = value
    if {op['target']: fingerprint(journal_target(page, op)) for op in journal['operations']} != actual:
        raise Conflict('准备恢复期间文件再次变化')
    journal['phase'] = 'rollback-requested'; write_journal(transaction, journal)
    rollback(Path(page), transaction, journal)
    return transaction_id


def commit(page, replacements, verify=None, recovery=None):
    """replacements are ordered (page-relative target, prepared Path) pairs."""
    page = Path(page)
    transaction = page / '.board-transactions' / uuid.uuid4().hex
    transaction.mkdir()
    journal = {'schemaVersion': 1, 'phase': 'prepared', 'operations': []}
    try:
        if recovery is not None:
            copy_resource(recovery, transaction / 'recovery-draft')
            sync_resource(transaction / 'recovery-draft')
            journal['recoveryDraft'] = fingerprint(transaction / 'recovery-draft')
        for ordinal, (name, source) in enumerate(replacements):
            target = journal_target(page, {'target': name})
            before, after = fingerprint(target), fingerprint(source)
            staged = transaction / 'after' / str(ordinal)
            copy_resource(source, staged)
            sync_resource(staged)
            if before is not None:
                copy_resource(target, transaction / 'before' / str(ordinal))
                sync_resource(transaction / 'before' / str(ordinal))
            if fingerprint(target) != before or fingerprint(staged) != after:
                raise Conflict('准备事务期间文件出现变化')
            journal['operations'].append({'target': name, 'before': before, 'after': after})
        write_journal(transaction, journal)
        if verify:
            verify()
        journal['phase'] = 'applying'; write_journal(transaction, journal)
        for ordinal, operation in enumerate(journal['operations']):
            install_operation(page, transaction, operation, ordinal)
        journal['phase'] = 'committed'; write_journal(transaction, journal)
    except Exception:
        if (transaction / 'journal.json').exists():
            rollback(page, transaction, journal)
        else:
            quarantine(page, transaction)
        raise
    quarantine(page, transaction)
    return transaction.name
