import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { piRuntime } from '../../scripts/pi-paths.mjs';
import { buildReasoningBody } from '../../portal/agent/reasoning.js';
import { normalizeToolSelection } from './tool-policy.mjs';

const supportedApis = new Set(['anthropic-messages', 'openai-completions', 'openai-responses', 'google-generative-ai']);
const thinkingLevels = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
// These fields are consumed by the Gateway or Extension, not passed into Pi's
// model config. Any unlisted meaningful SDK option is an explicit error.
const businessOptions = new Set(['permissionMode', 'maxTurns', 'allowedTools', 'disallowedTools', 'tools',
    'systemPrompt', 'appendSystemPrompt', 'persistSession', 'includePartialMessages',
    'enableFileCheckpointing', 'requestTimeoutMs', 'providerTimeoutMs', 'timeoutMs', 'timeout', 'mcpServers']);
const modelOptions = new Set(['apiType', 'model', 'apiKey', 'baseURL', 'maxTokens',
    'effort', 'reasoningEffort', 'thinking', 'maxThinkingTokens']);
const metadataFields = ['name', 'reasoning', 'input', 'inputLimits', 'cost', 'contextWindow', 'maxTokens',
    'thinkingLevelMap', 'promptCache', 'compat', 'samplingParams', 'samplingParamsByThinkingLevel'];

export function readPiModelCatalog(directory = path.join(piRuntime, 'node_modules/@earendil-works/pi-ai/dist/providers/data')) {
    const models = [];
    for (const filename of fs.readdirSync(directory).sort()) {
        if (!filename.endsWith('.json') || filename.startsWith('.')) continue;
        const groups = JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'));
        for (const group of Object.values(groups)) {
            for (const model of Object.values(group)) if (model.type === 'chat') models.push(model);
        }
    }
    return models;
}

