import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { adaptMcpServers, configuredMcpSecrets } from '../server/pi/mcp-adapter.mjs';
import { evaluateTool, validatePolicy } from '../server/pi/tool-policy.mjs';
import { ProtaPiGateway } from '../server/pi/gateway-adapter.mjs';

test('MCP config maps explicit environment only and reports incompatible entries', () => {
    assert.deepEqual(configuredMcpSecrets({ invalid: { unknown: true,
        headers: { Custom: 'Bearer ${TOKEN}' }, env: { OTHER: 'ordinary' } } }, { TOKEN: 'private-test-value' }),
    ['Bearer private-test-value', 'private-test-value']);
    const result = adaptMcpServers({ remote: { type: 'http', url: 'https://example.test/mcp',
        headers: { Authorization: 'Bearer ${TOKEN}' }, oauth: { clientSecret: 'secret' } } }, { TOKEN: 'test-token', UNRELATED_KEY: 'must-not-leak' });
    assert.ok(!JSON.stringify(result.config).includes('test-token'));
    assert.ok(Object.values(result.env).includes('Bearer test-token'));
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
    assert.equal(result.config.mcpServers.remote.exposure, 'direct');
    for (const value of [{ type: 'sse', url: 'https://example.test/sse' }, { command: 'node', env: { KEY: '!echo token' } },
        { command: 'node', env: { KEY: '${MISSING}' } }, { command: 'node', unknown: true }]) {
        assert.throws(() => adaptMcpServers({ server: value }, {}));
    }
    assert.throws(() => adaptMcpServers({ 'a-b': { command: 'node' }, a_b: { command: 'node' } }), /duplicate/);
});

test('MCP whitelist patterns enforce deny precedence and per-tool hashed session grants', () => {
    const policy = validatePolicy({ schemaVersion: 1, runId: 'test', workspaceRoot: os.tmpdir(),
        allowedTools: ['mcp__fixture__*'], disallowedTools: ['mcp__fixture__delete'], permissionMode: 'acceptEdits' });
    const decision = evaluateTool(policy, 'mcp__fixture__echo', { text: 'credential' });
    assert.equal(decision.action, 'ask');
    assert.match(decision.grantKey, /^[a-f0-9]{64}$/);
    assert.equal(evaluateTool(policy, 'mcp__fixture__echo', { text: 'credential' }, new Set([decision.grantKey])).action, 'allow');
    assert.equal(evaluateTool(policy, 'mcp__fixture__echo', { text: 'other' }, new Set([decision.grantKey])).action, 'allow');
    assert.equal(evaluateTool({ ...policy, sessionId: 'fork' }, 'mcp__fixture__echo', { text: 'other' }, new Set([decision.grantKey])).action, 'ask');
    assert.equal(evaluateTool(policy, 'mcp__fixture__delete', {}).action, 'deny');
    assert.equal(evaluateTool(policy, 'mcp__other__echo', {}).action, 'deny');
});

test('source-built Pi connects stdio and authenticated HTTP MCP, obtains approval and retains tool results', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-pi-mcp-'));
    const gateway = new ProtaPiGateway({ workspaceRoot: () => root, configDirectory: path.join(root, 'config') });
    const nativeEvents = [];
    gateway.manager.on('event', (_id, event) => { if (event.type === 'extension_error' || event.type === 'extension_ui_request') nativeEvents.push(event); });
    const requests = [];
    const httpCalls = [];
    const server = http.createServer(async (req, res) => {
        if (req.url === '/mcp' && req.method !== 'POST') { res.writeHead(req.method === 'DELETE' ? 200 : 405); res.end(); return; }
        let raw = ''; for await (const bytes of req) raw += bytes;
        const body = JSON.parse(raw);
        if (req.url === '/mcp') {
            httpCalls.push({ method: body.method, authorized: req.headers.authorization === 'Bearer remote-fixture-token' });
            if (req.headers.authorization !== 'Bearer remote-fixture-token') { res.writeHead(401); res.end(); return; }
            if (body.id === undefined) { res.writeHead(202); res.end(); return; }
            const result = body.method === 'initialize' ? { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'http-fixture', version: '1' } }
                : body.method === 'tools/list' ? { tools: [{ name: 'echo', description: 'Return supplied text', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }] }
                : { content: [{ type: 'text', text: `${body.params.arguments.text}:http-credential-ok` }] };
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result })); return;
        }
        requests.push(body);
        const count = body.messages.filter(message => message.role === 'tool').length;
        const done = count >= 2;
        const delta = done ? { content: 'MCP completed' } : { tool_calls: [{ index: 0, id: 'mcp-echo', type: 'function', function: {
            name: count ? 'mcp__remote__echo' : 'mcp__fixture__echo', arguments: JSON.stringify({ text: 'native-mcp' }) } }] };
        if (!done) delta.tool_calls[0].id += `-${count}`;
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const chunk = (delta, finish_reason = null) => ({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'fixture', choices: [{ index: 0, delta, finish_reason }] });
        res.write(`data: ${JSON.stringify(chunk(delta))}\n\n`);
        res.write(`data: ${JSON.stringify(chunk({}, done ? 'stop' : 'tool_calls'))}\n\n`);
        res.end('data: [DONE]\n\n');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { await gateway.manager.disposeAll(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
    const session = { id: 'mcp-test', providerConfig: { provider: 'custom', apiType: 'openai-completions', model: 'fixture',
        apiKey: 'fixture-key', baseURL: `http://127.0.0.1:${server.address().port}/v1`, sdkOptions: { mcpServers: { fixture: {
            command: process.execPath, args: [fileURLToPath(new URL('./fixtures/pi-mcp-server.mjs', import.meta.url))], env: { FIXTURE_TOKEN: 'explicit-fixture-token' }
        }, remote: { type: 'http', url: `http://127.0.0.1:${server.address().port}/mcp`, headers: { Authorization: 'Bearer remote-fixture-token' } } } } } };
    const approvals = [], events = [];
    const result = await gateway.run(session, { prompt: 'Use the echo MCP tools.', options: { allowedTools: ['mcp__fixture__*', 'mcp__remote__*'], maxTurns: 5 },
        runId: 'mcp-run', emit: (type, payload) => events.push({ type, payload }), setRunState: () => {},
        approval: async (name, input) => { approvals.push({ name, input }); return 'allow_once'; }, question: async () => { throw new Error('Unexpected question'); } });
    assert.equal(result.result, 'MCP completed');
    assert.equal(approvals[0]?.name, 'mcp__fixture__echo', JSON.stringify({ events, nativeEvents, requests }));
    assert.equal(approvals[1]?.name, 'mcp__remote__echo');
    assert.ok(requests[0].tools.some(tool => tool.function.name === 'mcp__fixture__echo'));
    assert.ok(!requests[0].tools.some(tool => tool.function.name === 'write'));
    assert.ok(JSON.stringify(requests.at(-1).messages).includes('native-mcp:credential-ok'));
    assert.ok(JSON.stringify(requests.at(-1).messages).includes('native-mcp:http-credential-ok'));
    assert.ok(httpCalls.some(call => call.method === 'tools/call'));
    assert.ok(httpCalls.every(call => call.authorized));
    const { paths } = await gateway.ensure(session);
    assert.ok(!(await fs.readFile(path.join(paths.config, 'mcp.json'), 'utf8')).includes('explicit-fixture-token'));
    assert.ok(!(await fs.readFile(path.join(paths.config, 'mcp.json'), 'utf8')).includes('remote-fixture-token'));
    assert.ok(events.some(event => event.type === 'sdk_tool_result' && event.payload.toolName === 'mcp__fixture__echo'));
});
