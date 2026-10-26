// Shared by the composer and gateway. Match a verified endpoint AND model;
// an OpenAI-compatible protocol alone is not a capability declaration.
const descriptions = {
    default: ['默认', '沿用模型自身的推理策略'],
    low: ['低', '简单修改、快速问答，优先响应速度'],
    medium: ['中', '日常分析与实现，兼顾深度和速度'],
    high: ['高', '复杂设计、多步任务与问题排查'],
    xhigh: ['更高', '困难任务，通常需要更多时间和 Token'],
    max: ['最高', '复杂任务优先，可能花费更多时间与 Token'],
    enabled: ['开启', '由模型决定思考深度'],
    disabled: ['关闭', '直接回答，适合简单任务']
};
export function getReasoningCapability(config = {}) {
    let host = '';
    try { host = new URL(config.baseURL).hostname; } catch {}
    const model = String(config.model || '').toLowerCase();
    const api = config.apiType;
    const anthropic = api === 'anthropic-messages';
    let defaultDescription = descriptions.default[1], defaultValue = null;
    let values = [], kind = '', hint = '当前模型或接口的可调参数尚未确认，沿用模型默认。';
    if (['open.bigmodel.cn', 'api.z.ai'].includes(host) && /^glm-5\.3(?:-flash)?$/.test(model)) {
        values = ['low', 'high', 'max']; kind = 'glm';
        defaultDescription = '当前模型默认使用 max（最高）';
        defaultValue = 'max';
        hint = '此模型始终开启思考；强度越高，通常耗时与 Token 用量越多。';
    } else if (/(^|\.)xiaomimimo\.com$/.test(host) && /^mimo-v2\.(?:5|6)(?:-pro|-flash|-pro-ultraspeed)?$/.test(model)) {
        values = ['enabled', 'disabled']; kind = 'toggle';
        defaultDescription = '当前模型默认开启思考';
        defaultValue = 'enabled';
        hint = '此模型支持思考开关，暂不区分低、中、高强度。';
    } else if (host === 'api.deepseek.com' && /^(deepseek-v4-pro|deepseek-flash)$/.test(model)) {
        values = ['low', 'high', 'max']; kind = 'effort';
        hint = '调整模型推理深度；更高强度通常需要更多时间和 Token。';
    } else if (['api.kimi.com', 'api.kimi.ai'].includes(host) && /^(k3(?:-256k)?|kimi-for-coding)$/.test(model)) {
        values = ['low', 'high', 'max']; kind = 'effort';
        hint = '切换强度可能使上下文缓存失效，建议同一任务保持一致。';
    } else if (['api.minimaxi.com', 'api.minimax.io'].includes(host) && model === 'minimax-m3.1-flash' && anthropic) {
        values = ['low', 'medium', 'high', 'xhigh', 'max']; kind = 'effort';
        hint = '此模型始终开启思考；更高强度通常需要更多时间和 Token。';
    } else if (host === 'api.anthropic.com' && anthropic && /^claude-(?:opus|sonnet|haiku)-5-5(?:-|$)|^claude-fable-5-1(?:-|$)/.test(model)) {
        values = ['low', 'medium', 'high', 'xhigh', 'max']; kind = 'effort';
        hint = '强度控制推理投入；更高强度通常需要更多时间和 Token。';
    } else if (host === 'api.openai.com' && !anthropic && /^(?:gpt-5(?:\.\d+)?(?:-codex)?|o3|o4-mini)$/.test(model)) {
        values = ['low', 'medium', 'high']; kind = 'effort';
        if (/^gpt-5\.[2-5]/.test(model)) values.push('xhigh');
        hint = '调整模型推理投入；更高强度通常需要更多时间和 Token。';
    }
    if (!['anthropic-messages', 'openai-completions'].includes(api)) { values = []; kind = ''; defaultValue = null; }
    return { kind, hint, defaultValue, options: ['default', ...values].map(value => ({ value, label: descriptions[value][0], description: value === 'default' ? defaultDescription : descriptions[value][1] })) };
}
export function getReasoningSelection(config = {}) {
    const capability = getReasoningCapability(config);
    const value = config.sdkOptions?.reasoningEffort || 'default';
    return capability.options.find(option => option.value === value) || capability.options[0];
}
export function buildReasoningBody(config = {}) {
    const capability = getReasoningCapability(config);
    const value = getReasoningSelection(config).value;
    if (value === 'default') return {};
    if (capability.kind === 'toggle') return { thinking: { type: value } };
    if (capability.kind === 'glm') return { thinking: { type: 'enabled' }, reasoning_effort: value };
    if (capability.kind === 'effort') return config.apiType === 'anthropic-messages'
        ? { output_config: { effort: value } }
        : { reasoning_effort: value };
    return {};
}
