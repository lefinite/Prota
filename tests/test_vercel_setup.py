import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from server import vercel_setup as setup


class VercelSetupTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name).resolve()
        self.config = self.base/'config'; self.config.mkdir()
        self.root = self.base/'workspace'; (self.root/'data').mkdir(parents=True)
        self.settings = self.root/'data/settings.json'
        self.settings.write_text(json.dumps({'staticDomain':'share.example.com', 'vercelAutoDeploy':True, 'untouched':'retained'}))
        self.existing = {'projectId':'fixture-project', 'orgId':'fixture-team', 'projectName':'sample-share', 'staticDomain':'share.example.com'}
        self.project = {'id':'fixture-project', 'accountId':'fixture-team', 'name':'sample-share'}
        self.cancelled = threading.Event()
        setup._job = {'id':'fixture-job', 'state':'running'}
        self.addCleanup(setattr, setup, '_job', None)
        self.addCleanup(setattr, setup, '_process', None)
        for target, value in [('CONFIG_DIR',self.config),('workspace_root',lambda:self.root),('bridge_locked',lambda:False)]:
            manager=patch.object(setup.workspace,target,value);manager.start();self.addCleanup(manager.stop)
        self._authenticate_original = setup.authenticate
        manager=patch.object(setup,'authenticate',return_value=('fixture-auth','fixture-team'));manager.start();self.addCleanup(manager.stop)

    def save_existing(self):
        (self.config/'vercel.json').write_text(json.dumps(self.existing))

    def test_existing_project_reuses_original_domain_without_deployment_or_permission_changes(self):
        self.save_existing()
        def api(endpoint,*args,**kwargs):
            self.assertNotIn('method',kwargs)
            if endpoint.endswith('/config'): return {'misconfigured': False}
            return {'domains':[{'name':'share.example.com','verified':True}]} if '/domains' in endpoint else self.project
        with patch.object(setup,'vercel_api',side_effect=api) as remote, patch.object(setup,'cli') as cli:
            setup.run('share.example.com',self.cancelled)
        cli.assert_not_called();self.assertEqual(remote.call_count,3)
        self.assertEqual(setup.status()['state'],'ready')
        self.assertEqual(json.loads(self.settings.read_text())['untouched'],'retained')
        self.assertEqual(json.loads((self.config/'vercel.json').read_text()),self.existing)

    def test_switching_from_custom_domain_to_vercel_uses_same_project(self):
        self.save_existing()
        def api(endpoint, *args, **kwargs):
            self.assertNotIn('method', kwargs)
            if '/domains?' in endpoint:
                return {'domains': [{'name': 'share.example.com', 'verified': True}, {'name': 'sample-share.vercel.app', 'verified': True}]}
            return self.project
        with patch.object(setup, 'vercel_api', side_effect=api), patch.object(setup, 'cli') as cli:
            setup.run('', self.cancelled)
        cli.assert_not_called()
        self.assertEqual(setup.status()['state'], 'ready')
        config = json.loads((self.config/'vercel.json').read_text())
        self.assertEqual(config['projectId'], self.existing['projectId'])
        self.assertEqual(config['staticDomain'], 'sample-share.vercel.app')
        self.assertEqual(json.loads(self.settings.read_text())['shareMode'], 'vercel')

    def test_inaccessible_old_project_is_not_replaced(self):
        self.save_existing();before=self.settings.read_bytes()
        with patch.object(setup,'vercel_api',side_effect=ValueError('没有权限')) as remote:
            setup.run('',self.cancelled)
        self.assertEqual(remote.call_count,1);self.assertEqual(setup.status()['state'],'error')
        self.assertEqual(self.settings.read_bytes(),before)

    def test_new_project_is_created_without_git_and_only_blank_output_is_deployed(self):
        calls=[]
        def api(endpoint,*args,**kwargs):
            calls.append((endpoint,kwargs))
            if '/domains' in endpoint:return {'domains':[{'name':'actual-assigned.vercel.app','verified':True}]}
            return self.project
        def cli(args,**kwargs):
            directory=Path(args[-1]);files=list((directory/'.vercel/output/static').rglob('*'))
            self.assertEqual([file.name for file in files],['index.html'])
            self.assertNotIn('untouched',files[0].read_text())
            return 'https://deployment.example.com'
        with patch.object(setup,'vercel_api',side_effect=api),patch.object(setup,'cli',side_effect=cli):
            setup.run('',self.cancelled)
        self.assertEqual(calls[0][0],'/v9/projects')
        self.assertNotIn('gitRepository',calls[0][1]['data'])
        self.assertEqual(setup.status()['state'],'ready')
        self.assertEqual(json.loads(self.settings.read_text())['staticDomain'],'actual-assigned.vercel.app')

    def test_retry_reuses_pending_project_after_failed_bootstrap(self):
        def api(endpoint,*args,**kwargs):return self.project
        with patch.object(setup,'vercel_api',side_effect=api),patch.object(setup,'cli',side_effect=ValueError('network')):
            setup.run('',self.cancelled)
        self.assertTrue((self.config/'vercel-pending-project.json').exists())
        self.assertFalse((self.config/'vercel.json').exists())
        with patch.object(setup,'vercel_api',side_effect=api) as remote,patch.object(setup,'cli',side_effect=ValueError('network')):
            setup.run('',self.cancelled)
        self.assertTrue(all(call.kwargs.get('method') != 'POST' for call in remote.call_args_list))

    def test_dns_required_does_not_replace_existing_working_config(self):
        self.save_existing();before=self.settings.read_bytes()
        def api(endpoint,*args,**kwargs):
            if endpoint.endswith('/config'):return {'misconfigured':True,'recommendedCNAME':[{'value':'target.example.com'}]}
            if kwargs.get('method')=='POST':return {'name':'new.example.com','verified':False,'verification':[{'type':'TXT','value':'sample'}]}
            if '/domains?' in endpoint:return {'domains':[{'name':'share.example.com','verified':True}]}
            return self.project
        with patch.object(setup,'vercel_api',side_effect=api):setup.run('new.example.com',self.cancelled)
        self.assertEqual(setup.status()['state'],'dns_required');self.assertEqual(self.settings.read_bytes(),before)
        self.assertEqual(json.loads((self.config/'vercel.json').read_text()),self.existing)

    def test_workspace_change_and_cancellation_prevent_configuration_commit(self):
        before=self.settings.read_bytes()
        with self.assertRaisesRegex(ValueError,'切换'):setup.commit_connection(self.existing,self.cancelled,self.base/'other')
        self.cancelled.set()
        with self.assertRaisesRegex(ValueError,'取消'):setup.commit_connection(self.existing,self.cancelled)
        self.assertEqual(self.settings.read_bytes(),before);self.assertFalse((self.config/'vercel.json').exists())

    def test_domain_validation_rejects_paths_and_cancel_does_not_relabel_ready(self):
        with self.assertRaisesRegex(ValueError,'域名'):setup.start('share.example.com/private')
        setup._job={'state':'ready','message':'ready'}
        self.assertEqual(setup.cancel()['state'],'ready')

    def test_inspection_restores_authorization_and_effective_address_after_restart(self):
        self.save_existing()
        setup._job = None
        before = self.settings.read_bytes()
        def api(endpoint, *args, **kwargs):
            self.assertNotIn('method', kwargs)
            if endpoint == '/v2/user': return {'user': {'username': 'sample-user'}}
            if '/domains?' in endpoint: return {'domains': [{'name': 'share.example.com', 'verified': True}]}
            if endpoint.endswith('/config'): return {'misconfigured': False}
            return self.project
        with patch.object(setup, 'read_vercel_auth', return_value=('fixture-auth', 'fixture-team')), patch.object(setup, 'vercel_api', side_effect=api):
            result = setup.inspect_connection()
        self.assertEqual(result['authState'], 'authorized')
        self.assertEqual(result['publishState'], 'ready')
        self.assertEqual(result['account'], 'sample-user')
        self.assertEqual(result['domain'], 'share.example.com')
        self.assertEqual(self.settings.read_bytes(), before)
        self.assertNotIn('fixture-auth', json.dumps(result))

    def test_inspection_refreshes_existing_cli_login_before_requesting_authorization(self):
        self.save_existing()
        calls = 0
        def api(endpoint, *args, **kwargs):
            nonlocal calls
            if endpoint == '/v2/user':
                calls += 1
                if calls == 1:
                    raise ValueError('Vercel 登录已失效')
                return {'user': {'username': 'restored-user'}}
            if '/domains?' in endpoint:
                return {'domains': [{'name': 'share.example.com', 'verified': True}]}
            if endpoint.endswith('/config'):
                return {'misconfigured': False}
            return self.project
        with patch.object(setup, 'read_vercel_auth', return_value=('fixture-auth', 'fixture-team')), patch.object(setup, 'vercel_api', side_effect=api), patch.object(setup, 'cli') as cli, patch.object(setup.webbrowser, 'open') as browser:
            result = setup.inspect_connection()
        cli.assert_called_once_with(['whoami'], timeout=30)
        browser.assert_not_called()
        self.assertEqual(result['authState'], 'authorized')
        self.assertEqual(result['publishState'], 'ready')

    def test_project_permissions_do_not_trigger_new_login(self):
        # Exercise the real authentication function rather than the setup fixture.
        authenticate = self._authenticate_original
        with patch.object(setup, 'read_vercel_auth', return_value=('fixture-auth', 'fixture-team')), patch.object(setup, 'vercel_api', side_effect=ValueError('当前 Vercel 账号没有访问权限')), patch.object(setup, 'cli') as cli, patch.object(setup.webbrowser, 'open') as browser:
            with self.assertRaisesRegex(ValueError, '没有访问权限'):
                authenticate(self.cancelled)
        cli.assert_not_called()
        browser.assert_not_called()

    def test_saved_project_does_not_imply_authorization(self):
        self.save_existing()
        with patch.object(setup, 'read_vercel_auth', side_effect=ValueError('not logged in')), patch.object(setup, 'vercel_api') as remote:
            result = setup.inspect_connection()
        self.assertEqual(result['authState'], 'unauthorized')
        self.assertNotEqual(result['publishState'], 'ready')
        remote.assert_not_called()

    def test_inspection_distinguishes_expired_authorization_from_network_failure(self):
        self.save_existing()
        with patch.object(setup, 'read_vercel_auth', return_value=('fixture-auth', 'fixture-team')):
            with patch.object(setup, 'vercel_api', side_effect=ValueError('Vercel 登录已失效或没有项目权限')), patch.object(setup, 'cli', side_effect=ValueError('expired')):
                self.assertEqual(setup.inspect_connection()['authState'], 'expired')
            with patch.object(setup, 'vercel_api', side_effect=OSError('offline')):
                result = setup.inspect_connection()
                self.assertEqual(result['authState'], 'unknown')
                self.assertEqual(result['publishState'], 'unknown')

    def test_authorized_account_can_still_need_dns_or_workspace_configuration(self):
        self.save_existing()
        def api(endpoint, *args, **kwargs):
            if endpoint == '/v2/user': return {'user': {'username': 'sample-user'}}
            if '/domains?' in endpoint: return {'domains': [{'name': 'share.example.com', 'verified': True}]}
            if endpoint.endswith('/config'): return {'misconfigured': True}
            return self.project
        with patch.object(setup, 'read_vercel_auth', return_value=('fixture-auth', 'fixture-team')), patch.object(setup, 'vercel_api', side_effect=api):
            result = setup.inspect_connection()
            self.assertEqual(result['authState'], 'authorized')
            self.assertEqual(result['publishState'], 'dns_required')
            self.settings.write_text(json.dumps({'staticDomain': 'different.example.com'}))
            self.assertEqual(setup.inspect_connection()['publishState'], 'unconfigured')

if __name__=='__main__':unittest.main()
