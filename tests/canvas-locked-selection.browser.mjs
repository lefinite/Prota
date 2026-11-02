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
 const nodes=[
  {id:'a',type:'rect',name:'A',x:400,y:350,width:100,height:80,color:'#dfe9ff',locked:true},
  {id:'b',type:'rect',name:'B',x:650,y:350,width:100,height:80,color:'#dfe9ff',locked:true},
  {id:'c',type:'rect',name:'C',x:900,y:350,width:100,height:80,color:'#dfe9ff'}
 ];
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify({schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes})+';');
 await page.goto(base+'/src/pages/demo/design/v1/index.html');
 await page.waitForFunction(()=>window.protaCanvas);
 const selection=()=>page.evaluate(()=>window.protaCanvas.getSelection());
 const positions=()=>page.evaluate(()=>window.protaCanvas.getState().nodes.map(({id,x,y})=>({id,x,y})));
 const box=id=>page.locator(`.node[data-id="${id}"]`).boundingBox();
 const drag=async(id,dx,dy)=>{
  const b=await box(id);await page.mouse.move(b.x+25,b.y+25);await page.mouse.down();
  await page.mouse.move(b.x+25+dx,b.y+25+dy,{steps:6});await page.mouse.up();
 };
 const marquee=async(ids)=>{
  const boxes=await Promise.all(ids.map(box));
  await page.mouse.move(Math.min(...boxes.map(b=>b.x))-25,Math.min(...boxes.map(b=>b.y))-25);await page.mouse.down();
  await page.mouse.move(Math.max(...boxes.map(b=>b.x+b.width))+25,Math.max(...boxes.map(b=>b.y+b.height))+25,{steps:8});await page.mouse.up();
 };
 const before=await positions();
 await page.locator('.node[data-id="a"]').click();
 assert.deepEqual(await selection(),['a'],'locked object can be clicked');
 await drag('a',70,50);
 assert.deepEqual(await positions(),before,'locked object cannot be dragged');
 await marquee(['a','b']);
 assert.deepEqual(new Set(await selection()),new Set(['a','b']),'marquee selects multiple locked objects');
 await page.keyboard.press('ArrowRight');
 assert.deepEqual(await positions(),before,'locked selection cannot be nudged');
 await page.locator('.node[data-id="a"]').click({modifiers:['Shift']});
 assert.deepEqual(await selection(),['b'],'Shift-click removes locked object from selection');
 await page.locator('.node[data-id="a"]').click({modifiers:['Shift']});
 assert.deepEqual(new Set(await selection()),new Set(['a','b']),'Shift-click adds locked object');
 await marquee(['a','b','c']);
 await drag('c',40,30);
 const mixed=await positions();
 assert.deepEqual(mixed.slice(0,2),before.slice(0,2),'moving mixed selection leaves locked objects fixed');
 assert.notDeepEqual(mixed[2],before[2],'unlocked object still moves');
 await marquee(['a','b']);
 await page.locator('#selection-tools').getByRole('button',{name:'解锁',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.protaCanvas.getState().nodes.filter(n=>n.locked).length),0,'batch unlock clears both locks');
 await drag('a',60,40);
 const after=await positions();
 assert.notDeepEqual(after[0],before[0],'unlocked objects can move');
 assert.equal(after[0].x-before[0].x,after[1].x-before[1].x,'batch selection moves together after unlocking');
 assert.deepEqual(errors,[]);
 console.log('PASS: locked click / marquee / Shift selection, drag and keyboard protection, mixed movement, batch unlock');
}finally{await browser?.close();child?.kill();}
