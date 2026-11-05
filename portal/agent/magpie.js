import { ModelLibrary } from './model-library.js';
export const MAGPIE_ID = 'integration:magpie';
export const MAGPIE_INSTALL = 'magpie plugin add github:lefinite/magpie-agent-prota';
export const isMagpie = value => value?.id === MAGPIE_ID || value?.provider === MAGPIE_ID || value?.adapter === 'magpie';
export const magpieProvider = () => ({ id: MAGPIE_ID, kind: 'integration', adapter: 'magpie', label: 'Magpie', presetId: null,
    apiType: 'openai-responses', model: '', baseURL: '', apiKey: '', sdkOptions: {}, models: [], endpointCandidates: [] });
const states = { not_registered: '待注册 Prota', not_managed: '未在 Magpie 管理', invalid_config: '配置无效', invalid_gateway: '网关身份无效', unauthorized: '网关未授权', model_unavailable: '固定模型不可用', model_switch_failed: '模型切换失败' };
export function statusText(state = {}) { return state.managed ? '已连接' : !state.found && !state.registered && !state.lastGood ? '未发现 Magpie' : states[state.errorCode] || '已断开'; }

export function applyBindingView(shell, data, { reset = false } = {}) {
    if (!data || (!reset && (data.bindingRevision ?? -1) < (shell.agentModelView?.bindingRevision ?? -1))) return;
    const previous = shell.agentModelView;
    shell.agentModelView = { providerBinding: data.providerBinding || { kind: 'direct-legacy' }, effectiveModel: data.effectiveModel || null,
        pendingModelChange: data.pendingModelChange || null, modelBindingError: data.modelBindingError || null, bindingRevision: data.bindingRevision || 0, runtimePreferences: data.runtimePreferences || {} };
    if (!reset && previous?.providerBinding?.policy === 'follow' && data.providerBinding?.policy === 'follow'
        && previous.effectiveModel?.modelId && previous.effectiveModel.modelId !== data.effectiveModel?.modelId && !data.modelBindingError) {
        shell.showToast(`已跟随 Magpie 切换到 ${data.effectiveModel.name || data.effectiveModel.modelId}`);
    }
    shell.renderModelLabel?.(); shell.renderAgentReasoning?.(); shell.renderPermissionLabel?.();
    shell.magpieClient?.renderDetails();
}
export function effectiveReasoningConfig(shell) {
    if (shell.agentModelView?.providerBinding?.kind === 'magpie') {
        const view = shell.agentModelView, model = shell.magpieClient?.models.find(m => m.id === view.effectiveModel?.modelId);
        return { provider: MAGPIE_ID, adapter: 'magpie', model: model?.id || view.effectiveModel?.modelId, apiType: view.effectiveModel?.apiType,
            modelCapabilities: { reasoning: model?.reasoning, efforts: model?.efforts || [] },
            sdkOptions: { reasoningEffort: view.providerBinding.reasoningEffort || 'default' } };
    }
    return shell.agentProviderStore?.providers.find(p => p.id === shell.agentModelView?.providerBinding?.providerId) || shell.getActiveProvider();
}
export class MagpieController {
    constructor(shell) { this.shell = shell; this.models = []; this.state = {}; }
    async start() {
        const shell = this.shell;
        if (!shell.agentProviderStore.providers.some(p => p.id === MAGPIE_ID)) {
            shell.agentProviderStore.providers.push(magpieProvider()); shell.persistProviders();
        }
        const controller = new AbortController(); this.abort = controller;
        this.visibility = () => { if (!document.hidden) this.refresh().catch(() => {}); };
        document.addEventListener('visibilitychange', this.visibility);
        this.timer = setInterval(() => { if (!document.hidden) this.refresh().catch(() => {}); }, 2000);
        this.events = new EventSource(shell.agentApi.url('/api/agent/magpie/events'));
        this.events.addEventListener('magpie_status_changed', () => this.refresh().catch(() => {}));
        window.addEventListener('pagehide', () => this.stop(), { once: true });
        await this.refresh();
    }
    stop() { clearInterval(this.timer); this.events?.close(); this.abort?.abort(); document.removeEventListener('visibilitychange', this.visibility); }
    async refresh(force = false) {
        if (this.refreshing) return this.refreshing;
        this.refreshing = this.load(force).finally(() => { this.refreshing = null; }); return this.refreshing;
    }
    async load(force) {
        const shell = this.shell, sessionId = shell.agentSessionId;
        let statusLoaded = false;
        try {
            const state = force ? await shell.agentApi.request('/api/agent/magpie/refresh', { method: 'POST', body: {} }) : await shell.agentApi.request('/api/agent/magpie/status');
            statusLoaded = true;
            if ((state.revision || 0) >= (this.state.revision || 0)) {
                const catalogChanged = state.revision !== this.state.revision;
                this.state = state;
                if (state.managed && (force || catalogChanged || !this.models.length)) {
                    const catalog = await shell.agentApi.request('/api/agent/magpie/models');
                    if (catalog.revision >= this.state.revision) this.models = catalog.models;
                }
            }
            if (sessionId) {
                const view = await shell.agentApi.request(`/api/agent/session/${encodeURIComponent(sessionId)}/model-binding`);
                if (shell.agentSessionId === sessionId) applyBindingView(shell, view);
            }
            shell.renderProviderList(); shell.renderModelLabel(); this.renderDetails();
            // Don't replace focused/searching menus on periodic status refresh.
        } catch { if (!statusLoaded) this.state = { ...this.state, managed: false, gatewayOnline: false, errorCode: 'gateway_unavailable' }; shell.renderModelLabel(); this.renderDetails(); }
    }
    async choose(policy = 'follow', pinnedModelId = null, reasoningEffort) {
        const shell = this.shell;
        if (shell.agentRunState.active || shell._agentModelSwitching) return false;
        shell._agentModelSwitching = true; shell.renderModelLabel();
        try {
            const sessionId = await shell.ensureCurrentAgentSession();
            const before = await shell.agentApi.request(`/api/agent/session/${encodeURIComponent(sessionId)}/model-binding`);
            if (sessionId !== shell.agentSessionId) return false;
            const view = await shell.agentApi.request(`/api/agent/session/${encodeURIComponent(sessionId)}/model-binding`, {
                method: 'POST', body: { kind: 'magpie', policy, pinnedModelId, expectedRevision: before.bindingRevision, ...(reasoningEffort === undefined ? {} : { reasoningEffort }) } });
            if (sessionId === shell.agentSessionId) applyBindingView(shell, view);
            if (reasoningEffort === undefined) {
                shell.agentProviderStore.activateProvider(MAGPIE_ID); shell.syncAgentProviderStoreState();
                shell.agentConfig = shell.buildAgentConfigFromActiveProvider(); shell.persistProviders(); shell.renderProviderList();
            }
            if (reasoningEffort === undefined) shell.closeAgentInlineDropdowns();
            shell.renderAgentWorkbench();
            if (view.providerBinding?.reasoningReset) shell.showToast('新模型不支持原思考强度，已恢复默认。');
            return true;
        } catch (error) { shell.showToast(error.message || 'Magpie 模型切换失败', true); return false; }
        finally {
            shell._agentModelSwitching = false; shell.renderModelLabel(); shell.renderAgentReasoning(); this.renderDetails();
            if (reasoningEffort !== undefined && shell.agentModelDropdownOpen) {
                const selected = shell.agentModelDropdown.querySelector('[data-reasoning-value][aria-pressed="true"]');
                selected?.focus();
            }
        }
    }
    async saveModels() {
        const shell = this.shell, provider = shell.agentProviderStore.providers.find(isMagpie);
        const draft = shell.getSelectedProvider();
        if (!provider || !isMagpie(draft) || this.savingModels || !shell.agentProviderPersistenceReady) return false;
        const previous = provider.enabledModels ? [...provider.enabledModels] : undefined;
        const ids = Array.isArray(draft.enabledModels) ? [...draft.enabledModels] : [this.state.defaultModel].filter(Boolean);
        this.savingModels = true;
        provider.enabledModels = ids;
        shell.agentSaveProviderBtn.disabled = true;
        this.renderDetails();
        try {
            await shell.persistAgentProviderConfig();
            shell.persistProviders();
            shell.editProviderDraft = structuredClone(provider);
            shell.unifiedSettings?.markSaved('models', true);
            return true;
        } catch {
            if (previous === undefined) delete provider.enabledModels;
            else provider.enabledModels = previous;
            shell.unifiedSettings?.setFeedback('保存失败，修改已保留，请重试。', true);
            return false;
        } finally {
            this.savingModels = false;
            shell.agentSaveProviderBtn.disabled = false;
            this.renderDetails();
        }
    }

