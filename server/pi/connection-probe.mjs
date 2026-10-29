import { adaptProvider } from './provider-adapter.mjs';

// Use the same API validation and reasoning fields as the runtime adapter.
export function buildConnectionProbe(config) {
    const adapted = adaptProvider(config);
    const base = config.baseURL.replace(/\/$/, '');
    const openAIBase = /\/v\d+(?:\.\d+)?$/u.test(base) ? base : `${base}/v1`;
    const text = 'Reply with exactly CONNECTED.';
    const headers = { 'Content-Type': 'application/json' };
    switch (config.apiType) {
        case 'anthropic-messages':
            return { url: `${base.endsWith('/v1') ? base : `${base}/v1`}/messages`,
                headers: { ...headers, 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
                body: { model: config.model, max_tokens: 128, messages: [{ role: 'user', content: text }], ...adapted.reasoningBody } };
        case 'openai-completions':
            return { url: `${openAIBase}/chat/completions`, headers: { ...headers, Authorization: `Bearer ${config.apiKey}` },
                body: { model: config.model, max_tokens: 128, messages: [{ role: 'user', content: text }], ...adapted.reasoningBody } };
        case 'openai-responses':
            return { url: `${openAIBase}/responses`, headers: { ...headers, Authorization: `Bearer ${config.apiKey}` },
                body: { model: config.model, max_output_tokens: 128, input: text } };
        case 'google-generative-ai':
            return { url: `${base}/models/${encodeURIComponent(config.model.replace(/^models\//, ''))}:generateContent`,
                headers: { ...headers, 'x-goog-api-key': config.apiKey },
                body: { contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { maxOutputTokens: 128 } } };
        default: throw new Error('Unsupported Pi provider protocol');
    }
}
