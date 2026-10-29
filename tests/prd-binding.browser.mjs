import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const repo = process.cwd();
const root = await mkdtemp(path.join(tmpdir(), 'prota-prd-binding-'));
const prefix = '/src/pages/demo/auth-phone/';
const business = prefix + 'docs/手机号登录与自动注册.md';
const readme = prefix + 'v2/README.md';
const versions = Array.from({length: 16}, (_, i) => `v${16 - i}`);
const record = {id:'auth-phone', name:'手机号登录与账户', versions, versionStates:{v3:{deleted:true}}};
for (const version of versions) await mkdir(path.join(root, prefix, version), {recursive:true});
await mkdir(path.join(root, prefix, 'docs'), {recursive:true});
await mkdir(path.join(root, 'data'), {recursive:true});
await writeFile(path.join(root, 'data/projects.json'), JSON.stringify({projects:[{id:'demo', pages:[record]}]}));
await writeFile(path.join(root, business), '# 手机号登录与自动注册\n\n业务需求正文。');
await writeFile(path.join(root, readme), '# 画布模板说明');
let html = await readFile(path.join(repo, 'portal/index.html'), 'utf8');
html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replaceAll('href="modules/', 'href="/portal/modules/')
    .replace('href="shell.css', 'href="/portal/shell.css');
