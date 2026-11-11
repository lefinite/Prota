import copy
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from server.copy_edits import EditService, MappingError
from server.canvas_transactions import digest
from server.user_edit_reconcile import coordinate


class CopyEditsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.page = self.root / 'src/pages/demo/page/v1'
        self.page.mkdir(parents=True)
        self.file = self.page / 'index.html'
        self.file.write_text('<!doctype html><html><body><button id="target">提交</button><button>提交</button></body></html>')
        self.service = EditService(self.root)
        self.request = {'clientEditId': 'test-id', 'projectId': 'demo', 'pageId': 'page', 'version': 'v1',
                        'target': {'type': 'page'}, 'element': {'selector': '#target', 'tagName': 'BUTTON', 'originalText': '提交', 'nextText': '立即提交'}}

    def tearDown(self):
        self.service.close()
        self.temp.cleanup()

    def create(self, **kwargs):
        request = {**copy.deepcopy(self.request), **kwargs}
        return self.service.create(request)

    def test_static_unique_and_durable_snapshots(self):
        result = self.create()
        self.assertEqual(result['status'], 'committed')
        self.assertIn('<button>提交</button>', self.file.read_text())
        effect = result['effect']
        self.assertEqual(digest(self.file.read_bytes()), effect['afterSha256'])
        self.assertIn('提交'.encode(), self.service.store.read_snapshot(effect['beforeSha256']))
        self.assertEqual(self.service.store.db.execute('SELECT count(*) FROM edit_file_effects').fetchone()[0], 1)

    def test_missing_no_patch(self):
        self.file.write_text('<html><body>动态内容</body></html>')
        self.assertEqual(self.create()['status'], 'unsupported')
        self.assertFalse((self.page / 'app.js').exists())
        self.assertEqual(len(self.service.history({})['items']), 1)

    def test_duplicate_id_rejected(self):
        self.file.write_text('<button id="target">提交</button>' * 2)
        before = self.file.read_bytes()
        self.assertEqual(self.create()['status'], 'conflict')
        self.assertEqual(self.file.read_bytes(), before)

    def test_twenty_repeated_labels_only_target(self):
        self.file.write_text(''.join(f'<button id="b{i}">提交</button>' for i in range(20)))
        self.request['element']['selector'] = '#b9'
        self.assertEqual(self.create()['status'], 'committed')
        self.assertEqual(self.file.read_text().count('立即提交'), 1)
        self.assertEqual(self.file.read_text().count('>提交<'), 19)

    def test_entities_unicode_whitespace(self):
        self.file.write_text('<button id="target"> A &amp; B 🙂 </button>')
        self.request['element'].update(originalText=' A & B 🙂 ', nextText='  C < D 🥳\n ')
        self.assertEqual(self.create()['status'], 'committed')
        self.assertIn('  C &lt; D 🥳\n ', self.file.read_text())

    def test_mixed_markup_preserved(self):
        self.file.write_text('<button id="target">提<strong>交</strong></button>')
        before = self.file.read_bytes()
        self.assertEqual(self.create()['status'], 'unsupported')
        self.assertEqual(self.file.read_bytes(), before)

    def test_script_and_css_not_modified(self):
        self.file.write_text('<script id="target">提交</script><style>/* 提交 */</style>')
        before = self.file.read_bytes()
        self.assertNotEqual(self.create()['status'], 'committed')
        self.assertEqual(self.file.read_bytes(), before)

    def test_idempotent_five_retries_and_changed_payload(self):
        first = self.create()
        for _ in range(5):
            self.assertEqual(self.create()['editId'], first['editId'])
        self.request['element']['nextText'] = '其他'
        self.assertEqual(self.create()['status'], 'conflict')
        self.assertEqual(self.service.store.db.execute('SELECT count(*) FROM edit_operations').fetchone()[0], 1)

    def test_stale_file_baseline(self):
        sha = self.service.baseline(self.request)['sourceSha256']
        self.file.write_text(self.file.read_text() + '<!-- concurrent -->')
        self.assertEqual(self.create(expectedSourceSha256=sha)['status'], 'conflict')
        self.assertIn('concurrent', self.file.read_text())

    def test_last_moment_external_write(self):
        original = self.service.install
        def race(edit_id, effect):
            self.file.write_text('EXTERNAL')
            return original(edit_id, effect)
        with patch.object(self.service, 'install', race):
            self.assertEqual(self.create()['status'], 'conflict')
        self.assertEqual(self.file.read_text(), 'EXTERNAL')

    def test_agent_queue_and_conflict(self):
        coordinate(self.root, 'start', 'run', os.getpid())
        result = self.create()
        self.assertEqual(result['status'], 'queued')
        self.assertIn('>提交<', self.file.read_text())
        coordinate(self.root, 'end', 'run')
        self.assertEqual(self.service.store.get(result['editId'])['status'], 'committed')
        self.file.write_text('<button id="target">Agent 文案</button>')
        scan = coordinate(self.root, 'scan')
        self.assertEqual(scan['conflictCount'], 1)
        self.assertIn('Agent 文案', self.file.read_text())
        self.assertTrue(self.service.store.get(result['editId'])['effect'])

    def test_agent_unrelated_source_change_preserves_target(self):
        result = self.create()
        self.file.write_text(self.file.read_text() + '<footer>Agent</footer>')
        self.service.scan()
        self.assertEqual(self.service.store.get(result['editId'])['status'], 'committed')

    def test_recovery_crash_before_and_after_replace(self):
        for after in (False, True):
            with self.subTest(after=after):
                self.file.write_text('<button id="target">提交</button>')
                request = {**self.request, 'clientEditId': 'crash-' + str(after)}
                def crash(edit_id, effect):
                    if after:
                        self.file.write_bytes(self.service.store.read_snapshot(effect['afterSha256']))
                    raise SystemExit('simulated process crash')
                with patch.object(self.service, 'install', crash):
                    with self.assertRaises(SystemExit):
                        self.service.create(request)
                self.service.close()
                self.service = EditService(self.root)
                self.service.recover()
                self.assertIn('立即提交', self.file.read_text())
                self.assertFalse(self.service.records(('prepared',)))

    def test_recovery_does_not_overwrite_external(self):
        with patch.object(self.service, 'install', side_effect=SystemExit):
            with self.assertRaises(SystemExit):
                self.create()
        self.file.write_text('EXTERNAL')
        self.service.recover()
        self.assertEqual(self.file.read_text(), 'EXTERNAL')
        self.assertEqual(len(self.service.records(('conflict',))), 1)

    def test_verification_context_and_preview_failure(self):
        result = self.create()
        payload = {k: self.request[k] for k in ('projectId', 'pageId', 'version')}
        payload.update(selector='#target', text='立即提交', matched=True)
        self.assertEqual(self.service.verify(result['editId'], payload)['status'], 'verified')
        payload['text'] = 'wrong'
        self.assertEqual(self.service.verify(result['editId'], payload)['status'], 'committed')
        self.assertIn('立即提交', self.file.read_text())
        payload['version'] = 'v2'
        with self.assertRaises(ValueError):
            self.service.verify(result['editId'], payload)

    def test_undo_and_later_change(self):
        result = self.create()
        undo = self.service.undo(result['editId'])
        self.assertEqual(undo['status'], 'committed')
        self.assertIn('>提交<', self.file.read_text())
        self.assertEqual(self.service.store.get(result['editId'])['status'], 'superseded')
        self.file.write_text(self.file.read_text() + '<p>合法后续修改</p>')
        self.assertEqual(self.service.undo(undo['editId'])['status'], 'conflict')
        self.assertIn('合法后续修改', self.file.read_text())

    def test_versions_isolated(self):
        other = self.page.parent / 'v2'
        other.mkdir(); (other / 'index.html').write_bytes(self.file.read_bytes())
        self.create()
        self.assertNotIn('立即提交', (other / 'index.html').read_text())

    def test_runtime_and_board_rejected(self):
        (self.page / 'canvas-data.js').write_text('window.DATA={}')
        before = self.file.read_bytes()
        self.assertEqual(self.create()['status'], 'unsupported')
        self.assertEqual(self.file.read_bytes(), before)
        self.assertEqual(self.create(clientEditId='board', target={'type': 'canvas-board', 'boardPath': '../x'})['status'], 'unsupported')

    def test_path_and_symlink_rejected(self):
        for value in ('../demo', 'demo/other', '.demo', 'demo\\other'):
            with self.assertRaises(ValueError):
                self.create(projectId=value)
        self.file.unlink()
        external = self.root / 'external.html'; external.write_text('<button id="target">提交</button>')
        self.file.symlink_to(external)
        self.assertNotEqual(self.create()['status'], 'committed')
        self.assertIn('提交', external.read_text())

    def test_legacy_inventory_does_not_modify_source(self):
        legacy = self.page / 'app.js'
        raw = '/* READIFY_COPY_PATCHES_START */\nconst patches = [{"selector":"#target","text":"旧文案"}];\n/* READIFY_COPY_PATCHES_END */'
        legacy.write_text(raw)
        inventory = self.service.inventory()
        self.assertEqual(inventory['items'][0]['status'], 'needs-review')
        self.assertEqual(legacy.read_text(), raw)

    def test_legacy_import_backed_up_idempotent_and_not_applied(self):
        legacy = self.page / 'app.js'
        legacy.write_text('/* READIFY_COPY_PATCHES_START */\nconst patches = [{"selector":"#target","text":"旧补丁"}];\n/* READIFY_COPY_PATCHES_END */')
        before = legacy.read_bytes()
        result = self.service.import_legacy()
        self.assertEqual(result['sourceFilesChanged'], 0)
        self.assertEqual(result['items'][0]['status'], 'needs-review')
        request = result['items'][0]['request']
        self.assertEqual(self.service.store.read_snapshot(request['legacySnapshotSha256']), before)
        self.assertEqual(self.service.import_legacy()['items'][0]['editId'], result['items'][0]['editId'])
        self.assertEqual(legacy.read_bytes(), before)
        self.service.drain()
        self.assertIn('>提交<', self.file.read_text())

    def test_copy_version_inherits_protection_and_isolates_later_agent_write(self):
        from server.canvas_runtime_package import copy_version
        self.create()
        destination = self.page.parent / 'v2'
        copy_version(self.page, destination)
        history = self.service.history({'version': 'v2'})
        self.assertEqual(history['total'], 1)
        self.assertIn('立即提交', (destination / 'index.html').read_text())
        (destination / 'index.html').write_text('<button id="target">Agent</button>')
        self.service.scan()
        self.assertEqual(self.service.history({'version': 'v2'})['items'][0]['status'], 'conflict')
        self.assertEqual(self.service.history({'version': 'v1'})['items'][0]['status'], 'committed')

    def test_no_id_source_fragment_remains_protected(self):
        self.file.write_text('<button class="unique">提交</button><p>其他</p>')
        self.request['element'].update(selector='button.unique', outerHtmlSnippet='<button class="unique">提交</button>')
        result = self.create()
        self.assertEqual(result['status'], 'committed')
        self.file.write_text(self.file.read_text() + '<footer>Agent</footer>')
        self.service.scan()
        self.assertEqual(self.service.store.get(result['editId'])['status'], 'committed')

    def test_hidden_ancestor_and_comments_are_not_rewritten(self):
        for source in ('<div hidden><button id="target">提交</button></div>', '<button id="target">提<!--keep-->交</button>'):
            self.file.write_text(source)
            self.request['clientEditId'] = 'hidden-' + digest(source.encode())[:10]
            self.assertNotEqual(self.create()['status'], 'committed')
            self.assertEqual(self.file.read_text(), source)

    def test_upgrade_migration_and_canvas_copy_keep_unreviewed_legacy_patches(self):
        from server.canvas_store import upgrade_runtime
        from server.canvas_runtime_package import migrate_entry, copy_version
        (self.page / 'canvas-data.js').write_text('window.PROTA_CANVAS = {"schemaVersion":1,"nodes":[]};')
        app = self.page / 'app.js'
        self.file.write_text('<div id="stage"></div><script src="canvas-data.js"></script><script src="canvas-core.js"></script>')
        app.write_text('/* READIFY_COPY_PATCHES_START */旧文案')
        before = app.read_bytes()
        params = {k: self.request[k] for k in ('projectId', 'pageId', 'version')}
        with self.assertRaisesRegex(ValueError, '旧文案补丁'):
            upgrade_runtime(self.root, params, Path(__file__).resolve().parents[1] / 'src/templates/infinite-canvas')
        with patch('server.canvas_runtime_package.feature_flags', return_value={'canvasLegacyShellMigration': True}):
            with self.assertRaisesRegex(ValueError, '旧文案补丁'):
                migrate_entry(self.root, params)
        with self.assertRaisesRegex(ValueError, '旧文案补丁'):
            copy_version(self.page, self.page.parent / 'v2')
        self.assertEqual(app.read_bytes(), before)
        self.assertFalse((self.page.parent / 'v2').exists())

    def test_hundred_edits_survive_restart(self):
        for i in range(100):
            self.request['clientEditId'] = 'edit-' + str(i)
            self.request['element']['nextText'] = '文案 ' + str(i)
            result = self.create()
            self.assertEqual(result['status'], 'committed')
            self.request['element']['originalText'] = self.request['element']['nextText']
        self.service.close(); self.service = EditService(self.root)
        coordinate(self.root, 'scan')
        self.assertEqual(self.service.history({})['total'], 100)
        self.assertIn('文案 99', self.file.read_text())
        self.assertEqual(len(self.service.records(('conflict',))), 0)


if __name__ == '__main__':
    unittest.main()
