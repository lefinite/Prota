"""Page-owned infinite canvas persistence. No writes outside an existing version."""
import json
import re
import shutil
import time
import base64
import hashlib
from pathlib import Path
from server import workspace

from server.canvas_transactions import LOCK, page_lock, recover_transactions
PREFIX = 'window.PROTA_CANVAS = '


# Public compatibility alias; v1 and v2 share the pure validator.
from server.canvas_domain import validate_document as validate_state


def migration_backup(directory, original):
    """Durable, byte-exact v1 source kept outside rotating layout history."""
    import os
    import uuid
    backup = directory / '.canvas-migrations'
    if backup.is_symlink():
        raise ValueError('迁移备份目录不能是符号链接')
    backup.mkdir(exist_ok=True)
    target = backup / ('v1-' + hashlib.sha256(original).hexdigest() + '.js')
    if target.is_symlink():
        raise ValueError('迁移备份不能是符号链接')
    if target.exists():
        if target.read_bytes() != original:
            raise ValueError('迁移备份校验失败')
        return
    temporary = backup / (uuid.uuid4().hex + '.tmp')
    try:
        temporary.write_bytes(original)
        with temporary.open('rb') as stream:
            os.fsync(stream.fileno())
        temporary.replace(target)
        descriptor = os.open(backup, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    finally:
        temporary.unlink(missing_ok=True)


def save_canvas(root, params):
    import copy
    import tempfile
    from server.canvas_domain import feature_enabled, migrate_document
    from server.canvas_transactions import Conflict, commit, fingerprint, safe_path
    parts = [params.get(key, '') for key in ('projectId', 'pageId', 'version')]
    if not all(isinstance(part, str) and re.fullmatch(r'[a-zA-Z0-9_-]+', part) for part in parts) or not re.fullmatch(r'v\d+', parts[2]):
        raise ValueError('页面路径无效')
    root = Path(root).resolve()
    directory = safe_path(root, '/'.join(['src', 'pages', *parts]))
    if not directory.is_dir():
        raise ValueError('页面版本不存在')
    file = safe_path(directory, 'canvas-data.js')
    if not file.is_file():
        raise ValueError('该页面不是无限画布')
    state = copy.deepcopy(validate_state(params.get('state')))
    with LOCK, page_lock(directory.parent):
        try:
            recover_transactions(directory.parent)
        except Conflict as error:
            return 409, {'error': str(error)}
        original_bytes = file.read_bytes()
        raw = original_bytes.decode('utf-8').strip()
        if not raw.startswith(PREFIX):
            raise ValueError('无法识别画布文件')
        current = json.loads(raw[len(PREFIX):].removesuffix(';'))
        if current.get('revision', 0) != params.get('revision') or params.get('baseline') != current:
            return 409, {'error': '画布已被其他窗口或 AI 修改，请保留本机草稿并读取最新版本。'}
        validate_state(current)
        if current['schemaVersion'] == 2 and state['schemaVersion'] != 2:
            return 409, {'error': '当前画布已升级为 Schema v2，不能降级覆盖。'}
        boards = {n['id']: n for n in current['nodes'] if n['type'] == 'board'}
        if current['schemaVersion'] == 2:
            for node in state['nodes']:
                if node['type'] == 'board' and node['id'] in boards and node['boardId'] != boards[node['id']]['boardId']:
                    raise ValueError('既有画板的逻辑身份不能在保存时改变')
        migrating = current['schemaVersion'] == 1 and state['schemaVersion'] == 2
        if migrating:
            if not feature_enabled(root, 'canvasSchemaV2'):
                return 409, {'error': '当前工作区尚未启用 Schema v2 迁移'}
            expected = {n['id']: n for n in migrate_document(current, parts[0], parts[1])['nodes'] if n['type'] == 'board'}
            for node in state['nodes']:
                if node['type'] == 'board' and node['id'] in expected and node['boardId'] != expected[node['id']]['boardId']:
                    raise ValueError('迁移不能改变既有画板身份')
        if state['schemaVersion'] == 2:
            for node in state['nodes']:
                if node['type'] == 'board' and node.get('boardRevisionId') and node['boardRevisionId'] != boards.get(node['id'], {}).get('boardRevisionId'):
                    from server.board_revisions import verified_package
                    verified_package(directory.parent, node['boardId'], node['boardRevisionId'])
        assets, replacements, sources = [], [], []
        with tempfile.TemporaryDirectory(prefix='prota-canvas-save-', dir=directory.parent / '.board-transactions') as staging:
            prepared = Path(staging)
            for ordinal, node in enumerate(state['nodes']):
                if node['type'] == 'image' and node.get('src', '').startswith('data:'):
                    match = re.fullmatch(r'data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\r\n]+)', node['src'])
                    if not match:
                        raise ValueError('图片内容无效')
                    try:
                        content = base64.b64decode(match.group(2), validate=True)
                    except ValueError:
                        raise ValueError('图片编码无效')
                    if len(content) > 4 * 1024 * 1024:
                        raise ValueError('图片超过 4 MB')
                    filename = hashlib.sha256(content).hexdigest() + '.' + match.group(1)
                    name = 'assets/' + filename
                    target = safe_path(directory, name)
                    if target.exists() and target.read_bytes() != content:
                        raise ValueError('素材哈希与已有文件不符')
                    if not target.exists() and not any(item[0] == parts[2] + '/' + name for item in replacements):
                        staged = prepared / ('image-' + str(ordinal)); staged.write_bytes(content)
                        replacements.append((parts[2] + '/' + name, staged))
                    node['src'] = name
                    assets.append({'id': node['id'], 'src': name})
                if node.get('cloneFrom'):
                    source = safe_path(directory, node['cloneFrom']).parent
                    destination = safe_path(directory, node['src']).parent
                    if not destination.exists():
                        if not (source / 'index.html').is_file():
                            raise ValueError('源画板文件不存在，无法复制')
                        source_hash = fingerprint(source)
                        staged = prepared / ('board-' + str(ordinal)); shutil.copytree(source, staged)
                        if fingerprint(staged) != source_hash:
                            return 409, {'error': '复制画板期间源文件发生变化，尚未提交副本'}
                        sources.append((source, source_hash))
                        name = parts[2] + '/' + destination.relative_to(directory).as_posix()
                        if any(item[0] == name for item in replacements):
                            raise ValueError('重复的复制目标')
                        replacements.append((name, staged))
            history = directory / '.canvas-history'
            if history.is_symlink():
                raise ValueError('恢复目录无效')
            history.mkdir(exist_ok=True)
            (history / f'{time.time_ns()}.js').write_text(raw + '\n', encoding='utf-8')
            for obsolete in sorted(history.glob('*.js'))[:-10]:
                obsolete.unlink()
            state['revision'] = current.get('revision', 0) + 1
            serialized = json.dumps(state, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
            temporary = file.with_suffix('.js.tmp')
            if temporary.is_symlink():
                raise ValueError('无效的临时文件')

            def verify():
                if file.read_bytes() != original_bytes or any(fingerprint(source) != value for source, value in sources):
                    raise Conflict('保存期间出现外部更新，本机修改已保留，请选择恢复或读取最新版本。')

            try:
                temporary.write_text(PREFIX + serialized + ';\n', encoding='utf-8')
                verify()
                if migrating:
                    migration_backup(directory, original_bytes)
                verify()
                if replacements or feature_enabled(root, 'boardRevisions'):
                    replacements.append((parts[2] + '/canvas-data.js', temporary))
                    commit(directory.parent, replacements, verify)
                else:
                    temporary.replace(file)
            except Conflict as error:
                return 409, {'error': str(error)}
            finally:
                temporary.unlink(missing_ok=True)
    return 200, {'revision': state['revision'], **({'assets': assets} if assets else {})}


def upgrade_runtime(root, params, template):
    """Upgrade editor chrome only; retain document and user assets, back up old runtime."""
    parts = [params.get(key, '') for key in ('projectId', 'pageId', 'version')]
    if not all(isinstance(p, str) and re.fullmatch(r'[a-zA-Z0-9_-]+', p) for p in parts) or not re.fullmatch(r'v\d+', parts[2]):
        raise ValueError('页面路径无效')
    root = Path(root).resolve()
    directory = root.joinpath('src/pages', *parts).resolve()
    if root not in directory.parents or not (directory/'canvas-data.js').is_file():
        raise ValueError('无限画布不存在')
    with LOCK:
        backup = directory/'.canvas-runtime-backup'
        if backup.is_symlink():
            raise ValueError('备份目录无效')
        backup.mkdir(exist_ok=True)
        filenames = ['icons.js', 'LICENSE.lucide', 'canvas-domain.js', 'canvas-core.js', 'styles.css', 'app.js', 'README.md', 'index.html']
        template = Path(template)
        # Validate the whole editor bundle before changing any installed resource.
        for filename in filenames:
            if not (template/filename).is_file():
                raise ValueError(f'编辑器安装包不完整，缺少 {filename}')
        for filename in filenames:
            target = directory/filename
            if target.is_symlink():
                raise ValueError('编辑器文件不能是符号链接')
            if target.exists() and not (backup/filename).exists():
                shutil.copy2(target, backup/filename)
        staged = []
        for filename in filenames:
            target = directory/filename
            temporary = directory/(filename+'.upgrade.tmp')
            if temporary.is_symlink():
                raise ValueError('临时文件无效')
            shutil.copyfile(template/filename, temporary)
            staged.append((temporary,target))
        # Dependencies first, HTML entry last. No partial bundle is installed if staging fails.
        for temporary,target in staged:
            temporary.replace(target)
    return {'runtimeVersion': 4}
