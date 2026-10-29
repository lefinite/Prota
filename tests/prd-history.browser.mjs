import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const root = await mkdtemp(path.join(tmpdir(), 'prota-prd-history-'));
const repo = process.cwd();
await mkdir(path.join(root, 'src/pages/demo/reader/docs/prd-assets'), {recursive:true});
await writeFile(path.join(root, 'src/pages/demo/reader/docs/prd-assets/shot.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64'));
for (const version of ['v1', 'v2', 'v3']) await mkdir(path.join(root, 'src/pages/demo/reader', version), { recursive: true });
await writeFile(path.join(root, 'harness.html'), `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">
<link rel="stylesheet" href="/portal/modules/prd/prd.css">
<div id="meta" style="padding:20px"></div><article id="body"></article>
<script type="module">
import { PRDModule } from '/portal/modules/prd/index.js';
import { PRDManager } from '/portal/modules/prd/manager.js';
import { PRDRenderer } from '/portal/modules/prd/renderer.js';
const host = {activeProjectId:'demo', activePageId:'reader', activeVersion:'v1',
 annotationDrawerMeta:document.querySelector('#meta'), getPageRecord:()=>({name:'阅读器',versions:['v1','v2','v3']}),
 getPrdRelativePath:()=>null, showConfirm:async()=>true};
const module = Object.create(PRDModule.prototype);
module.host=host; module.manager=new PRDManager(host); module.renderer=new PRDRenderer(module.manager);
module.manager.addEventListener('prd-state-change',()=>{
 document.querySelector('#meta').innerHTML=module.renderer.renderPrdMeta(module.manager.state);
 document.querySelector('#body').innerHTML=module.renderer.renderMarkdownDocument(module.manager.state.content);
 module.bindMetaSwitcherEvents();
});
window.module=module; window.host=host;
window.version=async version=>{host.activeVersion=version; await module.switchContext('reader',version);};
window.ready=true;
</script>`);
const server = spawn('python3', ['-u', '-c', `
import sys, os, http.server
sys.path.insert(0, sys.argv[1])
from server import bridge
root, repo = sys.argv[2], sys.argv[1]
bridge.get_project_root = lambda: root
class Handler(bridge.BridgeHandler):
    def translate_path(self, path):
        clean = path.split('?')[0].lstrip('/') or 'index.html'
        return os.path.join(repo if clean.startswith('portal/') else root, clean)
    def log_message(self, *args): pass
server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
print(server.server_port, flush=True)
server.serve_forever()
`, repo, root], { stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
server.stderr.on('data', data => stderr += data);
let browser;
try {
    const port = await new Promise((resolve, reject) => {
        server.stdout.once('data', data => resolve(Number(data.toString().trim())));
        server.once('exit', code => reject(new Error('Server exited ' + code + ': ' + stderr)));
    });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('pageerror', error => console.error('BROWSER:', error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('CONSOLE:', message.text()); });
    await page.goto('http://127.0.0.1:' + port + '/harness.html');

    await page.waitForFunction(() => window.ready);
    page.setDefaultTimeout(8000);
    await page.evaluate(async () => {
        await window.version('v1');
        await window.module.manager.createNewDocument();
        await window.module.manager.saveDocument({content:'# v1 原文\n![图片](prd-assets/shot.png)'});
    });
    const original = await page.evaluate(() => window.module.manager.state.path);
    const originalBytes = await readFile(path.join(root, original));
    await page.evaluate(() => window.version('v2'));
    assert.equal(await page.evaluate(() => window.module.manager.state.path), original);
    await page.locator('[data-prd-manage-trigger]').click();
    await page.getByRole('button', {name:'基于此文档迭代'}).click();
    await page.waitForFunction(original => window.module.manager.state.path !== original && !window.module.manager.state.saving, original);
    const revised = await page.evaluate(() => window.module.manager.state.path);
    assert.deepEqual(await readFile(path.join(root, revised)), originalBytes);
    assert.deepEqual(await readFile(path.join(root, original)), originalBytes);
    const metadata = await page.evaluate(() => window.module.manager.state.documents.find(doc=>doc.path===window.module.manager.state.path));
    assert.equal(metadata.prototypeVersion, 'v2');
    assert.equal(metadata.derivedFrom, original);
    assert.equal(metadata.revision, 2);
    await page.locator('[data-prd-manage-trigger]').click();
    await page.locator('[data-prd-switch-path]').filter({hasText:path.basename(original)}).click();
    await page.waitForFunction(original=>window.module.manager.state.path===original && window.module.manager.state.status==='ready', original);
    await page.evaluate(() => window.version('v3'));
    assert.equal(await page.locator('[data-prd-switch-path]').count(), 2);
    assert.equal(await page.evaluate(() => window.module.manager.state.path), original);
    await page.reload();
    await page.waitForFunction(() => window.ready);
    await page.evaluate(() => window.version('v3'));
    assert.equal(await page.evaluate(() => window.module.manager.state.path), original);
    assert.match(await page.locator('#body').innerText(), /v1 原文/);
    await page.locator('#body img').evaluate(image => image.decode());
    assert.equal(await page.locator('#body img').evaluate(image => image.naturalWidth), 1);
    await page.evaluate(async original => {
        const manager = window.module.manager;
        const readme = '/src/pages/demo/reader/v2/README.md';
        window.host.isShareMode = true;
        window.host.activeVersion = 'v1';
        window.host.shareConfig = {
            documents: [{path:readme, filename:'README.md', prototypeVersion:'v2'},
                {path:original, filename:original.split('/').pop(), prototypeVersion:'v1'}],
            prdPath:original, prdContent:'# 分享指定的手机号登录文档'
        };
        localStorage.setItem(manager.getLastDocumentKey(), readme);
        manager.resetState();
        await manager.loadDocument();
    }, original);
    assert.equal(await page.evaluate(() => window.module.manager.state.path), original);
    assert.match(await page.locator('#body').innerText(), /分享指定的手机号登录文档/);
    console.log('PASS: v1 create → v2 read/revise/switch → v3 history → reload restoration; original bytes preserved');
    console.log('PASS: shared document overrides template README and recipient reading history');
} finally {
    await browser?.close();
    server.kill();
    await rm(root, {recursive:true, force:true});
}
