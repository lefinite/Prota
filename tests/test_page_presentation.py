"""Presentation metadata must survive sync without altering historical page assets."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from server import bridge


class PagePresentationTests(unittest.TestCase):
    def test_normalization_keeps_legacy_default_and_preserves_canvas(self):
        for raw, expected in [(None, 'mobile'), ('', 'mobile'), ('mobile', 'mobile'),
                              ('web', 'web'), (' CANVAS ', 'canvas'), ('auto', 'mobile'), ('unknown', 'mobile')]:
            with self.subTest(raw=raw):
                self.assertEqual(bridge.normalize_page_target_device(raw), expected)

    def test_sync_and_snapshot_preserve_resolved_modes_and_existing_versions(self):
        with tempfile.TemporaryDirectory(prefix='prota-presentation-') as temporary:
            root = Path(temporary)
            pages = [{'id': 'legacy'}, {'id': 'reader', 'targetDevice': 'mobile'},
                     {'id': 'website', 'targetDevice': 'web'}, {'id': 'widget', 'targetDevice': 'canvas', 'pageMode': 'infinite-canvas'}]
            originals = {}
            for page in pages:
                page.update(versions=['v1', 'v2'], activeVersion='v2')
                for version in page['versions']:
                    folder = root/'src/pages/demo'/page['id']/version
                    folder.mkdir(parents=True)
                    for filename, content in [('index.html', '<h1>Existing design</h1>'), ('styles.css', 'body {color: red}'), ('app.js', '// original')]:
                        file = folder/filename
                        file.write_text(content)
                        originals[file] = file.read_bytes()
            (root/'data').mkdir()
            (root/'data/projects.json').write_text(json.dumps({'projects': [{'id': 'demo', 'pages': pages}], 'activeProjectId': 'demo', 'activePageId': 'widget'}))
            with patch.object(bridge, 'get_project_root', return_value=str(root)):
                result = bridge.sync_projects()
                result_again = bridge.sync_projects()
            self.assertEqual(result, result_again)
            self.assertEqual(result['projects'][0]['pages'][-1]['pageMode'], 'infinite-canvas')
            self.assertEqual([page['targetDevice'] for page in result['projects'][0]['pages']], ['mobile', 'mobile', 'web', 'canvas'])
            self.assertEqual(result, json.loads((root/'data/projects.snapshot.json').read_text()))
            snapshot = (root/'portal/shell.js').read_text().split('const defaultData = ', 1)[1].split(';\n', 1)[0]
            self.assertEqual(result, json.loads(snapshot))
            self.assertTrue(all(page['activeVersion'] == 'v2' for page in result['projects'][0]['pages']))
            for file, original in originals.items():
                self.assertEqual(file.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
