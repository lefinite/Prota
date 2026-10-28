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

test('server page history restores selection without browser storage; stale memory falls back', async () => {
    const { manager } = setup(docs, docs[2].path);
    await manager.loadDocument();
    assert.equal(manager.state.path, docs[2].path);
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

test('metadata UI shows associations, unknown legacy version and historical notice', () => {
    const { manager } = setup(docs);
    const renderer = new PRDRenderer(manager);
    const html = renderer.renderPrdMeta({ status: 'ready', path: docs[0].path,
        documents: [...docs, { path: prefix + 'docs/unknown.md', filename: 'unknown.md' }] });
    assert.match(html, /原型 V1/);
    assert.match(html, /原型 V2/);
    assert.match(html, /原型版本未记录/);
    assert.match(html, /正在查看关联 V1 的历史文档/);
    assert.match(html, /基于此文档迭代/);
    manager.host.isShareMode = true;
    assert.doesNotMatch(renderer.renderPrdMeta({ status: 'ready', path: docs[0].path, documents: docs }), /基于此文档迭代/);
});
