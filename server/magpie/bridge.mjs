import fs from 'node:fs/promises';
import { constants, watch } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';

export const MAGPIE_ID = 'integration:magpie';
export const managedPath = (home = os.homedir()) => path.join(home, '.config/prota/magpie-agent.json');
export const magpieError = (code, message, status = 503) => Object.assign(new Error(message), { code, classification: code, status });
const levels = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);

export function localGateway(value) {
    let url;
    try { url = new URL(value); } catch { throw magpieError('invalid_config', 'Magpie 网关地址无效。'); }
    if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !['/', '/v1'].includes(url.pathname)) {
        throw magpieError('invalid_config', 'Magpie 只允许本机 loopback HTTP 网关。');
    }
    return url.origin;
}

export function normalizeModel(raw) {
    if (!raw || typeof raw.id !== 'string' || !raw.id.trim() || raw.id.length > 500) return null;
    const efforts = [...new Set((raw.supported_reasoning_levels || raw.reasoning_levels || []).map(v => typeof v === 'string' ? v : v?.effort).filter(v => levels.has(v)))];
    const input = Array.isArray(raw.modalities?.input) ? raw.modalities.input.filter(v => ['text', 'image'].includes(v)) : undefined;
    const positive = v => Number.isSafeInteger(v) && v > 0 ? v : undefined;
    return { id: raw.id, name: typeof raw.display_name === 'string' ? raw.display_name.slice(0, 300) : raw.id,
        ownedBy: typeof raw.owned_by === 'string' ? raw.owned_by : undefined,
        reasoning: typeof raw.reasoning === 'boolean' ? raw.reasoning : undefined,
        efforts: raw.reasoning === true ? efforts : [], input, images: input ? input.includes('image') : undefined,
        context: positive(raw.context_window), output: positive(raw.max_output_tokens),
        nativeEndpoints: Array.isArray(raw.native_endpoints) ? raw.native_endpoints.filter(v => typeof v === 'string') : [] };
}
export function modelProtocol(model) {
    const native = model.nativeEndpoints || [];
    return native.includes('/v1/responses') ? 'openai-responses' : native.includes('/v1/messages') ? 'anthropic-messages'
        : native.includes('/v1/chat/completions') ? 'openai-completions' : 'openai-responses';
}
export function modelCapabilities(model) {
    const capabilities = { name: model.name, reasoning: model.reasoning === true, efforts: model.efforts };
    if (model.input) capabilities.input = model.input;
    if (model.context) capabilities.contextWindow = model.context;
    if (model.output) capabilities.maxTokens = model.output;
    return capabilities;
}

