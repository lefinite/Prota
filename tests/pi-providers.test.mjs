import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adaptProvider, isolatedPiEnvironment, prepareProviderDirectory, readPiModelCatalog,
    assertImageInput } from '../server/pi/provider-adapter.mjs';

const presets = JSON.parse(fs.readFileSync(new URL('../data/agent-provider-presets.json', import.meta.url), 'utf8'));
const catalog = readPiModelCatalog();
const base = { provider: 'custom', apiType: 'openai-completions', model: 'test-model', baseURL: 'http://127.0.0.1/v1', apiKey: 'private-key' };

test('every configured provider preset maps its existing protocol and endpoint', () => {
    for (const preset of presets.providers) {
        const config = { ...preset, provider: preset.id, model: preset.defaultModel || 'manual-model', apiKey: 'private-key', sdkOptions: preset.sdkDefaults };
        const adapted = adaptProvider(config, { catalog });
        const provider = adapted.models.providers[adapted.providerId];
        assert.equal(provider.api, preset.apiType);
        assert.equal(provider.baseUrl, preset.baseURL);
        assert.equal(provider.apiKey, '$PROTA_PI_API_KEY');
        assert.equal(provider.models[0].id, config.model);
        assert.ok(!JSON.stringify(adapted).includes('private-key'));
    }
});

test('provider conversion preserves known model capabilities and maps token/time limits', () => {
    const adapted = adaptProvider({ ...base, model: 'claude-fable-5', apiType: 'anthropic-messages', baseURL: 'https://api.anthropic.com',
        sdkOptions: { maxTokens: 4096, reasoningEffort: 'high', providerTimeoutMs: 120000, maxThinkingTokens: 2048 } }, { catalog });
    assert.ok(adapted.model.input.includes('image'));
    assert.equal(adapted.model.reasoning, true);
    assert.equal(adapted.model.maxTokens, 4096);
    assert.equal(adapted.thinkingLevel, 'high');
    assert.equal(adapted.settings.retry.provider.timeoutMs, 120000);
    assert.equal(adapted.settings.thinkingBudgets.high, 2048);
});

test('GLM vision input survives a custom Anthropic-compatible endpoint', () => {
    const adapted = adaptProvider({ ...base, model: 'glm-5.3-flash', apiType: 'anthropic-messages' }, { catalog });
    assert.doesNotThrow(() => assertImageInput(adapted.model, [{ data: 'image' }]));
    const provider = adapted.models.providers[adapted.providerId];
    assert.equal(provider.api, 'anthropic-messages');
    assert.equal(provider.baseUrl, base.baseURL);
    assert.equal(adapted.model.compat, undefined, 'Do not inherit protocol-specific metadata');
});

test('cross-API input inference respects ambiguity, exact API entries and explicit overrides', () => {
    const config = { ...base, apiType: 'anthropic-messages' };
    const vision = { id: base.model, api: 'openai-completions', input: ['text', 'image'], compat: { unsupported: true } };
    const text = { id: base.model, api: 'openai-responses', input: ['text'] };
    const conflicting = [vision, text];
    assert.throws(() => assertImageInput(adaptProvider(config, { catalog: conflicting }).model, [{}]), /image input support/);
    const exact = [...conflicting, { ...text, api: config.apiType }];
    assert.throws(() => assertImageInput(adaptProvider(config, { catalog: exact }).model, [{}]), /image input support/);
    const overridden = adaptProvider(config, { catalog: exact, capabilities: { input: ['text', 'image'] } });
    assert.doesNotThrow(() => assertImageInput(overridden.model, [{}]));
    const disabled = adaptProvider(config, { catalog: [vision], capabilities: { input: ['text'] } });
    assert.throws(() => assertImageInput(disabled.model, [{}]), /image input support/);
});

test('unsupported meaningful options cause an explicit configuration error', () => {
    for (const key of ['maxBudgetUsd', 'fallbackModel', 'sandbox', 'agents', 'extraArgs', 'env', 'hooks', 'canUseTool']) {
        assert.throws(() => adaptProvider({ ...base, sdkOptions: { [key]: {} } }), new RegExp(key));
    }
    assert.throws(() => adaptProvider({ ...base, sdkOptions: { maxTokens: -1 } }), /maxTokens/);
    for (const key of ['persistSession', 'includePartialMessages']) assert.throws(() => adaptProvider({ ...base, sdkOptions: { [key]: 'false' } }), /boolean/);
    assert.throws(() => adaptProvider({ ...base, sdkOptions: { reasoningEffort: 'unknown' } }), /thinking/);
    assert.throws(() => adaptProvider({ ...base, sdkOptions: { thinking: { type: 'enabled', unsupported: true } } }), /Unsupported thinking/);
    assert.equal(adaptProvider({ ...base, sdkOptions: { thinking: { type: 'enabled', budget_tokens: 1024 } } }).settings.thinkingBudgets.high, 1024);
    assert.throws(() => adaptProvider({ ...base, baseURL: 'https://user:secret@example.test/v1' }), /inline credentials/);
});

test('provider compatibility notices explicitly describe changed dontAsk semantics', () => {
    const adapted = adaptProvider({ ...base, sdkOptions: { permissionMode: 'dontAsk' } });
    assert.ok(adapted.warnings.some(warning => warning.includes('no longer automatically allows')));
    assert.throws(() => assertImageInput(adapted.model, [{ data: 'image' }]), /image input support/);
    const vision = adaptProvider(base, { capabilities: { input: ['text', 'image'] } });
    assert.doesNotThrow(() => assertImageInput(vision.model, [{ data: 'image' }]));
});

test('runtime credentials are isolated in environment and never written into model/settings files', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prota-pi-provider-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const adapted = prepareProviderDirectory(directory, base);
    assert.equal(adapted.env.PROTA_PI_API_KEY, 'private-key');
    for (const filename of fs.readdirSync(directory)) assert.ok(!fs.readFileSync(path.join(directory, filename), 'utf8').includes('private-key'));
    const env = isolatedPiEnvironment(directory, 'session-key', { PATH: '/bin', HOME: '/home', ANTHROPIC_API_KEY: 'other-provider-key',
        OPENAI_API_KEY: 'other-key', NODE_OPTIONS: '--require untrusted.js', SECRET_PASSWORD: 'secret' });
    assert.deepEqual(Object.keys(env).sort(), ['HOME', 'PATH', 'PI_CODING_AGENT_DIR', 'PI_OFFLINE', 'PI_TELEMETRY', 'PROTA_PI_API_KEY'].sort());
    const browserEnv = isolatedPiEnvironment(directory, 'session-key', { PLAYWRIGHT_BROWSERS_PATH: '/bundled/browsers',
        LOCALAPPDATA: 'C:/Users/test/AppData/Local', UNRELATED_API_KEY: 'must-not-leak' });
    assert.equal(browserEnv.PLAYWRIGHT_BROWSERS_PATH, '/bundled/browsers');
    assert.equal(browserEnv.LOCALAPPDATA, 'C:/Users/test/AppData/Local');
    assert.equal(browserEnv.UNRELATED_API_KEY, undefined);
});

test('provider conversion keeps each provider ID stable while credentials remain per session', () => {
    assert.equal(adaptProvider(base).providerId, adaptProvider({ ...base, apiKey: 'next-key' }).providerId);
    assert.notEqual(adaptProvider(base).providerId, adaptProvider({ ...base, provider: 'another' }).providerId);
});
