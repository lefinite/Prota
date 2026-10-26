"""Private access policies for published links. No passwords enter shared HTML."""
from datetime import datetime, timedelta, timezone
import hashlib
import secrets
import threading

_policy_lock = threading.Lock()

try:
    from server import workspace
except ImportError:
    import workspace


def create_policy(options=None):
    if options is None:
        options = {}
    if not isinstance(options, dict):
        raise ValueError('分享权限参数格式无效。')
    days = options.get('expiresInDays', 30)
    if type(days) is not int or days not in {0, 1, 7, 30}:
        raise ValueError('有效期请选择 1 天、7 天、30 天或永久有效。')
    password = options.get('password', '')
    if not isinstance(password, str) or (password and not 4 <= len(password) <= 128):
        raise ValueError('访问密码须为 4–128 个字符。')
    expires = datetime.now(timezone.utc) + timedelta(days=days) if days else None
    requested_expiry = options.get('expiresAt')
    if requested_expiry is not None:
        now = datetime.now(timezone.utc)
        if not days or type(requested_expiry) is not int or not now.timestamp() * 1000 < requested_expiry <= (expires + timedelta(seconds=60)).timestamp() * 1000:
            raise ValueError('分享到期时间无效，请重新创建分享。')
        expires = datetime.fromtimestamp(requested_expiry / 1000, timezone.utc)
    salt = secrets.token_hex(16) if password else None
    return {'id': secrets.token_hex(16), 'expiresAt': int(expires.timestamp() * 1000) if expires else None,
            'salt': salt, 'passwordHash': hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=32).hex() if password else None,
            'sessionKey': secrets.token_hex(32)}


def save_policy(root, filename, policy, password=None):
    import json
    from pathlib import Path
    path = Path(root) / 'data/share-access.json'
    with _policy_lock:
        policies = json.loads(path.read_text()) if path.is_file() else {}
        policies[filename] = policy
        workspace.atomic_json(path, policies)
        if password is not None:
            # Owner-only local storage, separate from all deployment snapshots.
            # Key by policy ID so failed updates cannot replace a published password.
            copy_path = Path(root) / 'data/share-passwords.json'
            passwords = json.loads(copy_path.read_text()) if copy_path.is_file() else {}
            if policy.get('passwordHash'):
                passwords[policy['id']] = password
                workspace.atomic_json(copy_path, passwords)


def public_policy(policy):
    return {'expiresAt': policy['expiresAt'], 'passwordRequired': bool(policy['passwordHash'])}
