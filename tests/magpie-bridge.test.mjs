import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MagpieBridge, managedPath, localGateway, normalizeModel } from '../server/magpie/bridge.mjs';
import { ModelBindings, bindingView } from '../server/magpie/bindings.mjs';
import { getReasoningCapability, buildReasoningBody } from '../portal/agent/reasoning.js';
import { adaptProvider } from '../server/pi/provider-adapter.mjs';

async function fixture(t) {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-magpie-'));
    t.after(() => fs.rm(home, { recursive: true, force: true }));
    const file = managedPath(home); await fs.mkdir(path.dirname(file), { recursive: true });
    const config = { model: 'fixture/a', provider: 'magpie', managedBy: 'magpie', apiType: 'openai-responses', baseURL: 'http://127.0.0.1:3499/v1', apiKey: 'fixture-private-agent-key' };
    let catalog = [{ id: 'fixture/a', display_name: 'A', native_endpoints: ['/v1/responses'], reasoning: true,
        supported_reasoning_levels: [{ effort: 'high' }, { effort: 'ultra' }], modalities: { input: ['text', 'image'] }, context_window: 100000, max_output_tokens: 1000 },
        { id: 'fixture/b', display_name: 'B', native_endpoints: ['/v1/messages'], reasoning: false }];
    const calls = [];
    const bridge = new MagpieBridge({ home, fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return Response.json(url.endsWith('/api/hello') ? { name: 'magpie', version: 'fixture' } : { data: catalog });
    } });
    const write = async patch => { Object.assign(config, patch); await fs.writeFile(file, JSON.stringify(config)); };
    await write({}); await bridge.refresh();
    return { bridge, config, file, write, calls, setCatalog: value => { catalog = value; } };
}

test('fixed HOME anchor, safe status, exact model metadata and private owned-file permissions', async t => {
    const { bridge, config, file, calls } = await fixture(t);
    assert.equal(bridge.status().managed, true);
    assert.equal(bridge.status().defaultModel, 'fixture/a');
    assert.equal(JSON.stringify([bridge.status(), bridge.catalog()]).includes(config.apiKey), false);
    const provider = await bridge.resolve({ policy: 'follow', reasoningEffort: 'high' }, { permissionMode: 'default', maxTurns: 80, apiKey: 'ignored', model: 'ignored' });
    assert.equal(provider.model, 'fixture/a'); assert.equal(provider.apiKey, config.apiKey);
    assert.equal(provider.sdkOptions.permissionMode, 'default'); assert.equal(provider.sdkOptions.maxTurns, 80);
    assert.equal(provider.sdkOptions.apiKey, undefined); assert.equal(provider.sdkOptions.model, undefined);
    assert.equal(provider.modelCapabilities.input.includes('image'), true);
    const adapted = adaptProvider(provider);
    assert.equal(adapted.model.contextWindow, 100000); assert.equal(adapted.thinkingLevel, 'high');
    assert.deepEqual(buildReasoningBody(provider), { reasoning: { effort: 'high' } });
    assert.deepEqual(getReasoningCapability(provider).options.map(o => o.value), ['default', 'high']);
    assert.equal(calls[0].options.headers.Authorization, undefined);
    assert.equal(calls[1].options.redirect, 'error');
    if (process.platform !== 'win32') assert.equal((await fs.stat(file)).mode & 0o077, 0);
});

test('invalid, removed, unmanaged and symlink files never resolve stale credentials', async t => {
    const { bridge, file, write } = await fixture(t);
    const revision = bridge.revision;
    await fs.writeFile(file, '{'); await bridge.refresh();
    assert.equal(bridge.status().managed, false); assert.ok(bridge.revision > revision);
    assert.equal(bridge.status().lastGood.modelId, 'fixture/a');
    await assert.rejects(bridge.resolve({ policy: 'follow' }), /断开|未托管/);
    await write({}); await bridge.refresh(); assert.equal(bridge.status().managed, true);
    await fs.unlink(file); await bridge.refresh(); assert.equal(bridge.status().errorCode, 'not_registered');
    const other = file + '.other'; await fs.writeFile(other, '{}'); await fs.symlink(other, file);
    await bridge.refresh(); assert.equal(bridge.status().managed, false);
});

