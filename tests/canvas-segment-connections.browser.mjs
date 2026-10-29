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

 // Real pointer drag of an intermediate horizontal segment previews without mutating history.
 const route=await page.evaluate(()=>protaCanvas.connections.getRoutes()[0]);
 const index=route.points.findIndex((p,i)=>i>0&&i<route.points.length-2&&p.y===route.points[i+1].y);
 assert.ok(index>0);const a=route.points[index],b=route.points[index+1],targetY=Math.round((a.y+80)/10)*10;
 const screen=async p=>page.evaluate(p=>{const q=new DOMPoint(p.x,p.y).matrixTransform(document.querySelector('#canvas-connections').getScreenCTM());return{x:q.x,y:q.y};},p);
 const grip=page.locator(`[data-connection-segment="${index}"]`);const gripBox=await grip.boundingBox();
 await page.mouse.move(gripBox.x+gripBox.width/2,gripBox.y+gripBox.height/2);await page.mouse.down();
 const aim=await screen({x:(a.x+b.x)/2,y:targetY});await page.mouse.move(aim.x,aim.y+1.5,{steps:8});
 await page.locator('.connection-drag-preview').waitFor();await page.locator('.connection-snap-guide').waitFor({state:'attached'});
 assert.equal((await state()).edges[0].manualRoute,undefined,'pointermove must not save an intermediate route');
 assert.ok(await page.locator('#connection-tools').isHidden());
 if(process.env.CANVAS_SCREENSHOTS)await page.screenshot({path:'/tmp/prota-segment-drag.png'});
 await page.mouse.up();await page.waitForFunction(()=>protaCanvas.getState().edges[0].manualRoute);
 const edited=(await state()).edges[0];assert.ok(edited.manualRoute.some(p=>p.y===targetY),'segment snaps to grid');
 assert.deepEqual(edited.manualRoute[0],route.points[0]);assert.deepEqual(edited.manualRoute.at(-1),route.points.at(-1));
 await page.getByRole('button',{name:'撤销',exact:true}).click();assert.equal((await state()).edges[0].manualRoute,undefined,'one undo reverts the entire drag');
 await page.getByRole('button',{name:'重做',exact:true}).click();assert.deepEqual((await state()).edges[0].manualRoute,edited.manualRoute);
 // Dragging the line itself works away from a grip, and Escape cancels the live preview.
 const dragLine=async({cancel=false,alt=false}={})=>{
   const r=await page.evaluate(()=>protaCanvas.connections.getRoutes()[0]);const i=r.points.findIndex((p,i)=>i>0&&i<r.points.length-2&&p.x===r.points[i+1].x);assert.ok(i>0);
   const a=r.points[i],b=r.points[i+1],start=await screen({x:a.x,y:a.y+(b.y-a.y)*.25});
   await page.mouse.move(start.x,start.y);if(alt)await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(start.x-39.5,start.y,{steps:6});await page.locator('.connection-drag-preview').waitFor();
   if(alt)assert.equal(await page.locator('.connection-snap-guide').count(),0,'Alt bypasses snapping');
   if(cancel)await page.keyboard.press('Escape');await page.mouse.up();if(alt)await page.keyboard.up('Alt');
 };
 await dragLine({cancel:true});assert.deepEqual((await state()).edges[0].manualRoute,edited.manualRoute);assert.equal(await page.locator('.connection-drag-preview').count(),0);
 await dragLine({alt:true});assert.notDeepEqual((await state()).edges[0].manualRoute,edited.manualRoute);
 await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual((await state()).edges[0].manualRoute,edited.manualRoute);
 // Saving/reloading, reversal and auto routing preserve their normal behavior.
 await save();await page.reload();await page.waitForFunction(()=>protaCanvas?.connections.getRoutes().length===1);
 assert.deepEqual((await state()).edges[0].manualRoute,edited.manualRoute);
 await page.locator('.connection').focus();await page.keyboard.press('Space');
 await page.getByRole('button',{name:'反向',exact:true}).click();assert.deepEqual((await state()).edges[0].manualRoute,[...edited.manualRoute].reverse());
 await page.getByRole('button',{name:'撤销',exact:true}).click();
 if(process.env.CANVAS_SCREENSHOTS){await page.screenshot({path:'/tmp/prota-segment-saved.png'});await page.locator('button[aria-label="连线工具"]').screenshot({path:'/tmp/prota-connection-icon.png'});}
 await page.getByRole('button',{name:'恢复自动连接',exact:true}).click();assert.equal((await state()).edges[0].manualRoute,null);
 await page.waitForFunction(()=>!document.querySelector('#connection-tools [data-action=auto]')?.checkVisibility());
 await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual((await state()).edges[0].manualRoute,edited.manualRoute);
 // Double-click at a grip still edits text, even when its DOM is refreshed between clicks.
 await page.locator('[data-connection-segment="2"]').dblclick();await page.getByRole('textbox',{name:'在线编辑连线文字'}).fill('拖动连线');await page.keyboard.press('Enter');assert.equal((await state()).edges[0].label,'拖动连线');await page.getByRole('button',{name:'撤销',exact:true}).click();
 // A straight connector can be pulled out into a dogleg without moving either anchor.
 await page.keyboard.press('Escape');await page.locator('.node[data-id=obstacle]').click({position:{x:20,y:20}});await page.keyboard.press('Delete');
 await page.locator('.connection').focus();await page.keyboard.press('Space');await page.getByRole('button',{name:'恢复自动连接',exact:true}).click();
 await page.waitForFunction(()=>protaCanvas.connections.getRoutes()[0].points.length===2);
 const straight=await page.evaluate(()=>protaCanvas.connections.getRoutes()[0].points),grip0=page.locator('[data-connection-segment="0"]');await grip0.waitFor();const g0=await grip0.boundingBox();
 await page.mouse.move(g0.x+g0.width/2,g0.y+g0.height/2);await page.mouse.down();await page.mouse.move(g0.x+g0.width/2,g0.y+g0.height/2+60,{steps:6});await page.mouse.up();
 const dogleg=(await state()).edges[0].manualRoute;assert.ok(dogleg.length>=6);assert.deepEqual(dogleg[0],straight[0]);assert.deepEqual(dogleg.at(-1),straight.at(-1));
 await page.evaluate(()=>window.postMessage({type:'prota:canvas-config',readOnly:true},location.origin));await page.waitForFunction(()=>!document.querySelector('[data-connection-segment]'));assert.ok(await page.locator('#connection-tools').isHidden());
 assert.deepEqual(errors,[]);console.log('PASS: segment grips, direct line dragging, live preview, snap guides, Alt bypass, Escape cancel, one-step undo/redo, persistence, reverse and reset');
}finally{await browser?.close();child?.kill('SIGTERM');await fs.rm(tmp,{recursive:true,force:true});}
