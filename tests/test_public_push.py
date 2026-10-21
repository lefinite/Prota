import json
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'tools/check-public-push.py'

class PublicPushTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Product test')
        self.git('config', 'user.email', 'test@example.invalid')

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args], text=True, stderr=subprocess.DEVNULL).strip()

    def commit(self, path, content):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(content)
        self.git('add', '.')
        self.git('commit', '-m', 'fixture')
        return self.git('rev-parse', 'HEAD')

    def check(self, revision):
        return subprocess.run(['python3', str(SCRIPT)], cwd=self.root, input=f'refs/heads/main {revision} refs/heads/main '+('0'*40)+'\n', text=True, capture_output=True)

    def test_clean_commit_does_not_publish_untracked_business_data(self):
        revision = self.commit('product.txt', 'public product')
        (self.root / '.env').write_text('private untracked file')
        self.assertEqual(self.check(revision).returncode, 0)

    def test_runtime_history_cannot_be_hidden_by_deleting_at_tip(self):
        self.commit('shares/company.html', 'private business')
        self.git('rm', 'shares/company.html')
        revision = self.commit('product.txt', 'clean tip')
        self.assertNotEqual(self.check(revision).returncode, 0)

    def test_secret_in_intermediate_commit_is_rejected(self):
        self.commit('config.txt', 'sk-' + 'A'*30)
        revision = self.commit('config.txt', 'removed credential')
        self.assertNotEqual(self.check(revision).returncode, 0)

    def test_legacy_root_is_rejected_even_if_its_files_look_generic(self):
        revision = self.commit('product.txt', 'generic')
        (self.root / '.git/prota-safety.json').write_text(json.dumps({'legacyRoots': [revision]}))
        self.assertNotEqual(self.check(revision).returncode, 0)

if __name__ == '__main__':
    unittest.main()
