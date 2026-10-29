"""Durable edits to PRD sources linked from an infinite canvas."""
import json
import threading
from pathlib import Path

from server.canvas_autosave import read_journal as read_canvas_journal
from server.canvas_transactions import LOCK, page_lock, safe_path, atomic_bytes

JOURNAL = '.prd-autosave.json'


def journal_path(page):
    target = Path(page) / JOURNAL
    if target.is_symlink():
        raise ValueError('PRD 自动保存记录不能是符号链接')
    return target


def read_journal(page):
    target = journal_path(page)
    return json.loads(target.read_text(encoding='utf-8')) if target.exists() else {'operations': {}, 'pending': False}


def write_journal(page, journal):
    atomic_bytes(journal_path(page), json.dumps(journal, ensure_ascii=False).encode())


def canvas_runs(page, version):
    journal = read_canvas_journal(Path(page) / str(version))
    return bool(journal.get('runs'))


def record_manual(page, version, document, content):
    document, page = Path(document), Path(page)
    relative = document.relative_to(page).as_posix()
    with LOCK, page_lock(page):
        journal = read_journal(page)
        journal['operations'][relative] = {'content': content}
        journal.update(pending=True, context={'version': str(version)})
        write_journal(page, journal)


def settle_manual(page, version, document, content):
    document, page = Path(document), Path(page)
    relative = document.relative_to(page).as_posix()
    with LOCK, page_lock(page):
        journal = read_journal(page)
        operation = journal['operations'].get(relative)
        if operation is None or operation['content'] != content:
            return
        if not canvas_runs(page, version):
            del journal['operations'][relative]
            journal['pending'] = bool(journal['operations'])
        write_journal(page, journal)


def reconcile(root, page):
    page = Path(page)
    with LOCK, page_lock(page):
        journal = read_journal(page)
        version = journal.get('context', {}).get('version')
        if not version:
            return
        for relative, operation in journal['operations'].items():
            target = safe_path(page, relative)
            if target.suffix.lower() != '.md':
                raise ValueError('PRD 自动保存目标无效')
            if not target.exists() or target.read_text(encoding='utf-8') != operation['content']:
                atomic_bytes(target, operation['content'].encode())
        if not canvas_runs(page, version):
            journal['operations'] = {}
            journal['pending'] = False
            write_journal(page, journal)


def start_worker(root_provider, locked=lambda: False):
    def work():
        while True:
            try:
                if not locked():
                    root = Path(root_provider())
                    files = list((root / 'src/pages').glob('*/*/' + JOURNAL))
                    for file in files:
                        relative = file.relative_to(root)
                        if file.is_symlink() or any((root / part).is_symlink() for part in relative.parents if str(part) != '.'):
                            continue
                        journal = json.loads(file.read_text(encoding='utf-8'))
                        if journal.get('pending'):
                            reconcile(root, file.parent)
            except (ValueError, OSError, KeyError, TypeError):
                pass
            threading.Event().wait(0.5)
    thread = threading.Thread(target=work, name='prd-autosave', daemon=True)
    thread.start()
    return thread
