import { randomUUID } from 'node:crypto';
import { decodeInteraction } from './ui-protocol.mjs';
import { redactSecrets, redactText, SecretStream } from './secrets.mjs';

const toolNames = { read: 'Read', write: 'Write', edit: 'Edit', find: 'Glob', grep: 'Grep',
    bash: 'Bash', powershell: 'Bash', ask_user: 'AskUserQuestion', ls: 'List' };
const textContent = content => (content || []).filter(block => block.type === 'text').map(block => block.text || '').join('\n');

// Translate only protocol events. Prota's Gateway retains ownership of run
// completion, artifacts, file changes, checkpoints and rollback.
export class PiEventAdapter {
    constructor({ runId, emit, setRunState = () => {}, onInteraction = () => {}, onToolResult = () => {}, secrets = [] }) {
        this.runId = runId;
        this.emitEvent = emit;
        this.setRunState = setRunState;
        this.onInteraction = onInteraction;
        this.onToolResult = onToolResult;
        this.textBlocks = new Map();
        this.thinkingBlocks = new Map();
        this.messageId = null;
        this.calls = new Set();
        this.started = new Set();
        this.finished = new Set();
        this.settled = null;
        this.lastMessage = null;
        this.effects = Promise.resolve();
        this.secrets = secrets;
        this.streams = new Map();
    }

    emit(type, payload, options) {
        this.emitEvent(type, redactSecrets({ runId: this.runId, ...payload }, this.secrets), options);
    }

    partial(delta = '') {
        this.messageId ||= randomUUID();
        const text = redactText([...this.textBlocks.entries()].sort(([a], [b]) => a - b).map(([, value]) => value).join('\n'), this.secrets, true);
        this.emit('assistant_message', { text, partial: true },
            { id: this.messageId, replaceId: this.messageId, persist: false });
        if (delta) this.emit('assistant_delta', { text: delta }, { persist: false });
        this.setRunState({ partialAssistantText: text, partialAssistantEventId: this.messageId });
    }

    toolCall(call) {
        if (!call?.id || this.calls.has(call.id)) return;
        this.calls.add(call.id);
        const toolName = toolNames[call.name] || call.name;
        this.emit('tool_call', { toolUseId: call.id, toolName, input: call.arguments || {},
            inputPreview: JSON.stringify(call.arguments || {}).slice(0, 1800), summary: `正在调用 ${toolName}` });
    }

    thinking(index, content, final = false) {
        const block = this.thinkingBlocks.get(index) || { id: randomUUID(), text: '' };
        block.raw = content;
        block.text = redactText(content, this.secrets, !final);
        this.thinkingBlocks.set(index, block);
        this.emit('assistant_thinking', { text: block.text, partial: !final, contentIndex: index },
            { id: block.id, replaceId: block.id, persist: final });
    }

