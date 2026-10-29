// Real Pi + local model: two sessions on one canvas, in-run annotation and steering.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const product = process.cwd(), root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-canvas-parallel-'));
const workspace = path.join(root, 'workspace'), config = path.join(root, 'config');
const relative = 'src/pages/demo/design/v1', directory = path.join(workspace, relative);
const children = [], held = new Map(), released = new Set(), requests = [];
let browser, logs = '';
const write = async (file, content) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content); };
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const freePort = async () => { const server = http.createServer(); await listen(server); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; };
const wait = async (check, label) => {
    for (let i = 0; i < 300; i++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw Error(`Timed out: ${label}\n${logs.slice(-3000)}`);
};
const model = http.createServer(async (req, res) => {
    let raw = ''; for await (const bytes of req) raw += bytes;
    const body = JSON.parse(raw), text = JSON.stringify(body.messages);
    requests.push(body);
    const board = body.model === 'fixture-model' ? (text.includes('WORK_A') ? 'a' : text.includes('WORK_B') ? 'b' : null) : null;
    const tools = body.messages.filter(message => message.role === 'tool');
    if (board && !tools.length && !released.has(board)) await new Promise(resolve => held.set(board, resolve));
    const extra = board === 'a' && text.includes('ANNOTATION_EXTRA') && tools.length === 1;
    const tool = board && (!tools.length || extra);
    const delta = tool ? { tool_calls: [{ index: 0, id: `${board}-${tools.length}`, type: 'function', function: { name: 'write', arguments: JSON.stringify({
        path: `${relative}/boards/board_${board}/${extra ? 'followup.txt' : 'styles.css'}`,
        content: extra ? 'ANNOTATION_EXTRA applied' : `body { color: ${board === 'a' ? 'red' : 'blue'}; }`
    }) } }] } : { content: 'Completed.' };
    const chunk = (delta, finish_reason = null) => ({ id: 'parallel', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason }] });
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`data: ${JSON.stringify(chunk({ role: 'assistant' }))}\n\n`);
    res.write(`data: ${JSON.stringify(chunk(delta))}\n\n`);
    res.write(`data: ${JSON.stringify(chunk({}, tool ? 'tool_calls' : 'stop'))}\n\n`);
    res.end('data: [DONE]\n\n');
});
try {
    await listen(model);
    await fs.cp(path.join(product, 'src/templates/infinite-canvas'), directory, { recursive: true });
    const nodes = ['a', 'b'].map((id, i) => ({ id: `node_${id}`, type: 'board', name: `Board ${id}`, x: 40 + i * 420, y: 40, width: 360, height: 240, src: `boards/board_${id}/index.html` }));
    for (const id of ['a', 'b']) {
        await write(path.join(directory, `boards/board_${id}/index.html`), '<!doctype html><html><body style="margin:24px"><button id="submit">Submit</button></body></html>');
        await write(path.join(directory, `boards/board_${id}/styles.css`), 'body {}');
    }
    await write(path.join(directory, 'canvas-data.js'), `window.PROTA_CANVAS = ${JSON.stringify({ schemaVersion: 1, revision: 0, nodes, viewport: { x: 0, y: 0, zoom: 1 } })};`);
    await write(path.join(workspace, 'workspace.json'), JSON.stringify({ id: 'parallel-test', formatVersion: 1 }));
    await write(path.join(workspace, 'data/projects.json'), JSON.stringify({ projects: [{ id: 'demo', name: 'Demo', pages: [{ id: 'design', name: 'Canvas', targetDevice: 'canvas', pageMode: 'infinite-canvas', versions: ['v1'] }] }], activeProjectId: 'demo', activePageId: 'design' }));
    await write(path.join(config, 'workspace.json'), JSON.stringify({ path: workspace }));
    const provider = { id: 'fixture', label: 'Fixture', model: 'fixture-model', apiType: 'openai-completions', baseURL: `http://127.0.0.1:${model.address().port}/v1`, apiKey: 'local-only-key', sdkOptions: { permissionMode: 'bypassPermissions', maxTurns: 12 } };
    await write(path.join(config, 'agent-provider-config.json'), JSON.stringify({ providers: [provider], activeProviderId: 'fixture', selectedProviderId: 'fixture' }));
    const bridgePort = await freePort(), agentPort = await freePort(), base = `http://127.0.0.1:${bridgePort}`, agent = `http://127.0.0.1:${agentPort}`;
    const env = { ...process.env, READIFY_WORKSPACE: workspace, READIFY_CONFIG_DIR: config, READIFY_PORT: String(bridgePort), READIFY_AGENT_PORT: String(agentPort), PYTHONDONTWRITEBYTECODE: '1' };
    for (const [command, args] of [['python3', ['server/bridge.py']], [process.execPath, ['server/agent-server.mjs']]]) {
        const child = spawn(command, args, { cwd: product, env, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child);
        child.stdout.on('data', bytes => logs += bytes); child.stderr.on('data', bytes => logs += bytes);
    }
    await wait(async () => { try { return (await fetch(base + '/api/workspace')).ok && (await fetch(agent + '/api/agent/health')).ok; } catch { return false; } }, 'servers');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(/fonts\.google/, route => route.abort());
    await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//, route => route.continue({ url: route.request().url().replace(/:8081\//, `:${agentPort}/`) }));
    await page.goto(base + '/portal/index.html');
    await wait(() => page.evaluate(() => Boolean(window.shell?.agentProviderPersistenceReady)), 'shell');
    await page.evaluate(async () => { shell.switchTopView('page'); await shell.switchPage('design', 'v1'); });
    await wait(() => page.evaluate(() => Boolean(document.getElementById('mainIframe').contentWindow.protaCanvas?.getBoardFrame('board_a')?.iframe?.contentDocument?.getElementById('submit'))), 'canvas');
    const select = async id => {
        await page.evaluate(id => document.getElementById('mainIframe').contentWindow.protaCanvas.focus([id]), `node_${id}`);
        await page.waitForTimeout(400);
        await page.frameLocator('#mainIframe').locator(`.node[data-id="node_${id}"] .node-title`).click();
    };
    const history = async id => (await fetch(`${agent}/api/agent/session/${id}/history`)).json();
    await select('a');
    await page.evaluate(async () => { await shell.handleNewAgentSessionClick(); shell.openAgentWorkbench(); });
    const a = await page.evaluate(() => shell.agentSessionId);
    await page.locator('#agentInput').fill('WORK_A: modify only board_a.');
    await page.locator('#agentSendBtn').click();
    await wait(() => held.has('a'), 'first Pi request');
    const action = page.frameLocator('#mainIframe').locator('#selection-tools [data-action="agent"]');
    assert.equal(await action.isEnabled(), true, 'same-board Agent entry stays enabled');
    await action.click();
    await page.locator('#annotatorBtn').click();
    await wait(() => page.evaluate(() => shell.getAnnotationFrameContext().window?.__readifyInspecting), 'in-run annotation');
    const button = page.frameLocator('#mainIframe').frameLocator('.node[data-id="node_a"] iframe').locator('#submit');
    await button.click();
    await page.locator('.annotation-dialog__textarea').fill('ANNOTATION_EXTRA: keep this feedback on board_a.');
    await page.locator('.annotation-dialog__add-feedback').click();
    await page.locator('#agentSendBtn').click();
    await wait(async () => (await history(a)).timeline.some(event => event.type === 'user_followup'), 'steering accepted');
    assert.equal((await history(a)).runState.active, true, 'sending feedback did not stop the run');
    await page.route('**/api/agent/session/*/steer', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Task changed; retry' }) }));
    await page.locator('#agentInput').fill('Keep this draft after a rejected follow-up');
    await page.locator('#agentSendBtn').click();
    await wait(() => page.evaluate(() => !shell._agentSteering && shell.agentInput.value === 'Keep this draft after a rejected follow-up'), 'failed follow-up restores draft');
    assert.equal((await history(a)).runState.active, true);
    await page.unroute('**/api/agent/session/*/steer');
    await page.locator('#agentInput').fill('');
    await page.evaluate(() => shell.exitAnnotationMode());
    await select('b');
    await page.evaluate(() => shell.handleNewAgentSessionClick());
    const b = await page.evaluate(() => shell.agentSessionId);
    assert.notEqual(a, b, 'new session does not reuse an active session');
    await page.locator('#agentInput').fill('WORK_B: modify only board_b.');
    await page.locator('#agentSendBtn').click();
    await wait(() => held.has('b'), 'second Pi request runs before the first completes');
    assert.equal((await history(a)).runState.active, true);
    assert.equal((await history(b)).runState.active, true);
    await wait(() => page.evaluate(() => document.getElementById('mainIframe').contentDocument.querySelectorAll('.node.agent-target').length === 2), 'both target protections survive session switching');
    await select('a');
    await page.frameLocator('#mainIframe').locator('#selection-tools [data-action="agent"]').click();
    await wait(() => page.evaluate(id => shell.agentSessionId === id && shell.agentRunState.active, a), 'board A opens its running session');
    await select('b');
    await page.frameLocator('#mainIframe').locator('#selection-tools [data-action="agent"]').click();
    await wait(() => page.evaluate(id => shell.agentSessionId === id && shell.agentRunState.active, b), 'board B opens its running session');
    const autosaveJournal = path.join(directory, '.canvas-autosave.json');
    assert.equal(JSON.parse(await fs.readFile(autosaveJournal, 'utf8')).runs.length, 2, 'both real Pi runs register durable manual-edit protection');
    await page.frameLocator('#mainIframe').locator('#stage').dispatchEvent('dblclick', { clientX: 1150, clientY: 800, button: 0 });
    await page.frameLocator('#mainIframe').locator('.node.editing .node-content').fill('两个 Agent 运行时也实时保存');
    await wait(() => page.evaluate(() => !document.getElementById('mainIframe').contentWindow.protaCanvas.isDirty()), 'manual input persists while both Pi requests remain held');
    assert.ok((await fs.readFile(path.join(directory, 'canvas-data.js'), 'utf8')).includes('两个 Agent 运行时也实时保存'));
    assert.equal((await history(a)).runState.active, true);
    assert.equal((await history(b)).runState.active, true);
    released.add('a'); held.get('a')();
    await wait(async () => !(await history(a)).runState.active, 'background session finishes');
    assert.equal(await page.evaluate(() => shell.agentSessionId), b);
    assert.equal(await page.evaluate(() => shell.agentRunState.active), true, 'background completion does not finish the visible run');
    assert.equal(await fs.readFile(path.join(directory, 'boards/board_a/followup.txt'), 'utf8'), 'ANNOTATION_EXTRA applied');
    released.add('b'); held.get('b')();
    await wait(async () => !(await history(b)).runState.active, 'second session finishes');
    await wait(async () => JSON.parse(await fs.readFile(autosaveJournal, 'utf8')).runs.length === 0, 'both real Pi runs finish server-side reconciliation');
    assert.match(await fs.readFile(path.join(directory, 'boards/board_a/styles.css'), 'utf8'), /red/);
    assert.match(await fs.readFile(path.join(directory, 'boards/board_b/styles.css'), 'utf8'), /blue/);
    await page.evaluate(id => shell.switchAgentSession(id, { awaitRefresh: true }), a);
    await wait(() => page.locator('.agent-user-message').filter({ hasText: 'ANNOTATION_EXTRA' }).count(), 'follow-up survives history reload');
    assert.deepEqual(errors, []);
    assert.ok(requests.some(body => JSON.stringify(body.messages).includes('ANNOTATION_EXTRA')));
    console.log('PASS: two real Pi sessions edit separate boards concurrently; same-board Agent entry, annotation and steering stay usable; background completion is isolated.');
} catch (error) {
    const files = await fs.readdir(path.join(workspace, 'data/agent-sessions')).catch(() => []);
    for (const file of files.filter(file => file.endsWith('.json') && file !== 'index.json')) {
        const data = JSON.parse(await fs.readFile(path.join(workspace, 'data/agent-sessions', file), 'utf8'));
        console.error(JSON.stringify({ id: data.id, status: data.runState.status, stage: data.runState.stageMessage, approval: data.pendingApproval?.toolName, events: data.timeline.slice(-5).map(event => event.type) }));
    }
    console.error('Model requests:', requests.map(body => ({ tools: body.messages.filter(message => message.role === 'tool').length, last: body.messages.at(-1) })));
    throw error;
} finally {
    for (const resolve of held.values()) resolve();
    await browser?.close();
    for (const child of children) child.kill();
    model.closeAllConnections(); await new Promise(resolve => model.close(resolve));
    if (!process.env.PROTA_KEEP_PARALLEL_FIXTURE) await fs.rm(root, { recursive: true, force: true });
}
