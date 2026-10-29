"""Immutable board packages, explicit branches and journaled working-copy restore."""
import copy
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import mimetypes
from pathlib import Path
import posixpath
import re
import subprocess
import tempfile
import time
from urllib.parse import unquote, urlsplit, quote
import uuid

from server.canvas_domain import identity, validate_document, feature_enabled
from server.canvas_transactions import LOCK, Conflict, atomic_bytes, commit, digest, fingerprint, page_lock, recover_transactions, relative, safe_path

PREFIX = 'window.PROTA_CANVAS = '
MAX_BYTES = 128 * 1024 * 1024
MAX_FILES = 5000
STABLE_WINDOW = .05
BLOCKED = {'.py', '.pyc', '.sh', '.bat', '.cmd', '.exe', '.dll', '.so', '.dylib', '.pem', '.key'}
TEXT = {'.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.svg'}
_checked_javascript = set()


class DraftNotRunnable(ValueError):
    pass


def context(root, params, version=True):
    root = Path(root).resolve()
    project, page = params.get('projectId'), params.get('pageId')
    if not identity(project) or not identity(page):
        raise ValueError('项目或页面身份无效')
    directory = safe_path(root, f'src/pages/{project}/{page}')
    if not directory.is_dir():
        raise ValueError('页面不存在')
    if not version:
        return directory
    name = params.get('version')
    if not isinstance(name, str) or not re.fullmatch(r'v\d+', name):
        raise ValueError('画布版本无效')
    working = safe_path(directory, name)
    if not working.is_dir():
        raise ValueError('画布版本不存在')
    if not identity(params.get('nodeId')) or not identity(params.get('boardId')):
        raise ValueError('画板实例或逻辑身份无效')
    return directory, working


def document(working):
    file = safe_path(working, 'canvas-data.js')
    raw = file.read_bytes()
    text = raw.decode('utf-8').strip()
    if not text.startswith(PREFIX):
        raise ValueError('画布文件格式无效')
    state = validate_document(json.loads(text[len(PREFIX):].removesuffix(';')))
    return raw, state


def mutation_context(root, params, working):
    if not feature_enabled(root, 'boardRevisions'):
        return 403, {'error': '当前工作区已关闭画板版本功能'}
    raw, state = document(working)
    if state['schemaVersion'] != 2:
        return 409, {'error': '请先保存画布以启用画板版本'}
    if params.get('revision') != state.get('revision', 0) or params.get('baseline') != state:
        return 409, {'error': '画布已变化，请保留本机草稿并读取最新版本'}
    node = next((n for n in state['nodes'] if n['id'] == params['nodeId']), None)
    if not node or node['type'] != 'board' or node['boardId'] != params['boardId']:
        raise ValueError('画板身份与当前实例不匹配')
    if not re.fullmatch(r'boards/[a-zA-Z0-9_-]+/index\.html', node.get('src', '')):
        raise ValueError('画板尚无可运行的业务入口')
    return raw, state, node


def read_index(page):
    target = safe_path(page, 'board-history/index.json')
    if not target.exists():
        return {'schemaVersion': 1, 'generation': 0, 'boards': {}}
    index = json.loads(target.read_text())
    if not isinstance(index, dict) or index.get('schemaVersion') != 1 or not isinstance(index.get('boards'), dict):
        raise ValueError('画板历史索引无效')
    return index


class ResourceParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.references, self.scripts = [], []
        self.inline = None
        self.module = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('src', 'poster', 'data'):
            if key in attrs and attrs[key] and tag not in ('a',):
                self.references.append(attrs[key])
        if tag in ('link', 'image', 'use'):
            self.references.extend(attrs[key] for key in ('href', 'xlink:href') if attrs.get(key))
        if attrs.get('srcset') and not attrs['srcset'].startswith('data:'):
            self.references.extend(item.strip().split()[0] for item in attrs['srcset'].split(',') if item.strip())
        if tag == 'script' and not attrs.get('src') and attrs.get('type', '').lower() in ('', 'module', 'text/javascript', 'application/javascript'):
            self.inline = []
            self.module = attrs.get('type') == 'module'

    def handle_data(self, data):
        if self.inline is not None:
            self.inline.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self.inline is not None:
            self.scripts.append((''.join(self.inline), self.module)); self.inline = None


