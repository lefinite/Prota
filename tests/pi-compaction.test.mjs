import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { PiRuntimeManager } from '../server/pi/runtime-manager.mjs';
import { PiEventAdapter } from '../server/pi/event-adapter.mjs';

test('native automatic compaction settles once, persists a summary and resumes after restart', { timeout: 30000 }, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-pi-compact-'));
    const config = path.join(root, 'config'), sessions = path.join(root, 'sessions');
    await fs.mkdir(config); await fs.mkdir(sessions);
    const requests = [];
    const server = http.createServer(async (req, res) => {
        let raw = ''; for await (const bytes of req) raw += bytes;
        const body = JSON.parse(raw); requests.push(body);
        const text = requests.length >= 3 ? 'Checkpoint: retain COMPACTION_MEMORY and the completed work.' : 'COMPACTION_MEMORY ' + 'completed '.repeat(120);
        const chunk = (delta, finish_reason = null) => ({ id: 'compact-fixture', object: 'chat.completion.chunk', created: 1,
            model: 'fixture', choices: [{ index: 0, delta, finish_reason }] });
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify(chunk({ role: 'assistant', content: text }))}\n\n`);
        res.write(`data: ${JSON.stringify({ ...chunk({}, 'stop'), usage: { prompt_tokens: requests.length <= 2 ? 950 : 50, completion_tokens: 30, total_tokens: requests.length <= 2 ? 980 : 80 } })}\n\n`);
        res.end('data: [DONE]\n\n');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await fs.writeFile(path.join(config, 'models.json'), JSON.stringify({ providers: { fixture: {
        api: 'openai-completions', apiKey: '$PROTA_PI_TEST_KEY', baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
        models: [{ id: 'fixture', input: ['text'], contextWindow: 1024, maxTokens: 128, reasoning: false }]
    } } }));
    await fs.writeFile(path.join(config, 'settings.json'), JSON.stringify({ compaction: { enabled: true, reserveTokens: 128, keepRecentTokens: 128 } }));
    const manager = new PiRuntimeManager({ configure: async () => ({ cwd: root,
        env: { PATH: process.env.PATH, HOME: root, USERPROFILE: root, PI_CODING_AGENT_DIR: config, PI_OFFLINE: '1',
            PI_TELEMETRY: '0', PROTA_PI_TEST_KEY: 'local-only-key', ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) },
        args: ['--provider', 'fixture', '--model', 'fixture', '--session-id', 'compaction-test', '--session-dir', sessions,
            '--no-extensions', '--no-skills', '--no-mcp', '--no-approve', '--tools', 'read'] }) });
    t.after(async () => { await manager.disposeAll(); server.closeAllConnections();
        await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
    const events = [], translated = [];
    const adapter = new PiEventAdapter({ runId: 'compaction', emit: (type, payload) => translated.push({ type, payload }) });
    const onEvent = event => { events.push(event); adapter.handle(event); };
    await manager.prompt('test', { message: 'Remember COMPACTION_MEMORY. ' + 'source requirement '.repeat(200), onEvent });
    await manager.prompt('test', { message: 'Continue the completed work. ' + 'second requirement '.repeat(200), onEvent });
    assert.ok(events.some(event => event.type === 'compaction_start'), JSON.stringify(events.map(event => event.type)));
    assert.ok(events.some(event => event.type === 'compaction_end' && event.result?.summary.includes('COMPACTION_MEMORY')));
    assert.equal(events.filter(event => event.type === 'agent_settled').length, 2);
    assert.ok(translated.some(event => event.type === 'sdk_compact' && event.payload.phase === 'done'));
    const files = (await fs.readdir(sessions)).filter(name => name.endsWith('.jsonl'));
    const transcript = await fs.readFile(path.join(sessions, files[0]), 'utf8');
    assert.ok(transcript.split('\n').filter(Boolean).map(line => JSON.parse(line)).some(entry => entry.type === 'compaction'));
    await manager.dispose('test');
    const resumed = await manager.prompt('test', { message: 'Recall our compacted memory.', onEvent });
    assert.ok(resumed.message.content.some(block => block.text?.includes('COMPACTION_MEMORY')));
    assert.ok(JSON.stringify(requests.at(-1).messages).includes('Checkpoint: retain COMPACTION_MEMORY'));
    assert.equal(events.filter(event => event.type === 'agent_settled').length, 3);
});
