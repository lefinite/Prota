const AGENT_PROVIDER_PRESET_FALLBACK = {
    "defaultProvider": "zhipu-anthropic",
    "providers": [
        {
            "id": "zhipu-anthropic",
            "label": "智谱 GLM Coding Plan",
            "aliases": [
                "zhipu-coding-plan",
                "zhipu",
                "智谱",
                "智谱 GLM Coding Plan"
            ],
            "apiType": "anthropic-messages",
            "baseURL": "https://open.bigmodel.cn/api/anthropic",
            "websiteUrl": "https://open.bigmodel.cn",
            "apiKeyUrl": "https://open.bigmodel.cn/usercenter/apikeys",
            "defaultModel": "glm-5.3",
            "models": [
                "glm-5.3",
                "glm-5.3-flash",
                "glm-5.3-flashx"
            ],
            "endpointCandidates": [
                "https://open.bigmodel.cn/api/anthropic"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true,
                "tools": {
                    "type": "preset",
                    "preset": "default"
                }
            },
            "hint": "GLM 5.3 系列模板。可用模型以当前套餐和拉取结果为准；历史配置中的已选模型保留。",
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "zhipu-glm-5",
            "label": "智谱 GLM 5 系列",
            "aliases": [
                "zhipu-glm5",
                "智谱 GLM 5 系列"
            ],
            "apiType": "anthropic-messages",
            "baseURL": "https://open.bigmodel.cn/api/anthropic",
            "websiteUrl": "https://open.bigmodel.cn",
            "apiKeyUrl": "https://open.bigmodel.cn/usercenter/apikeys",
            "defaultModel": "glm-5.3",
            "models": [
                "glm-5.3",
                "glm-5.3-flash",
                "glm-5.3-flashx"
            ],
            "endpointCandidates": [
                "https://open.bigmodel.cn/api/anthropic"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true,
                "tools": {
                    "type": "preset",
                    "preset": "default"
                }
            },
            "hint": "GLM 5.3 系列模板。可用模型以当前套餐和拉取结果为准；历史配置中的已选模型保留。",
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "openai-compatible",
            "label": "OpenAI 兼容 / 自定义",
            "aliases": [
                "openai",
                "compatible"
            ],
            "apiType": "openai-completions",
            "baseURL": "https://api.openai.com/v1",
            "websiteUrl": "https://platform.openai.com",
            "apiKeyUrl": "https://platform.openai.com/api-keys",
            "defaultModel": "",
            "models": [],
            "endpointCandidates": [
                "https://api.openai.com/v1"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true
            },
            "hint": "填写兼容服务的 Base URL 和 Key 后，点击“拉取模型”获取该服务的模型，或手动输入模型 ID。",
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "anthropic",
            "label": "Anthropic",
            "aliases": [
                "claude",
                "anthropic-official"
            ],
            "apiType": "anthropic-messages",
            "baseURL": "https://api.anthropic.com",
            "websiteUrl": "https://console.anthropic.com",
            "apiKeyUrl": "https://console.anthropic.com/settings/keys",
            "defaultModel": "claude-opus-5-5",
            "models": [
                "claude-opus-5-5",
                "claude-sonnet-5-5",
                "claude-haiku-5-5",
                "claude-fable-5-1"
            ],
            "endpointCandidates": [
                "https://api.anthropic.com"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true,
                "tools": {
                    "type": "preset",
                    "preset": "default"
                }
            },
            "hint": "Anthropic 官方接口。支持实时拉取模型列表；具体权限以当前账号为准。",
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "deepseek",
            "label": "DeepSeek",
            "aliases": [
                "deepseek",
                "deepseek-official"
            ],
            "apiType": "anthropic-messages",
            "baseURL": "https://api.deepseek.com/anthropic",
            "websiteUrl": "https://platform.deepseek.com",
            "apiKeyUrl": "https://platform.deepseek.com/api_keys",
            "defaultModel": "deepseek-v4-pro",
            "models": [
                "deepseek-flash",
                "deepseek-v4-pro"
            ],
            "endpointCandidates": [
                "https://api.deepseek.com/anthropic",
                "https://api.deepseek.com/v1"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true
            },
            "hint": "Anthropic 兼容推理接口；模型列表从同源 /models 获取。deepseek-flash 是官方当前 Flash 模型别名。",
            "modelsPath": "/models",
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "xiaomi-mimo",
            "label": "Xiaomi MiMo",
            "aliases": [
                "xiaomi",
                "mimo",
                "xiaomi-mimo"
            ],
            "apiType": "anthropic-messages",
            "baseURL": "https://api.xiaomimimo.com/anthropic",
            "websiteUrl": "https://platform.xiaomimimo.com",
            "apiKeyUrl": "https://platform.xiaomimimo.com/#/console/api-keys",
            "defaultModel": "mimo-v2.6-pro",
            "models": [
                "mimo-v2.6-pro",
                "mimo-v2.6-flash",
                "mimo-v2.6-pro-ultraspeed"
            ],
            "endpointCandidates": [
                "https://api.xiaomimimo.com/anthropic",
                "https://api.xiaomimimo.com/v1"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true
            },
            "hint": "小米 MiMo Anthropic 兼容接口。模型目录从同源 /v1/models 拉取；模板已更新至 V2.6 系列。",
            "modelsPath": "/v1/models",
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "kimi",
            "label": "Kimi For Coding",
            "aliases": [
                "kimi",
                "moonshot",
                "moonshotai"
            ],
            "apiType": "anthropic-messages",
            "baseURL": "https://api.kimi.com/coding/",
            "websiteUrl": "https://www.kimi.com/code",
            "apiKeyUrl": "https://www.kimi.com/code/console",
            "defaultModel": "k3",
            "models": [
                "k3",
                "k3-256k",
                "kimi-for-coding",
                "kimi-for-coding-highspeed"
            ],
            "endpointCandidates": [
                "https://api.kimi.com/coding/"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true
            },
            "hint": "K3 是最新旗舰，需对应会员权限；kimi-for-coding 对应 K2.8 Preview。使用 Coding 专用 Key，与开放平台独立。",
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "minimax",
            "label": "MiniMax",
            "aliases": [
                "minimax",
                "minimaxi"
            ],
            "apiType": "anthropic-messages",
            "baseURL": "https://api.minimaxi.com/anthropic",
            "websiteUrl": "https://platform.minimaxi.com",
            "apiKeyUrl": "https://platform.minimaxi.com/subscribe/coding-plan",
            "defaultModel": "MiniMax-M3.1-Flash",
            "models": [
                "MiniMax-M3.1-Flash",
                "MiniMax-M3"
            ],
            "endpointCandidates": [
                "https://api.minimaxi.com/anthropic",
                "https://api.minimax.io/anthropic",
                "https://api.minimaxi.com/v1",
                "https://api.minimax.io/v1"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true
            },
            "hint": "MiniMax Anthropic 兼容接口。模板已更新至 M3 系列，具体模型和权限以所用站点及套餐为准。",
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "github-copilot",
            "label": "GitHub Copilot",
            "aliases": [
                "copilot",
                "github-copilot",
                "github"
            ],
            "apiType": "openai-completions",
            "baseURL": "https://api.githubcopilot.com",
            "websiteUrl": "https://github.com/features/copilot",
            "defaultModel": "",
            "models": [],
            "endpointCandidates": [
                "https://api.githubcopilot.com"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true
            },
            "hint": "模型随账号、套餐及客户端变化，请用有效 Copilot 服务令牌拉取目录或输入模型 ID。普通 GitHub PAT 无效；尚未集成账号登录和令牌交换。",
            "modelsPath": "/models",
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "moonshot",
            "label": "Kimi 开放平台",
            "aliases": [
                "moonshot-api"
            ],
            "apiType": "anthropic-messages",
            "baseURL": "https://api.moonshot.cn/anthropic",
            "websiteUrl": "https://platform.moonshot.cn",
            "apiKeyUrl": "https://platform.moonshot.cn/console/api-keys",
            "defaultModel": "kimi-k3",
            "models": [
                "kimi-k3",
                "kimi-k2.7-code",
                "kimi-k2.6"
            ],
            "modelsPath": "/v1/models",
            "hint": "Moonshot 开放平台 K3 / K2.7 Code。使用开放平台 API Key，按量计费，与 Kimi Coding 套餐独立。",
            "endpointCandidates": [
                "https://api.moonshot.cn/anthropic"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true
            },
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "openrouter",
            "label": "OpenRouter",
            "aliases": [],
            "apiType": "openai-completions",
            "baseURL": "https://openrouter.ai/api/v1",
            "websiteUrl": "https://openrouter.ai",
            "apiKeyUrl": "https://openrouter.ai/settings/keys",
            "defaultModel": "anthropic/claude-sonnet-5.5",
            "models": [
                "anthropic/claude-opus-5.5",
                "anthropic/claude-sonnet-5.5",
                "anthropic/claude-haiku-5.5",
                "openai/gpt-6.1-sol",
                "openai/gpt-6-astra",
                "openai/gpt-6-luna",
                "z-ai/glm-5.3",
                "z-ai/glm-5.3-flash",
                "z-ai/glm-5.3-flashx",
                "moonshotai/kimi-k3",
                "minimax/minimax-m3"
            ],
            "hint": "模板来自 OpenRouter 实时目录（2026-10-21）。可再次拉取更新，模型权限与工具调用支持以服务商实际响应为准。",
            "endpointCandidates": [
                "https://openrouter.ai/api/v1"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true
            },
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "siliconflow",
            "label": "硅基流动 SiliconFlow",
            "aliases": [
                "siliconflow"
            ],
            "apiType": "openai-completions",
            "baseURL": "https://api.siliconflow.cn/v1",
            "websiteUrl": "https://siliconflow.cn",
            "apiKeyUrl": "https://cloud.siliconflow.cn/account/ak",
            "defaultModel": "zai-org/GLM-5.3",
            "models": [
                "zai-org/GLM-5.3",
                "zai-org/GLM-5.3-Flash",
                "deepseek-ai/DeepSeek-V4.1-Flash",
                "moonshotai/Kimi-K2.7-Code"
            ],
            "modelsPath": "/v1/models?sub_type=chat",
            "hint": "点击拉取模型获取当前账号的对话模型列表，避免混入图片、语音或向量模型。",
            "endpointCandidates": [
                "https://api.siliconflow.cn/v1"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true
            },
            "catalogUpdatedAt": "2026-10-21"
        },
        {
            "id": "xiaomi-token-plan",
            "label": "Xiaomi MiMo Token Plan",
            "aliases": [
                "mimo-token-plan"
            ],
            "apiType": "anthropic-messages",
            "baseURL": "https://token-plan-cn.xiaomimimo.com/anthropic",
            "websiteUrl": "https://platform.xiaomimimo.com",
            "apiKeyUrl": "https://platform.xiaomimimo.com/token-plan",
            "defaultModel": "mimo-v2.6-pro",
            "models": [
                "mimo-v2.6-pro",
                "mimo-v2.6-flash",
                "mimo-v2.6-pro-ultraspeed"
            ],
            "endpointCandidates": [
                "https://token-plan-cn.xiaomimimo.com/anthropic"
            ],
            "sdkDefaults": {
                "permissionMode": "default",
                "maxTurns": 100,
                "includePartialMessages": true
            },
            "hint": "使用 Token Plan 专用 Key 和对应集群地址，与按量计费 Key 独立。模型列表接口可能受套餐权限限制，失败时可保留模板模型。",
            "modelsPath": "/v1/models",
            "catalogUpdatedAt": "2026-10-21"
        }
    ],
    "updatedAt": "2026-10-21"
};

