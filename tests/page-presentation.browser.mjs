import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'prota-presentation-e2e-')));
const root = path.join(temporary, 'workspace');
const config = path.join(temporary, 'config');
const children = [];
let browser, logs = '';
const write = async (relative, content) => { const file = path.join(root, relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content); };
const freePort = () => new Promise(resolve => { const server = net.createServer().listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const wait = async (predicate, label) => { for (let index = 0; index < 150; index++) { try { if (await predicate()) return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } throw Error(`Timed out: ${label}\n${logs.slice(-1500)}`); };
const run = (command, args, env) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] }); let output = '';
    child.stdout.on('data', value => output += value); child.stderr.on('data', value => output += value);
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve(output) : reject(Error(output)));
});

try {
    const pages = [{ id: 'legacy', name: '历史手机页' }, { id: 'website', name: 'Web 页面', targetDevice: 'web' }, { id: 'widget', name: '小组件画布', targetDevice: 'canvas' }, { id: 'infinite', name: '无限画布', targetDevice: 'canvas', pageMode: 'infinite-canvas' }]
        .map(page => ({ ...page, versions: ['v1'], activeVersion: 'v1', parentId: 'examples' }));
    await write('workspace.json', JSON.stringify({ id: 'presentation-fixture', formatVersion: 1 }));
    await write('data/projects.json', JSON.stringify({ projects: [{ id: 'demo', name: '呈现方式验证', folders: [{ id: 'examples', name: '示例' }], pages }], activeProjectId: 'demo', activePageId: 'legacy' }));
    await fs.cp(path.join(app, 'src/templates/mobile-frame'), path.join(root, 'src/pages/demo/legacy/v1'), { recursive: true });
    await fs.cp(path.join(app, 'src/templates/web-frame'), path.join(root, 'src/pages/demo/website/v1'), { recursive: true });
    await fs.cp(path.join(app, 'src/templates/canvas-frame'), path.join(root, 'src/pages/demo/widget/v1'), { recursive: true });
    await fs.cp(path.join(app, 'src/templates/infinite-canvas'), path.join(root, 'src/pages/demo/infinite/v1'), { recursive: true });
    // A local phone preview inside canvas must not activate whole-page mobile fitting.
    await write('src/pages/demo/widget/v1/index.html', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./styles.css"></head><body><main class="demo-stage"><label>标题 <input id="title" value="阅读进度"></label><section class="phone-shell"><div class="phone-screen"><h1 id="preview">阅读进度</h1></div></section></main><script src="./app.js"></script></body></html>');
    await write('src/pages/demo/widget/v1/styles.css', '*{box-sizing:border-box}body{margin:0;font-family:sans-serif}.demo-stage{display:grid;grid-template-columns:1fr 1fr;gap:32px;padding:32px;min-height:100vh}.phone-shell{background:#eee;padding:24px;border-radius:24px}.phone-screen{padding:16px}input{max-width:100%}@media(max-width:600px){.demo-stage{grid-template-columns:1fr}}');
    await write('src/pages/demo/widget/v1/app.js', 'document.querySelector("#title").addEventListener("input",e=>document.querySelector("#preview").textContent=e.target.value)');
    await write('src/pages/demo/website/v1/index.html', '<!doctype html><html><body><h1>Web fixture</h1></body></html>');
    const originalLegacy = await fs.readFile(path.join(root, 'src/pages/demo/legacy/v1/index.html'));
    const originalShell = await fs.readFile(path.join(app, 'portal/shell.js'));
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
    await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//, route => route.continue({ url: route.request().url().replace(/:8081\//, `:${agentPort}/`) }));
    await page.goto(`${base}/portal/index.html`, { waitUntil: 'domcontentloaded' });
    await wait(() => page.evaluate(() => Boolean(window.shell?.projects?.projects?.length && window.shell?.getAgentSkill('create-new-page'))), 'shell metadata and skills');
    await page.evaluate(() => window.shell.openNewPageAgentFlow({ projectId: 'demo' }));
    const mode = page.getByRole('combobox', { name: '页面呈现方式' });
    assert.equal(await mode.inputValue(), 'auto');
    // The status ticker runs every second. A user may keep the native menu open
    // across several ticks; replacing the select loses its popup and keyboard focus.
    await mode.focus();
    const originalModeControl = await mode.elementHandle();
    await page.waitForTimeout(1250);
    assert.equal(await originalModeControl.evaluate(node => node.isConnected), true, 'status refresh must retain the focused selector');
    assert.equal(await mode.evaluate(node => document.activeElement === node), true, 'status refresh must retain keyboard focus');
    await mode.click();
    await page.waitForTimeout(1250);
    assert.equal(await originalModeControl.evaluate(node => node.isConnected && document.activeElement === node), true, 'opening the native menu retains its control across a status tick');
    // macOS native popup items are outside headless Chromium's keyboard surface.
    await page.keyboard.press('Escape');
    await mode.selectOption('mobile');
    assert.equal(await mode.inputValue(), 'mobile', 'selection applies after status refresh');
    assert.equal(await page.evaluate(() => window.shell.newPageTargetDevice), 'mobile');
    assert.equal(await originalModeControl.evaluate(node => node.isConnected), true, 'changing mode retains the native control');
    await mode.selectOption('web');
    await page.locator('[data-new-page-style-toggle]').click();
    const frameworkMenu = page.locator('.new-page-style-menu-portal');
    const frameworkOption = frameworkMenu.locator('[data-new-page-style-option="shadcn-prototype"]');
    await frameworkOption.focus();
    const originalFrameworkOption = await frameworkOption.elementHandle();
    const menuScroll = await frameworkMenu.evaluate(node => { node.scrollTop = 70; return node.scrollTop; });
    await page.waitForTimeout(1250);
    assert.equal(await originalFrameworkOption.evaluate(node => node.isConnected && document.activeElement === node), true, 'framework menu retains options and focus during status ticks');
    assert.equal(await frameworkMenu.evaluate(node => node.scrollTop), menuScroll, 'framework menu retains scroll position');
    await frameworkOption.click();
    assert.equal(await page.evaluate(() => window.shell.newPageFrameworkId), 'shadcn-prototype');
    assert.equal(await frameworkMenu.count(), 0);
    await page.evaluate(() => window.shell.setNewPageFramework('ant-design-skill'));
    await mode.selectOption('auto');
    assert.equal(await page.locator('[data-new-page-style-toggle]').count(), 0);
    for (const [value, hasPicker] of [['mobile', true], ['web', true], ['canvas', false], ['infinite-canvas', false], ['auto', false]]) {
        await mode.selectOption(value);
        assert.equal(await mode.inputValue(), value);
        assert.equal(await page.locator('[data-new-page-style-toggle]').count(), hasPicker ? 1 : 0);
        const instructions = await page.evaluate(() => window.shell.getNewPageExecutionInstructions());
        if (value === 'auto' || value === 'canvas') assert.doesNotMatch(instructions, /framework-skills\/|design-systems\//);
        if (value === 'web') assert.match(instructions, /framework-skills\/ant-design-skill\/SKILL.md/);
    }
    await mode.selectOption('infinite-canvas');
    const infiniteInstructions = await page.evaluate(() => window.shell.getNewPageExecutionInstructions());
    assert.match(infiniteInstructions, /pageMode: "infinite-canvas"/);
    assert.match(infiniteInstructions, /src\/templates\/infinite-canvas/);
    assert.doesNotMatch(infiniteInstructions, /targetDevice: "infinite-canvas"/);
    await page.locator('#agentInput').fill('做一个桌面小组件配置与实时预览工具');
    await mode.selectOption('canvas');
    assert.equal(await page.locator('#agentInput').inputValue(), '做一个桌面小组件配置与实时预览工具');
    // Intercept only model execution; actual session creation and request assembly run normally.
    let sent;
    await page.route('**/skills/create-new-page/run', async route => { sent = route.request().postDataJSON(); await route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }); });
    await page.evaluate(() => window.shell.submitAgentMessage());
    assert.equal(sent.message, '做一个桌面小组件配置与实时预览工具');
    assert.match(sent.internalInstructions, /targetDevice: "canvas"/);
    assert.doesNotMatch(sent.message, /执行上下文/);
    await page.evaluate(async () => { window.shell.agentRunState.active = false; await window.shell.openNewPageAgentFlow({ projectId: 'demo' }); });
    assert.equal(await mode.inputValue(), 'auto', 'new creation resets to intelligent mode');
    await page.locator('#agentStatusContext').screenshot({ path: '/tmp/prota-presentation-picker.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await mode.isVisible(), true);
    await mode.selectOption('canvas');
    assert.equal(await mode.inputValue(), 'canvas');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => window.shell.openNewPageAgentFlow({ projectId: 'demo', targetDevice: 'mobile' }));
    assert.equal(await mode.inputValue(), 'mobile', 'explicit template entry retains its manual choice');
    await page.evaluate(async () => { window.shell.closeAgentWorkbench(); window.shell.enterProject('demo'); await window.shell.switchPage('widget'); });
    const preview = page.frameLocator('#mainIframe');
    await preview.locator('#title').fill('本周已读 3 小时');
    assert.equal(await preview.locator('#preview').innerText(), '本周已读 3 小时');
    assert.equal(await preview.locator('html').getAttribute('data-prota-frame-fit'), null);
    assert.ok((await preview.locator('.demo-stage').boundingBox()).width > 600);
    await page.screenshot({ path: '/tmp/prota-presentation-canvas.png' });
    await page.evaluate(() => window.shell.switchPage('legacy'));
    await wait(() => preview.locator('html').getAttribute('data-prota-frame-fit').then(value => value === 'desktop'), 'legacy phone fit');
    await page.evaluate(() => window.shell.switchPage('infinite'));
    await preview.locator('#stage').click({ button: 'right', position: { x: 300, y: 220 } });
    await preview.getByRole('menuitem', { name: '文本', exact: true }).click();
    await wait(() => page.evaluate(() => window.shell.getAgentContext().canvasSelection?.[0]?.type === 'text'), 'canvas selection reaches Agent');
    await wait(() => preview.locator('#save-status').textContent().then(value => value === '已保存'), 'canvas save inside Portal');
    // Real parent/child bridge and session routing; only the model stream is stubbed.
    let canvasRun;
    await page.route('**/api/agent/session/*/message', async route => {
        canvasRun = route.request().postDataJSON();
        const file = path.join(root, 'src/pages/demo/infinite/v1/canvas-data.js');
        const document = JSON.parse((await fs.readFile(file, 'utf8')).trim().slice('window.PROTA_CANVAS = '.length).replace(/;$/, ''));
        document.nodes[0].text = 'Agent 已更新选中文本';
        await fs.writeFile(file, 'window.PROTA_CANVAS = ' + JSON.stringify(document) + ';');
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
    });
    const currentSession = await page.evaluate(() => window.shell.agentSessionId);
    await page.locator('#agentInput').fill('保留的输入草稿');
    await preview.locator('#selection-tools [data-action=agent]').click();
    await wait(() => page.evaluate(() => window.shell.agentWorkbenchOpen && window.shell.agentSessionContext?.pageId === 'infinite'), 'reuse current Agent');
    assert.equal(await page.evaluate(() => window.shell.agentSessionId), currentSession, 'canvas must not create or switch Agent sessions');
    assert.equal(await page.locator('#agentInput').inputValue(), '保留的输入草稿');
    assert.equal(await preview.locator('#agent-composer,#agent-prompt').count(), 0);
    await page.locator('#agentInput').fill('把选中文本改成更明确的标题');
    await page.evaluate(() => window.shell.submitAgentMessage());
    await wait(() => Boolean(canvasRun), 'canvas Agent request');
    assert.equal(canvasRun.projectId, 'demo');
    assert.equal(canvasRun.pageId, 'infinite');
    assert.equal(canvasRun.pageMode, 'infinite-canvas');
    assert.equal(canvasRun.canvasDirty, false);
    assert.equal(canvasRun.canvasSelection[0].type, 'text');
    assert.equal(canvasRun.message, '把选中文本改成更明确的标题');
    await wait(() => preview.locator('.node.text .node-content').textContent().then(value => value === 'Agent 已更新选中文本'), 'Agent result refreshed without iframe reload');
    await page.evaluate(() => { window.shell.closeAgentWorkbench(); return window.shell.switchPage('legacy'); });
    await wait(() => preview.locator('html').getAttribute('data-prota-frame-fit').then(value => value === 'desktop'), 'return from canvas to phone');
    for (const item of pages) await post('/api/share-page', { projectId: 'demo', pageId: item.id, version: 'v1', shareType: 'local' });
    await post('/api/share-folder', { projectId: 'demo', folderId: 'examples', shareType: 'local' });
    for (const [filename, expected] of [['widget-v1-local.html', 'canvas'], ['website-v1-local.html', 'web'], ['legacy-v1-local.html', 'mobile'], ['demo-examples-folder-local.html', 'mobile']]) {
        await page.goto(`${base}/shares/${filename}`, { waitUntil: 'domcontentloaded' });
        await wait(() => page.evaluate(value => window.shell?.getPageRecord()?.targetDevice === value, expected), `share ${filename}`);
        if (expected === 'canvas') {
            await page.frameLocator('#mainIframe').locator('#title').fill('分享预览');
            assert.equal(await page.frameLocator('#mainIframe').locator('#preview').innerText(), '分享预览');
            assert.equal(await page.frameLocator('#mainIframe').locator('html').getAttribute('data-prota-frame-fit'), null);
        }
        if (filename.includes('folder')) {
            await page.evaluate(() => window.shell.switchPage('widget'));
            await page.frameLocator('#mainIframe').locator('#preview').waitFor();
            assert.equal(await page.evaluate(() => window.shell.getPageRecord().targetDevice), 'canvas');
            assert.equal(await page.frameLocator('#mainIframe').locator('html').getAttribute('data-prota-frame-fit'), null);
        }
    }
    await page.goto(`${base}/shares/infinite-v1-local.html`, { waitUntil: 'domcontentloaded' });
    await page.frameLocator('#mainIframe').locator('body.readonly').waitFor();
    assert.equal(await page.evaluate(() => window.shell.getPageRecord().pageMode), 'infinite-canvas');
    assert.equal(await page.frameLocator('#mainIframe').locator('#save').count(), 0);
    for (const [id, expectedWidth] of [['widget', 2880], ['website', 2880]]) {
        const result = await post('/api/capture-screenshot', { projectId: 'demo', pageId: id, version: 'v1', filename: 'presentation-shot' });
        const png = await fs.readFile(path.join(root, result.path));
        assert.equal(png.readUInt32BE(16), expectedWidth, 'capture follows desktop metadata instead of phone clipping');
    }
    const legacyShot = await post('/api/capture-screenshot', { projectId: 'demo', pageId: 'legacy', version: 'v1', filename: 'legacy-shot' });
    const legacyMetadata = JSON.parse(await fs.readFile(path.join(root, legacyShot.path.replace(/\.png$/, '.json')), 'utf8'));
    assert.equal(legacyMetadata.device.name, 'iphone-17', 'legacy capture keeps phone defaults');
    await run('node', ['tools/capture/prd-evidence.mjs', '--page-dir', 'src/pages/demo/widget/v1', '--out', 'shots', '--device', 'iphone-17', '--capture-selector', 'none', '--shot-name', 'override', '--no-auto-state'], env);
    const override = await fs.readFile(path.join(root, 'shots/override.png'));
    assert.equal(override.readUInt32BE(16), 1470, 'explicit capture device overrides saved presentation');
    assert.deepEqual(await fs.readFile(path.join(root, 'src/pages/demo/legacy/v1/index.html')), originalLegacy);
    assert.deepEqual(await fs.readFile(path.join(app, 'portal/shell.js')), originalShell);
    assert.deepEqual(errors, []);
    console.log('PASS: intelligent default, manual choices, isolated instructions, real dispatch payload, canvas interaction, legacy phone fit, page/folder shares, metadata-aware screenshots and explicit overrides.');
} finally {
    await browser?.close();
    await Promise.all(children.map(child => new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); if (child.exitCode !== null) resolve(); })));
    await fs.rm(temporary, { recursive: true, force: true });
}
