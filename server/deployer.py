"""Publish an allowlisted static snapshot directly to Vercel, never through Git."""
import json
import logging
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import socket
import tempfile
import threading
import urllib.parse
import urllib.request
import urllib.error

try:
    from server import workspace
except ImportError:
    import workspace

logger = logging.getLogger('readify.deployer')
_publish_lock = threading.Lock()
EMPTY_DATA = {'projects': [], 'activeProjectId': None, 'activePageId': None}


def share_payload(file):
    text = Path(file).read_text(encoding='utf-8')
    match = re.search(r'window\.__READIFY_SHARE__\s*=\s*', text)
    if match:
        # HTML escapes the slash in closing tags to prevent script injection.
        return json.JSONDecoder().raw_decode(text[match.end():].replace('\\/', '/'))[0]
    match = re.search(r'<script[^>]*id="shareData"[^>]*>(.*?)</script>', text, re.S)
    if match:
        return json.loads(match.group(1))
    raise ValueError(f'分享元数据无法识别，请重新生成：{Path(file).name}')


def safe_relative(value):
    value = urllib.parse.unquote(str(value).split('?', 1)[0].split('#', 1)[0]).lstrip('/')
    p = PurePosixPath(value)
    if not value or '\\' in value or any(part in {'.', '..'} or part.startswith('.') for part in p.parts):
        raise ValueError('发布资源路径无效。')
    return p.as_posix()


def read_vercel_auth():
    token = os.environ.get('VERCEL_TOKEN')
    team = os.environ.get('VERCEL_ORG_ID')
    candidates = [Path.home() / 'Library/Application Support/com.vercel.cli',
                  Path.home() / '.local/share/com.vercel.cli', Path.home() / '.config/com.vercel.cli']
    for directory in candidates:
        if not token and (directory / 'auth.json').is_file():
            token = json.loads((directory / 'auth.json').read_text()).get('token')
        if not team and (directory / 'config.json').is_file():
            team = json.loads((directory / 'config.json').read_text()).get('currentTeam')
    if not token:
        raise ValueError('请先在本机终端执行 npm run vercel -- login（在产品安装目录执行），然后重新发布。')
    return token, team


def deployment_environment():
    env = dict(os.environ)
    # Match the system network configuration used by the authenticated API.
    system = getattr(urllib.request, 'getproxies_macosx_sysconf', lambda: {})()
    proxies = system or urllib.request.getproxies()
    for protocol in ['http', 'https']:
        proxy = proxies.get(protocol)
        if not proxy:
            continue
        current = env.get(protocol.upper() + '_PROXY') or env.get(protocol + '_proxy')
        usable = True
        if current:
            parsed = urllib.parse.urlsplit(current)
            if parsed.hostname in {'localhost', '127.0.0.1', '::1'}:
                try:
                    with socket.create_connection((parsed.hostname, parsed.port), timeout=1):
                        pass
                except OSError:
                    usable = False
        if not current or not usable:
            env[protocol.upper() + '_PROXY'] = env[protocol + '_proxy'] = proxy
    return env


