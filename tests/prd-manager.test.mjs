import assert from 'node:assert/strict';
import test from 'node:test';
import { PRDManager } from '../portal/modules/prd/manager.js';
import { PRDModule } from '../portal/modules/prd/index.js';
import { PRDRenderer } from '../portal/modules/prd/renderer.js';

const prefix = '/src/pages/demo/reader/';
function setup(documents, lastOpenedPath = '') {
    const storage = new Map();
    globalThis.window = {
        location: { protocol: 'http:', origin: 'http://localhost', pathname: '/' },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
    };
    const host = { activeProjectId: 'demo', activePageId: 'reader', activeVersion: 'v2',
        getPageRecord: () => ({ name: '阅读器', versions: ['v1', 'v2', 'v3'] }), getPrdRelativePath: () => null };
    const calls = [];
    globalThis.fetch = async (url, options = {}) => {
        calls.push({ url, options });
        if (url.startsWith('/api/prd-docs')) return { ok: true, json: async () => ({ documents, lastOpenedPath }) };
        if (options.method === 'POST') return { ok: true, json: async () => ({}) };
        return { ok: true, text: async () => '# ' + url };
    };
    const manager = new PRDManager(host);
    return { manager, host, storage, calls };
}
const docs = [
    { path: prefix + 'docs/new.md', filename: 'new.md', prototypeVersion: 'v1', updatedAtMs: 3000 },
    { path: prefix + 'docs/current.md', filename: 'current.md', prototypeVersion: 'v2', updatedAtMs: 2000 },
    { path: prefix + 'v1/old.md', filename: 'old.md', prototypeVersion: 'v1', updatedAtMs: 1000 }
];

test('first read prefers current prototype association, otherwise newest page document', async () => {
    const { manager, host } = setup(docs);
    await manager.loadDocument();
    assert.equal(manager.state.path, docs[1].path);
    window.localStorage.setItem(manager.getLastDocumentKey(), '');
    manager.resetState();
    host.activeVersion = 'v3';
    await manager.loadDocument();
    assert.equal(manager.state.path, docs[0].path);
});

test('same page version changes keep selection and reopening restores page history', async () => {
    const { manager, host, storage } = setup(docs);
    const module = { manager, host, _pageKey: 'demo:reader' };
    await manager.loadDocument({ path: docs[2].path });
    host.activeVersion = 'v3';
    await PRDModule.prototype.switchContext.call(module, 'reader', 'v3');
    assert.equal(manager.state.path, docs[2].path);
    assert.equal(storage.get(manager.getLastDocumentKey()), docs[2].path);
    const reopened = new PRDManager(host);
    await reopened.loadDocument();
    assert.equal(reopened.state.path, docs[2].path);
    assert.equal(manager.state.documents.length, 3);
});

test('version binding precedes history; unbound versions retain page history', async () => {
    const { manager, host } = setup(docs, docs[2].path);
    await manager.loadDocument();
    assert.equal(manager.state.path, docs[1].path);
    host.activeVersion = 'v3';
    manager.resetState();
    await manager.loadDocument();
    assert.equal(manager.state.path, docs[1].path);
    const other = setup(docs).manager;
    await other.loadDocument({ path: prefix + 'docs/deleted.md' });
    assert.equal(other.state.path, docs[1].path);
});

test('history from one project cannot override a different project', async () => {
    const { manager, host } = setup(docs);
    await manager.loadDocument({ path: docs[2].path });
    host.activeProjectId = 'other';
    assert.equal(manager.getLocalStorageItem(manager.getLastDocumentKey()), '');
});

test('page and folder shares open the sender document before README or recipient history', async () => {
    const readme = { path: prefix + 'v2/README.md', filename: 'README.md', prototypeVersion: 'v2', updatedAtMs: 5000 };
    for (const mode of ['page', 'folder']) {
        const { manager, host, storage, calls } = setup([]);
        host.isShareMode = true;
        host.activeVersion = 'v1';
        host.shareConfig = { mode, documents: [readme, ...docs], prdPath: docs[0].path, prdContent: '# Shared business document' };
        storage.set(manager.getLastDocumentKey(), readme.path);
        await manager.loadDocument();
        assert.equal(manager.state.path, docs[0].path);
        assert.equal(manager.state.content, '# Shared business document');
        assert.equal(calls.length, 0);
        await manager.loadDocument({ force: true, path: readme.path });
        assert.equal(manager.state.path, docs[0].path, 'shared readers cannot request a different document');
        assert.equal(manager.state.documents.length, 1);
        assert.equal(await manager.bindDocument(readme.path, 'v1'), false);
        assert.equal(await manager.saveDocument({ content: '# forbidden' }), false);
        await manager.createNewDocument();
        assert.equal(calls.length, 0);
    }
});

test('document menu contains version bindings while the toolbar contains only the filename', () => {
    const { manager } = setup(docs);
    const renderer = new PRDRenderer(manager);
    const html = renderer.renderPrdMeta({ status: 'ready', path: docs[0].path,
        documents: [...docs, { path: prefix + 'docs/unknown.md', filename: 'unknown.md' }] });
    assert.match(html, /data-prd-bind-version="v1"/);
    assert.match(html, /data-prd-bind-version="v2"/);
    assert.match(html, /未关联/);
    assert.match(html, /data-prd-bind-version="v2"/);
    assert.doesNotMatch(html, /prd-meta__breadcrumb|prd-meta__association|prd-current-version-options/);
    assert.match(html, /<span>V1<\/span>/);
    assert.doesNotMatch(html, /<span>关联 V1<\/span>/);
    assert.match(html, /基于此文档迭代/);
    manager.host.isShareMode = true;
    assert.doesNotMatch(renderer.renderPrdMeta({ status: 'ready', path: docs[0].path, documents: docs }), /data-prd-(manage-trigger|dropdown|switch-path|bind-path|delete-path)|基于此文档迭代/);
});

test('changing prototype versions opens its associated document', async () => {
    const { manager, host } = setup(docs);
    const module = { manager, host, _pageKey: 'demo:reader', _version: 'v1' };
    await manager.loadDocument({ path: docs[0].path });
    await PRDModule.prototype.switchContext.call(module, 'reader', 'v2');
    assert.equal(manager.state.path, docs[1].path);
});

test('failed binding keeps the saved association and allows retry', async () => {
    const { manager, host } = setup(docs);
    manager.state.documents = docs;
    let message = '';
    host.showToast = value => { message = value; };
    globalThis.fetch = async () => ({ ok: false, text: async () => JSON.stringify({ error: '关联未保存，请重试。' }) });
    assert.equal(await manager.bindDocument(docs[0].path, 'v2'), false);
    assert.equal(manager.state.documents[0].prototypeVersion, 'v1');
    assert.equal(manager._bindingPending, false);
    assert.match(message, /请重试/);
});

test('an outdated backend returns a useful recovery message instead of a JSON error', async () => {
    const { manager, host } = setup(docs);
    manager.state.documents = docs;
    let message = '';
    host.showToast = value => { message = value; };
    globalThis.fetch = async () => ({ ok: false, text: async () => '<html>Not Found</html>' });
    assert.equal(await manager.bindDocument(docs[0].path, 'v2'), false);
    assert.match(message, /重新打开 Prota/);
    assert.equal(manager.state.documents, docs);
});
