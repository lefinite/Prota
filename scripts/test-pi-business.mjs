import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { productRoot } from './pi-paths.mjs';

// Opt-in real Gateway + real configured provider + unchanged business Skill.
// All generated files and sessions live in a new temporary workspace.
const { values } = parseArgs({ options: { provider: { type: 'string' }, direct: { type: 'boolean' },
    scenario: { type: 'string', default: 'mobile' } } });
const scenarios = {
    mobile: { device: 'mobile', page: 'reading-list', message: '新增一个手机端阅读书单页面，page_id 固定为 reading-list。展示正在阅读、想读、已读三个分类和有实际内容的书目；支持切换分类、搜索书名、收藏/取消收藏并持久化。使用本地 CSS 和 JS，自包含，不依赖远程图片。交付可交互原型，同步项目配置。' },
    web: { device: 'web', page: 'reading-dashboard', message: '新增一个 Web 阅读运营 Dashboard，page_id 固定为 reading-dashboard。包含侧边导航、时间范围筛选、阅读趋势、活跃读者、热门书籍表格、来源分布；至少12行有意义的演示数据，筛选、表格排序、搜索、导航均有真实交互反馈。图表使用自包含 SVG 或 Canvas，不依赖外部 CDN。遵循现有 Skill 与项目规范并同步配置。' },
    canvas: { device: 'canvas', page: 'reading-flow', message: '新增一个页面级无限画布阅读产品原型，page_id 固定为 reading-flow。一次生成三个有完整业务内容的画板：书架、阅读器、阅读统计。完整复制无限画布模板，保存 pageMode=infinite-canvas；每个画板自包含，书架支持搜索和收藏，阅读器支持字号和夜间模式，统计支持7/30天切换。使用稳定画板 ID 和本地资源，保持画布工具栏与布局保存能力。同步项目配置。' }
};
const scenario = scenarios[values.scenario];
if (!scenario) throw new Error('scenario must be mobile, web or canvas');
const store = JSON.parse(await fs.readFile(path.join(process.env.READIFY_CONFIG_DIR || path.join(os.homedir(), '.config/prota'), 'agent-provider-config.json'), 'utf8'));
const selected = store.providers.find(provider => provider.id === (values.provider || store.activeProviderId));
if (!selected?.apiKey) throw new Error('The selected local provider has no API key');
const root = await fs.mkdtemp(path.join(os.tmpdir(), `prota-pi-business-${values.scenario}-`));
const workspace = path.join(root, 'workspace'), config = path.join(root, 'config');
await fs.mkdir(path.join(workspace, 'data'), { recursive: true });
await fs.mkdir(path.join(workspace, 'src/pages'), { recursive: true });
await fs.mkdir(path.join(workspace, 'portal'));
await fs.mkdir(config);
const projectId = `acceptance-${randomUUID().slice(0, 8)}`;
const metadata = { activeProjectId: projectId, projects: [{ id: projectId, name: '阅读产品验收', pages: [] }] };
await fs.writeFile(path.join(workspace, 'workspace.json'), JSON.stringify({ id: projectId, formatVersion: 1 }));
await fs.writeFile(path.join(workspace, 'data/projects.json'), JSON.stringify(metadata, null, 2));
await fs.writeFile(path.join(workspace, 'portal/shell.js'), `const defaultData = ${JSON.stringify(metadata)};\n`);
const allocate = http.createServer();
await new Promise(resolve => allocate.listen(0, '127.0.0.1', resolve));
const port = allocate.address().port;
await new Promise(resolve => allocate.close(resolve));
const base = `http://127.0.0.1:${port}`;
const environment = { ...process.env, HOME: root, USERPROFILE: root, READIFY_WORKSPACE: workspace,
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(),
        ...(process.platform === 'darwin' ? ['Library', 'Caches'] : process.platform === 'win32' ? ['AppData', 'Local'] : ['.cache']), 'ms-playwright'),
    READIFY_CONFIG_DIR: config, READIFY_AGENT_PORT: String(port) };
