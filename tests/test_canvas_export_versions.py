import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile

from server.bridge import build_page_zip_bytes
from server.canvas_domain import migrate_document
from server.canvas_store import PREFIX, save_canvas


class CanvasExportSchemaTests(unittest.TestCase):
    def test_v2_zip_is_self_contained_and_never_publishes_migration_backups(self):
        repository = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='prota-v2-zip-') as temporary:
            root = Path(temporary)
            version = root / 'src/pages/demo/design/v1'
            shutil.copytree(repository / 'src/templates/infinite-canvas', version)
            shutil.copytree(repository / 'tests/fixtures/canvas-v1', version, dirs_exist_ok=True)
            (root / 'data').mkdir()
            (root / 'workspace.json').write_text(json.dumps({'id': 'schema-export'}))
            (root / 'data/canvas-features.json').write_text(json.dumps({'testWorkspaceIds': ['schema-export'], 'overrides': {'canvasSchemaV2': True}}))
            source = json.loads((version / 'canvas-data.js').read_text()[len(PREFIX):].strip().removesuffix(';'))
            state = migrate_document(source, 'demo', 'design')
            state['nodes'][0]['x'] += 1
            self.assertEqual(save_canvas(root, dict(projectId='demo', pageId='design', version='v1', revision=7, baseline=source, state=state))[0], 200)
            archive = zipfile.ZipFile(io.BytesIO(build_page_zip_bytes(root, 'demo', 'design', 'v1')))
            names = archive.namelist()
            for name in ['index.html', 'canvas-domain.js', 'canvas-core.js', 'canvas-data.js', 'boards/home/index.html', 'boards/home/styles.css', 'boards/home/app.js', 'assets/reference.svg']:
                self.assertIn('v1/' + name, names)
            self.assertFalse(any('.canvas-migrations' in name or '.canvas-history' in name for name in names))
            persisted = json.loads(archive.read('v1/canvas-data.js').decode()[len(PREFIX):].strip().removesuffix(';'))
            self.assertEqual(persisted['schemaVersion'], 2)
            self.assertEqual(persisted['nodes'][0]['boardId'], state['nodes'][0]['boardId'])
