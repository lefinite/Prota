import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from server import share_manager
from server.deployer import withdraw_snapshot


class ShareManagerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def write(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def share(self, name='reader-v1-static.html', page='reader', published=False, **extra):
        data = {'projectId': 'demo', 'pageId': page, 'version': 'v1', 'pageName': page, 'shareType': 'static', **extra}
        return self.write(('data/published-static/shares/' if published else 'shares/') + name,
                          '<script>window.__READIFY_SHARE__ = ' + json.dumps(data) + ';</script>')

    def test_copy_returns_published_password_and_never_exposes_it_in_inventory(self):
        from server.share_security import create_policy, save_policy
        from server import workspace
        name = self.share(published=True).name
        self.write('data/settings.json', json.dumps({'staticDomain': 'share.example.com'}))
        published = create_policy({'password': 'a4B9'})
        save_policy(self.root, name, published, 'a4B9')
        workspace.atomic_json(self.root / 'data/published-static/.share-access.json', {name: published})
        # A failed update must not change the password copied for the live link.
        pending = create_policy({'password': 'new5'})
        save_policy(self.root, name, pending, 'new5')
        result = share_manager.manage(self.root, {'action': 'copy', 'ids': [name]})
        self.assertEqual(result['share']['password'], 'a4B9')
        self.assertEqual(result['share']['expiresAt'], published['expiresAt'])
        self.assertNotIn('a4B9', json.dumps(share_manager.inventory(self.root)))
        self.assertNotIn('new5', json.dumps(share_manager.inventory(self.root)))

    def test_copy_omits_credentials_for_open_links_and_explains_legacy_passwords(self):
        name = self.share(published=True).name
        self.write('data/settings.json', json.dumps({'staticDomain': 'share.example.com'}))
        copied = share_manager.manage(self.root, {'action': 'copy', 'ids': [name]})['share']
        self.assertEqual(copied['password'], '')
        self.assertIsNone(copied['expiresAt'])
        self.write('data/published-static/.share-access.json', json.dumps({name: {'passwordHash': 'legacy', 'id': 'old'}}))
        with self.assertRaisesRegex(ValueError, '重新分享'):
            share_manager.manage(self.root, {'action': 'copy', 'ids': [name]})

    def test_inventory_published_bytes_win_failed_updates_and_notes_survive(self):
        self.share(pageName='failed new title')
        self.share(published=True, pageName='published title')
        record = share_manager.inventory(self.root)[0]
        self.assertEqual(record['name'], 'published title')
        self.assertEqual(record['status'], 'active')
        share_manager.manage(self.root, {'action':'annotate', 'ids':[record['id']], 'note':'评审组'})
        self.assertEqual(share_manager.inventory(self.root)[0]['note'], '评审组')

    def test_failed_cloud_revoke_preserves_local_record_and_files(self):
        local = self.share()
        online = self.share(published=True)
        with patch.object(share_manager.VercelDeployer, 'deploy', side_effect=ValueError('network unavailable')):
            with self.assertRaisesRegex(ValueError, 'network'):
                share_manager.manage(self.root, {'action':'revoke','ids':[local.name]})
        self.assertTrue(local.exists())
        self.assertTrue(online.exists())
        self.assertFalse((self.root / 'data/share-management.json').exists())

    def test_local_batch_revoke_persists_history_without_deploy(self):
        files = [self.share(), self.share('second-v1-static.html', page='second')]
        with patch.object(share_manager.VercelDeployer, 'deploy') as deploy:
            result = share_manager.manage(self.root, {'action':'revoke', 'ids':[file.name for file in files]})
            deploy.assert_not_called()
        self.assertTrue(all(item['status']=='revoked' for item in result['items']))
        self.assertTrue(all(not file.exists() for file in files))
        self.share()
        self.assertEqual(share_manager.inventory(self.root)[0]['status'], 'local')

    def test_invalid_ids_cannot_escape_workspace(self):
        with self.assertRaises(ValueError):
            share_manager.manage(self.root, {'action':'revoke','ids':['../secret']})

    def test_snapshot_removes_aliases_zips_and_orphan_pages_but_keeps_other_share(self):
        removed = self.share(published=True, zipFilename='reader.zip')
        self.share('folder-static.html', published=True, mode='folder', pages=[{'id':'other','version':'v1'}])
        static = self.root / 'data/published-static'
        for relative in ['reader-v1-static.html','reader.zip','shares/reader.zip','src/pages/demo/reader/v1/index.html','src/pages/demo/reader/docs/prd.md','src/pages/demo/other/v1/index.html']:
            self.write('data/published-static/'+relative,'published bytes')
        withdraw_snapshot(static, [removed.name])
        for relative in ['shares/reader-v1-static.html','reader-v1-static.html','reader.zip','shares/reader.zip','src/pages/demo/reader/v1','src/pages/demo/reader/docs']:
            self.assertFalse((static/relative).exists(), relative)
        self.assertTrue((static/'src/pages/demo/other/v1/index.html').exists())
        self.assertTrue((static/'shares/folder-static.html').exists())

    def test_shared_page_is_preserved_for_remaining_folder(self):
        removed = self.share(published=True)
        self.share('folder-static.html', published=True, mode='folder', pages=[{'id':'reader','version':'v1'}])
        page = self.write('data/published-static/src/pages/demo/reader/v1/index.html', 'shared')
        withdraw_snapshot(self.root/'data/published-static', [removed.name])
        self.assertEqual(page.read_text(), 'shared')

    def test_expiration_and_password_use_published_policy_not_failed_pending_change(self):
        self.share(published=True)
        self.write('data/published-static/.share-access.json', json.dumps({'reader-v1-static.html': {'expiresAt': 1, 'passwordHash':'hash'}}))
        self.write('data/share-access.json', json.dumps({'reader-v1-static.html': {'expiresAt': None}}))
        record = share_manager.inventory(self.root)[0]
        self.assertEqual(record['status'], 'expired')
        self.assertTrue(record['passwordRequired'])
        self.assertNotIn('passwordHash', record)

    def test_management_api_rejects_cross_origin_and_remote_host(self):
        import http.server
        import threading
        import urllib.request
        import urllib.error
        from server import bridge
        server = http.server.HTTPServer(('127.0.0.1', 0), bridge.BridgeHandler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            with patch.object(bridge.workspace, 'bridge_locked', return_value=False), patch.object(bridge.workspace, 'workspace_root', return_value=self.root), patch.object(bridge, 'get_project_root', return_value=str(self.root)):
                base = 'http://127.0.0.1:' + str(server.server_port)
                with urllib.request.urlopen(base + '/api/shares') as response:
                    self.assertEqual(json.load(response), {'items': []})
                for headers in [{'Origin': 'https://external.example'}, {'Host': 'external.example'}]:
                    request = urllib.request.Request(base + '/api/shares/manage', data=b'{}', headers={'Content-Type':'application/json', **headers})
                    with self.assertRaises(urllib.error.HTTPError) as error:
                        urllib.request.urlopen(request)
                    self.assertEqual(error.exception.code, 403)
                    error.exception.close()
        finally:
            server.shutdown()
            server.server_close()
            worker.join()

    def test_full_revoke_redeploy_excludes_old_link_from_gateway_and_keeps_other_share(self):
        from server.deployer import VercelDeployer
        from types import SimpleNamespace
        local = self.share()
        self.share(published=True)
        self.share('other-v1-static.html', page='other', published=True)
        self.write('data/published-static/src/pages/demo/reader/v1/index.html', 'revoked page')
        self.write('data/published-static/src/pages/demo/other/v1/index.html', 'keep page')
        app = self.root / 'application'
        self.write('application/portal/shell.js', '/* __READIFY_DATA_START__ */{}/* __READIFY_DATA_END__ */')
        self.write('application/portal/index.html', 'portal')
        config = self.root / 'config'
        self.write('config/vercel.json', json.dumps({'projectId':'fixture', 'orgId':'fixture', 'staticDomain':''}))
        def run(command, **kwargs):
            if command[-1] != '--prota-check':
                output = Path(command[-1]) / '.vercel/output/functions/share.func'
                self.assertFalse((output / 'content/shares' / local.name).exists())
                self.assertTrue((output / 'content/shares/other-v1-static.html').is_file())
                grants = json.loads((output / 'access.json').read_text())['shares']
                self.assertEqual(len(grants), 1)
                self.assertEqual(grants[0]['entries'][0], '/shares/other-v1-static.html')
            return SimpleNamespace(returncode=0, stdout='https://fixture.vercel.app', stderr='')
        with patch('server.deployer.workspace.CONFIG_DIR', config), patch('server.deployer.subprocess.run', side_effect=run), patch('server.deployer.shutil.which', return_value='/fixture/node'), patch.object(share_manager, 'VercelDeployer', side_effect=lambda root: VercelDeployer(root, app)):
            result = share_manager.manage(self.root, {'action':'revoke', 'ids':[local.name]})
        records = {item['id']:item for item in result['items']}
        self.assertEqual(records[local.name]['status'], 'revoked')
        self.assertEqual(records['other-v1-static.html']['status'], 'active')
        self.assertFalse(local.exists())

if __name__ == '__main__':
    unittest.main()