    handle(record) {
        const event = record.assistantMessageEvent;
        switch (record.type) {
        case 'agent_start':
            this.setRunState({ status: 'running', stageMessage: 'Pi 正在执行任务', lastActivityAt: new Date().toISOString() });
            break;
        case 'message_start':
            if (record.message?.role === 'assistant') { this.textBlocks.clear(); this.thinkingBlocks.clear(); this.streams.clear(); this.messageId = null; }
            break;
        case 'message_update':
            if (event?.type === 'text_delta') {
                this.textBlocks.set(event.contentIndex, (this.textBlocks.get(event.contentIndex) || '') + event.delta);
                if (!this.streams.has(event.contentIndex)) this.streams.set(event.contentIndex, new SecretStream(this.secrets));
                this.partial(this.streams.get(event.contentIndex).push(event.delta));
            } else if (event?.type === 'text_end') {
                this.textBlocks.set(event.contentIndex, event.content || '');
                this.partial(this.streams.get(event.contentIndex)?.finish() || '');
            } else if (event?.type === 'thinking_delta') {
                this.thinking(event.contentIndex, (this.thinkingBlocks.get(event.contentIndex)?.raw || '') + event.delta);
            } else if (event?.type === 'thinking_end') {
                this.thinking(event.contentIndex, event.content || '', true);
            } else if (event?.type === 'toolcall_end') this.toolCall(event.toolCall);
            break;
        case 'message_end':
            if (record.message?.role !== 'assistant') break;
            this.lastMessage = record.message;
            for (const [index, block] of (record.message.content || []).entries()) {
                if (block.type === 'toolCall') this.toolCall(block);
                if (block.type === 'thinking') this.thinking(index, block.thinking || '', true);
            }
            {
                const text = textContent(record.message.content).trim();
                if (text || this.messageId) {
                    const id = this.messageId || randomUUID();
                    this.emit('assistant_message', { text, partial: false }, { id, replaceId: id });
                }
                this.textBlocks.clear(); this.messageId = null;
                this.thinkingBlocks.clear();
                this.setRunState({ partialAssistantText: '', partialAssistantEventId: null });
            }
            break;
        case 'tool_execution_start': {
            if (this.started.has(record.toolCallId)) break;
            this.started.add(record.toolCallId);
            const toolName = toolNames[record.toolName] || record.toolName;
            this.emit('tool_started', { toolUseId: record.toolCallId, toolName, input: record.args,
                summary: `正在运行 ${toolName}` });
            this.setRunState({ status: 'running', currentTool: toolName, stageMessage: `正在执行 ${toolName}` });
            break;
        }
        case 'tool_execution_update':
            this.setRunState({ status: 'running', currentTool: toolNames[record.toolName] || record.toolName,
                stageMessage: redactText(textContent(record.partialResult?.content), this.secrets, true).slice(-1200) || '工具正在执行…' });
            break;
        case 'tool_execution_end': {
            if (this.finished.has(record.toolCallId)) break;
            this.finished.add(record.toolCallId);
            const payload = { toolUseId: record.toolCallId, toolName: toolNames[record.toolName] || record.toolName,
                output: textContent(record.result?.content), ok: !record.isError, durationMs: record.durationMs };
            this.emit('sdk_tool_result', payload);
            this.emit('tool_finished', payload);
            this.setRunState({ status: 'running', currentTool: null, stageMessage: record.isError
                ? `${payload.toolName} 执行失败，正在调整…` : '工具执行完成，正在继续思考…' });
            this.effects = this.effects.then(() => this.onToolResult(record));
            // Observe rejection immediately; flush() still propagates it to Gateway.
            this.effects.catch(() => {});
            break;
        }
        case 'compaction_start':
        case 'compaction_end':
            this.emit('sdk_compact', { phase: record.type === 'compaction_start' ? 'start' : 'done',
                summary: record.result?.summary || (record.type === 'compaction_start' ? 'Pi 正在压缩上下文…' : 'Pi 已完成上下文压缩'),
                reason: record.reason, aborted: record.aborted, error: record.errorMessage });
            break;
        case 'extension_ui_request': {
            const interaction = decodeInteraction(record.title || '');
            if (interaction) {
                if (interaction.runId !== this.runId) throw new Error('Pi UI interaction belongs to a different run');
                this.onInteraction(record, interaction);
            } else if (record.method === 'notify') {
                this.emit('sdk_status', { message: record.message || '', level: record.notifyType || 'info' });
            } else if (['select', 'confirm', 'input', 'editor'].includes(record.method)) {
                throw Object.assign(new Error('Pi requested a native dialog that is not mapped to Prota. Use the Prota settings or a supported Prota tool.'),
                    { code: 'PI_UNSUPPORTED_UI' });
            }
            break;
        }
        case 'agent_settled':
            this.settled = record;
            break;
        // agent_end is deliberately not a Prota terminal event: retries and
        // compaction recovery may still continue before agent_settled.
        default:
            break;
        }
    }

    async flush() { await this.effects; }
}
