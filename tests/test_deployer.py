import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from server.deployer import VercelDeployer, share_payload


class DirectPublishTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.app, self.root = self.base/'app', self.base/'workspace'
        self.write(self.app, 'portal/shell.js', 'return /* __READIFY_DATA_START__ */{"secret":"private index"} /* __READIFY_DATA_END__ */;')
        self.write(self.app, 'portal/index.html', '<html></html>')
        self.write(self.root, 'data/settings.json', '{}')
        self.write(self.root, 'data/projects.json', '{"company":"private"}')
        self.write(self.root, 'data/agent-sessions/session.json', 'private conversation')
        self.write(self.root, '.env', 'TOKEN=private')
        self.write(self.root, 'src/pages/company/reader/v1/index.html', '<img src="/assets/cover.svg"><script src="/src/templates/frame/app.js"></script>')
        self.write(self.root, 'src/pages/company/other/v1/index.html', 'unshared project')
        self.write(self.root, 'assets/cover.svg', '<svg/>')
        self.write(self.root, 'assets/unshared.svg', 'private')
        self.write(self.app, 'src/templates/frame/app.js', 'console.log(1)')
        self.share = self.write(self.root, 'shares/reader-v1-static.html', '<script>window.__READIFY_SHARE__ = ' + json.dumps({'projectId':'company','pageId':'reader','version':'v1'}) + ';</script>')
        self.deployer = VercelDeployer(self.root, self.app)

    def write(self, root, relative, text):
        file = root/relative
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text)
        return file

    def test_only_shared_pages_and_required_resources_are_published_with_both_url_layouts(self):
        static = self.deployer.prepare(self.base/'release', [self.share])
        self.assertTrue((static/'shares/reader-v1-static.html').is_file())
        self.assertTrue((static/'reader-v1-static.html').is_file())
        self.assertTrue((static/'assets/cover.svg').is_file())
        self.assertTrue((static/'src/templates/frame/app.js').is_file())
        for private in ['data/projects.json','data/agent-sessions/session.json','.env','src/pages/company/other','assets/unshared.svg']:
            self.assertFalse((static/private).exists(), private)
        self.assertNotIn('private index',(static/'portal/shell.js').read_text())

    def test_existing_public_snapshot_survives_without_publishing_new_edits_to_old_pages(self):
        self.write(self.root, 'data/published-static/src/pages/company/old/v1/index.html', 'previously published')
        self.write(self.root, 'src/pages/company/old/v1/index.html', 'new unshared changes')
        static = self.deployer.prepare(self.base/'release', [self.share])
        self.assertEqual((static/'src/pages/company/old/v1/index.html').read_text(),'previously published')

    def test_symlink_and_cross_page_document_are_rejected(self):
        (self.root/'src/pages/company/reader/v1/link').symlink_to(self.root/'.env')
        with self.assertRaisesRegex(ValueError,'符号链接'):
            self.deployer.prepare(self.base/'release', [self.share])
        (self.root/'src/pages/company/reader/v1/link').unlink()
        self.share.write_text('<script>window.__READIFY_SHARE__ = '+json.dumps({'projectId':'company','pageId':'reader','version':'v1','documents':[{'path':'src/pages/company/other/v1/index.html'}]})+';</script>')
        with self.assertRaisesRegex(ValueError,'不属于'):
            self.deployer.prepare(self.base/'release2', [self.share])

    def test_disabled_deployment_cannot_report_success_or_invoke_git(self):
        self.deployer.settings['vercelAutoDeploy'] = False
        with patch('server.deployer.subprocess.run') as command:
            with self.assertRaisesRegex(ValueError,'自动部署已关闭'):
                self.deployer.deploy(self.share)
            command.assert_not_called()

    def test_download_archive_omits_hidden_credentials_and_rejects_symlinks(self):
        import io
        import zipfile
        from server.bridge import build_page_zip_bytes
        self.write(self.root, 'src/pages/company/reader/v1/.env', 'private hidden fixture')
        self.write(self.root, 'src/pages/company/reader/docs/product.md', '# document')
        content = build_page_zip_bytes(str(self.root), 'company', 'reader', 'v1')
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            self.assertIn('v1/index.html', archive.namelist())
            self.assertIn('docs/product.md', archive.namelist())
            self.assertNotIn('v1/.env', archive.namelist())
        (self.root/'src/pages/company/reader/v1/external').symlink_to(self.root/'.env')
        with self.assertRaisesRegex(ValueError, '符号链接'):
            build_page_zip_bytes(str(self.root), 'company', 'reader', 'v1')

    def test_html_escaped_payload_is_read(self):
        self.share.write_text('<script>window.__READIFY_SHARE__ = {"prdContent":"<\\/script>"};</script>')
        self.assertEqual(share_payload(self.share)['prdContent'],'</script>')

if __name__ == '__main__':
    unittest.main()