def check_javascript(source, module=True):
    key = digest(source.encode()) + str(module)
    if key in _checked_javascript:
        return
    try:
        result = subprocess.run(['node', '--check', '--input-type=' + ('module' if module else 'commonjs')], input=source, text=True, capture_output=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ValueError('无法完成 JavaScript 静态语法验证') from error
    if result.returncode:
        raise DraftNotRunnable('画板含未完成或无效的 JavaScript；原文件保留')
    if len(_checked_javascript) > 2048:
        _checked_javascript.clear()
    _checked_javascript.add(key)


def references(name, data, validate=True):
    suffix = Path(name).suffix.lower()
    if suffix not in TEXT:
        return []
    source = data.decode('utf-8-sig')
    refs = []
    if suffix in {'.html', '.htm', '.svg'}:
        parser = ResourceParser(); parser.feed(source)
        refs += parser.references
        if validate:
            if suffix != '.svg' and not source.strip():
                raise DraftNotRunnable('画板 HTML 为空')
            for inline, module in parser.scripts:
                check_javascript(inline, module)
            if parser.inline is not None:
                raise DraftNotRunnable('画板内联脚本尚未完成')
    refs += [a or b for a, b in re.findall(r'url\(\s*[\'"]?([^\s\'"\)]+)|@import\s+[\'"]([^\'"]+)', source)]
    if suffix in {'.js', '.mjs', '.cjs'}:
        for ref in re.findall(r'(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)[\'"]([^\'"]+)', source):
            refs.append('prota-module:' + ref if not ref.startswith(('.', '/')) and not urlsplit(ref).scheme else ref)
        refs += re.findall(r'(?:\b(?:fetch|importScripts)\s*\(\s*|\bnew\s+URL\s*\(\s*)[\'"]([^\'"]+)', source)
        if validate:
            check_javascript(source, suffix != '.cjs')
    return refs


def capture(working, node, draft=False):
    """Whole board + whole assets (including computed names) + static dependency closure."""
    entry = node['src']
    board = str(relative(entry).parent)
    files, external, total = {}, set(), 0

    def add(name):
        nonlocal total
        if name in files:
            return
        file = safe_path(working, name)
        if not file.exists():
            if draft:
                return
            raise DraftNotRunnable('依赖不存在：' + name)
        if not file.is_file() or file.suffix.lower() in BLOCKED:
            raise ValueError('依赖不存在或不是允许的静态资源：' + name)
        if file.stat().st_size > MAX_BYTES:
            raise ValueError('画板资源过大')
        data = file.read_bytes(); total += len(data)
        if total > MAX_BYTES or len(files) >= MAX_FILES:
            raise ValueError('画板快照超过容量上限')
        files[name] = data

    def tree(name):
        directory = safe_path(working, name)
        if not directory.exists() and draft:
            return
        if not directory.is_dir():
            raise ValueError('画板业务目录不存在')
        for item in sorted(directory.rglob('*')):
            if item.name == '.DS_Store':
                continue
            relative_name = item.relative_to(working).as_posix()
            safe_path(working, relative_name)
            if item.is_file():
                add(relative_name)

    tree(board)
    assets = safe_path(working, 'assets')
    if assets.exists():
        tree('assets')
    add(entry)
    import_map = {}
    for name, data in list(files.items()):
        if Path(name).suffix.lower() in {'.html', '.htm'}:
            source = data.decode('utf-8-sig')
            for match in re.finditer(r'<script\b[^>]*\btype\s*=\s*[\'"]importmap[\'"][^>]*>([\s\S]*?)</script\s*>', source, re.I):
                mapping = json.loads(match.group(1))
                for alias, address in mapping.get('imports', {}).items():
                    if not isinstance(address, str):
                        raise ValueError('无效的 import map')
                    import_map[alias] = (name, address)
    queue, scanned = [entry], set()
    while queue:
        name = queue.pop()
        if name not in files:
            continue
        if name in scanned:
            continue
        scanned.add(name)
        for ref in references(name, files[name], validate=not draft):
            base_name = name
            if ref.startswith('prota-module:'):
                specifier = ref[len('prota-module:'):]
                alias = specifier if specifier in import_map else next((key for key in sorted(import_map, key=len, reverse=True) if key.endswith('/') and specifier.startswith(key)), None)
                if alias is None:
                    if draft:
                        continue
                    raise DraftNotRunnable('缺少可运行的模块映射：' + specifier)
                base_name, address = import_map[alias]
                ref = address + (specifier[len(alias):] if alias.endswith('/') else '')
            url = urlsplit(ref)
            if url.scheme or url.netloc:
                if url.scheme not in ('http', 'https', 'data', 'blob'):
                    raise ValueError('快照不允许本机绝对地址或可执行协议')
                if url.scheme in ('http', 'https'):
                    external.add(ref)
                continue
            value = unquote(url.path)
            if not value:
                continue
            if value.startswith('/') or '\\' in value:
                raise ValueError('快照依赖只能位于当前画布版本内')
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(base_name), value))
            relative(resolved)
            if '/' not in resolved:
                raise ValueError('业务画板不能依赖编辑器根资源')
            if resolved not in files:
                add(resolved)
            if resolved not in scanned:
                queue.append(resolved)
    if not draft and (entry not in files or not files[entry].strip() or not re.search(rb'<[a-zA-Z]', files[entry])):
        raise DraftNotRunnable('画板入口为空或未完成')
    return files, sorted(external)


