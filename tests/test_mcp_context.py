import base64
import hashlib
import json
import secrets
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from server.deployer import VercelDeployer, share_payload, withdraw_snapshot
from server.mcp_context import build_context
from server.share_security import create_policy, save_policy
from server import workspace
from server.share_manager import manage, inventory

APP = Path(__file__).resolve().parents[1]


class ContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'workspace'
        self.write('data/settings.json', json.dumps({'staticDomain': 'share.example.com'}))
        self.write('src/pages/demo/reader/v1/index.html', '<meta charset="utf-8"><h1>旧版中文</h1><link href="styles.css" rel="stylesheet"><img src="/assets/photo.png"><script src="https://cdn.example.com/external.js"></script>')
        self.write('src/pages/demo/reader/v1/styles.css', 'body{color:red}')
        self.write('src/pages/demo/reader/v2/index.html', 'NEVER PUBLISH V2')
        self.write('assets/photo.png', 'image bytes')
        self.write('src/pages/demo/reader/docs/v1.md', 'v1 需求')
        self.write('src/pages/demo/reader/docs/v2.md', 'v2 secret')
        self.payload = {'projectId':'demo','pageId':'reader','version':'v1','shareType':'static','prdContent':'v2 secret',
                        'prdPath':'/src/pages/demo/reader/docs/v2.md', 'documents':[
                            {'path':'/src/pages/demo/reader/docs/v1.md','prototypeVersion':'v1'},
                            {'path':'/src/pages/demo/reader/docs/v2.md','prototypeVersion':'v2'}]}
        self.deployer = VercelDeployer(self.root)
        self.token = secrets.token_urlsafe(32)
        self.name = 'reader-v1-static.html'
        self.share = self.make_share(self.name, self.payload, self.token)

    def write(self, path, text):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text)
        return file

    def make_share(self, name, payload, token):
        file = self.write('shares/' + name, '<script>window.__READIFY_SHARE__ = ' + json.dumps(payload) + ';</script>')
        save_policy(self.root,name,create_policy({'expiresInDays':0},token),mcp_token=token)
        return file

    def prepare(self, label='release', files=None):
        directory = self.base / label
        static = self.deployer.prepare(directory, files or [self.share])
        manifest = json.loads((static/'.mcp'/self.name/'manifest.json').read_text())
        return directory, static, manifest

    def test_scope_prd_utf8_and_external_dependencies(self):
        _,static,m = self.prepare()
        paths = [r['relativePath'] for r in m['resources'].values()]
        self.assertIn('src/pages/demo/reader/docs/v1.md',paths)
        self.assertNotIn('src/pages/demo/reader/docs/v2.md',paths)
        self.assertFalse(any('/v2/' in path for path in paths))
        self.assertEqual(m['pages'][0]['version'],'v1')
        self.assertEqual(m['externalDependencies'],['https://cdn.example.com/external.js'])
        self.assertFalse(m['pages'][0]['visualAvailable'])
        self.assertNotIn(self.token,json.dumps(m))
        for r in m['resources'].values():
            root = static if r['source']=='content' else static/'.mcp'
            self.assertEqual(hashlib.sha256((root/r['relativePath']).read_bytes()).hexdigest(),r['sha256'])

    def test_missing_and_cross_version_dependencies_fail_before_publish(self):
        self.write('src/pages/demo/reader/v1/styles.css','body{background:url(missing.png)}')
        with self.assertRaisesRegex(ValueError,'缺失'): self.prepare()
        self.write('src/pages/demo/reader/v1/styles.css','@import "../v2/index.html";')
        # CSS @import is covered by dependency collection too.
        self.write('src/pages/demo/reader/v1/index.html','<iframe src="../v2/index.html"></iframe>')
        with self.assertRaisesRegex(ValueError,'超出'): self.prepare('other')

    def test_large_resource_fails_with_size_diagnostic(self):
        from server.mcp_context import MAX_FILE
        file=self.root/'src/pages/demo/reader/v1/oversized.bin'
        with file.open('wb') as stream: stream.truncate(MAX_FILE+1)
        with self.assertRaisesRegex(ValueError,'32 MiB'): self.prepare()

    def test_symlinks_rejected(self):
        self.write('.env','private')
        (self.root/'src/pages/demo/reader/v1/link.js').symlink_to(self.root/'.env')
        with self.assertRaisesRegex(ValueError,'符号链接'): self.prepare()

    def test_explicit_doc_and_no_document(self):
        self.payload['mcpSelectedPrdPath'] = self.payload['prdPath']
        self.make_share(self.name,self.payload,self.token)
        _,_,m = self.prepare()
        self.assertTrue(any('/docs/v2.md' in r['relativePath'] for r in m['resources'].values()))
        self.token=secrets.token_urlsafe(32)
        self.payload.update(documents=[],prdPath='',prdContent='')
        self.make_share(self.name,self.payload,self.token)
        _,_,m = self.prepare('no-doc')
        self.assertEqual(m['pages'][0]['documents'],[])

    def test_folder_versions_hierarchy_and_order(self):
        self.write('src/pages/demo/library/v3/index.html','书架 v3')
        payload = {'projectId':'demo','mode':'folder','folders':[{'id':'folder','parentId':None,'order':1}],
                   'pages':[{**self.payload,'id':'reader','parentId':'folder','order':2},
                            {'id':'library','version':'v3','parentId':'folder','order':3}]}
        self.make_share(self.name,payload,self.token)
        _,_,m=self.prepare()
        self.assertEqual([(p['pageId'],p['version'],p['parentId'],p['order']) for p in m['pages']], [('reader','v1','folder',2),('library','v3','folder',3)])
        self.assertEqual(m['folders'],payload['folders'])

    def test_immutable_previous_share_survives_same_path_update_and_revoke(self):
        _,static,old=self.prepare()
        previous=self.root/'data/published-static'
        shutil.copytree(static,previous)
        workspace.atomic_json(previous/'.share-access.json',json.loads((self.root/'data/share-access.json').read_text()))
        self.write('src/pages/demo/reader/v1/index.html','<h1>NEW WORKING COPY</h1>')
        other=self.make_share('folder-static.html',{'projectId':'demo','mode':'folder','pages':[{'id':'reader','version':'v1'}]},secrets.token_urlsafe(32))
        directory,new,m=self.prepare('second',[other])
        old_resources = m['resources']
        entry = old_resources[old['pages'][0]['entryResourceId']]
        self.assertEqual(entry['source'],'private')
        self.assertIn('旧版中文',(new/'.mcp'/entry['relativePath']).read_text())
        self.assertEqual(old['snapshotId'],m['snapshotId'])
        withdraw_snapshot(new,[other.name])
        self.assertTrue((new/'.mcp'/self.name/'manifest.json').is_file())
        self.assertFalse((new/'.mcp'/other.name).exists())
        self.assertTrue((new/'src/pages/demo/reader/v1/index.html').is_file())

    def test_private_build_output_and_published_copy_use_only_current_credentials(self):
        directory,static,m = self.prepare()
        content=self.deployer.prepare_gateway(directory,static,[self.share])
        function=content.parent
        self.assertTrue((function/'share_mcp.bundle.mjs').is_file())
        self.assertFalse((content/'.mcp').exists())
        access=json.loads((function/'access.json').read_text())
        self.assertNotIn(self.token,(function/'access.json').read_text())
        self.assertTrue(access['shares'][0]['mcpSnapshot'])
        self.assertFalse(any('/.mcp/' in path for p in access['shares'] for path in p['files']))
        # Simulate only the successful local snapshot switch.
        previous=self.root/'data/published-static'
        shutil.copytree(content,previous)
        shutil.copytree(function/'mcp-context',previous/'.mcp')
        shutil.copy2(directory/'published-access.json',previous/'.share-access.json')
        newtoken=secrets.token_urlsafe(32)
        self.make_share(self.name,self.payload,newtoken)
        copied=manage(self.root,{'action':'copy','ids':[self.name]})['share']
        self.assertEqual(copied['mcpUrl'],'https://share.example.com/mcp/'+self.token)
        self.assertNotIn(self.token,json.dumps(inventory(self.root)))
        self.assertEqual((self.root/'data/share-mcp-tokens.json').stat().st_mode & 0o777,0o600)

    def test_api_rejects_short_tokens_and_resumes_frozen_content_after_working_files_deleted(self):
        import io
        from server.bridge import BridgeHandler
        self.prepare()
        cache=self.root/'data/share-mcp-drafts'/hashlib.sha256(self.token.encode()).hexdigest()
        original=json.loads((cache/'policy.json').read_text())
        shutil.rmtree(self.root/'src/pages/demo/reader/v1')
        self.share.unlink()
        def request(token):
            body=json.dumps({'projectId':'demo','pageId':'reader','version':'v1','shareType':'static','mcpToken':token,'access':{'expiresInDays':0}}).encode()
            handler=object.__new__(BridgeHandler)
            handler.headers={'Content-Length':str(len(body))}
            handler.rfile,handler.wfile=io.BytesIO(body),io.BytesIO()
            handler.send_response=lambda code:setattr(handler,'status',code)
            handler.send_header=lambda *args:None
            handler.end_headers=lambda:None
            with patch('server.bridge.get_project_root',return_value=str(self.root)), patch('server.bridge.sync_projects') as sync, patch('server.bridge.load_settings',return_value={'staticDomain':'share.example.com'}), patch('server.deployer.VercelDeployer.deploy') as deploy:
                handler.handle_share_page()
                sync.assert_not_called()
            return handler.status,handler.wfile.getvalue().decode(),deploy
        code,body,deploy=request(self.token)
        self.assertEqual(code,200,body)
        self.assertEqual(json.loads(body)['url'],'https://share.example.com/shares/'+self.name)
        self.assertNotIn(self.token,body)
        deploy.assert_called_once()
        self.assertEqual(json.loads((self.root/'data/share-access.json').read_text())[self.name]['id'],original['id'])
        code,body,deploy=request('short')
        self.assertEqual(code,400)
        deploy.assert_not_called()

    def test_updated_global_asset_pins_old_bytes_and_new_snapshot_gets_current_bytes(self):
        _,static,first=self.prepare()
        previous=self.root/'data/published-static'
        shutil.copytree(static,previous)
        workspace.atomic_json(previous/'.share-access.json',json.loads((self.root/'data/share-access.json').read_text()))
        self.write('assets/photo.png','updated image')
        other=self.make_share('folder-static.html',{'projectId':'demo','mode':'folder','pages':[{'id':'reader','version':'v1'}]},secrets.token_urlsafe(32))
        _,new,old=self.prepare('new-assets',[other])
        fresh=json.loads((new/'.mcp'/other.name/'manifest.json').read_text())
        prior_image=next(r for r in old['resources'].values() if r['mimeType']=='image/png')
        self.assertEqual((new/'.mcp'/prior_image['relativePath']).read_text(),'image bytes')
        fresh_image=next(r for r in fresh['resources'].values() if r['mimeType']=='image/png')
        self.assertEqual((new/fresh_image['relativePath']).read_text(),'updated image')

    def test_bad_token_rejected_and_legacy_policy_unchanged(self):
        for token in ['', 'tiny', 'a'*42, '../'*15, 'x'*43]:
            with self.assertRaises(ValueError): create_policy({},token)
        self.assertNotIn('mcpTokenHash',create_policy({}))

    def test_failed_upload_retry_freezes_bytes_policy_and_atomic_published_state(self):
        import subprocess
        from types import SimpleNamespace
        original_run = subprocess.run
        config = self.base / 'config'
        workspace.atomic_json(config / 'vercel.json', {'projectId':'fixture','orgId':'fixture','staticDomain':'share.example.com'})
        failed = False
        uploads = []
        def run(command, **kwargs):
            if 'build-share-mcp.mjs' in command[1]:
                return original_run(command, **kwargs)
            if command[-1] == '--prota-check':
                return SimpleNamespace(returncode=0,stdout='',stderr='')
            directory=Path(command[-1])
            function=directory/'.vercel/output/functions/share.func'
            uploads.append(json.loads((function/'access.json').read_text()))
            return SimpleNamespace(returncode=1 if failed else 0,stdout='https://fixture.vercel.app',stderr='fixture upload failure' if failed else '')
        with patch('server.deployer.workspace.CONFIG_DIR',config), patch('server.deployer.opt_in_large_functions'), patch('server.deployer.subprocess.run',side_effect=run):
            self.deployer.deploy(self.share)
            previous=self.root/'data/published-static'
            before={str(p.relative_to(previous)):p.read_bytes() for p in previous.rglob('*') if p.is_file()}
            original_policy=json.loads((previous/'.share-access.json').read_text())[self.name]
            self.write('src/pages/demo/reader/v1/index.html','<h1>Frozen first attempt</h1>')
            newtoken=secrets.token_urlsafe(32)
            self.make_share(self.name,self.payload,newtoken)
            failed=True
            with self.assertRaises(RuntimeError): self.deployer.deploy(self.share)
            self.assertEqual(before,{str(p.relative_to(previous)):p.read_bytes() for p in previous.rglob('*') if p.is_file()})
            self.assertEqual(manage(self.root,{'action':'copy','ids':[self.name]})['share']['mcpUrl'],'https://share.example.com/mcp/'+self.token)
            first_attempt=uploads[-1]['shares'][0]
            self.write('src/pages/demo/reader/v1/index.html','<h1>Edited after failed upload</h1>')
            # A second API call can issue a new pending policy, but retry retains the original.
            self.make_share(self.name,{**self.payload,'version':'v2'},newtoken)
            failed=False
            self.deployer.deploy(self.share)
            current=json.loads((previous/'.share-access.json').read_text())[self.name]
            self.assertEqual(current['id'],first_attempt['id'])
            self.assertNotEqual(current['mcpTokenHash'],original_policy['mcpTokenHash'])
            self.assertIn('Frozen first attempt',(previous/'src/pages/demo/reader/v1/index.html').read_text())
            self.assertEqual(share_payload(previous/'shares'/self.name)['version'],'v1')
            self.assertEqual(manage(self.root,{'action':'copy','ids':[self.name]})['share']['mcpUrl'],'https://share.example.com/mcp/'+newtoken)
            # Lost success responses do not rotate published state or upload again.
            self.make_share(self.name,self.payload,newtoken)
            count=len(uploads)
            self.deployer.deploy(self.share)
            self.assertEqual(len(uploads),count)
            self.deployer.deploy(revoke_files=[self.name])
            self.assertEqual(uploads[-1]['shares'],[])
            self.assertFalse((previous/'.mcp'/self.name).exists())
            self.assertNotIn(self.name,json.loads((previous/'.share-access.json').read_text()))

    def test_strict_prd_ignores_reading_history(self):
        from server.bridge import read_share_prd
        self.write('src/pages/demo/reader/docs/prd-index.json',json.dumps({'lastOpenedPath':'/src/pages/demo/reader/docs/v2.md','documents':{
            '/src/pages/demo/reader/docs/v1.md':{'prototypeVersion':'v1'},'/src/pages/demo/reader/docs/v2.md':{'prototypeVersion':'v2'}}}))
        result=read_share_prd(self.root,'demo','reader','v1',strict_version=True)
        self.assertEqual(result['content'],'v1 需求')
        result=read_share_prd(self.root,'demo','reader','v1','/src/pages/demo/reader/docs/v2.md',strict_version=True)
        self.assertEqual(result['content'],'v2 secret')
        remembered=read_share_prd(self.root,'demo','reader','v1','/src/pages/demo/reader/docs/v2.md',strict_version=True,requested_explicit=False)
        self.assertEqual(remembered['content'],'v1 需求')


