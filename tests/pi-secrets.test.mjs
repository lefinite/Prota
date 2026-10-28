import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { knownSecrets, redactSecrets, SecretStream } from '../server/pi/secrets.mjs';
import { ProtaPiGateway } from '../server/pi/gateway-adapter.mjs';

test('known credential redaction preserves image bytes and buffers split stream values', () => {
    const key = 'sk-fixture-secret';
    const secrets = knownSecrets({ PROTA_PI_API_KEY: key, PROTA_PI_REDACT_VALUES: '["mcp-secret"]' });
    assert.deepEqual(redactSecrets({ text: key, nested: ['mcp-secret'], image: { type: 'image', data: key } }, secrets),
        { text: '[REDACTED]', nested: ['[REDACTED]'], image: { type: 'image', data: key } });
    const stream = new SecretStream(secrets);
    const chunks = [stream.push('before sk-fix'), stream.push('ture-'), stream.push('secret after'), stream.finish()];
    assert.equal(chunks.join(''), 'before [REDACTED] after');
    const ordinary = new SecretStream(secrets);
    assert.equal(ordinary.push('ends s') + ordinary.push('lowly') + ordinary.finish(), 'ends slowly');
});

test('native shell output and split model output cannot place the provider key in SSE, model context or Session', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-pi-secret-'));
    const gateway = new ProtaPiGateway({ workspaceRoot: () => root, configDirectory: path.join(root, 'config') });
    const key = 'fixture-secret-never-in-history';
    const shell = process.platform === 'win32' ? 'powershell' : 'bash';
    const requests = [];
    const server = http.createServer(async (req, res) => {
        let raw = ''; for await (const bytes of req) raw += bytes;
        const body = JSON.parse(raw); requests.push(body);
        const done = body.messages.some(message => message.role === 'tool');
        const chunk = (delta, finish_reason = null) => ({ id: 'secret-test', object: 'chat.completion.chunk', created: 1,
            model: 'fixture', choices: [{ index: 0, delta, finish_reason }] });
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        if (done) {
            res.write(`data: ${JSON.stringify(chunk({ role: 'assistant', content: key.slice(0, 11) }))}\n\n`);
            res.write(`data: ${JSON.stringify(chunk({ content: key.slice(11) }))}\n\n`);
        } else res.write(`data: ${JSON.stringify(chunk({ role: 'assistant', tool_calls: [{ index: 0, id: 'shell-secret', type: 'function',
            function: { name: shell, arguments: JSON.stringify({ command: process.platform === 'win32'
                ? 'Write-Output $env:PROTA_PI_API_KEY' : 'printf "%s" "$PROTA_PI_API_KEY"' }) } }] }))}\n\n`);
        res.write(`data: ${JSON.stringify(chunk({}, done ? 'stop' : 'tool_calls'))}\n\n`); res.end('data: [DONE]\n\n');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { await gateway.manager.disposeAll(); server.closeAllConnections();
        await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
    const session = { id: 'secret-session', providerConfig: { provider: 'custom', apiType: 'openai-completions',
        model: 'fixture', baseURL: `http://127.0.0.1:${server.address().port}/v1`, apiKey: key, sdkOptions: {} } };
    const events = [], states = [];
    const result = await gateway.run(session, { runId: 'secret-run', prompt: `Run the shell to inspect the configured key ${key}.`,
        options: { allowedTools: ['Bash'], permissionMode: 'bypassPermissions', maxTurns: 5 },
        emit: (type, payload) => events.push({ type, payload }), setRunState: state => states.push(state),
        approval: async () => 'deny', question: async () => undefined });
    assert.equal(result.result, '[REDACTED]');
    assert.ok(!JSON.stringify(requests).includes(key), 'Model context contains the key');
    assert.ok(JSON.stringify(requests).includes('[REDACTED]'));
    assert.ok(!JSON.stringify(events).includes(key));
    assert.ok(!events.filter(event => event.type === 'assistant_delta').map(event => event.payload.text).join('').includes(key));
    assert.ok(!JSON.stringify(states).includes(key));
    assert.ok(!JSON.stringify(await gateway.messages(session)).includes(key));
    assert.ok(!(await fs.readFile(session.engineInfo.piSessionFile, 'utf8')).includes(key));
});