def stable_capture(working, node, draft=False):
    read = (lambda: capture(working, node, draft=True)) if draft else (lambda: capture(working, node))
    first = read()
    time.sleep(STABLE_WINDOW)
    second = read()
    if first != second:
        raise Conflict('Agent 文件仍在变化，请等待稳定后再保存画板版本')
    return second


def package(temporary, params, node, files, external, parent, kind='snapshot', **extra):
    revision_id = 'br_' + uuid.uuid4().hex
    directory = temporary / revision_id
    directory.mkdir()
    for name, data in files.items():
        target = safe_path(directory / 'files', name)
        target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
    manifest = dict(schemaVersion=1, revisionId=revision_id, boardId=node['boardId'], parentRevisionId=parent,
                    createdAt=datetime.now(timezone.utc).isoformat(), kind=kind, label=str(params.get('label', ''))[:200],
                    description=str(params.get('description', ''))[:2000], sourceVersion=params['version'], nodeId=node['id'],
                    entry=node['src'], files={name: {'sha256': digest(data), 'size': len(data)} for name, data in sorted(files.items())},
                    externalResources=external, **extra)
    (directory / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False))
    return directory, manifest


def summary(manifest):
    result = {key: copy.deepcopy(value) for key, value in manifest.items() if key not in ('files', 'externalResources')}
    result['manifestSha256'] = digest(json.dumps(manifest, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode())
    return result


def verified_package(page, board_id, revision_id, only=None):
    if not identity(board_id) or not identity(revision_id):
        raise ValueError('画板历史身份无效')
    index = read_index(page)
    item = next((r for r in index['boards'].get(board_id, {}).get('revisions', []) if r['revisionId'] == revision_id), None)
    if not item:
        raise ValueError('正式画板版本不存在')
    directory = safe_path(page, f'board-history/{board_id}/{revision_id}')
    manifest_path = safe_path(directory, 'manifest.json')
    manifest = json.loads(manifest_path.read_text())
    if summary(manifest) != item or manifest.get('boardId') != board_id or manifest.get('revisionId') != revision_id:
        raise ValueError('画板历史清单校验失败')
    files = {}
    for name, expected in manifest['files'].items():
        target = safe_path(directory / 'files', name)
        if only is not None and name != only:
            continue
        data = target.read_bytes()
        if len(data) != expected['size'] or digest(data) != expected['sha256']:
            raise ValueError('画板历史资源被修改或损坏')
        files[name] = data
    actual = {p.relative_to(directory / 'files').as_posix() for p in (directory / 'files').rglob('*') if p.is_file()}
    if actual != set(manifest['files']) or any(p.is_symlink() for p in directory.rglob('*')):
        raise ValueError('画板历史包含未登记资源或符号链接')
    if manifest['entry'] not in manifest['files']:
        raise ValueError('历史入口缺失')
    return manifest, files


def version_catalog(record):
    """Business versions are stable slots; immutable recovery packages stay internal."""
    if 'versions' in record:
        versions = record['versions']
        if (not isinstance(versions, dict) or not versions
                or any(not re.fullmatch(r'v[1-9]\d*', name) or not isinstance(item, dict)
                       or 'revisionId' not in item or (item['revisionId'] is not None and not identity(item['revisionId']))
                       for name, item in versions.items())):
            raise ValueError('画板版本目录无效')
        return copy.deepcopy(versions)
    snapshots = [r for r in record.get('revisions', []) if r.get('kind') == 'snapshot']
    return {f'v{i + 1}': {'revisionId': r['revisionId']} for i, r in enumerate(snapshots)} or {'v1': {'revisionId': None}}


def active_version(record, node, versions):
    active = node.get('boardVersionId')
    if active in versions:
        return active
    pointer = node.get('boardRevisionId')
    history = {r['revisionId']: r for r in record.get('revisions', [])}
    seen = set()
    while pointer and pointer not in seen:
        seen.add(pointer)
        for name, item in versions.items():
            if item['revisionId'] == pointer:
                return name
        pointer = history.get(pointer, {}).get('parentRevisionId')
    return next(iter(versions))


def list_revisions(root, params):
    page = context(root, params, version=False)
    board_id = params.get('boardId')
    if not identity(board_id):
        raise ValueError('画板身份无效')
    with LOCK, page_lock(page):
        recover_transactions(page)
        record = read_index(page)['boards'].get(board_id, {})
        return {'boardId': board_id, 'revisions': copy.deepcopy(record.get('revisions', [])), 'versions': version_catalog(record)}


def preview_revision(root, params):
    page = context(root, params, version=False)
    with LOCK, page_lock(page):
        recover_transactions(page)
        manifest, _ = verified_package(page, params.get('boardId'), params.get('revisionId'))
    prefix = '/__prota_board_history/' + '/'.join(quote(params[key], safe='') for key in ('projectId', 'pageId', 'boardId', 'revisionId')) + '/'
    return {'manifest': manifest, 'url': prefix + quote(manifest['entry'], safe='/')}


def preview_resource(root, params, name):
    page = context(root, params, version=False)
    with LOCK, page_lock(page):
        recover_transactions(page)
        manifest, files = verified_package(page, params.get('boardId'), params.get('revisionId'), only=name)
        relative(name)
        if name not in files:
            raise ValueError('快照资源未登记')
        return files[name], mimetypes.guess_type(name)[0] or 'application/octet-stream'


def _execute(root, params, restore=False):
    page, working = context(root, params)
    with LOCK, page_lock(page):
        recover_transactions(page)
        loaded = mutation_context(root, params, working)
        if len(loaded) == 2:
            return loaded
        raw, state, node = loaded
        index = read_index(page)
        index_before = fingerprint(safe_path(page, 'board-history/index.json'))
        action = params.get('versionAction')
        versions = None
        if action is not None:
            if action not in {'fork', 'switch', 'delete'}:
                raise ValueError('画板版本操作无效')
            record = index['boards'].setdefault(node['boardId'], {'revisions': []})
            versions = version_catalog(record)
            current_version = active_version(record, node, versions)
            requested = params.get('targetVersion', current_version)
            if requested not in versions:
                raise ValueError('画板版本不存在')
            if action == 'delete' and len(versions) <= 1:
                raise ValueError('至少保留一个画板版本')
            target_version = requested
            if action == 'delete':
                target_version = max((name for name in versions if name != requested), key=lambda name: int(name[1:])) if requested == current_version else current_version
            if action == 'fork':
                next_number = max(record.get('nextVersion', 1), max(int(name[1:]) for name in versions) + 1)
                target_version = f'v{next_number}'
                record['nextVersion'] = next_number + 1
            elif action == 'switch' and target_version == current_version:
                return 200, dict(revision=state['revision'], revisionId=node['boardRevisionId'], boardVersionId=current_version)
            source_version = requested if action == 'fork' else target_version
            restore = source_version != current_version
            params = dict(params, revisionId=versions[source_version]['revisionId'])
        parent = params.get('parentRevisionId', node['boardRevisionId'])
        if parent is not None:
            verified_package(page, node['boardId'], parent)
        selected, historical_files = None, None
        if restore:
            selected, historical_files = verified_package(page, node['boardId'], params.get('revisionId'))
            old_board = str(relative(selected['entry']).parent)
            for name, data in historical_files.items():
                if name == old_board or name.startswith(old_board + '/'):
                    continue
                target = safe_path(working, name)
                if target.exists() and (not target.is_file() or target.read_bytes() != data):
                    return 409, {'error': '恢复的共享资源与当前内容冲突，未覆盖其他画板：' + name}
        recovery_diagnostic = None
        try:
            files, external = stable_capture(working, node)
        except DraftNotRunnable as error:
            if not restore:
                raise
            files, external = stable_capture(working, node, draft=True)
            recovery_diagnostic = str(error)
        before_source = files
        with tempfile.TemporaryDirectory(prefix='prota-board-stage-', dir=page / '.board-transactions') as staging:
            temporary = Path(staging)
            replacements, manifests, recovery_package = [], [], None
            directory, manifest = package(temporary, params, node, files, external, parent, 'recovery' if restore else 'snapshot')
            if recovery_diagnostic is None:
                manifests.append(manifest)
                replacements.append((f'board-history/{node["boardId"]}/{manifest["revisionId"]}', directory))
            else:
                manifest.update(kind='recovery-draft', runnable=False, diagnostic=recovery_diagnostic)
                (directory / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False))
                recovery_package = directory
            recovery_id = manifest['revisionId'] if restore and recovery_diagnostic is None else None
            if versions is not None and recovery_diagnostic is None:
                versions[current_version]['revisionId'] = manifest['revisionId']
            if versions is not None and action == 'fork' and not restore:
                directory, manifest = package(temporary, params, node, files, external, manifest['revisionId'], 'snapshot')
                manifests.append(manifest)
                replacements.append((f'board-history/{node["boardId"]}/{manifest["revisionId"]}', directory))
            if restore:
                # Rewrite only the package namespace of the board itself when an instance ID differs.
                # Cross-directory references cannot be renamed safely without changing business code.
                if selected['entry'] != node['src']:
                    return 409, {'error': '此历史使用不同的业务目录，请在原实例恢复；跨实例完整复制属于 S7'}
                directory, manifest = package(temporary, params, node, historical_files, selected.get('externalResources', []), selected['revisionId'], 'restore', recoveryRevisionId=recovery_id)
                manifests.append(manifest)
                replacements.append((f'board-history/{node["boardId"]}/{manifest["revisionId"]}', directory))
                board_name = str(relative(node['src']).parent)
                replacements.append((params['version'] + '/' + board_name, directory / 'files' / board_name))
                for name in historical_files:
                    if not name.startswith(board_name + '/') and not safe_path(working, name).exists():
                        replacements.append((params['version'] + '/' + name, directory / 'files' / name))
            for item in manifests:
                index['boards'].setdefault(node['boardId'], {'revisions': []})['revisions'].append(summary(item))
            if versions is not None:
                if action == 'delete':
                    del versions[requested]
                versions[target_version] = {'revisionId': manifest['revisionId']}
                record['versions'] = versions
                node['boardVersionId'] = target_version
            index['generation'] += 1
            staged_index = temporary / 'index.json'
            staged_index.write_text(json.dumps(index, ensure_ascii=False))
            replacements.append(('board-history/index.json', staged_index))
            node['boardRevisionId'] = manifest['revisionId']
            state['revision'] = state.get('revision', 0) + 1
            staged_layout = temporary / 'canvas-data.js'
            serialized = json.dumps(state, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
            staged_layout.write_text(PREFIX + serialized + ';\n')
            replacements.append((params['version'] + '/canvas-data.js', staged_layout))

            def verify():
                if safe_path(working, 'canvas-data.js').read_bytes() != raw or fingerprint(safe_path(page, 'board-history/index.json')) != index_before:
                    raise Conflict('创建画板版本期间画布或索引出现外部更新')
                captured = capture(working, node, draft=True) if recovery_diagnostic else capture(working, node)
                if captured[0] != before_source:
                    raise Conflict('创建画板版本期间业务文件出现外部更新')

            transaction_id = commit(page, replacements, verify, recovery=recovery_package)
            result = dict(summary(manifest), revision=state['revision'], recoveryRevisionId=recovery_id, transactionId=transaction_id)
            if versions is not None:
                result['boardVersionId'] = target_version
            if recovery_package:
                result['recoveryDraft'] = {'transactionId': transaction_id, 'path': f'.board-trash/{transaction_id}/recovery-draft', 'runnable': False, 'diagnostic': recovery_diagnostic}
            return 200, result


def create_revision(root, params):
    try:
        return _execute(root, params)
    except Conflict as error:
        return 409, {'error': str(error)}


def restore_revision(root, params):
    try:
        return _execute(root, params, restore=True)
    except Conflict as error:
        return 409, {'error': str(error)}