function normalizeAgentProviderId(providerId, presets = AGENT_PROVIDER_PRESET_FALLBACK) {
    const providers = presets?.providers || AGENT_PROVIDER_PRESET_FALLBACK.providers;
    const raw = String(providerId || '').trim();
    if (!raw) return presets?.defaultProvider || AGENT_PROVIDER_PRESET_FALLBACK.defaultProvider;
    const lowered = raw.toLowerCase();
    const preset = providers.find((item) => {
        const aliases = Array.isArray(item.aliases) ? item.aliases : [];
        return item.id === raw
            || item.label === raw
            || item.id.toLowerCase() === lowered
            || String(item.label || '').toLowerCase() === lowered
            || aliases.some((alias) => String(alias).trim().toLowerCase() === lowered);
    });
    return preset?.id || raw;
}

let agentProviderInstanceSequence = 0;

function createAgentProviderInstanceId() {
    if (globalThis.crypto?.randomUUID) {
        return `custom:${globalThis.crypto.randomUUID()}`;
    }
    agentProviderInstanceSequence += 1;
    return `custom:${Date.now()}:${agentProviderInstanceSequence}:${Math.random().toString(36).slice(2, 10)}`;
}

function cloneAgentProviderValue(value, fallback) {
    if (value === undefined || value === null) return fallback;
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (error) {
            // Fall through to the JSON-safe clone used by persisted provider data.
        }
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        return fallback;
    }
}

