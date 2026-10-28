import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { PreviewObserver } from '../server/preview/observer.mjs';
import { previewConfig } from '../server/preview/config.mjs';
import { readPage } from '../server/preview/snapshot.mjs';
const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'prota-ppe-browser-')));
const workspace = path.join(root, 'workspace'), config = path.join(root, 'config');
const children = []; let browser, observer, logs = '';
const port = () => new Promise(resolve => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const wait = async (predicate, label) => { for (let i=0;i<180;i++) { try { if (await predicate()) return; } catch {} await new Promise(r=>setTimeout(r,50)); } throw Error(`Timed out: ${label}\n${logs.slice(-2000)}`); };
const write = async (relative, data) => { const f = path.join(workspace, relative); await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, data); };
try {
    await write('workspace.json', JSON.stringify({ id: 'ppe-test', formatVersion: 1 }));
    const catalog = { projects: [{ id: 'demo', name: 'Demo', pages: ['web','other'].map(id=>({ id, name:id, targetDevice:'web', versions:['v1'] })) }], activeProjectId:'demo', activePageId:'web' };
    await write('data/projects.json', JSON.stringify(catalog));
    await write('src/pages/demo/web/v1/index.html', '<h1>Original</h1>');
    await write('src/pages/demo/other/v1/index.html', '<h1>Other page</h1>');
    await fs.mkdir(config); await fs.writeFile(path.join(config, 'workspace.json'), JSON.stringify({ path:workspace }));
    const bridgePort=await port(), agentPort=await port(), base=`http://127.0.0.1:${bridgePort}`;
    const env={...process.env,READIFY_WORKSPACE:workspace,READIFY_CONFIG_DIR:config,READIFY_PORT:String(bridgePort),READIFY_AGENT_PORT:String(agentPort),PYTHONDONTWRITEBYTECODE:'1'};
    for (const [cmd,args] of [['python3',['server/bridge.py']],['node',['server/agent-server.mjs']]]) {
        const p=spawn(cmd,args,{env,stdio:['ignore','pipe','pipe']}); children.push(p); p.stdout.on('data',d=>logs+=d);p.stderr.on('data',d=>logs+=d);
    }
    await wait(async()=> (await fetch(base+'/api/workspace')).ok,'bridge');
    await wait(async()=> (await fetch(`http://127.0.0.1:${agentPort}/api/agent/health`)).ok,'agent');
    browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//, r=>r.continue({url:r.request().url().replace(/:8081\//,`:${agentPort}/`)}));
    await page.route(/http:\/\/(localhost|127\.0\.0\.1):8080\//, r=>r.continue({url:r.request().url().replace(/http:\/\/(localhost|127\.0\.0\.1):8080\//,base+'/')}));
    await page.goto(base+'/portal/index.html');
    await wait(()=>page.evaluate(()=>Boolean(window.shell?.projects?.projects?.length)),'shell');
    await page.evaluate(async()=>{window.shell.enterProject('demo');await window.shell.switchPage('web','v1');});
    await wait(()=>page.locator('#mainIframe').contentFrame().getByText('Original',{exact:true}).count(),'original');
    const runId='ppe-browser-run';
    await page.evaluate(runId=>window.shell.handleAgentStreamEvent('run_started',{runId,createdAt:new Date().toISOString(),payload:{progressivePreview:true,context:{projectId:'demo',pageId:'web',version:'v1'},descriptor:{kind:'message'}}}),runId);
    const events=[];
    observer=new PreviewObserver({workspaceRoot:workspace,configDirectory:config,runId,scope:{projectId:'demo',pageId:'web',version:'v1'},publish:e=>events.push(e),config:{...previewConfig,stableMs:50,scanMs:100,refreshMs:100}}).start();
    const deliver=async after=>{await wait(()=>events.length>after,'revision');const e=events.at(-1);await page.evaluate(e=>window.shell.handleAgentStreamEvent('preview_revision',{runId:e.runId,payload:e}),e);await wait(()=>page.evaluate(r=>window.shell.previewController.state.revision===r,e.revision),'displayed revision');return e;};
    await deliver(0);
    const html='<html><head><link rel="stylesheet" href="styles.css"></head><body><h1>Progressive</h1><button onclick="window.clicks=(window.clicks||0)+1">Count</button><input value="keep me"><script src="app.js"></script></body></html>';
    await write('src/pages/demo/web/v1/index.html',html); await write('src/pages/demo/web/v1/styles.css','body{color:rgb(255,0,0)}');await write('src/pages/demo/web/v1/app.js','window.ready=true;');
    let n=events.length;await deliver(n);
    assert.equal(await page.locator('#mainIframe').contentFrame().getByText('Progressive',{exact:true}).count(),1);
    await page.locator('#mainIframe').contentFrame().locator('input').fill('preserved input');
    const beforeFrame=await page.locator('#mainIframe').elementHandle();
    n=events.length;await write('src/pages/demo/web/v1/styles.css','body{color:rgb(0,0,255)}');let e=await deliver(n);
    assert.equal(await beforeFrame.evaluate(el=>el.isConnected),true,'CSS-only changes preserve the running iframe');
    assert.equal(await page.locator('#mainIframe').contentFrame().locator('input').inputValue(),'preserved input');
    assert.equal(await page.locator('#mainIframe').contentFrame().locator('h1').evaluate(el=>getComputedStyle(el).color),'rgb(0, 0, 255)');
    n=events.length;await write('src/pages/demo/web/v1/app.js','const broken = ;');await new Promise(r=>setTimeout(r,350));assert.equal(events.length,n,'incomplete JS is held');
    assert.equal(await page.locator('#mainIframe').contentFrame().locator('h1').textContent(),'Progressive');
    await write('src/pages/demo/web/v1/app.js','window.ready="final";');e=await deliver(n);
    await page.locator('#mainIframe').contentFrame().getByText('Count',{exact:true}).click();
    assert.equal(await page.locator('#mainIframe').evaluate(el=>el.contentWindow.clicks),1);
    const response=await fetch(base+e.snapshotUrl);assert.equal(response.status,200);
    assert.equal((await fetch(base+'/api/preview/config')).status,200);
    const toggle=await fetch(base+'/api/preview/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({progressivePreview:false})});assert.equal(toggle.status,200);assert.deepEqual(await toggle.json(),{progressivePreview:false});
    assert.equal((await fetch(base+'/api/preview/config',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.invalid'},body:'{"progressivePreview":true}'})).status,403);
    assert.equal((await fetch(base+e.snapshotUrl,{headers:{Origin:'https://evil.invalid'}})).status,403);
    assert.equal((await fetch(base+e.snapshotUrl,{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
    assert.equal((await fetch(base+e.snapshotUrl,{method:'HEAD',headers:{Origin:'https://evil.invalid'}})).status,403);
    assert.equal((await fetch(base+e.snapshotUrl.replace('index.html','%2e%2e%2findex.html'))).status,404);
    const finalHash=(await readPage(path.join(workspace,'src/pages/demo/web/v1'))).hash;
    observer.stop();
    await page.evaluate(runId=>window.shell.handleAgentStreamEvent('run_finished',{runId,createdAt:new Date().toISOString(),payload:{status:'succeeded'}}),runId);
    await wait(()=>page.evaluate(()=>new URL(window.shell.mainIframe.src).pathname==='/src/pages/demo/web/v1/index.html'),'formal final URL');
    assert.equal((await readPage(path.join(workspace,'src/pages/demo/web/v1'))).hash,finalHash,'preview never changes generated sources');
    // Late/duplicate revisions cannot replace the formal result.
    await page.evaluate(e=>window.shell.handleAgentStreamEvent('preview_revision',{payload:e}),e);
    assert.ok((await page.locator('#mainIframe').getAttribute('src')).startsWith('/src/pages/'));
    await page.evaluate(runId=>window.shell.handleAgentStreamEvent('run_started',{runId,createdAt:new Date().toISOString(),payload:{progressivePreview:true,context:{projectId:'demo',pageId:'web',version:'v1'},descriptor:{kind:'message'}}}),runId);
    await page.evaluate(e=>window.shell.handleAgentStreamEvent('preview_revision',{payload:e}),e);
    await wait(()=>page.evaluate(()=>window.shell.previewController.state.status==='previewing'),'preview before failure');
    const failedSrc=await page.locator('#mainIframe').getAttribute('src');
    await page.evaluate(runId=>window.shell.handleAgentStreamEvent('run_failed',{runId,createdAt:new Date().toISOString(),payload:{reason:'interrupted'}}),runId);
    assert.equal(await page.locator('#mainIframe').getAttribute('src'),failedSrc,'failure retains last valid revision');
    // A new unregistered page previews without mutating navigation or session scope.
    const newRun='ppe-new-page';await page.evaluate(runId=>window.shell.handleAgentStreamEvent('run_started',{runId,createdAt:new Date().toISOString(),payload:{progressivePreview:true,context:{projectId:'demo',pageId:'__global__'},descriptor:{kind:'skill',skillId:'create-new-page'}}}),newRun);
    await write('src/pages/demo/new/v1/index.html','<h1>Unregistered preview</h1>');
    const {createSnapshot}=await import('../server/preview/snapshot.mjs');const {revisionEvent}=await import('../server/preview/events.mjs');
    const snap=await createSnapshot({pageRoot:path.join(workspace,'src/pages/demo/new/v1'),cacheRoot:observer.cacheRoot,runId:newRun,revision:1});
    const newEvent=revisionEvent(newRun,{projectId:'demo',pageId:'new',version:'v1'},snap);
    await page.evaluate(e=>window.shell.handleAgentStreamEvent('preview_revision',{payload:e}),newEvent);
    await wait(()=>page.locator('#mainIframe').contentFrame().getByText('Unregistered preview',{exact:true}).count(),'unregistered page');
    assert.equal(await page.evaluate(()=>window.shell.activePageId),'web');
    await page.evaluate(()=>window.shell.switchPage('other','v1'));
    await page.evaluate(e=>window.shell.handleAgentStreamEvent('preview_revision',{payload:{...e,revision:2}}),newEvent);
    assert.equal(await page.evaluate(()=>window.shell.activePageId),'other');
    await wait(()=>page.locator('#mainIframe').contentFrame().getByText('Other page',{exact:true}).count(),'navigation preserved');
    // Disabled feature follows the original live-change handler.
    await page.evaluate(()=>{const s=window.shell;s.handleAgentStreamEvent('run_started',{runId:'disabled',payload:{context:{projectId:'demo',pageId:'other',version:'v1'},descriptor:{kind:'message'}}});window.legacyRefresh=0;s.scheduleAgentLiveDemoRefresh=()=>window.legacyRefresh++;s.handleAgentStreamEvent('run_live_changes',{payload:{files:[]}});});
    assert.equal(await page.evaluate(()=>window.legacyRefresh),1);
    // Runtime rollback does not complete/cancel the Agent run.
    await page.evaluate(() => { const s=window.shell;s.handleAgentStreamEvent('run_started',{runId:'runtime-toggle',createdAt:new Date().toISOString(),payload:{progressivePreview:true,context:{projectId:'demo',pageId:'other',version:'v1'},descriptor:{kind:'message'}}});s.handleAgentStreamEvent('preview_disabled',{runId:'runtime-toggle',payload:{}}); });
    await wait(()=>page.evaluate(()=>!window.shell.previewController.state.runId),'runtime switch off');
    assert.equal(await page.evaluate(()=>window.shell.agentRunState.active),true);
    // Register a provisional page, complete, then verify the formal association.
    await page.evaluate(runId=>window.shell.handleAgentStreamEvent('run_started',{runId,createdAt:new Date().toISOString(),payload:{progressivePreview:true,context:{projectId:'demo',pageId:'__global__'},descriptor:{kind:'skill',skillId:'create-new-page'}}}),newRun);
    await page.evaluate(e=>window.shell.handleAgentStreamEvent('preview_revision',{payload:e}),newEvent);
    await wait(()=>page.evaluate(()=>window.shell.previewController.state.status==='previewing'),'registered provisional preview');
    catalog.projects[0].pages.push({id:'new',name:'Registered new page',targetDevice:'web',versions:['v1']});await write('data/projects.json',JSON.stringify(catalog));
    await page.evaluate(runId=>window.shell.handleAgentStreamEvent('run_finished',{runId,createdAt:new Date().toISOString(),payload:{status:'succeeded'}}),newRun);
    await wait(()=>page.evaluate(()=>window.shell.activePageId==='new'&&new URL(window.shell.mainIframe.src).pathname==='/src/pages/demo/new/v1/index.html'),'registration and final association');

    console.log('Progressive preview browser checks passed: immutable URLs, real Portal, CSS state, JS hold, final result, new page, navigation, rollback.');
} finally {
    observer?.stop();await browser?.close();for(const p of children)p.kill();
    if(observer)await fs.rm(observer.cacheRoot,{recursive:true,force:true});await fs.rm(root,{recursive:true,force:true});
}
