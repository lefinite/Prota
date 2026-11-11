import json
import tempfile
import unittest
from pathlib import Path
from copy import deepcopy
from server.tracking_review_http import apply_edit


class TrackingEditsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.scope = {'projectId': 'demo', 'pageId': 'auth', 'version': 'v1'}
        self.file = self.root / 'src/pages/demo/auth/v1/tracking/events.json'
        self.file.parent.mkdir(parents=True)
        self.original = {'scope': self.scope, 'screens': [{'id': 'login', 'status': 'needs_review', 'reason': '需要登录'}], 'events': [{'id': 'first', 'targets': []}, {'id': 'second', 'targets': []}]}
        self.file.write_text(json.dumps(self.original))

    def edit(self, action, identity, expected=None):
        return apply_edit(self.root, {'scope': self.scope, 'expectedManifest': expected or json.loads(self.file.read_text()), 'action': action, 'id': identity})

    def test_review_and_deletion_are_persisted_and_reversible(self):
        code, result = self.edit('valid_screen', 'login')
        self.assertEqual(code, 200)
        self.assertTrue(result['manifest']['screens'][0]['reviewedByUser'])
        _, result = self.edit('valid_event', 'first')
        self.assertEqual(result['manifest']['events'][0]['reviewStatus'], 'valid')
        _, result = self.edit('delete_event', 'first')
        self.assertEqual([e['id'] for e in result['manifest']['events']], ['second'])
        self.assertEqual(result['manifest']['review']['deletedEvents'][0]['event']['id'], 'first')
        _, result = self.edit('restore_event', 'first')
        self.assertEqual([e['id'] for e in result['manifest']['events']], ['first', 'second'])
        self.assertEqual(json.loads(self.file.read_text()), result['manifest'])

    def test_review_confirmation_is_one_way(self):
        self.edit('valid_event', 'first')
        current = self.file.read_bytes()
        for action, identity in [('review_event', 'first'), ('review_screen', 'login')]:
            with self.assertRaises(ValueError):
                self.edit(action, identity)
            self.assertEqual(self.file.read_bytes(), current)

    def test_stale_request_does_not_overwrite_agent_changes(self):
        self.edit('valid_event', 'first')
        current = self.file.read_bytes()
        code, _ = self.edit('delete_event', 'second', self.original)
        self.assertEqual(code, 409)
        self.assertEqual(self.file.read_bytes(), current)

    def test_paths_and_other_versions_are_not_writable(self):
        for value in ['../escape', '/absolute', 'v1/../../v2']:
            payload = {'scope': dict(self.scope, version=value), 'expectedManifest': self.original, 'action': 'delete_event', 'id': 'first'}
            with self.assertRaises(ValueError):
                apply_edit(self.root, payload)
        outside = self.root / 'outside.json'
        outside.write_text(self.file.read_text())
        self.file.unlink()
        self.file.symlink_to(outside)
        with self.assertRaises(ValueError):
            self.edit('delete_event', 'first')