class RevisionContextTests(unittest.TestCase):
    def test_pinned_revision_is_verified_and_working_copy_never_replaces_it(self):
        from tests.test_board_revisions import BoardRevisionTests
        fixture=BoardRevisionTests();fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        first=fixture.create()
        (fixture.board/'index.html').write_text('<h1>Latest must not replace historical</h1>')
        (fixture.version/'index.html').write_text('<script src="canvas-data.js"></script>')
        layout=json.loads(fixture.layout.read_text().split('=',1)[1].strip().removesuffix(';'))
        layout['nodes'].append({**layout['nodes'][0],'id':'home-copy','boardVersionId':'v2'})
        layout['edges']=[{'id':'edge-1','sourceNodeId':'home','targetNodeId':'other'}]
        fixture.layout.write_text('window.PROTA_CANVAS = '+json.dumps(layout)+';')
        (fixture.root/'shares').mkdir()
        file=fixture.root/'shares/design-v1-static.html'
        payload={'projectId':'demo','pageId':'design','version':'v1','pageMode':'infinite-canvas'}
        file.write_text('<script>window.__READIFY_SHARE__ = '+json.dumps(payload)+';</script>')
        token=secrets.token_urlsafe(32)
        save_policy(fixture.root,file.name,create_policy({},token),mcp_token=token)
        deployer=VercelDeployer(fixture.root)
        static=deployer.prepare(fixture.root/'release',[file])
        m=json.loads((static/'.mcp'/file.name/'manifest.json').read_text())
        p=m['pages'][0]
        self.assertEqual(p['edges'],layout['edges'])
        board=p['boards'][0]
        self.assertEqual(board['boardRevisionId'],first['revisionId'])
        self.assertEqual(board['instanceId'],'home')
        self.assertEqual(board['sourceKind'],'revision')
        self.assertEqual(p['boards'][1]['sourceKind'],'working-copy')
        self.assertEqual(p['boards'][2]['instanceId'],'home-copy')
        self.assertEqual(p['boards'][2]['boardId'],board['boardId'])
        self.assertEqual(p['boards'][2]['boardVersionId'],'v2')
        self.assertEqual(p['boards'][2]['resourceIds'],board['resourceIds'])
        entry=next(m['resources'][rid] for rid in board['resourceIds'] if m['resources'][rid]['relativePath'].endswith('boards/home/index.html'))
        self.assertIn('Old',(static/'.mcp'/entry['relativePath']).read_text())
        self.assertFalse(any(r['source']=='content' and r['relativePath'].endswith('boards/home/index.html') for r in m['resources'].values()))
        save_policy(fixture.root,file.name,create_policy({},secrets.token_urlsafe(32)))
        (fixture.page/'board-history/b_home'/first['revisionId']/'files/boards/home/index.html').write_text('tampered')
        with self.assertRaises(ValueError): deployer.prepare(fixture.root/'broken',[file])


if __name__ == '__main__': unittest.main()
