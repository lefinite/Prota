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

 const state=()=>page.evaluate(()=>protaCanvas.getState());
 const screen=p=>page.evaluate(p=>{const v=protaCanvas.getState().viewport;return{x:p.x*v.zoom+v.x,y:p.y*v.zoom+v.y}},p);
 const drag=async(a,b)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();};
 const menu=page.locator('#flow-shape-picker');
 // The five legacy shapes are inserted through the visible shape grid, never by editing the document.
 for(const label of ['开始 / 结束','流程矩形','判断','子流程','连接圆点']){
  await page.getByRole('button',{name:'流程图',exact:true}).click();
  assert.equal(await menu.getByRole('menuitem').count(),27);
  await menu.getByRole('menuitem',{name:label,exact:true}).click();
 }
 let doc=await state();const shapes=doc.nodes.filter(n=>n.flowShape);
 assert.deepEqual(shapes.map(n=>n.flowShape),['terminator','process','decision','subprocess','connector']);
 assert.ok(shapes.every(n=>!n.parentId));assert.equal(await page.locator('.flow-geometry').count(),5);
 for(const n of shapes)for(const board of doc.nodes.filter(n=>n.type==='board'))assert.ok(!(n.x<board.x+board.width&&n.x+n.width>board.x&&n.y<board.y+board.height&&n.y+n.height>board.y),'new flow shape must not be nested or overlap a board');
 console.log('PASS visible flowchart kit inserts five independent, non-overlapping shapes');
 // Move the process and decision to a readable branch below the board using real canvas dragging.
 await page.evaluate(()=>protaCanvas.fit(protaCanvas.getState().nodes));await page.waitForTimeout(300);
 const relocate=async(id,x,y)=>{const n=(await state()).nodes.find(n=>n.id===id);await page.keyboard.press('Escape');await drag(await screen({x:n.x+n.width/2,y:n.y+n.height/2}),await screen({x:x+n.width/2,y:y+n.height/2}));};
 const processNode=shapes.find(n=>n.flowShape==='process'),decision=shapes.find(n=>n.flowShape==='decision');
 await relocate(processNode.id,500,600);await relocate(decision.id,900,600);
 await page.evaluate(()=>protaCanvas.fit(protaCanvas.getState().nodes.filter(n=>['a',...protaCanvas.getState().nodes.filter(n=>['process','decision'].includes(n.flowShape)).map(n=>n.id)].includes(n.id))));await page.waitForTimeout(300);
 // Leave room for manipulation handles above the fixed bottom toolbars.
 await page.mouse.move(720,500);await page.keyboard.down('Control');await page.mouse.wheel(0,30);await page.keyboard.up('Control');await page.waitForTimeout(150);
 // Board-to-process connection, using the board's bottom port.
 await page.getByRole('button',{name:'连线工具',exact:true}).click();
 const a=(await state()).nodes.find(n=>n.id==='a'),p=(await state()).nodes.find(n=>n.id===processNode.id);
 await drag(await screen({x:a.x+a.width/2,y:a.y+a.height}),await screen({x:p.x+p.width/2,y:p.y}));
 await page.waitForFunction(()=>protaCanvas.getState().edges.length===1);
 let edge=(await state()).edges[0];assert.equal(edge.fromInstanceId,'a');assert.equal(edge.toInstanceId,processNode.id);assert.equal(edge.toPort,'top');
 console.log('PASS board boundary connects directly to flowchart rectangle');
 // A DOM button inside a board can target the exact vertex of a decision diamond.
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'连线工具',exact:true}).click();
 const button=await frame('a').locator('#next').boundingBox(),d=(await state()).nodes.find(n=>n.id===decision.id);
 await drag({x:button.x+button.width-3,y:button.y+button.height/2},await screen({x:d.x+d.width/2,y:d.y}));
 await page.waitForFunction(()=>protaCanvas.getState().edges.length===2);
 edge=(await state()).edges[1];assert.equal(edge.fromAnchor.selector,'#next');assert.equal(edge.toInstanceId,decision.id);assert.equal(edge.toPort,'top');
 await page.waitForFunction(()=>protaCanvas.connections.getRoutes().length===2);
 const end=await page.evaluate(()=>protaCanvas.connections.getRoutes()[1].points.at(-1));assert.deepEqual(end,{x:d.x+d.width/2,y:d.y});
 console.log('PASS board DOM control connects to exact diamond vertex');
 // Flow-to-flow edges and a returning board branch use the same editor and labels.
 const connect=async(from,to,label)=>{
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'连线工具',exact:true}).click();await drag(await screen(from),await screen(to));
  await page.locator('#connection-tools').getByRole('button',{name:'编辑文字',exact:true}).click();await page.getByRole('textbox',{name:'在线编辑连线文字'}).fill(label);await page.keyboard.press('Enter');
 };
 await connect({x:p.x+p.width,y:p.y+p.height/2},{x:d.x,y:d.y+d.height/2},'是');
 await connect({x:d.x+d.width/2,y:d.y+d.height},{x:a.x,y:a.y+a.height/2},'否');
 assert.equal((await state()).edges.length,4);assert.deepEqual((await state()).edges.slice(2).map(e=>e.label),['是','否']);
 assert.equal((await state()).edges[2].fromInstanceId,processNode.id);assert.equal((await state()).edges[3].toInstanceId,'a');
 console.log('PASS flow-to-flow connection and labeled returning board branch');
 // Shape text is edited in place and retained by undo/redo and copy.
 await page.keyboard.press('Escape');await page.locator(`.node[data-id="${decision.id}"] .node-content`).dblclick();
 // The shared plain text editor is contenteditable rather than a native textbox.
 const content=page.locator(`.node[data-id="${decision.id}"] .node-content[contenteditable]`);await content.fill('审核通过？');await page.locator('#stage').focus();
 assert.equal((await state()).nodes.find(n=>n.id===decision.id).text,'审核通过？');
 await page.keyboard.press('ControlOrMeta+z');assert.equal((await state()).nodes.find(n=>n.id===decision.id).text,'是否满足条件？');await page.keyboard.press('ControlOrMeta+Shift+z');
 await page.locator(`.node[data-id="${decision.id}"] .node-content`).click();
 await page.keyboard.press('ControlOrMeta+d');assert.equal((await state()).nodes.filter(n=>n.flowShape==='decision').length,2);await page.keyboard.press('ControlOrMeta+z');
 // Drag a selection handle; SVG bounds and connection endpoints track the resize.
 await page.locator(`.node[data-id="${decision.id}"] .node-content`).click();const grip=page.locator('#selection-frame [data-handle=se]'),g=await grip.boundingBox();
 await drag({x:g.x+g.width/2,y:g.y+g.height/2},{x:g.x+g.width/2+40,y:g.y+g.height/2+30});
 const resized=(await state()).nodes.find(n=>n.id===decision.id);assert.ok(resized.width>d.width);assert.ok(resized.height>d.height);
 assert.equal(await page.locator(`.node[data-id="${decision.id}"] .flow-geometry`).getAttribute('viewBox'),`0 0 ${resized.width} ${resized.height}`);
 await page.waitForFunction(id=>{const n=protaCanvas.getState().nodes.find(n=>n.id===id),p=protaCanvas.connections.getRoutes().find(r=>r.edge.toInstanceId===id)?.points.at(-1);return p?.x===n.x+n.width/2&&p?.y===n.y},decision.id);
 console.log('PASS flow text edit, undo/redo, duplication, resize geometry and anchored routes');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!protaCanvas.isDirty());await page.reload();await page.waitForFunction(()=>window.protaCanvas?.connections.getRoutes().length===4);
 doc=await state();assert.equal(doc.nodes.find(n=>n.id===decision.id).text,'审核通过？');assert.equal(doc.nodes.filter(n=>n.flowShape).length,5);assert.equal(doc.edges[1].fromAnchor.selector,'#next');
 await page.evaluate(()=>protaCanvas.fit(protaCanvas.getState().nodes.filter(n=>n.flowShape||n.id==='a')));await page.waitForTimeout(300);
 if(process.env.CANVAS_SCREENSHOTS)await page.screenshot({path:'/tmp/prota-flowchart-kit.png'});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.getByRole('button',{name:'流程图',exact:true}).click();
  const bounds=await menu.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width,'flowchart picker fits narrow viewport');
  await page.keyboard.press('Escape');
 }
 await page.evaluate(()=>window.postMessage({type:'prota:canvas-config',readOnly:true},location.origin));await page.locator('body.readonly').waitFor();assert.ok(await page.locator('.creation-tools').isHidden());assert.equal(await page.locator('.flow-geometry').count(),5);assert.deepEqual(errors,[]);
 console.log('PASS flowchart and mixed board/control connections persist through save/reload and read-only sharing');
}finally{await browser?.close();child?.kill('SIGTERM');await fs.rm(tmp,{recursive:true,force:true});}
