"""Immutable, share-scoped MCP indexes. No workspace discovery at request time."""
from datetime import datetime, timezone
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlsplit

TEXT = {'.html', '.css', '.js', '.mjs', '.json', '.md', '.txt', '.svg', '.xml', '.drawio', '.map'}
IMAGES = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
MAX_FILE = 32 * 1024 * 1024
MAX_SNAPSHOT = 200 * 1024 * 1024


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_file(root, relative):
    root = Path(root).resolve()
    parts = Path(relative).parts
    if not parts or Path(relative).is_absolute() or '\\' in relative or any(p.startswith('.') for p in parts):
        raise ValueError('MCP 资源路径无效。')
    path = root / relative
    if any(parent.is_symlink() for parent in [path, *path.parents] if parent != root and root in parent.parents):
        raise ValueError('MCP 资源不能包含符号链接。')
    if not path.resolve().is_relative_to(root):
        raise ValueError('MCP 资源越界。')
    return path


def references(text):
    patterns = [r'''(?:src|href|poster)\s*=\s*["']([^"']+)["']''',
                r'''url\(\s*["']?([^\s)'"<>]+)''',
                r'''(?:from\s*|import\s*\(?|fetch\s*\()\s*["']([^"']+)["']''',
                r'''@import\s*["']([^"']+)["']''',
                r'''!?\[[^\]]*\]\(([^\s)]+)''',
                r'''["']((?:\.?\.?/)?(?:assets|boards)/[^"'<>]+)["']''']
    return set(ref for pattern in patterns for ref in re.findall(pattern, text, re.I))


def preserve_previous(previous, static):
    """Relocate only overwritten bytes; unchanged resources still reference content."""
    previous, static = Path(previous).resolve(), Path(static).resolve()
    for file in (static / '.mcp').glob('*/manifest.json'):
        manifest = json.loads(file.read_text())
        changed = False
        for resource in manifest['resources'].values():
            if resource['source'] != 'content':
                continue
            current = safe_file(static, resource['relativePath'])
            if current.is_file() and digest(current.read_bytes()) == resource['sha256']:
                continue
            old = safe_file(previous, resource['relativePath'])
            data = old.read_bytes()
            if digest(data) != resource['sha256']:
                raise ValueError('已发布 MCP 快照校验失败。')
            target = static / '.mcp' / 'blobs' / resource['sha256']
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            resource.update(source='private', relativePath='blobs/' + resource['sha256'])
            changed = True
        if changed:
            file.write_text(json.dumps(manifest, ensure_ascii=False))


def prune_private(static):
    private = Path(static) / '.mcp'
    used = set()
    for file in private.glob('*/manifest.json'):
        manifest = json.loads(file.read_text())
        used.update(r['relativePath'] for r in manifest['resources'].values() if r['source'] == 'private')
    for file in (private / 'blobs').glob('*'):
        if 'blobs/' + file.name not in used:
            file.unlink()


