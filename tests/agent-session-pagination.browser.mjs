import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'prota-session-pagination-e2e-')));
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
    await page.evaluate(async () => {
        const shell = window.shell;
        await shell._agentSessionListTask?.promise;
        const sessions = Array.from({ length: 175 }, (_, index) => ({
            id: `pagination-${index}`, title: `分页会话 ${index}`, projectId: 'demo', pageId: 'legacy',
            version: 'v1', sessionScope: 'page', status: 'running', hasHistory: true,
            updatedAt: new Date(Date.now() - index * 1000).toISOString()
        }));
        window.__pageRequests = [];
        shell.agentApi.listSessions = async options => {
            window.__pageRequests.push(options);
            const start = Number(options.cursor || 0);
            if (start && window.__holdAppend) await new Promise(resolve => { window.__releaseAppend = resolve; });
            const items = sessions.slice(start, start + Math.min(options.limit, 100));
            const next = start + items.length;
            return { sessions: items, hasMore: next < sessions.length, nextCursor: next < sessions.length ? String(next) : null };
        };
        shell.enterProject('demo');
        shell.openAgentWorkbench();
        shell.agentSessionDrawerOpen = true;
        shell.agentSessionGroupMode = 'time';
        await shell.loadAgentSessions();
        shell.renderAgentWorkbench();
    });
    const list = page.locator('#agentSessionList');
    const more = list.locator('[data-agent-session-load-more]');
    const count = () => list.locator('[data-agent-session-id]').count();
    await wait(async () => await count() === 30, 'first page');
    for (const expected of [60, 90, 120]) {
        await more.click();
        await wait(async () => await count() === expected, `load ${expected} sessions`);
    }
    const beforePoll = await page.evaluate(() => window.__pageRequests.length);
    await wait(() => page.evaluate(before => window.__pageRequests.length > before && !window.shell.agentSessionListLoading, beforePoll), 'background state polling');
    assert.equal(await count(), 120, 'background polling retains all loaded sessions');
    await page.evaluate(() => { window.__holdAppend = true; });
    await more.click();
    assert.equal(await more.isDisabled(), true, 'load-more button disables during request');
    await more.evaluate(button => { button.click(); button.click(); });
    await page.evaluate(() => { window.__overlapRefresh = window.shell.loadAgentSessions().then(() => window.shell.renderAgentSessionList()); });
    await wait(() => page.evaluate(() => Boolean(window.__releaseAppend)), 'pending append');
    await page.evaluate(() => { window.__holdAppend = false; window.__releaseAppend(); });
    await page.evaluate(() => window.__overlapRefresh);
    assert.equal(await count(), 150, 'overlapping refresh waits for append and retains it');
    assert.equal(await page.evaluate(() => window.__pageRequests.filter(request => request.cursor === '120').length), 1, 'rapid clicks append only once');
    await more.click();
    await wait(async () => await count() === 175, 'last page');
    assert.equal(await more.count(), 0, 'no load-more button after final page');
    await page.evaluate(async () => { await window.shell.loadAgentSessions(); window.shell.renderAgentSessionList(); });
    assert.equal(await count(), 175, 'refresh retains the complete list');
    await page.screenshot({ path: '/tmp/prota-session-pagination.png' });
    assert.deepEqual(errors, []);
    console.log('PASS repeated load-more, actual background polling, overlapping refresh, disabled/loading button and all 175 sessions retained');
} finally {
    await browser?.close();
    children.forEach(child => child.kill('SIGTERM'));
    await fs.rm(temporary, { recursive: true, force: true });
}
