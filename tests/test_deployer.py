import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from server.deployer import VercelDeployer, share_payload


class DirectPublishTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name).resolve()
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

    def test_canvas_nested_boards_layout_and_assets_are_portable(self):
        import io
        import zipfile
        from server.bridge import build_page_zip_bytes
        prefix = 'src/pages/company/reader/v1/'
        for name in ['canvas-data.js', 'boards/reader/index.html', 'boards/reader/styles.css', 'boards/reader/app.js', 'assets/reference.png']:
            self.write(self.root, prefix + name, 'canvas fixture')
        static = self.deployer.prepare(self.base/'release', [self.share])
        for name in ['canvas-data.js', 'boards/reader/index.html', 'assets/reference.png']:
            self.assertEqual((static/prefix/name).read_text(), 'canvas fixture')
        archive = zipfile.ZipFile(io.BytesIO(build_page_zip_bytes(self.root, 'company', 'reader', 'v1')))
        self.assertIn('v1/canvas-data.js', archive.namelist())
        self.assertIn('v1/boards/reader/index.html', archive.namelist())

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

    def configure_publish(self):
        config = self.base / 'config'
        self.write(config, 'vercel.json', json.dumps({'projectId':'fixture-project', 'orgId':'fixture-team', 'staticDomain':''}))
        return config

    def test_deploy_uses_product_wrapper_and_isolated_output_preserving_links(self):
        config = self.configure_publish()
        seen = []
        def run(command, **kwargs):
            seen.append(command)
            self.assertEqual(command[:2], ['/fixture/node', str(self.app/'scripts/vercel-cli.mjs')])
            if command[-1] == '--prota-check':
                return SimpleNamespace(returncode=0, stdout='', stderr='')
            self.assertEqual(command[2:7], ['deploy', '--prebuilt', '--prod', '--yes', '--cwd'])
            directory = Path(command[-1])
            self.assertTrue(directory.is_relative_to(config/'vercel-publish'))
            self.assertFalse((directory/'.vercel/output/static/data/projects.json').exists())
            self.assertFalse((directory/'.vercel/output/static/shares/reader-v1-static.html').exists())
            self.assertTrue((directory/'.vercel/output/functions/share.func/content/shares/reader-v1-static.html').is_file())
            return SimpleNamespace(returncode=0, stdout='https://share.example.com\n', stderr='')
        with patch('server.deployer.workspace.CONFIG_DIR', config), patch('server.deployer.shutil.which', return_value='/fixture/node') as which, patch('server.deployer.subprocess.run', side_effect=run):
            self.assertEqual(self.deployer.deploy(self.share), 'https://share.example.com')
            which.assert_called_once_with('node')
        self.assertEqual(len(seen), 2)
        self.assertTrue((self.root/'data/published-static/reader-v1-static.html').is_file())
        self.assertTrue((self.root/'data/published-static/shares/reader-v1-static.html').is_file())

    def test_missing_cli_stops_before_upload_and_preserves_previous_snapshot(self):
        config = self.configure_publish()
        snapshot = self.write(self.root, 'data/published-static/old.html', 'previous public bytes')
        with patch('server.deployer.workspace.CONFIG_DIR', config), patch('server.deployer.shutil.which', return_value='/fixture/node'), patch('server.deployer.subprocess.run', return_value=SimpleNamespace(returncode=1, stdout='', stderr='missing dependency')) as command:
            with self.assertRaisesRegex(ValueError, '双击 Prota'):
                self.deployer.deploy(self.share)
            command.assert_called_once()
            self.assertEqual(command.call_args.args[0][-1], '--prota-check')
        self.assertEqual(snapshot.read_text(), 'previous public bytes')

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
