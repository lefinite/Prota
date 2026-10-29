import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePiCommands } from '../server/pi/command-registry.mjs';
import { buildConnectionProbe } from '../server/pi/connection-probe.mjs';
import { enabledMcpTools } from '../server/pi/mcp-adapter.mjs';
import { evaluateTool } from '../server/pi/tool-policy.mjs';
import { flattenPiTree } from '../portal/agent/pi-session-dialog.js';

const config = { provider: 'custom', model: 'fixture', apiKey: 'fixture-key', sdkOptions: {} };
test('connection probes use all four runtime API protocols and preserve custom versioned endpoints', () => {
    const fixtures = [
        ['anthropic-messages', 'https://example.test/anthropic', '/anthropic/v1/messages', 'messages'],
        ['openai-completions', 'https://example.test/openai', '/openai/v1/chat/completions', 'messages'],
        ['openai-completions', 'https://example.test/api/paas/v4', '/api/paas/v4/chat/completions', 'messages'],
        ['openai-responses', 'https://example.test/openai', '/openai/v1/responses', 'input'],
        ['openai-responses', 'https://example.test/v1', '/v1/responses', 'input'],
        ['google-generative-ai', 'https://example.test/v1beta', '/v1beta/models/fixture:generateContent', 'contents']
    ];
    for (const [apiType, baseURL, endpoint, field] of fixtures) {
        const probe = buildConnectionProbe({ ...config, apiType, baseURL });
        assert.equal(probe.url, `https://example.test${endpoint}`);
        assert.ok(probe.body[field]);
        assert.ok(!probe.url.includes(config.apiKey));
    }
    assert.throws(() => buildConnectionProbe({ ...config, apiType: 'unsupported', baseURL: 'https://example.test' }), /Unsupported/);
});

test('Pi extension discovery filters internal commands, unsupported sources and collisions including aliases', () => {
    const prota = [{ id: 'usage', aliases: ['/cost'] }, { id: 'tree' }];
    const discovered = [
        { name: 'cost', source: 'extension' }, { name: 'tree', source: 'extension' },
        { name: 'prota-runtime-status', source: 'extension' }, { name: 'prota-import-legacy-v1', source: 'extension' },
        { name: 'review', source: 'extension' }, { name: 'review', source: 'extension' },
        { name: 'template', source: 'prompt' }, { name: 'skill:reader', source: 'skill' }, { name: '../unsafe', source: 'extension' }
    ];
    const commands = mergePiCommands(prota, discovered);
    assert.deepEqual(commands.map(command => command.id), ['usage', 'tree', 'review']);
    assert.equal(commands.at(-1).source, 'pi-extension');
    assert.equal(prota.length, 2);
});

test('explicit MCP enablement adds a namespace whitelist while approvals and deny lists still apply', () => {
    const allowedTools = enabledMcpTools({ connected: { command: 'node' }, disabled: { enabled: false }, 'enabled-one': { enabled: true } });
    assert.deepEqual(allowedTools, ['mcp__enabled_one__*']);
    const policy = { allowedTools, workspaceRoot: '/tmp', permissionMode: 'default' };
    assert.equal(evaluateTool(policy, 'mcp__enabled_one__echo').action, 'ask');
    assert.equal(evaluateTool(policy, 'mcp__connected__echo').action, 'deny');
    assert.equal(evaluateTool({ ...policy, disallowedTools: ['mcp__enabled_one__echo'] }, 'mcp__enabled_one__echo').action, 'deny');
    assert.equal(evaluateTool({ ...policy, availableTools: ['read'] }, 'mcp__enabled_one__echo').action, 'deny');
});

test('tree selector retains hierarchy and marks only forkable native user entries selectable', () => {
    const tree = [{ entry: { id: 'u1', type: 'message', message: { role: 'user', content: 'Question' } }, children: [
        { entry: { id: 'a1', type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: '<unsafe>' }] } }, children: [] }
    ] }];
    const rows = flattenPiTree(tree, 'a1', new Set(['u1']));
    assert.equal(rows[0].disabled, false);
    assert.equal(rows[1].disabled, true);
    assert.ok(rows[1].label.includes('● assistant'));
    assert.ok(rows[1].label.startsWith('　'));
});
