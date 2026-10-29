"""Workspace-local share inventory and transactional withdrawal of fixed URLs."""
from datetime import datetime, timezone
import json
from pathlib import Path
import threading
from urllib.parse import quote

from server import workspace
from server.deployer import VercelDeployer, share_payload, share_zip_filenames, _publish_lock

_lock = threading.RLock()


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8')) if path.is_file() else {}


def inventory(root, host='localhost:8080'):
    root = Path(root)
    saved = read_json(root / 'data/share-management.json')
    settings = read_json(root / 'data/settings.json')
    projects = read_json(root / 'data/projects.json').get('projects', [])
    pending_policies = read_json(root / 'data/share-access.json')
    published_policies = read_json(root / 'data/published-static/.share-access.json')
    names = {p['id']: p.get('name', p['id']) for p in projects}
    records = {key: dict(value) for key, value in saved.items()}
    # Published payloads describe what recipients actually see, even after a failed update.
    for directory, published in [(root / 'shares', False), (root / 'data/published-static/shares', True)]:
        for file in sorted(directory.glob('*.html')):
            if file.is_symlink():
                continue
            try:
                payload = share_payload(file)
                if not isinstance(payload, dict):
                    raise ValueError('invalid payload')
            except (ValueError, OSError):
                continue
            key = file.name
            kind = payload.get('shareType', 'local')
            domain = settings.get('staticDomain' if kind == 'static' else 'publicDomain', '')
            url = f'https://{domain}/shares/{quote(key)}' if kind != 'local' and domain else f'http://{host}/shares/{quote(key)}' if kind == 'local' else ''
            old = records.get(key, {})
            policy = (published_policies if published else pending_policies).get(key, {})
            expires_at = policy.get('expiresAt')
            status = 'active' if published or kind != 'static' else 'local'
            if published and isinstance(expires_at, (int, float)) and expires_at <= datetime.now(timezone.utc).timestamp() * 1000:
                status = 'expired'
            records[key] = {**old, 'id': key, 'name': payload.get('folderName') or payload.get('pageName') or payload.get('pageId') or key,
                            'projectId': payload.get('projectId', ''), 'projectName': names.get(payload.get('projectId'), payload.get('projectName') or payload.get('projectId', '')),
                            'scope': 'folder' if payload.get('mode') == 'folder' else 'page', 'shareType': kind,
                            'version': payload.get('version', ''), 'pageCount': len(payload.get('pages', [])) if payload.get('mode') == 'folder' else 1,
                            'updatedAt': payload.get('generatedAt') or datetime.fromtimestamp(file.stat().st_mtime, timezone.utc).isoformat(),
                            'status': status, 'url': url, 'expiresAt': expires_at, 'passwordRequired': bool(policy.get('passwordHash'))}
    return sorted(records.values(), key=lambda item: item.get('updatedAt', ''), reverse=True)


def manage(root, params, host='localhost:8080'):
    root = Path(root)
    with _lock, _publish_lock:
        records = {item['id']: item for item in inventory(root, host)}
        ids = params.get('ids')
        if not isinstance(ids, list) or not 1 <= len(ids) <= 500 or any(not isinstance(key, str) or key not in records for key in ids):
            raise ValueError('请选择有效的分享记录（最多 500 条）。')
        ids = list(dict.fromkeys(ids))
        action = params.get('action')
        if action == 'copy':
            if len(ids) != 1:
                raise ValueError('每次只能复制一条分享。')
            record = records[ids[0]]
            if record.get('status') in {'revoked', 'expired'} or not record.get('url'):
                raise ValueError('该分享已失效或尚未配置地址。')
            password = ''
            if record.get('passwordRequired'):
                published = root / 'data/published-static/shares' / ids[0]
                policy_path = root / ('data/published-static/.share-access.json' if published.is_file() else 'data/share-access.json')
                policy = read_json(policy_path).get(ids[0], {})
                password = read_json(root / 'data/share-passwords.json').get(policy.get('id'), '')
                if not password:
                    raise ValueError('此旧分享未保存密码，请重新分享并设置密码后复制完整信息。')
            return {'status': 'success', 'share': {'url': record['url'], 'expiresAt': record.get('expiresAt'), 'password': password}}
        if action == 'annotate':
            if len(ids) != 1 or not isinstance(params.get('note', ''), str) or len(params.get('note', '')) > 2000:
                raise ValueError('备注最多 2000 字，每次编辑一条记录。')
            records[ids[0]]['note'] = params.get('note', '').strip()
        elif action == 'revoke':
            active = [key for key in ids if records[key]['status'] != 'revoked']
            online = [key for key in active if (root / 'data/published-static/shares' / key).is_file()]
            if online:
                # On failure no local files or records are removed, making retries safe.
                VercelDeployer(root).deploy(revoke_files=online)
            for key in active:
                file = root / 'shares' / key
                if file.is_file():
                    try:
                        for zipped in share_zip_filenames(share_payload(file)):
                            if Path(zipped).name == zipped and zipped.endswith('.zip'):
                                (root / 'shares' / zipped).unlink(missing_ok=True)
                    except (ValueError, OSError):
                        pass
                    file.unlink()
                records[key].update(status='revoked', revokedAt=datetime.now(timezone.utc).isoformat())
        else:
            raise ValueError('不支持的分享管理操作。')
        workspace.atomic_json(root / 'data/share-management.json', records)
        return {'status': 'success', 'items': inventory(root, host)}
