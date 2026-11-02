import { MAGPIE_ID, magpieError } from './bridge.mjs';

export function normalizeBinding(value = {}, previous = null) {
    if (value.kind === 'magpie') {
        if (!['follow', 'pinned'].includes(value.policy)) throw magpieError('invalid_binding', '请选择跟随 Magpie 或固定模型。', 422);
        if (value.policy === 'pinned' && (typeof value.pinnedModelId !== 'string' || !value.pinnedModelId.trim() || value.pinnedModelId.length > 500)) throw magpieError('invalid_binding', '固定模型 ID 无效。', 422);
        const effort = value.reasoningEffort ?? previous?.reasoningEffort ?? 'default';
        if (!['default', 'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) throw magpieError('invalid_binding', '思考强度无效。', 422);
        return { kind: 'magpie', policy: value.policy, pinnedModelId: value.policy === 'pinned' ? value.pinnedModelId : null, reasoningEffort: effort };
    }
    if (value.kind !== 'direct') throw magpieError('invalid_binding', '绑定来源无效。', 422);
    return { kind: 'direct', providerId: typeof value.providerId === 'string' ? value.providerId.slice(0, 200) : null };
}
export function bindingView(session) {
    return { providerBinding: session.providerBinding || { kind: 'direct-legacy' },
        effectiveModel: session.effectiveModel || (session.providerConfig?.model ? { providerId: session.providerConfig.provider, modelId: session.providerConfig.model,
            apiType: session.providerConfig.apiType, source: 'direct', status: 'applied' } : null),
        pendingModelChange: session.pendingModelChange || null, modelBindingError: session.modelBindingError || null,
        bindingRevision: session.bindingRevision || 0 };
}
export class ModelBindings {
    constructor({ bridge, gateway, persist, emit, resolveDirect }) { Object.assign(this, { bridge, gateway, persist, emit, resolveDirect }); }
    busy(session) { return Boolean(session.activeRun || session._runStarting || session._piOperation || session._modelOperation || this.gateway.manager.get(session.id)?.busy); }
    apply(session, proposed, { expectedRevision, external = false, prepareRun = false, providerConfig } = {}) {
        if (this.busy(session) && !prepareRun) {
            if (external) { session.pendingModelChange = { modelId: proposed.policy === 'pinned' ? proposed.pinnedModelId : this.bridge.status().defaultModel, revision: this.bridge.revision }; this.changed(session); return Promise.resolve(bindingView(session)); }
            return Promise.reject(magpieError('busy', '任务结束后可切换模型。', 409));
        }
        if (session._modelOperation) return Promise.reject(magpieError('busy', '模型正在切换。', 409));
        if (expectedRevision !== undefined && expectedRevision !== (session.bindingRevision || 0)) return Promise.reject(magpieError('revision_conflict', '会话模型已变化，请刷新后重试。', 409));
        // Claim synchronously before the first await so run startup cannot race.
        const work = this.commit(session, proposed, { providerConfig });
        session._modelOperation = work;
        let applied = false;
        return work.then(value => { applied = true; return value; }).finally(() => { if (session._modelOperation === work) session._modelOperation = null;
            if (applied && session.providerBinding?.kind === 'magpie' && session.providerBinding.revision !== this.bridge.revision) queueMicrotask(() => this.reconcile(session).catch(() => {})); });
    }
    async commit(session, proposed, { providerConfig }) {
        const binding = normalizeBinding(proposed, session.providerBinding);
        let next;
        if (binding.kind === 'magpie') {
            await this.bridge.refresh();
            next = await this.bridge.resolve(binding, session.providerConfig?.sdkOptions || providerConfig?.sdkOptions || {});
            if (binding.reasoningEffort !== 'default' && !next.modelCapabilities.efforts.includes(binding.reasoningEffort)) { binding.reasoningEffort = 'default'; binding.reasoningReset = true; }
        } else {
            if (!providerConfig || providerConfig.provider === MAGPIE_ID || providerConfig.adapter === 'magpie') throw magpieError('invalid_binding', '切换直连服务商需要有效配置。', 422);
            next = this.resolveDirect(providerConfig);
        }
        const resolvedRevision = this.bridge.revision;
        const candidate = { ...session, engineInfo: structuredClone(session.engineInfo), providerConfig: next };
        if (binding.kind === 'magpie' && candidate.engineInfo) { delete candidate.engineInfo.thinkingLevel; delete candidate.engineInfo.thinkingTarget; }
        const before = { providerConfig: session.providerConfig, providerBinding: session.providerBinding, effectiveModel: session.effectiveModel,
            bindingRevision: session.bindingRevision, pendingModelChange: session.pendingModelChange, modelBindingError: session.modelBindingError, engineInfo: session.engineInfo };
        try {
            await this.gateway.ensure(candidate);
            // A usable runtime is required before committing any user-visible state.
            const runtime = this.gateway.manager.get(session.id);
            if (runtime?.rpc) {
                const state = await runtime.rpc.request('get_state');
                if (state.model?.id && state.model.id !== next.model) throw new Error('Pi model confirmation mismatch');
            }
            const at = new Date().toISOString();
            Object.assign(session, { providerConfig: next, engineInfo: candidate.engineInfo, providerBinding: { ...binding, revision: resolvedRevision,
                lastApplied: { modelId: next.model, apiType: next.apiType, at } },
                bindingRevision: (session.bindingRevision || 0) + 1, pendingModelChange: null, modelBindingError: null,
                effectiveModel: { providerId: binding.kind === 'magpie' ? MAGPIE_ID : binding.providerId || next.provider,
                    modelId: next.model, name: next.modelCapabilities?.name || next.model, apiType: next.apiType,
                    source: binding.kind, policy: binding.policy, status: 'applied', appliedAt: at } });
            await this.persist(session);
            this.changed(session);
            return bindingView(session);
        } catch (error) {
            Object.assign(session, before);
            try { await this.gateway.dispose(session.id); await this.gateway.ensure(session); } catch {}
            throw magpieError('model_switch_failed', '模型切换失败，保留原绑定。请检查网关与模型配置后重试。', 503);
        }
    }
    changed(session) { this.emit(session, 'agent_model_binding_changed', bindingView(session)); }
    async reconcile(session) {
        if (session._summaryOnly || session.providerBinding?.kind !== 'magpie') return;
        const state = this.bridge.status();
        if (!state.managed) { session.modelBindingError = state.errorCode || 'gateway_unavailable'; this.changed(session); return; }
        const id = session.providerBinding.policy === 'pinned' ? session.providerBinding.pinnedModelId : state.defaultModel;
        if (!this.bridge.models.some(m => m.id === id)) { session.modelBindingError = 'model_unavailable'; this.changed(session); return; }
        // Include catalog/key revisions, even when the selected model ID is unchanged.
        if (session.providerBinding.revision === state.revision && !session.modelBindingError) return;
        try { await this.apply(session, session.providerBinding, { external: true }); }
        catch { session.modelBindingError = 'model_switch_failed'; this.changed(session); }
    }
}
