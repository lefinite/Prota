import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const app=process.cwd(),tmp=await fs.mkdtemp(path.join(os.tmpdir(),'canvas-connections-')),root=path.join(tmp,'workspace'),dir=path.join(root,'src/pages/demo/flow/v1');
const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
let child,browser,logs='';
try{
 await fs.mkdir(dir,{recursive:true});await fs.cp(path.join(app,'src/templates/infinite-canvas'),dir,{recursive:true});await fs.mkdir(path.join(root,'data'));
 await fs.writeFile(path.join(root,'workspace.json'),JSON.stringify({id:'connection-test',formatVersion:1}));await fs.writeFile(path.join(root,'data/projects.json'),JSON.stringify({projects:[{id:'demo',name:'Demo',pages:[{id:'flow',name:'Flow',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']}]}]}));
 const node=(id,x,y,w=240,h=260)=>({id,type:'board',name:id,x,y,width:w,height:h});const document={schemaVersion:1,revision:0,viewport:{x:80,y:180,zoom:.8},nodes:[{id:'region',type:'rect',name:'背景分区',x:-150,y:-350,width:1650,height:1100,color:'#eaf4ee',locked:true},node('a',0,0),node('b',1100,0),node('obstacle',450,-150,350,600)],edges:[]};
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify(document)+';');
 child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(tmp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);const base=`http://127.0.0.1:${port}`;let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/src/pages/demo/flow/v1/index.html');
 const state=()=>page.evaluate(()=>window.protaCanvas.getState()),save=()=>page.waitForFunction(()=>!window.protaCanvas.isDirty());
 await page.getByRole('button',{name:'连线工具',exact:true}).click();await page.locator('.node[data-id=a]').hover();
 const sourcePort=page.locator('[data-node-id=a][data-connection-port=right]');await sourcePort.waitFor();assert.equal(Number(await sourcePort.getAttribute('cx')),240);assert.equal(Number(await sourcePort.getAttribute('cy')),130);await sourcePort.click();
 await page.locator('.node[data-id=b]').hover();await page.waitForFunction(()=>document.querySelector('.node[data-id=b]')?.classList.contains('connection-target'));await page.locator('[data-node-id=b][data-connection-port=left]').click();assert.equal((await state()).edges.length,1);assert.equal((await state()).edges[0].fromPort,'right');assert.equal((await state()).edges[0].toPort,'left');
 // Even a line without a label supports direct double-click editing.
 const emptyPoint=await page.locator('.connection-hit').evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()/2),q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};});await page.mouse.dblclick(emptyPoint.x,emptyPoint.y);
 await page.getByRole('textbox',{name:'在线编辑连线文字'}).fill('验证成功 → 继续');await page.keyboard.press('Enter');await page.getByRole('combobox',{name:'连线类型'}).selectOption('exception');assert.equal((await state()).edges[0].label,'验证成功 → 继续');assert.equal((await state()).edges[0].kind,'exception');await page.keyboard.press('Escape');await save();
 await page.reload();assert.equal((await state()).edges[0].kind,'exception');await page.waitForFunction(()=>window.protaCanvas.connections.getRoutes().length===1);
 // Click-only selection changes must not hide connections behind an opaque region background.
 const lineVisible=()=>page.evaluate(()=>{const box=document.querySelector('.connection-label')?.getBoundingClientRect();return box&&Boolean(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.closest('#canvas-connections'));});
 for(let i=0;i<3;i++){await page.locator('.node[data-id=a]').click({position:{x:12,y:12}});assert.ok(await lineVisible(),'connection remains visible immediately after node selection');await page.mouse.click(20,180);assert.ok(await lineVisible(),'connection remains visible after deselection, without zoom');}
 // The same SVG element survives selection and double-click opens an editor on the line.
 const labelBox=await page.locator('.connection-label').first().boundingBox();const nodeCount=(await state()).nodes.length;
 await page.mouse.dblclick(labelBox.x+labelBox.width/2,labelBox.y+labelBox.height/2);assert.equal((await state()).nodes.length,nodeCount);
 const inline=page.getByRole('textbox',{name:'在线编辑连线文字'});await inline.waitFor();const inputBox=await inline.boundingBox();assert.ok(Math.abs(inputBox.x+inputBox.width/2-labelBox.x-labelBox.width/2)<80,'editor is anchored at the line label');
 await inline.fill('取消的修改');await page.keyboard.press('Escape');assert.equal((await state()).edges[0].label,'验证成功 → 继续');
 await page.keyboard.press('F2');await inline.fill('双击原位编辑');await page.keyboard.press('Enter');assert.equal((await state()).edges[0].label,'双击原位编辑');
 await page.keyboard.press('ControlOrMeta+z');assert.equal((await state()).edges[0].label,'验证成功 → 继续');
 // Enter during IME composition must not commit half-written Chinese text.
 await page.keyboard.press('F2');await inline.fill('输入中文');await inline.dispatchEvent('compositionstart');await inline.dispatchEvent('keydown',{key:'Enter',isComposing:true});assert.ok(await inline.isVisible());await inline.dispatchEvent('compositionend');await page.keyboard.press('Escape');
 await page.keyboard.press('F2');await inline.fill('点击外部保存');await page.mouse.click(20,180);assert.equal((await state()).edges[0].label,'点击外部保存');await page.keyboard.press('ControlOrMeta+z');assert.equal((await state()).edges[0].label,'验证成功 → 继续');
 await page.keyboard.press('Escape');
 // Panning from a connection follows the regular canvas Space-drag behavior.
 const viewportBefore=(await state()).viewport;const panLabel=await page.locator('.connection rect').first().boundingBox();
 await page.keyboard.down('Space');await page.mouse.move(panLabel.x+panLabel.width/2,panLabel.y+panLabel.height/2);await page.mouse.down();await page.mouse.move(panLabel.x+panLabel.width/2+40,panLabel.y+panLabel.height/2+30,{steps:4});await page.mouse.up();await page.keyboard.up('Space');assert.notDeepEqual((await state()).viewport,viewportBefore);
 // Reconnect a selected endpoint by dragging its handle, then undo without losing identity.
 await page.locator('.connection').first().focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');
 const originalId=(await state()).edges[0].id;
 await page.locator('[data-connection-end=to]').dragTo(page.locator('.node[data-id=obstacle]'),{targetPosition:{x:20,y:20}});
 assert.equal((await state()).edges[0].toInstanceId,'obstacle');assert.equal((await state()).edges[0].id,originalId);
 await page.getByRole('button',{name:'撤销',exact:true}).click();assert.equal((await state()).edges[0].toInstanceId,'b');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'连线工具',exact:true}).click();await page.locator('.node[data-id=a]').click({position:{x:12,y:12}});await page.keyboard.press('Escape');assert.equal((await state()).edges.length,1,'cancel does not create an edge');
 // Moving a source changes endpoints; the intermediate obstacle remains clear.
 const before=await page.locator('.connection-line').getAttribute('d');await page.locator('.node[data-id=a]').click({position:{x:12,y:12}});await page.keyboard.press('ArrowDown');await page.waitForTimeout(150);assert.notEqual(await page.locator('.connection-line').getAttribute('d'),before);
 const safe=await page.evaluate(()=>{const doc=protaCanvas.getState(),routes=protaCanvas.connections.getRoutes(),boxes=CanvasConnections.obstacles(doc.nodes,doc.viewport.zoom);return routes.every(r=>r.points.every((p,i)=>!i||boxes.every(box=>box.id===r.edge.fromInstanceId||box.id===r.edge.toInstanceId||!CanvasConnections.intersects(r.points[i-1],p,box))));});assert.ok(safe);
 await page.keyboard.down('Shift');await page.locator('.node[data-id=b]').click({position:{x:12,y:12}});await page.keyboard.up('Shift');await page.keyboard.press('ControlOrMeta+d');assert.equal((await state()).edges.length,2,'duplicate selected endpoints includes their internal edge');
 await page.keyboard.press('Escape');await page.locator('.node[data-id=a]').click({position:{x:12,y:12}});await page.keyboard.press('Delete');assert.equal((await state()).edges.length,1,'deleting a node removes its edge');await page.keyboard.press('ControlOrMeta+z');assert.equal((await state()).edges.length,2,'undo restores endpoint and edge');
 // Edge editing and deletion use the same undo stack as nodes.
 await page.keyboard.press('Escape');await page.locator('.connection').first().focus();await page.keyboard.press('Space');await page.getByRole('button',{name:'删除',exact:true}).click();assert.equal((await state()).edges.length,1);await page.getByRole('button',{name:'撤销',exact:true}).click();assert.equal((await state()).edges.length,2);await save();
 // Read-only shares keep routes visible and block programmatic and UI changes.
 await page.evaluate(()=>window.postMessage({type:'prota:canvas-config',readOnly:true},location.origin));await page.waitForTimeout(150);const count=(await state()).edges.length;assert.equal(await page.evaluate(()=>protaCanvas.connections.create('a','b')),null);assert.equal((await state()).edges.length,count);
 assert.deepEqual(errors,[]);console.log('PASS: native connections, midpoint ports, click visibility, inline double-click/F2 edit, cancel/IME/undo, reconnection, persistence and read-only');
}finally{await browser?.close();child?.kill('SIGTERM');await fs.rm(tmp,{recursive:true,force:true});}
