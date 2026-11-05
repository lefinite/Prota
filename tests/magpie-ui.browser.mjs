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
        apiType: 'openai-completions', model: 'fixture-model', models: ['fixture-model', 'fixture-secondary', 'fixture-unused', ...Array.from({ length: 8 }, (_, i) => `catalog-${i}`)], enabledModels: ['fixture-model', 'fixture-secondary'],
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
    await wait(() => page.evaluate(() => window.shell.agentModelView?.providerBinding?.policy === 'pinned'), 'pinned binding');
    await page.evaluate(() => window.shell.magpieClient.choose('follow')); // legacy sessions still follow external changes
    await wait(() => page.evaluate(() => !window.shell._agentModelSwitching), 'model switch complete');
    await page.screenshot({ path: path.join(root, 'magpie-settings.png') });
    assert.equal(await page.locator('#agentDeleteProviderBtn').isVisible(), false);
    assert.equal(await page.locator('#agentSaveProviderBtn').isVisible(), true);
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
    assert.equal(await page.locator('.magpie-model-search').count(), 0);
    assert.equal(await page.locator('[data-magpie-refresh], [data-magpie-policy]').count(), 0);
    assert.equal(await page.locator('#agentModelDropdown [data-model-id="fixture-unused"]').count(), 0);
    assert.equal(await page.locator('#agentModelDropdown [data-model-id="fixture-secondary"]').count(), 1);
    await page.evaluate(() => { window.shell.unifiedSettings.open('models'); window.shell.selectProvider('integration:magpie'); });
    const orderBefore = await page.locator('[data-magpie-library] [data-model-id]').evaluateAll(nodes => nodes.map(node => node.dataset.modelId));
    await page.locator('[data-magpie-library] [data-model-id="fixture-model"]').click();
    assert.deepEqual(await page.locator('[data-magpie-library] [data-model-id]').evaluateAll(nodes => nodes.map(node => node.dataset.modelId)), orderBefore, 'choosing a model keeps the list stable');
    const chosenRow = page.locator('[data-magpie-library] [data-model-id="fixture-model"]');
    assert.equal(await chosenRow.evaluate(node => node === document.activeElement), true);
    await chosenRow.press('Space');
    assert.equal(await chosenRow.getAttribute('aria-checked'), 'false');
    await chosenRow.press('Space');
    assert.equal(await chosenRow.getAttribute('aria-checked'), 'true');
    assert.equal(await page.evaluate(() => window.shell.agentProviderStore.providers.find(p => p.id === 'integration:magpie').enabledModels), undefined, 'Magpie choices remain a draft until saved');
    assert.equal(await page.evaluate(() => window.shell.unifiedSettings.dirtyPanels().includes('models')), true);
    await page.locator('#providerCustomList [data-provider-id="fixture"]').click();
    await page.locator('#usGuard').waitFor({ state: 'visible' });
    await page.locator('[data-us-guard-cancel]').click();
    assert.equal(await page.locator('.magpie-details').isVisible(), true);
    const rejectSave = route => route.request().method() === 'POST'
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"fixture failure"}' }) : route.continue();
    await page.route('**/api/agent-provider-config', rejectSave);
    await page.locator('#agentSaveProviderBtn').click();
    await wait(() => page.evaluate(() => !window.shell.magpieClient.savingModels), 'failed Magpie save settled');
    assert.equal(await page.evaluate(() => window.shell.agentProviderStore.providers.find(p => p.id === 'integration:magpie').enabledModels), undefined);
    assert.equal(await page.locator('[data-magpie-library] [role=checkbox][aria-checked=true]').count(), 2, 'failed save preserves the draft');
    assert.match(await page.locator('#usSaveFeedback').innerText(), /保存失败/);
    await page.unroute('**/api/agent-provider-config', rejectSave);
    await page.locator('#agentSaveProviderBtn').click();
    await wait(() => page.evaluate(() => !window.shell.magpieClient.savingModels), 'Magpie model selection saved');
    assert.equal(await page.evaluate(() => window.shell.unifiedSettings.dirtyPanels().includes('models')), false);
    await page.evaluate(() => window.shell.unifiedSettings.close());
    await page.locator('#agentModelToggle').click();
    const menuBox = await page.locator('#agentModelDropdown').boundingBox();
    assert.ok(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= 600 && menuBox.y >= 0);
    await page.screenshot({ path: path.join(root, 'magpie-model-menu.png') });
    await page.locator('[data-magpie-model="fixture-model"]').click();
    await wait(() => page.evaluate(() => window.shell.agentModelView?.providerBinding?.policy === 'pinned'), 'pinned binding');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await write(anchor, JSON.stringify({ ...managed, model: 'fixture-pinned' }));
    await page.evaluate(() => window.shell.magpieClient.refresh(true));
    assert.equal(await page.evaluate(() => window.shell.agentModelView.effectiveModel.modelId), 'fixture-model');
    await page.locator('#agentModelToggle').click();
    await page.locator('[data-reasoning-value="high"]').click();
    await wait(() => page.evaluate(() => window.shell.agentModelView?.providerBinding?.reasoningEffort === 'high'), 'session reasoning');
    assert.equal(await page.locator('#agentModelDropdown').isVisible(), true);
    assert.equal(await page.locator('[data-reasoning-value=high]').getAttribute('aria-pressed'), 'true');
    await page.route('**/sdk/set-provider', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'fixture switch failure' }) }));
    assert.equal(await page.evaluate(() => window.shell.activateProvider('fixture', { confirmed: true })), false);
    assert.equal(await page.evaluate(() => window.shell.activeProviderId), 'integration:magpie');
    assert.equal(await page.evaluate(() => window.shell.agentModelView.providerBinding.kind), 'magpie');
    await page.unroute('**/sdk/set-provider');
    assert.equal(await page.evaluate(() => window.shell.activateProvider('fixture', { confirmed: true })), true);
    assert.equal(await page.evaluate(() => window.shell.agentModelView.providerBinding.kind), 'direct');
    assert.equal(await page.evaluate(() => window.shell.agentProviderStore.providers.filter(p => p.id === 'integration:magpie').length), 1);
    assert.equal(await page.evaluate(() => window.shell.agentProviderStore.providers.find(p => p.id === 'integration:magpie').apiKey), '');
    // A provider's catalog is larger than the subset exposed by the menu.
    await page.evaluate(() => { window.shell.unifiedSettings.open('models'); window.shell.selectProvider('fixture'); });
    assert.equal(await page.locator('#agentModelLibrary [role=checkbox][aria-checked=true]').count(), 2);
    await page.locator('#agentModelLibrary [data-model-id="fixture-secondary"]').click();
    await page.locator('#agentModelLibrary .model-library__manual > summary').click();
    const longModel = 'fixture-model-with-a-very-long-name-that-must-remain-fully-readable';
    await page.locator('#agentModelLibrary [name=modelId]').fill(longModel);
    await page.locator('#agentModelLibrary [name=modelId]').press('Enter');
    await page.locator('#agentSaveProviderBtn').click();
    await wait(async () => JSON.parse(await fs.readFile(path.join(config, 'agent-provider-config.json'), 'utf8')).providers[0].enabledModels?.includes(longModel), 'enabled models persisted');
    const saved = JSON.parse(await fs.readFile(path.join(config, 'agent-provider-config.json'), 'utf8')).providers[0];
    assert.deepEqual(saved.enabledModels, ['fixture-model', longModel]);
    assert.ok(saved.models.includes('fixture-unused'));
    await page.locator('#agentModelLibrary [data-model-filter]').fill('a-filter-with-no-results');
    assert.equal(await page.evaluate(() => window.shell.unifiedSettings.dirtyPanels().includes('models')), false);
    await page.locator('#agentModelLibrary [data-model-filter]').fill('');
    await page.route('**/api/agent/fetch-models', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, models: ['fixture-more', 'fixture-second-found'] }) }));
    await page.locator('#agentModelLibrary [data-model-fetch]').click();
    await page.locator('#agentModelLibrary [data-model-id="fixture-more"]').waitFor();
    assert.equal(await page.locator('#agentModelLibrary [role=checkbox][aria-checked=true]').count(), 2, 'newly fetched models are not auto-added');
    assert.equal(await page.evaluate(() => window.shell.unifiedSettings.dirtyPanels().includes('models')), true);
    assert.equal(JSON.parse(await fs.readFile(path.join(config, 'agent-provider-config.json'), 'utf8')).providers[0].models.includes('fixture-more'), false);
    await page.locator('#agentSaveProviderBtn').click();
    await wait(async () => JSON.parse(await fs.readFile(path.join(config, 'agent-provider-config.json'), 'utf8')).providers[0].models.includes('fixture-more'), 'new model catalog saved');
    await page.unroute('**/api/agent/fetch-models');

    await page.evaluate(() => window.shell.unifiedSettings.close());
    await page.locator('#agentModelToggle').click();
    assert.equal(await page.locator('#agentModelDropdown [data-model-id="fixture-secondary"]').count(), 0);
    const longRow = page.locator(`#agentModelDropdown [data-model-id="${longModel}"]`);
    assert.equal(await longRow.locator('span').first().evaluate(node => node.scrollWidth <= node.clientWidth), true);
    const panelBounds = await page.locator('#agentWorkbench').boundingBox();
    const longMenuBounds = await page.locator('#agentModelDropdown').boundingBox();
    assert.ok(longMenuBounds.x >= panelBounds.x && longMenuBounds.x + longMenuBounds.width <= panelBounds.x + panelBounds.width, 'menu stays inside the panel without being clipped');
    await page.screenshot({ path: path.join(root, 'long-model-name.png') });
    await longRow.click();
    await wait(() => page.evaluate(model => window.shell.agentModelView.effectiveModel.modelId === model, longModel), 'direct model selected');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(() => page.evaluate(() => Boolean(window.shell?.agentProviderPersistenceReady && window.shell?.magpieClient)), 'reload ready');
    await page.evaluate(() => window.shell.openAgentWorkbench());
    await page.locator('#agentModelToggle').click();
    assert.equal(await page.locator(`#agentModelDropdown [data-model-id="${longModel}"]`).count(), 1);
    assert.equal(await page.locator('#agentModelDropdown [data-model-id="fixture-unused"]').count(), 0);
    // Real per-model capability rendering and payload persistence via the gateway.
    await page.evaluate(async () => {
        const shell = window.shell;
        shell.closeAgentInlineDropdowns();
        shell.agentProviderStore.addProvider({ id: 'capability-fixture', label: '能力验证', apiType: 'anthropic-messages',
            baseURL: 'https://open.bigmodel.cn/api/anthropic', apiKey: 'fixture', model: 'glm-5.3', models: ['glm-5.3', 'glm-5.3-flashx'], enabledModels: ['glm-5.3', 'glm-5.3-flashx'], sdkOptions: {} });
        shell.syncAgentProviderStoreState();
        await shell.activateProvider('capability-fixture', { confirmed: true });
    });
    await page.locator('#agentModelToggle').click();
    assert.deepEqual(await page.locator('#agentModelDropdown [data-reasoning-value]').evaluateAll(nodes => nodes.map(node => node.dataset.reasoningValue)), ['default', 'low', 'high', 'max']);
    await page.locator('#agentModelDropdown [data-reasoning-value=high]').click();
    await wait(() => page.evaluate(() => !window.shell._agentReasoningSaving), 'direct effort saved');
    assert.equal(await page.locator('#agentModelDropdown [data-reasoning-value=high]').getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: path.join(root, 'inline-reasoning.png') });
    await page.locator('#agentModelDropdown [data-model-id="glm-5.3-flashx"]').click();
    await wait(() => page.evaluate(() => !window.shell._agentModelSwitching), 'unsupported reasoning model selected');
    await page.locator('#agentModelToggle').click();
    assert.equal(await page.locator('#agentModelDropdown [data-reasoning-value]').count(), 0);
    assert.equal(await page.evaluate(() => window.shell.getActiveProvider().sdkOptions.reasoningEffort), undefined);
    await page.evaluate(async () => {
        const shell = window.shell;
        shell.closeAgentInlineDropdowns();
        shell.agentProviderStore.addProvider({ id: 'toggle-fixture', label: '开关验证', apiType: 'anthropic-messages',
            baseURL: 'https://api.xiaomimimo.com/anthropic', apiKey: 'fixture', model: 'mimo-v2.6-pro', sdkOptions: {} });
        shell.syncAgentProviderStoreState();
        await shell.activateProvider('toggle-fixture', { confirmed: true });
    });
    await page.locator('#agentModelToggle').click();
    assert.deepEqual(await page.locator('#agentModelDropdown [data-reasoning-value]').evaluateAll(nodes => nodes.map(node => node.dataset.reasoningValue)), ['default', 'enabled', 'disabled']);
    await page.locator('#agentModelDropdown [data-reasoning-value=disabled]').click();
    await wait(() => page.evaluate(() => !window.shell._agentReasoningSaving), 'toggle saved');
    assert.equal(await page.locator('#agentModelDropdown [data-reasoning-value=disabled]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#agentModelDropdown').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#agentModelDropdown').isVisible(), false);
    assert.equal(await page.locator('#agentModelToggle').evaluate(node => node === document.activeElement), true);
    // Updating permissions changes the current session and future default, never other sessions.
    await page.evaluate(() => window.shell.closeAgentInlineDropdowns());
    const sessionA = await page.evaluate(() => window.shell.createAgentSession({ switchTo: true, title: '权限 A' }));
    await page.evaluate(() => window.shell.updateSdkPermissionMode('default'));
    const sessionB = await page.evaluate(() => window.shell.createAgentSession({ switchTo: true, title: '权限 B' }));
    assert.equal(await page.evaluate(() => window.shell.getActivePermissionMode()), 'default');
    await page.route('**/sdk/set-permission-mode', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"permission fixture failure"}' }), { times: 1 });
    assert.equal(await page.evaluate(() => window.shell.updateSdkPermissionMode('acceptEdits')), false);
    assert.equal(await page.evaluate(() => window.shell.getActivePermissionMode()), 'default');
    assert.equal(await page.evaluate(() => window.shell.agentProviderStore.defaultPermissionMode), 'default');
    assert.equal(await page.evaluate(() => window.shell.updateSdkPermissionMode('acceptEdits')), true);
    assert.equal(await page.locator('#agentPermissionLabel').innerText(), '自动修改');
    await page.evaluate(id => window.shell.switchAgentSession(id), sessionA);
    assert.equal(await page.evaluate(() => window.shell.getActivePermissionMode()), 'default', 'existing A retains its permission');
    const sessionC = await page.evaluate(() => window.shell.createAgentSession({ switchTo: true, title: '权限 C' }));
    assert.equal(await page.evaluate(() => window.shell.getActivePermissionMode()), 'acceptEdits', 'new session inherits the last choice, not the opened old session');
    await page.evaluate(() => window.shell.activateProvider('fixture', { confirmed: true, silent: true }));
    assert.equal(await page.evaluate(() => window.shell.getActivePermissionMode()), 'acceptEdits', 'switching model keeps this session permission');
    await page.evaluate(() => window.shell.activateProvider('integration:magpie', { confirmed: true, silent: true }));
    assert.equal(await page.evaluate(() => window.shell.updateSdkPermissionMode('bypassPermissions')), true);
    assert.equal(await page.locator('#agentPermissionLabel').innerText(), '全部允许');
    await page.evaluate(id => window.shell.switchAgentSession(id), sessionB);
    assert.equal(await page.evaluate(() => window.shell.getActivePermissionMode()), 'acceptEdits');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(() => page.evaluate(() => Boolean(window.shell?.agentProviderPersistenceReady && window.shell?.magpieClient)), 'permission reload');
    await page.evaluate(() => window.shell.openAgentWorkbench());
    await page.evaluate(() => window.shell.createAgentSession({ switchTo: true, title: '权限 D' }));
    assert.equal(await page.evaluate(() => window.shell.getActivePermissionMode()), 'bypassPermissions', 'Magpie permission default survives reload');
    await page.evaluate(id => window.shell.switchAgentSession(id), sessionC);
    assert.equal(await page.evaluate(() => window.shell.getActivePermissionMode()), 'bypassPermissions');
    await page.locator('#agentModelToggle').click();
    assert.equal(await page.locator('#agentModelToggle > svg.agent-model-toggle__chevron').count(), 1);
    const gaps = await page.locator('#agentModelDropdown .agent-model-group').evaluateAll(groups => groups.flatMap(group => {
        const rows = [...group.querySelectorAll('.agent-model-choice')];
        return rows.slice(1).map((row, i) => row.getBoundingClientRect().top - rows[i].getBoundingClientRect().bottom);
    }));
    assert.ok(gaps.length && gaps.every(gap => gap >= 2), 'model row backgrounds have visible separation');
    await page.keyboard.press('Escape');
    // Filtering is view state, while selected IDs are a guarded, saveable draft.
    await page.evaluate(() => { window.shell.unifiedSettings.open('models'); window.shell.selectProvider('integration:magpie'); });
    const library = page.locator('[data-magpie-library]');
    assert.equal(await library.locator('[data-model-search]').isHidden(), true, 'small catalogs need no search step');
    assert.equal(await page.evaluate(() => window.shell.unifiedSettings.dirtyPanels().includes('models')), false);
    assert.equal(await page.locator('.magpie-identity').innerText(), 'Magpie');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('.us-window').evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await page.screenshot({ path: path.join(root, 'magpie-settings-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await fs.unlink(anchor);
    await page.evaluate(() => window.shell.magpieClient.refresh(true));
    assert.equal(await page.locator('[data-magpie-offline]').isVisible(), true);
    assert.equal(await library.locator('[role=checkbox][aria-checked=true]').count(), 2, 'disconnect does not discard chosen models');
    assert.equal(await page.locator('.magpie-install [data-magpie=install]').isVisible(), true);
    await page.screenshot({ path: path.join(root, 'magpie-settings-disconnected.png') });
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(root, 'magpie-integration.png') });
    console.log(`PASS: Magpie settings, selected models, legacy follow/pinned, inline reasoning, failed switch rollback and direct switch; evidence ${root}`);
} finally {
    await browser?.close();
    for (const child of children) if (child.exitCode === null) { const closed = new Promise(resolve => child.once('exit', resolve));
        child.kill('SIGTERM'); const timer = setTimeout(() => child.kill('SIGKILL'), 5000); await closed; clearTimeout(timer); }
    model.closeAllConnections(); await new Promise(resolve => model.close(resolve));
    await fs.writeFile(path.join(root, 'gateway.log'), logs);
}