def build_context(root, static, filename, payload, application_root=None):
    """Index selected version files and only selected/bound documents + dependencies."""
    root, static = Path(root).resolve(), Path(static).resolve()
    application_root = Path(application_root or root).resolve()
    private = static / '.mcp'
    destination = private / filename
    shutil.rmtree(destination, ignore_errors=True)
    destination.mkdir(parents=True)
    resources, pages, missing, external = {}, [], [], set()
    total = 0
    counted_files = set()
    project = payload['projectId']

    def add(page, path, source='content', data=None, kind=None):
        nonlocal total
        rid = f"{page['pageId']}/{page['version']}/{source}/{path}"
        if rid in resources:
            return rid
        file = safe_file(static if source == 'content' else private, path)
        if data is None and file.stat().st_size > MAX_FILE:
            raise ValueError('MCP 单个资源超过 32 MiB，请缩小分享范围。')
        data = file.read_bytes() if data is None else data
        if len(data) > MAX_FILE:
            raise ValueError('MCP 单个资源超过 32 MiB，请缩小分享范围。')
        if (source, path) not in counted_files:
            total += len(data)
            counted_files.add((source, path))
        if total > MAX_SNAPSHOT:
            raise ValueError('MCP 快照超过 200 MiB，请缩小分享范围。')
        suffix = Path(path).suffix.lower()
        mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
        resources[rid] = {'pageId': page['pageId'], 'kind': kind or suffix.lstrip('.') or 'binary',
                          'source': source, 'relativePath': path, 'sha256': digest(data), 'size': len(data),
                          'mimeType': mime, 'text': suffix in TEXT}
        page['resourceIds'].append(rid)
        return rid

    def private_data(page, name, data, kind=None):
        relative = f'{filename}/{page["pageId"]}/{name}'
        file = safe_file(private, relative)
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)
        return add(page, relative, 'private', data, kind)

    for selected in payload.get('pages', []) if payload.get('mode') == 'folder' else [payload]:
        page_id, version = selected.get('pageId') or selected.get('id'), selected['version']
        if not re.fullmatch(r'[A-Za-z0-9_-]+', str(page_id)) or not re.fullmatch(r'v\d+', version):
            raise ValueError('MCP 页面版本无效。')
        prefix = f'src/pages/{project}/{page_id}/{version}/'
        page_prefix = f'src/pages/{project}/{page_id}/'
        base = safe_file(static, prefix)
        if not (base / 'index.html').is_file():
            raise ValueError('MCP 页面入口缺失。')
        page = {'pageId': page_id, 'name': selected.get('pageName') or selected.get('name') or page_id,
                'version': version, 'targetDevice': selected.get('targetDevice', 'mobile'),
                'pageMode': selected.get('pageMode', 'standard'), 'parentId': selected.get('parentId'),
                'order': selected.get('order', 0), 'resourceIds': [], 'documents': [], 'boards': [],
                'nodes': [], 'edges': [], 'annotations': selected.get('annotations', []),
                'interactions': {'sourceKind': 'prototype-code', 'inferred': True}, 'visuals': []}
        pages.append(page)
        docs = selected.get('documents') or []
        chosen = selected.get('prdPath', '').lstrip('/')
        # Payload PRD fallback can refer to an unrelated last-opened document. Reject it.
        chosen_meta = next((d for d in docs if d.get('path', '').lstrip('/') == chosen), {})
        explicit = selected.get('mcpSelectedPrdPath', '').lstrip('/')
        allowed_docs = {d['path'].lstrip('/') for d in docs if d.get('prototypeVersion') == version}
        if chosen and (chosen == explicit or chosen.startswith(prefix) or chosen_meta.get('prototypeVersion') == version):
            allowed_docs.add(chosen)
        for path in allowed_docs:
            if not path.startswith(page_prefix):
                raise ValueError('MCP 文档不属于选定页面。')
        state_file = base / 'canvas-data.js'
        state = None
        revision_sources = set()
        if state_file.is_file():
            try:
                state = json.loads(state_file.read_text().split('=', 1)[1].strip().removesuffix(';'))
            except (ValueError, IndexError):
                raise ValueError('MCP 画布结构无法解析。') from None
            working = {str(Path(n['src']).parent) for n in state.get('nodes', []) if n.get('src') and not n.get('boardRevisionId')}
            revision_sources = {str(Path(n['src']).parent) for n in state.get('nodes', []) if n.get('src') and n.get('boardRevisionId')} - working
        def replaced_by_revision(path):
            return any(path.startswith(prefix + directory + '/') for directory in revision_sources)
        queue = [p.relative_to(static).as_posix() for p in base.rglob('*')
                 if p.is_file() and not any(part.startswith('.') or part in {'node_modules', '__pycache__', 'board-history'}
                                            for part in p.relative_to(base).parts)]
        # Do not expose index metadata or documents bound to other versions even inside vN.
        excluded = {d['path'].lstrip('/') for d in docs if d.get('prototypeVersion') not in {None, version}} - allowed_docs
        queue = [p for p in queue if p not in excluded and not p.endswith('prd-index.json') and not replaced_by_revision(p)]
        queue += sorted(allowed_docs)
        for kind in ['diagram', 'mindmap']:
            path = selected.get(kind + 'Path', '').lstrip('/')
            if path and (path.startswith(prefix) or path.startswith(page_prefix + 'docs/')):
                queue.append(path)
        seen = set()
        while queue:
            path = queue.pop(0)
            if path in seen:
                continue
            if replaced_by_revision(path):
                continue
            seen.add(path)
            if not (path.startswith(prefix) or path in allowed_docs or path.startswith(page_prefix + 'docs/')
                    or path.startswith(('assets/', 'src/templates/'))):
                raise ValueError('MCP 依赖超出分享版本。')
            if path in excluded or path.endswith('prd-index.json'):
                raise ValueError('MCP 依赖引用了其他版本文档。')
            file = safe_file(static, path)
            if path.startswith(('assets/', 'src/templates/')):
                origin = safe_file(root if path.startswith('assets/') else application_root, path)
                if origin.is_file():
                    if origin.stat().st_size > MAX_FILE:
                        raise ValueError('MCP 单个资源超过 32 MiB，请缩小分享范围。')
                    file.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(origin, file)
            if not file.is_file():
                raise ValueError('MCP 发布依赖缺失：' + path)
            rid = add(page, path)
            if path == prefix + 'index.html':
                page['entryResourceId'] = rid
            if path in allowed_docs:
                page['documents'].append({'resourceId': rid, 'name': file.name, 'prototypeVersion': version})
            if file.suffix.lower() in TEXT:
                for ref in references(file.read_text(encoding='utf-8')):
                    parsed = urlsplit(ref)
                    if parsed.scheme or parsed.netloc:
                        if parsed.scheme in {'http', 'https'} or parsed.netloc:
                            external.add(ref)
                        continue
                    if not parsed.path or parsed.path.startswith('#'):
                        continue
                    resolved = os.path.normpath(unquote(parsed.path).lstrip('/') if parsed.path.startswith('/')
                                                else str(Path(path).parent / unquote(parsed.path))).replace(os.sep, '/')
                    # Navigational links are not static dependencies.
                    if Path(resolved).suffix.lower() not in TEXT | IMAGES | {'.woff', '.woff2', '.ttf', '.otf', '.pdf', '.mp3', '.mp4', '.wasm'}:
                        continue
                    queue.append(resolved)
        if selected.get('prdContent') and chosen in allowed_docs:
            # Freeze exactly the content embedded in this share, including unsaved document text.
            rid = private_data(page, 'selected-prd.md', selected['prdContent'].encode())
            page['documents'].insert(0, {'resourceId': rid, 'name': selected.get('prdFilename') or 'PRD', 'prototypeVersion': version})
        if state is not None:
            page['nodes'], page['edges'] = state.get('nodes', []), state.get('edges', [])
            for node in page['nodes']:
                if node.get('type') != 'board' and not node.get('boardId'):
                    continue
                board = {key: node.get(key) for key in ['boardId', 'boardVersionId', 'boardRevisionId']}
                board.update(instanceId=node['id'], sourceKind='revision' if node.get('boardRevisionId') else 'working-copy')
                board['resourceIds'] = []
                if node.get('boardRevisionId'):
                    from server.board_revisions import verified_package
                    manifest, files = verified_package(root / page_prefix, node['boardId'], node['boardRevisionId'])
                    for name, data in files.items():
                        rid = private_data(page, f"revisions/{node['boardId']}/{node['boardRevisionId']}/{name}", data)
                        board['resourceIds'].append(rid)
                        if name == manifest['entry']:
                            board['entryResourceId'] = rid
                    board['entry'] = manifest['entry']
                else:
                    source = node.get('src', '').split('?', 1)[0]
                    board['resourceIds'] = [rid for rid in page['resourceIds'] if resources[rid]['relativePath'].startswith(prefix + str(Path(source).parent) + '/')]
                    board['entryResourceId'] = next((rid for rid in board['resourceIds'] if resources[rid]['relativePath'] == prefix + source), None)
                    if not board['resourceIds']:
                        missing.append({'pageId': page_id, 'instanceId': node['id'], 'kind': 'board-entry', 'reason': '画板工作副本没有可用入口。'})
                page['boards'].append(board)
        page['interactions']['resourceIds'] = [rid for rid in page['resourceIds'] if resources[rid]['kind'] in {'js', 'mjs', 'html'}]
        page['implementation'] = {'entryResourceId': page.get('entryResourceId'),
                                  'styleResourceIds': [rid for rid in page['resourceIds'] if resources[rid]['kind'] == 'css']}
        page['visualAvailable'] = False
        page['visualMissingReason'] = '本次分享未采集实际渲染截图；图片素材不代表页面截图。'
        page['contextResourceId'] = private_data(page, 'context.json', json.dumps(page, ensure_ascii=False).encode(), 'json')
    manifest = {'schemaVersion': 1, 'shareId': filename, 'project': {'id': project, 'name': payload.get('projectName', project)},
                'shareType': 'folder' if payload.get('mode') == 'folder' else 'page',
                'generatedAt': payload.get('generatedAt') or datetime.now(timezone.utc).isoformat(),
                'folders': payload.get('folders', []), 'pages': pages, 'resources': resources,
                'missing': missing, 'externalDependencies': sorted(external)}
    manifest['snapshotId'] = 'sha256:' + digest(json.dumps(manifest, sort_keys=True, ensure_ascii=False).encode())
    encoded = json.dumps(manifest, ensure_ascii=False)
    if len(encoded.encode()) > 8 * 1024 * 1024:
        raise ValueError('MCP 资源索引超过 8 MiB，请缩小分享范围。')
    (destination / 'manifest.json').write_text(encoded)
    return manifest
