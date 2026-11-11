"""Protected copy edits: conservative source mapping, recoverable atomic writes.

Dynamic JS/JSX and mixed markup deliberately remain unsupported until a proven
semantic locator exists. A DOM patch is never a persistence fallback.
"""
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import uuid
from server.canvas_transactions import digest, safe_path, sync_directory
from server.user_edit_store import Store

MAX_SOURCE = 2 * 1024 * 1024


class MappingError(ValueError):
    def __init__(self, detail, status='conflict'):
        super().__init__(detail)
        self.status = status


class SourceHTML(HTMLParser):
    VOID = set('area base br col embed hr img input link meta param source track wbr'.split())

    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source, self.stack, self.nodes = source, [], []
        self.lines = [0]
        self.lines.extend(m.end() for m in re.finditer('\n', source))
        self.feed(source)

    def source_offset(self):
        line, column = self.getpos()
        return self.lines[line - 1] + column

    def handle_starttag(self, tag, attrs):
        start = self.source_offset()
        node = {'tag': tag, 'attrs': dict(attrs), 'start': start,
                'textStart': start + len(self.get_starttag_text()), 'children': False,
                'blocked': any(n['blocked'] for n in self.stack) or 'hidden' in dict(attrs) or bool(re.search(r'(display\s*:\s*none|visibility\s*:\s*hidden)', dict(attrs).get('style') or '', re.I)) or tag in ('script', 'style', 'template', 'noscript', 'svg', 'textarea')}
        if self.stack:
            self.stack[-1]['children'] = True
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        if self.stack:
            self.stack[-1]['children'] = True

    def handle_comment(self, data):
        if self.stack:
            self.stack[-1]['children'] = True

    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1]['tag'] != tag:
            # Browser repair is not a safe source locator.
            self.stack.clear()
            return
        node = self.stack.pop()
        node['textEnd'] = self.source_offset()
        end = self.source.find('>', self.source_offset())
        node['end'] = end + 1
        self.nodes.append(node)


def validate(root, request):
    if not isinstance(request, dict):
        raise ValueError('请求必须为对象')
    for key in ('projectId', 'pageId', 'version', 'clientEditId'):
        value = request.get(key)
        pattern = r'v\d+' if key == 'version' else r'[A-Za-z0-9_-]{1,128}'
        if not isinstance(value, str) or not re.fullmatch(pattern, value):
            raise ValueError('无效的 ' + key)
    directory = safe_path(root, f"src/pages/{request['projectId']}/{request['pageId']}/{request['version']}")
    if not directory.is_dir():
        raise ValueError('页面版本不存在')
    element = request.get('element')
    if not isinstance(element, dict):
        raise ValueError('缺少元素上下文')
    for key in ('selector', 'originalText', 'nextText'):
        value = element.get(key)
        if not isinstance(value, str) or not value or len(value) > 10000 or '\x00' in value:
            raise ValueError('无效的 ' + key)
    if len(json.dumps(request)) > 64000:
        raise ValueError('编辑请求过大')
    expected = request.get('expectedSourceSha256')
    if expected is not None and not re.fullmatch('[0-9a-f]{64}', str(expected)):
        raise ValueError('无效的源码基线')
    return directory


def business_directory(directory, request):
    target = request.get('target', {'type': 'page'})
    if target != {'type': 'page'}:
        raise MappingError('内部画板直改尚未开放，请通过代码修改；编辑内容已保留', 'unsupported')
    index = directory / 'index.html'
    # Runtime roots must never be mistaken for business source.
    if (directory / 'canvas-data.js').exists() or (index.exists() and any(marker in index.read_text(encoding='utf-8') for marker in ('canvas-runtime/boot.js', 'infinite-canvas'))):
        raise MappingError('无限画布内核不是业务文案目标', 'unsupported')
    return directory


