import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const mod=process.platform==='darwin'?'Meta':'Control';
const app=process.cwd(), temp=await fs.mkdtemp(path.join(os.tmpdir(),'prota-text-clipboard-'));
const root=path.join(temp,'workspace'), dir=path.join(root,'src/pages/demo/design/v1');
const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
let child,browser,logs='';
try {
  await fs.mkdir(dir,{recursive:true});
  await fs.cp(path.join(app,'src/templates/infinite-canvas'),dir,{recursive:true});
  await fs.mkdir(path.join(root,'data'),{recursive:true});
  await fs.writeFile(path.join(root,'workspace.json'),JSON.stringify({id:'text-clipboard',formatVersion:1}));
  await fs.writeFile(path.join(root,'data/projects.json'),JSON.stringify({projects:[{id:'demo',name:'Demo',pages:[{id:'design',name:'Canvas',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']}]}],activeProjectId:'demo',activePageId:'design'}));
  child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(temp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const base=`http://127.0.0.1:${port}`;
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,logs);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(base+'/clipboard-test',route=>route.fulfill({contentType:'text/html',body:'<iframe style="width:1400px;height:900px" src="/src/pages/demo/design/v1/index.html"></iframe>'}));
  await page.goto(base+'/clipboard-test');
  const frame=page.frames().find(f=>f.url().includes('/src/pages/'));
  await frame.waitForFunction(()=>window.protaCanvas);
  const state=()=>frame.evaluate(()=>window.protaCanvas.getState());
  const focus=()=>frame.locator('#stage').focus();
  const paste=async(text)=>{
    await focus();
    await frame.evaluate(text=>navigator.clipboard.writeText(text),text);
    await page.keyboard.press(`${mod}+V`);
  };
  const initial=(await state()).nodes.length;
  const text='微信复制的文字 👋\n第二行\n\n保留段落和 <script>alert(1)</script>';
  await paste(text);
  await frame.waitForFunction(count=>window.protaCanvas.getState().nodes.length===count,initial+1);
  let doc=await state();const node=doc.nodes.at(-1);
  assert.equal(node.type,'text');assert.equal(node.text,text);
  assert.deepEqual(await frame.evaluate(()=>window.protaCanvas.getSelection()),[node.id]);
  await frame.waitForFunction(id=>{const el=document.querySelector(`.node[data-id="${id}"] .node-content`);return el&&el.scrollHeight<=el.clientHeight+1;},node.id);
  assert.equal(await frame.locator(`.node[data-id="${node.id}"] script`).count(),0);
  await page.keyboard.press('Control+Z');assert.equal((await state()).nodes.length,initial);
  await page.keyboard.press('Control+Shift+Z');assert.equal((await state()).nodes.at(-1).text,text);

  // Object copy uses its own clipboard format; an external copy must supersede it.
  await focus();await page.keyboard.press(`${mod}+C`);await page.keyboard.press(`${mod}+V`);
  await frame.waitForFunction(count=>window.protaCanvas.getState().nodes.length===count,initial+2);
  doc=await state();assert.equal(doc.nodes.at(-1).text,text);
  assert.notEqual(doc.nodes.at(-1).id,node.id);
  await paste('从微信重新复制');
  await frame.waitForFunction(()=>window.protaCanvas.getState().nodes.at(-1).text==='从微信重新复制');
  assert.equal((await state()).nodes.length,initial+3);

  // Native text editing receives paste without creating another node.
  const last=(await state()).nodes.at(-1);
  await frame.locator(`.node[data-id="${last.id}"]`).dblclick();
  await frame.evaluate(()=>navigator.clipboard.writeText('编辑中粘贴'));
  await page.keyboard.press(`${mod}+A`);await page.keyboard.press(`${mod}+V`);
  await frame.locator('#stage').click({position:{x:1100,y:750}});
  assert.equal((await state()).nodes.length,initial+3);
  assert.equal((await state()).nodes.at(-1).text,'编辑中粘贴');
  await paste('   \n');assert.equal((await state()).nodes.length,initial+3);

  const long='很长的微信文本，需要自动换行并且显示完整内容。'.repeat(100);
  await paste(long);
  await frame.waitForFunction(text=>window.protaCanvas.getState().nodes.at(-1).text===text,long);
  await frame.waitForFunction(()=>window.protaCanvas.getState().nodes.at(-1).height>100);
  await frame.evaluate(()=>window.protaCanvas.save());
  const saved=await state();await frame.goto(frame.url());await frame.waitForFunction(()=>window.protaCanvas);
  assert.deepEqual((await state()).nodes,saved.nodes);
  assert.deepEqual(errors,[]);
  console.log('PASS: real clipboard in iframe, Chinese and multiline text, undo/redo, internal copies, external clipboard precedence, editing isolation, long text auto-height and save/reload');
} finally {
  await browser?.close();child?.kill('SIGTERM');await fs.rm(temp,{recursive:true,force:true});
}
