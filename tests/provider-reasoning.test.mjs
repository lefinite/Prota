import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgent } from '@codeany/open-agent-sdk';
import { getReasoningCapability, getReasoningSelection, buildReasoningBody } from '../portal/agent/reasoning.js';
import { patchProviderReasoning } from '../server/provider-reasoning.mjs';
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
test('real SDK Anthropic provider transmits choice without changing messages or tools', async () => {
    let config = glm, request;
    const agent = createAgent({ apiType: glm.apiType, model: glm.model, apiKey: 'test-only', persistSession: false });
    agent.provider.client.messages.create = async (body, options) => {
        request = { body, options };
        return { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } };
    };
    patchProviderReasoning(agent.provider, () => config);
    const params = { model: glm.model, maxTokens: 1024, system: 'test', messages: [{ role: 'user', content: 'hi' }], tools: [{ name: 'test' }] };
    for await (const event of agent.query('hi', { tools: [], maxTurns: 1 })) { /* exercise the SDK engine as well */ }
    assert.equal(request.body.reasoning_effort, 'high');
    await agent.provider.createMessage(params);
    assert.deepEqual(request.body.messages, params.messages);
    assert.deepEqual(request.body.tools, params.tools);
    config = { ...mimo, sdkOptions: { reasoningEffort: 'disabled' } };
    await agent.provider.createMessage({ ...params, model: config.model });
    assert.deepEqual(request.body.thinking, { type: 'disabled' });
    assert.equal('reasoning_effort' in request.body, false);
    config = { ...glm, sdkOptions: {} };
    await agent.provider.createMessage(params);
    assert.equal('reasoning_effort' in request.body, false);
    await agent.close();
});
test('OpenAI wire fields, reasoning round-trip, error propagation, and per-instance isolation', async () => {
    const config = { ...glm, apiType: 'openai-completions' };
    const agent = createAgent({ apiType: config.apiType, baseURL: 'https://open.bigmodel.cn/api/paas/v4', apiKey: 'test-only', persistSession: false });
    let body, fail = false;
    patchProviderReasoning(agent.provider, () => config, async (url, request) => {
        body = JSON.parse(request.body);
        if (fail) return new Response('invalid effort', { status: 400 });
        return Response.json({ choices: [{ message: { content: 'ok', reasoning_content: 'opaque reasoning' }, finish_reason: 'stop' }] });
    });
    const params = { model: config.model, maxTokens: 1024, system: 'test', messages: [{ role: 'user', content: 'hi' }] };
    const response = await agent.provider.createMessage(params);
    assert.equal(body.reasoning_effort, 'high');
    assert.equal(response.content[0].type, 'thinking');
    const messages = agent.provider.convertMessages('', [{ role: 'assistant', content: response.content }]);
    assert.equal(messages[0].reasoning_content, 'opaque reasoning');
    const second = createAgent({ apiType: config.apiType, apiKey: 'test-only', persistSession: false });
    assert.equal(second.provider.__protaReasoningPatched, undefined);
    fail = true;
    await assert.rejects(agent.provider.createMessage(params), error => error.status === 400);
    await agent.close(); await second.close();
});
