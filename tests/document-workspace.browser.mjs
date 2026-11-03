import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
const repo = process.cwd();
const root = await mkdtemp(path.join(tmpdir(), 'prota-document-workspace-'));
await mkdir(path.join(root, 'config'), {recursive:true});
await writeFile(path.join(root, 'workspace.json'), JSON.stringify({id:'document-layout-fixture',formatVersion:1}));
await writeFile(path.join(root, 'config/workspace.json'), JSON.stringify({path:root}));
await mkdir(path.join(root, 'data'), {recursive:true});
await mkdir(path.join(root, 'src/pages/demo/reader/v1'), {recursive:true});
await mkdir(path.join(root, 'src/pages/demo/reader/docs'), {recursive:true});
await writeFile(path.join(root, 'data/projects.json'), JSON.stringify({projects:[{id:'demo',name:'测试项目',pages:[{id:'reader',name:'阅读器',targetDevice:'web',versions:['v1']}]}],activeProjectId:'demo',activePageId:'reader'}));
await writeFile(path.join(root, 'src/pages/demo/reader/v1/index.html'), '<!doctype html><h1>Preview</h1>');
await writeFile(path.join(root, 'src/pages/demo/reader/docs/需求文档.md'), '# 阅读器需求\n\n测试内容。');
const server = spawn('python3', ['-u','-c', `
import sys, http.server
from server import bridge
from pathlib import Path
shares=Path(bridge.get_project_root())/'shares'
shares.mkdir(exist_ok=True)
(shares/'layout.html').write_text(bridge.build_share_page_html({'enabled':True,'projectId':'demo','pageId':'reader','pageName':'阅读器','version':'v1','targetDevice':'web','shareType':'static','annotations':[],'prdPath':'/src/pages/demo/reader/docs/需求文档.md','prdContent':'# 分享的需求文档','zipFilename':'reader.zip'}))
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),bridge.BridgeHandler)
print(server.server_port,flush=True)
server.serve_forever()
`], {cwd:repo,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(root,'config'),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});
let browser, logs='';
server.stderr.on('data', chunk=>logs+=chunk);
try {
 const port=await new Promise((resolve,reject)=>{server.stdout.once('data',chunk=>resolve(Number(chunk.toString().trim())));server.once('exit',()=>reject(Error(logs)));});
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:960}});
 await page.route(/fonts\.google/,route=>route.abort());
 await page.goto(`http://127.0.0.1:${port}/portal/index.html`);
 await page.waitForFunction(()=>window.shell?.prdModule);
 await page.evaluate(async()=>{window.shell.closeAgentWorkbench();window.shell.switchTopView('page');await window.shell.switchPage('reader','v1',{projectId:'demo'});window.shell.openDocumentDrawer('prd',{path:'/src/pages/demo/reader/docs/需求文档.md'});});
 await page.locator('#annotationDrawer.is-visible').waitFor();
 await page.waitForFunction(()=>window.shell.prdModule.manager.state.status === 'ready');
 await page.frameLocator('#mainIframe').getByRole('heading',{name:'Preview'}).waitFor();
 const geometry=()=>page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};return {header:box('.content-header'),toolbar:box('.annotation-drawer__header'),drawer:box('#annotationDrawer'),stage:box('.viewport-stage')};});
 let g=await geometry();
 assert.equal(g.toolbar.y,0);assert.equal(g.toolbar.height,56);assert.equal(g.header.height,56);
 assert.equal(g.stage.y,56);assert.ok(Math.abs(g.toolbar.x-g.header.right)<=1);assert.equal(g.stage.right,g.drawer.x);
 assert.equal(g.drawer.bottom,960);
 assert.equal(await page.locator('#prdDownloadBtn').isVisible(),true,'wide toolbar keeps actions visible');
 assert.equal(await page.locator('#prdOpenNewTabBtn').count(),0);
 assert.equal(await page.locator('#docDrawerCloseBtn').count(),0);
 const toggleOpen=await page.locator('#docVisibilityBtn').boundingBox();
 await page.locator('#docVisibilityBtn').click();
 assert.deepEqual(await page.locator('#docVisibilityBtn').boundingBox(),toggleOpen);
 assert.equal(await page.locator('#docVisibilityBtn').getAttribute('aria-expanded'),'false');
 await page.locator('#docVisibilityBtn').click();
 assert.deepEqual(await page.locator('#docVisibilityBtn').boundingBox(),toggleOpen);
 assert.equal(await page.locator('#docVisibilityBtn').getAttribute('aria-expanded'),'true');
 for(const id of ['prdDownloadBtn','prdExpandBtn']) {
 assert.equal(await page.locator(`#${id} svg`).evaluate(el=>getComputedStyle(el).width),'18px');
 assert.equal(await page.locator(`#${id} svg`).evaluate(el=>getComputedStyle(el).strokeWidth),'1.8px');
 }
 await page.locator('#prdEditBtn').click();
 await page.waitForFunction(()=>document.activeElement===document.querySelector('[data-prd-editor]'));
 assert.equal((await page.locator('.prd-editor-global-toolbar').boundingBox()).height,44);
 assert.equal(await page.locator('.prd-editor-tool').count(),12);
 const viewTabs=await page.locator('.prd-editor-layout').boundingBox();
 const documentTabs=await page.locator('.doc-tabs').boundingBox();
 assert.equal(viewTabs.x,documentTabs.x);
 assert.equal(viewTabs.width,documentTabs.width);
 assert.equal(viewTabs.height,documentTabs.height);
 for(const prop of ['borderRadius','backgroundColor','padding','border']) {
    assert.equal(await page.locator('.prd-editor-layout').evaluate((el,prop)=>getComputedStyle(el)[prop],prop),await page.locator('.doc-tabs').evaluate((el,prop)=>getComputedStyle(el)[prop],prop));
 }
 assert.equal(await page.locator('.prd-editor-global-toolbar').evaluate(el=>el.firstElementChild.classList.contains('prd-editor-layout')),true);
 assert.equal(await page.locator('[data-prd-cancel]').getAttribute('aria-label'),'退出编辑');

 assert.equal(await page.locator('.prd-editor-global-toolbar [data-prd-save]').count(),1);
 assert.equal(await page.locator('.prd-editor-global-toolbar [data-prd-cancel]').count(),1);
 assert.equal(await page.locator('.annotation-drawer__header [data-prd-save], .annotation-drawer__header [data-prd-cancel]').count(),0);
 assert.equal(await page.locator('.doc-drawer-actions').evaluate(el=>getComputedStyle(el).borderLeftWidth),'0px');
 assert.equal(await page.locator('.prd-editor-textarea').evaluate(el=>getComputedStyle(el).resize),'none');
 await page.locator('[data-prd-layout="split"]').click();
 assert.equal(await page.locator('.prd-editor-pane').evaluateAll(els=>els.every(el=>getComputedStyle(el).borderRadius==='0px')),true);
 assert.equal(await page.locator('.prd-editor-grid').evaluate(el=>getComputedStyle(el).gap),'0px');
 assert.equal(await page.locator('.prd-editor-pane--preview').evaluate(el=>getComputedStyle(el).borderLeftWidth),'1px');
 await page.screenshot({path:'/tmp/prota-document-workspace-split.png'});

 // Layout changes keep the editor nodes, selection and toolbar geometry intact.
 await page.evaluate(()=>{
    window.editorBeforeSwitch=document.querySelector('[data-prd-editor]');
    window.previewBeforeSwitch=document.querySelector('.prd-editor-preview');
    window.previewChildBeforeSwitch=window.previewBeforeSwitch.firstElementChild;
    window.editorBeforeSwitch.setSelectionRange(2,5);
 });
 const toolsBefore=await page.locator('.prd-editor-global-toolbar').boundingBox();
 for(const view of ['preview','source','split','preview','split']) {
    await page.locator(`[data-prd-layout="${view}"]`).click();
    assert.deepEqual(await page.locator('.prd-editor-global-toolbar').boundingBox(),toolsBefore);
    assert.equal(await page.evaluate(()=>window.editorBeforeSwitch===document.querySelector('[data-prd-editor]')),true);
    assert.equal(await page.evaluate(()=>window.previewChildBeforeSwitch===document.querySelector('.prd-editor-preview').firstElementChild),true);
    await page.waitForFunction(()=>document.querySelector('[data-prd-editor]').selectionStart===2);
    assert.equal(await page.locator(`[data-prd-layout="${view}"]`).getAttribute('aria-pressed'),'true');
 }
 for (const action of ['save','cancel']) {
    assert.equal(await page.locator(`[data-prd-${action}] svg`).count(),1);
    assert.equal((await page.locator(`[data-prd-${action}]`).textContent()).trim(),'');
 }
 const originalWidth=(await page.locator('#annotationDrawer').boundingBox()).width;
 await page.evaluate(()=>window.shell.applyPrdDrawerWidth(440));
 await page.waitForFunction(()=>document.querySelectorAll('.prd-editor-tool[hidden]').length>0);
 assert.equal(await page.locator('.prd-editor-toolbar__group').evaluate(el=>getComputedStyle(el).overflowX),'hidden');
 assert.equal(await page.locator('.prd-editor-tool[hidden]').evaluateAll(els=>els.every(el=>getComputedStyle(el).display==='none')),true);
 assert.equal(await page.locator('[data-prd-save]').isVisible(),true);
 assert.equal(await page.locator('[data-prd-cancel]').isVisible(),true);
 await page.screenshot({path:'/tmp/prota-document-tools-narrow.png'});
 await page.evaluate(width=>window.shell.applyPrdDrawerWidth(width),originalWidth);
 await page.locator('[data-prd-editor]').fill('# 编辑验证');
 await page.locator('[data-prd-save]').click();
 await page.waitForFunction(()=>!window.shell.prdModule.manager.state.saving && !window.shell.prdModule.manager.state.dirty);
 assert.match(await page.evaluate(()=>window.shell.prdModule.manager.state.content),/编辑验证/);
 await page.screenshot({path:'/tmp/prota-document-workspace-editor.png'});
 await page.locator('[data-prd-cancel]').click();
 await page.screenshot({path:'/tmp/prota-document-workspace-desktop.png'});
 // Pointer resizing must keep the toolbar boundary attached to its content.
 const handle=page.locator('#prdDrawerResizeHandle');
 const r=await handle.boundingBox();
 await page.mouse.move(r.x+5,200);await page.mouse.down();await page.mouse.move(r.x+80,200);await page.mouse.up();
 g=await geometry();assert.ok(Math.abs(g.toolbar.x-g.stage.right)<=1);assert.ok(Math.abs(g.toolbar.x-g.header.right)<=1);
 // Document type tabs share the current width, including after manual resize.
 for (const width of [720,440]) {
    await page.evaluate(width=>window.shell.applyPrdDrawerWidth(width),width);
    const before=(await page.locator('#annotationDrawer').boundingBox()).width;
    for (const type of ['annotations','prd','annotations','prd']) {
       await page.locator(`[data-doc-tab="${type}"]`).click();
       assert.equal((await page.locator('#annotationDrawer').boundingBox()).width,before);
    }
 }
 // Only collapse secondary actions when their pane cannot fit the toolbar.
 await page.evaluate(()=>window.shell.applyPrdDrawerWidth(440));
 await page.locator('#docToolsMenu:not(.is-inline)').waitFor();
 assert.equal(await page.locator('#prdDownloadBtn').isVisible(),false);
 assert.equal(await page.locator('#docToolsMenu summary').evaluate(el=>getComputedStyle(el,'::after').content),'none');
 await page.locator('#docToolsMenu summary').click();
 assert.equal(await page.locator('#prdDownloadBtn').isVisible(),true);
 await page.locator('#prdExpandBtn').click();
 await page.waitForFunction(()=>document.querySelector('#annotationDrawer').getBoundingClientRect().width === document.querySelector('.main-content').getBoundingClientRect().width);
 assert.equal(await page.locator('.content-header').isVisible(),false);
 await page.locator('#prdExpandBtn').click();
 assert.equal(await page.locator('.content-header').isVisible(),true);
 // A narrow remaining workspace shows the document while retaining Agent.
 await page.evaluate(()=>window.shell.openAgentWorkbench());
 await page.setViewportSize({width:1100,height:960});
 await page.waitForTimeout(300);
 assert.equal(await page.locator('.sidebar').evaluate(el=>el.classList.contains('is-agent-open')),true);
 assert.equal(await page.locator('#annotationDrawer').isVisible(),true);
 assert.equal(await page.locator('.content-header').isVisible(),false);
 g=await geometry();assert.equal(g.toolbar.height,56);assert.equal(g.toolbar.y,0);
 await page.screenshot({path:'/tmp/prota-document-workspace-agent.png'});
 await page.locator('#docVisibilityBtn').click();
 assert.equal(await page.locator('#annotationDrawer').isVisible(),false);
 assert.equal(await page.locator('.content-header').isVisible(),true);
 await page.evaluate(()=>{window.shell.closeAgentWorkbench();window.shell.openDocumentDrawer('annotations');});
 await page.setViewportSize({width:1024,height:768});
 assert.equal(await page.locator('#docVisibilityBtn').isVisible(),true);
 g=await geometry();assert.equal(g.toolbar.height,56);assert.equal(g.toolbar.y,0);
 await page.locator('#docVisibilityBtn').click();
 assert.equal(await page.locator('#mainIframe').isVisible(),true);
 await page.setViewportSize({width:1600,height:960});
 await page.goto(`http://127.0.0.1:${port}/shares/layout.html`);
 await page.waitForFunction(()=>window.shell?.isShareMode);
 await page.locator('#docVisibilityBtn').click();
 await page.waitForFunction(()=>window.shell.prdModule.manager.state.status==='ready');
 g=await geometry();assert.equal(g.toolbar.y,0);assert.equal(g.toolbar.height,56);
 assert.ok(Math.abs(g.header.right-g.toolbar.x)<=1);
 assert.equal(await page.locator('#prdEditBtn').isVisible(),false);
 await page.screenshot({path:'/tmp/prota-document-workspace-share.png'});
 await page.setViewportSize({width:390,height:844});
 g=await geometry();assert.equal(g.toolbar.height,56);assert.equal(g.toolbar.y,0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true, JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&el.getBoundingClientRect().width>0).map(el=>[el.className,el.getBoundingClientRect().x,el.getBoundingClientRect().width]).slice(0,20))));
 assert.equal(await page.locator('#docVisibilityBtn').isVisible(),true);
 await page.locator('#docVisibilityBtn').click();
 assert.equal(await page.locator('#annotationDrawer').isVisible(),false);
 console.log('PASS document workspace alignment, resizing, Agent coexistence, narrow view and close');
} finally {await browser?.close();server.kill();await rm(root,{recursive:true,force:true});}
