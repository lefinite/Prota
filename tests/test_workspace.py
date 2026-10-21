import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
import workspace


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='prota-workspace-test-')
        self.base = Path(self.temporary.name).resolve()
        self.source = self.base / 'application'
        self.config = self.base / 'config'
        self.patchers = [patch.object(workspace, 'APP_ROOT', self.source),
                         patch.object(workspace, 'CONFIG_DIR', self.config),
                         patch.object(workspace, 'CONFIG_PATH', self.config / 'workspace.json'),
                         patch.object(workspace, 'LOCK_PATH', self.config / 'workspace.lock'),
                         patch.object(workspace, 'agent_control', return_value=None),
                         patch.dict(workspace.os.environ, {}, clear=False)]
        for patcher in self.patchers:
            patcher.start()
        workspace.os.environ.pop('READIFY_WORKSPACE', None)
        workspace._job = None
        self.write('data/projects.json', json.dumps({'projects': [{'id': 'demo', 'pages': []}]}))
        for name, content in {
            'src/pages/demo/reader/v1/index.html': '<h1>外部资产</h1>',
            'src/pages/demo/reader/v1/styles.css': 'body { color: red }',
            'src/pages/demo/reader/v1/app.js': 'console.log(1)',
            'src/pages/demo/reader/v1/annotations.json': '[{"text":"标注"}]',
            'src/pages/demo/reader/docs/product.md': '# 文档',
            'data/agent-sessions/session.json': '{"id":"session"}',
            'data/agent-uploads/image.png': 'image fixture',
            'data/agent-checkpoints/checkpoint.json': '{}',
            'shares/demo.html': 'share',
            'assets/cover.svg': '<svg/>',
            'data/agent-provider-config.json': 'local secret fixture',
            '.env': 'SECRET=fixture',
            'portal/shell.js': 'application source fixture',
        }.items():
            self.write(name, content)

    def tearDown(self):
        for patcher in reversed(self.patchers):
            patcher.stop()
        self.temporary.cleanup()

    def write(self, relative, content):
        file = self.source / relative
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(content, encoding='utf-8')

    def run_change(self, target, mode='migrate'):
        workspace.start(str(target), mode, str(workspace.workspace_root()))
        for _ in range(500):
            if workspace._job['state'] != 'running' and not workspace.LOCK_PATH.exists():
                return workspace._job
            time.sleep(.01)
        self.fail('workspace job timed out')

    def test_migration_copies_assets_verifies_and_keeps_source_and_credentials_separate(self):
        target = self.base / '工作区'
        self.assertEqual(self.run_change(target)['state'], 'complete')
        self.assertEqual(workspace.workspace_root(), target)
        for source, relative, _ in workspace.asset_files(self.source):
            self.assertEqual(source.read_bytes(), (target / relative).read_bytes())
        for excluded in ['.env', 'data/agent-provider-config.json']:
            self.assertFalse((target / excluded).exists())
            self.assertTrue((self.source / excluded).exists())
        self.assertNotEqual((target / 'portal/shell.js').read_text(), (self.source / 'portal/shell.js').read_text())
        self.assertIn('const defaultData = ', (target / 'portal/shell.js').read_text())
        self.assertEqual(json.loads((target / 'workspace.json').read_text())['formatVersion'], 1)
        self.assertFalse(workspace.LOCK_PATH.exists())

    def test_hash_mismatch_does_not_switch_or_delete_source(self):
        with patch.object(workspace, 'digest', side_effect=[b'first', b'changed']):
            result = self.run_change(self.base / 'failed')
        self.assertEqual(result['state'], 'failed')
        self.assertEqual(workspace.workspace_root(), self.source)
        self.assertFalse((self.base / 'failed').exists())
        self.assertTrue((self.source / 'src/pages/demo/reader/v1/index.html').exists())
        self.assertFalse(list(self.base.glob('.prota-migration-*')))

    def test_nonempty_and_related_targets_are_rejected(self):
        for target in [self.source, self.source / 'nested', self.base]:
            with self.assertRaises(ValueError):
                workspace.plan(str(target), 'migrate')
        target = self.base / 'occupied'; target.mkdir(); (target / 'keep.txt').write_text('keep')
        with self.assertRaises(ValueError):
            workspace.plan(str(target), 'migrate')
        self.assertEqual((target / 'keep.txt').read_text(), 'keep')

    def test_new_and_open_workspaces_do_not_merge_content(self):
        target = self.base / 'new'
        self.assertEqual(self.run_change(target, 'new')['state'], 'complete')
        self.assertEqual(json.loads((target / 'data/projects.json').read_text())['projects'], [])
        other = self.base / 'other'
        self.assertEqual(self.run_change(other, 'new')['state'], 'complete')
        self.assertEqual(self.run_change(target, 'open')['state'], 'complete')
        self.assertEqual(workspace.workspace_root(), target)

    def test_unavailable_workspace_does_not_fall_back_to_application(self):
        workspace.atomic_json(workspace.CONFIG_PATH, {'path': str(self.base / 'missing')})
        self.assertFalse(workspace.status()['available'])
        with self.assertRaises(ValueError):
            workspace.workspace_root()
        # Recovery may initialize another workspace even when the old disk is gone.
        plan = workspace.plan(str(self.base / 'recovered'), 'new')
        self.assertEqual(plan['source'], str(self.base / 'missing'))

    def test_symlink_assets_cannot_escape_or_silently_break_migration(self):
        (self.source / 'assets/external').symlink_to(self.base)
        with self.assertRaisesRegex(ValueError, '符号链接'):
            workspace.plan(str(self.base / 'target'), 'migrate')

    def test_busy_agent_prevents_migration(self):
        with patch.object(workspace, 'agent_control', side_effect=ValueError('AI 任务正在运行')):
            result = self.run_change(self.base / 'busy')
        self.assertEqual(result['state'], 'failed')
        self.assertEqual(workspace.workspace_root(), self.source)


if __name__ == '__main__':
    unittest.main()
