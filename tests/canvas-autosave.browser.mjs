import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {createSnapshot} from '../server/preview/snapshot.mjs';
import {previewCacheRoot} from '../server/preview/config.mjs';
const app=process.cwd(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'prota-canvas-test-')),root=path.join(temp,'workspace');
const dir=path.join(root,'src/pages/demo/design/v1');
const evidence=process.env.PROTA_CANVAS_EVIDENCE_DIR||temp;await fs.mkdir(evidence,{recursive:true});
const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
let child,browser,logs='';
try {
 await fs.mkdir(dir,{recursive:true});await fs.cp(path.join(app,'src/templates/infinite-canvas'),dir,{recursive:true});
 await fs.mkdir(path.join(root,'data'),{recursive:true});await fs.writeFile(path.join(root,'workspace.json'),JSON.stringify({id:'canvas-test',formatVersion:1}));
 await fs.writeFile(path.join(root,'data/projects.json'),JSON.stringify({projects:[{id:'demo',name:'Demo',pages:[{id:'design',name:'Canvas',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']}]}],activeProjectId:'demo',activePageId:'design'}));
 child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(temp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 const base=`http://127.0.0.1:${port}`;
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=base+'/src/pages/demo/design/v1/index.html';await page.goto(url);

 let dialogs = 0;
 page.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
 const disk = async () => JSON.parse((await fs.readFile(path.join(dir,'canvas-data.js'),'utf8')).replace('window.PROTA_CANVAS = ','').replace(/;\s*$/,''));
 const key = 'prota-canvas-draft:/src/pages/demo/design/v1/index.html';
 // Leaving during the debounce flushes the text editor and waits for disk.
 await page.mouse.dblclick(400,300);
 await page.locator('.node.editing .node-content').fill('立即离开也保存');
 assert.equal(await page.evaluate(()=>window.protaCanvas.prepareNavigation()),true);
 assert.equal((await disk()).nodes[0].text,'立即离开也保存');
 assert.equal(await page.evaluate(()=>window.protaCanvas.isDirty()),false);
 // Ordinary refresh during a failed save silently restores the browser draft.
 let failures = 0;
 await page.route('**/api/canvas/save',r=>{failures++;return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'offline'})});});
 await page.locator('.node.text .node-content').dblclick();
 await page.locator('.node.editing .node-content').fill('离线草稿自动恢复');
 assert.equal(await page.evaluate(()=>window.protaCanvas.prepareNavigation()),true);
 await page.reload();
 await page.waitForFunction(()=>window.protaCanvas?.getState().nodes[0]?.text==='离线草稿自动恢复');
 assert.equal(await page.getByRole('button',{name:'恢复修改',exact:true}).count(),0);
 assert.equal(dialogs,0);
 // Unchanged failed snapshots retry without another edit or a retry click.
 await page.unroute('**/api/canvas/save');
 await page.waitForFunction(()=>!window.protaCanvas.isDirty(),null,{timeout:8000});
 assert.equal((await disk()).nodes[0].text,'离线草稿自动恢复');
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),null);
 // Edges and document properties also count as recoverable changes.
 const saved = await disk();
 await page.evaluate(({key,saved})=>{
  const state=structuredClone(saved);state.description='recover document fields';
  localStorage.setItem(key,JSON.stringify({state,baseline:saved,savedAt:Date.now()}));
 },{key,saved});
 await page.reload();
 await page.waitForFunction(()=>window.protaCanvas?.getState().description==='recover document fields');
 await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 assert.equal((await disk()).description,'recover document fields');
 // Recovery merges an Agent/disk addition made while the canvas was away.
 const before = await disk(), ours=structuredClone(before), theirs=structuredClone(before);
 ours.nodes[0].text='保留本机输入';theirs.description='external addition';theirs.revision++;
 await page.evaluate(({key,state,baseline})=>localStorage.setItem(key,JSON.stringify({state,baseline,savedAt:Date.now()})),{key,state:ours,baseline:before});
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify(theirs)+';');
 await page.reload();
 await page.waitForFunction(()=>window.protaCanvas?.getState().nodes[0]?.text==='保留本机输入');
 await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 assert.equal((await disk()).description,'external addition');
 assert.equal((await disk()).nodes[0].text,'保留本机输入');
 // A backup quota failure must keep the current page if the server also fails.
 await page.route('**/api/canvas/save',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"offline"}'}));
 await page.locator('.node.text .node-content').dblclick();
 await page.locator('.node.editing .node-content').fill('备份失败也不能丢');
 await page.evaluate(()=>{window.realStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('QuotaExceededError');};});
 assert.equal(await page.evaluate(()=>window.protaCanvas.prepareNavigation()),false);
 assert.equal(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),true);
 await page.evaluate(()=>{Storage.prototype.setItem=window.realStorageSet;});
 await page.unroute('**/api/canvas/save');
 assert.equal(await page.evaluate(()=>window.protaCanvas.prepareNavigation()),true);
 assert.equal((await disk()).nodes[0].text,'备份失败也不能丢');
 // A same-field conflict preserves both versions and never silently overwrites disk.
 const conflictBase=await disk(), conflictOurs=structuredClone(conflictBase), conflictTheirs=structuredClone(conflictBase);
 conflictOurs.nodes[0].text='本机冲突内容';conflictTheirs.nodes[0].text='外部冲突内容';conflictTheirs.revision++;
 await page.evaluate(({key,state,baseline})=>localStorage.setItem(key,JSON.stringify({state,baseline,savedAt:Date.now()})),{key,state:conflictOurs,baseline:conflictBase});
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify(conflictTheirs)+';');
 await page.reload();
 await page.getByRole('button',{name:'应用本机修改',exact:true}).waitFor();
 assert.equal((await disk()).nodes[0].text,'外部冲突内容');
 assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).state.nodes[0].text,key),'本机冲突内容');
 assert.equal(dialogs,0);assert.deepEqual(errors,[]);assert.ok(failures>0);
 console.log('PASS: navigation flush, silent draft recovery, automatic retry, full document recovery and external merge');
}finally{await browser?.close();child?.kill();}