def locate(root, directory, element, expected_text=None):
    original = element['originalText'] if expected_text is None else expected_text
    selector = element['selector']
    stable_id = re.fullmatch(r'#([A-Za-z_][\w-]*)', selector)
    snippet = element.get('outerHtmlSnippet') or element.get('htmlSnippet') or ''
    # Reconstruct the same source fragment for reconciliation after a text edit.
    if snippet and expected_text is not None:
        parsed = SourceHTML(snippet)
        leaves = [n for n in parsed.nodes if not n['children'] and html.unescape(snippet[n['textStart']:n['textEnd']]) == element['originalText']]
        if len(leaves) == 1:
            n = leaves[0]
            snippet = snippet[:n['textStart']] + html.escape(expected_text, quote=False) + snippet[n['textEnd']:]
    candidates = []
    identified = []
    for path in sorted(directory.glob('*.html')):
        path = safe_path(root, path.relative_to(root).as_posix())
        if path.stat().st_size > MAX_SOURCE:
            raise MappingError('源码超过安全解析上限', 'unsupported')
        raw = path.read_bytes()
        source = raw.decode('utf-8')
        parser = SourceHTML(source)
        for node in parser.nodes:
            identity = node['attrs'].get('id') == stable_id[1] if stable_id else bool(snippet and source[node['start']:node['end']] == snippet)
            if not identity:
                continue
            identified.append(node)
            if element.get('tagName') and node['tag'] != element['tagName'].lower():
                continue
            if node['children'] or node['blocked']:
                continue
            if html.unescape(source[node['textStart']:node['textEnd']]) == original:
                candidates.append((path, raw, source, node))
    if len(identified) > 1 or len(candidates) > 1:
        raise MappingError('源码目标不唯一，未修改任何文件')
    if not candidates:
        raise MappingError('无法安全映射到唯一静态文本节点，请通过代码修改；编辑内容已保留', 'unsupported' if not identified or identified[0]['children'] else 'conflict')
    return candidates[0]


