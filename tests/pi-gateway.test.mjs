import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const product = fileURLToPath(new URL('..', import.meta.url));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Gateway HTTP/SSE uses real Pi for tools, approval, checkpoints, restart, fork and clear', { timeout: 180_000 }, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-pi-gateway-'));
    const workspace = path.join(root, 'workspace'), config = path.join(root, 'config');
    const page = path.join(workspace, 'src/pages/demo/reader/v1');
    await fs.mkdir(page, { recursive: true });
    await fs.mkdir(path.join(workspace, 'data'));
    await fs.mkdir(config);
    const initial = 'window.initial = true;';
    await fs.writeFile(path.join(page, 'app.js'), initial);
    await fs.writeFile(path.join(page, 'index.html'), '<html><body>test</body></html>');
    await fs.writeFile(path.join(page, 'styles.css'), 'body { color: black; }');
    await fs.writeFile(path.join(workspace, 'workspace.json'), JSON.stringify({ id: 'pi-gateway-test', formatVersion: 1 }));
    await fs.writeFile(path.join(workspace, 'data/projects.json'), JSON.stringify({ projects: [{ id: 'demo', pages: [{ id: 'reader', versions: ['v1'], targetDevice: 'web' }] }] }));
    const requests = [];
    const model = http.createServer(async (req, res) => {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw); requests.push(body);
        const title = body.model !== 'fixture-model';
        const hasTool = body.messages.some(message => message.role === 'tool');
        const tool = !title && !hasTool;
        const delta = tool ? { tool_calls: [{ index: 0, id: 'gateway-write', type: 'function', function: { name: 'write',
            arguments: JSON.stringify({ path: 'src/pages/demo/reader/v1/app.js', content: 'window.piMigrated = true;' }) } }] }
            : { content: title ? '阅读器原型' : 'Pi Gateway task complete.' };
        const record = (value, finish = null) => ({ id: 'fixture', object: 'chat.completion.chunk', created: 1,
            model: body.model, choices: [{ index: 0, delta: value, finish_reason: finish }] });
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        if (!title && JSON.stringify(body.messages.at(-1)).includes('Wait for interruption')) {
            res.write(`data: ${JSON.stringify(record({ role: 'assistant', content: 'waiting' }))}\n\n`);
            const timer = setInterval(() => res.write(': waiting\n\n'), 100);
            res.on('close', () => clearInterval(timer));
            return;
        }
        res.write(`data: ${JSON.stringify(record({ role: 'assistant' }))}\n\n`);
        res.write(`data: ${JSON.stringify(record(delta))}\n\n`);
        res.write(`data: ${JSON.stringify(record({}, tool ? 'tool_calls' : 'stop'))}\n\n`);
        res.end('data: [DONE]\n\n');
    });
    await new Promise(resolve => model.listen(0, '127.0.0.1', resolve));
    const portServer = http.createServer();
    await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
    const port = portServer.address().port;
    await new Promise(resolve => portServer.close(resolve));
    const base = `http://127.0.0.1:${port}`;
    let child, output = '';
    async function start() {
        child = spawn(process.execPath, [path.join(product, 'server/agent-server.mjs')], { cwd: product,
            env: { PATH: process.env.PATH, HOME: root, USERPROFILE: root, READIFY_CONFIG_DIR: config,
                READIFY_WORKSPACE: workspace, READIFY_AGENT_PORT: String(port),
                ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', data => { output += data; });
        child.stderr.on('data', data => { output += data; });
        for (let attempt = 0; attempt < 100; attempt++) {
            if (child.exitCode !== null) throw new Error(output);
            try { if ((await fetch(`${base}/api/agent/health`)).ok) return; } catch {}
            await delay(50);
        }
        throw new Error(`Gateway did not start: ${output}`);
    }
    async function stop() {
        if (!child || child.exitCode !== null) return;
        const exited = new Promise(resolve => child.once('exit', resolve));
        child.kill('SIGTERM');
        const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
        await exited; clearTimeout(timer);
    }
    async function json(route, body, method = body ? 'POST' : 'GET') {
        const response = await fetch(base + route, { method,
            headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        const data = await response.json();
        assert.equal(response.ok, true, JSON.stringify(data));
        return data;
    }
    t.after(async () => {
        await stop();
        model.closeAllConnections();
        await new Promise(resolve => model.close(resolve));
        await fs.rm(root, { recursive: true, force: true });
    });
    await start();
    const context = { projectId: 'demo', pageId: 'reader', version: 'v1', targetDevice: 'web' };
    const providerConfig = { provider: 'openai-compatible', apiType: 'openai-completions', model: 'fixture-model',
        baseURL: `http://127.0.0.1:${model.address().port}/v1`, apiKey: 'local-only-key', sdkOptions: { permissionMode: 'default', maxTurns: 10 } };
    const credentialSession = await json('/api/agent/session', { ...context, providerConfig: { ...providerConfig,
        sdkOptions: { mcpServers: { remote: { type: 'http', url: 'https://example.invalid/mcp',
            headers: { 'X-Custom-Credential': 'idle-mcp-credential' } } } } } });
    const credentialPath = path.join(workspace, 'data/agent-sessions', `${credentialSession.sessionId}.json`);
    for (let attempt = 0; attempt < 100 && !await fs.stat(credentialPath).catch(() => null); attempt++) await delay(20);
    const credentialSnapshot = await fs.readFile(credentialPath, 'utf8');
    assert.ok(!credentialSnapshot.includes('idle-mcp-credential'), 'MCP credential leaked without a live Pi environment');
    const session = await json('/api/agent/session', { ...context, providerConfig });
    const id = session.sessionId;
    const route = `/api/agent/session/${id}`;
    assert.equal((await json('/api/agent/health')).piRuntimes, 0, 'Creating a session must not start Pi');
    await json(`${route}/history`);
    assert.equal((await json('/api/agent/health')).piRuntimes, 0, 'Reading history must not start Pi');
    const response = await fetch(`${base}${route}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...context, providerConfig, message: 'Update the reader app.js using the write tool. Credential check: local-only-key.' }) });
    assert.equal(response.ok, true);
    const events = [];
    let pending = '';
    const decoder = new TextDecoder();
    for await (const bytes of response.body) {
        pending += decoder.decode(bytes, { stream: true });
        let boundary;
        while ((boundary = pending.indexOf('\n\n')) >= 0) {
            const block = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
            const data = block.split('\n').find(line => line.startsWith('data:'));
            if (!data) continue;
            const event = JSON.parse(data.slice(5)); events.push(event);
            if (event.type === 'approval_request') {
                const competing = await fetch(`${base}${route}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...context, message: 'Do not duplicate the active run.' }) });
                const busy = await competing.text();
                assert.ok(busy.includes('run_busy'));
                assert.ok(!busy.includes('run_failed'));
                await json(`${route}/approvals/${event.payload.approval.id}`, { decision: 'allow_once' });
            }
        }
    }
    assert.ok(events.some(event => event.type === 'approval_request'), output + JSON.stringify(events));
    assert.equal(events.filter(event => event.type === 'run_finished').length, 1, JSON.stringify(events));
    assert.equal(events.filter(event => event.type === 'run_failed').length, 0, JSON.stringify(events));
    assert.ok(events.some(event => event.type === 'run_changes' && event.payload.files?.length));
    assert.equal(await fs.readFile(path.join(page, 'app.js'), 'utf8'), 'window.piMigrated = true;');
    const history = await json(`${route}/history`);
    assert.ok(!JSON.stringify(history).includes('local-only-key'), 'History API contains a configured credential');
    assert.ok(!JSON.stringify(events).includes('local-only-key'), 'SSE contains a configured credential');
    assert.ok(!(await fs.readFile(path.join(workspace, 'data/agent-sessions', `${id}.json`), 'utf8')).includes('local-only-key'), 'Snapshot contains a configured credential');
    assert.equal(history.engineInfo.kind, 'pi');
    assert.ok(history.engineInfo.piSessionFile.endsWith('.jsonl'));
    const runId = events.find(event => event.type === 'run_finished').payload.runId;
    await json(`${route}/runs/${runId}/rollback`, { mode: 'single' });
    assert.equal(await fs.readFile(path.join(page, 'app.js'), 'utf8'), initial);
    await stop(); await start();
    const restored = await json(`${route}/history`);
    assert.equal(restored.engineInfo.piSessionId, history.engineInfo.piSessionId);
    assert.equal((await json('/api/agent/health')).piRuntimes, 0);
    const messages = await json(`${route}/sdk/messages`);
    assert.ok(messages.messages.some(message => message.role === 'toolResult'));
    const forked = await json('/api/agent/sdk/fork', { sessionId: id });
    assert.notEqual(forked.session, id);
    assert.equal((await fs.readdir(path.dirname(history.engineInfo.piSessionFile))).filter(name => name.endsWith('.jsonl')).length, 1,
        'Fork must leave no duplicate native clone staging file in the source session directory');
    const forkMessages = await json(`/api/agent/session/${forked.session}/sdk/messages`);
    assert.equal(forkMessages.messages.length, messages.messages.length);
    // Recreate an old Prota snapshot without engine metadata, then exercise the
    // actual migration hook and its idempotency through the unchanged HTTP API.
    await stop();
    const stored = path.join(workspace, 'data/agent-sessions');
    const legacy = JSON.parse(await fs.readFile(path.join(stored, `${forked.session}.json`), 'utf8'));
    legacy.id = 'legacy-session'; legacy.sdkSessionId = legacy.id; delete legacy.engineInfo;
    const legacyRaw = JSON.stringify(legacy);
    await fs.writeFile(path.join(stored, 'legacy-session.json'), legacyRaw);
    const index = JSON.parse(await fs.readFile(path.join(stored, 'index.json'), 'utf8'));
    index.sessions.push({ ...index.sessions.find(item => item.id === forked.session), id: 'legacy-session' });
    await fs.writeFile(path.join(stored, 'index.json'), JSON.stringify(index));
    await start();
    const legacyRoute = '/api/agent/session/legacy-session';
    assert.equal((await json(`${legacyRoute}/history`)).engineInfo.migrationStatus, 'pending');
    const backup = path.join(stored, 'legacy-backups/legacy-session/snapshot.json');
    assert.equal(await fs.readFile(backup, 'utf8'), legacyRaw);
    await json(`${legacyRoute}/sdk/prompt`, { message: 'Continue the previous task.', providerConfig: {
        ...providerConfig, sdkOptions: { permissionMode: 'bypassPermissions', maxTurns: 10 }
    } });
    const migrated = await json(`${legacyRoute}/history`);
    assert.equal(migrated.engineInfo.migrationStatus, 'summary_recovered');
    let transcript = await fs.readFile(migrated.engineInfo.piSessionFile, 'utf8');
    const recoveryCount = text => text.split('\n').filter(line => line && JSON.parse(line).customType === 'prota-legacy-v1-legacy-session').length;
    assert.equal(recoveryCount(transcript), 1);
    await json(`${legacyRoute}/sdk/prompt`, { message: 'Continue once more.' });
    transcript = await fs.readFile(migrated.engineInfo.piSessionFile, 'utf8');
    assert.equal(recoveryCount(transcript), 1, 'Recovered context must not be injected twice');
    assert.equal(await fs.readFile(backup, 'utf8'), legacyRaw);
    await json(`${route}/sdk/clear`, {});
    assert.equal((await json(`${route}/sdk/messages`)).messages.length, 0);
    const interrupting = await fetch(`${base}${route}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...context, providerConfig, message: 'Wait for interruption.' }) });
    const interruptedEvents = [];
    let interruptBuffer = '', didInterrupt = false;
    for await (const chunk of interrupting.body) {
        interruptBuffer += decoder.decode(chunk, { stream: true });
        let boundary;
        while ((boundary = interruptBuffer.indexOf('\n\n')) >= 0) {
            const block = interruptBuffer.slice(0, boundary); interruptBuffer = interruptBuffer.slice(boundary + 2);
            const data = block.split('\n').find(line => line.startsWith('data:'));
            if (!data) continue;
            const event = JSON.parse(data.slice(5)); interruptedEvents.push(event);
            if (!didInterrupt && event.type === 'assistant_message' && event.payload.partial) {
                didInterrupt = true;
                await json(`${route}/interrupt`, {});
            }
        }
    }
    assert.equal(didInterrupt, true);
    assert.equal(interruptedEvents.filter(event => event.type === 'run_finished').length, 1);
    assert.equal(interruptedEvents.filter(event => event.type === 'run_failed').length, 0);
    assert.equal((await json(`${route}/history`)).runState.status, 'interrupted');
    const forkRoute = `/api/agent/session/${forked.session}`;
    const forkHistory = await json(`${forkRoute}/history`);
    const forkFile = forkHistory.engineInfo.piSessionFile;
    const forkBytes = await fs.readFile(forkFile);
    assert.equal((await json(`${forkRoute}/archive`, {})).archived, true);
    assert.deepEqual(await fs.readFile(forkFile), forkBytes, 'Archive must preserve native history');
    assert.equal((await json(`${forkRoute}/archive`, { restore: true })).archived, false);
    await json(`${forkRoute}/set-context`, { ...context, version: 'v2', sessionScope: 'page' });
    const moved = await json(`${forkRoute}/history`);
    assert.equal(moved.context.version, 'v2');
    assert.equal(moved.engineInfo.piSessionId, forkHistory.engineInfo.piSessionId);
    assert.deepEqual(await fs.readFile(forkFile), forkBytes, 'Context changes must preserve native history');
    await json(forkRoute, undefined, 'DELETE');
    assert.equal(await fs.stat(path.dirname(forkFile)).catch(() => null), null);
    assert.equal((await fetch(base + `${forkRoute}/history`)).status, 404);
    assert.ok(await fs.stat(migrated.engineInfo.piSessionFile), 'Delete must not remove another session');
    assert.ok(requests.some(body => body.model === 'fixture-model'));
});
