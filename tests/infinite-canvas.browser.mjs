import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
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
 // No side panels, no duplicate agent UI, canvas occupies the whole viewport.
 assert.equal(await page.locator('#outline,#inspector,#agent-composer,header,#save,#export').count(),0);
 assert.deepEqual(await page.locator('#stage').evaluate(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,width:el.clientWidth,height:el.clientHeight})),{x:0,y:0,width:1440,height:1000});
 // Runtime V4 reports to the portal.
 assert.equal(await page.evaluate(()=>window.protaCanvas.runtimeVersion),4);
 await page.locator('#first-board').click();await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 assert.equal(await page.locator('.node.board').count(),1);
 const addAt=async(name,x,y)=>{await page.locator('#stage').click({button:'right',position:{x,y}});await page.getByRole('menuitem').filter({hasText:name}).first().click();};
 // Single text: edit + style actions, icon+text buttons only.
 await addAt('文本',950,160);let textId=await page.evaluate(()=>window.protaCanvas.getSelection()[0]);
 assert.equal(await page.locator('#selection-tools [data-action=edit-text]').isVisible(),true);
 assert.equal(await page.locator('#selection-tools [data-action=style]').isVisible(),true);
 assert.equal(await page.locator('#selection-tools [data-action=group]').count(),0);
 assert.equal(await page.locator('#selection-tools button:not(:has(svg)):visible').count(),0);
 await page.locator('#selection-tools [data-action=edit-text]').click();await page.locator('.node-content[contenteditable=true]').fill('浮动工具栏与实时保存');
 await page.waitForFunction(()=>!window.protaCanvas.isDirty());assert.equal(await page.locator('.node-content[contenteditable=true]').count(),1,'autosave must not end text editing');assert.ok((await fs.readFile(path.join(dir,'canvas-data.js'),'utf8')).includes('浮动工具栏与实时保存'));await page.locator('#stage').click({position:{x:60,y:760}});await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 assert.equal(await page.locator('.node.text .node-content').textContent(),'浮动工具栏与实时保存');
 await page.locator('.node.text .node-content').click();
 await page.locator('#selection-tools [data-action=style]').click();await page.getByLabel('宽',{exact:true}).fill('320');await page.getByLabel('宽',{exact:true}).press('Tab');await page.locator('#close-properties').click();
 assert.equal((await page.evaluate(()=>window.protaCanvas.getState())).nodes.find(n=>n.id===textId).width,320);
 // Board without code shows generate-style agent action; with code shows preview.
 const boardId=await page.evaluate(()=>window.protaCanvas.getState().nodes.find(n=>n.type==='board').id);
 await page.locator(`.node[data-id="${boardId}"] .node-title`).click();
 assert.equal(await page.locator('#selection-tools [data-action=agent]').textContent(),'Agent 生成');
 // Sticky note single-select shows color swatches in the property bubble.
 await addAt('便签',380,200);const noteId=await page.evaluate(()=>window.protaCanvas.getSelection()[0]);
 await page.locator('#selection-tools [data-action=color]').click();
 assert.equal(await page.locator('.swatch').count(),6);
 await page.locator('.swatch').nth(2).click();await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 assert.equal((await page.evaluate(()=>window.protaCanvas.getState())).nodes.find(n=>n.id===noteId).color,'#d4ecec');
 // Multi-select: one shared toolbar with count, group/align actions.
 await addAt('矩形',1000,400);const rectId=await page.evaluate(()=>window.protaCanvas.getSelection()[0]);
 await page.locator(`.node[data-id="${textId}"] .node-content`).click({modifiers:['Shift']});
 assert.equal(await page.locator('#selection-tools .selection-count').textContent(),'已选 2 个');
 assert.equal(await page.locator('#selection-frame[data-multi]').isVisible(),true,'multi-selection shares one frame');
 assert.equal(await page.locator('#selection-tools [data-action=group]').isVisible(),true);
 assert.equal(await page.locator('#selection-tools [data-action=align]').isVisible(),true);
 assert.equal(await page.locator('#selection-tools [data-action=edit-text]').count(),0);
 await page.locator('#selection-tools [data-action=align]').click();await page.getByRole('menuitem').filter({hasText:'左对齐'}).click();
 let doc=await page.evaluate(()=>window.protaCanvas.getState());assert.equal(doc.nodes.find(n=>n.id===textId).x,doc.nodes.find(n=>n.id===rectId).x);
 await page.locator('#selection-tools [data-action=group]').click();assert.equal(await page.locator('.node.group').count(),1);assert.equal(await page.locator('#selection-tools [data-action=ungroup]').isVisible(),true);
 // Unified multi-selection scaling: one frame over the group, members scale together.
 assert.equal(await page.locator('#selection-frame').isVisible(),true);
 const before=await page.evaluate(ids=>{const nodes=window.protaCanvas.getState().nodes;const text=nodes.find(n=>n.id===ids[0]);const rect=nodes.find(n=>n.id===ids[1]);return {tw:text.width,rw:rect.width};},[textId,rectId]);
 const handle=await page.locator('#selection-frame i[data-handle=se]').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);
 await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+160,handle.y+handle.height/2+120,{steps:6});await page.mouse.up();
 await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 const after=await page.evaluate(ids=>{const nodes=window.protaCanvas.getState().nodes;return {tw:nodes.find(n=>n.id===ids[0]).width,rw:nodes.find(n=>n.id===ids[1]).width};},[textId,rectId]);
 assert.ok(Math.abs(after.tw/before.tw-after.rw/before.rw)<0.05,'members scale by the same factor');
 assert.ok(after.tw>before.tw,'selection scaling grows members');
 // Release the group; ungroup keeps both members selected, a plain click narrows to one.
 await page.locator('#selection-tools [data-action=ungroup]').click();
 assert.equal(await page.locator('#selection-frame[data-multi]').isVisible(),true);
 await page.locator(`.node[data-id="${rectId}"] .node-content`).click();
 await page.waitForTimeout(80);
 assert.deepEqual(await page.evaluate(()=>window.protaCanvas.getSelection().length),1,'plain click narrows a multi-selection');
 await page.locator(`.node[data-id="${textId}"] .node-content`).click({modifiers:['Shift']});
 await page.locator('#selection-tools [data-action=group]').click();
 await page.locator('#selection-tools [data-action=duplicate]').click();assert.equal(await page.locator('.node.group').count(),2);
 await page.locator('#selection-tools [data-action=more]').click();await page.getByRole('menuitem').filter({hasText:'锁定'}).click();
 assert.equal(await page.locator('#selection-tools [data-action=unlock]').isVisible(),true);assert.equal(await page.locator('#selection-tools [data-action=adjust]').count(),0);
 await page.locator('#selection-tools [data-action=unlock]').click();
 // Object context menu: type-specific actions, no creation items; keeps multi-selection.
 await page.locator('.node.group.selected .node-title').click({button:'right'});
 assert.equal(await page.getByRole('menuitem').filter({hasText:'取消编组'}).isVisible(),true);
 assert.equal(await page.getByRole('menuitem').filter({hasText:'手机画板'}).count(),0);
 await page.keyboard.press('Escape');
 // Enter group editing by double-click, exit with Esc, then remove the overlapping copy.
 const groupId=await page.evaluate(()=>window.protaCanvas.getSelection()[0]);
 await page.locator('.node.group.selected .node-title').dblclick();
 assert.equal(await page.evaluate(gid=>{const st=window.protaCanvas.getState();const kids=st.nodes.filter(n=>n.parentId===gid).map(n=>n.id);const sel=window.protaCanvas.getSelection();return kids.length>1&&sel.length===kids.length&&kids.every(k=>sel.includes(k));},groupId),true,'double-click selects the group children');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.node.group.selected').count(),1);
 await page.keyboard.press('Delete');
 await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 assert.equal(await page.locator('.node.group').count(),1);
 // One drag = one undo entry.
 await page.locator(`.node[data-id="${rectId}"]`).click();
 const x0=await page.evaluate(id=>window.protaCanvas.getState().nodes.find(n=>n.id===id).x,rectId);
 const box=await page.locator(`.node[data-id="${rectId}"]`).boundingBox();
 await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+130,box.y+80,{steps:5});await page.mouse.up();
 await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 const x1=await page.evaluate(id=>window.protaCanvas.getState().nodes.find(n=>n.id===id).x,rectId);
 assert.notEqual(x1,x0);
 await page.keyboard.press('Meta+z');
 assert.equal(await page.evaluate(id=>window.protaCanvas.getState().nodes.find(n=>n.id===id).x,rectId),x0,'single undo restores the whole drag');
 // Alt click does not duplicate; Alt drag does, and Esc cancels an Alt drag cleanly.
 const countBefore=await page.evaluate(()=>window.protaCanvas.getState().nodes.length);
 await page.locator(`.node[data-id="${rectId}"]`).click({modifiers:['Alt']});
 assert.equal(await page.evaluate(()=>window.protaCanvas.getState().nodes.length),countBefore,'alt-click alone must not duplicate');
 const box2=await page.locator(`.node[data-id="${rectId}"]`).boundingBox();
 await page.keyboard.down('Alt');await page.mouse.move(box2.x+30,box2.y+30);await page.mouse.down();await page.mouse.move(box2.x+90,box2.y+60,{steps:4});await page.keyboard.up('Alt');await page.mouse.up();
 await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 assert.equal(await page.evaluate(()=>window.protaCanvas.getState().nodes.length),countBefore+1,'alt-drag duplicates once');
 await page.keyboard.down('Alt');await page.mouse.move(box2.x+30,box2.y+30);await page.mouse.down();await page.mouse.move(box2.x+120,box2.y+90,{steps:4});await page.keyboard.press('Escape');await page.keyboard.up('Alt');await page.mouse.up();
 await page.evaluate(()=>window.protaCanvas.isDirty()===false||window.protaCanvas.save());
 assert.equal(await page.evaluate(()=>window.protaCanvas.getState().nodes.length),countBefore+1,'escape cancels the pending alt-drag clone');
 // A cancelled Pointer must restore data and not consume an undo entry.
 await page.locator(`.node[data-id="${rectId}"]`).click({position:{x:10,y:10}});
 const cancelBefore=await page.evaluate(()=>window.protaCanvas.getState().nodes);const cancelBox=await page.locator(`.node[data-id="${rectId}"]`).boundingBox();
 await page.mouse.move(cancelBox.x+20,cancelBox.y+20);await page.mouse.down();await page.mouse.move(cancelBox.x+80,cancelBox.y+60,{steps:4});
 await page.locator('#stage').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'});await page.mouse.up();assert.deepEqual(await page.evaluate(()=>window.protaCanvas.getState().nodes),cancelBefore,'Pointer cancellation never commits partial changes');
 // Drawing is also a single cancellable transaction.
 const drawBefore=await page.evaluate(()=>window.protaCanvas.getState().nodes);await page.getByRole('button',{name:'文本工具',exact:true}).click();await page.mouse.move(1150,760);await page.mouse.down();await page.mouse.move(1280,850,{steps:3});await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await page.evaluate(()=>window.protaCanvas.getState().nodes),drawBefore,'Escape removes an unfinished new object');
 // Blank context menu inserts at the right-click world position.
 await addAt('便签',180,220);const note2=await page.evaluate(()=>window.protaCanvas.getState().nodes.find(n=>n.id===window.protaCanvas.getSelection()[0]));assert.equal(note2.type,'note');
 const projected=await page.evaluate(n=>{const v=window.protaCanvas.getState().viewport;return {x:n.x*v.zoom+v.x,y:n.y*v.zoom+v.y};},note2);assert.ok(Math.abs(projected.x-180)<2);assert.ok(Math.abs(projected.y-220)<2);
 await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 // Command palette: search and execute (zoom to 100%).
 await page.keyboard.press('Control+k');
 await page.locator('#command-input').fill('100%');
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>Math.abs(window.protaCanvas.getState().viewport.zoom-1)<0.01);
 assert.equal(await page.locator('#command-palette').isHidden(),true);
 // Zoom menu offers presets and fit.
 await page.locator('#zoom-reset').click();
 await page.getByRole('menuitem').filter({hasText:'150%'}).click();
 await page.waitForFunction(()=>Math.abs(window.protaCanvas.getState().viewport.zoom-1.5)<0.01);
 await page.locator('#fit').click();
 // Fullscreen is reversible with matching labels.
 await page.locator('#fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));assert.equal(await page.locator('#fullscreen').textContent(),'退出全屏');await page.locator('#fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);assert.equal(await page.locator('#fullscreen').textContent(),'全屏');
 await page.locator('#fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));
 // Headless Chromium swallows the raw Esc fullscreen exit; emulate the browser's default action.
 await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.fullscreenElement);await page.waitForFunction(()=>document.querySelector('#fullscreen').textContent.trim()==='全屏');
 // Reload keeps persisted data.
 const persisted=await page.evaluate(()=>window.protaCanvas.getState().nodes);await page.reload();assert.deepEqual(await page.evaluate(()=>window.protaCanvas.getState().nodes),persisted);
 // Nested board preview remains usable with the compact UI.
 const board2=await page.evaluate(()=>window.protaCanvas.getState().nodes.find(n=>n.type==='board'));
 await fs.mkdir(path.join(dir,'boards/example'),{recursive:true});await fs.writeFile(path.join(dir,'boards/example/index.html'),'<button id="hit" onclick="this.textContent=\'已点击\'">测试交互</button>');
 const fresh=JSON.parse((await fs.readFile(path.join(dir,'canvas-data.js'),'utf8')).replace('window.PROTA_CANVAS = ','').replace(/;\s*$/,''));
 fresh.nodes.find(n=>n.id===board2.id).src='boards/example/index.html';
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify(fresh)+';');
 await page.evaluate(()=>window.protaCanvas.reloadFromDisk());
 await page.locator(`.node[data-id="${board2.id}"] .node-title`).click();await page.locator('#selection-tools [data-action=preview]').click();await page.frameLocator(`.node[data-id="${board2.id}"] iframe`).locator('#hit').click();assert.equal(await page.frameLocator(`.node[data-id="${board2.id}"] iframe`).locator('#hit').textContent(),'已点击');await page.frameLocator(`.node[data-id="${board2.id}"] iframe`).locator('#hit').press('Escape');
 // Conflict: disk changes behind our back, then we recover our local edits.
 const disk=JSON.parse((await fs.readFile(path.join(dir,'canvas-data.js'),'utf8')).replace('window.PROTA_CANVAS = ','').replace(/;\s*$/,''));
 disk.nodes.push({id:'external_mark',type:'note',name:'外部修改',x:2000,y:2000,width:200,height:160,color:'#ffd9d2',text:''});
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify(disk)+';');
 await addAt('文本',150,930);
 await page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('保存冲突'));
 await page.locator('#notice-action').filter({hasText:'恢复我的修改'}).click();
 await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 const recovered=await page.evaluate(()=>window.protaCanvas.getState().nodes);
 assert.ok(recovered.some(n=>n.text==='浮动工具栏与实时保存'),'local edits survive the conflict');
 assert.ok(recovered.some(n=>n.id==='external_mark'),'recovery keeps independent external additions');
 // A service failure keeps drafts and offers retry rather than a conflict overwrite.
 await page.route('**/api/canvas/save',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'测试连接中断'})}));await addAt('文本',80,700);
 await page.locator('#selection-tools [data-action=edit-text]').click();await page.locator('[contenteditable=true]').fill('故障后的本机草稿');await page.locator('[contenteditable=true]').press('Tab');await page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('保存失败'));
 page.once('dialog',d=>d.accept());await page.reload();await page.unroute('**/api/canvas/save');await page.locator('#notice').getByRole('button',{name:'恢复修改',exact:true}).click();await page.waitForFunction(()=>!window.protaCanvas.isDirty());assert.ok((await page.evaluate(()=>window.protaCanvas.getState().nodes)).some(n=>n.text==='故障后的本机草稿'));
 // Responsive floating bars stay in the viewport at 320 / 390 / 1440.
 for(const size of [{width:320,height:844},{width:390,height:844},{width:1440,height:1000}]){
  await page.setViewportSize(size);await page.locator('#fit').click();
  for(const bar of ['.creation-tools','.zoom-tools','.view-tools']){
   const b=await page.locator(bar).boundingBox();
   assert.ok(b.x>=-1&&b.x+b.width<=size.width+1&&b.y+b.height<=size.height+1,`${bar} overflows at ${size.width}`);
  }
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('#fit').click();await page.screenshot({path:path.join(evidence,'floating-canvas.png')});
 // Visual walkthrough uses real runtime nodes and a running iframe, not a replacement mock editor.
 const visualDir=path.join(root,'src/pages/demo/design/v3');await fs.cp(path.join(app,'src/templates/infinite-canvas'),visualDir,{recursive:true});await fs.mkdir(path.join(visualDir,'boards/home'),{recursive:true});
 await fs.writeFile(path.join(visualDir,'boards/home/index.html'),`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:"PingFang SC",sans-serif;padding:35px;color:#252832;background:white}h2{font-size:23px;letter-spacing:-.5px;margin:0 0 9px}p{margin:0;color:#9198a5;font-size:13px}.cards{display:flex;gap:12px;margin-top:30px}.card{flex:1;padding:20px 16px;background:#f7f8fc;border:1px solid #eceef5;border-radius:11px;font-size:12px}.card span{display:block;font-size:11px;margin-top:8px;color:#969ead}</style><h2>欢迎使用 Prota</h2><p>从想法，到可交互的产品原型。</p><div class="cards"><div class="card">产品探索<span>Ideas & Discovery</span></div><div class="card">原型设计<span>Interactive Prototype</span></div><div class="card">AI 协作<span>Agent Workflow</span></div></div>`);
 await fs.writeFile(path.join(visualDir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify({schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[{id:'visual_home',type:'board',name:'Web 画板 · 首页',x:460,y:320,width:520,height:320,src:'boards/home/index.html'}]})+';');
 const qa=await browser.newPage({viewport:{width:1440,height:1000}});qa.on('pageerror',e=>errors.push(e.message));await qa.addInitScript(()=>sessionStorage.setItem('prota-canvas-draft:/src/pages/demo/design/v3/index.html:view',JSON.stringify({x:0,y:0,zoom:1})));await qa.goto(base+'/src/pages/demo/design/v3/index.html');await qa.frameLocator('.node.board iframe').locator('h2').waitFor();await qa.locator('.node.board .node-title').click();await qa.mouse.move(30,200);await qa.waitForTimeout(200);await qa.screenshot({path:path.join(evidence,'selected-board.png')});
 await qa.locator('.node.board .node-title').click({button:'right'});await qa.mouse.move(30,200);await qa.screenshot({path:path.join(evidence,'object-context-menu.png')});await qa.keyboard.press('Escape');
 await qa.locator('#fullscreen').click();await qa.waitForFunction(()=>Boolean(document.fullscreenElement));await qa.screenshot({path:path.join(evidence,'fullscreen.png')});await qa.locator('#fullscreen').click();await qa.setViewportSize({width:320,height:844});await qa.evaluate(()=>window.protaCanvas.fit());await qa.screenshot({path:path.join(evidence,'mobile-320.png')});
 // An empty area of a board offers creation and assigns ownership using world coordinates.
 await qa.setViewportSize({width:1440,height:1000});await qa.evaluate(()=>window.protaCanvas.fit());
 await qa.locator('.node.board .node-content').click({button:'right',position:{x:40,y:200}});await qa.getByRole('menuitem',{name:'文本',exact:true}).click();
 assert.equal(await qa.evaluate(()=>window.protaCanvas.getState().nodes.find(n=>n.id===window.protaCanvas.getSelection()[0]).parentId),'visual_home');await qa.waitForFunction(()=>!window.protaCanvas.isDirty());
 // Images have replace / aspect controls, and cancellation cannot turn a new insertion into replacement.
 const raster={name:'reference.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')};
 await qa.locator('#image-input').setInputFiles(raster);await qa.waitForFunction(()=>window.protaCanvas.getState().nodes.some(n=>n.type==='image'));await qa.waitForFunction(()=>!window.protaCanvas.isDirty());
 assert.equal(await qa.locator('#selection-tools [data-action=replace]').isVisible(),true);assert.equal(await qa.locator('#selection-tools [data-action=edit-text]').count(),0);
 await qa.locator('#selection-tools [data-action=more]').click();assert.equal(await qa.getByRole('menuitem').filter({hasText:'适应比例'}).isVisible(),true);await qa.keyboard.press('Escape');
 await qa.locator('#selection-tools [data-action=replace]').click();await qa.locator('#image-input').dispatchEvent('cancel');await qa.locator('#image').click();await qa.locator('#image-input').setInputFiles({...raster,name:'second.png'});await qa.waitForFunction(()=>window.protaCanvas.getState().nodes.filter(n=>n.type==='image').length===2);await qa.waitForFunction(()=>!window.protaCanvas.isDirty());
 // Two independent nodes, rather than one group: both position and dimensions use one scale transform.
 const createQA=async(name,x,y)=>{await qa.locator('#stage').click({button:'right',position:{x,y}});await qa.getByRole('menuitem',{name,exact:true}).click();return qa.evaluate(()=>window.protaCanvas.getSelection()[0]);};
 const aId=await createQA('文本',80,140),bId=await createQA('矩形',80,340);await qa.locator(`.node[data-id="${aId}"] .node-content`).click({modifiers:['Shift']});await qa.waitForFunction(()=>!window.protaCanvas.isDirty());
 assert.equal(await qa.locator('#selection-frame[data-multi]').count(),1);assert.equal(await qa.locator('.node .resize').count(),0);
 const initialMulti=await qa.evaluate(()=>window.protaCanvas.getState().nodes);const multiHandle=await qa.locator('#selection-frame i[data-handle=se]').boundingBox();await qa.mouse.move(multiHandle.x+4,multiHandle.y+4);await qa.mouse.down();await qa.mouse.move(multiHandle.x+64,multiHandle.y+94,{steps:4});await qa.mouse.up();await qa.waitForFunction(()=>!window.protaCanvas.isDirty());
 const multiAfter=await qa.evaluate(()=>window.protaCanvas.getState().nodes),a0=initialMulti.find(n=>n.id===aId),b0=initialMulti.find(n=>n.id===bId),a1=multiAfter.find(n=>n.id===aId),b1=multiAfter.find(n=>n.id===bId);
 assert.ok(Math.abs(a1.width/a0.width-b1.width/b0.width)<.001);assert.ok(Math.abs((b1.y-a1.y)/(b0.y-a0.y)-a1.height/a0.height)<.001);
 await qa.keyboard.press('Control+z');assert.deepEqual(await qa.evaluate(()=>window.protaCanvas.getState().nodes),initialMulti);
 // Stale Agent output cannot replace a dirty local document; recovery needs an explicit conflict choice.
 await qa.waitForFunction(()=>!window.protaCanvas.isDirty());await qa.route('**/api/canvas/save',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'暂时离线'})}));
 await qa.locator(`.node[data-id="${aId}"] .node-content`).click();await qa.locator('#selection-tools [data-action=edit-text]').click();await qa.locator('[contenteditable=true]').fill('未保存的新修改');await qa.locator('[contenteditable=true]').press('Tab');await qa.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('保存失败'));
 const olderResult=JSON.parse((await fs.readFile(path.join(visualDir,'canvas-data.js'),'utf8')).replace('window.PROTA_CANVAS = ','').replace(/;\s*$/,''));olderResult.nodes.find(n=>n.id===aId).text='较旧 Agent 输出';await fs.writeFile(path.join(visualDir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify(olderResult)+';');
 assert.equal(await qa.evaluate(()=>window.protaCanvas.reloadFromDisk()),false);assert.equal(await qa.evaluate(id=>window.protaCanvas.getState().nodes.find(n=>n.id===id).text,aId),'未保存的新修改');
 await qa.locator('#notice').getByRole('button',{name:'读取最新版本',exact:true}).click();await qa.locator('#notice').getByRole('button',{name:'恢复备份',exact:true}).click();await qa.locator('#notice').getByRole('button',{name:'应用本机修改',exact:true}).waitFor();
 assert.ok((await fs.readFile(path.join(visualDir,'canvas-data.js'),'utf8')).includes('较旧 Agent 输出'),'a conflicting restore must wait for explicit confirmation');
 await qa.unroute('**/api/canvas/save');await qa.locator('#notice').getByRole('button',{name:'应用本机修改',exact:true}).click();await qa.waitForFunction(()=>!window.protaCanvas.isDirty());assert.equal(await qa.evaluate(id=>window.protaCanvas.getState().nodes.find(n=>n.id===id).text,aId),'未保存的新修改');
 // Readonly wrapper still permits preview / navigation and never exposes edit controls.
 const readonlyDir=path.join(root,'src/pages/demo/design/v5');await fs.cp(visualDir,readonlyDir,{recursive:true});const readonlyDoc=JSON.parse((await fs.readFile(path.join(visualDir,'canvas-data.js'),'utf8')).replace('window.PROTA_CANVAS = ','').replace(/;\s*$/,''));readonlyDoc.nodes=readonlyDoc.nodes.filter(n=>n.id==='visual_home');readonlyDoc.viewport={x:0,y:0,zoom:1};await fs.writeFile(path.join(readonlyDir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify(readonlyDoc)+';');
 await fs.writeFile(path.join(visualDir,'readonly.html'),'<script>window.shell={isShareMode:true}</script><iframe title="只读画布" src="../v5/index.html" style="border:0;width:100vw;height:100vh"></iframe>');const ro=await browser.newPage();await ro.goto(base+'/src/pages/demo/design/v3/readonly.html');const readonly=ro.frameLocator('iframe[title="只读画布"]');await readonly.locator('body.readonly').waitFor();assert.equal(await readonly.locator('.creation-tools').isVisible(),false);await readonly.locator('.node.board .node-title').click();assert.equal(await readonly.locator('#selection-tools [data-action=duplicate]').count(),0);assert.equal(await readonly.locator('#selection-tools [data-action=preview]').isVisible(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: V4 runtime — unified actions per type & multi-select, shared frame scaling, alt-drag/undo/escape semantics, blank & object context menus, palette, zoom menu, fullscreen, conflict recovery, persistence, responsive 320/390/1440, board preview');
 console.log('Screenshot: '+path.join(evidence,'floating-canvas.png'));
}finally{await browser?.close();child?.kill();}
