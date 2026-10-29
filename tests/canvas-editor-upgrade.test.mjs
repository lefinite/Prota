import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../portal/shell.js', import.meta.url), 'utf8');
const method = source.slice(source.indexOf('    async upgradeCanvasEditorIfNeeded('), source.indexOf('    async renameCanvasPage('));

async function checkUpgrade({ canvasScript = false, state, editor, force = false, draft = null, healthy = false } = {}) {
    const requests = [];
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
        frame.CanvasConnections = { editorVersion: 6 };
        frame.CanvasDomain = { schemaVersion: 2 };
        for (const key of ['CanvasCore', 'ProtaCanvasIcons', 'CanvasMarkdown', 'CanvasMarkdownEditor', 'marked']) frame[key] = {};
        frame.document.querySelector = () => ({ sheet: {} });
    }
    const upgrade = vm.runInNewContext(`({${method}}).upgradeCanvasEditorIfNeeded`, {
        location: { origin: 'http://localhost' },
        fetch: async (url, options) => {
            requests.push({ url, body: JSON.parse(options.body) });
            return { ok: true, json: async () => ({ runtimeVersion: 33 }) };
        },
    });
    const shell = {
        activeProjectId: context.projectId, activePageId: context.pageId, activeVersion: context.version,
        mainIframe: { contentWindow: frame }, getPageRecord: () => ({ pageMode: 'infinite-canvas' }),
        isInfiniteCanvasPage: () => true, getAgentContext: () => context, showToast: message => errors.push(message),
    };
    await upgrade.call(shell, { force });
    return { requests, errors, reloads };
}

test('historical standard versions do not trigger canvas repair even when page metadata says canvas', async () => {
    for (const force of [false, true]) {
        assert.deepEqual(await checkUpgrade({ force }), { requests: [], errors: [], reloads: 0 });
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
        assert.deepEqual(await checkUpgrade({ canvasScript: true, ...options }), { requests: [], errors: [], reloads: 0 });
    }
});

test('existing healthy canvases upgrade to the freely zoomable board preview runtime, while current editors stay loaded', async () => {
    for (const runtimeVersion of [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33]) {
        const result = await checkUpgrade({ healthy: true, state: { nodes: [] }, editor: { runtimeVersion, previewSyncVersion: 2, isDirty: () => false } });
        assert.equal(result.requests.length, runtimeVersion < 33 ? 1 : 0);
        assert.equal(result.reloads, runtimeVersion < 33 ? 1 : 0);
        assert.deepEqual(result.errors, []);
    }
});
