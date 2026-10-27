"""S0 archive contract: exercise real disk writes only in a disposable workspace."""
import copy
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from server.canvas_store import PREFIX, save_canvas, upgrade_runtime, validate_state


class CanvasBaselineTests(unittest.TestCase):
    def test_archived_v1_edit_save_upgrade_and_conflict_preserve_business_files(self):
        repository = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='prota-baseline-') as temporary:
            root = Path(temporary)
            version = root / 'src/pages/demo/design/v1'
            shutil.copytree(repository / 'tests/fixtures/canvas-v1', version)
            data = version / 'canvas-data.js'
            original = data.read_bytes()
            state = json.loads(original.decode().strip()[len(PREFIX):].removesuffix(';'))
            baseline = copy.deepcopy(state)
            business = {p.relative_to(version): p.read_bytes() for p in version.rglob('*') if p.is_file() and p != data}
            state['nodes'][2]['text'] = '编辑后标题'
            params = dict(projectId='demo', pageId='design', version='v1', revision=7, baseline=baseline, state=state)
            self.assertEqual(save_canvas(root, params), (200, {'revision': 8}))
            persisted = json.loads(data.read_text().strip()[len(PREFIX):].removesuffix(';'))
            expected = copy.deepcopy(state)
            expected['revision'] = 8
            self.assertEqual(persisted, expected)
            self.assertIn(original, [p.read_bytes() for p in (version / '.canvas-history').glob('*.js')])
            saved = data.read_bytes()
            self.assertEqual(save_canvas(root, params)[0], 409)
            self.assertEqual(data.read_bytes(), saved)
            upgrade_runtime(root, params, repository / 'src/templates/infinite-canvas')
            self.assertEqual(data.read_bytes(), saved)
            for relative, content in business.items():
                self.assertEqual((version / relative).read_bytes(), content)

    def test_server_capacity_matches_v4_client_boundary(self):
        state = dict(schemaVersion=1, revision=0, viewport=dict(x=0, y=0, zoom=1), nodes=[
            dict(id=f'n_{i}', type='rect', x=i * 20, y=0, width=16, height=16) for i in range(1000)
        ])
        validate_state(state)
        state['nodes'].append(dict(state['nodes'][0], id='overflow'))
        with self.assertRaises(ValueError):
            validate_state(state)
