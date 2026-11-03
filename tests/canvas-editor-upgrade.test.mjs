import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../portal/shell.js', import.meta.url), 'utf8');
const method = source.slice(source.indexOf('    async upgradeCanvasEditorIfNeeded('), source.indexOf('    async renameCanvasPage('));
// After an upgrade the shell probes the scripts the installed entry loads; use the real template entry.
const installedEntry = readFileSync(new URL('../src/templates/infinite-canvas/index.html', import.meta.url), 'utf8');

async function checkUpgrade({ canvasScript = false, state, editor, force = false, draft = null, healthy = false, connectionVersion = 19, missing = [], notInstalled = [] } = {}) {
    const requests = [];
    const probes = [];
    const errors = [];
    let reloads = 0;
    const context = { projectId: 'demo', pageId: 'auth-phone', version: 'v1' };
    const frame = {
        location: { pathname: '/src/pages/demo/auth-phone/v1/index.html', reload() { reloads++; } },
        document: { readyState: 'complete', querySelector() { return canvasScript ? {} : null; } },
        localStorage: { getItem() { return JSON.stringify(draft); } },
        PROTA_CANVAS: state,
        protaCanvas: editor,
        postMessage() {},
    };
    if (healthy) {
        frame.CanvasConnections = { editorVersion: connectionVersion };
        frame.CanvasDomain = { schemaVersion: 2 };
        for (const key of ['CanvasBoardState', 'CanvasCore', 'CanvasFlowShapes', 'CanvasFlowQuickCreate', 'ProtaCanvasIcons', 'CanvasMarkdown', 'CanvasMarkdownEditor', 'marked']) if (!missing.includes(key)) frame[key] = {};
        frame.document.querySelector = () => ({ sheet: {} });
    }
    const upgrade = vm.runInNewContext(`({${method}}).upgradeCanvasEditorIfNeeded`, {
        location: { origin: 'http://localhost' },
        fetch: async (url, options = {}) => {
            if (options.method === 'POST') {
                requests.push({ url, body: JSON.parse(options.body) });
                return { ok: true, json: async () => ({ runtimeVersion: 49 }) };
            }
            if (url.endsWith('/index.html')) return { ok: true, text: async () => installedEntry };
            probes.push(url);
            return { ok: !notInstalled.includes(url.split('/').pop()) };
        },
    });
    const shell = {
        activeProjectId: context.projectId, activePageId: context.pageId, activeVersion: context.version,
        mainIframe: { contentWindow: frame }, getPageRecord: () => ({ pageMode: 'infinite-canvas' }),
        isInfiniteCanvasPage: () => true, getAgentContext: () => context, showToast: message => errors.push(message),
    };
    await upgrade.call(shell, { force });
    return { requests, probes, errors, reloads };
}

test('historical standard versions do not trigger canvas repair even when page metadata says canvas', async () => {
    for (const force of [false, true]) {
        assert.deepEqual(await checkUpgrade({ force }), { requests: [], probes: [], errors: [], reloads: 0 });
    }
});

test('a partial canvas installation can still repair before publishing globals', async () => {
    const result = await checkUpgrade({ canvasScript: true });
    assert.equal(result.requests.length, 1);
    assert.equal(result.requests[0].url, '/api/canvas/upgrade');
    assert.equal(result.reloads, 1);
    assert.deepEqual(result.errors, []);
});

test('canvas repairs preserve dirty editor state and pending recovery drafts', async () => {
    for (const options of [
        { editor: { isDirty: () => true } },
        { state: { nodes: [] }, draft: { state: { nodes: [{ id: 'unsaved' }] } } },
    ]) {
        assert.deepEqual(await checkUpgrade({ canvasScript: true, ...options }), { requests: [], probes: [], errors: [], reloads: 0 });
    }
});

test('existing healthy canvases upgrade to the pinned board state runtime, while current editors stay loaded', async () => {
    for (const runtimeVersion of [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38]) {
        const result = await checkUpgrade({ healthy: true, state: { nodes: [] }, editor: { runtimeVersion, previewSyncVersion: 2, isDirty: () => false } });
        assert.equal(result.requests.length, runtimeVersion < 49 ? 1 : 0);
        assert.equal(result.reloads, runtimeVersion < 49 ? 1 : 0);
        assert.deepEqual(result.errors, []);
    }
});

test('a current runtime with the previous connection editor receives the interaction upgrade', async () => {
    const result = await checkUpgrade({ healthy: true, connectionVersion: 18, state: { nodes: [] }, editor: { runtimeVersion: 49, previewSyncVersion: 2, isDirty: () => false } });
    assert.equal(result.requests.length, 1);
    assert.equal(result.reloads, 1);
});

test('a canvas missing the flowchart quick-create resources is repaired even at the current version', async () => {
    for (const missing of [['CanvasFlowShapes'], ['CanvasFlowQuickCreate']]) {
        const result = await checkUpgrade({ healthy: true, missing, state: { nodes: [] }, editor: { runtimeVersion: 49, previewSyncVersion: 2, isDirty: () => false } });
        assert.equal(result.requests.length, 1, missing[0]);
        assert.equal(result.reloads, 1, missing[0]);
    }
});

test('a repair probes every script the installed entry loads before reloading it', async () => {
    const result = await checkUpgrade({ canvasScript: true });
    const expected = [...installedEntry.matchAll(/<script src="\.\/([\w.-]+\.js)"/g)].map(match => '/src/pages/demo/auth-phone/v1/' + match[1]);
    assert.ok(expected.some(url => url.endsWith('/flow-shapes.js')) && expected.some(url => url.endsWith('/flow-quick-create.js')));
    assert.deepEqual(result.probes, expected);
    assert.equal(result.reloads, 1);
    assert.deepEqual(result.errors, []);
});

test('a stale local service that skips new runtime files asks for a restart instead of reloading a broken editor', async () => {
    for (const notInstalled of [['flow-shapes.js'], ['flow-quick-create.js']]) {
        const result = await checkUpgrade({ canvasScript: true, notInstalled });
        assert.equal(result.requests.length, 1);
        assert.equal(result.reloads, 0, notInstalled[0]);
        assert.deepEqual(result.errors, ['画布编辑器修复失败：本地服务尚未更新，请重启 Prota 后点击修复重试。']);
    }
});
