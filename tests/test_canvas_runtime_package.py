import copy
import hashlib
import io
import json
from pathlib import Path
import shutil
import tempfile
from types import SimpleNamespace
import unittest
import zipfile

from server.canvas_runtime_package import (runtime_bundle, verify_bundle, pin_runtime, pin_share_pages,
    migrate_entry, restore_entry, document_entry, VIRTUAL_FILES, is_shared)
from server.canvas_runtime_http import serve
from server.bridge import build_page_zip_bytes, build_folder_zip_bytes, build_share_page_html
from server.deployer import VercelDeployer, share_payload

APP = Path(__file__).resolve().parents[1]


def make_canvas(root, page='a', version='v1', legacy=False):
    directory = Path(root) / f'src/pages/demo/{page}/{version}'
    shutil.copytree(APP / ('src/templates/infinite-canvas' if legacy else 'src/templates/infinite-canvas-document'), directory)
    (directory / 'boards/home').mkdir(parents=True)
    (directory / 'boards/home/index.html').write_text('<!doctype html><style>body{background:#fff}button{color:red}</style><button onclick="this.textContent=\'Clicked\'">Business action</button>')
    (directory / 'assets').mkdir()
    (directory / 'assets/reference.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path d="M0 0h12v12H0z"/></svg>')
    (directory / 'annotations.json').write_text('[{"description":"keep"}]')
    (directory / 'canvas-data.js').write_text('window.PROTA_CANVAS = ' + json.dumps({'schemaVersion':1,'revision':0,'nodes':[{'id':'home','type':'board','name':'Home','src':'boards/home/index.html','x':120,'y':90,'width':375,'height':500},{'id':'rect','type':'rect','flowShape':'process','name':'Shape','text':'Hello','x':570,'y':120,'width':220,'height':100,'color':'#ffffff'}], 'viewport':{'x':0,'y':0,'zoom':1}}) + ';')
    return directory


class RuntimePackageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='canvas-runtime-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.version = make_canvas(self.root)
        (self.root / 'data').mkdir()
        (self.root / 'data/settings.json').write_text('{}')
        (self.root / 'shares').mkdir()

    def payload(self, page='a'):
        return {'enabled':True,'shareType':'static','projectId':'demo','pageId':page,'version':'v1','pageMode':'infinite-canvas','targetDevice':'canvas'}

    def test_bundle_hash_changes_without_version_bump_and_tampering_is_rejected(self):
        app = self.root / 'app'
        for relative in ['src/templates/infinite-canvas','src/templates/infinite-canvas-document','src/canvas-runtime']:
            shutil.copytree(APP / relative, app / relative)
        first, files = runtime_bundle(app)
        source = app / 'src/templates/infinite-canvas/styles.css'
        source.write_text(source.read_text() + '\n/* toolbar refinement */')
        second, _ = runtime_bundle(app)
        self.assertNotEqual(first['runtimeHash'], second['runtimeHash'])
        self.assertEqual(first['runtimeVersion'], second['runtimeVersion'])
        pinned, manifest = pin_runtime(self.root, app=app)
        self.assertEqual(verify_bundle(pinned)['runtimeHash'], second['runtimeHash'])
        (pinned / 'app.js').write_text('broken')
        with self.assertRaisesRegex(ValueError, '校验失败'):
            pin_runtime(self.root, manifest['runtimeHash'], app=app)
        (pinned / 'app.js').unlink()
        with self.assertRaises(ValueError):
            verify_bundle(pinned)

    def test_zip_embeds_classic_runtime_and_retains_business_content(self):
        (self.version / '.env').write_text('secret')
        before = {p:p.read_bytes() for p in self.version.rglob('*') if p.is_file()}
        archive = zipfile.ZipFile(io.BytesIO(build_page_zip_bytes(self.root, 'demo', 'a', 'v1')))
        self.assertIn('v1/__prota_runtime/boot.js', archive.namelist())
        self.assertIn('v1/__prota_runtime/canvas-mermaid.js', archive.namelist())
        self.assertNotIn('v1/.env', archive.namelist())
        self.assertEqual(archive.read('v1/index.html'), document_entry())
        self.assertNotIn(b'import(', archive.read('v1/__prota_runtime/boot.js'))
        self.assertTrue(all(p.read_bytes() == content for p,content in before.items()))

    def test_migration_and_rollback_preserve_business_hashes_and_are_idempotent(self):
        legacy = make_canvas(self.root, 'legacy', legacy=True)
        shutil.copytree(legacy, legacy.parent / 'v2')
        for version in ['v1','v2']:
            directory = legacy.parent / version
            original = {p:p.read_bytes() for p in directory.rglob('*') if p.is_file() and (p.name in {'canvas-data.js','annotations.json'} or 'boards' in p.parts or 'assets' in p.parts)}
            params = dict(projectId='demo',pageId='legacy',version=version)
            old_entry = (directory / 'index.html').read_bytes()
            migrate_entry(self.root, params)
            self.assertTrue(is_shared(directory))
            self.assertEqual(migrate_entry(self.root, params)['shellFormat'], 'shared-v1')
            self.assertTrue(all(p.read_bytes()==content for p,content in original.items()))
            restore_entry(self.root, params)
            self.assertEqual((directory / 'index.html').read_bytes(), old_entry)
            self.assertTrue(all(p.read_bytes()==content for p,content in original.items()))

    def test_normal_demos_are_not_migrated_and_symlinks_rejected(self):
        ordinary = self.root / 'src/pages/demo/ordinary/v1'
        ordinary.mkdir(parents=True)
        (ordinary / 'index.html').write_text('<h1>Ordinary</h1>')
        with self.assertRaises(ValueError):
            migrate_entry(self.root, dict(projectId='demo',pageId='ordinary',version='v1'))
        (self.version / 'assets/link').symlink_to(self.root / 'data/settings.json')
        with self.assertRaises(ValueError):
            build_page_zip_bytes(self.root, 'demo','a','v1')
        with self.assertRaises(ValueError):
            pin_share_pages(self.root, self.payload())

    def test_frozen_share_and_zip_ignore_later_business_and_runtime_changes(self):
        app = self.root / 'app'
        for relative in ['src/templates/infinite-canvas','src/templates/infinite-canvas-document','src/canvas-runtime']:
            shutil.copytree(APP / relative, app / relative)
        payload = self.payload()
        pin_share_pages(self.root, payload, app)
        data = (self.version / 'canvas-data.js').read_bytes()
        old_hash = payload['canvasRuntimeHash']
        (self.version / 'canvas-data.js').write_text('window.PROTA_CANVAS={"changed":true};')
        source = app / 'src/templates/infinite-canvas/styles.css'
        source.write_text(source.read_text() + '\n/* updated */')
        self.assertNotEqual(runtime_bundle(app)[0]['runtimeHash'], old_hash)
        pin_share_pages(self.root, payload, app)
        self.assertEqual(payload['canvasRuntimeHash'], old_hash)
        archive = zipfile.ZipFile(io.BytesIO(build_page_zip_bytes(self.root,'demo','a','v1',old_hash,payload['canvasEntryPath'])))
        self.assertEqual(archive.read('v1/canvas-data.js'),data)
        self.assertEqual(json.loads(archive.read('v1/__prota_runtime/runtime-manifest.json'))['runtimeHash'],old_hash)

    def test_folder_deployment_deduplicates_runtime_and_gateway_grants_exact_files(self):
        make_canvas(self.root, 'b')
        ordinary = self.root / 'src/pages/demo/ordinary/v1'
        ordinary.mkdir(parents=True)
        (ordinary / 'index.html').write_text('<h1>Ordinary</h1>')
        payload = {'enabled':True,'shareType':'static','mode':'folder','projectId':'demo','folderId':'all','folders':[{'id':'all','name':'All'}], 'pages':[{'id':page,'version':'v1','parentId':'all'} for page in ['a','b','ordinary']]}
        pin_share_pages(self.root,payload)
        zipname='all-static.zip'
        (self.root / 'shares' / zipname).write_bytes(build_folder_zip_bytes(self.root,payload))
        payload['zipFilename']=zipname
        share=self.root/'shares/all-static.html'
        share.write_text(build_share_page_html(payload))
        deployer=VercelDeployer(self.root, APP)
        out=self.root/'build'
        static=deployer.prepare(out,[share])
        hashes=list((static/'__prota_runtime').iterdir())
        self.assertEqual(len(hashes),1)
        for selected in share_payload(static/'shares/all-static.html')['pages'][:2]:
            entry=(static/selected['canvasEntryPath']).read_text()
            self.assertIn('/__prota_runtime/'+selected['canvasRuntimeHash']+'/boot.js',entry)
        content=deployer.prepare_gateway(out,static,[share])
        grants=json.loads((content.parent/'access.json').read_text())['shares']
        self.assertEqual(len(grants),1)
        grant=grants[0]
        self.assertIn('/__prota_runtime/'+hashes[0].name+'/boot.js',grant['files'])
        self.assertNotIn('/data/settings.json',grant['files'])
        self.assertFalse(any('/.canvas-' in path for path in grant['files']))

    def test_runtime_http_read_only_allowlist_get_head_and_legacy_virtual_entry(self):
        make_canvas(self.root,'legacy',legacy=True)
        root=self.root
        class Handler:
            def __init__(self,path,command='GET'):
                self.path=path; self.command=command; self.headers={}; self.wfile=io.BytesIO(); self.code=None
            def send_response(self,code): self.code=code
            def send_error(self,code,*args): self.code=code
            def send_header(self,key,value): self.headers[key]=value
            def end_headers(self): pass
        ws=SimpleNamespace(workspace_root=lambda:root,APP_ROOT=APP)
        for page in ['a','legacy']:
            h=Handler(f'/src/pages/demo/{page}/v1/index.html')
            self.assertTrue(serve(h,ws));self.assertEqual(h.code,200)
            self.assertIn(b'data-prota-canvas-shell="shared-v1"',h.wfile.getvalue())
        for path in ['app.js','runtime-manifest.json','styles.css']:
            get=Handler('/src/pages/demo/a/v1/__prota_runtime/'+path)
            head=Handler(get.path,'HEAD')
            serve(get,ws);serve(head,ws)
            self.assertEqual(get.code,200);self.assertEqual(head.code,200)
            self.assertEqual(get.headers,head.headers);self.assertEqual(head.wfile.getvalue(),b'')
            self.assertEqual(get.headers['Cache-Control'],'no-store')
        for path in ['../app.js','%2e%2e/app.js','%252e%252e/app.js','runtime-manifest.json/../app.js','secret.env']:
            h=Handler('/src/pages/demo/a/v1/__prota_runtime/'+path)
            self.assertTrue(serve(h,ws));self.assertEqual(h.code,404,path)

    def test_iteration_copies_business_only_and_feature_rollback_keeps_shared_documents_working(self):
        from unittest.mock import patch
        from server.canvas_runtime_package import copy_version
        source = make_canvas(self.root, 'iteration', legacy=True)
        before = (source / 'canvas-data.js').read_bytes()
        copy_version(source, source.parent / 'v2')
        target = source.parent / 'v2'
        self.assertTrue(is_shared(target))
        self.assertEqual((target / 'canvas-data.js').read_bytes(), before)
        self.assertEqual((source / 'canvas-data.js').read_bytes(), before)
        self.assertFalse((target / 'app.js').exists())
        self.assertFalse((target / '.canvas-runtime-backup').exists())
        self.assertTrue((target / 'boards/home/index.html').is_file())
        with patch.dict('os.environ', {'PROTA_CANVAS_LEGACY_MIGRATION':'0'}):
            self.assertTrue(migrate_entry(self.root, dict(projectId='demo',pageId='iteration',version='v1'))['deferred'])
            self.assertFalse(is_shared(source))
        with patch.dict('os.environ', {'PROTA_CANVAS_PACKAGE_V2':'0'}):
            with self.assertRaisesRegex(ValueError, '停用'):
                build_page_zip_bytes(self.root,'demo','a','v1')

    def test_shared_documents_keep_prd_paths_and_mcp_context_in_the_frozen_snapshot(self):
        from server.mcp_context import build_context
        docs = self.version.parent / 'docs'
        docs.mkdir(); (docs / 'requirements.md').write_text('# Frozen requirements')
        payload = self.payload()
        payload['documents'] = [{'path':'src/pages/demo/a/docs/requirements.md','prototypeVersion':'v1'}]
        payload['prdPath'] = '/src/pages/demo/a/docs/requirements.md'
        pin_share_pages(self.root,payload)
        self.assertIn('__prota_canvas/',payload['prdPath'])
        share = self.root / 'shares/a-static.html'
        share.write_text(build_share_page_html(payload))
        static = VercelDeployer(self.root,APP).prepare(self.root/'mcp-build',[share])
        frozen = share_payload(static/'shares/a-static.html')
        self.assertTrue((static / frozen['documents'][0]['path']).is_file())
        context = build_context(self.root,static,share.name,frozen,APP)
        self.assertTrue(context['pages'][0]['documents'])

    def test_published_snapshot_and_hash_survive_other_shares_and_selective_withdrawal(self):
        from server.deployer import withdraw_snapshot
        app = self.root / 'app'
        for relative in ['portal','src/templates/infinite-canvas','src/templates/infinite-canvas-document','src/canvas-runtime']:
            shutil.copytree(APP / relative,app / relative)
        old = self.payload();pin_share_pages(self.root,old,app)
        share1 = self.root/'shares/first-static.html';share1.write_text(build_share_page_html(old))
        deployer = VercelDeployer(self.root,app)
        first = deployer.prepare(self.root/'first-build',[share1])
        old_entry = (first / old['canvasEntryPath']).read_bytes()
        shutil.copytree(first,self.root/'data/published-static')
        source = app/'src/templates/infinite-canvas/styles.css';source.write_text(source.read_text()+'\n/* changed editor */')
        data = (self.version/'canvas-data.js').read_text().replace('"x": 120','"x": 121');(self.version/'canvas-data.js').write_text(data)
        new = self.payload();pin_share_pages(self.root,new,app)
        self.assertNotEqual(old['canvasRuntimeHash'],new['canvasRuntimeHash'])
        share2 = self.root/'shares/second-static.html';share2.write_text(build_share_page_html(new))
        second = deployer.prepare(self.root/'second-build',[share2])
        self.assertEqual((second/old['canvasEntryPath']).read_bytes(),old_entry)
        self.assertEqual(share_payload(second/'shares/first-static.html')['canvasRuntimeHash'],old['canvasRuntimeHash'])
        self.assertTrue((second/'__prota_runtime'/old['canvasRuntimeHash']).is_dir())
        withdraw_snapshot(second,[share2.name])
        self.assertTrue((second/'__prota_runtime'/old['canvasRuntimeHash']).is_dir())
        self.assertFalse((second/'__prota_runtime'/new['canvasRuntimeHash']).exists())
        self.assertEqual((second/old['canvasEntryPath']).read_bytes(),old_entry)


if __name__ == '__main__': unittest.main()
