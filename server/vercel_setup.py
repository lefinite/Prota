"""Local-only browser authorization and automatic static-share provisioning."""
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
import threading
import time
import urllib.parse
import uuid
import webbrowser
from server import workspace
from server.deployer import read_vercel_auth, deployment_environment, vercel_api, configure_vercel

_lock = threading.RLock()
_auth_refresh_lock = threading.Lock()
_job = None
_process = None
_cancel = threading.Event()


def status():
    with _lock:
        return dict(_job) if _job else {'state': 'idle'}


def inspect_connection():
    """Read persisted settings and verify authorization, without provisioning."""
    result = {'authState': 'unauthorized', 'publishState': 'unconfigured',
              'account': '', 'domain': '', 'projectName': '', 'checkedAt': time.time()}
    try:
        root = workspace.workspace_root()
        settings_file = root / 'data/settings.json'
        settings = json.loads(settings_file.read_text()) if settings_file.is_file() else {}
        config_file = workspace.CONFIG_DIR / 'vercel.json'
        config = json.loads(config_file.read_text()) if config_file.is_file() else {}
        result.update(domain=config.get('staticDomain', ''), projectName=config.get('projectName', ''))
        try:
            token, team = read_vercel_auth()
        except (ValueError, OSError):
            result['message'] = '尚未授权 Vercel，请连接账号。'
            return result
        try:
            user = vercel_api('/v2/user', token, timeout=8).get('user', {})
        except ValueError as error:
            if '登录已失效' not in str(error):
                result.update(authState='unknown', publishState='unknown', message='暂时无法验证授权，请检查网络后重试。')
                return result
            # OAuth access tokens can expire while the CLI login remains valid.
            # Refresh that existing login before asking the user to authorize again.
            try:
                with _auth_refresh_lock:
                    cli(['whoami'], timeout=30)
                    token, team = read_vercel_auth()
                    user = vercel_api('/v2/user', token, timeout=8).get('user', {})
            except (ValueError, OSError, subprocess.TimeoutExpired) as refresh_error:
                if isinstance(refresh_error, (OSError, subprocess.TimeoutExpired)):
                    result.update(authState='unknown', publishState='unknown', message='暂时无法刷新已有登录，请检查网络后重新检查连接。')
                else:
                    result.update(authState='expired', message='已有登录无法恢复，请重新授权 Vercel。')
                return result
        result.update(authState='authorized', account=user.get('username') or user.get('name') or 'Vercel 账号')
        if not config.get('projectId') or not config.get('orgId'):
            result['message'] = '账号已授权，尚未关联分享项目。'
            return result
        try:
            project = vercel_api('/v9/projects/' + config['projectId'], token, config['orgId'], timeout=8)
            domains = vercel_api('/v9/projects/' + config['projectId'] + '/domains?limit=100', token, config['orgId'], timeout=8).get('domains', [])
        except ValueError:
            result.update(publishState='invalid', message='账号已授权，但无法访问原分享项目，请检查权限或重新连接。')
            return result
        result['projectName'] = project.get('name', result['projectName'])
        entry = next((item for item in domains if item.get('name') == result['domain']), None)
        if entry is None or entry.get('redirect') or entry.get('gitBranch'):
            result.update(publishState='invalid', message='原分享地址不可用，请重新连接并核对项目域名。')
        elif settings.get('staticDomain') != result['domain'] or not settings.get('vercelAutoDeploy', True):
            result.update(publishState='unconfigured', message='账号已授权，当前工作区尚未应用分享地址。')
        elif entry.get('verified') is False:
            result.update(publishState='dns_required', message='域名尚未验证，请完成 DNS 解析后重新连接检查。')
        elif not result['domain'].endswith('.vercel.app') and vercel_api('/v6/domains/' + result['domain'] + '/config', token, config['orgId'], timeout=8).get('misconfigured'):
            result.update(publishState='dns_required', message='域名解析尚未生效，请检查 DNS 记录。')
        else:
            result.update(publishState='ready', message='授权有效，当前分享地址已生效。')
    except Exception:
        # A network failure is not evidence that authorization has expired.
        if result['authState'] != 'authorized':
            result['authState'] = 'unknown'
        result.update(publishState='unknown', message='暂时无法检查连接，请确认网络后重试。')
    return result


def update(**values):
    with _lock:
        if _job:
            _job.update(values)


def start(domain=''):
    global _job, _cancel
    domain = str(domain).strip().lower().removeprefix('https://').removeprefix('http://').rstrip('/')
    if domain and (len(domain) > 253 or not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}', domain)):
        raise ValueError('请输入有效的自有域名，不要包含页面路径。')
    with _lock:
        if _job and _job['state'] in {'running', 'authorizing'}:
            return dict(_job)
        _cancel = threading.Event()
        _job = {'id': uuid.uuid4().hex, 'state': 'running', 'step': 1, 'message': '正在检查 Vercel 连接…'}
        threading.Thread(target=run, args=(domain, _cancel), daemon=True).start()
        return dict(_job)


