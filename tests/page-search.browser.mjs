import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'prota-page-search-e2e-')));
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
        window.shell.enterProject('demo');
        window.shell.getProjectRecord().folders[0].collapsed = true;
        window.shell.renderSidebar();
    });
    const input = page.getByRole('searchbox', { name: '搜索页面', exact: true });
    await input.waitFor({ state: 'visible' });
    assert.equal(await page.locator('#pageNavSection .nav-title').count(), 0);
    assert.equal(await page.locator('#pageList [data-drag-type="page"]').count(), 0);
    for (const query of ['阅读', 'YUE DU', 'YDSZ', '阅读SZ', 'yuedusz', 'YÙE DÚ']) {
        await input.fill(query);
        assert.deepEqual(await page.locator('#pageList [data-drag-type="page"]').evaluateAll(items => items.map(item => item.dataset.dragId)), ['legacy'], query);
        assert.equal(await page.locator('#pageList [data-folder-toggle]').getAttribute('aria-expanded'), 'true');
        assert.equal(await input.evaluate(el => el === document.activeElement), true);
        assert.equal(await page.locator('#pageList [draggable="true"]').count(), 0);
    }
    await page.locator('#pageList .nav-tree-link--folder').click();
    assert.equal(await page.evaluate(() => window.shell.getProjectRecord().folders[0].collapsed), true);
    await input.fill('ＥＰＵＢ paiban');
    assert.equal(await page.locator('#pageList [data-drag-id="website"]').count(), 1);
    await input.press('Enter');
    assert.equal(await page.evaluate(() => window.shell.activePageId), 'website');
    await input.fill('找不到的页面xyz');
    assert.equal(await page.locator('#pageList [role="status"]').textContent(), '未找到匹配页面');
    await input.press('Escape');
    assert.equal(await input.inputValue(), '');
    assert.equal(await page.locator('#pageList [data-drag-type="page"]').count(), 0, 'collapse state restored');
    await input.fill('ydsz');
    await page.getByRole('button', { name: '清空页面搜索' }).click();
    assert.equal(await input.inputValue(), '');
    assert.equal(await input.evaluate(el => document.activeElement === el), true);
    await page.locator('#pageList [data-folder-toggle]').click();
    await wait(async () => await page.locator('#pageList [data-drag-type="page"]').count() === 4, 'expanded folder');
    await page.screenshot({ path: '/tmp/prota-page-search.png' });
    await input.fill('ydsz');
    await page.screenshot({ path: '/tmp/prota-page-search-results.png' });
    await input.fill('');
    await page.evaluate(() => {
        const project = window.shell.getProjectRecord();
        project.pages.push(...Array.from({ length: 100 }, (_, index) => ({
            id: `scroll-fixture-${index}`, name: `页面 ${index + 1}`, parentId: 'examples', versions: ['v1']
        })));
        window.shell.renderSidebar();
    });
    for (const height of [1000, 600]) {
        await page.setViewportSize({ width: 1440, height });
        await page.locator('#pageList').evaluate(el => { el.scrollTop = 0; });
        const headerBefore = await page.locator('.page-search-row').boundingBox();
        const firstBefore = await page.locator('#pageList > li').first().boundingBox();
        await page.locator('#pageList').evaluate(el => { el.scrollTop = el.scrollHeight; });
        assert.deepEqual(await page.locator('.page-search-row').boundingBox(), headerBefore, 'search and creation controls stay fixed');
        const firstAfter = await page.locator('#pageList > li').first().boundingBox();
        assert.ok(firstAfter.y < firstBefore.y, 'only page entries scroll');
        const list = await page.locator('#pageList').boundingBox();
        const last = await page.locator('#pageList > li').last().boundingBox();
        assert.ok(last.y >= list.y && last.y + last.height <= list.y + list.height + 1, 'last page remains reachable');
        const row = page.locator('#pageList .nav-tree-link').last();
        assert.equal(await row.evaluate(el => getComputedStyle(el).fontSize), '13px');
        assert.equal((await row.boundingBox()).height, 30, 'compact row height');
        await page.getByRole('button', { name: '新增页面', exact: true }).waitFor({ state: 'visible' });
    }
    await page.screenshot({ path: '/tmp/prota-page-list-compact.png' });
    await page.evaluate(() => {
        window.shell.activeProjectId = 'another-project';
        window.shell.renderSidebar();
    });
    assert.equal(await input.inputValue(), '', 'project navigation clears search');
    assert.deepEqual(errors, []);
    console.log('PASS page search: Chinese, pinyin, initials, mixed/full-width input, nested collapse, empty state, keyboard, clear, project reset and fixed controls at two viewport heights');
} finally {
    await browser?.close();
    children.forEach(child => child.kill('SIGTERM'));
    await fs.rm(temporary, { recursive: true, force: true });
}
