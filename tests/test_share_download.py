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

    def create_share(self, folder=False, expected_status=200, share_type='static'):
        project = {'id': 'company', 'name': 'Company', 'folders': [{'id': 'group'}], 'pages': [
            {'id': page, 'versions': ['v1'], 'activeVersion': 'v1', 'parentId': 'group'}
            for page in ['reader', 'other']]}
        self.write(self.root, 'data/projects.json', json.dumps({'projects': [project]}))
        self.write(self.root, 'src/pages/company/reader/docs/spec.md', '# Specification')
        params = {'projectId': 'company', 'shareType': share_type}
        if share_type == 'static':
            params['access'] = {'expiresInDays': 0}
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
                name = payload['zipFilename']
                with zipfile.ZipFile(snapshot / 'shares' / name) as archive:
                    if folder:
                        self.assertIn('未命名文件夹/reader/v1/index.html', archive.namelist())
                        self.assertIn('未命名文件夹/other/v1/index.html', archive.namelist())
                        self.assertIn('未命名文件夹/reader/docs/spec.md', archive.namelist())
                        self.assertTrue(all('zipFilename' not in page for page in pages))
                    else:
                        self.assertIn('v1/index.html', archive.namelist())
                        self.assertIn('docs/spec.md', archive.namelist())
                content = self.deployer.prepare_gateway(release, snapshot, [share])
                manifest = json.loads((content.parent / 'access.json').read_text())
                grant = next(item for item in manifest['shares'] if '/shares/' + share.name in item['entries'])
                self.assertIn('/shares/' + name, grant['files'])
                self.assertTrue((content / 'shares' / name).is_file())
                withdraw_snapshot(content, [share.name])
                self.assertFalse((content / 'shares' / name).exists())

    def test_local_and_public_folder_shares_include_complete_archives(self):
        for share_type in ['local', 'public']:
            with self.subTest(share_type=share_type):
                payload = share_payload(self.create_share(folder=True, share_type=share_type))
                with zipfile.ZipFile(self.root / 'shares' / payload['zipFilename']) as archive:
                    self.assertIn('未命名文件夹/reader/v1/index.html', archive.namelist())
                    self.assertIn('未命名文件夹/other/v1/index.html', archive.namelist())

    def test_folder_archive_preserves_nested_pages_and_selected_versions(self):
        from server.bridge import build_folder_zip_bytes
        self.write(self.root, 'src/pages/company/other/v2/index.html', 'selected v2')
        self.write(self.root, 'src/pages/company/reader/docs/spec.md', '# Spec')
        self.write(self.root, 'src/pages/company/reader/v1/boards/board/index.html', 'board')
        payload = {'projectId': 'company', 'folderId': 'group', 'folders': [
            {'id': 'group', 'name': '设计'},
            {'id': 'nested', 'name': '子目录', 'parentId': 'group'},
            {'id': 'empty', 'name': '空目录', 'parentId': 'group'}], 'pages': [
            {'id': 'reader', 'version': 'v1', 'parentId': 'group'},
            {'id': 'other', 'version': 'v2', 'parentId': 'nested'}]}
        with zipfile.ZipFile(io.BytesIO(build_folder_zip_bytes(self.root, payload))) as archive:
            self.assertIn('设计/reader/docs/spec.md', archive.namelist())
            self.assertIn('设计/reader/v1/boards/board/index.html', archive.namelist())
            self.assertIn('设计/空目录-empty/', archive.namelist())
            self.assertEqual(archive.read('设计/子目录-nested/other/v2/index.html'), b'selected v2')
            self.assertFalse(any('/other/v1/' in path for path in archive.namelist()))

    def test_zip_failure_does_not_publish_an_unusable_share(self):
        with patch('server.bridge.build_page_zip_bytes', side_effect=OSError('disk full')):
            self.assertIn('disk full', self.create_share(expected_status=500))
        self.assertNotIn('zipFilename', share_payload(self.share))


if __name__ == '__main__':
    unittest.main()
