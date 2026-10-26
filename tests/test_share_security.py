import hashlib
import json
import tempfile
from pathlib import Path
import unittest
from server.share_security import create_policy, public_policy, save_policy
from tests import test_deployer


class SharePolicyTests(unittest.TestCase):
    def test_options_validate_and_password_is_salted_and_not_exposed(self):
        first = create_policy({'password': 'a strong password', 'expiresInDays': 1})
        second = create_policy({'password': 'a strong password', 'expiresInDays': 1})
        self.assertNotEqual(first['passwordHash'], second['passwordHash'])
        expected = hashlib.scrypt(b'a strong password', salt=bytes.fromhex(first['salt']), n=16384, r=8, p=1, dklen=32).hex()
        self.assertEqual(expected, first['passwordHash'])
        self.assertNotIn('passwordHash', public_policy(first))
        self.assertNotIn('a strong password', json.dumps(first))
        self.assertIsNone(create_policy({'expiresInDays': 0})['expiresAt'])
        self.assertTrue(create_policy({'password': 'a4B9'})['passwordHash'])
        from datetime import datetime, timezone
        default = create_policy()
        days = (default['expiresAt'] / 1000 - datetime.now(timezone.utc).timestamp()) / 86400
        self.assertAlmostEqual(days, 30, places=3)
        import time
        exact_expiry = int(time.time() * 1000) + 86400000
        self.assertEqual(create_policy({'expiresInDays':1,'expiresAt':exact_expiry})['expiresAt'],exact_expiry)
        for options in [{'expiresInDays':0,'expiresAt':exact_expiry}, {'expiresInDays':1,'expiresAt':True}, {'expiresInDays':1,'expiresAt':1}, {'expiresInDays':1,'expiresAt':exact_expiry+86400000}, {'expiresInDays': -1}, {'expiresInDays': True}, {'expiresInDays': '7'}, {'password': 'abc'}, {'password': 123}, {'password': 'x' * 129}]:
            with self.subTest(options=options), self.assertRaises(ValueError):
                create_policy(options)


class ProtectedPublishTests(unittest.TestCase):
    setUp = test_deployer.DirectPublishTests.setUp
    write = test_deployer.DirectPublishTests.write
    def test_gateway_keeps_content_and_secrets_out_of_static_and_grants_only_selected_resources(self):
        policy = create_policy({'password': 'test password', 'expiresInDays': 7})
        save_policy(self.root, self.share.name, policy, 'test password')
        directory = self.base/'release'
        snapshot = self.deployer.prepare(directory, [self.share])
        content = self.deployer.prepare_gateway(directory, snapshot, [self.share])
        self.assertEqual(list((directory/'.vercel/output/static').iterdir()), [])
        self.assertTrue((content/'shares'/self.share.name).is_file())
        manifest = json.loads((content.parent/'access.json').read_text())
        share = manifest['shares'][0]
        self.assertEqual(share['passwordHash'], policy['passwordHash'])
        self.assertNotIn('test password', json.dumps(manifest))
        self.assertFalse((content / 'data/share-passwords.json').exists())
        self.assertEqual((self.root / 'data/share-passwords.json').stat().st_mode & 0o777, 0o600)
        self.assertIn('/src/pages/company/reader/v1/index.html', share['files'])
        self.assertNotIn('/src/pages/company/other/v1/index.html', share['files'])
        self.assertEqual(share['entries'], ['/shares/' + self.share.name, '/' + self.share.name])
        self.assertFalse((content/'.share-access.json').exists())
        self.assertEqual(json.loads((directory/'.vercel/output/config.json').read_text())['routes'], [{'src': '/(.*)', 'dest': '/share'}])

    def test_reshare_same_entry_replaces_password_policy(self):
        import shutil
        first_policy = create_policy({'password': 'old4'})
        save_policy(self.root, self.share.name, first_policy, 'old4')
        first = self.base / 'first'
        content = self.deployer.prepare_gateway(first, self.deployer.prepare(first, [self.share]), [self.share])
        original = json.loads((content.parent / 'access.json').read_text())['shares'][0]
        shutil.copytree(content, self.root / 'data/published-static')
        shutil.copy2(first / 'published-access.json', self.root / 'data/published-static/.share-access.json')
        replacement = create_policy({'password': 'new4'})
        save_policy(self.root, self.share.name, replacement, 'new4')
        second = self.base / 'second'
        content = self.deployer.prepare_gateway(second, self.deployer.prepare(second, [self.share]), [self.share])
        updated = json.loads((content.parent / 'access.json').read_text())['shares'][0]
        self.assertEqual(updated['entries'], original['entries'])
        self.assertEqual(updated['passwordHash'], replacement['passwordHash'])
        self.assertNotEqual(updated['passwordHash'], original['passwordHash'])
        self.assertNotEqual(updated['sessionKey'], original['sessionKey'])

    def test_unselected_share_keeps_last_published_policy_and_resources(self):
        original = create_policy({'password': 'original password', 'expiresInDays': 1})
        save_policy(self.root, self.share.name, original)
        first = self.base/'first'
        content = self.deployer.prepare_gateway(first, self.deployer.prepare(first, [self.share]), [self.share])
        import shutil
        shutil.copytree(content, self.root/'data/published-static')
        shutil.copy2(first/'published-access.json', self.root/'data/published-static/.share-access.json')
        save_policy(self.root, self.share.name, create_policy({'expiresInDays': 0}))
        self.share.write_text('unpublished broken local edit')
        self.write(self.root, 'src/pages/company/reader/v1/index.html', 'unpublished page edit')
        second = self.base/'second'
        content = self.deployer.prepare_gateway(second, self.deployer.prepare(second, []), [])
        manifest = json.loads((content.parent/'access.json').read_text())
        self.assertEqual(manifest['shares'][0]['passwordHash'], original['passwordHash'])
        self.assertNotIn('unpublished', (content/'src/pages/company/reader/v1/index.html').read_text())


