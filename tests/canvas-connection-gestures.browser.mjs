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
 const node=(id,x,y,w=240,h=260)=>({id,type:'board',name:id,x,y,width:w,height:h});const document={schemaVersion:1,revision:0,viewport:{x:80,y:180,zoom:.8},nodes:[node('a',0,0),node('b',750,0),node('c',375,440),{...node('locked',1100,440),locked:true},node('d',1400,0),node('f',1400,0)],edges:[]};
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify(document)+';');
 child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(tmp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);const base=`http://127.0.0.1:${port}`;let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true});page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/src/pages/demo/flow/v1/index.html');
 const state=()=>page.evaluate(()=>window.protaCanvas.getState()),save=()=>page.waitForFunction(()=>!window.protaCanvas.isDirty());

 await page.waitForFunction(()=>window.protaCanvas);
 const screen=p=>page.evaluate(p=>{const q=new DOMPoint(p.x,p.y).matrixTransform(document.querySelector('#world').getScreenCTM?.()||new DOMMatrix(getComputedStyle(document.querySelector('#world')).transform));const r=document.querySelector('#stage').getBoundingClientRect();return {x:q.x+r.left,y:q.y+r.top};},p);
 const position=async(id,side,offset=0)=>{const n=(await state()).nodes.find(n=>n.id===id),p=side==='left'?{x:n.x,y:n.y+n.height/2}:side==='right'?{x:n.x+n.width,y:n.y+n.height/2}:side==='top'?{x:n.x+n.width/2,y:n.y}:{x:n.x+n.width/2,y:n.y+n.height};const q=await screen(p);q.x+=side==='left'?-offset:side==='right'?offset:0;q.y+=side==='top'?-offset:side==='bottom'?offset:0;return q;};
 const move=p=>page.mouse.move(p.x,p.y,{steps:5});
 const handle=async end=>{const p=await page.locator(`[data-connection-end=${end}]`).boundingBox();return{x:p.x+p.width/2,y:p.y+p.height/2};};
 const gesture=async(a,b,{cancel=false}={})=>{await move(a);await page.mouse.down();await move(b);if(cancel)await page.keyboard.press('Escape');await page.mouse.up();};
 const select=async()=>{await page.locator('.connection').first().focus();await page.keyboard.press('Space');};
 // In selection mode, hover dots can initiate a connection without moving the object.
 const source=await position('a','right');await move(source);await page.locator('[data-node-id=a][data-connection-port=right]').waitFor();
 await gesture(await position('a','right',11),await position('b','left',18));
 await page.waitForFunction(()=>protaCanvas.getState().edges.length===1);
 let current=(await state()).edges[0],id=current.id;
 assert.equal(current.fromPort,'right');assert.equal(current.toPort,'left');
 assert.equal((await state()).nodes.find(n=>n.id==='a').x,0,'port drag never moves the node');
 console.log('PASS selection-mode ports and magnetic drop outside target bounds');
 // Clicking or moving fewer than four screen pixels must not rewrite an automatic side/manual path.
 await select();await page.mouse.click((await handle('to')).x,(await handle('to')).y);
 assert.deepEqual((await state()).edges[0],current);
 const h=await handle('to');await gesture(h,{x:h.x+2,y:h.y+1});assert.deepEqual((await state()).edges[0],current);
 // The fixed endpoint and preview agree when reconnecting either end.
 await gesture(await handle('from'),await position('c','top',12));
 current=(await state()).edges[0];assert.equal(current.id,id);assert.equal(current.fromInstanceId,'c');assert.equal(current.fromPort,'top');assert.equal(current.toInstanceId,'b');
 await page.keyboard.press('ControlOrMeta+z');await page.waitForFunction(()=>protaCanvas.getState().edges[0].fromInstanceId==='a');await select();
 await gesture(await handle('to'),await position('c','right',15));
 assert.equal((await state()).edges[0].toInstanceId,'c');assert.equal((await state()).edges[0].toPort,'right');
 await page.keyboard.press('ControlOrMeta+z');await page.waitForFunction(()=>protaCanvas.getState().edges[0].toInstanceId==='b');await select();current=(await state()).edges[0];
 console.log('PASS both endpoint directions, stable edge identity, jitter protection and one-step undo');
 // Invalid drops and Escape preserve the original edge and clear every transient layer.
 await gesture(await handle('to'),{x:30,y:400});assert.deepEqual((await state()).edges[0],current);
 await gesture(await handle('to'),await position('locked','left'));assert.deepEqual((await state()).edges[0],current);
 await gesture(await handle('to'),await position('c','left'),{cancel:true});assert.deepEqual((await state()).edges[0],current);
 assert.equal(await page.locator('.connection-preview path').count(),0);
 assert.equal(await page.evaluate(()=>document.querySelector('#stage').hasPointerCapture(1)),false);
 await move(await handle('to'));await page.mouse.down();await move(await position('c','left'));await page.evaluate(()=>document.querySelector('#stage').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));await page.mouse.up();assert.deepEqual((await state()).edges[0],current);
 console.log('PASS blank/locked drops, Escape and pointer cancellation leave the original edge intact');
 // A fast release resolves from release coordinates, even before the next animation frame.
 await move(await handle('to'));await page.mouse.down();const rapid=await position('c','left',17);await page.mouse.move(rapid.x,rapid.y);await page.mouse.up();assert.equal((await state()).edges[0].toInstanceId,'c');
 await page.keyboard.press('ControlOrMeta+z');await select();
 // Moving close to a viewport edge pans continuously, and cancellation stops it immediately.
 const v=(await state()).viewport;await move(await handle('to'));await page.mouse.down();await page.mouse.move(1432,500);await page.waitForFunction(x=>protaCanvas.getState().viewport.x<x-15,v.x);await page.keyboard.press('Escape');await page.mouse.up();const stopped=(await state()).viewport;await page.waitForTimeout(100);assert.deepEqual((await state()).viewport,stopped);assert.deepEqual((await state()).edges[0],current);
 console.log('PASS fast release and cancellable edge auto-pan');
 // Zoom does not shrink hit areas: reconnect using an outside dot at a different scale.
 await page.evaluate(()=>protaCanvas.fit(protaCanvas.getState().nodes));await page.waitForTimeout(250);
 await page.mouse.move(720,500);await page.keyboard.down('Control');await page.mouse.wheel(0,70);await page.keyboard.up('Control');await page.waitForTimeout(150);await select();
 await gesture(await handle('to'),await position('c','top',18));assert.equal((await state()).edges[0].toInstanceId,'c');assert.equal((await state()).edges[0].toPort,'top');
 await save();await page.reload();await page.waitForFunction(()=>window.protaCanvas?.connections.getRoutes().length===1);assert.equal((await state()).edges[0].id,id);assert.equal((await state()).edges[0].toPort,'top');
 console.log('PASS scale-independent magnetic endpoints and persisted reconnection');
 // Touch uses the same gesture contract and a larger magnetic radius.
 await select();const touchStart=await handle('to'),touchEnd=await position('b','left',24);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchStart.x,y:touchStart.y,id:7}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchEnd.x,y:touchEnd.y,id:7}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal((await state()).edges[0].toInstanceId,'b');assert.equal((await state()).edges[0].toPort,'left');
 console.log('PASS real touch endpoint drag with expanded magnetic radius');
 // Selection-mode click/click follows the same path as dragging from a port.
 await page.keyboard.press('Escape');await move(await position('a','bottom'));await page.locator('[data-node-id=a][data-connection-port=bottom]').click();
 const body=(await state()).nodes.find(n=>n.id==='c'),bodyPoint=await screen({x:body.x+80,y:body.y+80});await page.mouse.click(bodyPoint.x,bodyPoint.y);
 assert.equal((await state()).edges.length,2);assert.equal((await state()).edges[1].toInstanceId,'c');
 await page.keyboard.press('ControlOrMeta+z');await select();
 // Existing blocked relations stay repairable instead of losing all endpoint handles.
 const brokenId=await page.evaluate(()=>protaCanvas.connections.create('d','f'));
 await page.waitForFunction(id=>protaCanvas.connections.getRoutes().find(r=>r.id===id)?.unroutable,brokenId);
 assert.equal(await page.locator('[data-connection-end]').count(),2);
 await gesture(await handle('to'),await position('c','right',12));
 assert.equal((await state()).edges.find(e=>e.id===brokenId).toInstanceId,'c');
 await page.waitForFunction(id=>protaCanvas.connections.getRoutes().find(r=>r.id===id)?.unroutable===undefined,brokenId);
 await page.keyboard.press('Delete');await select();console.log('PASS blocked saved connections retain draggable endpoints and can be repaired');
 // Permission changes during a drag must cancel the gesture before a release can mutate data.
 const readOnlyBefore=(await state()).edges;await move(await handle('to'));await page.mouse.down();await move(await position('c','left'));
 await page.evaluate(()=>window.postMessage({type:'prota:canvas-config',readOnly:true},location.origin));await page.waitForFunction(()=>!document.querySelector('[data-connection-end]'));await page.mouse.up();assert.deepEqual((await state()).edges,readOnlyBefore);
 assert.equal(await page.locator('.connection-preview path').count(),0);console.log('PASS click/click connection and read-only transition during a live gesture');
 if(process.env.CANVAS_SCREENSHOTS)await page.screenshot({path:'/tmp/prota-connection-gestures.png'});
 assert.deepEqual(errors,[]);
}finally{await browser?.close();child?.kill('SIGTERM');await fs.rm(tmp,{recursive:true,force:true});}
