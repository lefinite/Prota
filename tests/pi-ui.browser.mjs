import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const product = fileURLToPath(new URL('..', import.meta.url));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-pi-ui-'));
const workspace = path.join(root, 'workspace'), config = path.join(root, 'config');
const write = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, value); };
const port = async () => { const server = http.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const value = server.address().port; await new Promise(resolve => server.close(resolve)); return value; };
const wait = async (check, label) => { for (let i = 0; i < 200; i++) { try { if (await check()) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error(`Timed out: ${label}`); };
const children = []; let browser; let logs = '';
const requests = [];
const model = http.createServer(async (req, res) => {
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
    const bridgePort = await port(), agentPort = await port(); const base = `http://127.0.0.1:${bridgePort}`;
    const env = { ...process.env, READIFY_WORKSPACE: workspace, READIFY_CONFIG_DIR: config, READIFY_PORT: String(bridgePort),
        READIFY_AGENT_PORT: String(agentPort), PYTHONDONTWRITEBYTECODE: '1' };
    for (const [command, args] of [[process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['server/bridge.py']], [process.execPath, ['server/agent-server.mjs']]]) {
        const child = spawn(command, args, { cwd: product, env, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child);
        child.stdout.on('data', bytes => { logs += bytes; }); child.stderr.on('data', bytes => { logs += bytes; });
    }
    await wait(async () => (await fetch(base + '/api/workspace')).ok, 'workspace bridge');
    await wait(async () => (await fetch(`http://127.0.0.1:${agentPort}/api/agent/health`)).ok, 'Pi Gateway');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(/fonts\.google/, route => route.abort());
    await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//, route => route.continue({ url: route.request().url().replace(/:8081\//, `:${agentPort}/`) }));
    await page.goto(base + '/portal/index.html', { waitUntil: 'domcontentloaded' });
    await wait(() => page.evaluate(() => Boolean(window.shell?.agentProviderPersistenceReady && window.shell?.agentApi)), 'Portal');
    await page.evaluate(() => window.shell.openAgentWorkbench());
    await page.locator('#agentInput').fill('执行 Pi UI 验证，先写文件，再询问语言。'); await page.locator('#agentSendBtn').click();
    await page.waitForSelector('[data-approval-decision="allow_once"]');
    const sessionId = await page.evaluate(() => window.shell.agentSessionId);
    assert.ok(await page.evaluate(() => window.shell.agentRunState.active));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(() => page.evaluate(() => Boolean(window.shell?.agentProviderPersistenceReady)), 'Portal reload');
    await page.evaluate(() => window.shell.openAgentWorkbench());
    await page.waitForSelector('[data-approval-decision="allow_once"]');
    assert.equal(await page.evaluate(() => window.shell.agentSessionId), sessionId);
    assert.equal(await fs.readFile(path.join(pageDir, 'app.js'), 'utf8'), 'window.initial = true;');
    await page.screenshot({ path: path.join(root, 'waiting-approval.png') });
    await page.locator('[data-approval-decision="allow_session"]').click();
    await page.waitForSelector('[data-question-option="中文"]');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(() => page.evaluate(() => Boolean(window.shell?.agentProviderPersistenceReady)), 'Question reload');
    await page.evaluate(() => window.shell.openAgentWorkbench());
    await page.waitForSelector('[data-question-option="中文"]');
    await page.screenshot({ path: path.join(root, 'waiting-question.png') });
    await page.locator('[data-question-option="中文"]').click();
    await wait(() => page.evaluate(() => window.shell.agentRunState.status === 'succeeded'), 'Successful terminal');
    assert.equal(await fs.readFile(path.join(pageDir, 'app.js'), 'utf8'), 'window.piUiVerified = true;');
    assert.equal(await fs.readFile(path.join(pageDir, 'session-approved.txt'), 'utf8'), 'same-tool-session-grant');
    assert.equal(await page.evaluate(() => window.shell.agentTimelineEvents.filter(event => event.type === 'assistant_message'
        && event.payload.text === 'Pi UI 验证完成。' && !event.payload.partial).length), 1);
    assert.ok(requests.some(request => request.messages.some(message => message.role === 'tool' && String(message.content).includes('中文'))));
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(root, 'completed.png') });
    await fs.writeFile(path.join(root, 'report.json'), JSON.stringify({ status: 'passed', checks: ['native Pi write requires approval',
        'refresh retains pending approval and active run', 'session approval permits same-tool writes to different files', 'refresh retains pending question',
        'answer continues native tool loop', 'one final assistant message', 'no page errors'], sessionId, errors }, null, 2));
    console.log(`PASS: real Portal + Gateway + Pi approval/question/refresh; evidence ${root}`);
} finally {
    await browser?.close();
    for (const child of children) if (child.exitCode === null) { const closed = new Promise(resolve => child.once('exit', resolve));
        child.kill('SIGTERM'); const timer = setTimeout(() => child.kill('SIGKILL'), 5000); await closed; clearTimeout(timer); }
    model.closeAllConnections(); await new Promise(resolve => model.close(resolve));
    await fs.writeFile(path.join(root, 'gateway.log'), logs);
}
