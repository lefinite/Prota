"""Page-owned infinite canvas persistence. No writes outside an existing version."""
import json
import re
import threading
import shutil
import time
import base64
import hashlib
from pathlib import Path
from server import workspace

LOCK = threading.Lock()
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
    parts = [params.get(key, '') for key in ('projectId', 'pageId', 'version')]
    if not all(isinstance(part, str) and re.fullmatch(r'[a-zA-Z0-9_-]+', part) for part in parts) or not re.fullmatch(r'v\d+', parts[2]):
        raise ValueError('页面路径无效')
    root = Path(root).resolve()
    directory = root.joinpath('src', 'pages', *parts).resolve()
    if root not in directory.parents or not directory.is_dir():
        raise ValueError('页面版本不存在')
    file = directory / 'canvas-data.js'
    if file.is_symlink() or not file.is_file():
        raise ValueError('该页面不是无限画布')
    import copy
    state = copy.deepcopy(validate_state(params.get('state')))
    with LOCK:
        original_bytes = file.read_bytes()
        raw = original_bytes.decode('utf-8').strip()
        if not raw.startswith(PREFIX):
            raise ValueError('无法识别画布文件')
        current = json.loads(raw[len(PREFIX):].removesuffix(';'))
        if current.get('revision', 0) != params.get('revision'):
            return 409, {'error': '画布已被其他窗口或 AI 修改。请导出当前布局备份，再刷新后继续。'}
        # Compare the full original document as well: agents may keep its revision unchanged.
        if params.get('baseline') != current:
            return 409, {'error': '画布文件已有外部修改。请导出备份后刷新。'}
        validate_state(current)
        if current['schemaVersion'] == 2 and state['schemaVersion'] != 2:
            return 409, {'error': '当前画布已升级为 Schema v2，请更新编辑器后重试，不能降级覆盖。'}
        if current['schemaVersion'] == 2:
            boards = {n['id']: n for n in current['nodes'] if n['type'] == 'board'}
            for node in state['nodes']:
                if node['type'] == 'board' and node['id'] in boards and node['boardId'] != boards[node['id']]['boardId']:
                    raise ValueError('既有画板的逻辑身份不能在保存时改变')
        migrating = current['schemaVersion'] == 1 and state['schemaVersion'] == 2
        if migrating:
            from server.canvas_domain import schema_enabled, migrate_document
            if not schema_enabled(root):
                return 409, {'error': '当前工作区尚未启用 Schema v2 迁移；已存在的 v2 数据仍可继续编辑。'}
            expected = {n['id']: n for n in migrate_document(current, parts[0], parts[1])['nodes'] if n['type'] == 'board'}
            for node in state['nodes']:
                if node['type'] == 'board' and node['id'] in expected and node['boardId'] != expected[node['id']]['boardId']:
                    raise ValueError('迁移不能改变既有画板身份')
        assets = []
        for node in state['nodes']:
            if node['type'] != 'image' or not node.get('src', '').startswith('data:'):
                continue
            match = re.fullmatch(r'data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\r\n]+)', node['src'])
            if not match:
                raise ValueError('图片内容无效')
            try:
                content = base64.b64decode(match.group(2), validate=True)
            except ValueError:
                raise ValueError('图片编码无效')
            if len(content) > 4 * 1024 * 1024:
                raise ValueError('图片超过 4 MB')
            asset_dir = directory / 'assets'
            if asset_dir.is_symlink():
                raise ValueError('素材目录不能是符号链接')
            asset_dir.mkdir(exist_ok=True)
            filename = hashlib.sha256(content).hexdigest() + '.' + match.group(1)
            target = asset_dir / filename
            if target.is_symlink():
                raise ValueError('素材不能是符号链接')
            if not target.exists():
                target.write_bytes(content)
            node['src'] = 'assets/' + filename
            assets.append({'id': node['id'], 'src': node['src']})
        # Duplicated runnable boards get independent code, never alias the source.
        for node in state['nodes']:
            if not node.get('cloneFrom'):
                continue
            source = (directory / node['cloneFrom']).parent
            destination = (directory / node['src']).parent
            if directory not in source.resolve().parents or directory not in destination.resolve().parents:
                raise ValueError('画板目录越界')
            if destination.exists():
                if destination.is_symlink():
                    raise ValueError('画板不能包含符号链接')
                continue
            if source.is_symlink() or any(p.is_symlink() for p in source.rglob('*')):
                raise ValueError('画板不能包含符号链接')
            if not (source / 'index.html').is_file():
                raise ValueError('源画板文件不存在，无法复制')
            if not destination.exists():
                shutil.copytree(source, destination)
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
        temporary.write_text(PREFIX + serialized + ';\n', encoding='utf-8')
        # Asset / board copies can take time. Recheck immediately before replacing the layout,
        # since external Agent writes do not participate in this process's lock.
        if file.read_text(encoding='utf-8').strip() != raw:
            temporary.unlink(missing_ok=True)
            return 409, {'error': '保存期间出现外部更新，本机修改已保留，请选择恢复或读取最新版本。'}
        try:
            if migrating:
                migration_backup(directory, original_bytes)
            # Backup preparation can also race an external Agent write.
            if file.read_bytes() != original_bytes:
                return 409, {'error': '迁移期间出现外部更新，原文件与本机草稿均已保留。'}
            temporary.replace(file)
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
