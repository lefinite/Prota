import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {chromium} from 'playwright';

const app=process.cwd();
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'prota-tracking-portal-'));
const root=path.join(temp,'workspace'),config=path.join(temp,'config');
const children=[];
let browser,logs='';
const write=async(file,content)=>{const abs=path.join(root,file);await fs.mkdir(path.dirname(abs),{recursive:true});await fs.writeFile(abs,content);};
const port=()=>new Promise(resolve=>{const sock=net.createServer().listen(0,'127.0.0.1',()=>sock.close(()=>resolve(sock.address()?.port)));});
const wait=async(fn,label)=>{for(let i=0;i<150;i++){try{if(await fn())return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+label+'\n'+logs.slice(-1000));};
const manifest=(page,version,canvas=false)=>({
  schemaVersion:1,scope:{projectId:'demo',pageId:page,version,pageMode:canvas?'infinite-canvas':'standard'},
  events:[{id:'submit_attempt',name:'submit_attempt',title:'提交',
    purpose:'测量关键提交',question:'多少用户尝试提交？',decision:'是否降低表单门槛',
    score:{impact:3,actionability:3,gap:2,cost:1,duplicate:0,total:7},
    priority:'P0',signal:'attempt',trigger:{type:'click',when:'真实点击提交'},
    parameters:[],targets:[canvas?
    {kind:'canvas-board',boardId:'board_a',nodeId:'node_a',path:'boards/board_a/index.html',anchor:{method:'data-attribute',value:'submit'},status:'bound',confidence:'high'}:
    {kind:'page',path:'index.html',anchor:{method:'data-attribute',value:'submit'},status:'bound',confidence:'high'}]}],
  omitted:[{candidate:'button_hover',reason:'不能支持有效产品决策'}]
});
const buttonHtml=(label)=>`<!doctype html><html><head><meta charset="utf-8"></head><body><button data-prota-track-id="submit" onclick="window.hits=(window.hits||0)+1">${label}</button></body></html>`;
try{
  await fs.mkdir(config,{recursive:true});
  await write('workspace.json',JSON.stringify({id:'tracking-fixture',formatVersion:1}));
  await write('data/projects.json',JSON.stringify({projects:[{id:'demo',name:'埋点集成',folders:[],pages:[
    {id:'web',name:'网页',targetDevice:'web',versions:['v1','v2'],activeVersion:'v1'},
    {id:'canvas',name:'画布',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1'],activeVersion:'v1'}
  ]}],activeProjectId:'demo',activePageId:'web'}));
  for(const version of ['v1','v2']){
    await write(`src/pages/demo/web/${version}/index.html`,buttonHtml(version));
    await write(`src/pages/demo/web/${version}/tracking/events.json`,JSON.stringify(manifest('web',version)));
  }
  const canvasDir=path.join(root,'src/pages/demo/canvas/v1');
  await fs.cp(path.join(app,'src/templates/infinite-canvas'),canvasDir,{recursive:true});
  await write('src/pages/demo/canvas/v1/boards/board_a/index.html',buttonHtml('画板 A'));
  await write('src/pages/demo/canvas/v1/boards/board_b/index.html',buttonHtml('画板 B'));
  await write('src/pages/demo/canvas/v1/canvas-data.js','window.PROTA_CANVAS = '+JSON.stringify({
    schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[
      {id:'node_a',type:'board',name:'A',x:30,y:40,width:320,height:220,src:'boards/board_a/index.html'},
      {id:'node_b',type:'board',name:'B',x:400,y:40,width:320,height:220,src:'boards/board_b/index.html'}
    ]})+';');
  await write('src/pages/demo/canvas/v1/tracking/events.json',JSON.stringify(manifest('canvas','v1',true)));
  await fs.writeFile(path.join(config,'workspace.json'),JSON.stringify({path:root}));
  await fs.writeFile(path.join(config,'agent-provider-config.json'),JSON.stringify({
    providers:[{id:'fixture',label:'测试模型',model:'fixture-model',apiKey:'fixture-key',baseURL:'https://example.invalid/v1',apiType:'openai-completions',sdkOptions:{}}],
    activeProviderId:'fixture',selectedProviderId:'fixture'}));
  const bridgePort=await port(),agentPort=await port(),base=`http://127.0.0.1:${bridgePort}`;
  const env={...process.env,PYTHONDONTWRITEBYTECODE:'1',READIFY_CONFIG_DIR:config,READIFY_WORKSPACE:root,READIFY_PORT:String(bridgePort),READIFY_AGENT_PORT:String(agentPort)};
  for(const [cmd,args] of [['python3',['server/bridge.py']],['node',['server/agent-server.mjs']]]){
    const child=spawn(cmd,args,{cwd:app,env,stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);children.push(child);
  }
  await wait(async()=> (await fetch(base+'/api/workspace')).ok,'bridge');
  await wait(async()=> (await fetch(`http://127.0.0.1:${agentPort}/api/agent/health`)).ok,'agent');
  await fetch(base+'/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/fonts\.google/,r=>r.abort());
  await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//,route=>route.continue({url:route.request().url().replace(/:8081\//,`:${agentPort}/`)}));
  await page.goto(base+'/portal/index.html',{waitUntil:'domcontentloaded'});
  await wait(()=>page.evaluate(()=>Boolean(window.shell?.projects?.projects?.length)),'Portal boot');
  await page.evaluate(async()=>{window.shell.enterProject('demo');await window.shell.switchPage('web');window.shell.setDocDrawerMode('tracking',{open:true});});
  await wait(()=>page.evaluate(()=>window.shell?.trackingReview?.events?.length===1),'tracking loaded');
  await page.getByRole('tab',{name:'埋点'}).waitFor();
  await page.locator('.tracking-marker').first().waitFor();
  assert.equal(await page.locator('.tracking-card').count(),1);
  await page.frameLocator('#mainIframe').locator('[data-prota-track-id="submit"]').click();
  assert.equal(await page.frameLocator('#mainIframe').locator('button').evaluate(e=>e.ownerDocument.defaultView.hits||0),0,'review mode must intercept tracked clicks');
  await page.locator('[data-tracking-action="inspect"]').click();
  await page.frameLocator('#mainIframe').locator('[data-prota-track-id="submit"]').click();
  assert.equal(await page.frameLocator('#mainIframe').locator('button').evaluate(e=>e.ownerDocument.defaultView.hits||0),1,'preview must restore original click handler');
  await page.evaluate(()=>window.shell.switchVersion('v2'));
  await wait(()=>page.evaluate(()=>window.shell?.trackingReview?.context()?.version==='v2'),'v2 switched');
  await wait(()=>page.frameLocator('#mainIframe').locator('button').textContent().then(x=>x==='v2'),'v2 rendered');
  assert.equal(await page.evaluate(()=>window.shell.trackingReview.events[0].id),'submit_attempt');
  await page.evaluate(async()=>{await window.shell.switchPage('canvas');window.shell.setDocDrawerMode('tracking',{open:true});});
  await wait(()=>page.frameLocator('#mainIframe').locator('#stage').evaluate(()=>Boolean(window.protaCanvas)).catch(()=>false),'canvas ready');
  await wait(()=>page.evaluate(()=>Boolean(window.shell.trackingReview.resolveElement(window.shell.trackingReview.events[0].targets[0]))),'board A target');
  const id=await page.evaluate(()=>{
    const target=window.shell.trackingReview.events[0].targets[0];
    return window.shell.trackingReview.resolveElement(target).ctx.boardId;
  });
  assert.equal(id,'board_a','two boards with identical anchors must not collide');
  await page.locator('.tracking-marker').first().click();
  assert.equal(await page.locator('.tracking-card.is-active').count(),1);
  const before=await fs.readFile(path.join(canvasDir,'boards/board_a/index.html'),'utf8');
  const resp=await fetch(base+'/api/agent/page/download-zip?projectId=demo&pageId=canvas&version=v1');
  assert.equal(resp.status,200,await resp.text().catch(()=>'')); // inspect archive
  const zipped=Buffer.from(await resp.arrayBuffer());
  const archivePath=path.join(temp,'review.zip');await fs.writeFile(archivePath,zipped);
  const entries=execFileSync('python3',['-c','import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);print("\\n".join(z.namelist()))',archivePath],{encoding:'utf8'});
  assert.match(entries,/review\.html/);
  assert.match(entries,/tracking\/events\.json/);
  assert.equal(await fs.readFile(path.join(canvasDir,'boards/board_a/index.html'),'utf8'),before,'ZIP generation cannot mutate workspace boards');
  assert.equal(errors.length,0,'Portal page errors: '+errors.join('; '));
  console.log('Portal tracking tab, version isolation, nested-board binding, read-only inspect/preview and ZIP all passed');
}finally{
  await browser?.close();
  for(const child of children){child.kill('SIGTERM');}
  await fs.rm(temp,{recursive:true,force:true});
}
