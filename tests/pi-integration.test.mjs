import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { PiRuntimeManager } from '../server/pi/runtime-manager.mjs';
import { verifyPi } from '../scripts/verify-pi.mjs';
import { piRuntime } from '../scripts/pi-paths.mjs';
import { decodeInteraction } from '../server/pi/ui-protocol.mjs';
import { PiEventAdapter } from '../server/pi/event-adapter.mjs';

// Actual source-built Pi subprocess and native tools, with a deterministic local
// HTTP model endpoint. This covers engine integration, not vendor API acceptance.
test('built Pi executes a native file tool, persists context and resumes after process restart', async t => {
    await verifyPi(undefined, { smoke: false });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-pi-integration-'));
    const workspace = path.join(root, 'workspace');
    const config = path.join(root, 'config');
    const sessions = path.join(root, 'sessions');
    await Promise.all([workspace, config, sessions].map(directory => fs.mkdir(directory)));
    const requests = [];
    const server = http.createServer(async (req, res) => {
        let data = '';
        for await (const bytes of req) data += bytes;
        const body = JSON.parse(data);
        requests.push(body);
        const hasToolResult = body.messages.some(message => message.role === 'tool');
        const lastUserIndex = body.messages.findLastIndex(message => message.role === 'user');
        const askQuestion = JSON.stringify(body.messages[lastUserIndex]).includes('Ask a question');
        const questionAnswered = body.messages.slice(lastUserIndex + 1).some(message => message.role === 'tool');
        const chunk = delta => ({ id: 'local-completion', object: 'chat.completion.chunk', created: 1,
            model: 'fixture-model', choices: [{ index: 0, delta, finish_reason: null }] });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        res.write(`data: ${JSON.stringify(chunk({ role: 'assistant' }))}\n\n`);
        if (askQuestion && !questionAnswered) {
            res.write(`data: ${JSON.stringify(chunk({ tool_calls: [{ index: 0, id: 'ask-choice', type: 'function',
                function: { name: 'ask_user', arguments: JSON.stringify({ question: '选择语言', options: ['中文', 'English'], allowFreeText: false }) } }] }))}\n\n`);
        } else if (!hasToolResult) {
            res.write(`data: ${JSON.stringify(chunk({ tool_calls: [{ index: 0, id: 'write-demo', type: 'function',
                function: { name: 'write', arguments: JSON.stringify({ path: 'demo.txt', content: 'native-pi-file' }) } }] }))}\n\n`);
        } else res.write(`data: ${JSON.stringify(chunk({ content: 'Native tool result retained in context.' }))}\n\n`);
        res.write(`data: ${JSON.stringify({ ...chunk({}), choices: [{ index: 0, delta: {},
            finish_reason: (!hasToolResult || (askQuestion && !questionAnswered)) ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 } })}\n\n`);
        res.end('data: [DONE]\n\n');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    await fs.writeFile(path.join(config, 'models.json'), JSON.stringify({ providers: {
        'prota-fixture': { baseUrl, api: 'openai-completions', apiKey: '$PROTA_PI_TEST_KEY', models: [
            { id: 'fixture-model', reasoning: false, input: ['text'], contextWindow: 32000, maxTokens: 1000 }
        ] }
    } }));
    const policyFile = path.join(config, 'run.json');
    await fs.writeFile(policyFile, JSON.stringify({ schemaVersion: 1, runId: 'integration-run', workspaceRoot: workspace,
        allowedTools: ['Read', 'Write', 'AskUserQuestion'], permissionMode: 'default',
        systemContext: 'Prota test context', maxTurns: 10 }));
    const runtimes = new PiRuntimeManager({ configure: async () => ({ cwd: workspace,
        env: { PATH: process.env.PATH, HOME: root, USERPROFILE: root, PI_CODING_AGENT_DIR: config,
            PI_OFFLINE: '1', PI_TELEMETRY: '0', PROTA_PI_TEST_KEY: 'local-test-only', PROTA_PI_RUN_CONFIG: policyFile,
            ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) },
        args: ['--session-id', 'integration-session', '--session-dir', sessions,
            '--provider', 'prota-fixture', '--model', 'fixture-model', '--tools', 'read,write,ask_user',
            '--no-extensions', '--extension', path.join(piRuntime, 'extensions/prota-extension.mjs'),
            '--no-skills', '--no-mcp', '--no-approve']
    }) });
    t.after(async () => {
        await runtimes.disposeAll();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await fs.rm(root, { recursive: true, force: true });
    });
    const events = [];
    const compatibilityEvents = [];
    const eventAdapter = new PiEventAdapter({ runId: 'integration-run',
        emit: (type, payload, options) => compatibilityEvents.push({ type, payload, options }),
        onInteraction: (event, interaction) => {
            void runtimes.get('test').rpc.respondToUI(event.id,
                { value: interaction.kind === 'approval' ? 'allow_once' : '中文' });
        } });
    function onEvent(event) {
        events.push(event);
        eventAdapter.handle(event);
    }
    const first = await runtimes.prompt('test', { message: 'Write demo.txt using the write tool.', onEvent });
    assert.equal(first.aborted, false);
    assert.equal(await fs.readFile(path.join(workspace, 'demo.txt'), 'utf8'), 'native-pi-file');
    assert.ok(events.some(event => event.type === 'tool_execution_end' && event.toolName === 'write'));
    assert.ok(events.some(event => event.type === 'extension_ui_request' && decodeInteraction(event.title || '')?.kind === 'approval'));
    assert.equal(events.at(-1).type, 'agent_settled');
    await eventAdapter.flush();
    assert.ok(compatibilityEvents.some(event => event.type === 'sdk_tool_result' && event.payload.toolName === 'Write'));
    assert.equal(compatibilityEvents.filter(event => event.type === 'assistant_message' && event.payload.partial === false).length, 1);
    assert.equal(requests.length, 2);
    assert.ok(JSON.stringify(requests[0].messages).includes('Prota test context'));
    const firstPid = runtimes.get('test').child.pid;
    await runtimes.dispose('test');
    const nativeFiles = await fs.readdir(sessions);
    assert.equal(nativeFiles.filter(name => name.endsWith('.jsonl')).length, 1);
    const transcript = await fs.readFile(path.join(sessions, nativeFiles.find(name => name.endsWith('.jsonl'))), 'utf8');
    assert.ok(transcript.includes('write-demo'));
    const second = await runtimes.prompt('test', { message: 'Continue using our previous tool result.' });
    assert.equal(second.aborted, false);
    assert.notEqual(runtimes.get('test').child.pid, firstPid);
    assert.equal(requests.length, 3);
    assert.ok(requests[2].messages.some(message => message.role === 'tool'));
    assert.ok(requests[2].messages.some(message => JSON.stringify(message.content).includes('Write demo.txt')));
    await runtimes.prompt('test', { message: 'Ask a question using ask_user.', onEvent });
    assert.ok(events.some(event => event.type === 'extension_ui_request' && decodeInteraction(event.title || '')?.kind === 'question'),
        JSON.stringify(events.filter(event => ['tool_execution_end', 'extension_error'].includes(event.type))));
    assert.ok(requests.at(-1).messages.some(message => message.role === 'tool' && JSON.stringify(message.content).includes('中文')));
});
