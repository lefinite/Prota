import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { convertLegacyMessages } from '../server/pi/legacy-migration.mjs';
import { ProtaPiGateway } from '../server/pi/gateway-adapter.mjs';
import { sessionPaths, prepareLegacyRecovery } from '../server/pi/session-adapter.mjs';
import { SessionManager } from '../runtime/pi/node_modules/@earendil-works/pi-coding-agent/dist/index.js';

const metadata = { api: 'openai-completions', provider: 'prota-legacy', model: 'legacy-model' };
const records = [
    { type: 'user', message: { role: 'user', content: 'Create demo.txt.' }, timestamp: '2026-01-01T00:00:00Z' },
    { type: 'assistant', message: { role: 'assistant', content: [
        { type: 'text', text: 'Writing now.' },
        { type: 'tool_use', id: 'old-call-1', name: 'Write', input: { file_path: 'demo.txt', content: 'hello' } }
    ] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'old-call-1', content: 'Saved.' }] } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] }, usage: { input_tokens: 10, output_tokens: 5 } }
];

test('legacy conversion preserves text and tool IDs while adapting native tool argument names', () => {
    const original = JSON.stringify(records);
    const result = convertLegacyMessages(records, metadata);
    assert.equal(result.messages.length, 4);
    assert.equal(result.messages[0].content[0].text, 'Create demo.txt.');
    assert.equal(result.messages[1].content[1].id, 'old-call-1');
    assert.equal(result.messages[1].content[1].name, 'write');
    assert.deepEqual(result.messages[1].content[1].arguments, { path: 'demo.txt', content: 'hello' });
    assert.equal(result.messages[2].role, 'toolResult');
    assert.equal(result.messages[2].toolCallId, 'old-call-1');
    assert.equal(result.messages[3].usage.input, 10);
    assert.equal(JSON.stringify(records), original);
});

test('legacy conversion refuses orphaned, duplicate, incomplete and unknown message formats', () => {
    const samples = [records.slice(0, 2), [records[2]], [records[0], { role: 'assistant', content: [{ type: 'unknown' }] }],
        [...records, records[1], records[2]], [{ role: 'system', content: 'unknown' }],
        [records[0], { ...records[3], usage: { input_tokens: 'not-a-number' } }]];
    for (const sample of samples) {
        const result = convertLegacyMessages(sample, metadata);
        assert.equal(result.messages, null);
        assert.ok(result.reason);
    }
});

test('legacy conversion is committed by real Pi Session APIs and recovers idempotently after a stale Prota snapshot', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-legacy-native-'));
    const workspace = path.join(root, 'workspace'), home = path.join(root, 'home'), config = path.join(root, 'config');
    await fs.mkdir(workspace);
    const gateway = new ProtaPiGateway({ workspaceRoot: () => workspace, configDirectory: config });
    t.after(async () => { await gateway.manager.disposeAll(); await fs.rm(root, { recursive: true, force: true }); });
    const session = { id: 'legacy-test', sdkSessionId: 'old-sdk-test', context: {},
        providerConfig: { provider: 'test', apiType: 'openai-completions', model: 'test-model',
            baseURL: 'http://127.0.0.1:9/v1', apiKey: 'test-only-key', sdkOptions: {} } };
    const paths = sessionPaths(session, workspace, config);
    await fs.mkdir(path.join(workspace, 'data/agent-sessions'), { recursive: true });
    const snapshot = JSON.stringify({ id: session.id, timeline: [{ type: 'assistant_message', payload: { text: 'old' } }] });
    await fs.writeFile(path.join(workspace, 'data/agent-sessions', session.id + '.json'), snapshot);
    const transcriptFile = path.join(home, '.open-agent-sdk/sessions', session.sdkSessionId, 'transcript.json');
    await fs.mkdir(path.dirname(transcriptFile), { recursive: true });
    const transcript = JSON.stringify({ metadata: { cwd: workspace, model: 'legacy-model' }, messages: records });
    await fs.writeFile(transcriptFile, transcript);
    let { runtime, adapted } = await gateway.ensure(session);
    // A native message without the migration commit marker represents a
    // previous import that failed partway through persistence. Use the public
    // native SessionManager writer, without hand-writing native Session JSONL.
    const partial = SessionManager.create(workspace, paths.sessions);
    const converted = convertLegacyMessages(records, { api: session.providerConfig.apiType,
        provider: adapted.providerId, model: session.providerConfig.model }).messages;
    partial.appendMessage(converted[0]); partial.appendMessage(converted[1]);
    const partialFile = partial.getSessionFile();
    await runtime.rpc.request('switch_session', { sessionPath: partialFile });
    session.engineInfo.piSessionId = partial.getSessionId();
    session.engineInfo.piSessionFile = partialFile;
    const partialBytes = await fs.readFile(partialFile, 'utf8');
    session.engineInfo.migrationStatus = 'failed';
    const staleEngine = structuredClone(session.engineInfo);
    const recovery = await prepareLegacyRecovery(session, paths, workspace, { home });
    assert.equal(recovery.mode, 'converted');
    await gateway.importLegacy(session, runtime, paths, recovery);
    assert.equal(session.engineInfo.migrationStatus, 'converted');
    const convertedFile = session.engineInfo.piSessionFile;
    const convertedId = session.engineInfo.piSessionId;
    const native = (await runtime.rpc.request('get_messages')).messages;
    assert.ok(native.some(message => message.role === 'toolResult' && message.toolCallId === 'old-call-1'));
    assert.ok(native.some(message => message.role === 'assistant' && message.content.some(block => block.text === 'Done.')));
    await assert.rejects(fs.access(path.join(workspace, 'demo.txt')), { code: 'ENOENT' });
    await gateway.dispose(session.id);
    session.engineInfo = staleEngine; // Simulate a crash before Prota saved the new mapping.
    ({ runtime } = await gateway.ensure(session));
    await gateway.importLegacy(session, runtime, paths, recovery);
    assert.equal(session.engineInfo.piSessionId, convertedId);
    assert.equal(session.engineInfo.piSessionFile, convertedFile);
    assert.equal((await fs.readdir(paths.sessions)).filter(name => name.endsWith('.jsonl')).length, 2);
    assert.equal(await fs.readFile(partialFile, 'utf8'), partialBytes, 'Retry must preserve the failed branch evidence');
    assert.equal(await fs.readFile(transcriptFile, 'utf8'), transcript);
    assert.equal(await fs.readFile(path.join(paths.backup, 'transcript.json'), 'utf8'), transcript);
    assert.equal(await fs.readFile(path.join(paths.backup, 'snapshot.json'), 'utf8'), snapshot);
});
