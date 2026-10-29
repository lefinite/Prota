import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import zipfile

from server.bridge import BridgeHandler
from server.deployer import share_payload, withdraw_snapshot
from tests import test_deployer


class ShareDownloadTests(unittest.TestCase):
    setUp = test_deployer.DirectPublishTests.setUp
    write = test_deployer.DirectPublishTests.write

    def create_share(self, folder=False, expected_status=200):
        project = {'id': 'company', 'name': 'Company', 'folders': [{'id': 'group'}], 'pages': [
            {'id': page, 'versions': ['v1'], 'activeVersion': 'v1', 'parentId': 'group'}
            for page in ['reader', 'other']]}
        self.write(self.root, 'data/projects.json', json.dumps({'projects': [project]}))
        self.write(self.root, 'src/pages/company/reader/docs/spec.md', '# Specification')
        params = {'projectId': 'company', 'shareType': 'static', 'access': {'expiresInDays': 0}}
        params.update({'folderId': 'group'} if folder else {'pageId': 'reader', 'version': 'v1'})
        body = json.dumps(params).encode()
        handler = object.__new__(BridgeHandler)
        handler.headers = {'Content-Length': str(len(body))}
        handler.rfile, handler.wfile = io.BytesIO(body), io.BytesIO()
        handler.send_response = lambda status: setattr(handler, 'status', status)
        handler.send_header = lambda *args: None
        handler.end_headers = lambda: None
        with patch('server.bridge.get_project_root', return_value=str(self.root)), \
             patch('server.bridge.sync_projects'), \
             patch('server.bridge.load_settings', return_value={'staticDomain': 'share.example.com'}), \
             patch('server.deployer.VercelDeployer.deploy'):
            getattr(handler, 'handle_share_folder' if folder else 'handle_share_page')()
        result = handler.wfile.getvalue().decode()
        self.assertEqual(handler.status, expected_status, result)
        if expected_status != 200:
            return result
        return self.root / json.loads(result)['path']

    def test_page_and_folder_downloads_are_published_and_authorized(self):
        for folder in [False, True]:
            with self.subTest(folder=folder):
                share = self.create_share(folder)
                payload = share_payload(share)
                pages = payload['pages'] if folder else [payload]
                release = self.base / ('folder' if folder else 'page')
                snapshot = self.deployer.prepare(release, [share])
                for page in pages:
                    name = page['zipFilename']
                    with zipfile.ZipFile(snapshot / 'shares' / name) as archive:
                        self.assertIn('v1/index.html', archive.namelist())
                        if (page.get('id') or page.get('pageId')) == 'reader':
                            self.assertIn('docs/spec.md', archive.namelist())
                content = self.deployer.prepare_gateway(release, snapshot, [share])
                manifest = json.loads((content.parent / 'access.json').read_text())
                grant = next(item for item in manifest['shares'] if '/shares/' + share.name in item['entries'])
                for page in pages:
                    self.assertIn('/shares/' + page['zipFilename'], grant['files'])
                    self.assertTrue((content / 'shares' / page['zipFilename']).is_file())
                withdraw_snapshot(content, [share.name])
                for page in pages:
                    self.assertFalse((content / 'shares' / page['zipFilename']).exists())

    def test_zip_failure_does_not_publish_an_unusable_share(self):
        with patch('server.bridge.build_page_zip_bytes', side_effect=OSError('disk full')):
            self.assertIn('disk full', self.create_share(expected_status=500))
        self.assertNotIn('zipFilename', share_payload(self.share))


if __name__ == '__main__':
    unittest.main()
