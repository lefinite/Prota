"""Cross-process coordinator used by the Node Agent gateway (no HTTP trust gap)."""
import argparse
import json
import os
from server.copy_edits import EditService


def coordinate(root, action, lease=None, pid=None):
    service = EditService(root)
    try:
        with service.store.lock():
            service.recover()
            if action == 'start':
                if not lease or not isinstance(pid, int) or pid <= 0:
                    raise ValueError('Invalid Agent lease')
                with service.store.db:
                    service.store.db.execute('INSERT OR REPLACE INTO agent_leases VALUES (?,?)', (lease, pid))
            elif action == 'end':
                with service.store.db:
                    service.store.db.execute('DELETE FROM agent_leases WHERE id=?', (lease,))
            service.drain()
            conflicts = service.records(('conflict',))
            return {'conflictCount': len(conflicts), 'editIds': [r['id'] for r in conflicts]}
    finally:
        service.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['start', 'scan', 'end', 'inventory', 'legacy-import'])
    parser.add_argument('--root', required=True)
    parser.add_argument('--lease')
    parser.add_argument('--pid', type=int)
    args = parser.parse_args()
    if args.action in ('inventory', 'legacy-import'):
        service = EditService(args.root)
        try:
            print(json.dumps(service.inventory() if args.action == 'inventory' else service.import_legacy()))
        finally:
            service.close()
    else:
        print(json.dumps(coordinate(args.root, args.action, args.lease, args.pid)))


def start_worker(root_resolver, paused=lambda: False):
    """Restart recovery plus periodic external-write checks; the watcher is optional."""
    import threading
    import time
    def run():
        while True:
            try:
                root = root_resolver()
                if not paused() and (root / 'data/user-edits.sqlite3').is_file():
                    coordinate(root, 'scan')
            except Exception:
                # The UI independently queries status and reports service failures.
                pass
            time.sleep(5)
    threading.Thread(target=run, name='protected-user-edits', daemon=True).start()
