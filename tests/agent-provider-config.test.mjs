import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../portal/agent/provider-config.js', import.meta.url), 'utf8');

function createStore() {
    const storage = new Map();
    const sandbox = {
        console,
        Date,
        JSON,
        Math,
        Set,
        globalThis: null,
        window: {}
    };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(source, sandbox);
    const Store = sandbox.window.AgentProviderConfigStore;
    const presets = vm.runInNewContext('AGENT_PROVIDER_PRESET_FALLBACK', sandbox);
    const store = new Store({
        presets,
        readStorage: (key, fallback) => storage.has(key) ? storage.get(key) : fallback,
        writeStorage: (key, value) => storage.set(key, value)
    });
    return { store, presets };
}

test('同一服务商模板可以保存为多个独立模型配置', () => {
    const { store } = createStore();
    const first = store.createFromPreset('zhipu-anthropic');
    store.updateSelectedProvider({ model: 'glm-5-turbo' });
    const second = store.createFromPreset('zhipu-anthropic');
    store.updateSelectedProvider({ model: 'glm-5.1' });

    assert.notEqual(first.id, second.id);
    assert.equal(store.providers.length, 2);
    assert.equal(store.providers[0].presetId, 'zhipu-anthropic');
    assert.equal(store.providers[1].presetId, 'zhipu-anthropic');
    assert.equal(store.providers[0].model, 'glm-5-turbo');
    assert.equal(store.providers[1].model, 'glm-5.1');

    store.activateProvider(first.id);
    assert.equal(store.buildConfig().model, 'glm-5-turbo');
    store.activateProvider(second.id);
    assert.equal(store.buildConfig().model, 'glm-5.1');
});

test('同模板配置不共享可变的 SDK options 和模型列表', () => {
    const { store } = createStore();
    const first = store.createFromPreset('zhipu-anthropic');
    const second = store.createFromPreset('zhipu-anthropic');

    first.sdkOptions.permissionMode = 'plan';
    first.models.push('glm-private');

    assert.equal(second.sdkOptions.permissionMode, 'default');
    assert.equal(second.models.includes('glm-private'), false);
});

test('导入重复实例 ID 时自动重建唯一 ID，避免编辑时命中第一条', () => {
    const { store } = createStore();
    store.replaceState({
        providers: [
            { id: 'custom:duplicate', label: '智谱 A', presetId: 'zhipu-anthropic', model: 'glm-5-turbo' },
            { id: 'custom:duplicate', label: '智谱 B', presetId: 'zhipu-anthropic', model: 'glm-5.1' }
        ],
        activeProviderId: 'custom:duplicate',
        selectedProviderId: 'custom:duplicate'
    });

    assert.equal(store.providers.length, 2);
    assert.notEqual(store.providers[0].id, store.providers[1].id);
    store.selectProvider(store.providers[1].id);
    store.updateSelectedProvider({ model: 'glm-5.2' });
    assert.equal(store.providers[0].model, 'glm-5-turbo');
    assert.equal(store.providers[1].model, 'glm-5.2');
});

test('保存拉取的模型目录及新模板关联，重新载入后保持一致', () => {
    const { store } = createStore();
    store.createFromPreset('zhipu-anthropic');
    const saved = store.updateSelectedProvider({ presetId: 'anthropic', models: ['new-model'], model: 'keep-selected' });
    assert.equal(saved.presetId, 'anthropic');
    assert.deepEqual([...saved.models], ['new-model']);
    assert.ok(store.getModelOptions(saved).includes('new-model'));
    assert.ok(store.getModelOptions(saved).includes('keep-selected'));
    assert.equal(store.getModelOptions(saved)[0], store.getPreset('anthropic').models[0]);
    const { store: reloaded } = createStore();
    reloaded.replaceState(JSON.parse(JSON.stringify(store.exportState())));
    assert.deepEqual([...reloaded.getSelectedProvider().models], ['new-model']);
});


test('已有旧模型列表不会遮蔽更新后的服务商模板', () => {
    const { store, presets } = createStore();
    const provider = store.createFromPreset('zhipu-anthropic');
    provider.models = ['glm-4.7'];
    provider.model = 'glm-4.7';
    store.setPresets({ ...presets, providers: presets.providers.map(p => p.id === 'zhipu-anthropic' ? { ...p, models: ['new-flagship'], defaultModel: 'new-flagship' } : p) });
    assert.deepEqual([...store.getModelOptions(provider)], ['new-flagship', 'glm-4.7']);
    assert.equal(provider.model, 'glm-4.7');
    assert.equal(store.buildProviderFromPreset(store.getPreset('zhipu-anthropic')).model, 'new-flagship');
});


test('旧 Plan 设置迁移为执行模式，思考强度保持独立持久化', () => {
    const { store } = createStore();
    store.replaceState({ providers: [{ id: 'legacy', model: 'glm-5.3', sdkOptions: { planMode: true, permissionMode: 'plan', reasoningEffort: 'high', maxTurns: 50 } }], activeProviderId: 'legacy' });
    const options = store.buildConfig().sdkOptions;
    assert.equal('planMode' in options, false);
    assert.equal(options.permissionMode, 'default');
    assert.equal(options.reasoningEffort, 'high');
    assert.equal(options.maxTurns, 50);
    const { store: reloaded } = createStore();
    reloaded.replaceState(JSON.parse(JSON.stringify(store.exportState())));
    assert.equal(reloaded.buildConfig().sdkOptions.reasoningEffort, 'high');
});
