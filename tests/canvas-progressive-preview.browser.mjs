import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {PreviewObserver} from '../server/preview/observer.mjs';
import {previewConfig} from '../server/preview/config.mjs';

const temp=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'prota-canvas-progressive-')));
const root=path.join(temp,'workspace'),config=path.join(temp,'config'),relative='src/pages/demo/canvas/v1',dir=path.join(root,relative);
const children=[];let browser,observer,logs='';
const write=async(name,data)=>{const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);};
const freePort=()=>new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
const wait=async(fn,label)=>{for(let i=0;i<160;i++){try{if(await fn())return;}catch{}await new Promise(r=>setTimeout(r,60));}throw Error('Timed out: '+label+'\n'+logs.slice(-1500));};
const context={projectId:'demo',pageId:'canvas',version:'v1',pageMode:'infinite-canvas'};
const runId='canvas-progressive-run';
try{
 await fs.mkdir(dir,{recursive:true});await fs.cp('src/templates/infinite-canvas',dir,{recursive:true});
 await write('workspace.json',JSON.stringify({id:'canvas-progressive',formatVersion:1}));
 await write('data/projects.json',JSON.stringify({projects:[{id:'demo',name:'Demo',pages:[{id:'canvas',name:'Canvas',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']},{id:'other',name:'Other',targetDevice:'web',versions:['v1']}]}],activeProjectId:'demo',activePageId:'canvas'}));
 await write('src/pages/demo/other/v1/index.html','<h1>Other page</h1>');
 const doc={schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[{id:'existing',type:'board',name:'Existing',src:'boards/existing/index.html',x:100,y:150,width:400,height:300},{id:'draft',type:'note',name:'Draft',text:'Original note',x:100,y:550,width:200,height:120}]};
 await write(relative+'/canvas-data.js','window.PROTA_CANVAS = '+JSON.stringify(doc)+';');
 await write(relative+'/boards/existing/index.html','<h1>Existing board</h1><input value="state">');
 await fs.mkdir(config);await fs.writeFile(path.join(config,'workspace.json'),JSON.stringify({path:root}));
 const port=await freePort(),agentPort=await freePort(),base=`http://127.0.0.1:${port}`;
 const env={...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:config,READIFY_PORT:String(port),READIFY_AGENT_PORT:String(agentPort),PYTHONDONTWRITEBYTECODE:'1'};
 for(const [cmd,args] of [['python3',['server/bridge.py']],['node',['server/agent-server.mjs']]]){const child=spawn(cmd,args,{env,stdio:['ignore','pipe','pipe']});children.push(child);child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);}
 await wait(async()=>(await fetch(base+'/api/workspace')).ok,'bridge');await wait(async()=>(await fetch(`http://127.0.0.1:${agentPort}/api/agent/health`)).ok,'agent');
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//,r=>r.continue({url:r.request().url().replace(/:8081\//,`:${agentPort}/`)}));
 await page.route(/http:\/\/(localhost|127\.0\.0\.1):8080\//,r=>r.continue({url:r.request().url().replace(/http:\/\/(localhost|127\.0\.0\.1):8080\//,base+'/')}));
 await page.goto(base+'/portal/index.html');await wait(()=>page.evaluate(()=>Boolean(window.shell?.projects?.projects?.length)),'shell');
 await page.evaluate(async()=>{window.shell.enterProject('demo');await window.shell.switchPage('canvas','v1');});
 const canvas=page.frameLocator('#mainIframe');await canvas.locator('.node[data-id="existing"] iframe').contentFrame().locator('input').waitFor();
 await canvas.locator('.node[data-id="existing"] .node-title').click();
 const start=await page.evaluate(()=>{const f=window.shell.mainIframe.contentWindow;f.originalRuntime=f.protaCanvas;return{selection:f.protaCanvas.getSelection(),viewport:f.protaCanvas.getState().viewport};});
 const send=(type,payload,id=runId)=>page.evaluate(({type,payload,id})=>window.shell.handleAgentSseChunk(`event: ${type}\ndata: ${JSON.stringify({type,runId:id,createdAt:new Date().toISOString(),payload})}\n\n`),{type,payload,id});
 await send('run_started',{progressivePreview:true,context,descriptor:{kind:'message'}});
 await wait(()=>canvas.locator('body').evaluate(el=>el.classList.contains('agent-working')),'Agent edit lock');
 const events=[];observer=new PreviewObserver({workspaceRoot:root,configDirectory:config,runId,scope:context,publish:e=>events.push(e),config:{...previewConfig,stableMs:40,scanMs:80,refreshMs:80}}).start();
 const deliver=async count=>{await wait(()=>events.length>count,'snapshot');const e=events.at(-1);await send('preview_revision',e);await wait(()=>page.evaluate(revision=>window.shell.previewController?.state.revision===revision,e.revision),'canvas applies revision');return e;};
 await deliver(0);await canvas.locator('.node[data-id="existing"] iframe').contentFrame().locator('input').fill('Retain me');
 const addBoard=async(id,rev)=>{doc.revision=rev;doc.nodes.push({id,type:'board',name:id,src:`boards/${id}/index.html`,x:600+rev*40,y:150,width:350,height:300});await write(relative+`/boards/${id}/index.html`,`<h1>${id}</h1>`);await write(relative+'/canvas-data.js','window.PROTA_CANVAS = '+JSON.stringify(doc)+';');};
 let count=events.length;await addBoard('new-board',1);let latest=await deliver(count);
 await canvas.locator('.node[data-id="new-board"] iframe').contentFrame().getByText('new-board',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.shell.agentRunState.active),true,'board appears before run completion');
 assert.equal(await page.evaluate(()=>{const f=window.shell.mainIframe.contentWindow;return f.originalRuntime===f.protaCanvas;}),true,'outer runtime retained');
 assert.equal(await canvas.locator('.node[data-id="existing"] iframe').contentFrame().locator('input').inputValue(),'Retain me');
 assert.deepEqual(await page.evaluate(()=>{const e=window.shell.mainIframe.contentWindow.protaCanvas;return{selection:e.getSelection(),viewport:e.getState().viewport};}),start);
 // Reconnecting has only run_status + the latest valid revision, no run_started.
 await page.evaluate(()=>{window.shell.previewController.navigate();window.shell.previewController=null;});
 count=events.length;await addBoard('after-reconnect',2);await wait(()=>events.length>count,'reconnect revision');latest=events.at(-1);
 await send('run_status',{runState:{active:true,runId,status:'running'},progressivePreview:true,context,previewRevision:latest});
 await wait(()=>page.evaluate(revision=>window.shell.previewController?.state.revision===revision,latest.revision),'resumed revision');
 await canvas.locator('.node[data-id="after-reconnect"] iframe').contentFrame().getByText('after-reconnect',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.shell.previewController.state.revision),latest.revision);
 // Feature disabled still uses safe read-only synchronization during Agent work.
 observer.stop();await send('preview_disabled',{});await wait(()=>page.evaluate(()=>!window.shell.previewController.state.runId),'disabled');
 await addBoard('legacy-live',3);
 await send('run_live_changes',{files:[{path:relative+'/canvas-data.js'},{path:relative+'/boards/legacy-live/index.html'}]});
 await canvas.locator('.node[data-id="legacy-live"] iframe').contentFrame().getByText('legacy-live',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.shell.agentRunState.active),true);
 // A refused synchronization is queued and retried without another file event.
 await page.evaluate(()=>{const e=window.shell.mainIframe.contentWindow.protaCanvas,original=e.reloadFromDisk;e.reloadFromDisk=async(...args)=>{e.reloadFromDisk=original;return false;};});
 await addBoard('retry-board',4);await send('run_live_changes',{files:[{path:relative+'/canvas-data.js'},{path:relative+'/boards/retry-board/index.html'}]});
 await canvas.locator('.node[data-id="retry-board"] iframe').contentFrame().getByText('retry-board',{exact:true}).waitFor();
 // A real unsaved draft blocks background replacement, including deferred retries.
 await page.evaluate(()=>{window.shell.agentRunState.active=false;window.shell.syncCanvasAgentStatus();});
 await wait(()=>canvas.locator('body').evaluate(el=>!el.classList.contains('agent-working')),'unlocked draft setup');
 await page.route('**/api/canvas/save',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"offline"}'}));
 await canvas.locator('.node[data-id="draft"] .node-content').click();await canvas.locator('#selection-tools [data-action=edit-text]').click();await canvas.locator('[contenteditable="plaintext-only"]').fill('Unsaved local draft');await canvas.locator('[contenteditable="plaintext-only"]').press('Tab');
 await wait(()=>page.evaluate(()=>window.shell.mainIframe.contentWindow.protaCanvas.isDirty()),'draft');
 await page.evaluate(()=>{window.shell.agentRunState.active=true;window.shell.syncCanvasAgentStatus();});
 await addBoard('draft-protected',5);await send('run_live_changes',{files:[{path:relative+'/canvas-data.js'}]});await new Promise(r=>setTimeout(r,1600));
 assert.equal(await canvas.locator('.node[data-id="draft-protected"]').count(),0);assert.equal(await canvas.locator('.node[data-id="draft"] .node-content').textContent(),'Unsaved local draft');
 // Navigation cancels deferred updates even when a retry is already queued.
 await page.evaluate(()=>{window.shell.confirmCanvasNavigation=()=>true;return window.shell.switchPage('other','v1');});
 await page.locator('#mainIframe').contentFrame().getByText('Other page',{exact:true}).waitFor();await new Promise(r=>setTimeout(r,900));assert.equal(await page.evaluate(()=>window.shell.activePageId),'other');
 console.log('PASS: real Portal SSE → busy canvas adds boards; reconnect replay, legacy read-only sync, retry, viewport/selection/iframe state and draft/navigation protection.');
}finally{observer?.stop();await browser?.close();children.forEach(child=>child.kill());if(observer)await fs.rm(observer.cacheRoot,{recursive:true,force:true});await fs.rm(temp,{recursive:true,force:true});}
