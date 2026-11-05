import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'prota-canvas-context-')));
const root = path.join(temporary, 'workspace');
const config = path.join(temporary, 'config');
const children = [];
let browser, logs = '';
const write = async (relative, content) => { const file = path.join(root, relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content); };
const freePort = () => new Promise(resolve => { const server = net.createServer().listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const wait = async (predicate, label) => { for (let index = 0; index < 150; index++) { try { if (await predicate()) return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } throw Error(`Timed out: ${label}\n${logs.slice(-1500)}`); };

try {
    const pages = [{ id: 'legacy', name: '阅读设置' }, { id: 'website', name: 'EPUB 排版', targetDevice: 'web' }, { id: 'widget', name: '小组件画布', targetDevice: 'canvas' }, { id: 'infinite', name: '无限画布', targetDevice: 'canvas', pageMode: 'infinite-canvas' }]
        .map(page => ({ ...page, versions: ['v1'], activeVersion: 'v1', parentId: 'examples' }));
    await write('workspace.json', JSON.stringify({ id: 'page-search-fixture', formatVersion: 1 }));
    await write('data/projects.json', JSON.stringify({ projects: [{ id: 'demo', name: '页面搜索验证', folders: [{ id: 'examples', name: '示例' }], pages }], activeProjectId: 'demo', activePageId: 'legacy' }));
    for (const page of pages) {
        await write(`src/pages/demo/${page.id}/v1/index.html`, `<!doctype html><html><body><h1>${page.name}</h1></body></html>`);
        await write(`src/pages/demo/${page.id}/v1/styles.css`, 'body { margin: 0; }');
        await write(`src/pages/demo/${page.id}/v1/app.js`, '');
    }
    await fs.mkdir(config);
    await fs.writeFile(path.join(config, 'workspace.json'), JSON.stringify({ path: root }));
    await fs.writeFile(path.join(config, 'agent-provider-config.json'), JSON.stringify({ providers: [{ id: 'fixture', label: '测试模型', model: 'fixture-model', apiKey: 'fixture-key', baseURL: 'https://example.invalid/v1', apiType: 'openai-completions', sdkOptions: {} }], activeProviderId: 'fixture', selectedProviderId: 'fixture' }));
    const bridgePort = await freePort(), agentPort = await freePort();
    const base = `http://127.0.0.1:${bridgePort}`;
    const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', READIFY_CONFIG_DIR: config, READIFY_WORKSPACE: root, READIFY_PORT: String(bridgePort), READIFY_AGENT_PORT: String(agentPort) };
    for (const [command, args] of [['python3', ['server/bridge.py']], ['node', ['server/agent-server.mjs']]]) {
        const child = spawn(command, args, { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', chunk => logs += chunk); child.stderr.on('data', chunk => logs += chunk); children.push(child);
    }
    await wait(async () => (await fetch(`${base}/api/workspace`)).ok, 'bridge');
    await wait(async () => (await fetch(`http://127.0.0.1:${agentPort}/api/agent/health`)).ok, 'agent');
    const post = async (endpoint, body) => { const response = await fetch(`${base}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); assert.equal(response.ok, true, await response.clone().text()); return response.json(); };
    await post('/api/sync', {});
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/fonts\.google/, route => route.abort());
    await page.route(/http:\/\/(localhost|127\.0\.0\.1):8080\//, route => route.continue({ url: route.request().url().replace(/http:\/\/(localhost|127\.0\.0\.1):8080\//, `${base}/`) }));
    await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//, route => route.continue({ url: route.request().url().replace(/:8081\//, `:${agentPort}/`) }));
    await page.goto(`${base}/portal/index.html`, { waitUntil: 'domcontentloaded' });
    await wait(() => page.evaluate(() => Boolean(window.shell?.projects?.projects?.length && window.shell?.getAgentSkill('create-new-page'))), 'shell metadata and skills');

    await page.evaluate(() => {
        const shell = window.shell;
        shell.enterProject('demo');
        shell.agentSessionContext = { projectId: 'demo', pageId: 'legacy', version: 'v1' };
        shell.agentSessionScope = 'page';
        shell.agentRunState = shell.getDefaultAgentRunState();
        shell.openAgentWorkbench();
    });
    await page.evaluate(() => window.shell.switchPage('legacy', 'v1'));
    await page.frameLocator('#mainIframe').locator('h1').waitFor();

    // Keep session activation local while exercising the real iframe message path.
    await page.evaluate(() => {
        window.shell.agentSessionId = 'session-a';
        window.shell.agentApi.setContext = async () => ({});
        window.shell.loadAgentSessions = async () => {};
        window.shell.scheduleAgentWorkbenchHydration = () => {};
    });
    const select = async (selected, activate = true) => {
        await page.frameLocator('#mainIframe').locator('body').evaluate((el, selected) => {
            window.parent.postMessage({ type: 'prota:canvas-selection', selected }, location.origin);
        }, selected);
        await page.waitForFunction(selected => JSON.stringify(window.shell.canvasSelection?.selected) === JSON.stringify(selected), selected);
        if (activate) await page.evaluate(() => window.shell.focusExistingCanvasAgent(window.shell.mainIframe.contentWindow));
    };
    const bar = page.locator('#agentCanvasContextBar');
    await select([{ id: 'a', name: '画板 A' }]);
    await select([{ id: 'b', name: '画板 B' }, { id: 'c', name: '文本 C' }]);
    assert.equal(await bar.locator('section').count(), 3, 'separate activations accumulate');
    assert.equal(await page.locator('#agentStatusContext .agent-status-context__label').textContent(), 'legacy / v1');
    await select([{ id: 'a', name: '画板 A 更新' }]);
    assert.equal(await bar.locator('section').count(), 3, 'same object updates without duplication');
    assert.match(await bar.textContent(), /画板 A 更新/);
    await select([], false);
    assert.equal(await bar.locator('section').count(), 3, 'deselection keeps attached context');
    await bar.locator('[data-agent-remove-canvas-context="b"]').click();
    assert.equal(await bar.locator('section').count(), 2);
    const selection = [{ id: 'text', name: '文本 16', textSelection: { start: 2, end: 10, text: '<选中的文本>🙂' } }];
    await select(selection);
    assert.equal(await bar.locator('section').count(), 3);
    assert.match(await bar.textContent(), /<选中的文本>🙂/);
    const attached = await page.evaluate(() => window.shell.getAgentCanvasContextSelection());
    assert.deepEqual(attached.map(node => node.id), ['a', 'c', 'text']);
    await page.evaluate(() => {
        window.shell.agentSessionId = 'session-b';
        window.shell.agentSessionContext = { projectId: 'demo', pageId: 'legacy', version: 'v1' };
        window.shell.renderAgentControls();
    });
    assert.equal(await bar.isVisible(), false, 'new chat does not inherit attachments');
    await select([{ id: 'b', name: '画板 B' }]);
    assert.equal(await bar.locator('section').count(), 1);
    await page.evaluate(() => { window.shell.agentSessionId = 'session-a'; window.shell.renderAgentControls(); });
    assert.equal(await bar.locator('section').count(), 3, 'returning to chat restores its attachments');
    const outgoing = await page.evaluate(async () => {
        const shell = window.shell;
        shell.selectedProviderId = 'unused';
        shell.activeProviderId = 'fixture';
        shell.detachAgentSessionStream = async () => {};
        shell.ensureAgentSession = async () => shell.agentSessionId;
        let captured;
        shell.agentApi.startRunByPath = async (endpoint, body) => {
            captured = body;
            throw new DOMException('Stopped after request capture', 'AbortError');
        };
        await shell.startAgentRun('message', { message: '一起修改这些内容' });
        shell.agentRunState.active = false;
        return captured;
    });
    assert.deepEqual(outgoing.canvasSelection, attached, 'actual run request sends accumulated contexts');
    const history = await page.evaluate(() => {
        const shell = window.shell;
        const context = { ...shell.agentSessionContext, canvasSelection: structuredClone(shell.getAgentCanvasContextSelection()) };
        const run = shell.addOptimisticAgentRun('message', { message: '一起修改这些内容' }, context);
        shell._canvasRunScope = structuredClone(context);
        shell.agentRunState = { ...shell.agentRunState, active: true, descriptor: run.descriptor };
        shell.renderAgentControls();
        return run.descriptor;
    });
    await select([{ id: 'other', name: '其他画板' }], false);
    assert.deepEqual(history.context.canvasSelection, attached, 'outgoing descriptor includes all attachments');
    assert.equal(await bar.locator('section').count(), 3, 'run scope stays frozen');
    assert.equal(await bar.locator('button').count(), 0, 'cannot remove running targets');
    await page.evaluate(() => { window.shell.agentRunState.active = false; window.shell.renderAgentControls(); });
    assert.equal(await bar.locator('section').count(), 3, 'unrelated click does not replace attachments');
    await page.setViewportSize({ width: 1228, height: 1031 });
    await page.evaluate(() => {
        window.shell.applyAgentPanelWidth(375);
        window.shell.setAgentPrdContext('whole', '需求文档', '内容');
    });
    assert.equal(await page.locator('#agentPrdContextBar').isVisible(), true);
    assert.ok(await bar.evaluate(el => el.scrollWidth <= el.clientWidth));
    await page.screenshot({ path: path.join(temporary, 'canvas-context.png') });
    await page.evaluate(() => {
        window.shell.agentSessionContext = window.shell.getAgentGlobalContext();
        window.shell.renderAgentControls();
    });
    assert.equal(await bar.isVisible(), false);
    await page.evaluate(() => {
        window.shell.agentSessionContext = { projectId: 'demo', pageId: 'website', version: 'v1' };
        window.shell.renderAgentControls();
    });
    assert.equal(await bar.isVisible(), false);
    await page.evaluate(() => {
        window.shell.agentSessionContext = { projectId: 'demo', pageId: 'legacy', version: 'v1' };
        window.shell.renderAgentControls();
    });
    for (const id of ['a', 'c', 'text']) await bar.locator(`[data-agent-remove-canvas-context="${id}"]`).click();
    assert.equal(await bar.isVisible(), false, 'all contexts can be removed');
    assert.deepEqual(await page.evaluate(() => window.shell.getAgentCanvasContextSelection()), []);
    assert.deepEqual(errors, []);
    console.log(`PASS: accumulated multi-object context; deduplication/removal; deselection retention; session isolation; frozen outgoing snapshot; narrow layout. Screenshot: ${temporary}/canvas-context.png`);
} finally {
    await browser?.close();
    for (const child of children) child.kill();
}
