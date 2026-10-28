import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateTool, mapAllowedTools, validatePolicy, normalizeToolSelection } from '../server/pi/tool-policy.mjs';
import { encodeInteraction, decodeInteraction } from '../server/pi/ui-protocol.mjs';

function setup(t, permissionMode = 'default') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prota-pi-policy-'));
    const workspaceRoot = path.join(root, 'workspace');
    fs.mkdirSync(workspaceRoot);
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    return { root, workspaceRoot, policy: validatePolicy({ schemaVersion: 1, runId: 'run-1', workspaceRoot,
        permissionMode, allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'AskUserQuestion'] }) };
}

test('tool names map to native Pi tools without exposing unapproved tools', () => {
    assert.deepEqual(mapAllowedTools(['Read', 'Skill', 'Glob', 'Grep', 'Write', 'AskUserQuestion']),
        ['read', 'find', 'grep', 'write', 'ask_user']);
    assert.throws(() => mapAllowedTools(['unknown']), /Unsupported Pi tools/);
    assert.throws(() => validatePolicy({}), /Invalid Prota/);
});

test('default permissions read directly and ask before writes or commands', t => {
    const { policy } = setup(t);
    assert.equal(evaluateTool(policy, 'read', { path: 'index.html' }).action, 'allow');
    assert.equal(evaluateTool(policy, 'write', { path: 'index.html' }).action, 'ask');
    assert.equal(evaluateTool(policy, process.platform === 'win32' ? 'powershell' : 'bash', { command: 'pwd' }).action, 'ask');
    assert.equal(evaluateTool(policy, 'find', { pattern: '*' }).action, 'deny');
});

test('explicit SDK tools selection intersects the per-run whitelist without silently exposing other tools', t => {
    const { policy } = setup(t, 'bypassPermissions');
    policy.availableTools = normalizeToolSelection(['Read']);
    assert.equal(evaluateTool(policy, 'read', { path: 'demo.html' }).action, 'allow');
    assert.equal(evaluateTool(policy, 'write', { path: 'demo.html' }).action, 'deny');
    policy.availableTools = [];
    assert.equal(evaluateTool(policy, 'read', {}).action, 'deny');
    assert.equal(normalizeToolSelection({ type: 'preset', preset: 'default' }), undefined);
    for (const option of [[{ name: 'custom', call: 'handler' }], { type: 'preset', preset: 'unknown' }, 'Read']) {
        assert.throws(() => normalizeToolSelection(option), /tools|tool/);
    }
});

test('acceptEdits permits file changes and still asks before commands', t => {
    const { policy } = setup(t, 'acceptEdits');
    assert.equal(evaluateTool(policy, 'write', { path: 'index.html' }).action, 'allow');
    assert.equal(evaluateTool(policy, process.platform === 'win32' ? 'powershell' : 'bash', { command: 'pwd' }).action, 'ask');
});

test('dontAsk rejects ungranted high-risk calls and accepts the same-tool session grant', t => {
    const { policy } = setup(t, 'dontAsk');
    const decision = evaluateTool(policy, 'write', { path: 'one.html' });
    assert.equal(decision.action, 'deny');
    const grants = new Set([decision.grantKey]);
    assert.equal(evaluateTool(policy, 'write', { path: 'one.html' }, grants).action, 'allow');
    assert.equal(evaluateTool(policy, 'write', { path: 'two.html' }, grants).action, 'allow');
    assert.equal(evaluateTool(policy, 'write', { path: '../outside.html' }, grants).action, 'deny');
    assert.equal(evaluateTool({ ...policy, sessionId: 'forked-session' }, 'write', { path: 'two.html' }, grants).action, 'deny');
});

test('bypassPermissions still rejects traversal and sensitive files', t => {
    const { policy } = setup(t, 'bypassPermissions');
    assert.equal(evaluateTool(policy, 'write', { path: 'index.html' }).action, 'allow');
    for (const filename of ['../outside.txt', '.env', '.env.local', 'data/agent-provider-config.json', 'data/agent-sessions/a.json']) {
        assert.equal(evaluateTool(policy, 'write', { path: filename }).action, 'deny', filename);
    }
});

test('path validation rejects symlinks to a different directory', { skip: process.platform === 'win32' }, t => {
    const { policy, root, workspaceRoot } = setup(t, 'bypassPermissions');
    fs.mkdirSync(path.join(root, 'outside'));
    fs.symlinkSync(path.join(root, 'outside'), path.join(workspaceRoot, 'linked'));
    assert.equal(evaluateTool(policy, 'write', { path: 'linked/new/file.html' }).action, 'deny');
    fs.symlinkSync(path.join(root, 'missing'), path.join(workspaceRoot, 'dangling'));
    assert.equal(evaluateTool(policy, 'write', { path: 'dangling' }).action, 'deny');
});

test('versioned RPC interaction labels round-trip Unicode and are independent of UI copy', () => {
    const payload = { kind: 'approval', runId: 'run-1', toolName: 'write', input: { path: '中文.html' } };
    assert.deepEqual(decodeInteraction(encodeInteraction(payload)), payload);
    assert.equal(decodeInteraction('Allow this tool?'), null);
    assert.throws(() => decodeInteraction('prota-ui:v1:broken'), /Invalid/);
});
