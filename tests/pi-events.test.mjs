import test from 'node:test';
import assert from 'node:assert/strict';
import { PiEventAdapter } from '../server/pi/event-adapter.mjs';
import { encodeInteraction } from '../server/pi/ui-protocol.mjs';

function harness(options = {}) {
    const events = [], state = {};
    const adapter = new PiEventAdapter({ runId: 'run-1', emit: (type, payload, settings) => events.push({ type, payload, settings }),
        setRunState: next => Object.assign(state, next), ...options });
    const update = event => adapter.handle({ type: 'message_update', assistantMessageEvent: event });
    return { events, state, adapter, update };
}

test('SSE adapter reconstructs blocks and replaces the partial using a stable message ID', () => {
    const { events, state, adapter, update } = harness();
    adapter.handle({ type: 'message_start', message: { role: 'assistant' } });
    update({ type: 'text_delta', contentIndex: 0, delta: 'hello ' });
    update({ type: 'text_delta', contentIndex: 0, delta: 'draft' });
    update({ type: 'text_end', contentIndex: 0, content: 'hello corrected' });
    adapter.handle({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'authoritative final' }] } });
    const messages = events.filter(event => event.type === 'assistant_message');
    assert.equal(new Set(messages.map(message => message.settings.id)).size, 1);
    assert.equal(messages.at(-1).payload.text, 'authoritative final');
    assert.equal(messages.at(-1).payload.partial, false);
    assert.equal(events.filter(event => event.type === 'assistant_delta').map(event => event.payload.text).join(''), 'hello draft');
    assert.equal(state.partialAssistantText, '');
    assert.equal(state.partialAssistantEventId, null);
    update({ type: 'text_delta', contentIndex: 0, delta: 'next message' });
    assert.notEqual(events.at(-2).settings.id, messages[0].settings.id);
});

test('SSE adapter accumulates thinking under one replaceable ID and accepts final-only thinking', () => {
    const { events, adapter, update } = harness();
    update({ type: 'thinking_delta', contentIndex: 0, delta: '思' });
    update({ type: 'thinking_delta', contentIndex: 0, delta: '考' });
    update({ type: 'thinking_end', contentIndex: 0, content: '完整思考' });
    const thinking = events.filter(event => event.type === 'assistant_thinking');
    assert.equal(new Set(thinking.map(event => event.settings.id)).size, 1);
    assert.equal(thinking.at(-1).payload.text, '完整思考');
    assert.equal(thinking.at(-1).settings.persist, true);
    adapter.handle({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'thinking', thinking: '最终内容' }] } });
    assert.equal(events.at(-1).payload.text, '最终内容');
});

test('tool calls and lifecycle results pair by tool ID and deduplicate repeated events', async () => {
    let results = 0;
    const { events, adapter, update } = harness({ onToolResult: async () => { results++; } });
    const call = { id: 'tool-1', name: 'write', arguments: { path: 'index.html', content: 'hello' } };
    update({ type: 'toolcall_end', contentIndex: 0, toolCall: call });
    adapter.handle({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'toolCall', ...call }] } });
    for (let i = 0; i < 2; i++) {
        adapter.handle({ type: 'tool_execution_start', toolCallId: call.id, toolName: 'write', args: call.arguments });
        adapter.handle({ type: 'tool_execution_end', toolCallId: call.id, toolName: 'write', isError: true,
            result: { content: [{ type: 'text', text: 'write failed' }] } });
    }
    await adapter.flush();
    for (const type of ['tool_call', 'tool_started', 'sdk_tool_result', 'tool_finished']) {
        assert.equal(events.filter(event => event.type === type).length, 1, type);
    }
    assert.equal(events.find(event => event.type === 'sdk_tool_result').payload.ok, false);
    assert.equal(results, 1);
});

test('agent_end cannot produce a terminal Prota event; settled remains Gateway-owned', () => {
    const { events, adapter } = harness();
    adapter.handle({ type: 'agent_end', willRetry: true });
    adapter.handle({ type: 'compaction_start', reason: 'overflow' });
    adapter.handle({ type: 'compaction_end', reason: 'overflow', result: { summary: 'compacted' } });
    assert.equal(adapter.settled, null);
    adapter.handle({ type: 'agent_settled', aborted: false });
    assert.equal(adapter.settled.aborted, false);
    assert.deepEqual(events.map(event => event.type), ['sdk_compact', 'sdk_compact']);
});

test('SSE interaction routing uses versioned metadata and rejects cross-run UI requests', () => {
    const interactions = [];
    const { adapter } = harness({ onInteraction: (request, interaction) => interactions.push({ request, interaction }) });
    const title = encodeInteraction({ kind: 'question', runId: 'run-1', question: '选择语言' });
    adapter.handle({ type: 'extension_ui_request', id: 'dialog-1', method: 'select', title });
    assert.equal(interactions[0].request.id, 'dialog-1');
    assert.equal(interactions[0].interaction.question, '选择语言');
    assert.throws(() => adapter.handle({ type: 'extension_ui_request', title:
        encodeInteraction({ kind: 'approval', runId: 'different-run' }) }), /different run/);
    assert.throws(() => adapter.handle({ type: 'extension_ui_request', method: 'select', id: 'unmapped', title: 'Native settings' }),
        error => error.code === 'PI_UNSUPPORTED_UI');
});
