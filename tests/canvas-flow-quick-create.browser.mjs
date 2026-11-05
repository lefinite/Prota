import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
// Flowchart quick create: four-way dots, same-shape click, drag-to-connect and the
// drop-on-blank shape picker. Every assertion reads the persisted document model.
const app=process.cwd(),tmp=await fs.mkdtemp(path.join(os.tmpdir(),'canvas-flow-quick-')),root=path.join(tmp,'workspace'),dir=path.join(root,'src/pages/demo/flow/v1');
const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const shots=process.env.CANVAS_SCREENSHOTS;
let child,browser,logs='';
try{
 await fs.mkdir(dir,{recursive:true});await fs.cp(path.join(app,'src/templates/infinite-canvas'),dir,{recursive:true});await fs.mkdir(path.join(root,'data'));
 await fs.writeFile(path.join(root,'workspace.json'),JSON.stringify({id:'flow-quick-test',formatVersion:1}));
 await fs.writeFile(path.join(root,'data/projects.json'),JSON.stringify({projects:[{id:'demo',name:'Demo',pages:[{id:'flow',name:'Flow',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']}]}]}));
 const step=(id,x,y,extra={})=>({id,type:'rect',flowShape:'process',name:id,x,y,width:220,height:88,text:'步骤 '+id,color:'#ffffff',fontSize:16,textAlign:'center',textColor:'#344155',...extra});
 const nodes=[step('p',0,0,{text:'提交申请',color:'#f2f5ff',strokeColor:'#22252c',strokeWidth:2,fontSize:18}),step('q',0,600,{flowShape:'decision',height:152,text:'审核通过？'}),step('r',1200,0),step('t',1200,400),step('lk',1200,900,{locked:true}),{id:'n1',type:'note',name:'备注',x:600,y:900,width:200,height:120,text:'备注',color:'#fff1b8'},
  step('long',-800,600,{flowShape:'decision',height:152,text:'这是一段非常长的判断条件文案，用来验证文字超出图形安全区时不会越过轮廓，而是在区域内渐隐并提示扩大图形'}),
  {id:'bd',type:'board',name:'登录页',x:-800,y:-600,width:360,height:240,src:'boards/bd/index.html'}];
 await fs.mkdir(path.join(dir,'boards','bd'),{recursive:true});await fs.writeFile(path.join(dir,'boards','bd','index.html'),'<!doctype html><html><body style="margin:0;font:16px sans-serif"><h1>登录</h1><button>登录</button></body></html>');
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify({schemaVersion:1,revision:0,viewport:{x:200,y:300,zoom:1},nodes})+';');
 child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(tmp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 const base=`http://127.0.0.1:${port}`;let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(7000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/src/pages/demo/flow/v1/index.html');await page.waitForFunction(()=>window.protaCanvas&&document.documentElement.dataset.protaCanvasReady==='true');
 const state=()=>page.evaluate(()=>protaCanvas.getState());
 const screen=p=>page.evaluate(p=>{const v=protaCanvas.getState().viewport,r=document.querySelector('#stage').getBoundingClientRect();return{x:p.x*v.zoom+v.x+r.left,y:p.y*v.zoom+v.y+r.top}},p);
 const nodeById=async id=>(await state()).nodes.find(n=>n.id===id);
 const center=async id=>{const n=await nodeById(id);return screen({x:n.x+n.width/2,y:n.y+n.height/2});};
 const fitTo=async ids=>{await page.evaluate(ids=>protaCanvas.fit(protaCanvas.getState().nodes.filter(n=>ids.includes(n.id))),ids);await page.waitForTimeout(250);};
 const selectNode=async id=>{await page.keyboard.press('Escape');const c=await center(id);await page.mouse.click(c.x,c.y);await page.waitForFunction(id=>protaCanvas.getSelection().join()===id,id);};
 const dots=page.locator('.flow-quick-dot'),picker=page.locator('#flow-shape-picker');
 const dotCenter=async side=>{const b=await page.locator(`.flow-quick-dot[data-side=${side}] .dot-hit`).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
 // Key order is not part of the document (a reload may reorder migrated board fields).
 const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sortKeys(v[k])])):v;
 const snapshot=async()=>{const s=await state();return JSON.stringify(sortKeys({nodes:s.nodes,edges:s.edges||[]}));};
 const press=async(key)=>{await page.keyboard.press(key);await page.waitForTimeout(60);};
 const overlaps=(a,b,m=24)=>a.x<b.x+b.width+m&&a.x+a.width+m>b.x&&a.y<b.y+b.height+m&&a.y+a.height+m>b.y;
 const opposite={left:'right',right:'left',top:'bottom',bottom:'top'};
 const outline=async(id,side)=>page.evaluate(([id,side])=>{const n=protaCanvas.getState().nodes.find(n=>n.id===id);return window.CanvasConnections.outlinePoint(n,side);},[id,side]);
 const dragTo=async(from,to,{release=true}={})=>{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});if(release)await page.mouse.up();await page.waitForTimeout(80);};

 // 1. Visibility: hovering or selecting an editable object in select mode shows four dots; locked
 //    objects, multi-selection, other tools and label editing show none.
 await fitTo(['p','q','r','t','lk','n1']);
 await selectNode('p');await page.waitForFunction(()=>document.querySelectorAll('.flow-quick-dot').length===4);
 assert.deepEqual(await dots.evaluateAll(els=>els.map(el=>el.getAttribute('aria-label'))),['向上添加同类图形，拖动可连线','向右添加同类图形，拖动可连线','向下添加同类图形，拖动可连线','向左添加同类图形，拖动可连线']);
 const right=await dotCenter('right');await page.mouse.move(right.x,right.y);await page.waitForTimeout(220);
 assert.deepEqual(await page.locator('.flow-quick-dot[data-side=right]').evaluate(g=>[getComputedStyle(g.querySelector('.dot-core')).transform,getComputedStyle(g.querySelector('.dot-arrow')).opacity]),['matrix(2.6, 0, 0, 2.6, 0, 0)','1']);
 // The dot's hit area stays clear of the selection frame's edge handle.
 {const handle=await page.locator('#selection-frame [data-handle=e]').boundingBox(),hit=await page.locator('.flow-quick-dot[data-side=right] .dot-hit').boundingBox();
  assert.ok(hit.x-(handle.x+handle.width)>=4,`dot and resize handle do not overlap: ${hit.x-(handle.x+handle.width)}px`);}
 if(shots)await page.screenshot({path:'/tmp/prota-flow-quick-hover.png'});
 // Hover alone shows an unselected object's dots, and they work without selecting it first.
 {const blankPoint=await screen({x:600,y:300});await page.mouse.click(blankPoint.x,blankPoint.y);}
 await page.waitForFunction(()=>protaCanvas.getSelection().length===0&&!document.querySelector('.flow-quick-dot'));
 const hoverSnap=await snapshot();
 await page.mouse.move(...Object.values(await center('r')));
 await page.waitForFunction(()=>document.querySelectorAll('.flow-quick-dot[data-node-id="r"]').length===4);
 assert.equal((await page.evaluate(()=>protaCanvas.getSelection())).length,0,'hover does not select');
 {const hit=await page.locator('.flow-quick-dot[data-node-id="r"][data-side=right] .dot-hit').boundingBox();await page.mouse.move(hit.x+hit.width/2,hit.y+hit.height/2,{steps:6});await page.mouse.click(hit.x+hit.width/2,hit.y+hit.height/2);}
 await page.waitForFunction(n=>protaCanvas.getState().nodes.length===n+1,JSON.parse(hoverSnap).nodes.length);
 {const made=(await state()).nodes.at(-1),edge=(await state()).edges.at(-1);
  assert.deepEqual([made.flowShape,edge.fromInstanceId,edge.toInstanceId,edge.fromPort],['process','r',made.id,'right']);}
 await page.keyboard.press('Escape');await page.keyboard.press('ControlOrMeta+z');assert.equal(await snapshot(),hoverSnap);
 await page.keyboard.down('Shift');await selectNode('p');const qc=await center('q');await page.mouse.click(qc.x,qc.y);await page.keyboard.up('Shift');
 assert.equal((await page.evaluate(()=>protaCanvas.getSelection())).length,2);assert.equal(await dots.count(),0,'multi-selection hides dots');
 // Notes offer flowchart creation; locked objects stay without dots.
 for(const [id,count] of [['lk',0],['n1',4]]){await page.keyboard.press('Escape');const c=await center(id);await page.mouse.click(c.x,c.y);await page.waitForTimeout(80);assert.equal(await dots.count(),count,id+' dots');}
 // Non-flow objects ask before creating; cancel leaves the canvas untouched.
 for (const id of ['n1','bd']) {
  await fitTo([id]); await selectNode(id); const before=await snapshot(),dot=await dotCenter('right');
  await page.mouse.click(dot.x,dot.y); await picker.waitFor({state:'visible'});
  assert.equal(await snapshot(),before,'opening the picker does not clone '+id);
  await picker.getByRole('menuitem',{name:'判断',exact:true}).click();
  assert.equal((await state()).nodes.at(-1).flowShape,'decision');
  assert.equal((await state()).edges.at(-1).fromInstanceId,id);
  await page.keyboard.press('Escape');await page.keyboard.press('ControlOrMeta+z');assert.equal(await snapshot(),before);
 }
 // The shape tool is absent; node fills and property colors use the shared palette.
 assert.equal(await page.locator('#add-shape').count(),0);
 for (const [id,label,color] of [['n1','颜色','#ffd9d2'],['p','颜色','#d4ecec']]) {
  await fitTo([id]); await selectNode(id);
  const toolbar=await page.locator('#selection-tools').boundingBox(),node=await page.locator('.node[data-id="'+id+'"]').boundingBox();
  assert.ok(toolbar.y+toolbar.height<=node.y||toolbar.y>=node.y+node.height,'toolbar stays above or below the selection');
  assert.ok(Math.min(Math.abs(toolbar.y+toolbar.height-node.y),Math.abs(toolbar.y-node.y-node.height))<100,'toolbar stays near the selection '+JSON.stringify({id,toolbar,node}));
  const colorButton=page.locator('#selection-tools').getByRole('button',{name:label,exact:true});
  assert.equal(await colorButton.textContent(),'','toolbar shows only the current color');
  assert.equal(await colorButton.locator('.connection-color-swatch').count(),1,'same color indicator as connections');
  const before=await snapshot();await colorButton.click();
  const colors=page.locator('#node-colors');await colors.waitFor({state:'visible'});
  assert.equal(await colors.locator('.color-swatch').count(),12);
  await colors.locator('[data-color="'+color+'"]').click();assert.equal((await nodeById(id)).color,color);
  const expectedRGB=color==='#ffd9d2'?'rgb(255, 217, 210)':'rgb(212, 236, 236)';
  await page.waitForFunction(rgb=>getComputedStyle(document.querySelector('#selection-tools .canvas-color-swatch')).backgroundColor===rgb,expectedRGB);
  assert.equal(await page.locator('#selection-tools').getByText('填充',{exact:true}).count(),0);
  await page.keyboard.press('ControlOrMeta+z');assert.equal(await snapshot(),before,'color change is undoable');await selectNode(id);
  await page.waitForFunction(id=>{const color=protaCanvas.getState().nodes.find(n=>n.id===id).color,probe=document.createElement('span');probe.style.color=color;document.body.append(probe);const expected=getComputedStyle(probe).color;probe.remove();return getComputedStyle(document.querySelector('#selection-tools .canvas-color-swatch')).backgroundColor===expected;},id);
 }
 await fitTo(['p','q','r','t','lk','n1']);
 await selectNode('p');await press('l');assert.equal(await dots.count(),0,'connect tool hides dots');
 await press('Escape');await page.waitForFunction(()=>document.querySelectorAll('.flow-quick-dot').length===0||true);
 await selectNode('p');await press('h');assert.equal(await dots.count(),0,'hand tool hides dots');await press('v');
 await selectNode('p');assert.equal(await dots.count(),4);
 // Editing a label hides the dots; leaving the editor brings them back.
 await page.locator('.node[data-id="p"] .node-content').dblclick();await page.locator('.node[data-id="p"].editing').waitFor();
 assert.equal(await dots.count(),0,'text editing hides dots');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.node.editing'));
 await selectNode('p');await page.waitForFunction(()=>document.querySelectorAll('.flow-quick-dot').length===4);
 assert.equal((await nodeById('p')).text,'提交申请','cancelled edit keeps the label');
 console.log('PASS dots appear on hover or selection, clear the resize handles, work without selecting, and hide where they must');

 // 2. A click on each side adds one same-shape, same-style node and one edge in a single undo step.
 const original=await nodeById('p');
 for(const side of ['right','bottom','left','top']){
  await selectNode('p');const before=await state(),dot=await dotCenter(side);
  await page.mouse.click(dot.x,dot.y);
  await page.waitForFunction(n=>protaCanvas.getState().nodes.length===n+1,before.nodes.length);
  const after=await state(),made=after.nodes.at(-1),edge=after.edges.at(-1);
  assert.equal(after.edges.length,(before.edges||[]).length+1);
  assert.deepEqual(await page.evaluate(()=>protaCanvas.getSelection()),[made.id],'the new node is selected');
  assert.deepEqual([made.type,made.flowShape,made.width,made.height,made.color,made.strokeColor,made.strokeWidth,made.fontSize,made.text],['rect','process',220,88,'#f2f5ff','#22252c',2,18,'']);
  assert.deepEqual([edge.fromInstanceId,edge.toInstanceId,edge.fromPort,edge.toPort],['p',made.id,side,opposite[side]]);
  for(const other of after.nodes.filter(n=>n.id!==made.id&&!n.hidden))assert.ok(!overlaps(made,other,0),`${side} node overlaps ${other.id}`);
  await page.waitForFunction(id=>protaCanvas.connections.getRoutes().some(r=>r.edge.id===id),edge.id);
  const route=await page.evaluate(id=>protaCanvas.connections.getRoutes().find(r=>r.edge.id===id).points,edge.id);
  assert.deepEqual(route[0],await outline('p',side),'route starts on the clicked outline point');
  assert.deepEqual(route.at(-1),await outline(made.id,opposite[side]),'route ends on the opposite side');
  assert.deepEqual(await nodeById('p'),original,'the source never moves or changes');
 }
 const beforeUndo=await state(),lastNode=beforeUndo.nodes.at(-1),lastEdge=beforeUndo.edges.at(-1);
 await page.keyboard.press('Escape');await page.keyboard.press('ControlOrMeta+z');
 let undone=await state();assert.equal(undone.nodes.length,beforeUndo.nodes.length-1);assert.equal(undone.edges.length,beforeUndo.edges.length-1);
 assert.ok(!undone.nodes.some(n=>n.id===lastNode.id)&&!undone.edges.some(e=>e.id===lastEdge.id),'one undo removes both node and edge');
 await page.keyboard.press('ControlOrMeta+Shift+z');const redone=await state();
 assert.deepEqual([redone.nodes.at(-1).id,redone.edges.at(-1).id],[lastNode.id,lastEdge.id],'redo restores the same identities');
 console.log('PASS four directional clicks create one connected same-shape node each; undo/redo is atomic');

 // 3. Consecutive clicks keep extending without overlap or stray double-click text: click the
 //    new node's right dot, then continue from the node the pointer now hovers.
 const rightNode=redone.edges.find(e=>e.fromInstanceId==='p'&&e.fromPort==='right').toInstanceId;
 await fitTo([rightNode]);await selectNode(rightNode);
 for(let i=0;i<5;i++){
  const count=(await state()).nodes.length,dot=await dotCenter('right');
  await page.mouse.click(dot.x,dot.y);
  await page.waitForFunction(n=>protaCanvas.getState().nodes.length===n+1,count);
  const tail=(await state()).nodes.at(-1);await fitTo([tail.id]);const c=await center(tail.id);
  await page.mouse.move(c.x,c.y,{steps:3});
  await page.waitForFunction(()=>document.querySelectorAll('.flow-quick-dot').length===4);
 }
 const chain=await state(),flows=chain.nodes.filter(n=>n.flowShape&&!n.hidden);
 for(let i=0;i<flows.length;i++)for(let j=i+1;j<flows.length;j++)assert.ok(!overlaps(flows[i],flows[j],0),`${flows[i].id} overlaps ${flows[j].id}`);
 assert.equal(chain.nodes.filter(n=>n.type==='text').length,0,'rapid dot clicks never trigger the blank double-click text');
 assert.ok(chain.nodes.filter(n=>n.flowShape==='process'&&n.text==='').length>=9);
 if(shots){await fitTo(chain.nodes.filter(n=>n.flowShape).map(n=>n.id));await page.screenshot({path:'/tmp/prota-flow-quick-chain.png'});}
 console.log('PASS five consecutive clicks extend a non-overlapping chain');

 // 4. Dragging to blank canvas opens the picker without writing; every dismissal writes nothing.
 await fitTo(['q','n1']);
 const blank=async()=>screen({x:110,y:1000});
 const openPicker=async()=>{await selectNode('q');const from=await dotCenter('bottom');await dragTo(from,await blank());await picker.waitFor({state:'visible'});};
 let snap=await snapshot();
 await openPicker();
 assert.equal(await snapshot(),snap,'releasing on blank canvas writes nothing');
 assert.equal(await page.locator('.flow-quick-preview path').count(),1,'the pending arrow points at the drop point');
 assert.equal(await picker.getByRole('menuitem').count(),27);
 if(shots)await page.screenshot({path:'/tmp/prota-flow-quick-picker.png'});
 await page.keyboard.press('Escape');await picker.waitFor({state:'hidden'});
 assert.equal(await snapshot(),snap);assert.equal(await page.locator('.flow-quick-preview path').count(),0);
 await openPicker();const outside=await screen({x:400,y:700});await page.mouse.click(outside.x,outside.y);await picker.waitFor({state:'hidden'});assert.equal(await snapshot(),snap,'outside click cancels');
 await openPicker();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await picker.waitFor({state:'hidden'});assert.equal(await snapshot(),snap,'blur cancels');
 await selectNode('q');{const from=await dotCenter('bottom'),to=await blank();await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y-40,{steps:8});
  await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));await page.mouse.move(to.x,to.y,{steps:2});await page.mouse.up();await page.waitForTimeout(120);}
 assert.ok(await picker.isHidden(),'pointercancel never opens the picker');assert.equal(await snapshot(),snap,'pointercancel writes nothing');
 // A second pointer (pinch) during a held drag cancels it; releasing on blank opens nothing.
 await selectNode('q');{const from=await dotCenter('bottom'),to=await blank();await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(from.x,from.y+40,{steps:4});
  await page.evaluate(()=>document.body.dispatchEvent(new PointerEvent('pointerdown',{pointerId:99,pointerType:'touch',bubbles:true})));await page.mouse.move(to.x,to.y,{steps:4});await page.mouse.up();await page.waitForTimeout(120);}
 assert.ok(await picker.isHidden(),'a second pointer cancels the quick drag');assert.equal(await snapshot(),snap,'second pointer writes nothing');assert.equal(await page.locator('.flow-quick-preview *').count(),0);
 // Hovering a choice previews its outline and route at the landing spot without writing.
 await openPicker();const dbItem=picker.getByRole('menuitem',{name:'数据库',exact:true});
 await dbItem.hover();await page.locator('.flow-shape-preview').waitFor();
 assert.equal(await page.locator('.flow-shape-preview path').count(),3,'cylinder outline previews body and both rims');
 assert.equal(await snapshot(),snap,'hover preview writes nothing');
 if(shots)await page.screenshot({path:'/tmp/prota-flow-quick-preview.png'});
 await picker.getByRole('menuitem',{name:'文本',exact:true}).hover();await page.waitForFunction(()=>document.querySelectorAll('.flow-shape-preview path').length===1);
 await page.mouse.move(5,500);await page.waitForFunction(()=>!document.querySelector('.flow-shape-preview')&&document.querySelectorAll('.flow-quick-preview path').length===1);
 await page.keyboard.press('Escape');await picker.waitFor({state:'hidden'});assert.equal(await snapshot(),snap);
 // Choosing a shape commits the node and its edge together, beside the drop point.
 await openPicker();const drop=await page.evaluate(p=>{const v=protaCanvas.getState().viewport,r=document.querySelector('#stage').getBoundingClientRect();return{x:(p.x-r.left-v.x)/v.zoom,y:(p.y-r.top-v.y)/v.zoom}},await blank());
 await picker.getByRole('menuitem',{name:'数据库',exact:true}).click();await picker.waitFor({state:'hidden'});
 let next=await state(),before=JSON.parse(snap),made=next.nodes.at(-1),edge=next.edges.at(-1);
 assert.equal(next.nodes.length,before.nodes.length+1);assert.equal(next.edges.length,before.edges.length+1);
 assert.deepEqual([made.flowShape,made.width,made.height,edge.fromInstanceId,edge.toInstanceId,edge.fromPort,edge.toPort],['database',180,140,'q',made.id,'bottom','top']);
 assert.ok(Math.abs(made.y-drop.y)<=1&&Math.abs(made.x+made.width/2-drop.x)<=1,`node sits on the drop point: ${JSON.stringify([made.x,made.y,drop])}`);
 assert.deepEqual(await page.evaluate(()=>protaCanvas.getSelection()),[made.id]);
 await page.keyboard.press('Escape');await page.keyboard.press('ControlOrMeta+z');assert.equal(await snapshot(),snap,'one undo removes the chosen node and its edge');
 // The grid is keyboard operable.
 await openPicker();assert.equal(await page.evaluate(()=>document.activeElement.dataset.shape),'terminator');
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.dataset.shape),'circle');
 await page.locator('.flow-shape-preview').waitFor();assert.equal(await snapshot(),snap,'keyboard preview writes nothing');
 await page.keyboard.press('Home');for(let i=0;i<3;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await picker.waitFor({state:'hidden'});
 next=await state();assert.deepEqual([next.nodes.at(-1).flowShape,next.edges.at(-1).toInstanceId],['process',next.nodes.at(-1).id]);
 await page.keyboard.press('Escape');await page.keyboard.press('ControlOrMeta+z');assert.equal(await snapshot(),snap);
 console.log('PASS drop on blank opens the shape grid; Esc/outside/blur/pointercancel write nothing; a choice commits atomically');

 // 5. Dropping on an existing node connects it directly: one edge, no picker, no node.
 await fitTo(['r','t']);await selectNode('r');snap=await snapshot();
 await dragTo(await dotCenter('bottom'),await center('t'));
 await page.waitForFunction(n=>protaCanvas.getState().edges.length===n+1,JSON.parse(snap).edges.length);
 next=await state();edge=next.edges.at(-1);assert.ok(await picker.isHidden());assert.equal(next.nodes.length,JSON.parse(snap).nodes.length);
 assert.deepEqual([edge.fromInstanceId,edge.toInstanceId,edge.fromPort],['r','t','bottom']);
 await page.keyboard.press('Escape');await page.keyboard.press('ControlOrMeta+z');assert.equal(await snapshot(),snap);
 // The connect tool keeps its two-click behaviour and shows no quick dots.
 await page.keyboard.press('Escape');await press('l');let rc=await center('r'),tc=await center('t');await page.mouse.click(rc.x,rc.y);await page.mouse.click(tc.x,tc.y);
 await page.waitForFunction(n=>protaCanvas.getState().edges.length===n+1,JSON.parse(snap).edges.length);assert.equal(await dots.count(),0);
 await page.keyboard.press('Escape');await page.keyboard.press('ControlOrMeta+z');assert.equal(await snapshot(),snap);
 console.log('PASS drag onto a node adds only an edge; the L tool two-click connection is unchanged');

 // 6. Near the viewport edge the picker flips inside; dots keep a constant screen size across zoom.
 await fitTo(['q','n1']);await selectNode('q');
 const edgePoint={x:1440-14,y:420};
 await dragTo(await dotCenter('right'),edgePoint);await picker.waitFor({state:'visible'});
 const box=await picker.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=1440&&box.y+box.height<=1000,'picker stays in the viewport');
 await page.keyboard.press('Escape');await picker.waitFor({state:'hidden'});
 await fitTo(['p']);await selectNode('p');
 for(const zoomClicks of [0,2,2]){
  for(let i=0;i<zoomClicks;i++){await page.locator('#zoom-in').click();await page.waitForTimeout(260);}
  const zoom=(await state()).viewport.zoom,p=await nodeById('p'),hit=await page.locator('.flow-quick-dot[data-side=right] .dot-hit').boundingBox();
  const expected=await screen({x:p.x+p.width+24/zoom,y:p.y+p.height/2});
  assert.ok(Math.abs(hit.width-28)<1,`hit area stays 28px at zoom ${zoom}`);
  assert.ok(Math.abs(hit.x+hit.width/2-expected.x)<1.5&&Math.abs(hit.y+hit.height/2-expected.y)<1.5,`dot tracks the outline at zoom ${zoom}`);
 }
 while((await state()).viewport.zoom*88>=36){await page.locator('#zoom-out').click();await page.waitForTimeout(260);}
 assert.equal(await dots.count(),0,'dots hide when the shape is too small to separate them');
 console.log('PASS picker stays on screen; dots keep constant size and outline position across zoom');

 // 7. Long labels never cross the outline: they fade inside the safe area and hint at resizing.
 await fitTo(['long']);const longEl=page.locator('.node[data-id="long"]'),longText=longEl.locator('.node-content');
 await page.waitForFunction(()=>document.querySelector('.node[data-id="long"]')?.hasAttribute('data-text-overflow'));
 assert.equal(await longEl.getAttribute('title'),'文字超出图形，拖动手柄可扩大');
 assert.equal(await longText.evaluate(el=>getComputedStyle(el).overflow),'hidden');
 assert.equal(await page.locator('.node[data-id="q"]').getAttribute('data-text-overflow'),null,'a short label is untouched');
 {const outer=await longEl.boundingBox(),inner=await longText.boundingBox();
  assert.ok(inner.x>=outer.x&&inner.y>=outer.y&&inner.x+inner.width<=outer.x+outer.width&&inner.y+inner.height<=outer.y+outer.height,'visible text stays inside the shape box');}
 if(shots)await page.screenshot({path:'/tmp/prota-flow-quick-long-text.png'});
 // Enlarging with the resize handle until the label fits clears the fade and the hint.
 await selectNode('long');{const zoom=(await state()).viewport.zoom,grip=await page.locator('#selection-frame [data-handle=se]').boundingBox();
  await dragTo({x:grip.x+grip.width/2,y:grip.y+grip.height/2},{x:grip.x+grip.width/2+300*zoom,y:grip.y+grip.height/2+200*zoom});}
 assert.ok((await nodeById('long')).width>=500,'the shape was enlarged');
 await page.waitForFunction(()=>{const el=document.querySelector('.node[data-id="long"]');return !el.hasAttribute('data-text-overflow')&&!el.hasAttribute('title');});
 console.log('PASS long labels fade inside the outline with a resize hint, cleared once enlarged');

 // 8. Labels commit with Enter (Shift+Enter breaks the line, IME composition never commits);
 //    the style panel switches the shape and edits the stroke within the document contract.
 await fitTo(['r','t']);await selectNode('r');
 {const dot=await dotCenter('bottom'),count=(await state()).nodes.length;await page.mouse.click(dot.x,dot.y);await page.waitForFunction(n=>protaCanvas.getState().nodes.length===n+1,count);}
 const labelled=(await state()).nodes.at(-1),labelledEl=page.locator(`.node[data-id="${labelled.id}"]`);
 await labelledEl.locator('.node-content').dblclick();await page.locator(`.node[data-id="${labelled.id}"].editing`).waitFor();
 await page.keyboard.type('条件 A');await page.keyboard.press('Shift+Enter');await page.keyboard.type('第二行');
 await labelledEl.locator('.node-content').evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true})));
 assert.equal(await page.locator(`.node[data-id="${labelled.id}"].editing`).count(),1,'Enter during IME composition keeps editing');
 await page.keyboard.press('Enter');await page.waitForFunction(id=>!document.querySelector(`.node[data-id="${id}"].editing`),labelled.id);
 assert.equal((await nodeById(labelled.id)).text,'条件 A\n第二行');
 await page.waitForFunction(()=>document.querySelectorAll('.flow-quick-dot').length===4);
 await page.locator('#selection-tools').getByRole('button',{name:'样式',exact:true}).click();
 await page.locator('.inspector-choice summary[aria-label="形状"]').click();
 await page.getByRole('option',{name:'云朵',exact:true}).click();
 await page.waitForFunction(id=>protaCanvas.getState().nodes.find(n=>n.id===id).flowShape==='cloud',labelled.id);
 // A shape-only change moves the incoming endpoint onto the new outline (below the box top).
 const incoming=(await state()).edges.find(e=>e.toInstanceId===labelled.id);
 await page.waitForFunction(([edgeId,nodeId])=>{const n=protaCanvas.getState().nodes.find(n=>n.id===nodeId),p=protaCanvas.connections.getRoutes().find(r=>r.edge.id===edgeId)?.points.at(-1),o=window.CanvasConnections.outlinePoint(n,'top');return p&&p.x===o.x&&p.y===o.y&&o.y>n.y;},[incoming.id,labelled.id]);
 await page.locator('.node-color-button[aria-label="描边"]').click();
 const strokePalette=page.locator('#node-colors');await strokePalette.waitFor({state:'visible'});
 const strokeBefore=(await nodeById(labelled.id)).strokeColor;
 await strokePalette.locator('input[type=color]').evaluate(el=>{el.value='#22aa66';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal((await nodeById(labelled.id)).strokeColor,'#22aa66','custom colors preview live');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.node-color-button[aria-label="描边"] .canvas-color-swatch')).backgroundColor==='rgb(34, 170, 102)');
 await strokePalette.locator('input[type=color]').evaluate(el=>{el.value='#229966';el.dispatchEvent(new Event('input',{bubbles:true}));el.value='#22aa66';el.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.keyboard.press('ControlOrMeta+z');assert.equal((await nodeById(labelled.id)).strokeColor,strokeBefore,'one undo restores a custom color gesture');
 await page.keyboard.press('ControlOrMeta+Shift+z');
 await page.waitForFunction(id=>protaCanvas.getState().nodes.find(n=>n.id===id).strokeColor==='#22aa66',labelled.id);
 // Property edits render on the next frame; the selected outline then shows the chosen stroke.
 await page.waitForFunction(id=>getComputedStyle(document.querySelector(`.node[data-id="${id}"] .flow-geometry path`)).stroke==='rgb(34, 170, 102)',labelled.id);
 const strokeWidth=page.getByLabel('描边宽度',{exact:true});await strokeWidth.fill('20');await strokeWidth.press('Tab');
 await page.waitForFunction(id=>protaCanvas.getState().nodes.find(n=>n.id===id).strokeWidth===10,labelled.id);
 await page.keyboard.press('Escape');
 console.log('PASS Enter commits labels (Shift+Enter, IME safe); style panel switches shape and edits stroke within range');

 // 9. Lines draw gray by default; the toolbar recolors a line with a preset or a custom color.
 await page.keyboard.press('Escape');snap=await snapshot();
 await page.mouse.move(...Object.values(await center(labelled.id)));
 await page.waitForFunction(id=>document.querySelectorAll(`.flow-quick-dot[data-node-id="${id}"]`).length===4,labelled.id);
 {const hit=await page.locator('.flow-quick-dot[data-side=right] .dot-hit').boundingBox();await page.mouse.move(hit.x+hit.width/2,hit.y+hit.height/2,{steps:4});await page.mouse.click(hit.x+hit.width/2,hit.y+hit.height/2);}
 await page.waitForFunction(n=>protaCanvas.getState().edges.length===n+1,JSON.parse(snap).edges.length);
 const lineEdge=(await state()).edges.at(-1),lineSel=`[data-edge-id="${lineEdge.id}"] .connection-line`;
 await page.keyboard.press('Escape');await fitTo(['r','t',labelled.id,lineEdge.toInstanceId]);
 await page.waitForFunction(s=>document.querySelector(s),lineSel);
 assert.equal(await page.evaluate(s=>getComputedStyle(document.querySelector(s)).stroke,lineSel),'rgb(113, 130, 155)','new lines draw gray');
 assert.equal(await page.evaluate(s=>document.querySelector(s).getAttribute('stroke-dasharray'),lineSel),null,'solid');
 const mid=await page.locator(`[data-edge-id="${lineEdge.id}"] .connection-hit`).evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()/2),q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};});
 await page.mouse.click(mid.x,mid.y);await page.locator('#connection-tools').waitFor({state:'visible'});
 const tools=page.locator('#connection-tools'),presets=tools.locator('[data-kind]');
 assert.deepEqual(await presets.evaluateAll(els=>els.map(el=>[el.dataset.kind,el.getAttribute('aria-label'),el.getAttribute('aria-pressed')])),[['main','灰色实线','true'],['exception','橙色虚线','false']],'gray solid and orange dashed only');
 // The palette applies on click, so a chosen color cannot be lost by dismissing a dialog.
 await tools.locator('.connection-color').click();
 const palette=page.locator('#connection-colors');await palette.waitFor({state:'visible'});
 assert.equal(await palette.locator('.color-swatch').count(),12,'eleven presets plus one custom cell');
 assert.equal(await palette.locator('.color-swatch[data-color]').count(),11);
 assert.equal(await palette.locator('input[type=color]').count(),1,'the custom cell is the only text-free way to pick arbitrary colors');
 // The palette is as wide as its swatch grid, not stretched by a text field.
 {const grid=await palette.locator('.color-grid').boundingBox(),box=await palette.boundingBox();
  assert.ok(box.width-grid.width<=24,`palette hugs its grid: ${box.width} vs ${grid.width}`);}
 if(shots){await palette.screenshot({path:'/tmp/prota-line-palette.png'});await tools.screenshot({path:'/tmp/prota-line-toolbar.png'});}
 // The palette hangs off the button's left edge, not centred, and the custom cell keeps its
 // rainbow ring with a disc that mirrors the current custom color.
 {const btn=await tools.locator('.connection-color').boundingBox(),box=await palette.boundingBox();
  assert.ok(Math.abs(box.x-btn.x)<=2,`palette left-aligns with the button: ${box.x} vs ${btn.x}`);
  const cell=await palette.locator('.color-custom').boundingBox();
  assert.ok(cell.x+cell.width<=box.x+box.width+1,'the custom cell sits in the last grid slot');
  assert.match(await palette.locator('.color-custom').evaluate(el=>getComputedStyle(el).backgroundImage),/conic-gradient/,'the rainbow is the custom cell\'s color');
  const preset=await palette.locator('.color-swatch[data-color]').first().boundingBox(),custom=await palette.locator('.color-custom').boundingBox();
  assert.equal(custom.width,preset.width);assert.equal(custom.height,preset.height);
  // The custom cell is the deliberate odd one: one plain rainbow circle, no nested rings.
 assert.equal(await palette.locator('.color-custom-disc').count(),0,'no center dot');
 const customStyle=await palette.locator('.color-custom').evaluate(el=>{const g=c=>getComputedStyle(el).getPropertyValue(c).trim();return [g('width'),g('height'),g('border-radius'),g('box-shadow')];});
 // Same box, same rim and outline as the presets, so the visible rainbow disc is equal in size.
 assert.deepEqual(customStyle,await palette.locator('.color-swatch[data-color]:not([aria-pressed="true"])').first().evaluate(el=>{const g=c=>getComputedStyle(el).getPropertyValue(c).trim();return [g('width'),g('height'),g('border-radius'),g('box-shadow')];}),'matches a preset swatch exactly');
}
 // Swatches stay circles: the global button height must not stretch them.
 {const box=await palette.locator('.color-swatch').first().boundingBox();assert.ok(Math.abs(box.width-box.height)<=1,`swatch is round: ${box.width}x${box.height}`);}
 await palette.locator('.color-swatch[data-color="#8e4ec6"]').click();
 await page.waitForFunction(id=>protaCanvas.getState().edges.find(e=>e.id===id).color==='#8e4ec6',lineEdge.id);
 assert.ok(await palette.isHidden(),'picking a swatch closes the palette');
 await page.waitForFunction(s=>getComputedStyle(document.querySelector(s)).stroke==='rgb(142, 78, 198)',lineSel);
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#connection-tools .canvas-color-swatch')).backgroundColor==='rgb(142, 78, 198)');
 assert.equal(await page.evaluate(s=>document.querySelector(s).getAttribute('marker-end'),lineSel),'url(#canvas-arrow-c8e4ec6)','the arrowhead matches the custom color');
 assert.deepEqual(await presets.evaluateAll(els=>els.map(el=>el.getAttribute('aria-pressed'))),['false','false'],'a custom color clears the preset highlight');
 if(shots)await page.screenshot({path:'/tmp/prota-flow-quick-line-color.png'});
 // Any other color comes from the custom cell, which mirrors what the picker commits.
 const pickCustom=async value=>{
  await tools.locator('.connection-color').click();await palette.waitFor({state:'visible'});
  await palette.getByLabel('自定义线条颜色').evaluate((input,v)=>{input.value=v;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);
  await palette.waitFor({state:'hidden'});
 };
 await pickCustom('#3366cc');
 await page.waitForFunction(id=>protaCanvas.getState().edges.find(e=>e.id===id).color==='#3366cc',lineEdge.id);
 // Reopening shows the committed color inside the rainbow ring, still unmistakably the custom cell.
 await tools.locator('.connection-color').click();await palette.waitFor({state:'visible'});
 // Clicking outside dismisses without writing.
 const beforeDismiss=await page.evaluate(id=>protaCanvas.getState().edges.find(e=>e.id===id).color,lineEdge.id);
 await page.mouse.click(20,20);await palette.waitFor({state:'hidden'});
 assert.equal(await page.evaluate(id=>protaCanvas.getState().edges.find(e=>e.id===id).color,lineEdge.id),beforeDismiss,'dismissing the palette changes nothing');
 // Clicking the canvas also clears the line selection (existing behaviour); pick the line again,
 // away from the midpoint where its toolbar opens.
 const mid20=await page.locator(`[data-edge-id="${lineEdge.id}"] .connection-hit`).evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()*0.2),q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y};});
 await page.mouse.click(mid20.x,mid20.y);await tools.waitFor({state:'visible'});
 // The orange preset resets to dashed orange; a custom color then keeps the dashes.
 await presets.nth(1).click();
 await page.waitForFunction(id=>{const e=protaCanvas.getState().edges.find(e=>e.id===id);return e.kind==='exception'&&!('color' in e);},lineEdge.id);
 await page.waitForFunction(s=>getComputedStyle(document.querySelector(s)).stroke==='rgb(189, 115, 39)',lineSel);
 await pickCustom('#3366cc');
 await page.waitForFunction(id=>protaCanvas.getState().edges.find(e=>e.id===id).color==='#3366cc',lineEdge.id);
 await page.waitForFunction(s=>getComputedStyle(document.querySelector(s)).stroke==='rgb(51, 102, 204)',lineSel);
 assert.equal(await page.evaluate(s=>document.querySelector(s).getAttribute('stroke-dasharray'),lineSel),'8 6','a custom color keeps the dash pattern');
 // The active custom cell uses the same selected ring as an active preset: accent tight to the edge.
 await tools.locator('.connection-color').click();await palette.waitFor({state:'visible'});
 assert.equal(await palette.locator('.color-custom').evaluate(el=>getComputedStyle(el).boxShadow),'rgb(255, 255, 255) 0px 0px 0px 2px inset, rgb(87, 101, 206) 0px 0px 0px 2px','selected ring matches the presets');

 await page.keyboard.press('Escape');
 // Select mode has no connection ports any more; the L tool keeps its own hover points.
 await page.mouse.move(...Object.values(await center('t')));
 await page.waitForFunction(()=>document.querySelectorAll('.flow-quick-dot[data-node-id="t"]').length===4);
 assert.equal(await page.locator('[data-connection-port]').count(),0,'select mode shows no connection ports');
 await press('l');await page.mouse.move(...Object.values(await center('r')));
 await page.locator('[data-node-id="r"][data-connection-port]').first().waitFor();assert.equal(await dots.count(),0,'the L tool shows no quick dots');
 await press('Escape');
 console.log('PASS lines default to gray; presets and a custom color restyle them; hover ports only in the L tool');

 // 10. Boards: hovering their content shows the dots, the top dot clears the title, and a click
 //     asks which shape to add instead of duplicating the board.
 await fitTo(['bd']);await page.keyboard.press('Escape');snap=await snapshot();
 await page.locator('.node[data-id="bd"] iframe').waitFor();
 {const frame=await page.locator('.node[data-id="bd"] iframe').boundingBox();await page.mouse.move(frame.x+frame.width/2,frame.y+frame.height/2,{steps:3});}
 await page.waitForFunction(()=>document.querySelectorAll('.flow-quick-dot[data-node-id="bd"]').length===4);
 assert.equal(await page.locator('.flow-quick-dot[data-node-id="bd"][data-side=right]').getAttribute('aria-label'),'向右添加图形，拖动可连线');
 {const title=await page.locator('.node[data-id="bd"] > .node-title').boundingBox(),top=await page.locator('.flow-quick-dot[data-node-id="bd"][data-side=top] .dot-hit').boundingBox();
  assert.ok(top.y+top.height<=title.y,`the top dot clears the board title: ${top.y+top.height} vs ${title.y}`);}
 {const dot=await page.locator('.flow-quick-dot[data-node-id="bd"][data-side=right] .dot-hit').boundingBox();
  await page.mouse.move(dot.x+dot.width/2,dot.y+dot.height/2,{steps:6});await page.mouse.click(dot.x+dot.width/2,dot.y+dot.height/2);}
 await picker.waitFor({state:'visible'});assert.equal(await snapshot(),snap,'a board dot click writes nothing before a choice');
 {const box=await picker.boundingBox(),board=await page.locator('.node[data-id="bd"]').boundingBox();assert.ok(box.x>=board.x+board.width,'the panel opens beside the dot, off the board');}
 if(shots)await page.screenshot({path:'/tmp/prota-flow-quick-board.png'});
 await picker.getByRole('menuitem',{name:'判断',exact:true}).click();await picker.waitFor({state:'hidden'});
 {const now=await state(),made=now.nodes.at(-1),edge=now.edges.at(-1),board=now.nodes.find(n=>n.id==='bd');
  assert.deepEqual([made.flowShape,edge.fromInstanceId,edge.toInstanceId,edge.fromPort,edge.toPort],['decision','bd',made.id,'right','left']);
  assert.ok(made.x>=board.x+board.width+24,'the new step sits beside the board');}
 await page.keyboard.press('Escape');await page.keyboard.press('ControlOrMeta+z');assert.equal(await snapshot(),snap);
 console.log('PASS boards show dots on hover, keep the title clear, and ask which shape to add');

 // Style changes apply to both creation paths, including a custom color on a dashed line.
 await fitTo(['p','r']);
 for (const [preset,kind,color] of [['橙色虚线','exception','#e5484d'],['灰色实线','main','#12a594']]) {
  await page.evaluate(()=>protaCanvas.connections.create('p','r'));
  await page.getByRole('button',{name:preset,exact:true}).click();
  await page.getByRole('button',{name:'线条颜色',exact:true}).click();
  await page.getByRole('button',{name:'线条颜色 '+color,exact:true}).click();
  const original=(await state()).edges.at(-1);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>protaCanvas.connections.create('p','r'));
  let made=(await state()).edges.at(-1);
  assert.deepEqual([made.kind,made.color],[kind,color],'ordinary connections inherit the latest complete style');
  await selectNode('p');
  await page.waitForFunction(()=>document.querySelector('.flow-quick-dot[data-node-id="p"][data-side=right]'));
  const at=await dotCenter('right');await page.mouse.click(at.x,at.y);
  made=(await state()).edges.at(-1);
  assert.deepEqual([made.kind,made.color],[kind,color],'quick-create connections inherit the same complete style');
  assert.deepEqual((await state()).edges.find(e=>e.id===original.id),original,'creating connections preserves existing lines');
 }
 console.log('PASS ordinary and quick-created connections inherit custom colors and solid/dashed styles');

 // 11. Save, reload and read-only sharing.
 await page.waitForFunction(()=>!protaCanvas.isDirty());const saved=await snapshot();
 await page.reload();await page.waitForFunction(()=>window.protaCanvas&&document.documentElement.dataset.protaCanvasReady==='true');
 assert.equal(await snapshot(),saved,'quick-created nodes and edges persist');
 await page.evaluate(()=>window.postMessage({type:'prota:canvas-config',readOnly:true},location.origin));await page.locator('body.readonly').waitFor();
 await fitTo(['p']);const pc=await center('p');await page.mouse.click(pc.x,pc.y);await page.waitForTimeout(120);assert.equal(await dots.count(),0,'read-only shows no dots');
 assert.deepEqual(errors,[]);
 console.log('PASS quick-create results persist through reload; read-only sharing shows no dots');
}finally{await browser?.close();child?.kill('SIGTERM');await fs.rm(tmp,{recursive:true,force:true});}
