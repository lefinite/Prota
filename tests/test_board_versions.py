import copy
import unittest
from unittest.mock import patch

from tests import test_board_revisions as fixtures
from server.board_revisions import create_revision, list_revisions
from server.canvas_store import save_canvas


class BoardVersionTests(unittest.TestCase):
    setUp = fixtures.BoardRevisionTests.setUp
    params = fixtures.BoardRevisionTests.params

    def catalog(self):
        return list_revisions(self.root, dict(projectId='demo', pageId='design', boardId='b_home'))['versions']

    def manage(self, action, target='v1'):
        code, result = create_revision(self.root, self.params(versionAction=action, targetVersion=target))
        self.assertEqual(code, 200, result)
        return result

    def test_first_fork_is_v2_and_switch_preserves_each_versions_latest_work(self):
        original = (self.board / 'index.html').read_text()
        others = copy.deepcopy(self.params()['baseline']['nodes'][1:])
        self.assertEqual(self.catalog(), {'v1': {'revisionId': None}})
        self.assertEqual(self.manage('fork')['boardVersionId'], 'v2')
        self.assertEqual(list(self.catalog()), ['v1', 'v2'])
        (self.board / 'index.html').write_text('<h1>V2 edited</h1>')
        self.assertEqual(self.manage('switch', 'v1')['boardVersionId'], 'v1')
        self.assertEqual((self.board / 'index.html').read_text(), original)
        self.assertEqual(list(self.catalog()), ['v1', 'v2'], 'switch does not create business versions')
        (self.board / 'index.html').write_text('<h1>V1 edited</h1>')
        self.manage('switch', 'v2')
        self.assertEqual((self.board / 'index.html').read_text(), '<h1>V2 edited</h1>')
        self.assertEqual(self.manage('fork', 'v1')['boardVersionId'], 'v3')
        self.assertEqual((self.board / 'index.html').read_text(), '<h1>V1 edited</h1>')
        self.assertEqual(self.params()['baseline']['nodes'][1:], others)

    def test_current_switch_is_noop_and_delete_keeps_one_and_monotonic_numbers(self):
        before = self.layout.read_bytes()
        self.manage('switch')
        self.assertEqual(self.layout.read_bytes(), before)
        with self.assertRaisesRegex(ValueError, '至少保留'):
            self.manage('delete')
        self.manage('fork')
        (self.board / 'index.html').write_text('<h1>V2 latest</h1>')
        self.manage('delete', 'v1')
        self.assertEqual(list(self.catalog()), ['v2'])
        self.assertEqual((self.board / 'index.html').read_text(), '<h1>V2 latest</h1>')
        self.assertEqual(self.manage('fork', 'v2')['boardVersionId'], 'v3')
        self.assertEqual(self.manage('delete', 'v3')['boardVersionId'], 'v2')
        self.assertEqual(self.manage('fork', 'v2')['boardVersionId'], 'v4')

    def test_invalid_target_stale_baseline_and_save_cannot_change_active_version(self):
        self.manage('fork')
        before = self.layout.read_bytes()
        with self.assertRaises(ValueError):
            self.manage('switch', '../bad')
        params = self.params(versionAction='switch', targetVersion='v1'); params['revision'] -= 1
        self.assertEqual(create_revision(self.root, params)[0], 409)
        params = self.params(); state = copy.deepcopy(params['baseline']); state['nodes'][0]['boardVersionId'] = 'v1'
        with self.assertRaises(ValueError):
            save_canvas(self.root, dict(params, state=state))
        self.assertEqual(self.layout.read_bytes(), before)

    def test_legacy_snapshot_history_maps_to_versions_without_recovery_duplicates(self):
        code, _ = create_revision(self.root, self.params())
        self.assertEqual(code, 200)
        (self.board / 'index.html').write_text('<h1>Old second snapshot</h1>')
        create_revision(self.root, self.params())
        self.assertEqual(list(self.catalog()), ['v1', 'v2'])
        result = self.manage('switch', 'v1')
        self.assertEqual(result['boardVersionId'], 'v1')
        self.assertIn('Old', (self.board / 'index.html').read_text())
        self.assertEqual(list(self.catalog()), ['v1', 'v2'])

    def test_failed_commit_preserves_catalog_and_work(self):
        from server import canvas_transactions as transactions
        before = self.layout.read_bytes()
        original = transactions.install_operation
        def fail(page, transaction, operation, ordinal):
            if operation['target'].endswith('canvas-data.js'):
                raise OSError('disk full')
            return original(page, transaction, operation, ordinal)
        with patch.object(transactions, 'install_operation', fail):
            with self.assertRaises(OSError):
                self.manage('fork')
        self.assertEqual(self.layout.read_bytes(), before)
        self.assertEqual(self.catalog(), {'v1': {'revisionId': None}})

    def test_switch_retains_broken_draft_without_creating_visible_versions(self):
        self.manage('fork')
        (self.board / 'app.js').write_text('const broken = ;')
        result = self.manage('switch', 'v1')
        self.assertFalse(result['recoveryDraft']['runnable'])
        self.assertEqual(list(self.catalog()), ['v1', 'v2'])
        draft = self.page / result['recoveryDraft']['path']
        self.assertEqual((draft / 'files/boards/home/app.js').read_text(), 'const broken = ;')
        self.manage('switch', 'v2')
        self.assertNotIn('broken', (self.board / 'app.js').read_text())
