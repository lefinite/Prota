import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const app = process.cwd(), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-copy-edits-'));
const root = path.join(temp, 'workspace'), config = path.join(temp, 'config');
const children = []; let browser, logs = '';
const port = () => new Promise(resolve => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const write = async (file, content) => { const p = path.join(root, file); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, content); };
const wait = async (test, label) => { for (let i = 0; i < 200; i++) { try { if (await test()) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw Error(`${label}\n${logs.slice(-2500)}`); };
const bridgePort = await port(), agentPort = await port(), base = `http://127.0.0.1:${bridgePort}`;
const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', READIFY_CONFIG_DIR: config, READIFY_WORKSPACE: root, READIFY_PORT: String(bridgePort), READIFY_AGENT_PORT: String(agentPort) };
const start = (cmd, args) => { const c = spawn(cmd, args, { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] }); c.stdout.on('data', b => logs += b); c.stderr.on('data', b => logs += b); children.push(c); return c; };
const coordinate = action => JSON.parse(execFileSync('python3', ['-m', 'server.user_edit_reconcile', action, '--root', root, '--lease', 'browser-run', '--pid', String(process.pid)], { cwd: app, env, encoding: 'utf8' }));
try {
    await write('workspace.json', JSON.stringify({ id: 'copy-fixture', formatVersion: 1 }));
    await write('data/projects.json', JSON.stringify({ projects: [{ id: 'demo', name: '测试', pages: [{ id: 'page', name: '页面', targetDevice: 'web', versions: ['v1'], activeVersion: 'v1' }] }], activeProjectId: 'demo', activePageId: 'page' }));
    await write('src/pages/demo/page/v1/index.html', '<!doctype html><html><body><button id="target" style="margin:60px;padding:24px">提交</button>' + Array.from({ length: 100 }, (_, i) => `<p id="item${i}">原文 ${i}</p>`).join('') + '</body></html>');
    await write('src/pages/demo/page/v1/app.js', ''); await write('src/pages/demo/page/v1/styles.css', '');
    await fs.mkdir(config, { recursive: true }); await fs.writeFile(path.join(config, 'workspace.json'), JSON.stringify({ path: root }));
    let bridge = start('python3', ['server/bridge.py']); start('node', ['server/agent-server.mjs']);
    await wait(async () => (await fetch(base + '/api/workspace')).ok, 'bridge');
    await wait(async () => (await fetch(`http://127.0.0.1:${agentPort}/api/agent/health`)).ok, 'agent');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
    page.on('pageerror', e => { logs += '\nPAGE ERROR: ' + e.message; });
    await page.route(/fonts\.google/, r => r.abort());
    await page.route('http://localhost:8080/**', r => r.continue({ url: base + new URL(r.request().url()).pathname }));
    await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//, r => r.continue({ url: r.request().url().replace(/:8081\//, `:${agentPort}/`) }));
    await page.goto(base + '/portal/index.html');
    await wait(() => page.evaluate(() => Boolean(window.shell?.projects?.projects?.length)), 'shell');
    await page.evaluate(() => { window.shell.switchTopView('page'); window.shell.switchPage('page', 'v1'); });
    const target = page.frameLocator('#mainIframe').locator('#target'); await target.waitFor();
    await page.evaluate(() => window.shell.enterAnnotationMode());
    await target.click();
    await page.locator('.annotation-copy-panel__input').waitFor({ state: 'visible' });
    await page.locator('.annotation-copy-panel__input').fill('  已保存 🙂  ');
    await page.locator('.annotation-copy-panel__sync').click();
    await wait(async () => (await (await fetch(base + '/api/copy-edits/v2/history')).json()).items.some(r => r.status === 'verified'), 'UI reload verification');
    assert.equal(await target.textContent(), '  已保存 🙂  ');
    // 100 different targets, each retained after restart and three Agent source updates.
    const scope = { projectId: 'demo', pageId: 'page', version: 'v1', target: { type: 'page' } };
    for (let i = 0; i < 100; i++) {
        const response = await fetch(base + '/api/copy-edits/v2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...scope, clientEditId: `browser-${i}`, element: { selector: `#item${i}`, tagName: 'P', originalText: `原文 ${i}`, nextText: `人工 ${i}` } }) });
        const result = await response.json(); assert.equal(result.status, 'committed', JSON.stringify(result));
    }
    for (let run = 0; run < 3; run++) {
        coordinate('start');
        await fs.appendFile(path.join(root, 'src/pages/demo/page/v1/index.html'), `\n<!-- Agent iteration ${run} -->`);
        assert.equal(coordinate('end').conflictCount, 0);
    }
    bridge.kill(); await new Promise(resolve => bridge.once('exit', resolve));
    bridge = start('python3', ['server/bridge.py']);
    await wait(async () => (await fetch(base + '/api/workspace')).ok, 'restart');
    await page.evaluate(() => window.shell.refreshCurrentDemo());
    await wait(async () => (await page.frameLocator('#mainIframe').locator('#item99').textContent()) === '人工 99', 'refresh after restart');
    for (let i = 0; i < 100; i++) assert.equal(await page.frameLocator('#mainIframe').locator(`#item${i}`).textContent(), `人工 ${i}`);
    // Export is independent of the ledger and DOM patches.
    const zip = await fetch(`http://127.0.0.1:${agentPort}/api/agent/page/download-zip?projectId=demo&pageId=page&version=v1`);
    assert.equal(zip.status, 200); const zipPath = path.join(temp, 'export.zip'); await fs.writeFile(zipPath, Buffer.from(await zip.arrayBuffer()));
    execFileSync('python3', ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert not any("user-edit" in n for n in z.namelist()); s=z.read(next(n for n in z.namelist() if n.endswith("v1/index.html"))).decode(); assert all("人工 "+str(i) in s for i in range(100)); assert "READIFY_COPY_PATCHES" not in s', zipPath]);
    coordinate('start');
    const file = path.join(root, 'src/pages/demo/page/v1/index.html');
    await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('人工 42', 'Agent 覆盖'));
    assert.equal(coordinate('end').conflictCount, 1);
    assert.equal(await page.locator('#copyEditHistoryBtn').count(), 0);
    const history = await (await fetch(base + '/api/copy-edits/v2/history')).json();
    assert.equal(history.conflictCount, 1);
    assert.equal((await fetch(base + '/data/user-edits.sqlite3')).status, 404);
    assert.equal((await fetch(base + '/data/user-edit-assets/snapshots/anything')).status, 404);
    console.log('PASS: UI exact whitespace/emoji save + reload verification; 100 targets, restart, three Agent updates, ZIP export, retained conflict, history UI removed, private ledger denied');
} finally {
    await browser?.close(); for (const child of children) child.kill(); await fs.rm(temp, { recursive: true, force: true });
}
