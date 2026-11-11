"""Durable local user-edit ledger. Snapshots have no retention/GC policy."""
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from server.canvas_transactions import atomic_bytes, digest, safe_path, sync_directory


def now():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, root):
        self.root = Path(root)
        self.assets = safe_path(self.root, 'data/user-edit-assets')
        self.assets.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.assets, 0o700)
        sync_directory(self.assets.parent)
        path = safe_path(self.root, 'data/user-edits.sqlite3')
        for suffix in ('', '-wal', '-shm'):
            if Path(str(path) + suffix).is_symlink():
                raise ValueError('编辑账本不能是符号链接')
        self.db = sqlite3.connect(path, timeout=30)
        self.db.row_factory = sqlite3.Row
        if self.db.execute('PRAGMA user_version').fetchone()[0] > 1:
            self.db.close()
            raise ValueError('编辑账本由较新版本创建，请使用新版或只读恢复副本')
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS edit_operations (
          id TEXT PRIMARY KEY, client_id TEXT UNIQUE NOT NULL, request_json TEXT NOT NULL,
          status TEXT NOT NULL, detail TEXT, effect_json TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE IF NOT EXISTS edit_events (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT, edit_id TEXT NOT NULL,
          event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS edit_file_effects (
          edit_id TEXT PRIMARY KEY, source_path TEXT NOT NULL, before_sha256 TEXT NOT NULL,
          after_sha256 TEXT NOT NULL, transaction_id TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS agent_leases (id TEXT PRIMARY KEY, pid INTEGER NOT NULL);
        PRAGMA user_version=1;
        ''')
        os.chmod(path, 0o600)
        sync_directory(path.parent)

    def close(self):
        self.db.close()

    @contextmanager
    def lock(self):
        # Shared with the Node coordinator through the Python CLI; no page source mutation.
        path = safe_path(self.root, 'data/user-edit-assets/coordinator.lock')
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

    def snapshot(self, data):
        sha = digest(data)
        path = safe_path(self.root, 'data/user-edit-assets/snapshots/' + sha)
        if not path.exists():
            path.parent.mkdir(exist_ok=True, mode=0o700)
            sync_directory(self.assets)
            atomic_bytes(path, data)
            os.chmod(path, 0o600)
        if digest(path.read_bytes()) != sha:
            raise OSError('编辑快照校验失败')
        return sha

    def read_snapshot(self, sha):
        if not isinstance(sha, str) or len(sha) != 64 or any(c not in '0123456789abcdef' for c in sha):
            raise ValueError('无效的快照')
        data = safe_path(self.root, 'data/user-edit-assets/snapshots/' + sha).read_bytes()
        if digest(data) != sha:
            raise OSError('编辑快照校验失败')
        return data

    def get(self, edit_id):
        row = self.db.execute('SELECT * FROM edit_operations WHERE id=?', (edit_id,)).fetchone()
        if not row:
            raise ValueError('编辑记录不存在')
        result = dict(row)
        result['request'] = json.loads(result.pop('request_json'))
        result['effect'] = json.loads(result.pop('effect_json') or 'null')
        return result

    def receive(self, request):
        canonical = json.dumps(request, ensure_ascii=False, sort_keys=True)
        row = self.db.execute('SELECT id,request_json FROM edit_operations WHERE client_id=?', (request['clientEditId'],)).fetchone()
        if row:
            return self.get(row['id']), row['request_json'] == canonical
        edit_id = 'edit_' + uuid.uuid4().hex
        with self.db:
            self.db.execute('INSERT INTO edit_operations VALUES (?,?,?,?,?,?,?,?)',
                            (edit_id, request['clientEditId'], canonical, 'received', None, None, now(), now()))
        self.state(edit_id, 'received')
        return self.get(edit_id), True

    def state(self, edit_id, status, detail=None, effect=None):
        with self.db:
            self.db.execute('UPDATE edit_operations SET status=?,detail=?,effect_json=COALESCE(?,effect_json),updated_at=? WHERE id=?',
                            (status, detail, json.dumps(effect) if effect else None, now(), edit_id))
            self.db.execute('INSERT INTO edit_events(edit_id,event_type,payload_json,created_at) VALUES (?,?,?,?)',
                            (edit_id, status, json.dumps({'detail': detail, 'effect': effect}), now()))
            if status == 'committed' and effect:
                self.db.execute('INSERT OR REPLACE INTO edit_file_effects VALUES (?,?,?,?,?)',
                                (edit_id, effect['path'], effect['beforeSha256'], effect['afterSha256'], edit_id))
        return self.get(edit_id)

    def active_agent(self):
        active = False
        for row in self.db.execute('SELECT * FROM agent_leases').fetchall():
            try:
                os.kill(row['pid'], 0)
                active = True
            except ProcessLookupError:
                with self.db:
                    self.db.execute('DELETE FROM agent_leases WHERE id=?', (row['id'],))
            except PermissionError:
                active = True
        return active
