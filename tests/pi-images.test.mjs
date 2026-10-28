import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { ProtaPiGateway } from '../server/pi/gateway-adapter.mjs';

test('native Pi sends uploaded images to the declared vision model and preserves them in Session history', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-pi-image-'));
    const gateway = new ProtaPiGateway({ workspaceRoot: () => root, configDirectory: path.join(root, 'config') });
    const requests = [];
    const server = http.createServer(async (req, res) => {
        let raw = ''; for await (const bytes of req) raw += bytes;
        requests.push(JSON.parse(raw));
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const chunk = (delta, finish_reason = null) => ({ id: 'image-test', object: 'chat.completion.chunk', created: 1,
            model: 'vision-fixture', choices: [{ index: 0, delta, finish_reason }] });
        res.write(`data: ${JSON.stringify(chunk({ role: 'assistant', content: 'Image received' }))}\n\n`);
        res.write(`data: ${JSON.stringify(chunk({}, 'stop'))}\n\n`);
        res.end('data: [DONE]\n\n');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { await gateway.manager.disposeAll(); server.closeAllConnections();
        await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
    const session = { id: 'image-session', providerConfig: { provider: 'custom', model: 'vision-fixture',
        apiType: 'openai-completions', apiKey: 'local-only-key', baseURL: `http://127.0.0.1:${server.address().port}/v1`,
        modelCapabilities: { input: ['text', 'image'], contextWindow: 32000, maxTokens: 1000 }, sdkOptions: {} } };
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIAAQMAAADOtka5AAAABlBMVEX/AAAAAABBoxIDAAAANklEQVR42u3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8G4IAAAFjdVCkAAAAAElFTkSuQmCC';
    const events = [], states = [];
    const result = await gateway.run(session, { runId: 'image-run', options: { allowedTools: [], includePartialMessages: false },
        prompt: [{ type: 'text', text: 'Describe the attached image.' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } }],
        emit: (type, payload) => events.push({ type, payload }), setRunState: patch => states.push(patch), approval: async () => 'deny', question: async () => undefined });
    assert.equal(result.result, 'Image received');
    assert.ok(!events.some(event => event.type === 'assistant_delta' || event.payload.partial));
    assert.equal(events.filter(event => event.type === 'assistant_message').length, 1);
    assert.ok(!states.some(patch => patch.partialAssistantText));
    const user = requests[0].messages.find(message => message.role === 'user');
    assert.ok(user.content.some(block => block.type === 'image_url' && /^data:image\/(png|jpeg|webp);base64,/.test(block.image_url.url)), JSON.stringify(user));
    assert.ok(user.content.some(block => block.type === 'text' && block.text.includes('Describe the attached image')));
    const native = await gateway.messages(session);
    assert.ok(native.some(message => message.role === 'user' && message.content.some(block => block.type === 'image' && block.mimeType.startsWith('image/'))));
    await gateway.dispose(session.id);
    const restored = await gateway.messages(session);
    assert.ok(restored.some(message => message.role === 'user' && message.content.some(block => block.type === 'image')));
    session.providerConfig.modelCapabilities = { input: ['text'] };
    await assert.rejects(gateway.run(session, { runId: 'text-only', options: {},
        prompt: [{ type: 'image', data: png, mimeType: 'image/png' }], emit: () => {} }), /image input support/);
    assert.equal(requests.length, 1, 'Text-only capability rejection must precede any model request');
});
