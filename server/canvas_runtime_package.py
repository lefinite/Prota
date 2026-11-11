"""One editor source, virtual local resources, immutable export bundles.

The existing infinite-canvas template is the sole editor view/code source (also
used by legacy test fixtures). editor-shell.js is derived, never hand maintained.
No document/board data is changed by packaging or virtual local entry resolution.
"""
import hashlib
import os
import json
import re
import shutil
import tempfile
from html.parser import HTMLParser
import urllib.parse
from pathlib import Path

from server import workspace

FORMAT = 'shared-v1'
BOOT_TAG = re.compile(r'<script\s+src="(?P<src>[^"<>]+)"\s+data-prota-canvas-shell="shared-v1"(?P<rest>[^>]*)></script>')
HASH = re.compile(r'[0-9a-f]{64}')
EDITOR_FILES = ('styles.css', 'app.js', 'canvas-core.js', 'canvas-domain.js', 'canvas-connections.js', 'flow-shapes.js', 'flow-quick-create.js', 'icons.js', 'marked.js', 'markdown.js', 'board-state.js', 'canvas-mermaid.js', 'LICENSE.lucide', 'LICENSE.marked')
VIRTUAL_FILES = frozenset((*EDITOR_FILES, 'boot.js', 'editor-shell.js', 'runtime-manifest.json', 'runtime-manifest.js', 'runtime-contract.json'))


def feature_flags():
    return {key: os.environ.get(env, '1').lower() not in {'0', 'false', 'off'} for key, env in {
        'sharedCanvasRuntime': 'PROTA_SHARED_CANVAS_RUNTIME',
        'canvasLegacyShellMigration': 'PROTA_CANVAS_LEGACY_MIGRATION',
        'canvasPackageV2': 'PROTA_CANVAS_PACKAGE_V2',
    }.items()}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_file(path):
    path = Path(path)
    if path.is_symlink():
        raise ValueError('Runtime 资源不能包含符号链接')
    if not path.is_file():
        raise ValueError(f'Runtime 资源缺失：{path.name}')
    return path.read_bytes()


EXTENSION_CONFIG = re.compile(r'<script\b[^>]*\bid=["\']prota-canvas-extensions["\'][^>]*>(.*?)</script>', re.S | re.I)


def page_extensions(directory):
    """Preserve page-owned host integrations while sharing only editor code."""
    directory = Path(directory)
    def valid(value):
        if not isinstance(value, str):
            raise ValueError('画布扩展路径无效')
        parsed = urllib.parse.urlsplit(value)
        path = urllib.parse.unquote(parsed.path)
        parts = path.removeprefix('./').split('/')
        if parsed.scheme or parsed.netloc or path.startswith('/') or '\\' in path or not parts or any(not part or part.startswith('.') for part in parts):
            raise ValueError('画布扩展必须位于当前版本目录')
        target = directory.joinpath(*parts)
        if any(item.is_symlink() for item in [target, *target.parents] if directory in item.parents):
            raise ValueError('画布扩展不能包含符号链接')
        if not target.is_file():
            raise ValueError('画布扩展文件缺失：' + value)
        return value
    def normalize(config):
        if not isinstance(config, dict) or config.get('version') != 1:
            raise ValueError('画布扩展配置无效')
        result = {'version':1}
        for kind in ('scripts', 'styles'):
            values = config.get(kind, [])
            if not isinstance(values, list) or len(values) > 32:
                raise ValueError('画布扩展配置无效')
            result[kind] = list(dict.fromkeys(valid(value) for value in values))
        return result
    class References(HTMLParser):
        def __init__(self):
            super().__init__(); self.scripts=[]; self.styles=[]
        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            value = attrs.get('src') if tag == 'script' else attrs.get('href') if tag == 'link' and attrs.get('rel') == 'stylesheet' else None
            if not value:
                return
            path = urllib.parse.urlsplit(value).path.removeprefix('./')
            if path in {*EDITOR_FILES, 'canvas-data.js', '__prota_runtime/boot.js'} or '__prota_runtime/' in path:
                return
            (self.scripts if tag == 'script' else self.styles).append(value)
    sources = [directory/'index.html', directory/'.canvas-runtime-backup/shared-v1/index.html', directory/'.canvas-runtime-backup/index.html']
    for source in sources:
        if not source.is_file():
            continue
        text = safe_file(source).decode('utf-8')
        explicit = EXTENSION_CONFIG.search(text)
        if explicit:
            return normalize(json.loads(explicit[1]))
        refs = References(); refs.feed(text)
        if refs.scripts or refs.styles:
            return normalize({'version':1,'scripts':refs.scripts,'styles':refs.styles})
    return {'version':1,'scripts':[],'styles':[]}


