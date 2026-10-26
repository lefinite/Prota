import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'prota-reasoning-')));
const root = path.join(temp, 'workspace'), config = path.join(temp, 'config');
let browser, logs = ''; const children = [];
const write = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, value); };
const freePort = () => new Promise(resolve => { const server = net.createServer().listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const wait = async (fn, label) => { for (let i = 0; i < 150; i++) { try { if (await fn()) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw Error(`Timeout: ${label}\n${logs.slice(-1800)}`); };
try {
    await write(path.join(root, 'workspace.json'), JSON.stringify({ id: 'reasoning-fixture', formatVersion: 1 }));
    await write(path.join(root, 'data/projects.json'), JSON.stringify({ projects: [{ id: 'demo', name: '交互验证', pages: [{ id: 'reader', name: '测试页', versions: ['v1'], targetDevice: 'web' }] }], activeProjectId: 'demo', activePageId: 'reader' }));
    await write(path.join(root, 'src/pages/demo/reader/v1/index.html'), '<!doctype html><html><body>测试页面</body></html>');
    const providers = [
        { id: 'glm', presetId: 'zhipu-anthropic', label: '智谱 GLM', model: 'glm-5.3', baseURL: 'https://open.bigmodel.cn/api/anthropic', apiType: 'anthropic-messages', apiKey: 'test-only', sdkOptions: { planMode: true } },
        { id: 'mimo', presetId: 'xiaomi-mimo', label: 'Xiaomi MiMo', model: 'mimo-v2.5-pro', baseURL: 'https://token-plan-cn.xiaomimimo.com/anthropic', apiType: 'anthropic-messages', apiKey: 'test-only', sdkOptions: {} },
        { id: 'unknown', label: '自定义', model: 'unknown', baseURL: 'https://example.invalid', apiType: 'openai-completions', apiKey: 'test-only', sdkOptions: {} }
    ];
    await write(path.join(config, 'workspace.json'), JSON.stringify({ path: root }));
    await write(path.join(config, 'agent-provider-config.json'), JSON.stringify({ providers, activeProviderId: 'glm', selectedProviderId: 'glm' }));
    const bridgePort = await freePort(), agentPort = await freePort();
    const base = `http://127.0.0.1:${bridgePort}`;
    const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', READIFY_CONFIG_DIR: config, READIFY_WORKSPACE: root, READIFY_PORT: String(bridgePort), READIFY_AGENT_PORT: String(agentPort) };
    for (const [command, args] of [['python3', ['server/bridge.py']], ['node', ['server/agent-server.mjs']]]) {
        const child = spawn(command, args, { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child);
        child.stdout.on('data', data => logs += data); child.stderr.on('data', data => logs += data);
    }
    await wait(async () => (await fetch(`${base}/api/workspace`)).ok, 'bridge');
    await wait(async () => (await fetch(`http://127.0.0.1:${agentPort}/api/agent/health`)).ok, 'agent');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(/fonts\.google/, route => route.abort());
    await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//, route => route.continue({ url: route.request().url().replace(/:8081\//, `:${agentPort}/`) }));
    await page.goto(`${base}/portal/index.html`, { waitUntil: 'domcontentloaded' });
    await wait(() => page.evaluate(() => Boolean(window.shell?.agentProviderPersistenceReady && window.shell?.getAgentSkill('create-new-page'))), 'shell');
    await page.evaluate(() => window.shell.openNewPageAgentFlow({ projectId: 'demo' }));
    const toggle = page.locator('#agentReasoningToggle'), menu = page.locator('#agentReasoningDropdown');
    assert.equal(await page.locator('#agentPlanModeToggle').count(), 0);
    await toggle.click();
    assert.deepEqual(await menu.locator('[data-reasoning-value]').evaluateAll(nodes => nodes.map(n => n.dataset.reasoningValue)), ['low', 'high', 'max']);
    assert.equal(await menu.locator('[aria-checked=true]').getAttribute('data-reasoning-value'), 'max');
    assert.equal(await menu.locator('.agent-reasoning-default').count(), 1);
    assert.equal(await menu.locator('.agent-reasoning-hint, small').count(), 0);
    await menu.locator('[data-reasoning-value=high]').focus();
    const original = await menu.locator('[data-reasoning-value=high]').elementHandle();
    await page.waitForTimeout(1400);
    assert.equal(await original.evaluate(n => n.isConnected && document.activeElement === n), true);
    await page.keyboard.press('Enter');
    await wait(async () => (await toggle.innerText()).includes('高') && !(await toggle.isDisabled()), 'save effort');
    const saved = JSON.parse(await fs.readFile(path.join(config, 'agent-provider-config.json')));
    assert.equal(saved.providers[0].sdkOptions.reasoningEffort, 'high');
    assert.equal('planMode' in saved.providers[0].sdkOptions, false);
    // No success toast is needed; the selected label is the feedback.
    await toggle.focus(); await page.keyboard.press('ArrowDown');
    assert.equal(await menu.locator('[aria-checked=true]').getAttribute('data-reasoning-value'), 'high');
    await page.keyboard.press('End');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.reasoningValue), 'max');
    await page.keyboard.press('Escape'); assert.equal(await menu.isVisible(), false);
    assert.equal(await toggle.evaluate(n => document.activeElement === n), true);
    await toggle.click();
    const desktopBounds = await menu.boundingBox();
    assert.ok(desktopBounds.x >= 0 && desktopBounds.x + desktopBounds.width <= 1440);
    await page.screenshot({ path: '/tmp/prota-reasoning-desktop.png' });
    const triggerBounds = await toggle.boundingBox();
    await page.screenshot({ path: '/tmp/prota-reasoning-detail.png', clip: { x: desktopBounds.x - 8, y: desktopBounds.y - 8, width: desktopBounds.width + 16, height: triggerBounds.y + triggerBounds.height - desktopBounds.y + 16 } });
    await page.locator('#agentInput').click({ position: { x: (await page.locator('#agentInput').boundingBox()).width - 12, y: 12 } }); assert.equal(await menu.isVisible(), false);
    await page.evaluate(() => { window.shell.agentRunState.active = true; window.shell.renderAgentWorkbench(); });
    assert.equal(await toggle.isDisabled(), true);
    await page.evaluate(() => { window.shell.agentRunState.active = false; window.shell.renderAgentWorkbench(); });
    await page.locator('#agentModelToggle').click();
    await page.locator('#agentModelDropdown [data-provider-id=mimo]').click();
    await toggle.click();
    assert.deepEqual(await menu.locator('[data-reasoning-value]').evaluateAll(nodes => nodes.map(n => n.dataset.reasoningValue)), ['enabled', 'disabled']);
    await menu.locator('[data-reasoning-value=disabled]').click();
    await wait(async () => (await toggle.innerText()).includes('关闭') && !(await toggle.isDisabled()), 'save MiMo');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(() => page.evaluate(() => window.shell?.agentProviderPersistenceReady && window.shell.getActiveProvider()?.id === 'mimo'), 'reload');
    await page.evaluate(() => window.shell.openAgentWorkbench());
    await wait(async () => (await toggle.innerText()).includes('关闭'), 'restore MiMo');
    await page.evaluate(() => window.shell.activateProvider('glm', { silent: true }));
    assert.match(await toggle.innerText(), /高/);
    // Failure restores the old selection and leaves the menu usable.
    await page.route('**/api/agent-provider-config', route => route.request().method() === 'POST' ? route.fulfill({ status: 500, body: 'fixture failure' }) : route.continue());
    await toggle.click(); await menu.locator('[data-reasoning-value=low]').click();
    await wait(async () => !(await toggle.isDisabled()) && (await toggle.innerText()).includes('高'), 'rollback');
    assert.equal(await page.evaluate(() => window.shell.getActiveProvider().sdkOptions.reasoningEffort), 'high');
    await page.unroute('**/api/agent-provider-config');
    await page.evaluate(() => window.shell.activateProvider('unknown', { silent: true }));
    await toggle.click(); assert.equal(await menu.locator('[data-reasoning-value]').count(), 1);
    assert.match(await menu.locator('[data-reasoning-value=default]').getAttribute('title'), /尚未确认/);
    await page.locator('#agentInput').click({ position: { x: (await page.locator('#agentInput').boundingBox()).width - 12, y: 12 } });
    await page.evaluate(() => window.shell.activateProvider('glm', { silent: true }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { window.shell.agentSessionDrawerOpen = true; window.shell.renderAgentChrome(); });
    await toggle.click();
    await page.waitForTimeout(250);
    const bounds = await menu.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, JSON.stringify(bounds));
    assert.ok(bounds.y >= 0);
    assert.equal(await menu.evaluate(node => { const b = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(b.x + 24, b.y + 30)); }), true, 'session drawer must not cover reasoning menu');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/prota-reasoning-mobile.png' });
    assert.deepEqual(errors, []);
    console.log('PASS: keyboard, stable focus, model-aware options, persistence, rollback, busy state, desktop and narrow layout.');
} finally {
    await browser?.close();
    for (const child of children) child.kill('SIGTERM');
    await fs.rm(temp, { recursive: true, force: true });
}