class AgentProviderConfigStore {
    constructor({ presets, readStorage, writeStorage, onPersist = null }) {
        this.presets = presets || { defaultProvider: '', providers: [] };
        this.readStorage = readStorage;
        this.writeStorage = writeStorage;
        this.onPersist = typeof onPersist === 'function' ? onPersist : null;
        this.providers = [];
        this.activeProviderId = null;
        this.selectedProviderId = null;
    }

    setPresets(presets) {
        this.presets = presets || this.presets;
    }

    load() {
        this.migrateLegacyProviderConfig();
        const storedProviders = this.readStorage('providers', null);
        this.providers = this.normalizeProviderInstances(storedProviders);
        this.activeProviderId = this.readStorage('active-provider-id', null);
        this.selectedProviderId = this.readStorage('selected-provider-id', null);
        if (!Array.isArray(storedProviders) && this.providers.length === 0) {
            this.seedDefaultProvider();
        }
        this.ensureValidSelection();
        this.persistIds();
    }

    normalizeProviderInstances(providers) {
        if (!Array.isArray(providers)) return [];
        const usedIds = new Set();
        return providers.filter((provider) => provider && typeof provider === 'object').map((provider) => {
            const normalized = cloneAgentProviderValue(provider, { ...provider });
            let id = String(normalized.id || '').trim();
            if (!id || usedIds.has(id)) id = createAgentProviderInstanceId();
            usedIds.add(id);
            normalized.id = id;
            normalized.sdkOptions = cloneAgentProviderValue(normalized.sdkOptions, {});
            delete normalized.sdkOptions.planMode;
            if (normalized.sdkOptions.permissionMode === 'plan') normalized.sdkOptions.permissionMode = 'default';
            normalized.models = Array.isArray(normalized.models) ? [...normalized.models] : [];
            normalized.endpointCandidates = Array.isArray(normalized.endpointCandidates) ? [...normalized.endpointCandidates] : [];
            return normalized;
        });
    }

