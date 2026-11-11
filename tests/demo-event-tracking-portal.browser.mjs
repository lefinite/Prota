import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {flowManifest,flowHtml,doneHtml} from './fixtures/tracking-flow.mjs';

const app=process.cwd();
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'prota-tracking-portal-'));
const root=path.join(temp,'workspace'),config=path.join(temp,'config');
const children=[];
let browser,page,logs='';
const write=async(file,content)=>{const abs=path.join(root,file);await fs.mkdir(path.dirname(abs),{recursive:true});await fs.writeFile(abs,content);};
const port=()=>new Promise(resolve=>{const sock=net.createServer().listen(0,'127.0.0.1',()=>{const value=sock.address().port;sock.close(()=>resolve(value));});});
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
    {id:'canvas',name:'画布',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1'],activeVersion:'v1'},
    ...(process.env.AUTH_PHONE_FIXTURE_DIR?[{id:'auth_phone',name:'手机号登录与账户',targetDevice:'mobile',versions:['v1'],activeVersion:'v1'}]:[])
  ]}],activeProjectId:'demo',activePageId:'web'}));
  for(const version of ['v1','v2']){
    await write(`src/pages/demo/web/${version}/index.html`,buttonHtml(version));
    await write(`src/pages/demo/web/${version}/tracking/events.json`,JSON.stringify(manifest('web',version)));
  }
  await write('src/pages/demo/web/v2/index.html',flowHtml);
  await write('src/pages/demo/web/v2/done.html',doneHtml);
  await write('src/pages/demo/web/v2/help.html','帮助说明');
  await write('src/pages/demo/web/v2/tracking/events.json',JSON.stringify(flowManifest()));
  const canvasDir=path.join(root,'src/pages/demo/canvas/v1');
  await fs.cp(path.join(app,'src/templates/infinite-canvas'),canvasDir,{recursive:true});
  await write('src/pages/demo/canvas/v1/boards/board_a/index.html',flowHtml);
  await write('src/pages/demo/canvas/v1/boards/board_a/done.html',doneHtml);
  await write('src/pages/demo/canvas/v1/boards/board_a/help.html','帮助说明');
  await write('src/pages/demo/canvas/v1/boards/board_b/index.html',buttonHtml('画板 B'));
  await write('src/pages/demo/canvas/v1/canvas-data.js','window.PROTA_CANVAS = '+JSON.stringify({
    schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[
      {id:'node_a',type:'board',name:'A',x:30,y:40,width:320,height:220,src:'boards/board_a/index.html'},
      {id:'node_b',type:'board',name:'B',x:400,y:40,width:320,height:220,src:'boards/board_b/index.html'}
    ]})+';');
  await write('src/pages/demo/canvas/v1/tracking/events.json',JSON.stringify(flowManifest({canvas:true})));
  if(process.env.AUTH_PHONE_FIXTURE_DIR){
    const destination=path.join(root,'src/pages/demo/auth_phone/v1');
    await fs.cp(process.env.AUTH_PHONE_FIXTURE_DIR,destination,{recursive:true});
    const file=path.join(destination,'tracking/events.json');
    const data=JSON.parse(await fs.readFile(file,'utf8'));
    data.scope={...data.scope,projectId:'demo',pageId:'auth_phone'};
    await fs.writeFile(file,JSON.stringify(data));
  }
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
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  page=await browser.newPage({viewport:{width:1440,height:900}});
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
  assert.equal(await page.frameLocator('#mainIframe').locator('button').evaluate(e=>e.ownerDocument.defaultView.hits||0),1,'tracked business clicks must continue');
  await page.frameLocator('#mainIframe').locator('button').evaluate(el=>{
    const container=el.ownerDocument.createElement('div');
    container.style.cssText='height:180px;overflow:auto';
    el.before(container);container.append(el);
    el.style.marginTop='900px';
  });
  await page.locator('[data-tracking-card="submit_attempt"] .tracking-card__title').click();
  await wait(()=>page.frameLocator('#mainIframe').locator('button').evaluate(el=>el.parentElement.scrollTop>700),'card body scrolls the local container');
  assert.equal(await page.frameLocator('#mainIframe').locator('button').evaluate(e=>e.ownerDocument.defaultView.hits),1,'locating never activates the tracked control');
  assert.equal(await page.locator('[data-tracking-action]').count(),0,'obsolete review toolbar removed');
  await page.evaluate(()=>window.shell.switchVersion('v2'));
  await wait(()=>page.evaluate(()=>window.shell?.trackingReview?.context()?.version==='v2'),'v2 switched');
  await wait(()=>page.evaluate(()=>window.shell.trackingReview.events.length===4),'v2 flow loaded');
  await wait(()=>page.locator('.tracking-marker').count().then(n=>n===1),'only login marker');
  assert.equal(await page.locator('.tracking-group').count(),5,'all business screens including no-event screen');
  assert.equal(await page.locator('.tracking-table-wrap tbody tr').count(),2,'parameters visible without expansion');
  assert.equal(await page.locator('#annotationDrawerMeta').innerText(),'','header contains no tracking actions');
  assert.equal(await page.locator('.tracking-page-filter .tracking-download').count(),1,'Excel download lives in the content toolbar');
  const tabs=await page.locator('.doc-tab').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().y));
  assert.ok(tabs.every(y=>Math.abs(y-tabs[0])<2),'three tabs remain one row');
  await page.frameLocator('#mainIframe').locator('[data-view="login"] [data-prota-track-id="submit"]').click();
  await wait(()=>page.frameLocator('#mainIframe').locator('[data-view="register"]').isVisible(),'tracked hash navigation works');
  await wait(()=>page.locator('.tracking-marker[data-track-event="register_submit"]').count().then(n=>n===1),'register marker resolves');
  assert.equal(await page.locator('.tracking-marker[data-track-event="login_submit"]').count(),0,'same selector in wrong screen cannot resolve');
  const tokenBeforeDetails=await page.evaluate(()=>window.shell.trackingReview.navigationToken);
  await page.locator('[data-tracking-card="recovery_submit"] .tracking-rationale summary').click();
  assert.equal(await page.evaluate(()=>window.shell.trackingReview.navigationToken),tokenBeforeDetails,'expanding rationale does not locate');
  await page.locator('[data-tracking-card="recovery_submit"] .tracking-card__title').click();
  await wait(()=>page.frameLocator('#mainIframe').locator('[data-view="recovery"]').isVisible(),'list opens state-driven recovery view');
  await page.locator('.tracking-marker[data-track-event="recovery_submit"]').waitFor();
  await page.locator('[data-tracking-event="done_submit"]').click();
  await wait(()=>page.frameLocator('#mainIframe').locator('h2').textContent().then(x=>x==='验证完成'),'list navigates to local HTML destination');
  await page.locator('.tracking-marker[data-track-event="done_submit"]').waitFor();
  await page.locator('[data-tracking-event="register_submit"]').focus();
  await page.keyboard.press('Enter');
  await wait(()=>page.frameLocator('#mainIframe').locator('[data-view="register"]').isVisible(),'reverse location restores route');
  await page.frameLocator('#mainIframe').locator('[data-view="register"] [data-prota-track-id="submit"]').click();
  await wait(()=>page.frameLocator('#mainIframe').locator('h2').textContent().then(x=>x==='验证完成'),'tracked full document navigation works');
  await page.locator('.tracking-marker[data-track-event="done_submit"]').waitFor();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'下载 Excel'}).click();const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/v2.*\.xlsx$/);await download.saveAs(path.join(temp,'tracking.xlsx'));
  const downloadCheck=execFileSync('python3',['-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert "loginMethod" in z.read("xl/worksheets/sheet1.xml").decode();assert "帮助说明" in z.read("xl/worksheets/sheet2.xml").decode()',path.join(temp,'tracking.xlsx')],{encoding:'utf8'});
  assert.equal(await page.locator('.tracking-binding').count(),0,'technical bindings are not rendered');
  const heights=await page.locator('.tracking-page-filter').evaluate(el=>[el.querySelector('summary').getBoundingClientRect().height,el.querySelector('.tracking-download').getBoundingClientRect().height]);assert.deepEqual(heights,[34,34]);
  assert.equal(await page.locator('.tracking-download').innerText(),'','export uses an icon only');
  assert.equal(await page.getByText('埋点依据',{exact:true}).count(),0);
  assert.equal(await page.locator('.tracking-rationale summary .tracking-trigger').count(),4,'trigger sentence is the disclosure');
  assert.equal(await page.locator('[data-tracking-status]:visible').count(),0,'valid/default states have no visible labels');
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  const navToken=await page.evaluate(()=>window.shell.trackingReview.navigationToken);
  await page.locator('[data-tracking-card="login_submit"] [data-tracking-copy="webLogin"]').click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'webLogin');
  assert.equal(await page.evaluate(()=>window.shell.trackingReview.navigationToken),navToken,'copy does not locate');
  await page.locator('[data-tracking-card="login_submit"] .tracking-cell-copy').first().click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'loginMethod');
  await page.locator('[data-tracking-card="login_submit"] .tracking-cell-copy').nth(2).click();
  assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/password \/ code/);
  await page.locator('[data-tracking-card="login_submit"] .tracking-copy-table').click();
  assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/loginMethod\tstring/);
  await page.locator('#trackingPageFilter').click();
  await page.locator('.tracking-picker').getByRole('searchbox',{name:'搜索页面'}).fill('找回');
  assert.equal(await page.locator('[data-page-option]:visible').count(),1);
  await page.locator('[data-page-option="recovery"]').click();
  assert.equal(await page.locator('.tracking-card').count(),1);
  await page.locator('#trackingPageFilter').click();await page.locator('[data-page-option="all"]').click();
  assert.equal(await page.locator('.tracking-card__title .tracking-operation').count(),0,'operation moved off the title');
  assert.equal(await page.locator('.tracking-id-row .tracking-operation').count(),4,'operation shares the ID row');
  assert.equal(await page.locator('[data-copied]').count(),0,'copy leaves no visual state');
  assert.equal(await page.locator('[data-review-action="valid_event"]:visible').count(),0,'normal events have no confirmation action');
  assert.equal(await page.locator('.tracking-manage').count(),0,'status dropdown removed');
  const file=path.join(root,'src/pages/demo/web/v2/tracking/events.json');
  const pending=JSON.parse(await fs.readFile(file,'utf8'));pending.screens[0].status='needs_review';pending.screens[0].reason='待人工核验';pending.events[0].reviewStatus='needs_review';await fs.writeFile(file,JSON.stringify(pending));
  await page.evaluate(()=>window.shell.trackingReview.load());
  const heading=()=>page.locator('.tracking-group__heading').first();
  await heading().getByLabel('页面状态').click();await heading().getByRole('button',{name:'确认有效'}).click();
  await wait(()=>page.evaluate(()=>window.shell.trackingReview.screens[0].reviewedByUser===true),'screen confirmed saved');
  assert.equal(await heading().getByRole('button',{name:'确认有效'}).filter({visible:true}).count(),0,'confirmed pages have no state action');
  const card=()=>page.locator('[data-tracking-card="login_submit"]');
  assert.equal(await card().locator('.tracking-card__heading .tracking-state:not([hidden])').count(),1,'event status sits beside the title');
  assert.equal(await card().locator('.tracking-card__footer').count(),0,'no status footer');
  await card().getByLabel('事件状态').click();
  await page.screenshot({path:'/tmp/tracking-status-menu.png'});
  await card().getByRole('button',{name:'确认有效'}).click();
  await wait(()=>page.evaluate(()=>window.shell.trackingReview.events[0].reviewStatus==='valid'),'valid state persisted');
  assert.equal(await page.locator('[data-tracking-status="login_submit"]:visible').count(),0);
  assert.equal(JSON.parse(await fs.readFile(file,'utf8')).events[0].reviewStatus,'valid');
  assert.equal(await card().getByRole('button',{name:'确认有效'}).filter({visible:true}).count(),0,'confirmation is one way');
  await card().getByLabel('更多事件操作').click();assert.equal(await card().getByRole('button',{name:'删除事件'}).locator('svg').count(),1,'delete matches the page menu icon');await card().getByRole('button',{name:'删除事件'}).click();
  await wait(()=>page.locator('.tracking-card').count().then(n=>n===3),'deleted event removed');
  assert.equal(await page.locator('.tracking-number').first().innerText(),'01','remaining events renumbered');
  assert.equal(JSON.parse(await fs.readFile(file,'utf8')).events.length,3);
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await wait(()=>page.locator('.tracking-card').count().then(n=>n===4),'delete undo restores event');
  const savedReview=await page.evaluate(()=>structuredClone(window.shell.trackingReview.manifest));
  await page.evaluate(()=>{window.shell.trackingReview.hasManifest=false;window.shell.trackingReview.render();});
  await page.screenshot({path:'/tmp/tracking-empty-redesign.png'});
  await page.evaluate(()=>{window.shell.trackingReview.hasManifest=true;window.shell.trackingReview.render();});
  await page.locator('#trackingPageFilter').click();
  await page.screenshot({path:'/tmp/tracking-picker-redesign.png'});
  await page.keyboard.press('Escape');
  await page.evaluate(async()=>{await window.shell.switchPage('canvas');window.shell.setDocDrawerMode('tracking',{open:true});});
  await wait(()=>page.frameLocator('#mainIframe').locator('#stage').evaluate(()=>Boolean(window.protaCanvas)).catch(()=>false),'canvas ready');
  await wait(()=>page.evaluate(()=>Boolean(window.shell.trackingReview.resolveElement(window.shell.trackingReview.events[0].targets[0],window.shell.trackingReview.screens[0]))),'board A target');
  const id=await page.evaluate(()=>{
    const target=window.shell.trackingReview.events[0].targets[0];
    return window.shell.trackingReview.resolveElement(target,window.shell.trackingReview.screens[0]).ctx.boardId;
  });
  assert.equal(id,'board_a','two boards with identical anchors must not collide');
  await page.locator('.tracking-marker').first().click();
  assert.equal(await page.locator('.tracking-card.is-active').count(),1);
  await page.locator('[data-tracking-event="register_submit"]').click();
  await wait(()=>page.locator('.tracking-marker[data-track-event="register_submit"]').count().then(n=>n===1),'canvas hash navigation');
  await page.locator('[data-tracking-card="done_submit"] .tracking-card__title').click();
  await wait(()=>page.locator('.tracking-marker[data-track-event="done_submit"]').count().then(n=>n===1),'canvas child document navigation');
  await page.locator('[data-tracking-event="login_submit"]').click();
  await wait(()=>page.locator('.tracking-marker[data-track-event="login_submit"]').count().then(n=>n===1),'canvas returns to login');
  await page.screenshot({path:'/tmp/tracking-v2-portal.png'});
  await page.setViewportSize({width:1024,height:768});
  const narrowTabs=await page.locator('.doc-tab').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().y));
  assert.ok(narrowTabs.every(y=>Math.abs(y-narrowTabs[0])<2),'narrow tabs remain one row');
  await page.screenshot({path:'/tmp/tracking-v2-portal-narrow.png'});
  const before=await fs.readFile(path.join(canvasDir,'boards/board_a/index.html'),'utf8');
  const resp=await fetch(base+'/api/agent/page/download-zip?projectId=demo&pageId=canvas&version=v1');
  assert.equal(resp.status,200,'download ZIP response'); // inspect archive
  const zipped=Buffer.from(await resp.arrayBuffer());
  const archivePath=path.join(temp,'review.zip');await fs.writeFile(archivePath,zipped);
  const entries=execFileSync('python3',['-c','import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);print("\\n".join(z.namelist()))',archivePath],{encoding:'utf8'});
  assert.match(entries,/review\.html/);
  assert.match(entries,/tracking\/events\.json/);
  assert.equal(await fs.readFile(path.join(canvasDir,'boards/board_a/index.html'),'utf8'),before,'ZIP generation cannot mutate workspace boards');
  if(process.env.AUTH_PHONE_FIXTURE_DIR){
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(async()=>{await window.shell.switchPage('auth_phone');window.shell.setDocDrawerMode('tracking',{open:true});});
    await wait(()=>page.evaluate(()=>window.shell.trackingReview.events.some(e=>e.id==='account_show')),'actual phone login tracking loaded');
    await page.frameLocator('#mainIframe').locator('[data-prota-track-id="screen-entry"]').waitFor();
    const saved=await page.frameLocator('#mainIframe').locator('body').evaluate(el=>el.ownerDocument.defaultView.localStorage.getItem('readify-auth-phone-v1'));
    const ids=await page.evaluate(()=>window.shell.trackingReview.events.map(e=>e.id));
    for(const id of [...ids,...ids].reverse()){
      await page.locator(`[data-tracking-card="${id}"] .tracking-card__title`).click();
      await wait(()=>page.evaluate(id=>window.shell.trackingReview.active===id&&Boolean(window.shell.trackingReview.resolved(window.shell.trackingReview.events.find(e=>e.id===id))),id),'actual phone event '+id);
    }
    assert.equal(await page.frameLocator('#mainIframe').locator('body').evaluate(el=>el.ownerDocument.defaultView.localStorage.getItem('readify-auth-phone-v1')),saved,'review scene navigation must not persist login, code or account mutations');
    console.log(`Actual phone login page: all ${ids.length} events located twice in reverse order without persisted account changes`);
  }
  assert.equal(errors.length,0,'Portal page errors: '+errors.join('; '));
  console.log('Portal tracking tab, version isolation, multi-screen routes, state views, company-format Excel, nested-board navigation and ZIP all passed');
}catch(error){
  console.error(await page?.evaluate(()=>({active:window.shell.trackingReview.active,token:window.shell.trackingReview.navigationToken,frames:window.shell.trackingReview.events.map(e=>({id:e.id,status:window.shell.trackingReview.status(e),src:window.shell.trackingReview.frameFor(e.targets[0])?.iframe?.src,url:window.shell.trackingReview.resolveFrame(e.targets[0])?.window?.location.href})),errors:window.shell.trackingReview.error})).catch(()=>null));
  throw error;
}finally{
  await browser?.close();
  for(const child of children){child.kill('SIGTERM');}
  await fs.rm(temp,{recursive:true,force:true});
}
