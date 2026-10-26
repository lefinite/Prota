import { buildReasoningBody } from '../portal/agent/reasoning.js';

// SDK 0.2.1 declares effort but drops it before the provider request. Adapt
// instance methods, never global fetch or node_modules, preserving SDK history.
export function patchProviderReasoning(provider, getConfig, fetchImpl = fetch) {
    if (!provider || provider.__protaReasoningPatched) return;
    if (provider.apiType === 'anthropic-messages' && provider.client?.messages) {
        const original = provider.client.messages.create.bind(provider.client.messages);
        provider.client.messages.create = (body, options) => {
            const fields = buildReasoningBody({ ...getConfig(), model: body.model });
            const next = { ...body, ...fields };
            if (fields.output_config) next.output_config = { ...body.output_config, ...fields.output_config };
            return original(next, options);
        };
    } else if (provider.apiType === 'openai-completions') {
        // Preserve reasoning alongside tool calls for subsequent rounds.
        const convertResponse = provider.convertResponse.bind(provider);
        provider.convertResponse = data => {
            const result = convertResponse(data);
            const thinking = data.choices?.[0]?.message?.reasoning_content;
            if (typeof thinking === 'string' && thinking) result.content.unshift({ type: 'thinking', thinking });
            return result;
        };
        const convertAssistant = provider.convertAssistantMessage.bind(provider);
        provider.convertAssistantMessage = (message, result) => {
            convertAssistant(message, result);
            const thinking = Array.isArray(message.content)
                ? message.content.filter(block => block.type === 'thinking').map(block => block.thinking).join('') : '';
            if (thinking) result[result.length - 1].reasoning_content = thinking;
        };
        const original = provider.createMessage.bind(provider);
        provider.createMessage = async params => {
            const config = { ...getConfig(), model: params.model };
            const fields = buildReasoningBody(config);
            if (!Object.keys(fields).length) return original(params);
            const body = {
                model: params.model, max_tokens: params.maxTokens,
                messages: provider.convertMessages(params.system, params.messages),
                ...fields
            };
            if (params.tools?.length) body.tools = provider.convertTools(params.tools);
            const response = await fetchImpl(`${provider.baseURL}/chat/completions`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                const error = new Error(`OpenAI API error: ${response.status}: ${await response.text()}`);
                error.status = response.status;
                throw error;
            }
            return provider.convertResponse(await response.json());
        };
    }
    provider.__protaReasoningPatched = true;
}
