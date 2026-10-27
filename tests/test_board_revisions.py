import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from server.board_revisions import create_revision, restore_revision, list_revisions, preview_revision
from server.canvas_store import PREFIX, save_canvas
from server.canvas_transactions import recover_transactions


class BoardRevisionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='prota-board-history-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.page = self.root / 'src/pages/demo/design'
        self.version = self.page / 'v1'
        (self.version / 'boards/home/modules').mkdir(parents=True)
        (self.version / 'assets').mkdir()
        (self.root / 'data').mkdir()
        (self.root / 'workspace.json').write_text('{"id":"revisions-test"}')
        (self.root / 'data/canvas-features.json').write_text(json.dumps({'testWorkspaceIds': ['revisions-test'], 'overrides': {'canvasSchemaV2': True, 'boardRevisions': True}}))
        self.board = self.version / 'boards/home'
        (self.board / 'index.html').write_text('<!doctype html><link rel="stylesheet" href="styles.css"><h1>Old</h1><img src="../../assets/photo.svg"><script type="module" src="app.js"></script>')
        (self.board / 'styles.css').write_text('body { background: url(../../assets/photo.svg); }')
        (self.board / 'app.js').write_text('import {answer} from "./modules/answer.js"; document.body.dataset.answer = answer;')
        (self.board / 'modules/answer.js').write_text('export const answer = 42;')
        (self.version / 'assets/photo.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
        (self.version / 'assets/extra.bin').write_bytes(b'dynamic asset')
        self.layout = self.version / 'canvas-data.js'
        self.state = dict(schemaVersion=2, revision=0, viewport=dict(x=0, y=0, zoom=1), edges=[], unknown={'keep': True}, nodes=[dict(id='home', type='board', boardId='b_home', boardRevisionId=None, name='Home', x=10, y=20, width=390, height=844, src='boards/home/index.html'), dict(id='other', type='board', boardId='b_other', boardRevisionId=None, x=500, y=20, width=390, height=844)])
        self.layout.write_text(PREFIX + json.dumps(self.state) + ';\n')

    def params(self, **extra):
        state = json.loads(self.layout.read_text()[len(PREFIX):].strip().removesuffix(';'))
        return dict(projectId='demo', pageId='design', version='v1', nodeId='home', boardId='b_home', revision=state['revision'], baseline=state, **extra)

    def create(self, **extra):
        code, result = create_revision(self.root, self.params(**extra))
        self.assertEqual(code, 200, result)
        return result

    def history(self):
        return list_revisions(self.root, dict(projectId='demo', pageId='design', boardId='b_home'))['revisions']

    def test_complete_immutable_snapshot_and_independent_parent_branches(self):
        old_other = copy.deepcopy(self.state['nodes'][1])
        first = self.create(label='Baseline')
        snapshot = self.page / 'board-history/b_home' / first['revisionId']
        before = {str(p.relative_to(snapshot)): p.read_bytes() for p in snapshot.rglob('*') if p.is_file()}
        self.assertIn('files/boards/home/modules/answer.js', before)
        self.assertIn('files/assets/extra.bin', before)
        (self.board / 'index.html').write_text('<h1>New</h1>')
        second = self.create()
        third = self.create(parentRevisionId=first['revisionId'])
        self.assertEqual(second['parentRevisionId'], first['revisionId'])
        self.assertEqual(third['parentRevisionId'], first['revisionId'])
        self.assertEqual(before, {str(p.relative_to(snapshot)): p.read_bytes() for p in snapshot.rglob('*') if p.is_file()})
        self.assertEqual(len(self.history()), 3)
        current = self.params()['baseline']
        self.assertEqual(current['nodes'][1], old_other)
        self.assertEqual(current['unknown'], self.state['unknown'])

    def test_restore_saves_current_recovery_point_and_new_branch(self):
        first = self.create()
        (self.board / 'index.html').write_text('<h1>Unsaved work must survive</h1>')
        (self.board / 'new.js').write_text('console.log("draft")')
        (self.board / 'styles.css').write_text('body { color: blue; }')
        (self.version / 'assets/photo.svg').unlink()
        code, restored = restore_revision(self.root, self.params(revisionId=first['revisionId']))
        self.assertEqual(code, 200, restored)
        self.assertNotEqual(restored['revisionId'], first['revisionId'])
        self.assertEqual(restored['parentRevisionId'], first['revisionId'])
        self.assertIn('Old', (self.board / 'index.html').read_text())
        self.assertFalse((self.board / 'new.js').exists())
        self.assertTrue((self.version / 'assets/photo.svg').is_file())
        recovery = self.page / 'board-history/b_home' / restored['recoveryRevisionId'] / 'files/boards/home'
        self.assertIn('Unsaved work', (recovery / 'index.html').read_text())
        self.assertTrue((recovery / 'new.js').is_file())
        self.assertEqual(len(self.history()), 3)

    def test_stale_baseline_unstable_source_invalid_js_and_missing_dependency_do_not_commit(self):
        stale = self.params(); self.layout.write_text(self.layout.read_text().replace('"revision": 0', '"revision": 1'))
        self.assertEqual(create_revision(self.root, stale)[0], 409)
        (self.board / 'app.js').write_text('const broken = ;')
        with self.assertRaises(ValueError): create_revision(self.root, self.params())
        self.assertEqual(self.history(), [])
        (self.board / 'app.js').write_text('import "./missing.js";')
        with self.assertRaises(ValueError): create_revision(self.root, self.params())
        self.assertEqual(self.history(), [])

    def test_flag_off_prevents_mutation_but_keeps_history_readable(self):
        first = self.create()
        (self.root / 'data/canvas-features.json').write_text('{}')
        self.assertEqual(create_revision(self.root, self.params())[0], 403)
        self.assertEqual(restore_revision(self.root, self.params(revisionId=first['revisionId']))[0], 403)
        self.assertEqual(len(self.history()), 1)

    def test_paths_symlinks_and_tampered_snapshots_are_rejected(self):
        for key in ('projectId', 'pageId', 'version', 'nodeId', 'boardId'):
            params = self.params(); params[key] = '../escape'
            with self.assertRaises(ValueError): create_revision(self.root, params)
        link = self.board / 'escape.js'; link.symlink_to(self.root / 'workspace.json')
        with self.assertRaises(ValueError): create_revision(self.root, self.params())
        link.unlink()
        first = self.create()
        target = self.page / 'board-history/b_home' / first['revisionId'] / 'files/boards/home/index.html'
        target.write_text('<h1>tampered</h1>')
        with self.assertRaises(ValueError): preview_revision(self.root, dict(projectId='demo', pageId='design', boardId='b_home', revisionId=first['revisionId']))
        import hashlib
        manifest_path = target.parents[3] / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['files']['boards/home/index.html'] = dict(sha256=hashlib.sha256(target.read_bytes()).hexdigest(), size=target.stat().st_size)
        manifest_path.write_text(json.dumps(manifest))
        with self.assertRaises(ValueError): preview_revision(self.root, dict(projectId='demo', pageId='design', boardId='b_home', revisionId=first['revisionId']))

    def test_publish_failure_rolls_back_layout_index_and_snapshot(self):
        from server import canvas_transactions as transactions
        before = self.layout.read_bytes()
        original = transactions.install_operation
        def fail(page, transaction, operation, ordinal):
            if operation['target'].endswith('canvas-data.js'):
                raise OSError('disk full at layout commit')
            return original(page, transaction, operation, ordinal)
        with patch.object(transactions, 'install_operation', fail):
            with self.assertRaises(OSError): create_revision(self.root, self.params())
        self.assertEqual(self.layout.read_bytes(), before)
        self.assertEqual(self.history(), [])
        self.assertTrue(any((self.page / '.board-trash').iterdir()))

    def test_interrupted_restore_recovers_before_next_layout_save(self):
        from server import canvas_transactions as transactions
        first = self.create()
        (self.board / 'index.html').write_text('<h1>current draft</h1>')
        before = self.layout.read_bytes()
        original = transactions.install_operation
        def crash(page, transaction, operation, ordinal):
            result = original(page, transaction, operation, ordinal)
            if operation['target'] == 'v1/boards/home':
                raise SystemExit('simulated process crash')
            return result
        with patch.object(transactions, 'install_operation', crash):
            with self.assertRaises(SystemExit): restore_revision(self.root, self.params(revisionId=first['revisionId']))
        self.assertEqual(self.layout.read_bytes(), before)
        params = self.params(); state = copy.deepcopy(params['baseline']); state['nodes'][0]['x'] += 1
        self.assertEqual(save_canvas(self.root, dict(params, state=state))[0], 200)
        self.assertIn('current draft', (self.board / 'index.html').read_text())
        self.assertEqual(len(self.history()), 1)

    def test_shared_dependency_conflict_never_changes_other_work(self):
        first = self.create()
        (self.version / 'assets/photo.svg').write_text('<svg>shared new version</svg>')
        before = self.layout.read_bytes()
        code, _ = restore_revision(self.root, self.params(revisionId=first['revisionId']))
        self.assertEqual(code, 409)
        self.assertEqual(self.layout.read_bytes(), before)
        self.assertIn('shared new version', (self.version / 'assets/photo.svg').read_text())

    def test_stability_limits_and_external_writer_during_recovery(self):
        from server import board_revisions as boards
        original = boards.capture
        calls = []
        def interleaved(working, node):
            result = original(working, node)
            if not calls:
                (self.board / 'index.html').write_text('<h1>still writing</h1>')
            calls.append(True)
            return result
        with patch.object(boards, 'capture', interleaved):
            self.assertEqual(create_revision(self.root, self.params())[0], 409)
        self.assertEqual(self.history(), [])
        with patch.object(boards, 'MAX_BYTES', 4):
            with self.assertRaises(ValueError): create_revision(self.root, self.params())
        self.assertEqual(self.history(), [])

    def test_crash_after_all_installs_finishes_commit_and_layout_save_does_not_create_version(self):
        from server import canvas_transactions as transactions
        original = transactions.install_operation
        def crash(page, transaction, operation, ordinal):
            result = original(page, transaction, operation, ordinal)
            if operation['target'].endswith('canvas-data.js'):
                raise SystemExit('after final rename, before commit journal')
            return result
        with patch.object(transactions, 'install_operation', crash):
            with self.assertRaises(SystemExit): create_revision(self.root, self.params())
        recover_transactions(self.page)
        self.assertEqual(len(self.history()), 1)
        params = self.params(); state = copy.deepcopy(params['baseline']); state['nodes'][0]['x'] += 1
        self.assertEqual(save_canvas(self.root, dict(params, state=state))[0], 200)
        self.assertEqual(len(self.history()), 1)

    def test_external_content_after_crash_is_never_overwritten(self):
        from server import canvas_transactions as transactions
        first = self.create()
        original = transactions.install_operation
        def crash(page, transaction, operation, ordinal):
            result = original(page, transaction, operation, ordinal)
            if operation['target'] == 'v1/boards/home':
                raise SystemExit('crash')
            return result
        with patch.object(transactions, 'install_operation', crash):
            with self.assertRaises(SystemExit): restore_revision(self.root, self.params(revisionId=first['revisionId']))
        (self.board / 'index.html').write_text('<h1>external writer after crash</h1>')
        with self.assertRaises(transactions.Conflict): recover_transactions(self.page)
        self.assertIn('external writer after crash', (self.board / 'index.html').read_text())
        self.assertTrue(any((self.page / '.board-transactions').glob('*/before')))
        status = transactions.inspect_transactions(self.page)[0]
        with self.assertRaises(transactions.Conflict): transactions.resolve_transaction(self.page, status['transactionId'], {})
        transactions.resolve_transaction(self.page, status['transactionId'], status['current'])
        self.assertEqual(len(self.history()), 1)
        self.assertTrue(any('external writer after crash' in p.read_text() for p in (self.page / '.board-trash' / status['transactionId'] / 'external-current').rglob('index.html')))

    def test_clone_and_image_failure_leave_no_orphan_business_resources(self):
        import base64
        from server import canvas_transactions as transactions
        params = self.params(); state = copy.deepcopy(params['baseline'])
        state['nodes'].append(dict(state['nodes'][0], id='duplicate', boardId='b_duplicate', originBoardId='b_home', src='boards/duplicate/index.html', cloneFrom='boards/home/index.html'))
        image = b'image bytes'
        state['nodes'].append(dict(id='image', type='image', x=0, y=0, width=30, height=30, src='data:image/png;base64,' + base64.b64encode(image).decode()))
        original = transactions.install_operation
        def fail(page, transaction, operation, ordinal):
            if operation['target'].endswith('canvas-data.js'):
                raise OSError('cannot publish layout')
            return original(page, transaction, operation, ordinal)
        with patch.object(transactions, 'install_operation', fail):
            with self.assertRaises(OSError): save_canvas(self.root, dict(params, state=state))
        self.assertFalse((self.version / 'boards/duplicate').exists())
        import hashlib
        self.assertFalse((self.version / 'assets' / (hashlib.sha256(image).hexdigest() + '.png')).exists())
        self.assertEqual(self.params()['baseline'], params['baseline'])

    def test_real_process_exit_between_directory_renames_and_during_rollback(self):
        import subprocess
        import sys
        first = self.create()
        (self.board / 'index.html').write_text('<h1>draft before real crash</h1>')
        before = self.layout.read_bytes()
        script = '''
import json,os,sys
from pathlib import Path
from server import canvas_transactions as t
from server.board_revisions import restore_revision
x=json.load(sys.stdin)
original=Path.replace
if x['mode']=='gap':
 def replace(path,target):
  if str(target).endswith('/v1/boards/home') and '/after/' in str(path): os._exit(73)
  return original(path,target)
 Path.replace=replace
else:
 install=t.install_operation
 def fail(page,tx,op,i):
  if op['target'].endswith('canvas-data.js'): raise OSError('force rollback')
  return install(page,tx,op,i)
 t.install_operation=fail
 copier=t.copy_resource
 def copy(source,destination):
  copier(source,destination)
  if destination.name.startswith('rollback-'): os._exit(73)
 t.copy_resource=copy
restore_revision(Path(x['root']),x['params'])
'''
        for mode in ('gap', 'rollback'):
            result = subprocess.run([sys.executable, '-c', script], input=json.dumps(dict(root=str(self.root), params=self.params(revisionId=first['revisionId']), mode=mode)), text=True, capture_output=True, timeout=30)
            self.assertEqual(result.returncode, 73, result.stderr)
            recover_transactions(self.page)
            self.assertEqual(self.layout.read_bytes(), before)
            self.assertIn('draft before real crash', (self.board / 'index.html').read_text())
            self.assertEqual(len(self.history()), 1)
        self.assertEqual([p.name for p in (self.page / '.board-transactions').iterdir()], ['lock'])

    def test_shared_module_dependency_and_import_map_are_in_package(self):
        shared = self.version / 'shared'; shared.mkdir()
        (shared / 'util.js').write_text('export const value = 42;')
        (self.board / 'app.js').write_text('import {value} from "../../shared/util.js"; import {answer} from "answer"; console.log(value, answer);')
        (self.board / 'index.html').write_text('<!doctype html><script type="importmap">{"imports":{"answer":"./modules/answer.js"}}</script><script type="module" src="app.js"></script><h1>Mapped modules</h1>')
        first = self.create()
        snapshot = self.page / 'board-history/b_home' / first['revisionId']
        self.assertTrue((snapshot / 'files/shared/util.js').is_file())
        self.assertTrue((snapshot / 'files/boards/home/modules/answer.js').is_file())

    def test_broken_draft_does_not_destroy_last_runnable_snapshot(self):
        first = self.create()
        (self.board / 'app.js').write_text('const incomplete = ;')
        with self.assertRaises(ValueError): create_revision(self.root, self.params())
        self.assertEqual(len(self.history()), 1)
        self.assertEqual(self.params()['baseline']['nodes'][0]['boardRevisionId'], first['revisionId'])
        result = preview_revision(self.root, dict(projectId='demo', pageId='design', boardId='b_home', revisionId=first['revisionId']))
        self.assertEqual(result['manifest']['revisionId'], first['revisionId'])

    def test_unknown_revision_pointer_is_not_written_by_autosave(self):
        params = self.params(); state = copy.deepcopy(params['baseline'])
        state['nodes'][0]['boardRevisionId'] = 'br_missing'
        before = self.layout.read_bytes()
        with self.assertRaises(ValueError): save_canvas(self.root, dict(params, state=state))
        self.assertEqual(self.layout.read_bytes(), before)

    def test_restore_repairs_broken_work_and_retains_draft_without_publishing_invalid_revision(self):
        first = self.create()
        (self.board / 'app.js').write_text('const incomplete = ;')
        code, restored = restore_revision(self.root, self.params(revisionId=first['revisionId']))
        self.assertEqual(code, 200, restored)
        self.assertIsNone(restored['recoveryRevisionId'])
        self.assertFalse(restored['recoveryDraft']['runnable'])
        draft = self.page / restored['recoveryDraft']['path']
        self.assertEqual((draft / 'files/boards/home/app.js').read_text(), 'const incomplete = ;')
        self.assertIn('import', (self.board / 'app.js').read_text())
        self.assertEqual(len(self.history()), 2)
