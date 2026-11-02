import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Opt-in only: consumes the currently selected Magpie model's allowance.
// Never changes Magpie's model, plugin installation or account configuration.
test('live Magpie: Responses/image input/tool writes and next-turn edit', { skip: process.env.PROTA_MAGPIE_LIVE !== '1' ? 'Requires PROTA_MAGPIE_LIVE=1 and a connected local Magpie subscription; consumes model allowance' : false, timeout: 240000 }, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-magpie-live-'));
    const workspace = path.join(root, 'workspace'), config = path.join(root, 'config');
    const write = async (name, value) => { await fs.mkdir(path.dirname(name), { recursive: true }); await fs.writeFile(name, typeof value === 'string' ? value : JSON.stringify(value)); };
    const page = 'src/pages/demo/reader/v1';
    await write(path.join(workspace, page, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><button id="counter">0</button><script src="app.js"></script></body></html>');
    await write(path.join(workspace, page, 'styles.css'), 'body { font-family: sans-serif; }');
    await write(path.join(workspace, page, 'app.js'), '');
    await write(path.join(workspace, 'workspace.json'), { id: 'magpie-live', formatVersion: 1 });
    await write(path.join(workspace, 'data/projects.json'), { projects: [{ id: 'demo', pages: [{ id: 'reader', targetDevice: 'web', versions: ['v1'] }] }] });
    const reserve = http.createServer(); await new Promise(r => reserve.listen(0, '127.0.0.1', r)); const port = reserve.address().port; await new Promise(r => reserve.close(r));
    let logs = '';
    const child = spawn(process.execPath, ['server/agent-server.mjs'], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, READIFY_CONFIG_DIR: config, READIFY_WORKSPACE: workspace, READIFY_AGENT_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
    t.after(async () => { if (child.exitCode === null) { const exit = new Promise(r => child.once('exit', r)); child.kill('SIGTERM'); await exit; } await fs.rm(root, { recursive: true, force: true }); });
    const api = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${port}${route}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const raw = await response.text(); assert.equal(response.status, 200, raw); return raw;
    };
    for (let i = 0; i < 100; i++) { try { await api('/api/agent/health'); break; } catch {} await new Promise(r => setTimeout(r, 50)); }
    const status = JSON.parse(await api('/api/agent/magpie/status')); assert.equal(status.managed, true);
    const created = JSON.parse(await api('/api/agent/session', { projectId: 'demo', pageId: 'reader', version: 'v1', providerConfig: { provider: 'integration:magpie', adapter: 'magpie', sdkOptions: { maxTurns: 10, permissionMode: 'acceptEdits', maxTokens: 2048 } } }));
    const base = `/api/agent/session/${created.sessionId}`;
    const view = JSON.parse(await api(base + '/model-binding'));
    const catalog = JSON.parse(await api('/api/agent/magpie/models'));
    const selected = catalog.models.find(m => m.id === status.defaultModel);
    if (selected.efforts.includes('low')) await api(base + '/model-binding', { kind: 'magpie', policy: 'follow', reasoningEffort: 'low', expectedRevision: view.bindingRevision });
    const prompt = 'Do this tiny integration test only. Read ' + page + '/index.html. Use the write or edit tool to implement app.js next to it: clicking #counter increments the displayed integer by 1. Set window.magpieLiveVerified = true. Do not change any other file. Do not run commands. Finish with one short sentence.';
    const attachments = selected.images ? [{ name: 'pixel.png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' }] : [];
    const first = await api(base + '/message', { projectId: 'demo', pageId: 'reader', version: 'v1', message: prompt, attachments });
    assert.ok(first.includes('run_finished'), first.slice(-3000));
    const code = await fs.readFile(path.join(workspace, page, 'app.js'), 'utf8'); assert.match(code, /magpieLiveVerified/); assert.match(code, /counter/);
    const second = await api(base + '/message', { projectId: 'demo', pageId: 'reader', version: 'v1', message: 'Read app.js, then edit it so clicks increment by 2 instead of 1. Preserve window.magpieLiveVerified. Do not change any other file or run commands. Finish briefly.' });
    assert.ok(second.includes('run_finished'), second.slice(-3000));
    const after = await fs.readFile(path.join(workspace, page, 'app.js'), 'utf8'); assert.notEqual(after, code); assert.match(after, /magpieLiveVerified/);
    const history = JSON.parse(await api(base + '/history'));
    assert.equal(history.timeline.filter(e => e.type === 'run_started').length, 2);
    assert.ok(history.timeline.filter(e => e.type === 'run_started').every(e => e.payload.runModelSnapshot.requestedModel === status.defaultModel));
    assert.ok(history.timeline.some(e => e.type === 'tool_call' || e.type === 'tool_start' || e.type === 'tool_result'));
    t.diagnostic(`Live model: ${status.defaultModel}; API: ${selected.nativeEndpoints.join(', ')}; image input: ${attachments.length > 0}; two tool-driven turns completed.`);
});