// Never return configuration/key through status, events, models, errors or logs.
export class MagpieBridge extends EventEmitter {
    constructor({ home = os.homedir(), fetchImpl = fetch, intervalMs = 1000, cacheMs = 20000 } = {}) {
        super(); this.home = home; this.file = managedPath(home); this.fetch = fetchImpl;
        this.intervalMs = intervalMs; this.cacheMs = cacheMs; this.revision = 0; this.models = [];
        this.state = { found: false, gatewayOnline: false, registered: false, managed: false, revision: 0, errorCode: null };
    }
    status() { return structuredClone(this.state); }
    catalog() { return { revision: this.revision, models: structuredClone(this.models), stale: !this.state.managed }; }
    async json(url, key) {
        const response = await this.fetch(url, { redirect: 'error', signal: AbortSignal.timeout(2500), headers: key ? { Authorization: `Bearer ${key}` } : {} });
        if (!response.ok) throw magpieError(response.status === 401 || response.status === 403 ? 'unauthorized' : 'gateway_unavailable', 'Magpie 请求失败，请检查网关与授权。');
        const reader = response.body.getReader(); let size = 0; const chunks = [];
        try {
            for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
                if (size > 4 * 1024 * 1024) throw magpieError('invalid_response', 'Magpie 响应超过大小限制。'); chunks.push(Buffer.from(value)); }
        } finally { await reader.cancel().catch(() => {}); }
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    async readManaged() {
        const directory = path.dirname(this.file);
        if (await fs.realpath(directory) !== path.join(await fs.realpath(this.home), '.config/prota')) throw magpieError('invalid_config', 'Magpie 配置目录不允许符号链接。');
        const fileInfo = await fs.lstat(this.file);
        if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) throw magpieError('invalid_config', 'Magpie 配置文件不允许符号链接。');
        const handle = await fs.open(this.file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
        try {
            const stat = await handle.stat();
            if (!stat.isFile() || stat.ino !== fileInfo.ino || stat.dev !== fileInfo.dev || stat.size > 32768 || (process.getuid && stat.uid !== process.getuid())) throw magpieError('invalid_config', 'Magpie 配置文件大小、所有者或类型无效。');
            const raw = JSON.parse(await handle.readFile('utf8'));
            if (!raw || raw.managedBy !== 'magpie') throw magpieError('not_managed', 'Prota 未由 Magpie 管理，请在 Agents → Prota 中选择模型。');
            const allowed = ['managedBy', 'provider', 'model', 'apiType', 'baseURL', 'apiKey'];
            if (Object.keys(raw).some(k => !allowed.includes(k)) || raw.provider !== 'magpie' || typeof raw.model !== 'string' || !raw.model.trim() || raw.model.length > 500
                || typeof raw.apiKey !== 'string' || !raw.apiKey.trim() || raw.apiKey.length > 10000 || !['openai-responses', 'anthropic-messages', 'openai-completions'].includes(raw.apiType)) {
                throw magpieError('invalid_config', 'Magpie 托管配置格式无效，请重新连接插件。');
            }
            const origin = localGateway(raw.baseURL);
            if (raw.baseURL !== origin + (raw.apiType === 'anthropic-messages' ? '' : '/v1')) throw magpieError('invalid_config', 'Magpie 协议与网关路径不匹配。');
            // Magpie currently creates 0644 files. Tighten only this owned, validated inode;
            // never rewrite its contents or follow symlinks. No key is exposed to Portal.
            if (process.platform !== 'win32' && (stat.mode & 0o077)) await handle.chmod(0o600);
            return { ...raw, origin };
        } finally { await handle.close(); }
    }
    refresh({ force = false } = {}) {
        if (this.refreshing) return this.refreshing.then(() => force ? this.refresh({ force: true }) : this.status());
        this.refreshing = this.readState(force).finally(() => { this.refreshing = null; });
        return this.refreshing;
    }
    async readState(force) {
        let config, found = false, version, online = false, errorCode = null;
        try {
            config = await this.readManaged();
            const hello = await this.json(config.origin + '/api/hello');
            if (hello.name !== 'magpie') throw magpieError('invalid_gateway', '本机服务不是 Magpie。');
            found = online = true; version = String(hello.version || '').slice(0, 80);
            const signature = createHash('sha256').update(JSON.stringify(config)).digest('hex');
            if (force || signature !== this.configSignature || Date.now() - (this.catalogAt || 0) > this.cacheMs) {
                const response = await this.json(config.origin + '/v1/models', config.apiKey);
                if (!Array.isArray(response.data)) throw magpieError('invalid_response', 'Magpie 模型目录格式无效。');
                this.models = response.data.slice(0, 10000).map(normalizeModel).filter(Boolean);
                this.catalogAt = Date.now();
            }
            this.configSignature = signature;
            this.config = config;
        } catch (error) {
            this.config = null;
            errorCode = error.code === 'ENOENT' ? 'not_registered' : error.classification || (config ? 'gateway_unavailable' : 'invalid_config');
            if (!config) {
                let port = 3425;
                try {
                    const settingsPath = path.join(process.env.XDG_CONFIG_HOME || path.join(this.home, '.config'), 'magpie/settings.json');
                    const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
                    if (Number.isInteger(settings.port) && settings.port > 0 && settings.port < 65536) port = settings.port;
                } catch {}
                try { const hello = await this.json(`http://127.0.0.1:${port}/api/hello`); found = online = hello.name === 'magpie'; if (found) version = String(hello.version || '').slice(0, 80); } catch {}
            }
        }
        const managed = Boolean(this.config && online);
        const candidate = { found, gatewayOnline: online, registered: Boolean(config), managed, version,
            defaultModel: managed ? config.model : null, errorCode,
            baseURL: managed ? config.baseURL : undefined, apiType: managed ? config.apiType : undefined,
            modelCount: managed ? this.models.length : undefined,
            providerCount: managed && this.models.every(m => m.ownedBy) ? new Set(this.models.map(m => m.ownedBy)).size : undefined };
        const digest = createHash('sha256').update(JSON.stringify([candidate, managed ? this.models : [], managed ? this.configSignature : null])).digest('hex');
        if (digest !== this.digest) {
            this.digest = digest; this.revision++;
            if (managed) this.lastGood = { modelId: config.model, name: this.models.find(m => m.id === config.model)?.name || config.model };
            this.state = { ...candidate, lastGood: this.lastGood, revision: this.revision, lastSyncAt: new Date().toISOString() };
            this.emit('change', this.status());
        }
        return this.status();
    }
    async resolve(binding, options = {}) {
        if (!this.state.managed || !this.config) throw magpieError(this.state.errorCode || 'gateway_unavailable', 'Magpie 已断开或未托管。请重连或手动切换其他服务商。');
        const id = binding.policy === 'pinned' ? binding.pinnedModelId : this.config.model;
        const model = this.models.find(m => m.id === id);
        if (!model) throw magpieError('model_unavailable', 'Magpie 模型已不可用，请恢复跟随或选择其他模型。', 422);
        const sdkOptions = { ...options };
        // Provider identity and auth never come from client runtime overrides.
        for (const key of ['apiType', 'model', 'baseURL', 'apiKey', 'fallbackModel']) delete sdkOptions[key];
        for (const key of ['effort', 'thinking', 'maxThinkingTokens']) delete sdkOptions[key];
        if (binding.reasoningEffort && model.efforts.includes(binding.reasoningEffort)) sdkOptions.reasoningEffort = binding.reasoningEffort;
        else delete sdkOptions.reasoningEffort;
        const apiType = modelProtocol(model);
        return { provider: MAGPIE_ID, kind: 'integration', adapter: 'magpie', label: 'Magpie', apiType, model: id,
            baseURL: this.config.origin + (apiType === 'anthropic-messages' ? '' : '/v1'), apiKey: this.config.apiKey,
            modelCapabilities: modelCapabilities(model), models: [], sdkOptions };
    }
    async quotas() {
        await this.refresh(); if (!this.config) throw magpieError('gateway_unavailable', 'Magpie 已断开。');
        const raw = await this.json(this.config.origin + '/v1/magpie/quotas', this.config.apiKey);
        // Quotas vary between Magpie versions; expose no arbitrary nested objects/accounts.
        const rows = Array.isArray(raw) ? raw : raw.providers || raw.data || [];
        return { available: true, providers: (Array.isArray(rows) ? rows : []).map(row => ({ name: String(row.name || row.provider || '').slice(0, 200),
            windows: (Array.isArray(row.windows) ? row.windows : []).map(w => ({ label: String(w.label || w.name || '').slice(0, 120),
                used: typeof w.used === 'number' ? w.used : undefined, limit: typeof w.limit === 'number' ? w.limit : undefined,
                resetsAt: typeof w.resetsAt === 'string' ? w.resetsAt : undefined })) })) };
    }
    start() {
        this.timer = setInterval(() => this.refresh().catch(() => {}), this.intervalMs); this.timer.unref();
        try { this.watcher = watch(path.dirname(this.file), () => { clearTimeout(this.debounce); this.debounce = setTimeout(() => this.refresh().catch(() => {}), 150); }); this.watcher.unref(); } catch {}
        this.refresh().catch(() => {}); return this;
    }
    stop() { clearInterval(this.timer); clearTimeout(this.debounce); this.watcher?.close(); }
}
