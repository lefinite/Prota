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


 const context={projectId:'demo',pageId:'design',version:'v1'};
 const run=async action=>new Promise((resolve,reject)=>{
  const proc=spawn(process.execPath,['--input-type=module','-e',"import {canvasPersistence} from './server/canvas-autosave.mjs';await canvasPersistence(process.argv[1],process.argv[2],JSON.parse(process.argv[3]),'test-run');" ,action,root,JSON.stringify(context)],{cwd:app,stdio:['ignore','pipe','pipe']});
  let error='';proc.stderr.on('data',data=>error+=data);proc.on('error',reject);proc.on('close',code=>code===0?resolve():reject(Error(error)));
 });
 const disk=async()=>JSON.parse((await fs.readFile(path.join(dir,'canvas-data.js'),'utf8')).slice('window.PROTA_CANVAS = '.length).replace(/;\s*$/,''));
 await page.evaluate(()=>window.protaCanvasSchemaReady);
 await run('begin');
 await page.evaluate(()=>window.protaCanvas.agentState({active:true,targetIds:[]}));
 // Sustained input has no 100ms pause; disk still advances while typing continues.
 await page.mouse.dblclick(500,350);
 const editor=page.locator('.node.editing .node-content');
 for(let i=0;i<16;i++){
  await editor.fill('持续输入-'+i);
  await page.waitForTimeout(40);
  if(i===10) assert.ok((await disk()).nodes.some(n=>n.text?.startsWith('持续输入-')),'typing reaches disk before the session pauses');
 }
 assert.equal(await page.evaluate(()=>window.protaCanvas.prepareNavigation()),true);
 const saved=await disk();
 assert.equal(saved.nodes[0].text,'持续输入-15');
 const manualId=saved.nodes[0].id;
 // Destroy the iframe/browser document, then let the Agent overwrite with stale output.
 await page.goto('about:blank');
 const external=structuredClone(saved);external.nodes=external.nodes.filter(n=>n.id!==manualId);
 external.nodes.push({id:'agent-added',type:'note',x:0,y:0,width:200,height:100,text:'Agent 后台新增'});
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify(external)+';');
 // The bridge worker repairs layout with no canvas UI alive.
 for(let i=0;i<50;i++){
  if((await disk()).nodes.some(n=>n.id===manualId))break;
  await page.waitForTimeout(100);
 }
 let reconciled=await disk();
 assert.equal(reconciled.nodes.find(n=>n.id===manualId)?.text,'持续输入-15');
 assert.ok(reconciled.nodes.some(n=>n.id==='agent-added'));
 await run('finish');
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'.canvas-autosave.json'),'utf8')).runs,[]);
 // Restart the bridge with a pending durable receipt and an otherwise valid layout.
 const journal=JSON.parse(await fs.readFile(path.join(dir,'.canvas-autosave.json'),'utf8'));
 journal.pending=true;
 await fs.writeFile(path.join(dir,'.canvas-autosave.json'),JSON.stringify(journal));
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify(external)+';');
 const stopped=child;stopped.kill();await new Promise(resolve=>stopped.once('exit',resolve));
 child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(temp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});child.stderr.on('data',d=>logs+=d);
 for(let i=0;i<50;i++){
  if((await disk()).nodes.some(n=>n.id===manualId))break;
  await page.waitForTimeout(100);
 }
 reconciled=await disk();assert.equal(reconciled.nodes.find(n=>n.id===manualId)?.text,'持续输入-15');
 assert.deepEqual(errors,[]);
 console.log('PASS: sustained typing reaches disk during Agent work; background merge survives leaving and bridge restart');
}finally{await browser?.close();child?.kill();}