export function adaptProvider(config, { catalog = [], capabilities = {} } = {}) {
    if (!supportedApis.has(config.apiType)) throw new Error(`Unsupported Pi provider API: ${config.apiType}`);
    if (!config.model || typeof config.model !== 'string') throw new Error('A model ID is required');
    const url = new URL(config.baseURL);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Provider base URL must be HTTP(S) without inline credentials');
    const options = config.sdkOptions || {};
    normalizeToolSelection(options.tools);
    for (const name of ['persistSession', 'includePartialMessages']) {
        if (options[name] !== undefined && typeof options[name] !== 'boolean') throw new Error(`${name} must be boolean`);
    }
    for (const [name, value] of Object.entries(options)) {
        if (value === undefined || value === null) continue;
        if (!businessOptions.has(name) && !modelOptions.has(name)) {
            throw new Error(`SDK option ${name} has no supported Pi mapping; remove it or migrate it to a Pi Extension`);
        }
    }
    const warnings = [];
    const candidates = catalog.filter(model => model.id === config.model && model.api === config.apiType);
    // Exact endpoint is the best evidence; otherwise preserve catalog capability
    // metadata for the same named model, but never copy its authentication/URL.
    const metadata = candidates.find(model => model.baseUrl?.replace(/\/$/, '') === config.baseURL.replace(/\/$/, '')) || candidates[0];
    if (!metadata) warnings.push('Model capabilities are not in the pinned Pi catalog; default text-only metadata applies unless explicitly configured.');
    const model = { id: config.model };
    for (const name of metadataFields) {
        if (metadata?.[name] !== undefined) model[name] = structuredClone(metadata[name]);
        if (capabilities[name] !== undefined) model[name] = structuredClone(capabilities[name]);
    }
    if (options.maxTokens !== undefined) {
        if (!Number.isInteger(options.maxTokens) || options.maxTokens < 1) throw new Error('maxTokens must be a positive integer');
        model.maxTokens = options.maxTokens;
    }
    const requested = options.reasoningEffort || options.effort || options.thinking?.type || options.thinking;
    if (options.thinking && typeof options.thinking === 'object') {
        const unknown = Object.keys(options.thinking).filter(key => !['type', 'budget_tokens', 'budgetTokens'].includes(key));
        if (unknown.length) throw new Error(`Unsupported thinking options: ${unknown.join(', ')}`);
    }
    let thinkingLevel;
    if (requested && requested !== 'default' && requested !== 'adaptive' && requested !== 'auto') {
        thinkingLevel = requested === 'enabled' ? 'high' : requested === 'disabled' ? 'off' : requested;
        if (!thinkingLevels.has(thinkingLevel)) throw new Error(`Unsupported Pi thinking level: ${requested}`);
        if (thinkingLevel !== 'off' && metadata?.reasoning === false && capabilities.reasoning !== true) {
            throw new Error(`Model ${config.model} does not support reasoning`);
        }
        model.reasoning = thinkingLevel !== 'off' || model.reasoning === true;
    }
    const settings = {};
    const thinkingBudget = options.maxThinkingTokens ?? options.thinking?.budget_tokens ?? options.thinking?.budgetTokens;
    if (thinkingBudget !== undefined) {
        if (!Number.isInteger(thinkingBudget) || thinkingBudget < 1) throw new Error('maxThinkingTokens must be a positive integer');
        settings.thinkingBudgets = Object.fromEntries(['minimal', 'low', 'medium', 'high'].map(level => [level, thinkingBudget]));
    }
    const timeout = options.providerTimeoutMs ?? options.requestTimeoutMs ?? options.timeoutMs ?? options.timeout;
    if (timeout !== undefined) {
        if (!Number.isFinite(timeout) || timeout < 1) throw new Error('Provider timeout must be positive milliseconds');
        settings.httpIdleTimeoutMs = timeout;
        settings.retry = { provider: { timeoutMs: timeout } };
    }
    if (options.permissionMode === 'dontAsk') warnings.push('dontAsk denies unapproved high-risk operations; it no longer automatically allows them.');
    if (options.permissionMode === 'plan') warnings.push('plan retains Prota compatibility behavior and uses default approvals.');
    if (options.includePartialMessages === false) warnings.push('Partial assistant display is disabled; Pi still streams internally.');
    const providerId = `prota-${createHash('sha256').update(String(config.provider || 'custom')).digest('hex').slice(0, 16)}`;
    const models = [model];
    for (const id of new Set(config.models || [])) {
        if (typeof id !== 'string' || id === model.id) continue;
        const alternative = adaptProvider({ ...config, model: id, models: [], sdkOptions: {
            ...options, model: id, reasoningEffort: undefined, effort: undefined, thinking: undefined
        } }, { catalog });
        models.push(alternative.model);
    }
    return { providerId, model, thinkingLevel, settings, warnings,
        reasoningBody: buildReasoningBody(config),
        models: { providers: { [providerId]: { baseUrl: config.baseURL, api: config.apiType,
            apiKey: '$PROTA_PI_API_KEY', models } } } };
}

export function isolatedPiEnvironment(configDirectory, apiKey, source = process.env) {
    const env = {};
    for (const name of ['PATH', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'XDG_CACHE_HOME',
        'PLAYWRIGHT_BROWSERS_PATH', 'TMP', 'TEMP', 'TMPDIR', 'SystemRoot', 'WINDIR',
        'COMSPEC', 'PATHEXT', 'LANG', 'LC_ALL', 'TERM', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
        'http_proxy', 'https_proxy', 'no_proxy', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS']) {
        if (source[name]) env[name] = source[name];
    }
    return { ...env, PI_CODING_AGENT_DIR: configDirectory, PI_OFFLINE: '1', PI_TELEMETRY: '0', PROTA_PI_API_KEY: apiKey || '' };
}

export function prepareProviderDirectory(directory, config, options = {}) {
    const adapted = adaptProvider(config, options);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    for (const [name, value] of [['models.json', adapted.models], ['settings.json', adapted.settings]]) {
        const filename = path.join(directory, name);
        const temporary = `${filename}.next`;
        fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
        fs.renameSync(temporary, filename);
    }
    return { ...adapted, env: isolatedPiEnvironment(directory, config.apiKey) };
}

export function assertImageInput(model, images = []) {
    if (images.length && !model.input?.includes('image')) {
        throw new Error(`Model ${model.id} does not declare image input support; select a vision model or configure verified capabilities`);
    }
}
