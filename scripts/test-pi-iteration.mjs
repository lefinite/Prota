import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { productRoot } from './pi-paths.mjs';

// Continue a successful isolated business acceptance session through the real
// Gateway, retaining the original files and native Pi conversation.
const { values } = parseArgs({ options: { report: { type: 'string' }, direct: { type: 'boolean' }, task: { type: 'string', default: 'iterate' } } });
if (!['iterate', 'prd', 'canvas-edit', 'edit-v2'].includes(values.task)) throw new Error('--task must be iterate, prd, canvas-edit or edit-v2');
const prd = values.task === 'prd';
const editCanvas = values.task === 'canvas-edit', editV2 = values.task === 'edit-v2';
const editing = editCanvas || editV2;
if (!values.report) throw new Error('--report requires a prior test-pi-business report');
const prior = JSON.parse(await fs.readFile(values.report, 'utf8'));
if (prior.kind !== 'real-business-gateway' || prior.status !== 'generation-passed'
    || !path.basename(path.dirname(values.report)).startsWith('prota-pi-business-')) throw new Error('Expected an isolated successful business acceptance report');
const root = path.dirname(values.report), workspace = prior.workspace, config = path.join(root, 'config');
const pageId = path.basename(path.dirname(prior.pageDirectory));
const v1 = prd || editV2 ? path.join(path.dirname(prior.pageDirectory), 'v2') : prior.pageDirectory;
const v2 = path.join(path.dirname(v1), 'v2');
if (!prd && !editing) {
try { await fs.access(v2); throw new Error('v2 already exists; refusing to overwrite a previous acceptance run'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await fs.mkdir(path.join(v1, 'docs'), { recursive: true });
await fs.writeFile(path.join(v1, 'docs/acceptance-note.md'), '# v1 业务约束\n\n保留正在阅读、想读、已读分类和书名搜索；收藏应当刷新后保留。\n');
} else if (prd) {
    const annotationsFile = path.join(v1, 'annotations.json');
    let annotations = []; try { annotations = JSON.parse(await fs.readFile(annotationsFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!annotations.some(item => item.id === 'acceptance-fav-filter')) annotations.push({ id: 'acceptance-fav-filter',
        selector: '#favOnlyToggle', text: '仅看收藏应当和当前分类、书名搜索组合筛选；开关和收藏状态都应刷新后保留。',
        label: '仅看收藏组合筛选', createdAt: new Date().toISOString() });
    await fs.writeFile(annotationsFile, JSON.stringify(annotations, null, 2));
}
async function hashes(directory) {
    const result = {};
    async function visit(current) {
        for (const entry of await fs.readdir(current, { withFileTypes: true })) {
            const file = path.join(current, entry.name);
            if (entry.isDirectory()) await visit(file);
            else result[path.relative(directory, file)] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
        }
    }
    await visit(directory); return result;
}
const original = await hashes(v1);
const preservedV1 = editV2 ? await hashes(prior.pageDirectory) : null;
const originalMetadata = editing ? await fs.readFile(path.join(workspace, 'data/projects.json'), 'utf8') : null;
const originalShell = editing ? await fs.readFile(path.join(workspace, 'portal/shell.js'), 'utf8') : null;
const providers = JSON.parse(await fs.readFile(path.join(process.env.READIFY_CONFIG_DIR || path.join(os.homedir(), '.config/prota'), 'agent-provider-config.json'), 'utf8'));
const selected = providers.providers.find(item => item.id === prior.providerId)
    || providers.providers.find(item => item.model === prior.model && item.apiKey);
if (!selected?.apiKey || selected.model !== prior.model) throw new Error('The original configured model is unavailable');
const allocate = http.createServer(); await new Promise(resolve => allocate.listen(0, '127.0.0.1', resolve));
const port = allocate.address().port; await new Promise(resolve => allocate.close(resolve));
const env = { ...process.env, HOME: root, USERPROFILE: root, READIFY_WORKSPACE: workspace, READIFY_CONFIG_DIR: config, READIFY_AGENT_PORT: String(port) };
env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(),
    ...(process.platform === 'darwin' ? ['Library', 'Caches'] : process.platform === 'win32' ? ['AppData', 'Local'] : ['.cache']), 'ms-playwright');
if (values.direct) for (const name of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy']) delete env[name];
const child = spawn(process.execPath, [path.join(productRoot, 'server/agent-server.mjs')], { cwd: productRoot, env, stdio: ['ignore','pipe','pipe'] });
let logs = ''; child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
const report = { kind: prd ? 'real-business-prd' : editing ? `real-business-${values.task}` : 'real-business-iteration', model: prior.model, sessionId: prior.sessionId, workspace,
    startedAt: new Date().toISOString(), status: 'running', events: {}, toolErrors: [], gates: { browser: 'pending', interactions: 'pending' } };
try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 150; i++) {
        if (child.exitCode !== null) throw new Error('Gateway startup failed');
        try { if ((await fetch(`${base}/api/agent/health`)).ok) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Gateway did not start');
    const endpoint = prd ? 'skills/generate-business-prd/run' : 'message';
    const response = await fetch(`${base}/api/agent/session/${prior.sessionId}/${endpoint}`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20 * 60_000), body: JSON.stringify({
            projectId: prior.projectId, pageId, version: prd || editV2 ? 'v2' : 'v1', targetDevice: editCanvas ? 'canvas' : 'mobile', sessionScope: 'page', globalContext: false,
            providerConfig: { ...selected, provider: selected.presetId || selected.id,
                sdkOptions: { ...selected.sdkOptions, permissionMode: 'bypassPermissions', maxTurns: 200 } },
            message: editCanvas
                ? '请修改当前已有的无限画布，只为阅读器画板 board-reader（boards/reader/）增加书签开关，开启/取消要有明确状态，刷新后保留。先读取最新 canvas-data.js 和阅读器源码，不创建页面或版本，不修改 canvas-data.js、其他画板、画布运行文件或两份项目配置，保持所有现有对象 ID、布局和关联。只修改 boards/reader/ 内的业务界面文件，保留已有阅读、字号和夜间模式。'
                : editV2
                ? '请在当前书单 v2 继续编辑，不创建版本。搜索有关键词时，在搜索框附近展示组合筛选后的结果数量；清空关键词后隐藏该结果数量。结果需要同时遵循分类和仅看收藏开关。只修改 v2 的业务界面文件，保留既有功能、手机框和 v1 所有文件，保持两份项目配置原样。'
                : prd
                ? '请使用当前业务 AI-Ready PRD Skill，为阅读书单 v2 的“仅看收藏组合筛选”生成中文图文 PRD。综合新增标注、v1 业务文档、v2 源码、DOM 和真实功能截图，说明收藏筛选与分类、搜索的组合规则及刷新持久化。截图必须展示开关开启状态、分类组合状态、搜索空结果状态，读取截图元数据确认目标可见。保存到页面级 docs，不修改原型或覆盖其他文档。完整遵守现有 Skill 和引用规范。'
                : '请按“迭代版本”流程，将当前阅读书单 v1 完整复制成 v2，只修改 v2，不要新增页面。先读取 v1/docs/acceptance-note.md 并保留该文档。v2 增加“仅看收藏”筛选开关，和现有分类及搜索组合生效；保留现有功能与收藏持久化。更新工作区的两份项目配置使 v1/v2 均可切换，v1 所有文件保持原样。完成后检查页面脚本。'
        }) });
    if (!response.ok) throw new Error(await response.text());
    let pending = ''; const decoder = new TextDecoder();
    for await (const bytes of response.body) {
        pending += decoder.decode(bytes, { stream: true }); let boundary;
        while ((boundary = pending.indexOf('\n\n')) >= 0) {
            const block = pending.slice(0,boundary); pending = pending.slice(boundary + 2);
            const data = block.split('\n').find(line => line.startsWith('data:')); if (!data) continue;
            const event = JSON.parse(data.slice(5)); report.events[event.type] = (report.events[event.type] || 0) + 1;
            if (event.type === 'tool_finished' && !event.payload.ok) report.toolErrors.push(event.payload);
            if (event.type === 'run_finished') report.result = event.payload;
            if (event.type === 'run_failed') throw new Error(event.payload.reason);
            if (['question_request','approval_request'].includes(event.type)) throw new Error('Acceptance requires user interaction; inspect retained session');
        }
    }
    assert.equal(report.events.run_finished,1);
    if (editing) {
        const after = await hashes(v1);
        const changed = [...new Set([...Object.keys(original), ...Object.keys(after)])].filter(name => original[name] !== after[name]);
        assert.ok(changed.length, 'The requested edit did not change files');
        assert.ok(changed.every(name => editCanvas ? name.startsWith('boards/reader/') : ['index.html', 'styles.css', 'app.js'].includes(name)), JSON.stringify(changed));
        if (preservedV1) assert.deepEqual(await hashes(prior.pageDirectory), preservedV1, 'v1 changed during v2 editing');
        assert.equal(await fs.readFile(path.join(workspace, 'data/projects.json'), 'utf8'), originalMetadata);
        assert.equal(await fs.readFile(path.join(workspace, 'portal/shell.js'), 'utf8'), originalShell);
        report.changedFiles = changed;
        report.checks = editCanvas ? ['only selected reader board files changed', 'canvas data and stable IDs unchanged', 'other boards unchanged', 'project metadata unchanged']
            : ['only v2 business files changed', 'v1 byte hashes unchanged', 'project metadata unchanged'];
    } else if (prd) {
        assert.deepEqual(await hashes(v1), original, 'Source version files changed unexpectedly');
        const docs = path.join(path.dirname(v1), 'docs');
        const names = (await fs.readdir(docs)).filter(name => name.endsWith('.md'));
        assert.ok(names.length, 'No page-level PRD document');
        const sources = await Promise.all(names.map(name => fs.readFile(path.join(docs, name), 'utf8')));
        const images = sources.flatMap(text => [...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(match => match[1]));
        assert.ok(images.length >= 3, 'Expected screenshots for three required functional states');
        for (const image of images) {
            assert.ok(!/^https?:/.test(image), 'PRD screenshot must be a local artifact');
            assert.ok((await fs.stat(path.resolve(docs, decodeURIComponent(image)))).size > 500, 'Missing or empty screenshot');
        }
        report.documents = names; report.imageCount = images.length;
        report.checks = ['page-level PRD','at least three linked functional screenshots','source version unchanged'];
    } else {
    assert.deepEqual(await hashes(v1), original, 'Source version files changed unexpectedly');
    for (const name of ['index.html','styles.css','app.js','docs/acceptance-note.md']) assert.ok((await fs.stat(path.join(v2,name))).size > 0, name);
    assert.equal(await fs.readFile(path.join(v2,'docs/acceptance-note.md'),'utf8'), await fs.readFile(path.join(v1,'docs/acceptance-note.md'),'utf8'));
    const metadata = JSON.parse(await fs.readFile(path.join(workspace,'data/projects.json'),'utf8'));
    const page = metadata.projects.find(item => item.id === prior.projectId).pages.find(item => item.id === pageId);
    assert.ok(page.versions.includes('v1') && page.versions.includes('v2'));
    const shell = await fs.readFile(path.join(workspace,'portal/shell.js'),'utf8');
    assert.deepEqual(JSON.parse(shell.match(/\b(?:const|let|var)\s+defaultData\s*=\s*([\s\S]*);\s*$/)[1]), metadata);
    report.checks = ['v1 byte hashes unchanged','v2 self-contained','v1 document copied unchanged','versions registered in both metadata files'];
    }
    report.status = 'generation-passed'; report.pageDirectory = editing ? v1 : v2;
} catch (error) { report.status = 'failed'; report.error = error.message; process.exitCode = 1; }
finally {
    if (child.exitCode === null) { const closed = new Promise(resolve => child.once('exit',resolve)); child.kill('SIGTERM');
        const timer = setTimeout(()=>child.kill('SIGKILL'),10000); await closed; clearTimeout(timer); }
    const redact = value => value.split(selected.apiKey).join('[REDACTED]');
    report.finishedAt = new Date().toISOString();
    const prefix = prd ? 'prd' : editing ? values.task : 'iteration';
    const reportFile = path.join(root,`${prefix}-report.json`);
    await fs.writeFile(reportFile,redact(JSON.stringify(report,null,2))); await fs.writeFile(path.join(root,`${prefix}-gateway.log`),redact(logs));
    console.log(JSON.stringify({status:report.status,reportFile,error:report.error ? redact(report.error) : undefined}));
}
