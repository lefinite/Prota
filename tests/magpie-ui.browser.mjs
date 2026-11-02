import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const product = fileURLToPath(new URL('..', import.meta.url));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-magpie-ui-'));
const workspace = path.join(root, 'workspace'), config = path.join(root, 'config'), home = path.join(root, 'home');
const anchor = path.join(home, '.config/prota/magpie-agent.json');
let managed;
const write = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, value); };
const port = async () => { const server = http.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const value = server.address().port; await new Promise(resolve => server.close(resolve)); return value; };
const wait = async (check, label) => { for (let i = 0; i < 200; i++) { try { if (await check()) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error(`Timed out: ${label}`); };
const children = []; let browser; let logs = '';
const requests = [];
const model = http.createServer(async (req, res) => {
    if (req.url === '/api/hello') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ name: 'magpie', version: 'ui-fixture' })); return; }
    if (req.url === '/v1/models') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: ['fixture-model', 'fixture-pinned'].map(id => ({ id, display_name: id, native_endpoints: ['/v1/chat/completions'], reasoning: true, reasoning_levels: ['low', 'high'], modalities: { input: ['text'] }, context_window: 64000, max_output_tokens: 1024 })) })); return; }
    let raw = ''; for await (const bytes of req) raw += bytes;
    const body = JSON.parse(raw); requests.push(body);
    const tools = body.messages.filter(message => message.role === 'tool');
    const title = body.model !== 'fixture-model';
    let delta; let finish = 'stop';
    if (title) delta = { content: '交互验证' };
    else if (!tools.length) { delta = { tool_calls: [{ index: 0, id: 'ui-write', type: 'function', function: { name: 'write',
        arguments: JSON.stringify({ path: 'src/pages/demo/reader/v1/app.js', content: 'window.piUiVerified = true;' }) } }] }; finish = 'tool_calls'; }
    else if (tools.length === 1) { delta = { tool_calls: [{ index: 0, id: 'ui-question', type: 'function', function: { name: 'ask_user',
        arguments: JSON.stringify({ question: '选择演示语言', options: ['中文', 'English'], allowFreeText: false }) } }] }; finish = 'tool_calls'; }
    else if (tools.length === 2) { delta = { tool_calls: [{ index: 0, id: 'ui-write-second', type: 'function', function: { name: 'write',
        arguments: JSON.stringify({ path: 'src/pages/demo/reader/v1/session-approved.txt', content: 'same-tool-session-grant' }) } }] }; finish = 'tool_calls'; }
    else delta = { content: 'Pi UI 验证完成。' };
    const chunk = (value, reason = null) => ({ id: 'ui-fixture', object: 'chat.completion.chunk', created: 1,
        model: body.model, choices: [{ index: 0, delta: value, finish_reason: reason }] });
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`data: ${JSON.stringify(chunk({ role: 'assistant' }))}\n\n`);
    res.write(`data: ${JSON.stringify(chunk(delta))}\n\n`); res.write(`data: ${JSON.stringify(chunk({}, finish))}\n\n`); res.end('data: [DONE]\n\n');
});
try {
    await new Promise(resolve => model.listen(0, '127.0.0.1', resolve));
    await write(path.join(workspace, 'workspace.json'), JSON.stringify({ id: 'pi-ui-fixture', formatVersion: 1 }));
    await write(path.join(workspace, 'data/projects.json'), JSON.stringify({ projects: [{ id: 'demo', name: '交互验证', pages: [
        { id: 'reader', name: '阅读器', versions: ['v1'], activeVersion: 'v1', targetDevice: 'web' }
    ] }], activeProjectId: 'demo', activePageId: 'reader' }));
    const pageDir = path.join(workspace, 'src/pages/demo/reader/v1');
    await write(path.join(pageDir, 'index.html'), '<!doctype html><html><body>Pi UI fixture</body></html>');
    await write(path.join(pageDir, 'styles.css'), 'body { color: black; }'); await write(path.join(pageDir, 'app.js'), 'window.initial = true;');
    await write(path.join(config, 'workspace.json'), JSON.stringify({ path: workspace }));
    await write(path.join(config, 'agent-provider-config.json'), JSON.stringify({ providers: [{ id: 'fixture', label: '本地测试模型',
        apiType: 'openai-completions', model: 'fixture-model', models: ['fixture-model'],
        baseURL: `http://127.0.0.1:${model.address().port}/v1`, apiKey: 'fixture-only-key', sdkOptions: { permissionMode: 'default', maxTurns: 10 } }],
        activeProviderId: 'fixture', selectedProviderId: 'fixture' }));
    managed = { model: 'fixture-model', provider: 'magpie', managedBy: 'magpie', apiType: 'openai-completions', baseURL: `http://127.0.0.1:${model.address().port}/v1`, apiKey: 'fixture-only-key' };
    await write(anchor, JSON.stringify(managed));
    const bridgePort = await port(), agentPort = await port(); const base = `http://127.0.0.1:${bridgePort}`;
    const env = { ...process.env, HOME: home, USERPROFILE: home, READIFY_WORKSPACE: workspace, READIFY_CONFIG_DIR: config, READIFY_PORT: String(bridgePort),
        READIFY_AGENT_PORT: String(agentPort), PYTHONDONTWRITEBYTECODE: '1' };
    for (const [command, args] of [[process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['server/bridge.py']], [process.execPath, ['server/agent-server.mjs']]]) {
        const child = spawn(command, args, { cwd: product, env, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child);
        child.stdout.on('data', bytes => { logs += bytes; }); child.stderr.on('data', bytes => { logs += bytes; });
    }
    await wait(async () => (await fetch(base + '/api/workspace')).ok, 'workspace bridge');
    await wait(async () => (await fetch(`http://127.0.0.1:${agentPort}/api/agent/health`)).ok, 'Pi Gateway');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(60000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(/fonts\.google/, route => route.abort());
    await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//, route => route.continue({ url: route.request().url().replace(/:8081\//, `:${agentPort}/`) }));
    await page.goto(base + '/portal/index.html', { waitUntil: 'domcontentloaded' });
    await wait(() => page.evaluate(() => Boolean(window.shell?.agentProviderPersistenceReady && window.shell?.agentApi)), 'Portal');

    await page.evaluate(() => window.shell.toggleAgentConfigModal());
    await page.locator('#providerCustomList [data-provider-id="integration:magpie"]').click();
    await page.locator('.magpie-details [data-magpie="use"]').click();
    await wait(() => page.evaluate(() => window.shell.agentModelView?.providerBinding?.policy === 'follow'), 'follow binding');
    await wait(() => page.evaluate(() => !window.shell._agentModelSwitching), 'model switch complete');
    await page.screenshot({ path: path.join(root, 'magpie-settings.png') });
    assert.equal(await page.locator('#agentDeleteProviderBtn').isVisible(), false);
    assert.equal(await page.locator('#agentSaveProviderBtn').isVisible(), false);
    assert.equal(await page.locator('#providerFormContent').isVisible(), false);
    assert.equal(await page.evaluate(() => window.shell.getActivePermissionMode()), 'default');
    await page.evaluate(() => window.shell.updateSdkPermissionMode('acceptEdits'));
    assert.equal(await page.evaluate(() => window.shell.getActivePermissionMode()), 'acceptEdits');
    assert.deepEqual(await page.evaluate(() => window.shell.agentProviderStore.providers.find(p => p.id === 'integration:magpie').sdkOptions), {});
    assert.equal(await page.locator('.magpie-details input[type="password"]').count(), 0);
    await page.evaluate(() => { window.shell.unifiedSettings?.close?.(); window.shell.openAgentWorkbench(); });
    // Use the production rendering and interaction handlers; the server is real.
    await write(anchor, JSON.stringify({ ...managed, model: 'fixture-pinned' }));
    await wait(() => page.evaluate(() => window.shell.agentModelView?.effectiveModel?.modelId === 'fixture-pinned'), 'external follow');
    await page.evaluate(() => { window.shell.agentModelDropdownOpen = true; window.shell.renderModelDropdown(); });
    await page.setViewportSize({ width: 600, height: 850 });
    await page.locator('.magpie-model-search').fill('fixture-model');
    const menuBox = await page.locator('#agentModelDropdown').boundingBox();
    assert.ok(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= 600 && menuBox.y >= 0);
    await page.screenshot({ path: path.join(root, 'magpie-model-menu.png') });
    await page.locator('[data-magpie-model="fixture-model"]').click();
    await wait(() => page.evaluate(() => window.shell.agentModelView?.providerBinding?.policy === 'pinned'), 'pinned binding');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await write(anchor, JSON.stringify({ ...managed, model: 'fixture-pinned' }));
    await page.evaluate(() => window.shell.magpieClient.refresh(true));
    assert.equal(await page.evaluate(() => window.shell.agentModelView.effectiveModel.modelId), 'fixture-model');
    await page.evaluate(() => { window.shell.agentReasoningDropdownOpen = true; window.shell.renderAgentReasoning(); });
    await page.locator('[data-reasoning-value="high"]').click();
    await wait(() => page.evaluate(() => window.shell.agentModelView?.providerBinding?.reasoningEffort === 'high'), 'session reasoning');
    await page.route('**/sdk/set-provider', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'fixture switch failure' }) }));
    assert.equal(await page.evaluate(() => window.shell.activateProvider('fixture', { confirmed: true })), false);
    assert.equal(await page.evaluate(() => window.shell.activeProviderId), 'integration:magpie');
    assert.equal(await page.evaluate(() => window.shell.agentModelView.providerBinding.kind), 'magpie');
    await page.unroute('**/sdk/set-provider');
    assert.equal(await page.evaluate(() => window.shell.activateProvider('fixture', { confirmed: true })), true);
    assert.equal(await page.evaluate(() => window.shell.agentModelView.providerBinding.kind), 'direct');
    assert.equal(await page.evaluate(() => window.shell.agentProviderStore.providers.filter(p => p.id === 'integration:magpie').length), 1);
    assert.equal(await page.evaluate(() => window.shell.agentProviderStore.providers.find(p => p.id === 'integration:magpie').apiKey), '');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(root, 'magpie-integration.png') });
    console.log(`PASS: Magpie settings, follow/pinned/search, session reasoning, failed switch rollback and direct switch; evidence ${root}`);
} finally {
    await browser?.close();
    for (const child of children) if (child.exitCode === null) { const closed = new Promise(resolve => child.once('exit', resolve));
        child.kill('SIGTERM'); const timer = setTimeout(() => child.kill('SIGKILL'), 5000); await closed; clearTimeout(timer); }
    model.closeAllConnections(); await new Promise(resolve => model.close(resolve));
    await fs.writeFile(path.join(root, 'gateway.log'), logs);
}
