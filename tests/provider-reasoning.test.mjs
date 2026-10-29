import test from 'node:test';
import assert from 'node:assert/strict';
import { getReasoningCapability, getReasoningSelection, buildReasoningBody } from '../portal/agent/reasoning.js';
const glm = { apiType: 'anthropic-messages', baseURL: 'https://open.bigmodel.cn/api/anthropic', model: 'glm-5.3', sdkOptions: { reasoningEffort: 'high' } };
const mimo = { ...glm, baseURL: 'https://token-plan-cn.xiaomimimo.com/anthropic', model: 'mimo-v2.5-pro' };

test('actual saved model families expose only supported controls', () => {
    for (const model of ['glm-5.3', 'glm-5.3-flash']) {
        assert.deepEqual(getReasoningCapability({ ...glm, model }).options.map(x => x.value), ['default', 'low', 'high', 'max']);
    }
    assert.deepEqual(getReasoningCapability(mimo).options.map(x => x.value), ['default', 'enabled', 'disabled']);
    assert.deepEqual(buildReasoningBody(mimo), {}, 'a stale high choice must not invent MiMo strength');
    assert.deepEqual(buildReasoningBody({ ...mimo, sdkOptions: { reasoningEffort: 'disabled' } }), { thinking: { type: 'disabled' } });
    assert.equal(getReasoningSelection({ ...glm, sdkOptions: { reasoningEffort: 'none' } }).value, 'default');
});
test('unknown gateway or model never inherits capability from a protocol or preset', () => {
    for (const change of [{ baseURL: 'https://gateway.example/v1' }, { baseURL: 'https://open.bigmodel.cn.evil.example/' }, { model: 'glm-5.3-flashx' }, { apiType: 'responses' }]) {
        assert.deepEqual(buildReasoningBody({ ...glm, ...change }), {});
        assert.equal(getReasoningCapability({ ...glm, ...change }).options.length, 1);
    }
});
test('protocol-specific effort body and default omission', () => {
    assert.deepEqual(buildReasoningBody(glm), { thinking: { type: 'enabled' }, reasoning_effort: 'high' });
    const config = { ...glm, baseURL: 'https://api.deepseek.com/anthropic', model: 'deepseek-v4-pro' };
    assert.deepEqual(buildReasoningBody(config), { output_config: { effort: 'high' } });
    assert.deepEqual(buildReasoningBody({ ...config, apiType: 'openai-completions' }), { reasoning_effort: 'high' });
    assert.deepEqual(buildReasoningBody({ ...glm, sdkOptions: {} }), {});
});