    createProviderInstanceId() {
        let id = createAgentProviderInstanceId();
        while (this.providers.some((provider) => provider.id === id)) {
            id = createAgentProviderInstanceId();
        }
        return id;
    }

    migrateLegacyProviderConfig() {
        const oldConfig = this.readStorage('provider-config', null);
        const newProviders = this.readStorage('providers', null);
        if (newProviders || !oldConfig || !oldConfig.provider) return;
        const preset = this.getPreset(oldConfig.provider);
        const migrated = {
            id: 'custom:migrated',
            label: preset?.label || oldConfig.provider,
            presetId: this.normalizeProviderId(oldConfig.provider),
            apiType: preset?.apiType || 'anthropic-messages',
            model: oldConfig.model || preset?.defaultModel || '',
            baseURL: oldConfig.baseURL || preset?.baseURL || '',
            apiKey: oldConfig.apiKey || '',
            sdkOptions: oldConfig.sdkOptions || {},
            models: preset?.models || [],
            endpointCandidates: preset?.endpointCandidates || [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.writeStorage('providers', [migrated]);
        this.writeStorage('active-provider-id', migrated.id);
        this.writeStorage('selected-provider-id', migrated.id);
    }

    normalizeProviderId(providerId) {
        return normalizeAgentProviderId(providerId, this.presets);
    }

    getPreset(providerId) {
        const providers = this.presets?.providers || [];
        const normalizedId = this.normalizeProviderId(providerId);
        return providers.find((item) => item.id === normalizedId)
            || providers.find((item) => item.id === this.presets?.defaultProvider)
            || providers[0]
            || null;
    }

    buildProviderFromPreset(preset) {
        if (!preset) return null;
        return {
            id: this.createProviderInstanceId(),
            label: preset.label,
            presetId: preset.id,
            apiType: preset.apiType || 'anthropic-messages',
            model: preset.defaultModel || '',
            baseURL: preset.baseURL || '',
            apiKey: '',
            sdkOptions: cloneAgentProviderValue(preset.sdkDefaults, {}),
            models: [...(preset.models || [])],
            endpointCandidates: [...(preset.endpointCandidates || (preset.baseURL ? [preset.baseURL] : []))],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    }

    seedDefaultProvider() {
        const preset = this.getPreset(this.presets?.defaultProvider);
        const provider = this.buildProviderFromPreset(preset);
        if (!provider) return null;
        this.providers = [provider];
        this.activeProviderId = provider.id;
        this.selectedProviderId = provider.id;
        this.persist();
        return provider;
    }

    getActiveProvider() {
        return this.providers.find((item) => item.id === this.activeProviderId) || null;
    }

    getSelectedProvider() {
        return this.providers.find((item) => item.id === this.selectedProviderId) || this.getActiveProvider();
    }

    ensureValidSelection() {
        if (this.activeProviderId && !this.providers.some((item) => item.id === this.activeProviderId)) {
            this.activeProviderId = this.providers[0]?.id || null;
        }
        if (!this.activeProviderId && this.providers.length > 0) {
            this.activeProviderId = this.providers[0].id;
        }
        if (this.selectedProviderId && !this.providers.some((item) => item.id === this.selectedProviderId)) {
            this.selectedProviderId = this.activeProviderId || this.providers[0]?.id || null;
        }
        if (!this.selectedProviderId) {
            this.selectedProviderId = this.activeProviderId || this.providers[0]?.id || null;
        }
    }

    persist() {
        this.writeStorage('providers', this.providers);
        this.persistIds();
        this.onPersist?.(this.exportState());
    }

    persistIds() {
        this.writeStorage('active-provider-id', this.activeProviderId);
        this.writeStorage('selected-provider-id', this.selectedProviderId);
    }

    exportState() {
        return {
            providers: this.providers,
            activeProviderId: this.activeProviderId,
            selectedProviderId: this.selectedProviderId
        };
    }

    replaceState(state) {
        this.providers = this.normalizeProviderInstances(state?.providers);
        this.activeProviderId = state?.activeProviderId || null;
        this.selectedProviderId = state?.selectedProviderId || null;
        if (this.providers.length === 0) {
            this.seedDefaultProvider();
            return;
        }
        this.ensureValidSelection();
        this.writeStorage('providers', this.providers);
        this.persistIds();
    }

    createFromPreset(presetId) {
        const preset = this.getPreset(presetId);
        if (!preset) return null;
        const provider = this.buildProviderFromPreset(preset);
        if (!provider) return null;
        this.providers.push(provider);
        this.selectedProviderId = provider.id;
        if (!this.activeProviderId) this.activeProviderId = provider.id;
        this.persist();
        return provider;
    }

    createBlank() {
        const provider = {
            id: this.createProviderInstanceId(),
            label: '新供应商',
            presetId: null,
            apiType: 'anthropic-messages',
            model: '',
            baseURL: '',
            apiKey: '',
            sdkOptions: {},
            models: [],
            endpointCandidates: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.providers.push(provider);
        this.selectedProviderId = provider.id;
        if (!this.activeProviderId) this.activeProviderId = provider.id;
        this.persist();
        return provider;
    }

    addProvider(provider) {
        if (!provider) return null;
        const [instance] = this.normalizeProviderInstances([provider]);
        if (!instance) return null;
        if (!instance.id || this.providers.some((item) => item.id === instance.id)) {
            instance.id = this.createProviderInstanceId();
        }
        this.providers.push(instance);
        this.selectedProviderId = instance.id;
        if (!this.activeProviderId) this.activeProviderId = instance.id;
        this.persist();
        return instance;
    }

    selectProvider(id) {
        if (!this.providers.some((item) => item.id === id)) return null;
        this.selectedProviderId = id;
        this.persistIds();
        this.onPersist?.(this.exportState());
        return this.getSelectedProvider();
    }

    activateProvider(id = this.selectedProviderId) {
        if (!this.providers.some((item) => item.id === id)) return null;
        this.activeProviderId = id;
        this.selectedProviderId = id;
        this.persistIds();
        this.onPersist?.(this.exportState());
        return this.getActiveProvider();
    }

    deleteProvider(id = this.selectedProviderId) {
        const index = this.providers.findIndex((item) => item.id === id);
        if (index === -1) return null;
        const [removed] = this.providers.splice(index, 1);
        if (this.activeProviderId === id) {
            this.activeProviderId = this.providers[Math.min(index, this.providers.length - 1)]?.id || null;
        }
        if (this.selectedProviderId === id) {
            this.selectedProviderId = this.activeProviderId || this.providers[Math.min(index, this.providers.length - 1)]?.id || null;
        }
        this.persist();
        return removed;
    }

    updateSelectedProvider(draft) {
        const provider = this.getSelectedProvider();
        if (!provider) return null;
        const has = (key) => Object.prototype.hasOwnProperty.call(draft, key);
        if (has('presetId')) provider.presetId = draft.presetId || null;
        if (has('models')) provider.models = [...new Set(draft.models || [])];
        provider.label = (has('label') ? draft.label : provider.label) || '未命名供应商';
        provider.apiType = (has('apiType') ? draft.apiType : provider.apiType) || 'anthropic-messages';
        provider.model = has('model') ? draft.model : (provider.model || '');
        provider.baseURL = has('baseURL') ? draft.baseURL : (provider.baseURL || '');
        provider.apiKey = has('apiKey') ? draft.apiKey : (provider.apiKey || '');
        provider.sdkOptions = has('sdkOptions') ? (draft.sdkOptions || {}) : (provider.sdkOptions || {});
        provider.endpointCandidates = this.getEndpointCandidates(provider);
        provider.updatedAt = Date.now();
        this.persist();
        return provider;
    }

    buildConfig(provider = this.getActiveProvider()) {
        if (!provider) return { provider: '', apiType: 'anthropic-messages', model: '', baseURL: '', apiKey: '', sdkOptions: {} };
        const preset = provider.presetId ? this.getPreset(provider.presetId) : null;
        return {
            provider: provider.presetId || provider.id,
            apiType: provider.apiType || preset?.apiType || 'anthropic-messages',
            model: provider.model || '',
            baseURL: provider.baseURL || '',
            apiKey: provider.apiKey || '',
            sdkOptions: provider.sdkOptions || {},
            endpointCandidates: this.getEndpointCandidates(provider)
        };
    }

    getEndpointCandidates(provider = this.getSelectedProvider()) {
        const preset = provider?.presetId ? this.getPreset(provider.presetId) : null;
        return Array.from(new Set([
            ...(preset?.endpointCandidates || []),
            ...(provider?.endpointCandidates || []),
            provider?.baseURL,
            preset?.baseURL
        ].filter(Boolean)));
    }

    getModelOptions(provider = this.getSelectedProvider()) {
        const preset = provider?.presetId ? this.getPreset(provider.presetId) : null;
        return Array.from(new Set([
            ...(preset?.models || []),
            ...(provider?.models || []),
            provider?.model
        ].filter(Boolean)));
    }

    mergeModels(models = []) {
        const provider = this.getSelectedProvider();
        if (!provider) return [];
        provider.models = Array.from(new Set([...(provider.models || []), ...models])).filter(Boolean);
        provider.updatedAt = Date.now();
        this.persist();
        return provider.models;
    }
}

window.AgentProviderConfigStore = AgentProviderConfigStore;