test('reject SSRF, redirect endpoints, inline credentials, oversized and unknown fields', async t => {
    for (const value of ['http://evil.test', 'http://127.0.0.1.evil.test/v1', 'https://127.0.0.1/v1', 'http://user@127.0.0.1/v1', 'http://127.0.0.1/v1?x=1', 'http://localhost/v1']) assert.throws(() => localGateway(value));
    const { bridge, write, calls } = await fixture(t);
    const before = calls.length; await write({ baseURL: 'http://example.com/v1' }); await bridge.refresh();
    assert.equal(bridge.status().managed, false);
    assert.ok(calls.slice(before).every(c => !c.options.headers.Authorization));
    await write({ baseURL: 'http://127.0.0.1:3499/v1', extra: 'refused' }); await bridge.refresh(); assert.equal(bridge.status().managed, false);
    assert.equal(normalizeModel({ id: 'x', context_window: -1 }).context, undefined);
});

test('follow, pinned, pending latest-only, immutable run identity and failed transaction rollback', async t => {
    const { bridge, write } = await fixture(t);
    const emitted = []; let fail = false;
    const gateway = { manager: { get: () => null }, ensure: async () => { if (fail) throw new Error('fixture failure'); }, dispose: async () => {} };
    const bindings = new ModelBindings({ bridge, gateway, persist: async () => {}, emit: (_, type, data) => emitted.push({ type, data }), resolveDirect: x => x });
    const session = { id: 'session', engineInfo: {}, providerConfig: { provider: 'custom', model: 'old', sdkOptions: { permissionMode: 'default', maxTurns: 8 } } };
    await bindings.apply(session, { kind: 'magpie', policy: 'follow', reasoningEffort: 'high' }, { expectedRevision: 0 });
    assert.equal(session.effectiveModel.modelId, 'fixture/a');
    const before = bindingView(session);
    await assert.rejects(bindings.apply(session, { kind: 'magpie', policy: 'follow' }, { expectedRevision: 0 }), e => e.status === 409);
    session.activeRun = { id: 'run-a', model: session.providerConfig.model };
    await write({ model: 'fixture/b' }); await bridge.refresh(); await bindings.reconcile(session);
    assert.equal(session.providerConfig.model, 'fixture/a'); assert.equal(session.pendingModelChange.modelId, 'fixture/b');
    await write({ model: 'fixture/a' }); await bridge.refresh(); await bindings.reconcile(session);
    assert.equal(session.pendingModelChange.modelId, 'fixture/a'); assert.equal(session.activeRun.model, 'fixture/a');
    await assert.rejects(bindings.apply(session, { kind: 'magpie', policy: 'follow' }), e => e.status === 409);
    session.activeRun = null; await bindings.reconcile(session); assert.equal(session.pendingModelChange, null);
    await bindings.apply(session, { kind: 'magpie', policy: 'pinned', pinnedModelId: 'fixture/a' });
    await write({ model: 'fixture/b' }); await bridge.refresh(); await bindings.reconcile(session);
    assert.equal(session.providerConfig.model, 'fixture/a');
    fail = true; const pinned = structuredClone(session.providerBinding);
    await assert.rejects(bindings.apply(session, { kind: 'magpie', policy: 'follow' }), /切换失败/);
    assert.deepEqual(session.providerBinding, pinned); assert.equal(session.providerConfig.model, 'fixture/a');
    fail = false; await bindings.apply(session, { kind: 'magpie', policy: 'follow' });
    assert.equal(session.providerBinding.reasoningEffort, 'default'); assert.equal(session.providerConfig.apiType, 'anthropic-messages');
    assert.equal(before.effectiveModel.modelId, 'fixture/a');
    assert.ok(emitted.every(e => !JSON.stringify(e).includes('fixture-private-agent-key')));
});

test('external revision during candidate startup is reconciled after commit without losing the latest model', async t => {
    const { bridge, write } = await fixture(t);
    let release, reached;
    const waiting = new Promise(resolve => { reached = resolve; });
    const gate = new Promise(resolve => { release = resolve; }); let first = true;
    const gateway = { manager: { get: () => null }, dispose: async () => {}, ensure: async () => { if (first) { first = false; reached(); await gate; } } };
    const bindings = new ModelBindings({ bridge, gateway, persist: async () => {}, emit: () => {}, resolveDirect: x => x });
    const session = { id: 'race', engineInfo: {}, providerConfig: { provider: 'direct', model: 'old', sdkOptions: {} } };
    const switching = bindings.apply(session, { kind: 'magpie', policy: 'follow' }); await waiting;
    await assert.rejects(bindings.apply(session, { kind: 'magpie', policy: 'follow' }), e => e.status === 409);
    await write({ model: 'fixture/b' }); await bridge.refresh(); await bindings.reconcile(session);
    release(); await switching;
    for (let i = 0; i < 100 && session.effectiveModel.modelId !== 'fixture/b'; i++) await new Promise(r => setTimeout(r, 10));
    assert.equal(session.effectiveModel.modelId, 'fixture/b');
    assert.equal(session.providerBinding.revision, bridge.revision);
});
