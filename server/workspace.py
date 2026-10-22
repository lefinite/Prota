"""Workspace location and copy/verify/switch operations, shared by the bridge.

Application files and credentials never move with a workspace. Nothing switches
until the complete asset copy has been verified; the source is never deleted.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.error
import uuid

APP_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = Path(os.environ.get('READIFY_CONFIG_DIR', str(Path.home() / '.config' / 'prota'))).expanduser()
CONFIG_PATH = CONFIG_DIR / 'workspace.json'
LOCK_PATH = CONFIG_DIR / 'workspace.lock'
ASSET_PATHS = ('src/pages', 'assets', 'shares', 'data/projects.json', 'data/settings.json',
               'data/agent-sessions', 'data/agent-uploads', 'data/agent-checkpoints', 'data/active-prd-context.json',
               'data/share-archive', 'data/published-static')
_job = None
_mutex = threading.Lock()


def read_config():
    if not CONFIG_PATH.exists():
        return {}
    try:
        with CONFIG_PATH.open(encoding='utf-8') as stream:
            config = json.load(stream)
        if not isinstance(config, dict) or not isinstance(config.get('path'), str):
            raise ValueError('Invalid workspace configuration')
        return config
    except (OSError, ValueError):
        return {'path': str(CONFIG_DIR / 'unavailable-workspace'), 'configurationError': '存储配置无法读取，请打开有效工作区。'}


def workspace_root():
    configured = os.environ.get('READIFY_WORKSPACE') or read_config().get('path')
    if not configured:
        legacy = APP_ROOT / 'data/projects.json'
        if legacy.is_file() and json.loads(legacy.read_text(encoding='utf-8')).get('projects'):
            return APP_ROOT  # Existing installations retain the explicit migration flow.
        root = CONFIG_DIR / 'workspace'
        if not (root / 'workspace.json').exists():
            (root / 'src/pages').mkdir(parents=True, exist_ok=True)
            atomic_json(root / 'data/projects.json', {'projects': [], 'activeProjectId': None, 'activePageId': None})
            atomic_json(root / 'workspace.json', {'id': str(uuid.uuid4()), 'formatVersion': 1, 'createdAt': time.time()})
            write_metadata_snapshot(root, json.loads((root / 'data/projects.json').read_text()))
        atomic_json(CONFIG_PATH, {'path': str(root), 'updatedAt': time.time()})
        configured = str(root)
    root = Path(configured).expanduser().resolve()
    if configured and (not root.is_dir() or not (root / 'src/pages').is_dir() or not (root / 'data/projects.json').is_file()):
        raise ValueError('项目存放位置不可用，请重新连接磁盘或在设置中打开有效工作区。')
    if configured and root != APP_ROOT:
        try:
            manifest = json.loads((root / 'workspace.json').read_text(encoding='utf-8'))
            if manifest.get('formatVersion') != 1 or not manifest.get('id'):
                raise ValueError('Invalid workspace manifest')
        except (OSError, ValueError):
            raise ValueError('工作区清单无效，请在设置中打开有效工作区。')
    return root


def atomic_json(destination, payload):
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + '.tmp')
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.chmod(0o600)
    os.replace(temporary, destination)


def status():
    config = read_config()
    try:
        root = workspace_root()
        error = None
    except (ValueError, OSError) as exc:
        root = Path(config.get('path') or APP_ROOT)
        error = str(exc)
    manifest = root / 'workspace.json'
    identity = str(root)
    if manifest.is_file():
        try:
            identity = json.loads(manifest.read_text(encoding='utf-8'))['id']
        except (ValueError, KeyError, OSError):
            error = '工作区清单损坏，请选择有效的工作区。'
    return {'defaultPath': str(CONFIG_DIR / 'workspace'), 'path': str(root), 'id': identity, 'legacy': root == APP_ROOT,
            'needsSetup': not bool(config.get('path')), 'available': error is None,
            'error': error, 'job': dict(_job) if _job else None}


def process_alive(pid):
    if os.name != 'nt':
        try:
            os.kill(pid, 0)
            return True
        except ProcessLookupError:
            return False
    # os.kill(pid, 0) can terminate a process on Windows. Query it instead.
    import ctypes
    from ctypes import wintypes
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        return ctypes.get_last_error() != 87  # Access denied is still a live process.
    try:
        code = wintypes.DWORD()
        return not kernel.GetExitCodeProcess(handle, ctypes.byref(code)) or code.value == 259
    finally:
        kernel.CloseHandle(handle)


def bridge_locked():
    if LOCK_PATH.exists():
        try:
            lease = json.loads(LOCK_PATH.read_text(encoding='utf-8'))
            if not process_alive(int(lease['pid'])):
                LOCK_PATH.unlink(missing_ok=True)
        except ProcessLookupError:
            LOCK_PATH.unlink(missing_ok=True)
        except (OSError, ValueError, KeyError):
            return True
    return bool(_job and _job.get('state') == 'running') or LOCK_PATH.exists()



def write_metadata_snapshot(root, data):
    """Keep both workspace metadata representations in sync without editing app code."""
    atomic_json(root / 'data/projects.snapshot.json', data)
    destination = root / 'portal/shell.js'
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    destination.write_text('// Prota workspace metadata snapshot; application code stays in the installation.\nconst defaultData = ' + payload + ';\nif (typeof window !== "undefined") window.__PROTA_WORKSPACE_DATA__ = defaultData;\n', encoding='utf-8')


def native_directory():
    if sys.platform == 'darwin':
        result = subprocess.run(['osascript', '-e', 'POSIX path of (choose folder with prompt "选择 Prota 项目存放位置")'], capture_output=True, text=True)
    elif sys.platform == 'win32':
        result = subprocess.run(['powershell', '-NoProfile', '-STA', '-Command',
            'Add-Type -AssemblyName System.Windows.Forms; $picker=New-Object System.Windows.Forms.FolderBrowserDialog; if($picker.ShowDialog() -eq "OK"){$picker.SelectedPath}'], capture_output=True, text=True)
    else:
        try:
            result = subprocess.run(['zenity', '--file-selection', '--directory', '--title=选择 Prota 项目存放位置'], capture_output=True, text=True)
        except FileNotFoundError:
            raise ValueError('此环境没有系统文件夹选择器，请输入这台电脑上的文件夹完整路径。')
    if result.returncode != 0:
        if '-128' in result.stderr or result.returncode == 1:
            return None
        raise ValueError('无法打开系统文件夹选择器，请输入文件夹完整路径。')
    return result.stdout.strip() or None


def check_target(value, mode, source):
    if mode not in {'migrate', 'open', 'new'}:
        raise ValueError('未知的工作区操作。')
    if not value or not Path(value).expanduser().is_absolute():
        raise ValueError('请选择文件夹，或输入绝对路径。')
    target = Path(value).expanduser().resolve()
    if target == source or target in source.parents or source in target.parents:
        raise ValueError('目标与当前位置不能相同，也不能互为父子目录。')
    if target == APP_ROOT or target in APP_ROOT.parents or APP_ROOT in target.parents:
        raise ValueError('请选择程序目录以外的独立文件夹。')
    if mode == 'open':
        manifest = json.loads((target / 'workspace.json').read_text(encoding='utf-8'))
        if manifest.get('formatVersion') != 1 or not manifest.get('id'):
            raise ValueError('该目录不是支持的 Prota 工作区。')
        if not (target / 'src/pages').is_dir():
            raise ValueError('工作区页面目录缺失。')
        data = json.loads((target / 'data/projects.json').read_text(encoding='utf-8'))
        if not isinstance(data.get('projects'), list):
            raise ValueError('工作区项目索引无效。')
    elif target.exists() and (not target.is_dir() or any(target.iterdir())):
        if mode == 'migrate':
            raise ValueError('无法迁移：目标文件夹不是空文件夹（包括隐藏文件）。请选择一个干净的空文件夹。')
        raise ValueError('所选文件夹已有其他内容，且不是 Prota 项目文件夹。请选择空文件夹或之前使用的 Prota 文件夹。')
    parent = target if target.is_dir() else target.parent
    if not parent.is_dir() or not os.access(parent, os.W_OK):
        raise ValueError('目标位置不存在或不可写，请选择可写的文件夹。')
    return target


def asset_files(source):
    result = []
    for relative in ASSET_PATHS:
        item = source / relative
        if item.is_symlink():
            raise ValueError(f'资产包含符号链接，请先整理：{relative}')
        candidates = item.rglob('*') if item.is_dir() else [item] if item.is_file() else []
        for file in candidates:
            if file.is_symlink():
                raise ValueError(f'资产包含符号链接，请先整理：{file.relative_to(source)}')
            if file.is_file():
                result.append((file, file.relative_to(source), file.stat().st_size))
    return result


def plan(value, mode):
    # Changing location never copies current assets. Reuse a valid workspace,
    # or initialize a blank one; let the normal target checks reject conflicts.
    if mode == 'switch':
        mode = 'open' if value and (Path(value).expanduser() / 'workspace.json').exists() else 'new'
    try:
        source = workspace_root()
    except (OSError, ValueError):
        if mode not in {'open', 'new'}:
            raise
        source = Path(read_config().get('path') or APP_ROOT).resolve()
    target = check_target(value, mode, source)
    files = asset_files(source) if mode == 'migrate' else []
    size = sum(size for _, _, size in files)
    if mode == 'migrate' and shutil.disk_usage(target.parent).free < size + 16 * 1024 * 1024:
        raise ValueError('目标磁盘空间不足，请更换位置或清理空间。')
    return {'source': str(source), 'target': str(target), 'mode': mode, 'files': len(files), 'bytes': size}


def agent_control(action):
    endpoint = f'http://127.0.0.1:{os.environ.get("READIFY_AGENT_PORT", "8081")}/api/agent/workspace/{action}'
    request = urllib.request.Request(endpoint, data=b'{}', headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        raise ValueError('AI 服务尚未就绪或有任务正在运行，请结束任务后再更改位置。') from exc
    except urllib.error.URLError as exc:
        # No agent service is safe: there cannot be a running task in that service.
        if isinstance(exc.reason, ConnectionRefusedError):
            return None
        raise ValueError('无法确认 AI 任务状态，请检查本地 AI 服务后重试。') from exc


def digest(file):
    result = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.digest()


def start(value, mode, expected_source):
    global _job
    with _mutex:
        if bridge_locked():
            raise ValueError('已有位置切换正在进行，请等待完成。')
        proposal = plan(value, mode)
        if proposal['source'] != expected_source:
            raise ValueError('当前工作区已变化，请重新确认操作。')
        _job = {**proposal, 'id': str(uuid.uuid4()), 'state': 'running', 'phase': '准备', 'completed': 0, 'error': None}
        threading.Thread(target=_run, args=(dict(_job),), daemon=True).start()
        return dict(_job)


def _run(job):
    global _job
    stage = None
    agent_prepared = False
    lock_owned = False
    switched = False
    success = False
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        agent_prepared = agent_control('prepare') is not None
        with LOCK_PATH.open('x', encoding='utf-8') as stream:
            stream.write(json.dumps({'pid': os.getpid(), 'id': job['id']}))
        lock_owned = True
        source, target = Path(job['source']), Path(job['target'])
        check_target(str(target), job['mode'], source)
        if job['mode'] != 'open':
            stage = target.parent / f'.prota-migration-{job["id"]}'
            stage.mkdir()
            (stage / 'src/pages').mkdir(parents=True)
            if job['mode'] == 'migrate':
                files = asset_files(source)
                for relative in ASSET_PATHS:
                    original = source / relative
                    if original.is_dir():
                        (stage / relative).mkdir(parents=True, exist_ok=True)
                        for directory in original.rglob('*'):
                            if directory.is_dir() and not directory.is_symlink():
                                (stage / directory.relative_to(source)).mkdir(parents=True, exist_ok=True)
                _job.update(phase='复制', files=len(files), bytes=sum(size for _, _, size in files))
                for index, (file, relative, _) in enumerate(files):
                    destination = stage / relative
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(file, destination)
                    _job['completed'] = index + 1
                _job.update(phase='校验', completed=0)
                for index, (file, relative, _) in enumerate(files):
                    if digest(file) != digest(stage / relative):
                        raise ValueError(f'文件校验失败：{relative}')
                    _job['completed'] = index + 1
            else:
                atomic_json(stage / 'data/projects.json', {'projects': [], 'activeProjectId': None, 'activePageId': None})
            index = json.loads((stage / 'data/projects.json').read_text(encoding='utf-8'))
            write_metadata_snapshot(stage, index)
            identity = str(uuid.uuid4())
            atomic_json(stage / 'workspace.json', {'id': identity, 'formatVersion': 1, 'createdAt': time.time()})
            # Workspace-local guidance, never instruct generators to edit app source.
            guidance = (APP_ROOT / 'AGENTS.md').read_text(encoding='utf-8') if (APP_ROOT / 'AGENTS.md').is_file() else '# Prota 工作区\n页面目录：src/pages/{project_id}/{page_id}/{version}/。\n'
            guidance += f'\n\n## 当前工作区运行上下文\n程序安装目录：{APP_ROOT}\n内置模板源：{APP_ROOT / "src/templates"}\n项目资产写入当前工作区；同步本工作区 data/projects.json 与本工作区 portal/shell.js 的 defaultData；不修改程序安装目录的 portal/shell.js。\n'
            (stage / 'AGENTS.md').write_text(guidance, encoding='utf-8')
            # Recheck after copying as well: the destination may have been
            # populated since the user confirmed the initial plan.
            check_target(str(target), job['mode'], source)
            if target.exists():
                try:
                    target.rmdir()  # Also refuses writes racing the final check.
                except OSError:
                    if target.is_dir() and any(target.iterdir()):
                        raise ValueError('目标文件夹已出现其他内容，操作已停止。请选择一个干净的空文件夹。') from None
                    raise
            stage.rename(target)
            stage = None
        _job['phase'] = '切换'
        atomic_json(CONFIG_PATH, {'path': str(target), 'updatedAt': time.time()})
        switched = True
        if agent_prepared:
            agent_control('complete')
            agent_prepared = False
        success = True
    except Exception as exc:
        if switched:
            atomic_json(CONFIG_PATH, {'path': job['source'], 'updatedAt': time.time()})
        _job.update(state='failed', phase='失败', error=str(exc))
    finally:
        if stage and stage.exists():
            shutil.rmtree(stage)
        if lock_owned:
            LOCK_PATH.unlink(missing_ok=True)
        if agent_prepared:
            try:
                agent_control('complete')
            except Exception:
                pass
        if success:
            _job.update(state='complete', phase='完成', target=str(target))
