"""Regression: direct publishing must not modify a Git repository."""
import inspect
import unittest
from server import deployer

class WorkspacePublishTests(unittest.TestCase):
    def test_no_git_mutation_or_legacy_publish_checkout_remains(self):
        source = inspect.getsource(deployer)
        for forbidden in ["'git',", 'git push', 'git commit', '_deploy_external_workspace']:
            self.assertNotIn(forbidden, source)

if __name__ == '__main__':
    unittest.main()