if (values.direct) for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) delete environment[key];
const child = spawn(process.execPath, [path.join(productRoot, 'server/agent-server.mjs')], { cwd: productRoot,
    env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
child.stdout.on('data', bytes => { logs += bytes; });
child.stderr.on('data', bytes => { logs += bytes; });
const report = { kind: 'real-business-gateway', scenario: values.scenario, model: selected.model,
    providerId: selected.id,
    projectId, startedAt: new Date().toISOString(), status: 'running', workspace, toolErrors: [], events: {},
    gates: { browser: 'pending', interactions: 'pending', visualReview: 'pending', qualityComparison: 'pending' } };
const providerConfig = { ...selected, provider: selected.presetId || selected.id,
    sdkOptions: { ...selected.sdkOptions, permissionMode: 'bypassPermissions', maxTurns: 200 } };
async function json(route, body) {
    const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data;
}
try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
        if (child.exitCode !== null) throw new Error('Gateway exited during startup');
        try { if ((await fetch(`${base}/api/agent/health`)).ok) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('Gateway health did not become ready');
    const context = { projectId, globalContext: true, sessionScope: 'global', targetDevice: scenario.device };
    const session = await json('/api/agent/session', { ...context, providerConfig });
    report.sessionId = session.sessionId;
    const response = await fetch(`${base}/api/agent/session/${session.sessionId}/skills/create-new-page/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20 * 60_000),
        body: JSON.stringify({ ...context, providerConfig, message: scenario.message }) });
    if (!response.ok) throw new Error(await response.text());
    let pending = ''; const decoder = new TextDecoder();
    const timeline = [];
    for await (const bytes of response.body) {
        pending += decoder.decode(bytes, { stream: true });
        let boundary;
        while ((boundary = pending.indexOf('\n\n')) >= 0) {
            const block = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
            const data = block.split('\n').find(line => line.startsWith('data:'));
            if (!data) continue;
            const event = JSON.parse(data.slice(5));
            report.events[event.type] = (report.events[event.type] || 0) + 1;
            if (['run_failed', 'run_finished', 'sdk_result', 'run_changes'].includes(event.type)) timeline.push(event);
            if (event.type === 'tool_finished' && !event.payload.ok) report.toolErrors.push(event.payload);
            if (event.type === 'question_request') throw new Error('Business run requires human input; inspect retained history');
            if (event.type === 'approval_request') throw new Error('Unexpected approval in isolated bypass acceptance');
        }
    }
    report.terminals = timeline;
    assert.equal(report.events.run_failed || 0, 0, 'Gateway run failed');
    assert.equal(report.events.run_finished, 1, 'Missing unique successful Gateway terminal');
    const current = JSON.parse(await fs.readFile(path.join(workspace, 'data/projects.json'), 'utf8'));
    const page = current.projects.find(project => project.id === projectId)?.pages.find(page => page.id === scenario.page);
    assert.equal(page?.targetDevice, scenario.device, 'Page registration/device differs from requested scenario');
    if (values.scenario === 'canvas') assert.equal(page.pageMode, 'infinite-canvas');
    const directory = path.join(workspace, 'src/pages', projectId, scenario.page, 'v1');
    for (const name of ['index.html', 'styles.css', 'app.js']) assert.ok((await fs.stat(path.join(directory, name))).size > 0, name);
    const snapshot = await fs.readFile(path.join(workspace, 'portal/shell.js'), 'utf8');
    const snapshotJson = snapshot.match(/\b(?:const|let|var)\s+defaultData\s*=\s*([\s\S]*);\s*$/)?.[1];
    assert.ok(snapshotJson, 'Portal metadata snapshot must contain defaultData');
    assert.deepEqual(JSON.parse(snapshotJson), current, 'Project metadata and Portal snapshot diverged');
    report.pageDirectory = directory;
    report.status = 'generation-passed';
} catch (error) {
    report.status = 'failed'; report.error = String(error.message || error); process.exitCode = 1;
} finally {
    if (child.exitCode === null) {
        const closed = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM');
        const timer = setTimeout(() => child.kill('SIGKILL'), 10_000); await closed; clearTimeout(timer);
    }
    const redact = value => value.split(selected.apiKey).join('[REDACTED]');
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(root, 'gateway.log'), redact(logs));
    await fs.writeFile(path.join(root, 'report.json'), redact(JSON.stringify(report, null, 2)));
    console.log(JSON.stringify({ status: report.status, scenario: values.scenario, reportFile: path.join(root, 'report.json'), workspace,
        error: report.error ? redact(report.error) : undefined }));
}
