import { effectiveReasoningConfig, isMagpie } from './magpie.js';
import { getReasoningCapability, getReasoningSelection } from './reasoning.js';

export function renderModelMenu(shell) {
    const e = value => shell.escapeHtml(String(value ?? ''));
    const view = shell.agentModelView, client = shell.magpieClient;
    const locked = shell.agentRunState.active || shell._agentModelSwitching || shell._agentReasoningSaving;
    const groups = [];
    const row = (name, attrs, selected, unavailable = false) => `<button type="button" class="agent-model-choice${selected ? ' is-active' : ''}" aria-pressed="${selected}" ${attrs} ${locked || unavailable ? 'disabled' : ''}><span>${e(name)}</span><span class="agent-model-choice__check" aria-hidden="true">${selected ? '✓' : ''}</span></button>`;
    for (const provider of shell.agentProviderStore?.providers || []) {
        let rows;
        if (isMagpie(provider)) {
            const ids = Array.isArray(provider.enabledModels) ? provider.enabledModels : [client?.state.defaultModel].filter(Boolean);
            rows = ids.map(id => {
                const model = client?.models.find(m => m.id === id);
                const selected = view?.providerBinding?.kind === 'magpie' && view.effectiveModel?.modelId === id;
                return row(model?.name || id, `data-magpie-model="${e(id)}"`, selected, !client?.state.managed || !model);
            }).join('');
        } else {
            rows = shell.agentProviderStore.getEnabledModels(provider).map(id => row(id, `data-provider-id="${e(provider.id)}" data-model-id="${e(id)}"`, view?.providerBinding?.kind !== 'magpie' && provider.id === shell.activeProviderId && id === (view?.effectiveModel?.modelId || provider.model))).join('');
        }
        if (rows) groups.push(`<section class="agent-model-group" aria-label="${e(provider.label)}"><div class="agent-model-group__title">${e(provider.label)}</div>${rows}</section>`);
    }
    const config = effectiveReasoningConfig(shell) || {}, capability = getReasoningCapability(config), selection = getReasoningSelection(config);
    const value = selection.value;
    const options = capability.options;
    const adjustable = options.length > 1;
    const effort = `<section class="agent-model-thinking" aria-label="思考强度"><div class="agent-model-thinking__heading"><span>思考强度</span>${!adjustable ? '<span class="agent-model-thinking__fixed">模型默认</span>' : ''}</div>${adjustable ? `<div class="agent-effort-options" style="--effort-columns:${options.length > 4 ? Math.ceil(options.length / 2) : options.length}" role="group" aria-label="思考强度">${options.map(o => `<button type="button" data-reasoning-value="${o.value}" aria-pressed="${o.value === value}" title="${e(o.description)}" ${locked ? 'disabled' : ''}>${e(o.label)}</button>`).join('')}</div>` : ''}</section>`;
    return `<div class="agent-model-menu__heading">${locked ? (shell.agentRunState.active ? '任务结束后可切换' : '正在保存…') : '选择模型'}</div><div class="agent-model-menu__list">${groups.join('') || '<div class="agent-model-menu__empty">在模型配置中勾选常用模型</div>'}</div>${effort}<button type="button" class="agent-model-menu__settings" data-action="settings">模型配置<span aria-hidden="true">›</span></button>`;
}