html = html.replace('</body>', `<script type="module">
import {PRDModule} from '/portal/modules/prd/index.js';
const host = {activeProjectId:'demo', activePageId:'auth-phone', activeVersion:'v1', docDrawerMode:'prd',
    annotationDrawer:document.querySelector('#annotationDrawer'),
    annotationDrawerMeta:document.querySelector('#annotationDrawerMeta'),
    annotationDrawerBody:document.querySelector('#annotationDrawerBody'),
    getPageRecord:()=>(${JSON.stringify(record)}), getPrdRelativePath:()=>null,
    showToast:message=>{window.lastToast=message;}, showConfirm:async()=>true};
host.annotationDrawer.classList.add('is-visible','is-prd-mode');
Object.assign(host.annotationDrawer.style,{position:'fixed', inset:'32px 12px 12px auto', width:'min(680px, calc(100vw - 24px))', minWidth:'0', height:'auto', zIndex:'1000', transform:'none', transition:'none'});
document.querySelectorAll('.doc-drawer-actions, .annotation-drawer__close').forEach(el=>el.hidden=true);
document.querySelector('#docModeSwitch')?.remove();
window.host=host;window.prd=new PRDModule(host);
await window.prd.switchContext('auth-phone','v1');
window.ready=true;
</script></body>`);
await writeFile(path.join(root, 'harness.html'), html);
const server = spawn('python3', ['-u','-c', `
import sys, os, http.server, urllib.parse
sys.path.insert(0, sys.argv[1])
from server import bridge
repo, root = sys.argv[1:3]
bridge.get_project_root = lambda: root
class Handler(bridge.BridgeHandler):
    def translate_path(self, path):
        clean = urllib.parse.unquote(path.split('?')[0]).lstrip('/')
        return os.path.join(repo if clean.startswith('portal/') else root, clean)
    def log_message(self, *args): pass
server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
print(server.server_port, flush=True)
server.serve_forever()
`, repo, root], {stdio:['ignore','pipe','pipe']});
let browser;
let stderr = '';
server.stderr.on('data', data => stderr += data);
try {
    const port = await new Promise((resolve, reject) => {
        server.stdout.once('data', data => resolve(Number(data.toString().trim())));
        server.once('exit', code => reject(new Error(`${code}: ${stderr}`)));
    });
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport:{width:1200,height:900}});
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('BROWSER:',error.message); });
    page.on('response', async response => {
        if (response.url().includes('/api/prd-doc/binding') && !response.ok()) console.error('BIND:',response.status(),await response.text());
    });
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(`http://127.0.0.1:${port}/harness.html`);
    await page.waitForFunction(()=>window.ready).catch(async error => {
        console.error(await page.evaluate(()=>({url:location.href,scripts:[...document.scripts].map(s=>s.src||s.textContent.slice(0,180)),host:!!window.host,state:window.prd?.manager?.state,body:document.body.innerText.slice(-300)})));
        console.error(stderr);
        throw error;
    });
    const wideHeader = await page.locator('.annotation-drawer__header').boundingBox();
    const wideTabs = await page.locator('.doc-tabs').boundingBox();
    const wideMeta = await page.locator('.annotation-drawer__meta-row').boundingBox();
    assert.ok(wideHeader.height <= 52, JSON.stringify(wideHeader));
    assert.ok(Math.abs(wideTabs.y - wideMeta.y) <= 3, 'wide toolbar is one row');
    assert.equal(await page.locator('.prd-meta__breadcrumb, .prd-meta__association').count(),0);
    await page.locator('[data-prd-manage-trigger]').click();
    const binding = () => page.locator(`[data-prd-dropdown] [data-prd-binding-path="${business}"]`);
    const choose = async version => {
        await binding().click();
        const anchor = await binding().boundingBox();
        const options = await page.locator('.prd-binding-options:popover-open').boundingBox();
        const expectedLeft = Math.max(12, Math.min(anchor.x, page.viewportSize().width - options.width - 12));
        assert.ok(Math.abs(options.x - expectedLeft) < 1, 'version menu opens to the right, shifting left only at the viewport edge');
        await page.locator(`.prd-binding-options:popover-open [data-prd-bind-path="${business}"][data-prd-bind-version="${version}"]`).click();
    };
    assert.equal(await page.locator('[data-prd-bind-version="v3"]').count(),0);
    const article = await page.locator('#annotationDrawerBody article').elementHandle();
    await choose('v1');
    await page.waitForFunction(path => window.prd.manager.state.documents.find(doc=>doc.path===path)?.prototypeVersion==='v1', business).catch(async error=>{
        console.error(await page.evaluate(()=>({toast:window.lastToast,state:window.prd.manager.state,pending:window.prd.manager._bindingPending})));
        throw error;
    });
    assert.match(await binding().innerText(), /^V1$/);
    assert.equal(await page.locator('[data-prd-dropdown]').isVisible(),true);
    assert.equal(await article.evaluate(el=>el.isConnected),true,'binding must not recreate document body');
    await choose('v2');
    await page.waitForFunction(path => window.prd.manager.state.documents.find(doc=>doc.path===path)?.prototypeVersion==='v2', business);
    await page.reload();
    await page.waitForFunction(()=>window.ready);
    await page.locator('[data-prd-manage-trigger]').click();
    assert.match(await binding().innerText(), /^V2$/);
    await page.route('**/api/prd-doc/binding', route => route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'关联未保存，请重试。'})}));
    await choose('v1');
    await page.waitForFunction(()=>window.lastToast==='关联未保存，请重试。'&&!window.prd.manager._bindingPending);
    assert.match(await binding().innerText(), /^V2$/, 'failed saves preserve the existing label');
    assert.equal(await binding().isEnabled(),true);
    assert.equal(await page.locator('[data-prd-dropdown]').isVisible(),true);
    await page.unroute('**/api/prd-doc/binding');
    await binding().click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.prd-binding-options:popover-open').count(),0);
    await choose('');
    await page.waitForFunction(path => window.prd.manager.state.documents.find(doc=>doc.path===path)?.prototypeVersion===null, business);
    // Rebind, then changing prototype versions must open the associated business document.
    await choose('v2');
    await page.waitForFunction(path => window.prd.manager.state.documents.find(doc=>doc.path===path)?.prototypeVersion==='v2', business);
    await page.evaluate(async()=>{window.host.activeVersion='v2';await window.prd.switchContext('auth-phone','v2');});
    assert.equal(await page.evaluate(()=>window.prd.manager.state.path),business);
    assert.equal(await page.evaluate(()=>window.prd.manager.state.status),'ready');
    assert.match(await page.locator('#annotationDrawerBody').innerText(),/业务需求正文/);
    await page.evaluate(()=>{
        const record=window.host.getPageRecord();
        window.host.getPageRecord=()=>({...record,versions:['v2','v1']});
        window.prd.manager.updateState({documents:[...window.prd.manager.state.documents]});
    });
    await page.locator('[data-prd-manage-trigger]').click();
    const anchor = await page.locator('[data-prd-manage-trigger]').boundingBox();
    const menu = await page.locator('[data-prd-dropdown]').boundingBox();
    assert.ok(Math.abs(anchor.x - menu.x) < 1, 'document menu aligns with the trigger when right-side space is available');
    await page.locator('#annotationDrawer').screenshot({path:'/tmp/prota-prd-binding-desktop.png'});
    await page.setViewportSize({width:390,height:780});
    // Re-open to recompute the viewport bounds.
    await page.locator('[data-prd-manage-trigger]').click();
    await page.locator('[data-prd-manage-trigger]').click();
    const narrowHeader = await page.locator('.annotation-drawer__header').boundingBox();
    const narrowTabs = await page.locator('.doc-tabs').boundingBox();
    const narrowMeta = await page.locator('.annotation-drawer__meta-row').boundingBox();
    assert.ok(narrowHeader.height <= 78, JSON.stringify(narrowHeader));
    assert.ok(narrowMeta.y >= narrowTabs.y + narrowTabs.height - 1, 'narrow toolbar uses two rows');
    const bounds = await page.locator('[data-prd-dropdown]').boundingBox();
    assert.ok(bounds.width <= 321, 'document menu stays compact');
    assert.ok(bounds.x>=0 && bounds.x+bounds.width<=390,JSON.stringify(bounds));
    await choose('v1');
    await page.waitForFunction(path=>window.prd.manager.state.documents.find(doc=>doc.path===path)?.prototypeVersion==='v1',business);
    await page.locator('#annotationDrawer').screenshot({path:'/tmp/prota-prd-binding-mobile.png'});
    await page.evaluate(async ({business,readme})=>{
        window.host.isShareMode=true;
        window.host.shareConfig={prdPath:business,prdContent:'# 已分享的业务需求',documents:[{path:readme},{path:business}]};
        localStorage.setItem('readify:prd-edit-mode:auth-phone:'+business,'true');
        window.prd.manager.resetState();
        await window.prd.manager.loadDocument({force:true});
    },{business,readme});
    assert.equal(await page.locator('[data-prd-manage-trigger], [data-prd-dropdown], [data-prd-bind-path], [data-prd-binding-trigger]').count(),0);
    assert.equal(await page.locator('.prd-meta__readonly-name').innerText(),'手机号登录与自动注册.md');
    assert.equal(await page.locator('.prd-meta__breadcrumb, .prd-meta__association').count(),0);
    assert.equal(await page.evaluate(()=>window.prd.manager.state.editMode),false);
    assert.equal(await page.evaluate(()=>window.prd.manager.state.documents.length),1);
    const denied = await page.request.post(`http://127.0.0.1:${port}/api/prd-doc/binding`,{
        headers:{Referer:`http://127.0.0.1:${port}/shares/auth-phone-v1-local.html`},
        data:{projectId:'demo',pageId:'auth-phone',version:'v1',path:business,prototypeVersion:'v1'}
    });
    assert.equal(denied.status(),403);
    assert.deepEqual(errors,[]);
    console.log('PASS: two-click version popover bind/rebind/unbind, persistence, version selection, unchanged document DOM, responsive layout, read-only shares and API permission');
    console.log('PASS: compact wide/narrow toolbar, no breadcrumb, muted version labels, narrower document menu and static share filename');
    console.log('Screenshots: /tmp/prota-prd-binding-desktop.png /tmp/prota-prd-binding-mobile.png');
} finally {
    await browser?.close();
    server.kill();
    await rm(root,{recursive:true,force:true});
}