def document_entry(app=None, directory=None):
    entry = safe_file(Path(app or workspace.APP_ROOT) / 'src/templates/infinite-canvas-document/index.html')
    if directory is not None:
        config = page_extensions(directory)
        if config['scripts'] or config['styles']:
            encoded = json.dumps(config, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
            marker = '<script type="application/json" id="prota-canvas-extensions">' + encoded + '</script>\n'
            entry = entry.replace(b'<script src="./canvas-data.js">', marker.encode() + b'<script src="./canvas-data.js">')
    return entry


def is_shared(directory):
    file = Path(directory) / 'index.html'
    return file.is_file() and bool(BOOT_TAG.search(safe_file(file).decode('utf-8')))


def is_canvas(directory):
    directory = Path(directory)
    if not (directory / 'canvas-data.js').is_file() or not (directory / 'index.html').is_file():
        return False
    entry = safe_file(directory / 'index.html').decode('utf-8')
    return bool(BOOT_TAG.search(entry)) or ('id="stage"' in entry and 'canvas-data.js' in entry and 'canvas-core.js' in entry)


def _build_runtime_bundle(app=None):
    app = Path(app or workspace.APP_ROOT)
    source = app / 'src/templates/infinite-canvas'
    files = {name: safe_file(source / name) for name in EDITOR_FILES}
    files['boot.js'] = safe_file(app / 'src/canvas-runtime/boot.js')
    entry = safe_file(source / 'index.html').decode('utf-8')
    body_match = re.search(r'<body\b[^>]*>(.*?)</body>', entry, re.S | re.I)
    if not body_match:
        raise ValueError('Runtime 视图缺少 body')
    data_script = re.search(r'<script\s+src="\./canvas-data\.js"', body_match[1])
    if not data_script:
        raise ValueError('Runtime 视图缺少文档加载边界')
    body = body_match[1][:data_script.start()]
    inline = re.findall(r'<script>(.*?)</script>', body, re.S)
    markup = re.sub(r'<script>.*?</script>', '', body, flags=re.S)
    files['editor-shell.js'] = ('document.body.insertAdjacentHTML("beforeend",' + json.dumps(markup, ensure_ascii=False) + ');\n' + '\n'.join(inline)).encode()
    scripts = [name for name in re.findall(r'<script src="\./([\w.-]+\.js)"', entry) if name != 'canvas-data.js']
    if not scripts or scripts[-1] != 'app.js' or any(name not in files for name in scripts):
        raise ValueError('Runtime 脚本依赖不完整')
    version = re.search(rb'runtimeVersion:\s*(\d+)', files['app.js'])
    if not version:
        raise ValueError('Runtime 缺少版本标识')
    contract = dict(runtimeVersion=int(version[1]), documentSchemas=[1, 2], minPortalApi=1, scripts=scripts)
    files['runtime-contract.json'] = json.dumps(contract, sort_keys=True, separators=(',', ':')).encode()
    hashes = {name: digest(content) for name, content in sorted(files.items())}
    runtime_hash = digest(json.dumps(hashes, sort_keys=True, separators=(',', ':')).encode())
    manifest = dict(format=1, runtimeHash=runtime_hash, runtimeVersion=int(version[1]), documentSchemas=[1, 2], minPortalApi=1, files=hashes, scripts=scripts)
    files['runtime-manifest.json'] = json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode()
    files['runtime-manifest.js'] = b'window.__protaCanvasRuntimeManifest = ' + files['runtime-manifest.json'] + b';\n'
    return manifest, files


from functools import lru_cache

@lru_cache(maxsize=4)
def _cached_bundle(app, signature):
    return _build_runtime_bundle(app)


def runtime_bundle(app=None):
    app = Path(app or workspace.APP_ROOT).resolve()
    source = app / 'src/templates/infinite-canvas'
    paths = [*(source / name for name in EDITOR_FILES), source / 'index.html', app / 'src/canvas-runtime/boot.js']
    signature = tuple((p.stat().st_mtime_ns, p.stat().st_size, p.is_symlink()) for p in paths)
    return _cached_bundle(str(app), signature)


def verify_bundle(directory, expected=None):
    directory = Path(directory)
    if directory.is_symlink():
        raise ValueError('Runtime 目录不能是符号链接')
    manifest_bytes = safe_file(directory / 'runtime-manifest.json')
    manifest = json.loads(manifest_bytes)
    if manifest.get('format') != 1 or not HASH.fullmatch(str(manifest.get('runtimeHash', ''))):
        raise ValueError('Runtime 清单格式无效')
    hashes = manifest.get('files', {})
    if set(hashes) != VIRTUAL_FILES - {'runtime-manifest.js', 'runtime-manifest.json'}:
        raise ValueError('Runtime 清单资源不完整')
    for name, checksum in hashes.items():
        if digest(safe_file(directory / name)) != checksum:
            raise ValueError(f'Runtime 资源校验失败：{name}')
    actual = digest(json.dumps(hashes, sort_keys=True, separators=(',', ':')).encode())
    if actual != manifest['runtimeHash'] or expected and actual != expected:
        raise ValueError('Runtime 哈希不匹配')
    if safe_file(directory / 'runtime-manifest.js') != b'window.__protaCanvasRuntimeManifest = ' + manifest_bytes + b';\n':
        raise ValueError('Runtime 启动清单不匹配')
    contract = json.loads(safe_file(directory / 'runtime-contract.json'))
    if contract != {key:manifest.get(key) for key in ('runtimeVersion', 'documentSchemas', 'minPortalApi', 'scripts')}:
        raise ValueError('Runtime 依赖契约不匹配')
    if manifest.get('documentSchemas') != [1, 2] or manifest.get('scripts', []) != [name for name in manifest.get('scripts', []) if name in hashes] or not manifest.get('scripts') or manifest['scripts'][-1] != 'app.js':
        raise ValueError('Runtime 兼容性或依赖无效')
    return manifest


def pin_runtime(root, runtime_hash=None, app=None):
    root = Path(root).resolve()
    if runtime_hash is not None and not HASH.fullmatch(str(runtime_hash)):
        raise ValueError('Runtime 哈希格式无效')
    if runtime_hash:
        # A build/gateway snapshot carries its own immutable runtime already.
        for candidate in [root / '__prota_runtime' / runtime_hash, root / 'data/share-archive/__prota_runtime' / runtime_hash]:
            if any(path.is_symlink() for path in [candidate, *candidate.parents] if path == root or root in path.parents):
                raise ValueError('Runtime 缓存不能包含符号链接')
            if candidate.exists():
                return candidate, verify_bundle(candidate, runtime_hash)
    manifest, files = runtime_bundle(app)
    if runtime_hash and runtime_hash != manifest['runtimeHash']:
        raise ValueError('分享固定的 Runtime 不存在，不能替换为当前版本')
    runtime_hash = manifest['runtimeHash']
    archive = root / 'data/share-archive/__prota_runtime'
    if any(path.is_symlink() for path in [root/'data', root/'data/share-archive', archive]):
        raise ValueError('Runtime 缓存路径无效')
    archive.mkdir(parents=True, exist_ok=True)
    if archive.is_symlink() or root not in archive.resolve().parents:
        raise ValueError('Runtime 缓存路径无效')
    destination = archive / runtime_hash
    if not destination.exists():
        with tempfile.TemporaryDirectory(prefix='.runtime-', dir=archive) as temp:
            staged = Path(temp) / runtime_hash
            staged.mkdir()
            for name, data in files.items():
                (staged / name).write_bytes(data)
            verify_bundle(staged, runtime_hash)
            try:
                staged.rename(destination)
            except OSError:
                if not destination.is_dir():
                    raise
    return destination, verify_bundle(destination, runtime_hash)


def materialize_runtime(destination, pinned, runtime_hash):
    verify_bundle(pinned, runtime_hash)
    destination = Path(destination)
    if destination.exists():
        verify_bundle(destination, runtime_hash)
        return
    destination.mkdir(parents=True)
    for name in VIRTUAL_FILES:
        (destination / name).write_bytes(safe_file(Path(pinned) / name))
    verify_bundle(destination, runtime_hash)


SNAPSHOT_PATH = re.compile(r'__prota_canvas/([0-9a-f]{64})/src/pages/([A-Za-z0-9_-]+)/([A-Za-z0-9_-]+)/(v\d+)/index\.html')


def snapshot_directory(root, entry, parts=None):
    match = SNAPSHOT_PATH.fullmatch(str(entry))
    if not match or parts and list(match.groups()[1:]) != list(parts):
        raise ValueError('画布分享快照路径无效')
    root = Path(root).resolve()
    for base in [root, root / 'data/share-archive']:
        path = base / entry
        if path.is_file():
            if path.is_symlink() or any(p.is_symlink() for p in path.parents if root in p.parents):
                raise ValueError('分享快照不能包含符号链接')
            return path.parent
    raise ValueError('画布分享快照缺失')


def public_files(directory):
    directory = Path(directory)
    if directory.is_symlink():
        raise ValueError('画布不能包含符号链接')
    for file in sorted(directory.rglob('*')):
        relative = file.relative_to(directory)
        if file.is_symlink():
            raise ValueError('画布不能包含符号链接')
        if any(part.startswith('.') or part in {'node_modules', '__pycache__'} for part in relative.parts):
            continue
        if file.is_file():
            yield relative, file


def freeze_canvas_page(root, directory, parts, runtime_hash, app=None):
    # Freeze at share creation, before ZIP generation; later workspace edits cannot
    # make HTML disagree with the ZIP or replace another share's business snapshot.
    entries = {}
    for relative, file in public_files(directory):
        if relative.parts[0] == '__prota_runtime' or len(relative.parts) == 1 and relative.name in EDITOR_FILES:
            continue
        entries['/'.join(parts) + '/' + relative.as_posix()] = document_entry(app, directory) if relative.as_posix() == 'index.html' else safe_file(file)
    docs = Path(directory).parent / 'docs'
    if docs.is_dir():
        for relative, file in public_files(docs):
            entries['/'.join(parts[:2]) + '/docs/' + relative.as_posix()] = safe_file(file)
    snapshot_hash = digest(json.dumps({'runtime':runtime_hash, 'files':{name:digest(content) for name, content in sorted(entries.items())}}, sort_keys=True, separators=(',', ':')).encode())
    relative_root = '__prota_canvas/' + snapshot_hash
    archive = Path(root).resolve() / 'data/share-archive'
    target = archive / relative_root
    if not target.exists():
        if any(path.is_symlink() for path in [Path(root).resolve()/'data', archive, archive/'__prota_canvas']):
            raise ValueError('分享归档路径无效')
        archive.mkdir(parents=True, exist_ok=True)
        if archive.is_symlink() or (archive / '__prota_canvas').is_symlink():
            raise ValueError('分享归档路径无效')
        with tempfile.TemporaryDirectory(prefix='.canvas-snapshot-', dir=archive) as temp:
            staged = Path(temp) / snapshot_hash
            for name, content in entries.items():
                path = staged / 'src/pages' / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
            target.parent.mkdir(parents=True, exist_ok=True)
            try:
                staged.rename(target)
            except OSError:
                if not target.is_dir():
                    raise
    return relative_root + '/src/pages/' + '/'.join(parts) + '/index.html'


def pin_share_pages(root, payload, app=None):
    root = Path(root).resolve()
    for page in payload.get('pages', []) if payload.get('mode') == 'folder' else [payload]:
        page_id = page.get('pageId') or page.get('id')
        parts = [payload.get('projectId'), page_id, page.get('version')]
        if not all(isinstance(p, str) and re.fullmatch(r'[A-Za-z0-9_-]+', p) for p in parts) or not re.fullmatch(r'v\d+', parts[2]):
            raise ValueError('分享页面路径无效')
        if page.get('canvasEntryPath'):
            directory = snapshot_directory(root, page['canvasEntryPath'], parts)
        else:
            directory = Path(root).joinpath('src/pages', *parts)
        if root not in directory.resolve().parents or any(path.is_symlink() for path in [directory, *directory.parents] if root in path.parents):
            raise ValueError('分享画布路径无效')
        if is_shared(directory):
            _, manifest = pin_runtime(root, page.get('canvasRuntimeHash'), app)
            validate_document_schema(directory, manifest)
            page['canvasRuntimeHash'] = manifest['runtimeHash']
            if not page.get('canvasEntryPath'):
                page['canvasEntryPath'] = freeze_canvas_page(root, directory, parts, manifest['runtimeHash'], app)
            old_prefix = 'src/pages/' + '/'.join(parts[:2]) + '/'
            new_prefix = str(Path(page['canvasEntryPath']).parents[1]).replace('\\', '/') + '/'
            def rewrite_paths(value):
                if isinstance(value, dict):
                    for key, item in list(value.items()):
                        if key in {'path','prdPath','diagramPath','mindmapPath','mcpSelectedPrdPath'} and isinstance(item, str) and item.lstrip('/').startswith(old_prefix):
                            value[key] = ('/' if item.startswith('/') else '') + new_prefix + item.lstrip('/')[len(old_prefix):]
                        elif isinstance(item, (dict,list)):
                            rewrite_paths(item)
                elif isinstance(value, list):
                    for item in value:
                        rewrite_paths(item)
            rewrite_paths(page)

    return payload


def stage_web_runtime(root, static, directory, page, app=None):
    if not is_shared(directory):
        if page.get('canvasRuntimeHash'):
            raise ValueError('固定 Runtime 的画布入口缺失')
        return
    pinned, manifest = pin_runtime(root, page.get('canvasRuntimeHash'), app)
    runtime_hash = manifest['runtimeHash']
    materialize_runtime(Path(static) / '__prota_runtime' / runtime_hash, pinned, runtime_hash)
    index = Path(directory) / 'index.html'
    text = safe_file(index).decode('utf-8')
    text, count = BOOT_TAG.subn(lambda match: '<script src="/__prota_runtime/' + runtime_hash + '/boot.js" data-prota-canvas-shell="shared-v1"' + match['rest'] + '></script>', text)
    if count != 1:
        raise ValueError('画布启动入口必须唯一')
    index.write_text(text, encoding='utf-8')
    page['canvasRuntimeHash'] = runtime_hash
    # Verify data compatibility without rewriting the document.
    validate_document_schema(directory, manifest)


def validate_document_schema(directory, manifest):
    text = safe_file(Path(directory) / 'canvas-data.js').decode('utf-8')
    match = re.search(r'window\.PROTA_CANVAS\s*=\s*', text)
    if not match:
        raise ValueError('画布文档格式无效')
    state = json.JSONDecoder().raw_decode(text[match.end():])[0]
    if state.get('schemaVersion') not in manifest['documentSchemas']:
        raise ValueError('Runtime 不兼容此画布文档版本')
    return state


def zip_runtime_files(root, directory, runtime_hash=None, app=None):
    """Return additional ZIP entries; never install resources into a business dir."""
    if not is_shared(directory):
        return {}
    if not feature_flags()['canvasPackageV2']:
        raise ValueError('共享画布打包已停用，原有导出文件仍可使用')
    pinned, manifest = pin_runtime(root, runtime_hash, app)
    validate_document_schema(directory, manifest)
    return {'__prota_runtime/' + name: safe_file(pinned / name) for name in VIRTUAL_FILES}


def migrate_entry(root, params, app=None):
    """Atomic, idempotent legacy entry migration. Caller guards active browser edits."""
    from server.canvas_transactions import page_lock
    if not feature_flags()['canvasLegacyShellMigration']:
        return {'deferred': True, 'reason': 'legacy-migration-disabled'}
    parts = [params.get(key, '') for key in ('projectId', 'pageId', 'version')]
    if not all(isinstance(p, str) and re.fullmatch(r'[A-Za-z0-9_-]+', p) for p in parts) or not re.fullmatch(r'v\d+', parts[2]):
        raise ValueError('页面路径无效')
    root = Path(root).resolve()
    raw = root.joinpath('src/pages', *parts)
    directory = raw.resolve()
    if root not in directory.parents or raw.is_symlink() or any(p.is_symlink() for p in raw.parents if root in p.parents):
        raise ValueError('画布路径无效')
    if not is_canvas(directory):
        raise ValueError('仅能迁移无限画布')
    from server.copy_edits import guard_legacy_runtime
    guard_legacy_runtime(directory)
    manifest, _ = runtime_bundle(app)
    validate_document_schema(directory, manifest)
    with page_lock(directory):
        if not is_shared(directory):
            backup = directory / '.canvas-runtime-backup/shared-v1'
            if backup.is_symlink() or backup.parent.is_symlink():
                raise ValueError('迁移备份路径无效')
            backup.mkdir(parents=True, exist_ok=True)
            original = safe_file(directory / 'index.html')
            if not (backup / 'index.html').exists():
                (backup / 'index.html').write_bytes(original)
            checksums = {}
            for name in ('index.html', *EDITOR_FILES):
                file = directory / name
                if file.is_file():
                    checksums[name] = digest(safe_file(file))
                    target = backup / name
                    if not target.exists():
                        target.write_bytes(safe_file(file))
            for name in checksums:
                if digest(safe_file(backup / name)) != checksums[name]:
                    raise ValueError('旧编辑器备份校验失败')
            (backup / 'migration-manifest.json').write_text(json.dumps({'format': FORMAT, 'files': checksums}, sort_keys=True))
            staged = directory / '.canvas-shared-entry.tmp'
            if staged.is_symlink():
                raise ValueError('迁移暂存路径无效')
            staged.write_bytes(document_entry(app, directory))
            try:
                staged.replace(directory / 'index.html')
                # Retire only known top-level editor resources. Board JS/CSS is business data.
                for name in EDITOR_FILES:
                    (directory / name).unlink(missing_ok=True)
            except OSError:
                for name in checksums:
                    if name != 'index.html':
                        (directory / name).write_bytes(safe_file(backup / name))
                staged.write_bytes(original)
                staged.replace(directory / 'index.html')
                raise
            finally:
                staged.unlink(missing_ok=True)
    return {'runtimeVersion': manifest['runtimeVersion'], 'runtimeHash': manifest['runtimeHash'], 'shellFormat': FORMAT}


def restore_entry(root, params):
    """Rollback only the editor entry; never restore business data from a backup."""
    parts = [params.get(key, '') for key in ('projectId', 'pageId', 'version')]
    if not all(isinstance(p, str) and re.fullmatch(r'[A-Za-z0-9_-]+', p) for p in parts) or not re.fullmatch(r'v\d+', parts[2]):
        raise ValueError('页面路径无效')
    root = Path(root).resolve()
    directory = root.joinpath('src/pages', *parts)
    if directory.is_symlink() or root not in directory.resolve().parents:
        raise ValueError('画布路径无效')
    backup = directory / '.canvas-runtime-backup/shared-v1'
    if backup.is_symlink() or backup.parent.is_symlink():
        raise ValueError('回退备份路径无效')
    manifest = json.loads(safe_file(backup / 'migration-manifest.json'))
    original = safe_file(backup / 'index.html')
    if digest(original) != manifest['files']['index.html']:
        raise ValueError('回退入口校验失败')
    for name, checksum in manifest['files'].items():
        if name not in {'index.html', *EDITOR_FILES} or digest(safe_file(backup / name)) != checksum:
            raise ValueError('回退资源校验失败')
    for name in manifest['files']:
        if name != 'index.html':
            target = directory / name
            if target.is_symlink():
                raise ValueError('回退资源路径无效')
            target.write_bytes(safe_file(backup / name))
    temp = directory / '.canvas-rollback.tmp'
    if temp.is_symlink():
        raise ValueError('回退暂存路径无效')
    temp.write_bytes(original)
    temp.replace(directory / 'index.html')


def copy_version(source, destination, app=None):
    """Iterate business data only for canvases; ordinary demos keep their old copy semantics."""
    source, destination = Path(source), Path(destination)
    if destination.exists():
        raise ValueError('目标版本已存在')
    if not is_canvas(source):
        shutil.copytree(source, destination)
        from server.copy_edits import inherit_version_edits
        inherit_version_edits(source, destination)
        return
    from server.copy_edits import guard_legacy_runtime
    guard_legacy_runtime(source)
    manifest, _ = runtime_bundle(app)
    validate_document_schema(source, manifest)
    with tempfile.TemporaryDirectory(prefix='.canvas-iterate-', dir=destination.parent) as temp:
        staged = Path(temp) / 'version'
        staged.mkdir()
        for relative, file in public_files(source):
            if relative.parts[0] == '__prota_runtime' or len(relative.parts) == 1 and relative.name in {*EDITOR_FILES, 'index.html', 'README.md'}:
                continue
            target = staged / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(safe_file(file))
        (staged / 'index.html').write_bytes(document_entry(app, source))
        staged.rename(destination)
