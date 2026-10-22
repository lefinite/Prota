import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from server import workspace, deployer


class WindowsRuntimeTests(unittest.TestCase):
    @unittest.skipUnless(os.name == 'nt', 'Windows process API')
    def test_process_liveness_does_not_terminate_current_process(self):
        self.assertTrue(workspace.process_alive(os.getpid()))
        self.assertFalse(workspace.process_alive(4294967294))

    @unittest.skipUnless(os.name == 'nt', 'Windows CLI configuration path')
    def test_reads_vercel_cli_windows_persistent_login(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp) / 'xdg.data' / 'com.vercel.cli'
            directory.mkdir(parents=True)
            (directory / 'auth.json').write_text(json.dumps({'token': 'test-device-login'}))
            (directory / 'config.json').write_text(json.dumps({'currentTeam': 'test-team'}))
            with patch.dict(os.environ, {'APPDATA': tmp, 'VERCEL_TOKEN': '', 'VERCEL_ORG_ID': '',
                                         'XDG_DATA_HOME': str(Path(tmp) / 'xdg.data'),
                                         'XDG_CONFIG_HOME': str(Path(tmp) / 'xdg.config')}):
                self.assertEqual(deployer.read_vercel_auth(), ('test-device-login', 'test-team'))