def vercel_api(endpoint, token, team=None, method='GET'):
    suffix = ('&' if '?' in endpoint else '?') + urllib.parse.urlencode({'teamId': team}) if team else ''
    request = urllib.request.Request('https://api.vercel.com' + endpoint + suffix,
                                    headers={'Authorization': 'Bearer ' + token}, method=method)
    try:
        env = deployment_environment()
        proxies = {protocol: env[protocol + '_proxy'] for protocol in ['http', 'https'] if env.get(protocol + '_proxy')}
        opener = urllib.request.build_opener(urllib.request.ProxyHandler(proxies)) if proxies else urllib.request.build_opener()
        with opener.open(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            raise ValueError('Vercel 登录已失效或没有项目权限，请执行 npm run vercel -- login（在产品安装目录执行）后重试。') from None
        raise ValueError(f'Vercel 请求失败（HTTP {exc.code}），请检查项目配置。') from None


def configure_vercel(domain, project_id=None):
    """Read-only discovery, then persist a link outside both source and business data."""
    token, team = read_vercel_auth()
    selected = None
    pagination = None
    while True:
        query = '/v9/projects?limit=100' + (f'&until={pagination}' if pagination else '')
        result = vercel_api(query, token, team)
        for project in result.get('projects', []):
            if project_id and project['id'] != project_id and project['name'] != project_id:
                continue
            domains = vercel_api('/v9/projects/' + project['id'] + '/domains?limit=100', token, team)
            if domain in [entry['name'] for entry in domains.get('domains', [])]:
                selected = project
                break
        if selected or not result.get('pagination', {}).get('next'):
            break
        pagination = result['pagination']['next']
    if not selected:
        raise ValueError('当前 Vercel 账号下没有绑定该分享域名的项目，请检查登录账号和团队。')
    config = {'projectId': selected['id'], 'orgId': selected['accountId'],
              'projectName': selected['name'], 'staticDomain': domain}
    workspace.atomic_json(workspace.CONFIG_DIR / 'vercel.json', config)
    return config


class VercelDeployer:
    def __init__(self, project_root, application_root=None):
        self.root = Path(project_root).resolve()
        self.app = Path(application_root or workspace.APP_ROOT).resolve()
        settings = self.root / 'data/settings.json'
        self.settings = json.loads(settings.read_text()) if settings.is_file() else {}

    def _copy(self, source_root, relative, static):
        relative = safe_relative(relative)
        source = source_root / relative
        if not source.exists() and source_root == self.root:
            archived = self.root / 'data/share-archive'
            if (archived / relative).exists():
                return self._copy(archived, relative, static)
        if not source.exists():
            raise ValueError(f'发布资源缺失：{relative}')
        if source.is_symlink() or source_root not in source.resolve().parents:
            raise ValueError(f'发布资源不能包含符号链接：{relative}')
        destination = static / relative
        if source.is_dir():
            for file in source.rglob('*'):
                if file.is_symlink():
                    raise ValueError(f'发布资源不能包含符号链接：{relative}')
                if file.is_file() and not any(p.startswith('.') or p in {'node_modules', '__pycache__'} for p in file.relative_to(source).parts):
                    self._copy(source_root, file.relative_to(source_root).as_posix(), static)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)

    def prepare(self, directory, share_files):
        """Build Output API v3. Only explicitly shared pages enter this snapshot."""
        directory = Path(directory)
        static = directory / '.vercel/output/static'
        static.mkdir(parents=True)
        previous = self.root / 'data/published-static'
        if previous.is_dir():
            shutil.copytree(previous, static, dirs_exist_ok=True)
        self._copy(self.app, 'portal', static)
        # Product frontend defaults must never disclose the local project index.
        shell = static / 'portal/shell.js'
        shell.write_text(re.sub(r'(?<=/\* __READIFY_DATA_START__ \*/).*?(?=/\* __READIFY_DATA_END__ \*/)',
                               json.dumps(EMPTY_DATA) + ' ', shell.read_text(), flags=re.S))
        shared = []
        for file in share_files:
            file = Path(file).resolve()
            relative = file.relative_to(self.root).as_posix()
            if not relative.startswith('shares/') or not file.name.endswith('-static.html'):
                raise ValueError('只能部署明确生成的静态分享文件。')
            payload = share_payload(file)
            self._copy(self.root, relative, static)
            # Support both historical URL layouts without changing filenames.
            shutil.copy2(static / relative, static / file.name)
            pages = payload.get('pages') if payload.get('mode') == 'folder' else [payload]
            for page in pages or []:
                project = payload.get('projectId')
                page_id = page.get('pageId') or page.get('id')
                version = page.get('version')
                if not all(isinstance(s, str) and re.fullmatch(r'[A-Za-z0-9_-]+', s) for s in [project, page_id]) or not re.fullmatch(r'v\d+', str(version)):
                    raise ValueError(f'分享页面标识无效：{file.name}')
                self._copy(self.root, f'src/pages/{project}/{page_id}/{version}', static)
                documents = page.get('documents') or []
                for document in documents:
                    doc_path = safe_relative(document.get('path', ''))
                    if not doc_path.startswith(f'src/pages/{project}/{page_id}/'):
                        raise ValueError('分享文档不属于选定页面。')
                    if (self.root / doc_path).is_file() or (self.root / 'data/share-archive' / doc_path).is_file():
                        self._copy(self.root, doc_path, static)
                    else:
                        logger.warning('历史分享引用了已缺失的文档：%s', doc_path)
                # PRD images and diagrams are page-scoped, never project-wide.
                docs = self.root / f'src/pages/{project}/{page_id}/docs'
                if docs.is_dir() and (documents or page.get('prdContent') or page.get('diagrams') or page.get('mindmaps')):
                    self._copy(self.root, docs.relative_to(self.root).as_posix(), static)
            zip_name = payload.get('zipFilename')
            if zip_name:
                if Path(zip_name).name != zip_name or not zip_name.endswith('.zip'):
                    raise ValueError('下载包路径无效。')
                self._copy(self.root, 'shares/' + zip_name, static)
                shutil.copy2(static / 'shares' / zip_name, static / zip_name)
            shared.append(relative)
        # Follow referenced local assets/templates instead of copying the workspace.
        scanned = set()
        while True:
            pending = [p for p in static.rglob('*') if p.is_file() and p.suffix in {'.html', '.css', '.js', '.mjs', '.md'} and p not in scanned]
            if not pending:
                break
            for file in pending:
                scanned.add(file)
                text = file.read_text(encoding='utf-8', errors='replace')
                for ref in re.findall(r'''(?:["'(])((?:/|(?:\.\./)+)(?:[^\s"'<>`)]+))''', text):
                    parsed = urllib.parse.urlsplit(ref)
                    if parsed.netloc:
                        continue
                    path_text = parsed.path
                    relative = os.path.normpath(path_text.lstrip('/') if path_text.startswith('/') else str(file.parent.relative_to(static) / path_text)).replace(os.sep, '/')
                    if relative.startswith(('assets/', 'src/templates/')) and not (static / relative).exists():
                        source = self.root if relative.startswith('assets/') else self.app
                        if (source / relative).is_file():
                            self._copy(source, relative, static)
        (static / 'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Prota Share</title><p>请使用收到的分享链接访问。</p>')
        workspace.atomic_json(directory / '.vercel/output/config.json', {'version': 3})
        # A private manifest remains outside the deployable output.
        workspace.atomic_json(directory / 'share-manifest.json', {'shares': shared})
        return static

    def deploy(self, file_path=None, project_id=None, page_id=None, version=None, page_versions=None, extra_files=None):
        if not self.settings.get('vercelAutoDeploy', True):
            raise ValueError('自动部署已关闭，文件已保存在本地；开启 Vercel 自动部署后再发布。')
        with _publish_lock:
            config_file = workspace.CONFIG_DIR / 'vercel.json'
            if not config_file.is_file():
                configure_vercel(self.settings.get('staticDomain', ''))
            config = json.loads(config_file.read_text())
            domain = self.settings.get('staticDomain', '')
            if config.get('staticDomain') != domain:
                raise ValueError('分享域名已变化，请重新配置 Vercel 项目后发布。')
            root = workspace.CONFIG_DIR / 'vercel-publish'
            root.mkdir(parents=True, exist_ok=True)
            # Previously shared static pages remain available on each deployment.
            previous = self.root / 'data/published-static'
            share_files = ([Path(file_path)] if file_path else []) if previous.is_dir() else sorted((self.root / 'shares').glob('*-static.html'))
            with tempfile.TemporaryDirectory(prefix='release-', dir=root) as temporary:
                directory = Path(temporary)
                static = self.prepare(directory, share_files)
                workspace.atomic_json(directory / '.vercel/project.json', {k: config[k] for k in ['projectId', 'orgId']})
                node = shutil.which('node')
                if not node:
                    raise ValueError('未找到 Node.js，请安装 Node.js 并在产品安装目录执行 npm ci。')
                command = [node, str(self.app / 'scripts/vercel-cli.mjs')]
                env = {**deployment_environment(), 'NO_COLOR': '1', 'VERCEL_ORG_ID': config['orgId'], 'VERCEL_PROJECT_ID': config['projectId']}
                dependency = subprocess.run([*command, '--prota-check'], env=env,
                                            capture_output=True, text=True, timeout=15)
                if dependency.returncode:
                    raise ValueError('Vercel CLI 依赖缺失或安装不完整，请在产品安装目录执行 npm run vercel:update 后重试。')
                result = subprocess.run([*command, 'deploy', '--prebuilt', '--prod', '--yes', '--cwd', str(directory)],
                                        env=env, capture_output=True, text=True, timeout=300)
                if result.returncode:
                    # CLI output may contain private project details: keep it local.
                    workspace.atomic_json(root / 'last-error.json', {'message': result.stderr[-8000:]})
                    raise RuntimeError('Vercel 部署失败，请检查本机登录和项目权限；本地数据未改变。诊断见本机配置目录 vercel-publish/last-error.json。')
                saved = self.root / 'data/published-static-next'
                if saved.exists():
                    shutil.rmtree(saved)
                shutil.copytree(static, saved)
                old = self.root / 'data/published-static-old'
                if old.exists():
                    shutil.rmtree(old)
                if previous.exists():
                    previous.rename(old)
                saved.rename(previous)
                if old.exists():
                    shutil.rmtree(old)
                url = result.stdout.strip().splitlines()[-1]
                workspace.atomic_json(root / 'last-deployment.json', {'url': url, 'staticDomain': domain, 'shares': len(share_files)})
                return url


# Backwards-compatible import for integrations; this alias never invokes Git.
GitDeployer = VercelDeployer
