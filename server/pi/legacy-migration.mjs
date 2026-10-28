const toolNames = { Read: 'read', Write: 'write', Edit: 'edit', Glob: 'find', Grep: 'grep',
    Bash: process.platform === 'win32' ? 'powershell' : 'bash', AskUserQuestion: 'ask_user' };

function contentBlock(block) {
    if (block?.type === 'text' && typeof block.text === 'string') return { type: 'text', text: block.text };
    if (block?.type === 'image' && block.source?.type === 'base64'
        && typeof block.source.data === 'string' && /^image\/(png|jpeg|webp|gif)$/.test(block.source.media_type)) {
        return { type: 'image', data: block.source.data, mimeType: block.source.media_type };
    }
    throw new Error('Unsupported legacy content block');
}

function toolArguments(name, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid legacy tool arguments');
    const args = structuredClone(input);
    if (['Read', 'Write', 'Edit'].includes(name) && typeof args.file_path === 'string') {
        args.path = args.file_path;
        delete args.file_path;
    }
    if (name === 'Edit') {
        if (typeof args.old_string === 'string') { args.oldText = args.old_string; delete args.old_string; }
        if (typeof args.new_string === 'string') { args.newText = args.new_string; delete args.new_string; }
    }
    return args;
}

// Convert only a complete, understood message sequence. Unknown blocks and
// unmatched tool IDs fall back to explicit summary recovery, never fabricated
// tool results or hand-written Pi Session JSONL.
export function convertLegacyMessages(records, { api, provider, model, timestamp = 0 } = {}) {
    try {
        if (!Array.isArray(records) || !records.length || !api || !provider || !model) throw new Error('Missing legacy metadata');
        const messages = [], pending = new Map(), usedIds = new Set();
        let assistants = 0;
        for (const record of records) {
            const original = record.message || record;
            if (!['user', 'assistant'].includes(original.role)) throw new Error('Unsupported legacy role');
            const parsedTime = typeof record.timestamp === 'number' ? record.timestamp : Date.parse(record.timestamp || '');
            const time = Number.isFinite(parsedTime) ? parsedTime : timestamp;
            const blocks = typeof original.content === 'string' ? [{ type: 'text', text: original.content }] : original.content;
            if (!Array.isArray(blocks)) throw new Error('Invalid legacy content');
            if (original.role === 'assistant') {
                if (pending.size) throw new Error('Legacy assistant has unresolved tool calls');
                assistants++;
                const content = [];
                for (const block of blocks) {
                    if (block.type === 'text') content.push(contentBlock(block));
                    else if (block.type === 'thinking' && typeof block.thinking === 'string' && !block.signature && !block.thinkingSignature) {
                        content.push({ type: 'thinking', thinking: block.thinking });
                    } else if (block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') {
                        if (usedIds.has(block.id)) throw new Error('Duplicate legacy tool ID');
                        const name = toolNames[block.name] || block.name;
                        content.push({ type: 'toolCall', id: block.id, name, arguments: toolArguments(block.name, block.input) });
                        pending.set(block.id, name); usedIds.add(block.id);
                    } else throw new Error('Unsupported legacy assistant block');
                }
                const usage = record.usage || original.usage || {};
                const input = Number(usage.input_tokens || 0), output = Number(usage.output_tokens || 0);
                const cacheRead = Number(usage.cache_read_input_tokens || 0), cacheWrite = Number(usage.cache_creation_input_tokens || 0);
                if (![input, output, cacheRead, cacheWrite, Number(record.cost || 0)].every(value => Number.isFinite(value) && value >= 0)) {
                    throw new Error('Invalid legacy usage metadata');
                }
                messages.push({ role: 'assistant', content, api, provider, model,
                    timestamp: time, stopReason: pending.size ? 'toolUse' : 'stop',
                    usage: { input, output, cacheRead, cacheWrite, totalTokens: input + output + cacheRead + cacheWrite,
                        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: Number(record.cost || 0) } } });
            } else {
                let content = [];
                for (const block of blocks) {
                    if (block.type === 'tool_result') {
                        if (block.is_error !== undefined && typeof block.is_error !== 'boolean') throw new Error('Invalid legacy tool result status');
                        if (!pending.has(block.tool_use_id)) throw new Error('Orphaned legacy tool result');
                        if (content.length) { messages.push({ role: 'user', content, timestamp: time }); content = []; }
                        const resultBlocks = typeof block.content === 'string' ? [{ type: 'text', text: block.content }] : block.content;
                        if (!Array.isArray(resultBlocks)) throw new Error('Invalid legacy tool result');
                        messages.push({ role: 'toolResult', toolCallId: block.tool_use_id, toolName: pending.get(block.tool_use_id),
                            content: resultBlocks.map(contentBlock), isError: Boolean(block.is_error), timestamp: time });
                        pending.delete(block.tool_use_id);
                    } else {
                        if (pending.size) throw new Error('User content precedes unresolved tool results');
                        content.push(contentBlock(block));
                    }
                }
                if (content.length) messages.push({ role: 'user', content, timestamp: time });
            }
        }
        if (pending.size || !assistants) throw new Error('Legacy transcript is incomplete');
        return { messages, notes: ['Message content and tool associations are converted; unavailable timing and accounting metadata uses neutral schema defaults, not measured values.'] };
    } catch (error) {
        return { messages: null, reason: error.message };
    }
}
