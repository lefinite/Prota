import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { modelEndpoints, discoverProviderModels } from '../server/provider-models.mjs';
const config = { baseURL: 'https://example.com/anthropic/', apiKey: 'test-key', apiType: 'anthropic-messages' };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('兼容路径、完整推理地址、v4 地址保持正确的目录层级', () => {
    assert.deepEqual(modelEndpoints(config), ['https://example.com/anthropic/v1/models','https://example.com/anthropic/models','https://example.com/v1/models','https://example.com/models']);
    assert.equal(modelEndpoints({ baseURL:'https://example.com/api/coding/paas/v4' })[0], 'https://example.com/api/coding/paas/v4/models');
    assert.equal(modelEndpoints({ baseURL:'https://example.com/v1/chat/completions' })[0], 'https://example.com/v1/models');
});

test('模板的精确模型地址不会把自定义网关 Key 发往官网', () => {
    const preset = { baseURL:'https://official.com/anthropic', modelsPath:'/models' };
    assert.equal(modelEndpoints({ baseURL:preset.baseURL }, preset)[0], 'https://official.com/models');
    assert.ok(modelEndpoints(config, preset).every(url => new URL(url).origin === 'https://example.com'));
    assert.throws(() => modelEndpoints(config, {baseURL:config.baseURL, modelsPath:'https://other.com/models'}));
});

test('仅 404/405 尝试下个地址，保留鉴权和限流错误', async () => {
    const calls = [];
    const result = await discoverProviderModels(config, {}, async (url, options) => {
        calls.push(url);
        assert.equal(options.headers.Authorization, 'Bearer test-key');
        assert.equal(options.headers['x-api-key'], 'test-key');
        assert.equal(options.redirect, 'error');
        return calls.length < 3 ? response({}, 404) : response({data:[{id:'new-model'}, {id:'new-model'},'other']});
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.models, ['new-model','other']);
    for (const status of [401,403,429,500]) {
        let count = 0;
        const failed = await discoverProviderModels(config, {}, async () => { count++; return response({}, status); });
        assert.equal(failed.ok, false); assert.equal(count, 1); assert.equal(failed.httpStatus, status);
    }
});

test('Anthropic 使用原生鉴权并完整获取分页', async () => {
    const calls = [];
    const result = await discoverProviderModels({...config,baseURL:'https://api.anthropic.com'}, {}, async (url, options) => {
        calls.push(url); assert.equal(options.headers.Authorization, undefined);
        return calls.length === 1 ? response({data:[{id:'first'}],has_more:true,last_id:'first'}) : response({data:[{id:'last'}],has_more:false});
    });
    assert.deepEqual(result.models, ['first','last']);
    assert.equal(new URL(calls[1]).searchParams.get('after_id'), 'first');
});

test('HTML、错误结构、重复分页、超时不伪装为成功', async () => {
    for (const fetcher of [async()=>new Response('<html>bad</html>'),async()=>response({error:'bad'}),async()=>response({data:[{id:'a'}],has_more:true,last_id:'a'}),async()=>{throw new DOMException('timeout','TimeoutError');}]) {
        assert.equal((await discoverProviderModels(config, {}, fetcher)).ok, false);
    }
});

test('模板 JSON 与离线回退同步', () => {
    const source = readFileSync(new URL('../portal/agent/provider-config.js',import.meta.url),'utf8');
    const sandbox = {window:{}}; vm.runInNewContext(source, sandbox);
    const fallback = vm.runInNewContext('AGENT_PROVIDER_PRESET_FALLBACK', sandbox);
    assert.deepEqual(JSON.parse(JSON.stringify(fallback)), JSON.parse(readFileSync(new URL('../data/agent-provider-presets.json',import.meta.url),'utf8')));
});

const shellSource = readFileSync(new URL('../portal/shell.js',import.meta.url),'utf8');
const fetchMethod = shellSource.slice(shellSource.indexOf('    async fetchAgentModels()'),shellSource.indexOf('\n    clearIframeSelection()'));
const fetchModels = vm.runInNewContext(`({${fetchMethod}}).fetchAgentModels`);
function editor(api) {
    const target = {id:'draft',model:'keep-model',models:['old-model']};
    const form = {...config};
    return { target, form, agentApi:{fetchModels:api}, getSelectedProvider(){return this.target;},getAgentConfigDraft(){return {...this.form};},
        getAgentModelFormValue(){return this.target.model;}, unifiedSettings:{userTouched:new Set(),refreshDirty(){}},renderAgentControls(){},renderAgentModelPicker(){},showToast(){} };
}
test('拉取更新草稿，保留选中模型，切换期间不污染新配置', async () => {
    const view = editor(async()=>({ok:true,models:['new-model']}));
    await fetchModels.call(view);
    assert.equal(view.target.model,'keep-model'); assert.deepEqual([...view.target.models],['new-model']);
    assert.equal(view.unifiedSettings.userTouched.has('models'),true);
    let done; const switching = editor(()=>new Promise(resolve=>{done=resolve;}));
    const pending=fetchModels.call(switching); switching.target={model:'another',models:['another']};
    done({ok:true,models:['wrong']});await pending;
    assert.deepEqual(switching.target.models,['another']);
    const failed=editor(async()=>{throw new Error('bad');}); await fetchModels.call(failed);
    assert.deepEqual(failed.target.models,['old-model']);
});