class EditService:
    def __init__(self, root):
        self.root = Path(root)
        self.store = Store(root)

    def close(self):
        self.store.close()

    def public(self, record):
        current_hash = None
        if record['effect']:
            try:
                current_hash = digest(safe_path(self.root, record['effect']['path']).read_bytes())
            except (OSError, ValueError):
                pass
        return {'currentSourceSha256': current_hash,'editId': record['id'], 'status': record['status'], 'detail': record['detail'],
                'effect': record['effect'], 'request': record['request'], 'updatedAt': record['updated_at']}

    def baseline(self, request):
        directory = business_directory(validate(self.root, request), request)
        path, raw, _, _ = locate(self.root, directory, request['element'])
        return {'path': path.relative_to(self.root).as_posix(), 'sourceSha256': digest(raw)}

    def create(self, request):
        directory = validate(self.root, request)
        with self.store.lock():
            self.recover()
            self.scan()
            record, same = self.store.receive(request)
            if not same:
                return {'editId': record['id'], 'status': 'conflict', 'detail': '同一个操作 ID 不能提交不同内容'}
            if record['status'] not in ('received', 'queued'):
                return self.public(record)
            if os.environ.get('PROTA_PROTECTED_USER_EDITS', '1') == '0':
                return self.public(self.store.state(record['id'], 'unsupported', '直接修改已关闭；编辑内容已保留'))
            if self.store.active_agent():
                return self.public(self.store.state(record['id'], 'queued', 'Agent 正在运行，编辑已保留并排队'))
            return self.public(self.apply(record, directory))

    def apply(self, record, directory=None):
        edit_id, request = record['id'], record['request']
        try:
            directory = business_directory(directory or validate(self.root, request), request)
            self.store.state(edit_id, 'resolving')
            path, raw, source, node = locate(self.root, directory, request['element'])
            if request.get('expectedSourceSha256') and digest(raw) != request['expectedSourceSha256']:
                raise MappingError('源码已变化，请重新选择目标后提交；本次编辑已保留')
            new_source = source[:node['textStart']] + html.escape(request['element']['nextText'], quote=False) + source[node['textEnd']:]
            updated = new_source.encode('utf-8')
            # Parse again and prove that the same target maps to the intended text.
            parsed = SourceHTML(new_source)
            matches = [n for n in parsed.nodes if n['start'] == node['start'] and n['tag'] == node['tag'] and not n['children'] and html.unescape(new_source[n['textStart']:n['textEnd']]) == request['element']['nextText']]
            if len(matches) != 1:
                raise MappingError('修改后结构校验失败', 'unsupported')
            effect = {'path': path.relative_to(self.root).as_posix(), 'beforeSha256': self.store.snapshot(raw),
                      'afterSha256': self.store.snapshot(updated), 'changedNodeCount': 1}
            self.store.state(edit_id, 'prepared', effect=effect)
            self.install(edit_id, effect)
            # New explicit edits supersede only the identical target, after commit.
            for old in self.records(('committed', 'verified', 'conflict')):
                a, b = old['request'], request
                if old['id'] != edit_id and all(a.get(k) == b.get(k) for k in ('projectId', 'pageId', 'version', 'target')) and a['element']['selector'] == b['element']['selector'] and a['element']['nextText'] == b['element']['originalText']:
                    self.store.state(old['id'], 'superseded', '后续人工编辑已取代此目标')
            return self.store.get(edit_id)
        except MappingError as error:
            return self.store.state(edit_id, error.status, str(error))
        except (ValueError, OSError, UnicodeError):
            # A prepared operation remains recoverable even if install completed.
            if self.store.get(edit_id)['status'] == 'prepared':
                self.recover()
                return self.store.get(edit_id)
            return self.store.state(edit_id, 'failed', '保存失败，编辑和恢复材料已保留')

    def install(self, edit_id, effect):
        path = safe_path(self.root, effect['path'])
        staged = path.with_name('.user-edit-' + edit_id + '.tmp')
        updated = self.store.read_snapshot(effect['afterSha256'])
        if staged.is_symlink():
            raise MappingError('暂存文件不能是符号链接')
        if staged.exists():
            if digest(staged.read_bytes()) != effect['afterSha256']:
                raise MappingError('中断暂存文件不完整；原文件及恢复快照保留')
        else:
            with staged.open('xb') as stream:
                os.chmod(staged, path.stat().st_mode & 0o777)
                stream.write(updated)
                stream.flush()
                os.fsync(stream.fileno())
        # Check only after staging/fsync, immediately before the atomic rename.
        path = safe_path(self.root, effect['path'])
        if digest(path.read_bytes()) != effect['beforeSha256']:
            raise MappingError('保存期间源码被外部修改，未覆盖外部内容')
        os.replace(staged, path)
        sync_directory(path.parent)
        if digest(path.read_bytes()) != effect['afterSha256']:
            raise MappingError('写入后发现外部修改，恢复材料已保留')
        self.store.state(edit_id, 'committed', effect=effect)

    def records(self, statuses):
        placeholders = ','.join('?' for _ in statuses)
        return [self.store.get(row[0]) for row in self.store.db.execute(f'SELECT id FROM edit_operations WHERE status IN ({placeholders}) ORDER BY created_at', statuses).fetchall()]

    def recover(self):
        for record in self.records(('prepared',)):
            effect = record['effect']
            try:
                current = digest(safe_path(self.root, effect['path']).read_bytes())
                if current == effect['afterSha256']:
                    self.store.state(record['id'], 'committed', effect=effect)
                elif current == effect['beforeSha256']:
                    self.install(record['id'], effect)
                else:
                    self.store.state(record['id'], 'conflict', '中断恢复时源码已变化，未覆盖；快照可恢复')
            except (OSError, ValueError):
                self.store.state(record['id'], 'conflict', '恢复目标不可用，快照已保留')
        # A crash before preparation has made no source change; safe to retry.
        for record in self.records(('resolving',)):
            self.store.state(record['id'], 'received', '上次定位中断，可以重试')

    def scan(self):
        for record in self.records(('committed', 'verified')):
            try:
                effect = record['effect']
                path = safe_path(self.root, effect['path'])
                if digest(path.read_bytes()) == effect['afterSha256']:
                    continue
                request = record['request']
                located, _, _, _ = locate(self.root, path.parent, request['element'], request['element']['nextText'])
                if located != path:
                    raise MappingError('文件目标变化')
            except (ValueError, OSError, UnicodeError):
                self.store.state(record['id'], 'conflict', '源码变更影响了人工文案，请在修改历史中处理；原文案和快照已保留')

    def drain(self):
        self.recover()
        self.scan()
        if os.environ.get('PROTA_PROTECTED_USER_EDITS', '1') != '0' and not self.store.active_agent():
            for record in self.records(('queued', 'received')):
                self.apply(record)

    def history(self, query):
        with self.store.lock():
            self.drain()
            offset = max(0, min(int(query.get('offset', 0)), 1000000))
            limit = max(1, min(int(query.get('limit', 50)), 100))
            rows = self.store.db.execute("SELECT id FROM edit_operations ORDER BY CASE WHEN status='conflict' THEN 0 ELSE 1 END, created_at DESC").fetchall()
            records = [self.store.get(row[0]) for row in rows]
            records = [r for r in records if all(not query.get(k) or r['request'].get(k) == query[k] for k in ('projectId', 'pageId', 'version'))]
            return {'items': [self.public(r) for r in records[offset:offset + limit]], 'total': len(records), 'conflictCount': sum(r['status'] == 'conflict' for r in records)}

    def verify(self, edit_id, payload):
        with self.store.lock():
            self.recover(); self.scan()
            record = self.store.get(edit_id)
            request = record['request']
            if any(payload.get(k) != request[k] for k in ('projectId', 'pageId', 'version')) or payload.get('selector') != request['element']['selector']:
                raise ValueError('预览验证上下文不匹配')
            if record['status'] not in ('committed', 'verified'):
                return self.public(record)
            matched = payload.get('matched') is True and payload.get('text') == request['element']['nextText']
            return self.public(self.store.state(edit_id, 'verified' if matched else 'committed', None if matched else '源码已保存，预览异常，请重试验证'))

    def undo(self, edit_id):
        existing = self.store.db.execute('SELECT id FROM edit_operations WHERE client_id=?', ('undo_' + edit_id,)).fetchone()
        if existing:
            return self.public(self.store.get(existing[0]))
        record = self.store.get(edit_id)
        effect = record['effect']
        if not effect or record['status'] not in ('committed', 'verified'):
            raise MappingError('当前记录不能撤销')
        request = dict(record['request'])
        request['clientEditId'] = 'undo_' + edit_id
        request['expectedSourceSha256'] = effect['afterSha256']
        request['supersedesId'] = edit_id
        request['element'] = {**request['element'], 'originalText': request['element']['nextText'], 'nextText': request['element']['originalText']}
        return self.create(request)

    def inventory(self):
        # Read known version trees, including old runtime backups, without following symlinks.
        items = []
        for path in (self.root / 'src/pages').rglob('app.js'):
            if any(p.is_symlink() for p in (path, *path.parents) if p == self.root or self.root in p.parents) or path.stat().st_size > MAX_SOURCE:
                continue
            relative = path.relative_to(self.root).as_posix()
            parts = path.relative_to(self.root).parts
            if len(parts) < 6 or not re.fullmatch(r'v\d+', parts[4]):
                continue
            raw = path.read_bytes()
            if b'READIFY_COPY_PATCHES_START' not in raw:
                continue
            source = raw.decode('utf-8')
            block = re.search(r'/\* READIFY_COPY_PATCHES_START \*/(.*?)/\* READIFY_COPY_PATCHES_END \*/', source, re.S)
            match = re.search(r'const patches = (\[.*?\]);', block[1], re.S) if block else None
            try:
                patches = json.loads(match[1]) if match else []
                patches = [p for p in patches if isinstance(p, dict) and isinstance(p.get('selector'), str) and isinstance(p.get('text'), str)]
            except ValueError:
                patches = []
            items.append({'path': relative, 'sha256': digest(raw), 'status': 'needs-review', 'patches': patches})
        return {'items': items, 'readOnly': True}

    def import_legacy(self):
        inventory = self.inventory()
        imported = []
        with self.store.lock():
            for item in inventory['items']:
                raw = (self.root / item['path']).read_bytes()
                if digest(raw) != item['sha256']:
                    raise MappingError('旧补丁在盘点后变化，请重新盘点')
                snapshot = self.store.snapshot(raw)  # Full original bytes before any import.
                parts = Path(item['path']).parts
                for index, patch in enumerate(item['patches']):
                    request = {'clientEditId': 'legacy_' + digest((item['path'] + snapshot + str(index)).encode()),
                               'kind': 'legacy-import', 'projectId': parts[2], 'pageId': parts[3], 'version': parts[4],
                               'target': {'type': 'page'}, 'element': {'selector': patch['selector'], 'originalText': '', 'nextText': patch['text']},
                               'legacySource': item['path'], 'legacySnapshotSha256': snapshot}
                    record, _ = self.store.receive(request)
                    if record['status'] == 'received':
                        record = self.store.state(record['id'], 'needs-review', '旧补丁已完整备份；尚未验证，不删除原补丁')
                    imported.append(self.public(record))
        return {'items': imported, 'sourceFilesChanged': 0}


