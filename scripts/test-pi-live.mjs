import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { ProtaPiGateway } from '../server/pi/gateway-adapter.mjs';

// Explicit, opt-in real-provider acceptance. Never part of agent:test or CI.
const { values } = parseArgs({ options: { provider: { type: 'string' }, direct: { type: 'boolean' } } });
const configRoot = process.env.READIFY_CONFIG_DIR || path.join(os.homedir(), '.config/prota');
const store = JSON.parse(await fs.readFile(path.join(configRoot, 'agent-provider-config.json'), 'utf8'));
const selected = store.providers.find(item => item.id === (values.provider || store.activeProviderId));
if (!selected?.apiKey) throw new Error('The selected local provider has no API key');
if (values.direct) {
    for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) delete process.env[key];
}
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-pi-live-'));
const workspace = path.join(root, 'workspace');
await fs.mkdir(workspace);
const gateway = new ProtaPiGateway({ workspaceRoot: () => workspace, configDirectory: path.join(root, 'config') });
const session = { id: randomUUID(), providerConfig: { ...selected, provider: selected.presetId || selected.id,
    sdkOptions: { ...selected.sdkOptions, permissionMode: 'bypassPermissions', maxTurns: 12 } } };
const marker = `PI_MEMORY_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const report = { kind: 'real-provider', model: selected.model, provider: selected.presetId || selected.id,
    apiType: selected.apiType, endpoint: new URL(selected.baseURL).origin, startedAt: new Date().toISOString(),
    scenarios: [], status: 'running' };
async function run(name, prompt, tools) {
    const seen = [];
    const result = await gateway.run(session, { prompt, runId: randomUUID(),
        options: { allowedTools: tools, permissionMode: 'bypassPermissions', maxTurns: 12, requestTimeoutMs: 180000 },
        emit: (type, payload) => { if (type === 'tool_finished') seen.push({ tool: payload.toolName, ok: payload.ok }); },
        setRunState: () => {}, approval: async () => 'deny', question: async () => { throw new Error('No user dialog in this acceptance task'); } });
    report.scenarios.push({ name, status: 'passed', durationMs: result.duration_ms, usage: result.usage,
        turns: result.num_turns, tools: seen });
    return result;
}
try {
    const first = await run('text-and-memory', `Remember the exact marker ${marker}. Reply with the marker only.`, []);
    assert.ok(first.result.includes(marker));
    const second = await run('multi-tool-and-context',
        'Using the write tool, create pi-check.txt containing the exact marker I gave you earlier. Then use the read tool to verify the file. Finish with the marker.',
        ['Write', 'Read']);
    assert.equal((await fs.readFile(path.join(workspace, 'pi-check.txt'), 'utf8')).trim(), marker);
    assert.ok(report.scenarios.at(-1).tools.some(tool => tool.tool === 'Write' && tool.ok));
    assert.ok(report.scenarios.at(-1).tools.some(tool => tool.tool === 'Read' && tool.ok));
    assert.ok(second.result.includes(marker));
    await gateway.dispose(session.id);
    const resumed = await run('restart-and-native-session', 'Without reading files, reply with the exact marker from our earlier conversation.', []);
    assert.ok(resumed.result.includes(marker));
    report.status = 'passed';
} catch (error) {
    report.status = 'failed';
    report.error = String(error.message || error).split(selected.apiKey).join('[REDACTED]');
    process.exitCode = 1;
} finally {
    await gateway.manager.disposeAll();
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, reportFile: path.join(root, 'report.json') }, null, 2));
}
