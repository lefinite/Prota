import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from server.canvas_store import PREFIX, save_canvas
from server.canvas_domain import migrate_document


class CanvasSchemaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='prota-schema-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.directory = self.root / 'src/pages/demo/design/v1'
        self.directory.mkdir(parents=True)
        (self.root / 'data').mkdir()
        (self.root / 'workspace.json').write_text(json.dumps({'id': 'schema-test'}))
        (self.root / 'data/canvas-features.json').write_text(json.dumps({'testWorkspaceIds': ['schema-test'], 'overrides': {'canvasSchemaV2': True}}))
        self.file = self.directory / 'canvas-data.js'
        self.v1 = dict(schemaVersion=1, revision=0, viewport=dict(x=0, y=0, zoom=1), extra={'keep': True}, nodes=[dict(id='home', type='board', x=-100, y=20, width=390, height=844, src='boards/home/index.html')])
        self.raw = (PREFIX + json.dumps(self.v1) + ';\n').encode()
        self.file.write_bytes(self.raw)

    def params(self):
        state = migrate_document(self.v1, 'demo', 'design')
        state['nodes'][0]['x'] += 10
        return dict(projectId='demo', pageId='design', version='v1', revision=0, baseline=copy.deepcopy(self.v1), state=state)

    def test_first_edit_creates_durable_byte_exact_backup_and_retains_unknown_data(self):
        self.assertEqual(self.file.read_bytes(), self.raw)
        code, result = save_canvas(self.root, self.params())
        self.assertEqual(code, 200)
        persisted = json.loads(self.file.read_text()[len(PREFIX):].strip().removesuffix(';'))
        self.assertEqual(persisted['schemaVersion'], 2)
        self.assertEqual(persisted['extra'], self.v1['extra'])
        self.assertEqual(persisted['nodes'][0]['boardId'], self.params()['state']['nodes'][0]['boardId'])
        self.assertIn(self.raw, [p.read_bytes() for p in (self.directory / '.canvas-migrations').rglob('*.js')])
        self.assertEqual(result['revision'], 1)

    def test_old_client_cannot_silently_downgrade_v2_or_drop_its_fields(self):
        save_canvas(self.root, self.params())
        disk = json.loads(self.file.read_text()[len(PREFIX):].strip().removesuffix(';'))
        old = copy.deepcopy(self.v1); old['revision'] = 1
        code, _ = save_canvas(self.root, dict(projectId='demo', pageId='design', version='v1', revision=1, baseline=disk, state=old))
        self.assertEqual(code, 409)
        self.assertEqual(json.loads(self.file.read_text()[len(PREFIX):].strip().removesuffix(';')), disk)

    def test_backup_failure_does_not_replace_source(self):
        original = Path.write_bytes
        def fail(path, data):
            if '.canvas-migrations' in path.parts:
                raise OSError('disk full')
            return original(path, data)
        with patch.object(Path, 'write_bytes', fail):
            with self.assertRaises(OSError): save_canvas(self.root, self.params())
        self.assertEqual(self.file.read_bytes(), self.raw)

    def test_migration_backup_survives_layout_history_rotation(self):
        save_canvas(self.root, self.params())
        for _ in range(12):
            disk = json.loads(self.file.read_text()[len(PREFIX):].strip().removesuffix(';'))
            next_state = copy.deepcopy(disk); next_state['nodes'][0]['x'] += 1
            self.assertEqual(save_canvas(self.root, dict(projectId='demo', pageId='design', version='v1', revision=disk['revision'], baseline=disk, state=next_state))[0], 200)
        self.assertEqual(len(list((self.directory / '.canvas-history').glob('*.js'))), 10)
        self.assertIn(self.raw, [p.read_bytes() for p in (self.directory / '.canvas-migrations').rglob('*.js')])

    def test_conflict_and_symlink_fail_closed(self):
        params = self.params(); params['baseline']['extra'] = {}
        self.assertEqual(save_canvas(self.root, params)[0], 409)
        self.assertFalse((self.directory / '.canvas-migrations').exists())
        outside = self.root / 'outside'; outside.mkdir()
        (self.directory / '.canvas-migrations').symlink_to(outside)
        with self.assertRaises(ValueError): save_canvas(self.root, self.params())
        self.assertEqual(list(outside.iterdir()), [])

    def test_disabled_rollout_rejects_first_migration_but_keeps_legacy_save(self):
        (self.root / 'data/canvas-features.json').write_text('{}')
        self.assertEqual(save_canvas(self.root, self.params())[0], 409)
        self.assertEqual(self.file.read_bytes(), self.raw)
        self.assertFalse((self.directory / '.canvas-migrations').exists())
        state = copy.deepcopy(self.v1); state['nodes'][0]['x'] += 1
        self.assertEqual(save_canvas(self.root, dict(projectId='demo', pageId='design', version='v1', revision=0, baseline=self.v1, state=state))[0], 200)

    def test_existing_logical_board_identity_cannot_change_in_place(self):
        save_canvas(self.root, self.params())
        disk = json.loads(self.file.read_text()[len(PREFIX):].strip().removesuffix(';'))
        state = copy.deepcopy(disk); state['nodes'][0]['boardId'] = 'b_replaced'
        with self.assertRaises(ValueError):
            save_canvas(self.root, dict(projectId='demo', pageId='design', version='v1', revision=1, baseline=disk, state=state))
        self.assertEqual(json.loads(self.file.read_text()[len(PREFIX):].strip().removesuffix(';')), disk)

    def test_external_write_during_backup_and_rename_failure_preserve_source(self):
        from server import canvas_store
        external = copy.deepcopy(self.v1); external['extra']['external'] = True
        external_bytes = (PREFIX + json.dumps(external) + ';\n').encode()
        original_backup = canvas_store.migration_backup
        def interleaved(directory, source):
            original_backup(directory, source)
            self.file.write_bytes(external_bytes)
        with patch.object(canvas_store, 'migration_backup', interleaved):
            self.assertEqual(save_canvas(self.root, self.params())[0], 409)
        self.assertEqual(self.file.read_bytes(), external_bytes)
        self.assertFalse(self.file.with_suffix('.js.tmp').exists())
        self.file.write_bytes(self.raw)
        original_replace = Path.replace
        def fail(path, target):
            if Path(target).resolve() == self.file.resolve():
                raise OSError('cannot commit')
            return original_replace(path, target)
        with patch.object(Path, 'replace', fail):
            with self.assertRaises(OSError): save_canvas(self.root, self.params())
        self.assertEqual(self.file.read_bytes(), self.raw)
        self.assertFalse(self.file.with_suffix('.js.tmp').exists())
