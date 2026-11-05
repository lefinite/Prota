import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'prota-session-list-e2e-')));
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
    const fixture = Array.from({ length: 18 }, (_, index) => ({
        id: `fixture-${index}`, title: `会话 ${index}`, projectId: 'demo',
        pageId: index % 2 ? 'website' : 'legacy', version: index % 3 ? 'v1' : 'v2',
        sessionScope: 'page', status: ['running', 'succeeded', 'waiting_approval', 'failed', 'ready'][index % 5],
        hasHistory: true, createdAt: '2026-11-01T00:00:00Z', updatedAt: new Date(Date.now() - index * 3600000).toISOString()
    }));
    await page.evaluate(fixture => {
        const shell = window.shell;
        shell.enterProject('demo');
        shell.openAgentWorkbench();
        shell.agentSessionDrawerOpen = true;
        shell.agentSessionsList = fixture;
        shell.agentSessionId = 'fixture-0';
        shell.agentRunState = { ...shell.getDefaultAgentRunState(), status: 'running', active: true };
        shell.agentSessionGroupMode = 'time';
        // Isolate list interaction from background requests for these in-memory sessions.
        shell.loadAgentSessions = async () => {};
        shell.refreshAgentSessionsSoon = () => {};
        shell.renderAgentWorkbench();
    }, fixture);
    const list = page.locator('#agentSessionList');
    await list.waitFor({ state: 'visible' });
    assert.equal(await list.locator('[data-state="completed"], [data-state="waiting"], [data-state="failed"]').count(), 0, 'existing statuses start read without manual clearing');
    await page.evaluate(() => { window.shell.agentSessionStatusBaselineAt = Date.now() - 48 * 3600000; window.shell.renderAgentSessionList(); });
    assert.equal(await list.locator('[data-state="running"]').count(), 4);
    assert.equal(await list.locator('[data-state="completed"]').count(), 4);
    assert.equal(await list.locator('[data-state="waiting"]').count(), 4);
    assert.equal(await list.locator('[data-state="failed"]').count(), 3);
    const firstMore = list.locator('[data-agent-session-more="fixture-0"]');
    await firstMore.click();
    const menu = page.getByRole('menu', { name: '会话操作', exact: true });
    await menu.waitFor({ state: 'visible' });
    assert.equal(await firstMore.getAttribute('aria-expanded'), 'true');
    const originalMenu = await menu.elementHandle();
    await page.evaluate(() => {
        window.shell.agentSessionsList[1].status = 'failed';
        window.shell.renderAgentSessionList();
        window.shell.renderAgentWorkbench();
    });
    await page.waitForTimeout(1300);
    assert.equal(await originalMenu.evaluate(el => el.isConnected), true, 'menu survives list updates and ticker');
    assert.equal(await menu.getByRole('menuitem', { name: '删除会话' }).evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('Escape');
    assert.equal(await menu.count(), 0);
    assert.equal(await firstMore.evaluate(el => document.activeElement === el), true);
    await firstMore.click();
    await firstMore.click();
    assert.equal(await menu.count(), 0, 'more button toggles menu');
    const row = list.locator('[data-agent-session-id="fixture-1"]');
    await row.click({ button: 'right' });
    await menu.waitFor({ state: 'visible' });
    assert.equal(await menu.locator('[data-agent-session-delete]').getAttribute('data-agent-session-delete'), 'fixture-1');
    assert.equal(await page.evaluate(() => window.shell.agentSessionId), 'fixture-0', 'right click does not switch session');
    await page.locator('#agentInput').click();
    assert.equal(await menu.count(), 0, 'outside click dismisses');
    await firstMore.focus();
    await page.keyboard.press('Shift+F10');
    await menu.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '按页面', exact: true }).click();
    assert.deepEqual(await list.locator('.agent-session-group__label').allTextContents(), ['页面搜索验证 / 阅读设置', '页面搜索验证 / EPUB 排版']);
    const groups = await list.locator('.agent-session-group').evaluateAll(groups => groups.map(group => [...group.querySelectorAll('[data-agent-session-id]')].map(button => button.dataset.agentSessionId)));
    assert.deepEqual(groups[0], fixture.filter((_, i) => i % 2 === 0).map(s => s.id));
    assert.deepEqual(groups[1], fixture.filter((_, i) => i % 2 === 1).map(s => s.id));
    assert.equal(await page.evaluate(() => window.shell.readAgentStorage('session-group-mode')), 'page');
    const pageGroups = list.locator('details.agent-session-group--page');
    assert.deepEqual(await pageGroups.evaluateAll(groups => groups.map(group => group.open)), [true, false], 'only current session page opens by default');
    assert.equal(await list.locator('.agent-session-item__meta').count(), 0, 'page groups show no page or version metadata');
    await pageGroups.nth(1).locator('summary').click();
    await wait(() => pageGroups.nth(1).evaluate(group => group.open && window.shell.agentSessionGroupOpen.get(group.dataset.sessionPageGroup)), 'manual group expansion');
    await page.evaluate(() => window.shell.renderAgentSessionList());
    assert.equal(await pageGroups.nth(1).evaluate(group => group.open), true, 'expanded groups survive list refresh');
    await pageGroups.nth(0).locator('summary').click();
    await wait(() => pageGroups.nth(0).evaluate(group => !group.open && window.shell.agentSessionGroupOpen.get(group.dataset.sessionPageGroup) === false), 'manual collapse');
    await page.evaluate(() => window.shell.renderAgentSessionList());
    assert.equal(await pageGroups.nth(0).evaluate(group => group.open), false, 'current group can be manually collapsed');
    await page.evaluate(() => { window.shell.agentSessionId = 'fixture-1'; window.shell.renderAgentSessionList(); });
    assert.equal(await pageGroups.nth(1).evaluate(group => group.open), true, 'switching session reveals its page group');
    await page.evaluate(() => { window.shell.agentSessionId = 'fixture-0'; window.shell.renderAgentSessionList(); });
    assert.equal(await pageGroups.nth(0).evaluate(group => group.open), true);

    await page.getByRole('button', { name: '按时间', exact: true }).click();
    assert.equal(await page.evaluate(() => window.shell.readAgentStorage('session-group-mode')), 'time');
    assert.ok((await list.locator('.agent-session-item__meta').allTextContents()).every(text => !text.includes('v1') && !text.includes('v2')), 'time mode also hides versions');
    await page.evaluate(() => {
        window.shell.agentRunState = { ...window.shell.agentRunState, active: false, status: 'succeeded' };
        window.shell.renderAgentChrome();
    });
    assert.equal(await firstMore.locator('..').locator('[data-state="completed"]').count(), 0, 'completion currently being viewed has no unread dot');
    const last = list.locator('[data-agent-session-id]').last();
    await last.scrollIntoViewIfNeeded();
    await last.click({ button: 'right' });
    const bounds = await menu.boundingBox();
    assert.ok(bounds.x >= 8 && bounds.y >= 8 && bounds.x + bounds.width <= 1440 && bounds.y + bounds.height <= 1000, 'menu stays within viewport at last row');
    await list.evaluate(el => { el.scrollTop = 0; });
    await wait(async () => await menu.count() === 0, 'scroll closes menu');
    await page.evaluate(() => {
        const shell = window.shell;
        shell.refreshSwitchedAgentSession = async () => {};
        shell.agentSessionsList.find(session => session.id === 'fixture-6').runId = 'first-run-6';
        shell.renderAgentSessionList();
    });
    const completedRow = list.locator('[data-agent-session-id="fixture-6"]').locator('..');
    assert.equal(await completedRow.locator('[data-state="completed"]').count(), 1, 'background completion is unread');
    await completedRow.locator('[data-agent-session-id]').click();
    assert.equal(await completedRow.locator('[data-state="completed"]').count(), 0, 'opening completed session clears its dot');
    assert.equal(await page.evaluate(() => window.shell.readAgentStorage('read-statuses')['fixture-6'].runId), 'first-run-6');
    await page.evaluate(() => window.shell.renderAgentSessionList());
    assert.equal(await completedRow.locator('[data-state="completed"]').count(), 0, 'refresh does not restore a read dot');
    await page.evaluate(() => {
        const shell = window.shell;
        shell.agentSessionId = 'fixture-0';
        Object.assign(shell.agentSessionsList.find(session => session.id === 'fixture-6'), { runId: 'second-run-6', updatedAt: new Date().toISOString() });
        shell.renderAgentSessionList();
    });
    assert.equal(await completedRow.locator('[data-state="completed"]').count(), 1, 'a later background run gets a new dot');
    const failedRow = list.locator('[data-agent-session-id="fixture-3"]').locator('..');
    await failedRow.locator('[data-agent-session-id]').click();
    assert.equal(await failedRow.locator('[data-state="failed"]').count(), 0, 'opening failed session clears its dot');
    const runningRow = list.locator('[data-agent-session-id="fixture-5"]').locator('..');
    await runningRow.locator('[data-agent-session-id]').click();
    assert.equal(await runningRow.locator('[data-state="running"]').count(), 1, 'opening running session retains spinner');
    await page.evaluate(() => { window.shell.agentSessionId = 'fixture-0'; window.shell.agentRunState = { ...window.shell.getDefaultAgentRunState(), status: 'succeeded' }; window.shell.renderAgentSessionList(); });
    // Exercise the shared delete action without deleting real or server-side sessions.
    await page.evaluate(() => {
        window.shell.deleteAgentSessionById = async id => {
            window.__deletedSession = id;
            window.shell.agentSessionsList = window.shell.agentSessionsList.filter(session => session.id !== id);
            window.shell.renderAgentSessionList();
        };
    });
    await firstMore.click();
    await menu.getByRole('menuitem', { name: '删除会话' }).click();
    assert.equal(await page.evaluate(() => window.__deletedSession), 'fixture-0');
    assert.equal(await firstMore.count(), 0);
    await page.getByRole('button', { name: '按页面', exact: true }).click();
    await page.screenshot({ path: '/tmp/prota-session-list.png' });
    assert.deepEqual(errors, []);
    console.log('PASS session states, live completion, more menu, right click, keyboard, refresh stability, viewport positioning, deletion, page/time grouping, default collapse, persistent manual expansion and historical baseline and per-status read receipts');
} finally {
    await browser?.close();
    children.forEach(child => child.kill('SIGTERM'));
    await fs.rm(temporary, { recursive: true, force: true });
}
