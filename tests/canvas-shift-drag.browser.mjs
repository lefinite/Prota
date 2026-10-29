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
 if(process.env.PROTA_CANVAS_TEST_APP) await fs.copyFile(process.env.PROTA_CANVAS_TEST_APP,path.join(dir,'app.js'));
 await fs.mkdir(path.join(root,'data'),{recursive:true});await fs.writeFile(path.join(root,'workspace.json'),JSON.stringify({id:'canvas-test',formatVersion:1}));
 await fs.writeFile(path.join(root,'data/projects.json'),JSON.stringify({projects:[{id:'demo',name:'Demo',pages:[{id:'design',name:'Canvas',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']}]}],activeProjectId:'demo',activePageId:'design'}));
 child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(temp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 const base=`http://127.0.0.1:${port}`;
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify({schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[{id:'a',type:'rect',name:'A',x:400,y:350,width:100,height:80,color:'#dfe9ff',text:''},{id:'b',type:'rect',name:'B',x:650,y:350,width:100,height:80,color:'#dfe9ff',text:''}]})+';');
 const url=base+'/src/pages/demo/design/v1/index.html';await page.goto(url);await page.waitForFunction(()=>window.protaCanvas);assert.equal(await page.evaluate(()=>window.protaCanvas.runtimeVersion),20);

 const getSelection=()=>page.evaluate(()=>window.protaCanvas.getSelection());
 const positions=()=>page.evaluate(()=>window.protaCanvas.getState().nodes.map(n=>({id:n.id,x:n.x,y:n.y})));
 const marquee=async()=>{
  const boxes=await page.locator('.node').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  await page.mouse.move(Math.min(...boxes.map(b=>b.x))-30,Math.min(...boxes.map(b=>b.y))-30);await page.mouse.down();
  await page.mouse.move(Math.max(...boxes.map(b=>b.right))+30,Math.max(...boxes.map(b=>b.bottom))+30,{steps:8});await page.mouse.up();
 };
 await marquee();
 const ids=await getSelection();assert.equal(ids.length,2,'marquee selects both rectangles');
 const node=page.locator(`.node[data-id="${ids[1]}"] .node-content`);
 const drag=async(dx,dy,cancel=false)=>{
  const box=await node.boundingBox();
  await page.keyboard.down('Shift');await page.mouse.move(box.x+25,box.y+25);await page.mouse.down();
  assert.deepEqual(await getSelection(),ids,'Shift pointerdown keeps the full selection');
  await page.mouse.move(box.x+25+dx,box.y+25+dy,{steps:6});
  if(cancel) await page.keyboard.press('Escape');
  await page.mouse.up();await page.keyboard.up('Shift');
 };
 for(const [dx,dy] of [[80,0],[0,80]]){
  const before=await positions();await drag(dx,dy);
  assert.deepEqual(await getSelection(),ids,'Shift-drag retains all selected objects');
  const after=await positions(),delta={x:after[0].x-before[0].x,y:after[0].y-before[0].y};
  assert.ok(Math.abs(delta.x)+Math.abs(delta.y)>0,'objects moved');
  assert.equal(dx?delta.y:delta.x,0,'Shift constrains movement to the dominant axis');
  for(let i=0;i<before.length;i++){assert.equal(after[i].x-before[i].x,delta.x);assert.equal(after[i].y-before[i].y,delta.y);}
  await page.keyboard.press('Meta+z');assert.deepEqual(await positions(),before,'one undo restores both objects');
  await marquee();
 }
 const beforeCancel=await positions();await drag(80,0,true);
 assert.deepEqual(await positions(),beforeCancel,'Escape restores both positions');
 assert.deepEqual(await getSelection(),ids,'Escape preserves the multi-selection');
 await node.click({modifiers:['Shift']});
 assert.deepEqual(await getSelection(),ids.filter(id=>id!==ids[1]),'Shift-click removes only the clicked object');
 await node.click({modifiers:['Shift']});assert.deepEqual(new Set(await getSelection()),new Set(ids),'Shift-click adds an unselected object');
 await page.mouse.click(1100,700);
 await node.click();

 const singleBefore=await positions(),box=await node.boundingBox();
 await page.keyboard.down('Shift');await page.mouse.move(box.x+25,box.y+25);await page.mouse.down();await page.mouse.move(box.x+105,box.y+25,{steps:6});await page.mouse.up();await page.keyboard.up('Shift');
 assert.deepEqual(await getSelection(),[ids[1]],'Shift-drag also keeps a single object selected');
 assert.notDeepEqual(await positions(),singleBefore);
 assert.deepEqual(errors,[]);
 console.log('PASS: marquee + Shift-drag moves all objects horizontally/vertically; undo, Escape, Shift-click and single selection');
}finally{await browser?.close();child?.kill();}
