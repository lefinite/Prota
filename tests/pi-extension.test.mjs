import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import protaExtension from '../runtime/pi/extensions/prota-extension.mjs';
import { decodeInteraction } from '../server/pi/ui-protocol.mjs';

function harness(t, extra = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prota-extension-'));
    const policyFile = path.join(root, 'run.json');
    const old = process.env.PROTA_PI_RUN_CONFIG;
    process.env.PROTA_PI_RUN_CONFIG = policyFile;
    t.after(() => {
        if (old === undefined) delete process.env.PROTA_PI_RUN_CONFIG;
        else process.env.PROTA_PI_RUN_CONFIG = old;
        fs.rmSync(root, { recursive: true, force: true });
    });
    const policy = { schemaVersion: 1, runId: 'run-1', workspaceRoot: root, allowedTools: ['Read', 'Write', 'AskUserQuestion'],
        permissionMode: 'default', maxTurns: 2, systemContext: 'Prota business rules', ...extra };
    fs.writeFileSync(policyFile, JSON.stringify(policy));
    const hooks = new Map(), tools = new Map(), entries = [], dialogs = [], activeTools = [];
    let answer = 'allow_once', inputAnswer = 'free form', aborts = 0;
    const pi = { on: (name, fn) => hooks.set(name, fn), registerTool: tool => tools.set(tool.name, tool),
        getAllTools: () => ['read', 'write', 'ask_user', 'bash', 'edit', 'mcp__fixture__echo'].map(name => ({ name })),
        registerCommand: () => {}, setActiveTools: names => activeTools.push(names),
        appendEntry: (customType, data) => entries.push({ type: 'custom', customType, data }) };
    protaExtension(pi);
    const ctx = { sessionManager: { getBranch: () => entries }, abort: () => aborts++,
        ui: { select: async (title, options) => { dialogs.push({ title, options }); return answer; },
            input: async title => { dialogs.push({ title }); return inputAnswer; }, notify: () => {} } };
    const before = { systemPromptOptions: { sections: {} } };
    hooks.get('before_agent_start')(before, ctx);
    return { root, hooks, tools, entries, dialogs, ctx, before, activeTools,
        answer: value => { answer = value; }, input: value => { inputAnswer = value; }, aborts: () => aborts };
}

test('Prota Extension injects context and enables only this run tool policy', t => {
    const h = harness(t);
    assert.equal(h.before.systemPromptOptions.sections.prota_context, 'Prota business rules');
    assert.deepEqual(h.activeTools[0], ['read', 'write', 'ask_user']);
    assert.ok(h.tools.has('ask_user'));
});

test('approval allow_once does not persist a grant and deny blocks the tool', async t => {
    const h = harness(t);
    const call = { toolName: 'write', input: { path: 'demo.html' } };
    assert.equal(await h.hooks.get('tool_call')(call, h.ctx), undefined);
    assert.equal(await h.hooks.get('tool_call')(call, h.ctx), undefined);
    assert.equal(h.dialogs.length, 2);
    assert.equal(decodeInteraction(h.dialogs[0].title).kind, 'approval');
    assert.equal(h.entries.length, 0);
    h.answer('deny');
    assert.equal((await h.hooks.get('tool_call')(call, h.ctx)).block, true);
});

test('approval allow_session persists a tool grant for native Session restore', async t => {
    const h = harness(t);
    h.answer('allow_session');
    const call = { toolName: 'write', input: { path: 'demo.html' } };
    await h.hooks.get('tool_call')(call, h.ctx);
    h.answer('deny');
    assert.equal(await h.hooks.get('tool_call')(call, h.ctx), undefined);
    assert.equal(await h.hooks.get('tool_call')({ toolName: 'write', input: { path: 'another.html' } }, h.ctx), undefined);
    assert.equal(h.dialogs.length, 1);
    assert.equal(h.entries[0].customType, 'prota-permission-v1');
    await h.hooks.get('session_start')({}, h.ctx);
    assert.equal(await h.hooks.get('tool_call')(call, h.ctx), undefined);
    assert.equal(h.dialogs.length, 1);
});

test('ask_user waits for selected text, supports free input and reports cancellation', async t => {
    const h = harness(t);
    const tool = h.tools.get('ask_user');
    h.answer('中文');
    const result = await tool.execute('call-1', { question: '选择语言', options: ['中文', 'English'] }, undefined, undefined, h.ctx);
    assert.equal(result.content[0].text, '中文');
    assert.equal(decodeInteraction(h.dialogs[0].title).question, '选择语言');
    h.answer('__prota_free_text_v1__');
    const free = await tool.execute('call-2', { question: '需求', options: ['A'] }, undefined, undefined, h.ctx);
    assert.equal(free.content[0].text, 'free form');
    h.input(undefined);
    await assert.rejects(tool.execute('call-3', { question: '需求' }, undefined, undefined, h.ctx), /cancelled/);
});

test('Extension clears temporary policy on settled and enforces the turn limit', async t => {
    const h = harness(t);
    h.hooks.get('turn_start')({}, h.ctx);
    h.hooks.get('turn_start')({}, h.ctx);
    assert.equal(h.aborts(), 0);
    h.hooks.get('turn_start')({}, h.ctx);
    assert.equal(h.aborts(), 1);
    h.hooks.get('agent_settled')();
    assert.equal((await h.hooks.get('tool_call')({ toolName: 'read', input: { path: '.' } }, h.ctx)).block, true);
});

test('official provider payload hook preserves existing fields and adds explicit reasoning parameters', t => {
    const h = harness(t, { reasoningBody: { output_config: { effort: 'max' } } });
    const payload = { model: 'model', messages: [{ role: 'user', content: 'prompt' }], output_config: { format: 'json' } };
    const updated = h.hooks.get('before_provider_request')({ payload });
    assert.deepEqual(updated.output_config, { format: 'json', effort: 'max' });
    assert.deepEqual(updated.messages, payload.messages);
    assert.deepEqual(payload.output_config, { format: 'json' });
});