class ShareApiTests(unittest.TestCase):
    def invoke(self, folder=False, **changes):
        from contextlib import ExitStack
        from io import BytesIO
        from unittest.mock import patch
        from server import bridge
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        params = {'projectId': 'demo', 'pageId': 'reader', 'version': 'v1', 'folderId': 'folder',
                  'shareType': 'static', 'access': {'expiresInDays': 1, 'password': 'scrypt password'}, **changes}
        body = json.dumps(params).encode()
        handler = object.__new__(bridge.BridgeHandler)
        handler.headers = {'Content-Length': str(len(body)), 'Host': 'localhost:8080'}
        handler.rfile, handler.wfile = BytesIO(body), BytesIO()
        handler.send_response = lambda status: setattr(handler, 'status', status)
        handler.send_header = lambda *args: None
        handler.end_headers = lambda: None
        page = {'id': 'reader', 'name': 'Reader', 'activeVersion': 'v1', 'parentId': 'folder'}
        project = {'id': 'demo', 'folders': [{'id': 'folder', 'name': 'Folder'}], 'pages': [page]}
        with ExitStack() as stack:
            for name, value in {'get_project_root': str(root), 'sync_projects': None,
                                'resolve_share_version_dir': str(root), 'read_project_page': page,
                                'read_project_record': project, 'read_share_prd': {}, 'read_share_drawio': {},
                                'read_share_mindmap': {}, 'read_share_annotations': [], 'list_prd_documents': [],
                                'build_page_zip_bytes': b'fixture zip', 'load_settings': {'staticDomain': 'share.example.com'}}.items():
                stack.enter_context(patch.object(bridge, name, return_value=value))
            deploy = stack.enter_context(patch('server.deployer.VercelDeployer.deploy', return_value='https://share.example.com'))
            (handler.handle_share_folder if folder else handler.handle_share_page)()
        return handler, root, deploy

    def test_page_and_folder_save_only_private_verifiers_and_return_public_policy(self):
        for folder in [False, True]:
            with self.subTest(folder=folder):
                handler, root, deploy = self.invoke(folder=folder)
                self.assertEqual(handler.status, 200, handler.wfile.getvalue())
                deploy.assert_called_once()
                response = json.loads(handler.wfile.getvalue())
                self.assertTrue(response['access']['passwordRequired'])
                self.assertGreater(response['access']['expiresAt'], 0)
                html = (root / response['path']).read_text()
                policies = json.loads((root / 'data/share-access.json').read_text())
                self.assertTrue(policies[Path(response['path']).name]['passwordHash'])
                for content in [html, json.dumps(response), json.dumps(policies)]:
                    self.assertNotIn('scrypt password', content)
                self.assertNotIn('passwordHash', html)
                self.assertNotIn('passwordHash', json.dumps(response))
                self.assertIn('/portal/modules/sharing/dialog.css', html)

    def test_invalid_options_and_unsupported_share_types_cannot_publish(self):
        for changes in [{'access': {'password': 'abc'}}, {'access': 'bad'}, {'shareType': 'local'}, {'shareType': 'public'}]:
            handler, root, deploy = self.invoke(**changes)
            self.assertEqual(handler.status, 400)
            deploy.assert_not_called()
            self.assertFalse((root / 'shares').exists())


if __name__ == '__main__':
    unittest.main()
