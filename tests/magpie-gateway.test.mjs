import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const product = fileURLToPath(new URL('..', import.meta.url));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

test('real Pi: Magpie follow/pinned, tool loop, pending latest, restart, removal and no paid fallback', { timeout: 120000 }, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-magpie-e2e-'));
    const workspace = path.join(root, 'workspace'), configDir = path.join(root, 'other-config'), home = path.join(root, 'home');
    const write = async (name, value) => { await fs.mkdir(path.dirname(name), { recursive: true }); await fs.writeFile(name, typeof value === 'string' ? value : JSON.stringify(value)); };
    const page = 'src/pages/demo/reader/v1';
    await write(path.join(workspace, page, 'index.html'), '<html><body>Fixture</body></html>');
    await write(path.join(workspace, page, 'styles.css'), 'body{}');
    await write(path.join(workspace, page, 'app.js'), 'before');
    await write(path.join(workspace, 'workspace.json'), { id: 'magpie-fixture', formatVersion: 1 });
    await write(path.join(workspace, 'data/projects.json'), { projects: [{ id: 'demo', pages: [{ id: 'reader', versions: ['v1'], targetDevice: 'mobile' }] }] });
    let models = ['a', 'b', 'c']; const requests = []; let release, arrived;
    let mainRequests = 0, titleReply = '阅读器交互优化', titleGate = null, titleArrived = () => {};
    let titleRequests = 0;
    const reached = new Promise(resolve => { arrived = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const gateway = http.createServer(async (req, res) => {
        if (req.url === '/api/hello') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ name: 'magpie', version: 'fixture' })); return; }
        assert.equal(req.headers.authorization, 'Bearer fixture-private-agent-key');
        if (req.url === '/v1/models') {
            res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: models.map(id => ({ id: 'fixture/' + id, display_name: id.toUpperCase(), owned_by: 'fixture',
                reasoning: false, native_endpoints: ['/v1/chat/completions'], modalities: { input: ['text'] }, context_window: 64000, max_output_tokens: 1024 })) })); return;
        }
        let raw = ''; for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw); requests.push(body);
        const isTitle = JSON.stringify(body.messages).includes('请为下面 Prota 终端会话生成一个中文短标题');
        if (isTitle) { titleRequests++; titleArrived(); if (titleGate) await titleGate; }
        else { mainRequests++; if (mainRequests === 1) { arrived(); await gate; } }
        const lastUser = body.messages.findLastIndex(m => m.role === 'user');
        const tools = body.messages.slice(lastUser + 1).filter(m => m.role === 'tool');
        let delta, finish;
        if (!isTitle && tools.length === 0 && mainRequests === 1) {
            delta = { tool_calls: [{ index: 0, id: 'write-prototype', type: 'function', function: { name: 'write', arguments: JSON.stringify({ path: page + '/app.js', content: 'globalThis.magpiePrototype = true;' }) } }] }; finish = 'tool_calls';
        } else if (!isTitle && tools.length === 1 && body.model === 'fixture/a') {
            delta = { tool_calls: [{ index: 0, id: 'read-prototype', type: 'function', function: { name: 'read', arguments: JSON.stringify({ path: page + '/app.js' }) } }] }; finish = 'tool_calls';
        } else { delta = { content: isTitle
            ? (JSON.stringify(body.messages.at(-1)?.content).includes('标题超过10个字') ? '阅读器交互优化' : titleReply) : 'Prototype updated and verified.' }; finish = 'stop'; }
        const chunk = (delta, finish_reason = null) => ({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason }] });
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify(chunk({ role: 'assistant', ...delta }))}\n\n`);
        res.write(`data: ${JSON.stringify({ ...chunk({}, finish), usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } })}\n\n`); res.end('data: [DONE]\n\n');
    }); await listen(gateway);
    const anchor = path.join(home, '.config/prota/magpie-agent.json');
    const managed = { model: 'fixture/a', provider: 'magpie', managedBy: 'magpie', apiType: 'openai-completions', baseURL: `http://127.0.0.1:${gateway.address().port}/v1`, apiKey: 'fixture-private-agent-key' };
    await write(anchor, managed);
    const reservation = http.createServer(); await listen(reservation); const port = reservation.address().port; await close(reservation);
    let child, logs = '';
    const stop = async () => { if (child?.exitCode === null) { const exit = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exit; } };
    const start = async () => {
        child = spawn(process.execPath, ['server/agent-server.mjs'], { cwd: product, env: { ...process.env, HOME: home, USERPROFILE: home, READIFY_WORKSPACE: workspace, READIFY_CONFIG_DIR: configDir, READIFY_AGENT_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
        for (let i = 0; i < 200; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/agent/magpie/status`)).ok) return; } catch {} if (child.exitCode !== null) throw new Error(logs); await pause(30); }
        throw new Error('Gateway failed to start');
    };
    t.after(async () => { release(); await stop(); await close(gateway); await fs.rm(root, { recursive: true, force: true }); });
    await start();
    const api = async (route, body, expected = 200, origin) => {
        const response = await fetch(`http://127.0.0.1:${port}${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(origin ? { Origin: origin } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
        const raw = await response.text(); assert.equal(response.status, expected, raw + '\n' + logs); assert.equal(raw.includes(managed.apiKey), false, 'credential exposed'); return JSON.parse(raw);
    };
    await api('/api/agent/magpie/status', undefined, 403, 'https://untrusted.example');
    assert.equal((await api('/api/agent/magpie/status')).managed, true);
    const { sessionId } = await api('/api/agent/session', { projectId: 'demo', pageId: 'reader', version: 'v1', providerConfig: { provider: 'integration:magpie', adapter: 'magpie' } });
    const base = `/api/agent/session/${sessionId}`;
    const view = () => api(base + '/model-binding');
    const choose = async (policy, pinnedModelId) => api(base + '/model-binding', { kind: 'magpie', policy, pinnedModelId, expectedRevision: (await view()).bindingRevision });
    const initial = await view(); assert.equal(initial.effectiveModel.modelId, 'fixture/a');
    // No direct provider or descriptor can replace Magpie's model/key/base URL.
    const running = api(base + '/sdk/prompt', { prompt: 'Update and read the prototype', providerConfig: { model: 'evil', baseURL: 'https://untrusted.example' }, sdkOptions: { model: 'evil', apiKey: 'evil', baseURL: 'https://untrusted.example', permissionMode: 'bypassPermissions' } });
    await reached;
    await api(base + '/model-binding', { kind: 'magpie', policy: 'pinned', pinnedModelId: 'fixture/b', expectedRevision: initial.bindingRevision }, 409);
    await write(anchor, { ...managed, model: 'fixture/b' }); await api('/api/agent/magpie/refresh', {});
    await write(anchor, { ...managed, model: 'fixture/c' }); await api('/api/agent/magpie/refresh', {});
    const pending = await view(); assert.equal(pending.effectiveModel.modelId, 'fixture/a'); assert.equal(pending.pendingModelChange.modelId, 'fixture/c');
    release(); assert.equal((await running).ok, true);
    assert.equal(await fs.readFile(path.join(workspace, page, 'app.js'), 'utf8'), 'globalThis.magpiePrototype = true;');
    assert.ok(requests.length >= 3); assert.ok(requests.every(r => r.model === 'fixture/a'));
    for (let i = 0; i < 100 && (await view()).effectiveModel.modelId !== 'fixture/c'; i++) await pause(30);
    assert.equal((await view()).effectiveModel.modelId, 'fixture/c');
    const history = await api(base + '/history'); const run = history.timeline.find(e => e.type === 'run_started');
    assert.equal(run.payload.runModelSnapshot.requestedModel, 'fixture/a');
    await choose('pinned', 'fixture/a');
    await write(anchor, { ...managed, model: 'fixture/b' }); await api('/api/agent/magpie/refresh', {}); await pause(100);
    assert.equal((await view()).effectiveModel.modelId, 'fixture/a');
    await stop(); await start(); assert.equal((await api(base + '/history')).providerBinding.policy, 'pinned');
    assert.equal((await view()).effectiveModel.modelId, 'fixture/a');
    const named = await api('/api/agent/session', { projectId: 'demo', pageId: 'reader', version: 'v1',
        providerConfig: { provider: 'integration:magpie', adapter: 'magpie' } });
    const namedBase = `/api/agent/session/${named.sessionId}`;
    await api(namedBase + '/model-binding', { kind: 'magpie', policy: 'pinned', pinnedModelId: 'fixture/a',
        expectedRevision: (await api(namedBase + '/model-binding')).bindingRevision });
    titleReply = '阅读器交互流程与操作体验优化设计';
    let releaseTitle;
    titleGate = new Promise(resolve => { releaseTitle = resolve; });
    const titleReached = new Promise(resolve => { titleArrived = resolve; });
    t.after(() => releaseTitle());
    const namedResponse = await fetch(`http://127.0.0.1:${port}${namedBase}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'demo', pageId: 'reader', version: 'v1', message: '请帮我优化阅读器中的交互体验' }) });
    assert.equal(namedResponse.status, 200);
    await namedResponse.text();
    await titleReached;
    // The title finishes AFTER the task's last persistence. No history requests
    // or later business events may be needed to save the generated name.
    releaseTitle(); titleGate = null;
    const namedFile = path.join(workspace, 'data/agent-sessions', named.sessionId + '.json');
    let saved;
    for (let i = 0; i < 200; i++) {
        saved = JSON.parse(await fs.readFile(namedFile, 'utf8'));
        if (saved.titleSource === 'ai') break;
        await pause(30);
    }
    assert.equal(saved.title, '阅读器交互优化', logs);
    assert.equal(saved.titleSource, 'ai');
    let namedHistory;
    for (let i = 0; i < 200; i++) {
        namedHistory = await api(namedBase + '/history');
        if (namedHistory.title === '阅读器交互优化') break;
        await pause(30);
    }
    assert.equal(namedHistory.title, '阅读器交互优化', logs);
    const titleRequest = requests.find(r => JSON.stringify(r.messages).includes('请为下面 Prota 终端会话生成一个中文短标题'));
    assert.equal(titleRequest.model, 'fixture/a', 'Title must respect the pinned Magpie model');
    assert.equal(titleRequest.tools?.length || 0, 0, 'Title generation must not expose tools');
    assert.equal((await api(namedBase + '/model-binding')).effectiveModel.modelId, 'fixture/a');
    await stop(); await start();
    assert.equal((await api(namedBase + '/history')).title, '阅读器交互优化', 'Generated title must survive restart');
    // An empty title must remain retryable, including across a restart and
    // through the SDK entry point. Retry uses the original request.
    titleReply = '';
    const retry = await api('/api/agent/session', { projectId: 'demo', pageId: 'reader', version: 'v1',
        providerConfig: { provider: 'integration:magpie', adapter: 'magpie' } });
    const retryBase = `/api/agent/session/${retry.sessionId}`;
    await api(retryBase + '/sdk/prompt', { prompt: '请帮我优化阅读器中的交互体验' });
    const retryFile = path.join(workspace, 'data/agent-sessions', retry.sessionId + '.json');
    for (let i = 0; i < 200 && !logs.includes('Title generation returned empty text'); i++) await pause(30);
    assert.ok(logs.includes('Title generation returned empty text'), logs);
    assert.equal(JSON.parse(await fs.readFile(retryFile, 'utf8')).titleSource, 'local');
    await stop();
    const legacyTitle = JSON.parse(await fs.readFile(retryFile, 'utf8'));
    delete legacyTitle.titleSource;
    await write(retryFile, legacyTitle);
    titleReply = '阅读器交互优化'; await start();
    const titleCountBeforeRetry = titleRequests;
    for (let i = 0; i < 200; i++) {
        if ((await api(retryBase + '/history')).title === '阅读器交互优化') break;
        await pause(30);
    }
    assert.equal((await api(retryBase + '/history')).title, '阅读器交互优化');
    assert.equal(titleRequests, titleCountBeforeRetry + 1, 'Concurrent history reads must share the title request');
    await api(base + '/sdk/set-model', { model: 'fixture/c' }, 409);
    models = ['b', 'c']; await api('/api/agent/magpie/refresh', {});
    const before = requests.length; await api(base + '/sdk/prompt', { prompt: 'Must not run' }, 422); assert.equal(requests.length, before);
    await choose('follow'); assert.equal((await view()).effectiveModel.modelId, 'fixture/b');
    await fs.writeFile(anchor, '{'); await api('/api/agent/magpie/refresh', {});
    await api(base + '/sdk/prompt', { prompt: 'Must not fall back' }, 503); assert.equal(requests.length, before);
    const persisted = await fs.readFile(path.join(workspace, 'data/agent-sessions', sessionId + '.json'), 'utf8');
    assert.equal(persisted.includes(managed.apiKey), false); assert.equal(logs.includes(managed.apiKey), false);
    t.diagnostic('Actual Pi completed write/read tool loop; no real subscriptions or workspaces used.');
});
