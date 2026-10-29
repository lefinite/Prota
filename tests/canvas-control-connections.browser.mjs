import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const app=process.cwd(),tmp=await fs.mkdtemp(path.join(os.tmpdir(),'canvas-controls-')),root=path.join(tmp,'workspace'),dir=path.join(root,'src/pages/demo/flow/v1');
const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
let child,browser,logs='';
try{
 await fs.mkdir(dir,{recursive:true});await fs.cp(path.join(app,'src/templates/infinite-canvas'),dir,{recursive:true});await fs.mkdir(path.join(root,'data'));
 await fs.writeFile(path.join(root,'workspace.json'),JSON.stringify({id:'control-test',formatVersion:1}));await fs.writeFile(path.join(root,'data/projects.json'),JSON.stringify({projects:[{id:'demo',name:'Demo',pages:[{id:'flow',name:'Flow',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']}]}]}));
 for(const id of ['a','b']){await fs.mkdir(path.join(dir,'boards',id),{recursive:true});await fs.writeFile(path.join(dir,'boards',id,'index.html'),`<!doctype html><html><head><style>body{margin:30px;font:18px sans-serif}button{display:block;width:200px;height:50px;margin:30px 0}</style></head><body><main><h1>步骤一</h1><button id="next">继续</button></main><button id="switch">切换页面</button><button id="hide">隐藏控件</button><script>let step=1;document.querySelector('#switch').onclick=()=>{step=3-step;document.querySelector('main').innerHTML='<h1>步骤'+(step===1?'一':'二')+'</h1><button id="next">继续</button>'};document.querySelector('#hide').onclick=()=>{const el=document.querySelector('#next');el.hidden=!el.hidden;el.style.display=el.hidden?'none':'block'};</script></body></html>`);}
 const board=(id,x)=>({id,type:'board',name:id,x,y:0,width:400,height:400,src:`boards/${id}/index.html`});
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify({schemaVersion:1,revision:0,viewport:{x:100,y:200,zoom:1},nodes:[board('a',0),board('b',800)],edges:[]})+';');
 child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(tmp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);const base=`http://127.0.0.1:${port}`;
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/src/pages/demo/flow/v1/index.html');await page.waitForFunction(()=>window.protaCanvas);
 const frame=id=>page.frameLocator(`.node[data-id=${id}] iframe`);
 await frame('a').locator('#next').waitFor();await frame('b').locator('#next').waitFor();
 await page.getByRole('button',{name:'连线工具',exact:true}).click();
 // Use real pointer input through the non-interactive iframe preview, not API-created anchors.
 const a=await frame('a').locator('#next').boundingBox(),b=await frame('b').locator('#next').boundingBox();
 await page.mouse.move(a.x+a.width-4,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+4,b.y+b.height/2,{steps:12});await page.mouse.up();
 await page.waitForFunction(()=>window.protaCanvas.getState().edges.length===1);
 const edge=await page.evaluate(()=>window.protaCanvas.getState().edges[0]);assert.equal(edge.fromAnchor.selector,'#next');assert.equal(edge.toAnchor.selector,'#next');
 await page.waitForFunction(()=>window.protaCanvas.connections.getRoutes().length===1);console.log('PASS drag control to control with persisted DOM anchors');
 await page.keyboard.press('Escape');await page.locator('.node[data-id=a]').dblclick({position:{x:15,y:15}});await frame('a').locator('#switch').click();
 await page.waitForFunction(()=>window.protaCanvas.connections.getRoutes().length===0);assert.equal(await page.locator('.connection').count(),0);assert.equal(await page.evaluate(()=>window.protaCanvas.getState().edges.length),1);console.log('PASS page changes hide edge even when new page reuses control ID and text');
 await frame('a').locator('#switch').click();await page.waitForFunction(()=>window.protaCanvas.connections.getRoutes().length===1);
 await frame('a').locator('#hide').click();await page.waitForFunction(()=>window.protaCanvas.connections.getRoutes().length===0);await frame('a').locator('#hide').click();await page.waitForFunction(()=>window.protaCanvas.connections.getRoutes().length===1);console.log('PASS hidden control hides edge and restoring original page/control restores edge');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.protaCanvas.isDirty());await page.reload();await page.waitForFunction(()=>window.protaCanvas?.connections.getRoutes().length===1);assert.equal((await page.evaluate(()=>window.protaCanvas.getState().edges[0])).fromAnchor.selector,'#next');console.log('PASS save and reload preserves anchors');
 // Removing the original node must hide the line rather than attach it to the board boundary.
 await frame('a').locator('#next').evaluate(el=>el.remove());await page.waitForFunction(()=>window.protaCanvas.connections.getRoutes().length===0);assert.equal(await page.evaluate(()=>window.protaCanvas.getState().edges.length),1);assert.deepEqual(errors,[]);console.log('PASS deleted control hides line without destroying saved relation; no browser errors');
}finally{await browser?.close();child?.kill('SIGTERM');await fs.rm(tmp,{recursive:true,force:true});}