def http_status(result):
    return {'queued': 202, 'conflict': 409, 'unsupported': 422, 'failed': 503}.get(result.get('status'), 200)


def handle(handler, root):
    from urllib.parse import urlsplit, parse_qs
    url = urlsplit(handler.path)
    prefix = '/api/copy-edits/v2'
    service = None
    try:
        service = EditService(root)
        if handler.command == 'GET':
            if url.path == prefix + '/history':
                result = service.history({k: v[0] for k, v in parse_qs(url.query).items()})
            elif url.path == prefix + '/recovery/inventory':
                result = service.inventory()
            elif url.path.endswith('/recovery'):
                edit_id = url.path[len(prefix) + 1:-len('/recovery')]
                record = service.store.get(edit_id)
                result = service.public(record)
                if record['request'].get('legacySnapshotSha256'):
                    result['legacySource'] = service.store.read_snapshot(record['request']['legacySnapshotSha256']).decode('utf-8')
                if record['effect']:
                    result['beforeSource'] = service.store.read_snapshot(record['effect']['beforeSha256']).decode('utf-8')
                    result['afterSource'] = service.store.read_snapshot(record['effect']['afterSha256']).decode('utf-8')
            else:
                with service.store.lock():
                    service.drain()
                    result = service.public(service.store.get(url.path[len(prefix) + 1:]))
        else:
            length = int(handler.headers.get('Content-Length', '0'))
            if not 0 < length <= 64000:
                raise ValueError('请求大小无效')
            payload = json.loads(handler.rfile.read(length))
            suffix = url.path[len(prefix):].strip('/')
            if not suffix:
                result = service.create(payload)
            elif suffix == 'baseline':
                result = service.baseline(payload)
            else:
                edit_id, action = suffix.split('/')
                if action == 'verify':
                    result = service.verify(edit_id, payload)
                elif action == 'undo':
                    result = service.undo(edit_id)
                elif action == 'resolve':
                    # Accepting replacement never writes files or deletes history.
                    with service.store.lock():
                        record = service.store.get(edit_id)
                        if record['status'] != 'conflict' or payload.get('strategy') != 'accept-current':
                            raise ValueError('请重新选择目标后提交，或明确接受当前源码')
                        path = safe_path(service.root, record['effect']['path']) if record['effect'] else None
                        if not path or digest(path.read_bytes()) != payload.get('expectedSourceSha256'):
                            raise MappingError('源码基线已变化')
                        result = service.public(service.store.state(edit_id, 'superseded', '用户明确接受当前源码'))
                else:
                    raise ValueError('未知操作')
        return handler.workspace_reply(http_status(result), result)
    except MappingError as error:
        return handler.workspace_reply(http_status({'status': error.status}), {'status': error.status, 'detail': str(error)})
    except (ValueError, TypeError, KeyError):
        return handler.workspace_reply(400, {'error': '请求或编辑上下文无效'})
    except Exception:
        return handler.workspace_reply(503, {'error': '人工修改服务暂不可用；请保留输入后重试'})
    finally:
        if service:
            service.close()


