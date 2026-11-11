"""Best-effort retention for the configured share project after a verified publish."""
import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

logger = logging.getLogger('readify.deployment_retention')
_cleanup_lock = threading.Lock()


def _pages(api, path, key):
    items, cursors = [], set()
    while True:
        page = api(path)
        items.extend(page[key])
        cursor = page.get('pagination', {}).get('next')
        if cursor is None:
            return items
        if str(cursor) in cursors:
            raise ValueError('Repeated pagination cursor')
        cursors.add(str(cursor))
        path = path.split('&until=')[0] + '&until=' + urllib.parse.quote(str(cursor), safe='')


def _referenced_hosts(root):
    file = Path(root) / 'data/share-management.json'
    data = json.loads(file.read_text()) if file.exists() else {}
    hosts = set()

    def visit(value):
        if isinstance(value, dict):
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
        elif isinstance(value, str) and value.startswith(('https://', 'http://')):
            hosts.add(urllib.parse.urlsplit(value).hostname)

    visit(data)
    return hosts


def _verify_share(domain, root):
    """Check a current entry, including its expected password/expiry response."""
    from server.deployer import deployment_environment
    snapshot = Path(root) / 'data/published-static'
    policies = json.loads((snapshot / '.share-access.json').read_text())
    files = sorted((snapshot / 'shares').glob('*-static.html'))
    if not files:
        return  # An empty publication is valid after withdrawing the last share.
    file = files[0]
    policy = policies[file.name]
    expiry = policy.get('expiresAt')
    expected = 410 if expiry is not None and expiry <= time.time() * 1000 else (401 if policy.get('passwordHash') else 200)
    env = deployment_environment()
    proxies = {p: env[p + '_proxy'] for p in ['http', 'https'] if env.get(p + '_proxy')}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler(proxies))
    request = urllib.request.Request('https://' + domain + '/shares/' + urllib.parse.quote(file.name), method='HEAD')
    try:
        response = opener.open(request, timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        if (response.status != expected or 'text/html' not in response.headers.get('Content-Type', '')
                or response.headers.get('X-Content-Type-Options') != 'nosniff'
                or 'no-store' not in response.headers.get('Cache-Control', '')):
            raise ValueError('Share verification failed')


def cleanup_after_publish(config, deployment_url, root):
    from server.deployer import read_vercel_auth, vercel_api
    project_id, team = config['projectId'], config['orgId']
    token, _ = read_vercel_auth()

    def api(path, method='GET'):
        return vercel_api(path, token, team, method=method, timeout=5)

    project_path = '/v9/projects/' + urllib.parse.quote(project_id, safe='')
    alias_path = '/v4/aliases?projectId=' + urllib.parse.quote(project_id, safe='') + '&limit=100'
    # Some CLI versions end stdout with JSON rather than the deployment URL.
    # In that case resolve the authoritative production target, never trust that last line as an ID.
    published_host = urllib.parse.urlsplit(deployment_url).hostname
    if published_host:
        deployment_key = published_host
    else:
        project = api(project_path)
        if project.get('id') != project_id or project.get('accountId') != team:
            raise ValueError('Configured project ownership changed')
        deployment_key = project['targets']['production']['id']
    deployment = api('/v13/deployments/' + urllib.parse.quote(deployment_key, safe=''))
    current_id = deployment['id']
    created = deployment['createdAt']
    if deployment.get('projectId') != project_id or deployment.get('target') != 'production' or deployment.get('readyState') != 'READY':
        raise ValueError('Published deployment is not ready in the configured project')

    def live_protected():
        project = api(project_path)
        if (project.get('id') != project_id or project.get('accountId') != team
                or project.get('targets', {}).get('production', {}).get('id') != current_id):
            raise ValueError('Production changed; stop cleanup')
        aliases = _pages(api, alias_path, 'aliases')
        if not any(a['alias'] == config['staticDomain'] and a.get('deploymentId') == current_id for a in aliases):
            raise ValueError('Share domain does not point to this publication')
        return {a.get('deploymentId') for a in aliases}

    protected = live_protected()
    _verify_share(config['staticDomain'], root)
    deployments = _pages(api, '/v6/deployments?projectId=' + urllib.parse.quote(project_id, safe='') + '&limit=100', 'deployments')
    # Keep newer publications, previews and in-flight builds; this task owns only older production history.
    older = [d for d in deployments if d['created'] < created and d.get('target') == 'production']
    ready = sorted((d for d in older if d.get('state') == 'READY'), key=lambda d: d['created'], reverse=True)
    protected.update([current_id, *(d['uid'] for d in ready[:2])])
    deleted = []
    for item in older:
        if item.get('state') not in {'READY', 'ERROR', 'CANCELED'} or item['uid'] in protected:
            continue
        if item.get('url') in _referenced_hosts(root):
            continue
        path = '/v13/deployments/' + urllib.parse.quote(item['uid'], safe='')
        detail = api(path)
        # The alias field on deployment details is historical; live aliases above are authoritative.
        if (detail.get('projectId') != project_id or detail.get('target') != 'production'
                or detail.get('readyState') not in {'READY', 'ERROR', 'CANCELED'}):
            continue
        if item['uid'] in live_protected():
            continue
        api(path, method='DELETE')
        deleted.append(item['uid'])
    return deleted


def schedule_cleanup(config, deployment_url, root):
    """Run outside the publishing request; failures never change its success result."""
    if not config.get('staticDomain'):
        return
    config = dict(config)

    def run():
        with _cleanup_lock:
            try:
                deleted = cleanup_after_publish(config, deployment_url, root)
                logger.info('分享历史部署自动清理完成，删除 %d 条。', len(deleted))
            except Exception:
                # Do not log remote responses, credentials, share URLs or policy contents.
                logger.warning('分享历史部署自动清理未完成，将在下次成功发布后重试。')

    worker = threading.Thread(target=run, name='share-deployment-cleanup', daemon=True)
    worker.start()