    renderDetails() {
        const shell = this.shell;
        if (!shell.providerFormContent) return false;
        if (!this.details) {
            this.details = document.createElement('section');
            this.details.className = 'provider-detail-panel__content magpie-details';
            this.details.hidden = true;
            shell.providerFormContent.after(this.details);
            this.details.innerHTML = `<header class="magpie-header"><div class="magpie-identity"><span class="magpie-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m4 18 3-12 5 9 5-9 3 12"/></svg></span><div><h3>Magpie</h3></div></div><span class="magpie-status" role="status"><i></i><span data-magpie-status></span></span></header>
                <section class="magpie-disconnected" data-magpie-offline hidden><h4>连接 Magpie 后即可添加模型</h4><p data-magpie-message></p><div class="magpie-install"><code>magpie plugin add github:lefinite/magpie-agent-prota</code><button type="button" data-magpie="install" aria-label="复制 Magpie 插件安装命令">复制命令</button></div><p>在 Magpie 的 Agents → Prota 中选择一个模型，连接会自动更新。</p></section>
                <p class="magpie-binding-error" data-magpie-binding-error role="alert" hidden></p>
                <div class="magpie-session" data-magpie-session hidden><span>当前会话</span><strong data-magpie-session-name></strong><button type="button" data-magpie="use">使用 Magpie</button></div>
                <div data-magpie-library></div>
                <details class="magpie-connection"><summary>连接信息<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></summary><dl><dt>地址</dt><dd data-magpie-address></dd><dt>版本</dt><dd data-magpie-version></dd><dt>最近同步</dt><dd data-magpie-sync></dd></dl></details>`;
            this.library = new ModelLibrary(this.details.querySelector('[data-magpie-library]'), {
                escape: value => shell.escapeHtml(value),
                onChange: ids => {
                    if (!shell.editProviderDraft || !isMagpie(shell.editProviderDraft)) shell.editProviderDraft = structuredClone(shell.agentProviderStore.providers.find(isMagpie));
                    shell.editProviderDraft.enabledModels = [...ids];
                    shell.unifiedSettings?.userTouched.add('models');
                    shell.unifiedSettings?.refreshDirty();
                }
            });
            this.details.onclick = async event => {
                const button = event.target.closest('[data-magpie]');
                if (!button) return;
                try {
                    if (button.dataset.magpie === 'use') await shell.activateProvider(MAGPIE_ID);
                    if (button.dataset.magpie === 'install') {
                        await navigator.clipboard.writeText(MAGPIE_INSTALL);
                        button.textContent = '已复制';
                    }
                } catch (error) { shell.showToast(error.message || '操作失败，请重试。', true); }
            };
        }
        const selected = isMagpie(shell.getSelectedProvider());
        this.details.hidden = !selected;
        if (!selected) return false;
        shell.providerFormContent.hidden = true;
        if (shell.providerFormEmpty) shell.providerFormEmpty.hidden = true;
        shell.agentSaveProviderBtn.hidden = false;
        shell.agentDeleteProviderBtn.hidden = true;
        const state = this.state, view = shell.agentModelView;
        const provider = shell.getSelectedProvider();
        const enabled = Array.isArray(provider?.enabledModels) ? provider.enabledModels : [state.defaultModel].filter(Boolean);
        const text = (selector, value) => { this.details.querySelector(selector).textContent = value || '—'; };
        const managed = Boolean(state.managed);
        text('[data-magpie-status]', managed ? '已连接' : statusText(state));
        this.details.querySelector('.magpie-status').classList.toggle('is-connected', managed);
        this.details.querySelector('[data-magpie-offline]').hidden = managed;
        text('[data-magpie-message]', state.errorCode === 'not_registered' ? '在 Magpie 中安装 Prota 插件，然后选择模型。' : '确认 Magpie 已启动，并已安装 Prota 插件。');
        const active = view?.providerBinding?.kind === 'magpie';
        const error = this.details.querySelector('[data-magpie-binding-error]');
        error.hidden = !active || !view.modelBindingError;
        error.textContent = '当前会话的模型暂不可用，请在聊天中选择其他模型。';
        this.details.querySelector('[data-magpie-session]').hidden = !managed;
        text('[data-magpie-session-name]', active ? (view.effectiveModel?.name || view.effectiveModel?.modelId || '尚未选择模型') : '尚未使用 Magpie');
        const use = this.details.querySelector('[data-magpie="use"]');
        use.hidden = active;
        use.disabled = !managed || shell.agentRunState.active || shell._agentModelSwitching || this.savingModels;
        text('[data-magpie-address]', state.baseURL);
        text('[data-magpie-version]', state.version);
        const date = new Date(state.lastSyncAt);
        text('[data-magpie-sync]', Number.isNaN(date.getTime()) ? null : date.toLocaleString('zh-CN', { hour12: false }));
        const catalog = this.models.map(model => ({ id: model.id, name: model.name || model.id }));
        for (const id of enabled) if (!catalog.some(model => model.id === id)) catalog.push({ id, name: id, unavailable: true });
        this.library.update({ key: MAGPIE_ID, catalog, selected: enabled,
            disabled: this.savingModels || shell.agentRunState.active,
            emptyMessage: managed ? 'Magpie 暂未提供可用模型' : '等待 Magpie 连接' });
        return true;
    }
}