def inherit_version_edits(source, destination):
    source, destination = Path(source).absolute(), Path(destination).absolute()
    if source.parent != destination.parent or source.parts[-5:-3] != ('src', 'pages'):
        return
    root = source.parents[4]
    if not (root / 'data/user-edits.sqlite3').is_file():
        return
    service = EditService(root)
    try:
        with service.store.lock():
            service.recover(); service.scan()
            for record in service.records(('committed', 'verified')):
                request = record['request']
                if (request['projectId'], request['pageId'], request['version']) != tuple(source.parts[-3:]):
                    continue
                try:
                    relative = Path(record['effect']['path']).relative_to(source.relative_to(root))
                    path = safe_path(root, (destination / relative).relative_to(root).as_posix())
                    current = path.read_bytes()
                    located, _, _, _ = locate(root, path.parent, request['element'], request['element']['nextText'])
                    if located != path:
                        continue
                    cloned = json.loads(json.dumps(request))
                    cloned.update(clientEditId='copy_' + digest((record['id'] + str(destination)).encode()),
                                  version=destination.name, copiedFromEditId=record['id'])
                    cloned.pop('expectedSourceSha256', None)
                    inherited, _ = service.store.receive(cloned)
                    if inherited['status'] == 'received':
                        sha = service.store.snapshot(current)
                        effect = {'path': path.relative_to(root).as_posix(), 'beforeSha256': sha, 'afterSha256': sha, 'changedNodeCount': 0}
                        service.store.state(inherited['id'], 'committed', '从已保存版本复制；等待新版本预览验证', effect)
                except (ValueError, OSError):
                    # Existing source records stay intact; an invalid copy is never treated as saved.
                    raise MappingError('复制版本的人工文案保护校验失败，请检查修改历史')
    finally:
        service.close()


def guard_legacy_runtime(directory):
    """Never retire an old runtime while it still carries unreviewed user text."""
    path = Path(directory) / 'app.js'
    if path.is_symlink():
        raise ValueError('旧运行时文件不能是符号链接')
    if path.is_file() and b'READIFY_COPY_PATCHES_START' in path.read_bytes():
        raise ValueError('存在尚未迁移验证的旧文案补丁，请先备份并在修改历史中审查；已暂停运行时升级')
