import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProtaPiGateway } from '../server/pi/gateway-adapter.mjs';
import { synchronizeEngineInfo } from '../server/pi/session-adapter.mjs';

test('same-provider model switch uses Pi RPC in the existing process; endpoint change safely rebuilds', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-pi-switch-'));
    const gateway = new ProtaPiGateway({ workspaceRoot: () => root, configDirectory: path.join(root, 'config') });
    t.after(async () => {
        await gateway.manager.disposeAll();
        await fs.rm(root, { recursive: true, force: true });
    });
    const session = { id: 'test-session', providerConfig: { provider: 'custom', apiType: 'openai-completions',
        model: 'one', models: ['one', 'two'], apiKey: 'local-test-only', baseURL: 'http://127.0.0.1:9/v1', sdkOptions: {} } };
    const first = (await gateway.ensure(session)).runtime;
    assert.equal(first.config.env.READIFY_WORKSPACE, root);
    assert.equal(first.config.env.READIFY_CONFIG_DIR, path.join(root, 'config'));
    const id = session.engineInfo.piSessionId;
    session.providerConfig.model = 'two';
    const second = (await gateway.ensure(session)).runtime;
    assert.equal(second.child.pid, first.child.pid);
    assert.equal((await second.rpc.request('get_state')).model.id, 'two');
    session.providerConfig.baseURL = 'http://127.0.0.1:10/v1';
    const third = (await gateway.ensure(session)).runtime;
    assert.notEqual(third.child.pid, first.child.pid);
    assert.equal(session.engineInfo.piSessionId, id);
    await gateway.clear(session);
    assert.notEqual(session.engineInfo.piSessionId, id);
    assert.equal(session.engineInfo.migrationStatus, 'native');
});

test('workspace, persistence and loaded model catalog changes cannot reuse an incompatible Pi process', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-pi-config-scope-'));
    let workspace = path.join(root, 'one');
    await fs.mkdir(workspace); await fs.mkdir(path.join(root, 'two'));
    const gateway = new ProtaPiGateway({ workspaceRoot: () => workspace, configDirectory: path.join(root, 'config') });
    t.after(async () => { await gateway.manager.disposeAll(); await fs.rm(root, { recursive: true, force: true }); });
    const session = { id: 'scope-session', providerConfig: { provider: 'custom', apiType: 'openai-completions', model: 'one',
        models: ['one'], apiKey: 'local-test-only', baseURL: 'http://127.0.0.1:9/v1', sdkOptions: {} } };
    const first = (await gateway.ensure(session)).runtime;
    const firstConfig = first.config.paths.config;
    session.providerConfig.models.push('two');
    const catalog = (await gateway.ensure(session)).runtime;
    assert.notEqual(catalog.child.pid, first.child.pid);
    assert.ok((await catalog.rpc.request('get_available_models')).models.some(model => model.id === 'two'));
    session.providerConfig.model = 'two';
    assert.equal((await gateway.ensure(session)).runtime.child.pid, catalog.child.pid);
    session.providerConfig.sdkOptions.persistSession = false;
    const ephemeral = (await gateway.ensure(session)).runtime;
    assert.notEqual(ephemeral.child.pid, catalog.child.pid);
    assert.ok(ephemeral.config.args.includes('--no-session'));
    session.engineInfo.piSessionFile = 'previous-persistent-session.jsonl';
    await synchronizeEngineInfo(session, ephemeral);
    assert.equal(session.engineInfo.piSessionFile, undefined);
    workspace = path.join(root, 'two');
    const moved = (await gateway.ensure(session)).runtime;
    assert.notEqual(moved.child.pid, ephemeral.child.pid);
    assert.equal(moved.config.cwd, workspace);
    assert.equal(moved.config.env.READIFY_WORKSPACE, workspace);
    assert.notEqual(moved.config.paths.config, firstConfig);
});
