import copy
import json
import tempfile
import unittest
from pathlib import Path
from server.canvas_store import save_canvas, PREFIX
from server.canvas_autosave import reconcile, read_journal, read_document, changes, apply_operations


class CanvasAutosaveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.context = dict(projectId='demo', pageId='design', version='v1')
        self.directory = self.root / 'src/pages/demo/design/v1'
        self.directory.mkdir(parents=True)
        self.base = dict(schemaVersion=1, revision=0, viewport=dict(x=0, y=0, zoom=1), nodes=[dict(id='a', type='text', x=0, y=0, width=200, height=100, text='before')])
        self.write(self.base)

    def write(self, document):
        (self.directory / 'canvas-data.js').write_text(PREFIX + json.dumps(document) + ';')

    def save(self, before, after):
        return save_canvas(self.root, dict(self.context, baseline=before, revision=before['revision'], state=after, autosave=True))

    def test_agent_and_manual_edits_are_written_immediately_and_reconciled_without_browser(self):
        reconcile(self.root, self.context, 'run-1', begin=True)
        ours = copy.deepcopy(self.base); ours['nodes'][0]['text'] = 'manual input'
        theirs = copy.deepcopy(self.base); theirs['nodes'][0]['width'] = 500
        self.write(theirs)
        status, result = self.save(self.base, ours)
        self.assertEqual(status, 200)
        self.assertTrue(result['durable'])
        self.assertEqual(read_document(self.directory)['nodes'][0]['text'], 'manual input')
        self.assertEqual(read_document(self.directory)['nodes'][0]['width'], 500)
        # Agent later writes its stale document after the user closed the iframe.
        theirs['nodes'].append(dict(theirs['nodes'][0], id='agent-added', text='Agent addition'))
        self.write(theirs)
        reconcile(self.root, self.context, 'run-1')
        persisted = read_document(self.directory)
        self.assertEqual(persisted['nodes'][0]['text'], 'manual input')
        self.assertEqual(persisted['nodes'][0]['width'], 500)
        self.assertEqual(persisted['nodes'][1]['id'], 'agent-added')
        self.assertEqual(read_journal(self.directory)['runs'], [])

    def test_partial_agent_write_acknowledges_only_after_durable_receipt_and_recovers(self):
        reconcile(self.root, self.context, 'run-1', begin=True)
        (self.directory / 'canvas-data.js').write_text('window.PROTA_CANVAS = {')
        ours = copy.deepcopy(self.base); ours['nodes'][0]['text'] = 'input during partial write'
        status, result = self.save(self.base, ours)
        self.assertEqual(status, 202)
        self.assertTrue(result['deferred'])
        self.assertTrue(read_journal(self.directory)['pending'])
        # A separate process/restart can recover using only files on disk.
        self.write(self.base)
        reconcile(self.root, self.context, 'run-1')
        self.assertEqual(read_document(self.directory)['nodes'][0]['text'], 'input during partial write')
        self.assertFalse(read_journal(self.directory)['pending'])

    def test_multiple_saves_and_two_agents_keep_all_manual_fields_until_both_finish(self):
        for run in ('run-a', 'run-b'):
            reconcile(self.root, self.context, run, begin=True)
        ours = copy.deepcopy(self.base); ours['nodes'][0]['text'] = 'typed'
        _, first = self.save(self.base, ours)
        second = copy.deepcopy(first['state']); second['nodes'][0]['x'] = 99
        self.save(first['state'], second)
        for run in ('run-a', 'run-b'):
            self.write(self.base)
            reconcile(self.root, self.context, run)
            saved = read_document(self.directory)['nodes'][0]
            self.assertEqual((saved['text'], saved['x']), ('typed', 99))
        self.assertEqual(read_journal(self.directory)['runs'], [])
        # A future Agent task can intentionally edit a previously protected field.
        reconcile(self.root, self.context, 'run-new', begin=True)
        self.write(self.base)
        reconcile(self.root, self.context, 'run-new')
        self.assertEqual(read_document(self.directory)['nodes'][0]['text'], 'before')

    def test_edit_of_agent_added_node_protects_only_manually_changed_field(self):
        reconcile(self.root, self.context, 'run', begin=True)
        before = copy.deepcopy(self.base)
        before['nodes'].append(dict(before['nodes'][0], id='new'))
        self.write(before)
        ours = copy.deepcopy(before); ours['nodes'][1]['text'] = 'manual'
        self.save(before, ours)
        theirs = copy.deepcopy(before); theirs['nodes'][1]['width'] = 600
        self.write(theirs)
        reconcile(self.root, self.context, 'run')
        saved = read_document(self.directory)['nodes'][1]
        self.assertEqual((saved['text'], saved['width']), ('manual', 600))

    def test_latest_manual_value_and_deletion_survive_agent_rewrites(self):
        reconcile(self.root, self.context, 'run', begin=True)
        ours = copy.deepcopy(self.base); ours['nodes'][0]['text'] = 'one'
        _, first = self.save(self.base, ours)
        ours = copy.deepcopy(first['state']); ours['nodes'][0]['text'] = 'two'
        _, second = self.save(first['state'], ours)
        self.write(self.base)
        reconcile(self.root, self.context)
        self.assertEqual(read_document(self.directory)['nodes'][0]['text'], 'two')
        deleted = copy.deepcopy(second['state']); deleted['nodes'] = []
        self.save(second['state'], deleted)
        self.write(self.base)
        reconcile(self.root, self.context, 'run')
        self.assertEqual(read_document(self.directory)['nodes'], [])

    def test_atomic_receipt_failure_does_not_acknowledge_or_change_layout(self):
        from unittest.mock import patch
        ours = copy.deepcopy(self.base); ours['nodes'][0]['text'] = 'manual'
        with patch('server.canvas_autosave.atomic_bytes', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.save(self.base, ours)
        self.assertEqual(read_document(self.directory), self.base)

    def test_symlink_receipt_is_rejected(self):
        outside = self.root / 'outside'; outside.write_text('keep')
        (self.directory / '.canvas-autosave.json').symlink_to(outside)
        with self.assertRaises(ValueError):
            self.save(self.base, self.base)
        self.assertEqual(outside.read_text(), 'keep')


if __name__ == '__main__':
    unittest.main()
