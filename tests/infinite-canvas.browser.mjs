import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const app=process.cwd(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'prota-canvas-test-')),root=path.join(temp,'workspace');
const dir=path.join(root,'src/pages/demo/design/v1');
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
 assert.equal(await page.locator('#outline,#inspector,#agent-composer,header,#save,#export').count(),0);
 assert.deepEqual(await page.locator('#stage').evaluate(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,width:el.clientWidth,height:el.clientHeight})),{x:0,y:0,width:1440,height:1000});
 await page.locator('#first-board').click();await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 assert.equal(await page.locator('.node.board').count(),1);
 const addAt=async(name,x,y)=>{await page.locator('#stage').click({button:'right',position:{x,y}});await page.getByRole('menuitem',{name,exact:true}).click();};
 await addAt('文本',950,160);let textId=await page.evaluate(()=>window.protaCanvas.getSelection()[0]);
 assert.equal(await page.locator('#selection-tools [data-action=edit-text]').isVisible(),true);
 assert.equal(await page.locator('#selection-tools [data-action=group]').count(),0);
 assert.equal(await page.locator('#selection-tools button:not(:has(svg)):visible').count(),0);
 await page.locator('#selection-tools [data-action=edit-text]').click();await page.locator('.node-content[contenteditable=true]').fill('浮动工具栏与实时保存');await page.locator('.node-content[contenteditable=true]').press('Tab');await page.waitForFunction(()=>!window.protaCanvas.isDirty());
 assert.equal(await page.locator('.node.text .node-content').textContent(),'浮动工具栏与实时保存');
 await page.locator('#selection-tools [data-action=properties]').click();await page.getByLabel('宽',{exact:true}).fill('320');await page.getByLabel('宽',{exact:true}).press('Tab');await page.locator('#close-properties').click();
 assert.equal((await page.evaluate(()=>window.protaCanvas.getState())).nodes.find(n=>n.id===textId).width,320);
 await addAt('矩形',1000,400);const rectId=await page.evaluate(()=>window.protaCanvas.getSelection()[0]);
 await page.locator(`.node[data-id="${textId}"] .node-content`).click({modifiers:['Shift']});
 assert.equal(await page.locator('#selection-tools [data-action=group]').isVisible(),true);
 assert.equal(await page.locator('#selection-tools [data-action=align]').isVisible(),true);
 assert.equal(await page.locator('#selection-tools [data-action=edit-text]').count(),0);
 await page.locator('#selection-tools [data-action=align]').click();await page.getByRole('menuitem',{name:'左对齐',exact:true}).click();
 let doc=await page.evaluate(()=>window.protaCanvas.getState());assert.equal(doc.nodes.find(n=>n.id===textId).x,doc.nodes.find(n=>n.id===rectId).x);
 await page.locator('#selection-tools [data-action=group]').click();assert.equal(await page.locator('.node.group').count(),1);assert.equal(await page.locator('#selection-tools [data-action=ungroup]').isVisible(),true);
 await page.locator('#selection-tools [data-action=duplicate]').click();assert.equal(await page.locator('.node.group').count(),2);
 await page.locator('#selection-tools [data-action=more]').click();await page.getByRole('menuitem',{name:'锁定',exact:true}).click();
 assert.equal(await page.locator('#selection-tools [data-action=unlock]').isVisible(),true);assert.equal(await page.locator('#selection-tools [data-action=properties]').count(),0);
 await page.locator('#selection-tools [data-action=unlock]').click();
 // Object context preserves selection and exposes meaningful actions.
 await page.locator('.node.group.selected .node-title').click({button:'right'});assert.equal(await page.getByRole('menuitem',{name:'取消分组',exact:true}).isVisible(),true);assert.equal(await page.getByRole('menuitem',{name:'手机画板',exact:true}).count(),0);await page.keyboard.press('Escape');
 await page.locator('#add-board').click();await page.getByRole('menuitem',{name:'Web 画板',exact:true}).click();await page.waitForFunction(()=>!window.protaCanvas.isDirty());assert.equal(await page.locator('.node.board').count(),2);
 await page.locator('#fit').click();
 // Fullscreen must be a reversible UI operation, with matching label and Escape support.
 await page.locator('#fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));assert.equal(await page.locator('#fullscreen').textContent(),'退出全屏');await page.locator('#fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);assert.equal(await page.locator('#fullscreen').textContent(),'全屏');
 await page.locator('#fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.fullscreenElement);
 // A context-menu insertion uses the right-click world position, not a stale selection.
 await addAt('便签',180,220);const note=await page.evaluate(()=>window.protaCanvas.getState().nodes.find(n=>n.id===window.protaCanvas.getSelection()[0]));assert.equal(note.type,'note');
 const projected=await page.evaluate(n=>{const v=window.protaCanvas.getState().viewport;return {x:n.x*v.zoom+v.x,y:n.y*v.zoom+v.y};},note);assert.ok(Math.abs(projected.x-180)<2);assert.ok(Math.abs(projected.y-220)<2);
 await page.waitForFunction(()=>!window.protaCanvas.isDirty());const persisted=await page.evaluate(()=>window.protaCanvas.getState().nodes);await page.reload();assert.deepEqual(await page.evaluate(()=>window.protaCanvas.getState().nodes),persisted);
 // Nested board preview remains usable with the compact UI.
 await fs.mkdir(path.join(dir,'boards/example'),{recursive:true});await fs.writeFile(path.join(dir,'boards/example/index.html'),'<button id="hit" onclick="this.textContent=\'已点击\'">测试交互</button>');
 const data=await page.evaluate(()=>window.protaCanvas.getState());const board=data.nodes.find(n=>n.type==='board');board.src='boards/example/index.html';await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify(data)+';');await page.evaluate(()=>window.protaCanvas.reloadFromDisk());
 await page.locator(`.node[data-id="${board.id}"] .node-title`).click();await page.locator('#selection-tools [data-action=preview]').click();await page.frameLocator(`.node[data-id="${board.id}"] iframe`).locator('#hit').click();assert.equal(await page.frameLocator(`.node[data-id="${board.id}"] iframe`).locator('#hit').textContent(),'已点击');await page.frameLocator(`.node[data-id="${board.id}"] iframe`).locator('#hit').press('Escape');
 // Responsive floating bars remain within the viewport, without introducing side panels.
 await page.setViewportSize({width:390,height:844});await page.locator('#fit').click();const toolbar=await page.locator('.creation-tools').boundingBox();assert.ok(toolbar.x>=0&&toolbar.x+toolbar.width<=391);await page.setViewportSize({width:1440,height:1000});
 // Automatic local recovery after a failed write, without save/export buttons.
 await page.route('**/api/canvas/save',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'临时故障'})}));await addAt('文本',350,220);await page.locator('#selection-tools [data-action=edit-text]').click();await page.locator('.node-content[contenteditable=true]').fill('自动恢复内容');await page.locator('.node-content[contenteditable=true]').press('Tab');await page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('保存失败'));
 page.once('dialog',d=>d.accept());await page.reload();await page.unroute('**/api/canvas/save');await page.locator('#notice-action').filter({hasText:'恢复修改'}).click();await page.waitForFunction(()=>!window.protaCanvas.isDirty());assert.ok((await page.evaluate(()=>window.protaCanvas.getState())).nodes.some(n=>n.text==='自动恢复内容'));
 await page.locator('#fit').click();await page.screenshot({path:path.join(temp,'floating-canvas.png')});assert.deepEqual(errors,[]);
 console.log('PASS: no side panels or duplicate Agent, contextual icon+text actions, blank/object context menus, insertion position, realtime save/recovery, fullscreen/exit, responsive tools, board preview');console.log('Screenshot: '+path.join(temp,'floating-canvas.png'));
}finally{await browser?.close();child?.kill();}
