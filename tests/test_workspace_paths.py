"""Cross-runtime path agreement for fresh installations, including macOS /var."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

class WorkspacePathTests(unittest.TestCase):
    def test_python_and_node_initialize_the_same_empty_external_workspace(self):
        app = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='prota-fresh-path-') as temporary:
            env = {**os.environ, 'READIFY_CONFIG_DIR': temporary}
            env.pop('READIFY_WORKSPACE', None)
            py = subprocess.check_output([sys.executable, '-c', 'from server.workspace import workspace_root; print(workspace_root())'], cwd=app, env=env, text=True).strip()
            node = subprocess.check_output(['node', '--input-type=module', '-e', "import {getWorkspaceRoot} from './server/workspace.mjs'; console.log(getWorkspaceRoot())"], cwd=app, env=env, text=True).strip()
            self.assertEqual(py, node)
            self.assertNotEqual(Path(py), app)
            self.assertEqual(json.loads((Path(py)/'data/projects.json').read_text())['projects'], [])

if __name__ == '__main__':
    unittest.main()
