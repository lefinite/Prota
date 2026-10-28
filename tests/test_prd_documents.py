import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from server.bridge import (BridgeHandler, list_prd_documents, read_prd_index,
                           resolve_prd_document_path, cleanup_unused_prd_assets)


class PRDDocumentsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.page = self.root / 'src/pages/demo/reader'
        for directory in ('v1', 'v2', 'v3', 'docs/prd-assets'):
            (self.page / directory).mkdir(parents=True)

    def call(self, method, **params):
        handler = object.__new__(BridgeHandler)
        body = json.dumps({'projectId': 'demo', 'pageId': 'reader', 'version': 'v2', **params}).encode()
        handler.headers = {'Content-Length': str(len(body))}
        handler.rfile, handler.wfile = io.BytesIO(body), io.BytesIO()
        handler.send_response = lambda status: setattr(handler, 'status', status)
        handler.send_header = lambda *args: None
        handler.end_headers = lambda: None
        with patch('server.bridge.get_project_root', return_value=str(self.root)):
            getattr(handler, method)()
        result = handler.wfile.getvalue().decode()
        self.assertEqual(handler.status, 200, result)
        return json.loads(result)

    def test_acceptance_revision_history_reopen_and_save_old_path(self):
        original = self.call('handle_prd_doc_create', version='v1')
        source = original['path']
        self.call('handle_prd_doc_save', path=source, content='# 原文\n![截图](prd-assets/shot.png)')
        before = (self.root / source.lstrip('/')).read_bytes()
        revised = self.call('handle_prd_doc_create', derivedFrom=source)
        self.assertEqual((self.root / revised['path'].lstrip('/')).read_bytes(), before)
        metadata = next(d for d in revised['documents'] if d['path'] == revised['path'])
        self.assertEqual((metadata['prototypeVersion'], metadata['revision'], metadata['derivedFrom']), ('v2', 2, source))
        self.assertEqual(len(list_prd_documents(str(self.root), 'demo', 'reader', 'v3')), 2)
        self.call('handle_prd_active_context_save', path=source)
        self.assertEqual(read_prd_index(str(self.root), 'demo', 'reader')['lastOpenedPath'], source)
        self.call('handle_prd_doc_save', path=revised['path'], content='# 新文档')
        self.assertEqual((self.root / source.lstrip('/')).read_bytes(), before)

    def test_all_legacy_versions_duplicates_and_exact_path(self):
        for version in ('v1', 'v2'):
            (self.page / version / 'product-doc.md').write_text('# ' + version)
        (self.page / 'docs/product-doc.md').write_text('# page')
        docs = list_prd_documents(str(self.root), 'demo', 'reader', 'v3')
        self.assertEqual(len(docs), 3)
        legacy = '/src/pages/demo/reader/v1/product-doc.md'
        self.assertEqual(resolve_prd_document_path(str(self.root), 'demo', 'reader', 'v2', legacy)[0], str(self.page / 'v1/product-doc.md'))
        revised = self.call('handle_prd_doc_create', derivedFrom=legacy)
        self.assertEqual(Path(revised['path']).parent.name, 'v1')
        self.call('handle_prd_doc_save', path=legacy, content='# edited in v2')
        self.assertEqual((self.page / 'v1/product-doc.md').read_text(), '# edited in v2')
        self.assertEqual((self.page / 'v2/product-doc.md').read_text(), '# v2')
        self.assertEqual(next(d for d in list_prd_documents(str(self.root), 'demo', 'reader', 'v2') if d['path'] == legacy)['prototypeVersion'], 'v1')

    def test_legacy_assets_and_bytes_preserved_and_cleanup_all_versions(self):
        content = b'# Legacy\r\n![image](prd-assets/image.png)\r\n[ref]: ../docs/prd-assets/shared.png\r\n'
        (self.page / 'v1/product-doc.md').write_bytes(content)
        (self.page / 'v1/prd-assets').mkdir()
        (self.page / 'v1/prd-assets/image.png').write_bytes(b'legacy')
        (self.page / 'docs/prd-assets/shared.png').write_bytes(b'shared')
        source = '/src/pages/demo/reader/v1/product-doc.md'
        revised = self.call('handle_prd_doc_create', derivedFrom=source)
        self.assertEqual((self.root / revised['path'].lstrip('/')).read_bytes(), content)
        cleanup_unused_prd_assets(str(self.root), 'demo', 'reader', 'v3')
        self.assertTrue((self.page / 'docs/prd-assets/shared.png').exists())
        self.assertTrue((self.page / 'v1/prd-assets/image.png').exists())

    def test_reject_cross_page_traversal_and_symlinks(self):
        for requested in ('/src/pages/demo/other/docs/prd.md', '/src/pages/demo/reader/docs/../prd.md', '/src/pages/demo/reader/v1/../../prd.md'):
            with self.assertRaises(ValueError):
                resolve_prd_document_path(str(self.root), 'demo', 'reader', 'v2', requested)
        (self.page / 'docs/link.md').symlink_to(self.root / 'outside.md')
        with self.assertRaises(ValueError):
            resolve_prd_document_path(str(self.root), 'demo', 'reader', 'v2', '/src/pages/demo/reader/docs/link.md')


if __name__ == '__main__':
    unittest.main()
