"""Read-only canvas runtime routes; shared resources never expose application paths."""
import os
import mimetypes
import re
import urllib.parse
from pathlib import Path

from server.canvas_runtime_package import VIRTUAL_FILES, document_entry, is_canvas, is_shared, runtime_bundle, feature_flags, pin_runtime, safe_file

PATH = re.compile(r'/src/pages/([A-Za-z0-9_-]+)/([A-Za-z0-9_-]+)/(v\d+)/(index\.html|__prota_runtime/([^/]+))')


def serve(handler, workspace):
    raw = urllib.parse.urlsplit(handler.path).path
    path = urllib.parse.unquote(raw)
    if path.startswith('/__prota_preview/'):
        return False  # Immutable preview files have their own loopback/authentication checks.
    reserved = '__prota_runtime' in path
    match = PATH.fullmatch(path)
    if not match:
        if reserved:
            handler.send_error(404)
            return True
        return False
    directory = Path(workspace.workspace_root()).resolve().joinpath('src/pages', *match.groups()[:3])
    if any(p.is_symlink() for p in [directory, *list(directory.parents)[:4]]) or '\\' in path:
        handler.send_error(404)
        return True
    try:
        if not is_canvas(directory):
            if reserved:
                handler.send_error(404)
                return True
            return False
        if not is_shared(directory) and not feature_flags()['sharedCanvasRuntime']:
            if not reserved:
                return False
        if match[4] == 'index.html':
            content = document_entry(workspace.APP_ROOT, directory)
            if not is_shared(directory):
                content = content.replace(b'<body>', b'<body><script>window.__protaCanvasLegacyEntry=true;</script>')
            kind = 'text/html'
        else:
            name = match[5]
            if name not in VIRTUAL_FILES:
                handler.send_error(404)
                return True
            rollback_hash = os.environ.get('PROTA_CANVAS_RUNTIME_HASH')
            if rollback_hash:
                pinned, _ = pin_runtime(workspace.workspace_root(), rollback_hash, workspace.APP_ROOT)
                content = safe_file(pinned / name)
            else:
                manifest, bundle = runtime_bundle(workspace.APP_ROOT)
                if name == 'boot.js':
                    pin_runtime(workspace.workspace_root(), manifest['runtimeHash'], workspace.APP_ROOT)
                content = bundle[name]
            kind = mimetypes.guess_type(name)[0] or 'application/octet-stream'
        handler.send_response(200)
        handler.send_header('Content-Type', kind + ('; charset=utf-8' if kind.startswith('text/') or kind in {'application/javascript', 'application/json'} else ''))
        handler.send_header('Content-Length', str(len(content)))
        handler.send_header('Cache-Control', 'no-store')
        handler.send_header('X-Content-Type-Options', 'nosniff')
        handler.end_headers()
        if handler.command != 'HEAD':
            handler.wfile.write(content)
    except (ValueError, OSError, KeyError) as error:
        handler.send_error(503, 'Canvas runtime unavailable')
    return True
