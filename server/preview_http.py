"""Read-only, loopback-only immutable preview serving. Never routes to workspace files."""
import hashlib
import mimetypes
import os
from pathlib import Path
import re
import tempfile
import time
import urllib.parse


def cache_root(config_dir, workspace_root):
    digest = lambda value: hashlib.sha256(str(value).encode()).hexdigest()[:16]
    return Path(tempfile.gettempdir()) / ('prota-preview-' + digest(Path(config_dir).resolve())) / digest(workspace_root)


def serve(handler, workspace):
    if not handler.workspace_local() or workspace.bridge_locked():
        handler.send_error(403)
        return
    # Cross-site embeddings and fetches are not local preview contexts.
    if handler.headers.get('Sec-Fetch-Site') not in (None, 'same-origin', 'none'):
        handler.send_error(403)
        return
    try:
        raw = urllib.parse.unquote(urllib.parse.urlsplit(handler.path).path)
        match = re.fullmatch(r'/__prota_preview/([a-zA-Z0-9_-]+)/([1-9][0-9]*)/(.+)', raw)
        if not match:
            raise ValueError('Invalid preview URL')
        run, revision, filename = match.groups()
        parts = filename.split('/')
        if any(not p or p.startswith('.') or '\\' in p for p in parts):
            raise ValueError('Invalid path')
        root = cache_root(workspace.CONFIG_DIR, workspace.workspace_root())
        base = root / run / revision
        if time.time() - base.stat().st_mtime > 30 * 60:
            raise ValueError('Expired preview')
        target = base.joinpath(*parts)
        for part in (root, root / run, base, *[base.joinpath(*parts[:i]) for i in range(1, len(parts) + 1)]):
            if part.is_symlink():
                raise ValueError('Symlink rejected')
        if not target.is_file() or base.resolve() not in target.resolve().parents:
            raise ValueError('Not a preview file')
        data = target.read_bytes()
    except (OSError, ValueError):
        handler.send_error(404)
        return
    handler.send_response(200)
    handler.send_header('Content-Type', mimetypes.guess_type(filename)[0] or 'application/octet-stream')
    handler.send_header('Content-Length', str(len(data)))
    handler.send_header('Cache-Control', 'private, no-store')
    handler.send_header('Cross-Origin-Resource-Policy', 'same-origin')
    handler.send_header('X-Content-Type-Options', 'nosniff')
    handler.end_headers()
    if handler.command != 'HEAD':
        handler.wfile.write(data)


def configuration(handler, workspace, update=False):
    import json
    if not handler.workspace_local():
        return handler.workspace_reply(403, {'error': '只能在本机管理内部预览开关。'})
    file = workspace.CONFIG_DIR / 'preview.json'
    try:
        if update:
            if not handler.headers.get('Content-Type', '').startswith('application/json'):
                raise ValueError('Expected JSON')
            length = int(handler.headers.get('Content-Length', '0'))
            if length <= 0 or length > 1024:
                raise ValueError('Invalid request length')
            data = json.loads(handler.rfile.read(length))
            if not isinstance(data, dict) or type(data.get('progressivePreview')) is not bool:
                raise ValueError('progressivePreview must be boolean')
            workspace.atomic_json(file, {'progressivePreview': data['progressivePreview']})
        enabled = json.loads(file.read_text()).get('progressivePreview') is True if file.exists() else os.environ.get('PROTA_PROGRESSIVE_PREVIEW') == '1'
        return handler.workspace_reply(200, {'progressivePreview': enabled})
    except (OSError, ValueError, TypeError) as error:
        return handler.workspace_reply(400, {'error': str(error)})
