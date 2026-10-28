import copy
import json
from pathlib import Path
import tempfile
import unittest
from server.canvas_store import PREFIX, save_canvas

class CanvasStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.directory = self.root/'src/pages/demo/design/v1'
        self.directory.mkdir(parents=True)
        self.state = {'schemaVersion': 1, 'revision': 0, 'nodes': [], 'viewport': {'x': 0, 'y': 0, 'zoom': 1}}
        self.file = self.directory/'canvas-data.js'
        self.file.write_text(PREFIX + json.dumps(self.state) + ';\n')

    def params(self):
        return {'projectId':'demo','pageId':'design','version':'v1','revision':0,'baseline':copy.deepcopy(self.state),'state':copy.deepcopy(self.state)}

    def test_native_edges_round_trip_and_validation_on_v1(self):
        params = self.params()
        params['state']['nodes'] = [dict(id=id, type='board', x=x, y=0, width=200, height=300) for id, x in [('a', 0), ('b', 500)]]
        params['state']['edges'] = [{'id': 'e', 'fromInstanceId': 'a', 'toInstanceId': 'b', 'label': '验证码通过', 'kind': 'main', 'fromPort': 'auto', 'toPort': 'left'}]
        status, _ = save_canvas(self.root, params)
        self.assertEqual(status, 200)
        persisted = json.loads(self.file.read_text()[len(PREFIX):].strip().removesuffix(';'))
        self.assertEqual(persisted['edges'], params['state']['edges'])
        invalid = dict(params['state']['edges'][0], label='x' * 201)
        from server.canvas_domain import validate_document
        with self.assertRaises(ValueError):
            validate_document(dict(params['state'], edges=[invalid]))
        invalid['label'] = 'valid'; invalid['fromPort'] = 'bad-side'
        with self.assertRaises(ValueError):
            validate_document(dict(params['state'], edges=[invalid]))

    def test_save_and_conflict(self):
        params = self.params()
        params['state']['nodes'] = [{'id':'text_1','type':'text','x':-100,'y':10,'width':200,'height':100,'text':'<script>文本</script>'}]
        self.assertEqual(save_canvas(self.root, params), (200, {'revision':1}))
        persisted = self.file.read_text()
        self.assertNotIn('<script>', persisted)
        self.assertEqual(save_canvas(self.root, self.params())[0], 409)
        self.assertEqual(self.file.read_text(), persisted)

    def test_agent_change_without_revision_conflicts(self):
        changed = copy.deepcopy(self.state)
        changed['viewport']['x'] = 200
        self.file.write_text(PREFIX + json.dumps(changed) + ';')
        self.assertEqual(save_canvas(self.root, self.params())[0], 409)

    def test_reject_paths_symlinks_invalid_nodes_and_missing_pages(self):
        for key, value in [('projectId','../escape'), ('pageId','..'), ('version','v2')]:
            params = self.params(); params[key] = value
            with self.assertRaises(ValueError): save_canvas(self.root, params)
        node = {'id':'x','type':'board','x':0,'y':0,'width':300,'height':400,'src':'../v2/index.html'}
        params = self.params(); params['state']['nodes'] = [node]
        with self.assertRaises(ValueError): save_canvas(self.root, params)
        node['src'] = 'boards/test/index.html'; node['x'] = float('nan')
        with self.assertRaises(ValueError): save_canvas(self.root, params)
        self.file.unlink(); self.file.symlink_to(self.root/'outside.js')
        with self.assertRaises(ValueError): save_canvas(self.root, self.params())

    def test_groups_reject_cycles_and_duplicate_board_copies_code(self):
        params = self.params()
        base = {'x':0, 'y':0, 'width':200, 'height':300}
        params['state']['nodes'] = [dict(base, id='a', type='board', parentId='b'), dict(base, id='b', type='group', parentId='a')]
        with self.assertRaises(ValueError): save_canvas(self.root, params)
        source = self.directory/'boards/source'
        source.mkdir(parents=True)
        (source/'index.html').write_text('<h1>Source</h1>')
        (source/'app.js').write_text('// original')
        params['state']['nodes'] = [dict(base, id='new', type='board', src='boards/new/index.html', cloneFrom='boards/source/index.html')]
        self.assertEqual(save_canvas(self.root, params)[0], 200)
        self.assertEqual((self.directory/'boards/new/app.js').read_text(), '// original')
        (self.directory/'boards/new/app.js').write_text('// independent')
        self.assertEqual((source/'app.js').read_text(), '// original')
        self.assertEqual(len(list((self.directory/'.canvas-history').glob('*.js'))), 1)

    def test_upgrade_preserves_document_and_makes_runtime_backup(self):
        from server.canvas_store import upgrade_runtime
        original = self.file.read_bytes()
        (self.directory/'app.js').write_text('// old editor')
        template = Path(__file__).resolve().parents[1]/'src/templates/infinite-canvas'
        upgrade_runtime(self.root, self.params(), template)
        self.assertEqual(self.file.read_bytes(), original)
        self.assertEqual((self.directory/'.canvas-runtime-backup/app.js').read_text(), '// old editor')
        self.assertTrue((self.directory/'canvas-core.js').is_file())
        self.assertTrue((self.directory/'icons.js').is_file())
        for filename in ['marked.js', 'markdown.js', 'LICENSE.marked']:
            self.assertEqual((self.directory/filename).read_bytes(), (template/filename).read_bytes())
        self.assertIn('Lucide', (self.directory/'LICENSE.lucide').read_text())

    def test_v4_upgrade_retains_nodes_board_code_assets_annotations_and_metadata(self):
        from server.canvas_store import upgrade_runtime
        metadata = self.root/'data/projects.json'
        metadata.parent.mkdir()
        metadata.write_text('{"projects":[{"id":"demo","pages":[{"id":"design","pageMode":"infinite-canvas","versions":["v1"]}]}]}')
        (self.directory/'app.js').write_text('window.protaCanvas={runtimeVersion:4};')
        (self.directory/'boards/reader').mkdir(parents=True)
        (self.directory/'assets').mkdir()
        (self.directory/'boards/reader/index.html').write_text('<h1>Keep this business prototype</h1>')
        (self.directory/'assets/reference.png').write_bytes(b'original asset')
        (self.directory/'annotations.json').write_text('[{"target":{"type":"canvas-board","boardId":"reader"},"selector":"h1","description":"Keep annotation"}]')
        files=[self.file,metadata,self.directory/'boards/reader/index.html',self.directory/'assets/reference.png',self.directory/'annotations.json']
        original={file:file.read_bytes() for file in files}
        template=Path(__file__).resolve().parents[1]/'src/templates/infinite-canvas'
        self.assertEqual(upgrade_runtime(self.root,self.params(),template),{'runtimeVersion':8})
        self.assertTrue(all(file.read_bytes()==data for file,data in original.items()))
        self.assertIn('runtimeVersion:4',(self.directory/'.canvas-runtime-backup/app.js').read_text())

    def test_agent_write_during_save_is_not_replaced(self):
        from unittest.mock import patch
        original_write = Path.write_text
        external = copy.deepcopy(self.state)
        external['viewport']['x'] = 800
        def interleaved_write(path, content, *args, **kwargs):
            result = original_write(path, content, *args, **kwargs)
            if path.resolve() == self.file.with_suffix('.js.tmp').resolve():
                original_write(self.file, PREFIX + json.dumps(external) + ';\n', encoding='utf-8')
            return result
        with patch.object(Path, 'write_text', interleaved_write):
            status, _ = save_canvas(self.root, self.params())
        self.assertEqual(status, 409)
        self.assertEqual(json.loads(self.file.read_text()[len(PREFIX):].strip().removesuffix(';')), external)

    def test_incomplete_editor_template_cannot_partially_overwrite_runtime(self):
        from server.canvas_store import upgrade_runtime
        import shutil
        template = self.root/'broken-template'
        shutil.copytree(Path(__file__).resolve().parents[1]/'src/templates/infinite-canvas', template)
        (template/'icons.js').unlink()
        (self.directory/'index.html').write_text('<h1>Existing editor entry</h1>')
        (self.directory/'app.js').write_text('// existing editor')
        before={file:file.read_bytes() for file in [self.directory/'index.html',self.directory/'app.js',self.file]}
        with self.assertRaisesRegex(ValueError, 'icons.js'):
            upgrade_runtime(self.root,self.params(),template)
        self.assertTrue(all(file.read_bytes()==content for file,content in before.items()))

if __name__ == '__main__': unittest.main()