def terminate(process):
    if process.poll() is None:
        try:
            if os.name == 'posix':
                os.killpg(process.pid, signal.SIGTERM)
            else:
                subprocess.run(['taskkill.exe', '/PID', str(process.pid), '/T', '/F'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=subprocess.CREATE_NO_WINDOW)
        except ProcessLookupError:
            pass


def cancel():
    with _lock:
        if not _job or _job.get('state') not in {'running', 'authorizing'}:
            return status()
        _cancel.set()
        if _process and _process.poll() is None:
            terminate(_process)
        update(state='cancelled', message='已取消连接，现有分享与配置保持不变。')
    return status()


def cli(args, timeout=120, **kwargs):
    node = shutil.which('node')
    if not node:
        raise ValueError('分享工具尚未准备好，请关闭后重新双击 Prota。')
    process = subprocess.Popen([node, str(workspace.APP_ROOT / 'scripts/vercel-cli.mjs'), *args],
                               env={**deployment_environment(), 'CI': '1', 'NO_COLOR': '1', 'VERCEL_TELEMETRY_DISABLED': '1'},
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                               start_new_session=True,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0, **kwargs)
    try:
        output, _ = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        terminate(process)
        process.communicate(timeout=10)
        raise ValueError('Vercel 操作超时，请检查网络后重试。') from None
    if process.returncode:
        raise ValueError('Vercel 操作未完成，请检查网络和账号权限后重试。')
    return output.strip().splitlines()[-1] if output.strip() else ''


def authenticate(cancelled):
    global _process
    try:
        token, team = read_vercel_auth()
        vercel_api('/v2/user', token)
        return token, team
    except ValueError as error:
        # Permissions and network failures must never trigger a new browser login.
        if '登录已失效' not in str(error) and '连接 Vercel' not in str(error):
            raise
        # Let the official CLI refresh its existing OAuth token before logging in.
        try:
            cli(['whoami'], timeout=30)
            token, team = read_vercel_auth()
            vercel_api('/v2/user', token)
            return token, team
        except (ValueError, subprocess.TimeoutExpired):
            pass
    update(state='authorizing', step=1, message='请在浏览器中登录并授权 Vercel，完成后会自动继续。')
    node = shutil.which('node')
    if not node:
        raise ValueError('分享工具尚未准备好，请重新双击 Prota。')
    env = {**deployment_environment(), 'CI': '1', 'NO_COLOR': '1', 'VERCEL_TELEMETRY_DISABLED': '1'}
    process = subprocess.Popen([node, str(workspace.APP_ROOT / 'scripts/vercel-cli.mjs'), 'login'],
                               env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, text=True, bufsize=1, start_new_session=True,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    with _lock:
        _process = process
    timer = threading.Timer(600, terminate, args=(process,))
    timer.start()
    try:
        opened = False
        for line in process.stdout:
            if cancelled.is_set():
                terminate(process)
                raise ValueError('连接已取消。')
            # Keep CLI output in memory only; never expose token/debug output.
            found = re.search(r'https://vercel\.com/[^\s\x1b<>]+', line)
            if found and not opened:
                url = found.group().rstrip(').,')
                if urllib.parse.urlsplit(url).path.startswith(('/oauth/', '/device')):
                    update(authorizationUrl=url)
                    webbrowser.open(url)
                    opened = True
        if process.wait() != 0:
            raise ValueError('浏览器授权未完成或已过期，请点击重试。')
    finally:
        timer.cancel()
        with _lock:
            _process = None
    token, team = read_vercel_auth()
    vercel_api('/v2/user', token)
    return token, team


def bootstrap_project(project, token, team, cancelled):
    """Only a blank greeting is deployed here; never a workspace or its snapshots."""
    update(state='running', step=3, message='正在准备分享地址…', authorizationUrl=None)
    with tempfile.TemporaryDirectory(prefix='prota-empty-share-') as temporary:
        root = Path(temporary)
        static = root / '.vercel/output/static'
        static.mkdir(parents=True)
        (static / 'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Prota Share</title><p>分享空间已就绪。</p>')
        workspace.atomic_json(root / '.vercel/output/config.json', {'version': 3})
        workspace.atomic_json(root / '.vercel/project.json', {'projectId': project['id'], 'orgId': project['accountId']})
        if cancelled.is_set():
            raise ValueError('连接已取消。')
        cli(['deploy', '--prebuilt', '--prod', '--yes', '--cwd', str(root)], timeout=300)


def commit_connection(config, cancelled, expected_root=None):
    # Serialize the local commit with cancel, so "cancelled" never hides a save.
    with _lock:
        if cancelled.is_set():
            raise ValueError('连接已取消。')
        current = workspace.workspace_root()
        if workspace.bridge_locked() or expected_root is not None and current != expected_root:
            raise ValueError('工作区已切换，请在当前工作区重新连接。')
        settings_file = current / 'data/settings.json'
        settings = json.loads(settings_file.read_text()) if settings_file.is_file() else {}
        config_file = workspace.CONFIG_DIR / 'vercel.json'
        previous = json.loads(config_file.read_text()) if config_file.is_file() else None
        updated = dict(settings, staticDomain=config['staticDomain'], vercelAutoDeploy=True, gitAutoPush=False,
                       shareMode='vercel' if config['staticDomain'].endswith('.vercel.app') else 'custom')
        workspace.atomic_json(config_file, config)
        try:
            workspace.atomic_json(settings_file, updated)
        except Exception:
            if previous is None:
                config_file.unlink(missing_ok=True)
            else:
                workspace.atomic_json(config_file, previous)
            raise
        update(state='ready', step=4, message='已连接，可以直接分享。', domain=config['staticDomain'], projectName=config['projectName'], authorizationUrl=None)


def run(domain, cancelled):
    try:
        initial_workspace = workspace.workspace_root()
        token, team = authenticate(cancelled)
        if cancelled.is_set():
            return
        update(state='running', step=2, message='正在关联分享项目…', authorizationUrl=None)
        config_file = workspace.CONFIG_DIR / 'vercel.json'
        existing = json.loads(config_file.read_text()) if config_file.is_file() else None
        if existing:
            # Never create a replacement for an inaccessible existing project.
            project = vercel_api('/v9/projects/' + existing['projectId'], token, existing['orgId'])
            team = existing['orgId']
            if existing['staticDomain'].endswith('.vercel.app') and (not domain or domain == existing['staticDomain']):
                domains = vercel_api('/v9/projects/' + project['id'] + '/domains?limit=100', token, team).get('domains', [])
                if not any(item['name'] == existing['staticDomain'] for item in domains):
                    raise ValueError('原分享地址已不在项目中，请检查原项目配置；程序没有创建替代项目。')
                commit_connection(existing, cancelled, initial_workspace)
                return
        else:
            pending_file = workspace.CONFIG_DIR / 'vercel-pending-project.json'
            pending = json.loads(pending_file.read_text()) if pending_file.is_file() else None
            if pending:
                project = vercel_api('/v9/projects/' + pending['projectId'], token, pending['orgId'])
                team = pending['orgId']
            else:
                name = 'prota-share-' + uuid.uuid4().hex[:10]
                project = vercel_api('/v9/projects', token, team, method='POST', data={'name': name, 'framework': None})
                team = project['accountId']
                workspace.atomic_json(pending_file, {'projectId': project['id'], 'orgId': team})
            if not pending or not pending.get('bootstrapped'):
                # Retry protection setup too if an earlier attempt failed here.
                # Only new Prota projects are changed; existing projects are not.
                vercel_api('/v9/projects/' + project['id'], token, team, method='PATCH', data={'ssoProtection': None})
                bootstrap_project(project, token, team, cancelled)
                workspace.atomic_json(pending_file, {'projectId': project['id'], 'orgId': team, 'bootstrapped': True})
        if cancelled.is_set():
            return
        entries = vercel_api('/v9/projects/' + project['id'] + '/domains?limit=100', token, team).get('domains', [])
        if domain:
            entry = next((item for item in entries if item['name'] == domain), None)
            if entry is None:
                entry = vercel_api('/v10/projects/' + project['id'] + '/domains', token, team, method='POST', data={'name': domain})
            dns = vercel_api('/v6/domains/' + domain + '/config', token, team)
            if not entry.get('verified') or dns.get('misconfigured'):
                update(state='dns_required', step=3, message='请在你的域名服务商添加以下记录，然后点击重新检查。', domain=domain,
                       verification=entry.get('verification', []), dns=dns)
                return
        else:
            domain = next((item['name'] for item in entries if item['name'].endswith('.vercel.app') and not item.get('gitBranch') and not item.get('redirect')), None)
            if not domain:
                raise ValueError('Vercel 尚未分配正式分享地址，请稍后重试。')
        config = {'projectId': project['id'], 'orgId': project['accountId'], 'projectName': project['name'], 'staticDomain': domain}
        commit_connection(config, cancelled, initial_workspace)
    except Exception as error:
        if not cancelled.is_set():
            message = str(error) if isinstance(error, ValueError) else '连接未完成，请检查网络后重试。现有分享未改动。'
            update(state='error', message=message, authorizationUrl=None)
