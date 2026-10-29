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
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Gateway session commands preserve timeline, fork at native user entries and require fresh file restoration confirmation', { timeout: 180000 }, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-session-commands-'));
    const workspace = path.join(root, 'workspace'), config = path.join(root, 'config');
    const page = 'src/pages/demo/reader/v1';
    const file = path.join(workspace, page, 'app.js');
    const write = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, value); };
    await write(file, 'V1');
    await write(path.join(workspace, page, 'index.html'), '<html><body>Reader</body></html>');
    await write(path.join(workspace, page, 'styles.css'), 'body{}');
    await write(path.join(workspace, 'workspace.json'), JSON.stringify({ id: 'session-commands', formatVersion: 1 }));
    const metadata = { activeProjectId: 'demo', activePageId: 'reader', projects: [{ id: 'demo', name: 'Demo', pages: [{ id: 'reader', name: 'Reader', targetDevice: 'mobile', versions: ['v1'] }] }] };
    await write(path.join(workspace, 'data/projects.json'), JSON.stringify(metadata));
    const requests = [];
    const model = http.createServer(async (req, res) => {
        let raw = ''; for await (const bytes of req) raw += bytes;
        const body = JSON.parse(raw); requests.push(body);
        const lastUser = body.messages.findLastIndex(message => message.role === 'user');
        const user = JSON.stringify(body.messages[lastUser]);
        const version = user.match(/WRITE_VERSION (V[23])/u)?.[1];
        const done = body.messages.slice(lastUser + 1).some(message => message.role === 'tool');
        const tool = Boolean(version && !done && body.tools?.some(tool => tool.function?.name === 'write'));
        const delta = tool ? { tool_calls: [{ index: 0, id: `write-${version}`, type: 'function', function: { name: 'write',
            arguments: JSON.stringify({ path: `${page}/app.js`, content: version }) } }] } : { content: 'Summary: preserved memory and current prototype requirements.' };
        const chunk = (delta, finish_reason = null) => ({ id: 'fixture', object: 'chat.completion.chunk', created: 1,
            model: 'fixture', choices: [{ index: 0, delta, finish_reason }] });
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify(chunk({ role: 'assistant', ...delta }))}\n\n`);
        res.write(`data: ${JSON.stringify({ ...chunk({}, tool ? 'tool_calls' : 'stop'), usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } })}\n\n`);
        res.end('data: [DONE]\n\n');
    });
    await listen(model);
    const reservation = http.createServer(); await listen(reservation);
    const port = reservation.address().port; await close(reservation);
    let child; let logs = '';
    const start = async () => {
        child = spawn(process.execPath, ['server/agent-server.mjs'], { cwd: product,
            env: { ...process.env, READIFY_WORKSPACE: workspace, READIFY_CONFIG_DIR: config, READIFY_AGENT_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', bytes => { logs += bytes; }); child.stderr.on('data', bytes => { logs += bytes; });
        for (let i = 0; i < 200; i++) {
            try { if ((await fetch(`http://127.0.0.1:${port}/api/agent/commands`)).ok) return; } catch {}
            if (child.exitCode !== null) throw new Error(logs);
            await pause(30);
        }
        throw new Error(`Gateway failed to start: ${logs}`);
    };
    const stop = async () => {
        if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited; }
    };
    t.after(async () => { await stop(); await close(model); await fs.rm(root, { recursive: true, force: true }); });
    await start();
    const api = async (route, body, expected = 200) => {
        t.diagnostic(`${body?.operation || route}`);
        const response = await fetch(`http://127.0.0.1:${port}${route}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const raw = await response.text();
        assert.equal(response.status, expected, raw + '\n' + logs);
        return JSON.parse(raw);
    };
    const providerConfig = { provider: 'custom', apiType: 'openai-completions', model: 'fixture', apiKey: 'test-only-key',
        baseURL: `http://127.0.0.1:${model.address().port}/v1`, modelCapabilities: { input: ['text'], contextWindow: 128000, maxTokens: 512 },
        sdkOptions: { permissionMode: 'bypassPermissions' } };
    const { sessionId } = await api('/api/agent/session', { projectId: 'demo', pageId: 'reader', version: 'v1', providerConfig });
    const base = `/api/agent/session/${sessionId}`;
    const pi = (operation, payload = {}, expected = 200) => api(`${base}/pi`, { operation, ...payload }, expected);
    await pi('auto-compact', { enabled: false });
    assert.equal((await api(`${base}/sdk/prompt`, { prompt: 'WRITE_VERSION V2' })).ok, true);
    assert.equal((await api(`${base}/sdk/prompt`, { prompt: 'WRITE_VERSION V3\n' + 'retained requirement '.repeat(5000) })).ok, true);
    assert.equal(await fs.readFile(file, 'utf8'), 'V3');
    const before = await api(`${base}/history`);
    assert.equal(Object.keys(before.engineInfo.runEntries).length, 2);
    const { result: forkMessages } = await pi('forkMessages');
    const entryId = forkMessages.messages.at(-1).entryId;
    const nativeBefore = (await pi('entries')).result.entries;
    assert.ok((await pi('tree')).result.tree.length);
    const compact = await pi('compact', { value: 'KEEP_PROTOTYPE_REQUIREMENTS' });
    assert.equal(compact.result.ok, true);
    assert.ok(requests.some(request => JSON.stringify(request).includes('KEEP_PROTOTYPE_REQUIREMENTS')));
    const after = await api(`${base}/history`);
    assert.deepEqual(after.timeline.slice(0, before.timeline.length), before.timeline);
    assert.ok(after.timeline.some(event => event.type === 'run_changes'));
    assert.ok((await pi('entries')).result.entries.some(entry => entry.type === 'compaction'));
    assert.equal((await api(`${base}/sdk/prompt`, { prompt: 'Continue after compact.' })).ok, true);
    assert.ok((await pi('usage')).result.contextUsage);
    assert.ok((await pi('export')).result.html.includes('<html'));
    assert.ok((await pi('copy')).result.text.includes('Summary'));
    await pi('name', { value: '历史分支回归测试专用会话名称' });
    const discovered = await api(`/api/agent/commands?sessionId=${sessionId}`);
    assert.ok(discovered.commands.some(command => command.id === 'tree' && command.source === 'pi-rpc'));
    assert.ok(discovered.commands.some(command => command.id === 'usage' && command.aliases.includes('/cost')));
    assert.ok(!discovered.commands.some(command => command.id.startsWith('prota-')));
    const configResponse = await fetch(`http://127.0.0.1:${port}${base}/commands/config/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerConfig })
    });
    const configStream = await configResponse.text();
    assert.equal(configResponse.status, 200, configStream + '\n' + logs);
    const configEvents = configStream.split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => JSON.parse(line.slice(6)));
    const configResult = configEvents.findLast(event => event.type === 'run_finished')?.payload?.result || '';
    assert.match(configResult, /"agentOptions"/);
    assert.doesNotMatch(configResult, /"sdkOptions"|"sdkExtension"/);
    await pi('rewind', { entryId, restoreFiles: true }, 500);
    assert.equal(await fs.readFile(file, 'utf8'), 'V3');
    const preview = (await pi('rewind-preview', { entryId })).result;
    assert.ok(preview.files.some(item => item.path === `${page}/app.js`));
    assert.equal(await fs.readFile(file, 'utf8'), 'V3');
    await fs.writeFile(file, 'manual edit');
    await pi('rewind', { entryId, restoreFiles: true, confirmationToken: preview.token }, 500);
    assert.equal(await fs.readFile(file, 'utf8'), 'manual edit');
    await fs.writeFile(file, 'V3');
    const { result: fork } = await pi('fork', { entryId });
    const forkEntries = (await api(`/api/agent/session/${fork.sessionId}/pi`, { operation: 'entries' })).result.entries;
    assert.ok(forkEntries.length < nativeBefore.length);
    assert.ok(!forkEntries.some(entry => entry.id === entryId));
    assert.equal(await fs.readFile(file, 'utf8'), 'V3');
    const forkHistory = await api(`/api/agent/session/${fork.sessionId}/history`);
    assert.equal(forkHistory.timeline.filter(event => event.type === 'run_started').length, 1);
    assert.ok(forkHistory.timeline.some(event => event.type === 'run_changes' && event.payload.rollbackStatus === 'available'));
    const { result: clone } = await pi('clone');
    const cloneEntries = (await api(`/api/agent/session/${clone.sessionId}/pi`, { operation: 'entries' })).result.entries;
    assert.ok(cloneEntries.some(entry => entry.id === entryId));
    const preview2 = (await pi('rewind-preview', { entryId })).result;
    const { result: rewind } = await pi('rewind', { entryId, restoreFiles: true, confirmationToken: preview2.token });
    assert.equal(rewind.filesRestored, true);
    assert.equal(await fs.readFile(file, 'utf8'), 'V2');
    assert.equal((await api(`${base}/history`)).title, '历史分支回归测试专用会话名称');
    await stop(); await start();
    assert.equal((await api(`${base}/history`)).title, '历史分支回归测试专用会话名称');
    assert.equal((await pi('state')).result.autoCompactionEnabled, false);
    const resumed = await api(`/api/agent/session/${rewind.sessionId}/sdk/prompt`, {
        prompt: 'Read actual restored files before continuing.',
        providerConfig
    });
    assert.equal(resumed.ok, true);
    assert.ok(requests.some(request => JSON.stringify(request).includes('用户已将工作区文件恢复')));
});
