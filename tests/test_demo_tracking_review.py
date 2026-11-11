import unittest
import tempfile
import json
from pathlib import Path
from server.demo_tracking_review import build_review_bundle


class DemoTrackingReviewTests(unittest.TestCase):
    def test_viewer_is_self_contained_and_binds_board_targets(self):
        spec = {
            'schemaVersion': 1,
            'scope': {'projectId': 'p', 'pageId': 'canvas', 'version': 'v2'},
            'events': [{
                'id': 'login_submit', 'title': '提交登录',
                'targets': [
                    {'kind': 'canvas-board', 'boardId': 'board-a',
                     'path': 'boards/board-a/index.html',
                     'status': 'bound',
                     'anchor': {'method': 'data-attribute', 'value': 'login-submit'}}
                ]
            }]
        }
        viewer, bridges = build_review_bundle('v2', spec)
        self.assertIn('v2/index.html', viewer)
        self.assertIn('login_submit', viewer)
        self.assertIn('index.html', bridges)
        self.assertIn('boards/board-a/index.html', bridges)
        self.assertIn('prota:offline-review-rect', bridges['index.html'])
        self.assertIn('login-submit', bridges['boards/board-a/index.html'])
        self.assertNotIn('__TOKEN__', viewer)
        self.assertNotIn('__TARGETS__', bridges['boards/board-a/index.html'])

    def test_malformed_or_missing_manifest_has_safe_empty_review(self):
        viewer, bridges = build_review_bundle('v1', None)
        self.assertIn('v1/index.html', viewer)
        self.assertIn('index.html', bridges)
        self.assertEqual(set(bridges), {'index.html'})

    def test_v2_share_keeps_events_beyond_first_screen_budget(self):
        from server.bridge import read_share_tracking
        with tempfile.TemporaryDirectory() as root:
            folder = Path(root) / 'tracking'
            folder.mkdir()
            spec = {'schemaVersion': 2, 'scope': {'pageId': 'flow'},
                    'screens': [{'id': 'login'}, {'id': 'register'}],
                    'events': [{'id': f'event_{i}', 'targets': []} for i in range(16)]}
            (folder / 'events.json').write_text(json.dumps(spec))
            self.assertEqual(len(read_share_tracking(root)['events']), 16)
            spec['screens'] = 'invalid'
            (folder / 'events.json').write_text(json.dumps(spec))
            self.assertIsNone(read_share_tracking(root))

    def test_path_traversal_is_ignored(self):
        manifest = {'events': [{'id': 'a', 'targets': [
            {'path': '../outside.html', 'status': 'bound',
             'anchor': {'method': 'selector', 'value': '#outside'}},
            {'path': 'boards/a/index.html', 'status': 'needs_review',
             'anchor': {'method': 'selector', 'value': '#stale'}}]}]}
        _, bridges = build_review_bundle('v1', manifest)
        self.assertEqual(set(bridges), {'index.html'})


if __name__ == '__main__':
    unittest.main()
