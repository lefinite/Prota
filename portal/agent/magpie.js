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
    shell.renderModelLabel?.(); shell.renderAgentReasoning?.();
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
            shell.closeAgentInlineDropdowns(); shell.renderAgentWorkbench();
            if (view.providerBinding?.reasoningReset) shell.showToast('新模型不支持原思考强度，已恢复默认。');
            return true;
        } catch (error) { shell.showToast(error.message || 'Magpie 模型切换失败', true); return false; }
        finally { shell._agentModelSwitching = false; shell.renderModelLabel(); shell.renderAgentReasoning(); this.renderDetails(); }
    }
    renderDetails() {
        const shell = this.shell;
        if (!shell.providerFormContent) return false;
        if (!this.details) { this.details = document.createElement('section'); this.details.className = 'provider-detail-panel__content magpie-details'; this.details.hidden = true; shell.providerFormContent.after(this.details); }
        const selected = isMagpie(shell.getSelectedProvider()); this.details.hidden = !selected;
        if (!selected) return false;
        shell.providerFormContent.hidden = true; if (shell.providerFormEmpty) shell.providerFormEmpty.hidden = true;
        const e = s => shell.escapeHtml(String(s ?? '')), state = this.state, view = shell.agentModelView;
        const model = this.models.find(m => m.id === state.defaultModel);
        const signature = JSON.stringify([state, view, shell._agentModelSwitching]);
        if (signature === this.detailsSignature) return true; this.detailsSignature = signature;
        this.details.innerHTML = `<h3>Magpie <small>本地模型网关</small></h3><p role="status">${e(statusText(state))}</p>
            <p>${e(model?.name || state.defaultModel || (state.lastGood ? `上次：${state.lastGood.name}` : '在 Magpie → Agents → Prota 中选择模型'))}</p>
            ${view?.providerBinding?.policy === 'pinned' ? `<p>本会话固定：${e(view.effectiveModel?.name || view.providerBinding.pinnedModelId)}</p>` : ''}
            ${view?.pendingModelChange ? `<p>Magpie 已改为 ${e(view.pendingModelChange.modelId)} · 下轮生效</p>` : ''}
            ${view?.modelBindingError ? `<p role="alert">${e(states[view.modelBindingError] || 'Magpie 已断开，请重新连接或手动切换服务商。')}</p>` : ''}
            ${state.modelCount !== undefined ? `<p>${state.providerCount === undefined ? '' : `${e(state.providerCount)} 个来源 · `}${e(state.modelCount)} 个模型</p>` : ''}
            <div class="magpie-actions">
                <button type="button" class="agent-secondary-btn" data-magpie="use" ${!state.managed || shell.agentRunState.active || shell._agentModelSwitching ? 'disabled' : ''}>使用 Magpie</button>
                <button type="button" class="agent-secondary-btn" data-magpie="refresh">刷新连接</button>
                <button type="button" class="agent-secondary-btn" data-magpie="install">复制安装命令</button>
                ${state.managed ? '<button type="button" class="agent-secondary-btn" data-magpie="quotas">查看额度</button>' : ''}
            </div><p>全局默认模型请在 Magpie 的 Agents → Prota 中修改。</p>
            <details><summary>技术信息</summary><p>Magpie ${e(state.version || '未知')} · ${e(state.apiType || '')}</p><p>${e(state.baseURL || '')}</p><p>${e(state.lastSyncAt || '')}</p><p>${e(state.errorCode || '')}</p></details><div data-magpie-quotas></div>`;
        this.details.onclick = async event => {
            const action = event.target.closest('[data-magpie]')?.dataset.magpie;
            try {
                if (action === 'use') await this.choose();
                if (action === 'refresh') await this.refresh(true);
                if (action === 'install') { await navigator.clipboard.writeText(MAGPIE_INSTALL); shell.showToast('已复制 Prota 插件安装命令'); }
                if (action === 'quotas') {
                    const quota = await shell.agentApi.request('/api/agent/magpie/quotas');
                    this.details.querySelector('[data-magpie-quotas]').textContent = quota.providers.length ? JSON.stringify(quota.providers) : 'Magpie 未提供可展示的额度数据。';
                }
            } catch (error) { shell.showToast(error.message || '操作失败', true); }
        };
        return true;
    }
    menu() {
        const shell = this.shell, e = s => shell.escapeHtml(String(s ?? '')), view = shell.agentModelView;
        const locked = shell.agentRunState.active || shell._agentModelSwitching;
        const source = view?.providerBinding?.kind === 'magpie' ? `Magpie · ${view.providerBinding.policy === 'pinned' ? '本会话固定' : '跟随'}` : '直连服务商';
        const button = (name, attrs, active = false, detail = '') => `<button type="button" role="menuitemradio" aria-checked="${active}" title="${e(detail || name)}" class="agent-model-dropdown__item${active ? ' is-active' : ''}" ${attrs} ${locked ? 'disabled' : ''}><span class="agent-model-dropdown__item-name">${e(name)}</span>${detail ? `<span class="agent-model-dropdown__item-model">${e(detail)}</span>` : ''}</button>`;
        const direct = (shell.agentProviderStore?.providers || []).filter(p => !isMagpie(p)).map(p => button(p.label, `data-provider-id="${e(p.id)}"`, view?.providerBinding?.kind !== 'magpie' && (view?.effectiveModel?.providerId === p.id || (!view?.effectiveModel && p.id === shell.activeProviderId)), p.model)).join('');
        const follow = button('跟随 Magpie', 'data-magpie-policy="follow"', view?.providerBinding?.policy === 'follow', this.state.defaultModel || statusText(this.state));
        const models = this.models.map(m => button(m.name + (m.id.startsWith('group/') ? ' · 路由组' : ''), `data-magpie-model="${e(m.id)}"`, view?.providerBinding?.policy === 'pinned' && view.providerBinding.pinnedModelId === m.id, m.id)).join('');
        return `<div class="magpie-menu-status">${locked ? '任务结束后可切换' : e(view?.effectiveModel?.name || view?.effectiveModel?.modelId || '当前会话')} · ${e(source)}${view?.pendingModelChange ? ` · 下轮：${e(view.pendingModelChange.modelId)}` : ''}${view?.modelBindingError ? ' · Magpie 不可用' : ''}</div>${direct}<div class="agent-model-dropdown__divider"></div>${follow}
            <input type="search" class="magpie-model-search" placeholder="固定本会话模型 · 搜索" aria-label="搜索 Magpie 模型" />
            <div class="magpie-model-results">${models || '<p>请在 Magpie 中安装 Prota 插件并选择模型。</p>'}</div>
            <div class="agent-model-dropdown__divider"></div><button type="button" class="agent-model-dropdown__item" data-magpie-refresh>刷新 Magpie 模型</button>
            <button type="button" class="agent-model-dropdown__item" data-action="settings">模型配置</button>`;
    }
}
