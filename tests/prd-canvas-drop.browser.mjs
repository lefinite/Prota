import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';

const repo=process.cwd(), root=await fs.mkdtemp(path.join(os.tmpdir(),'prota-prd-drop-'));
const prefix='/src/pages/demo/design/', docPath=prefix+'docs/需求.md';
const source='# 产品需求\n\n**粗体**与 *斜体*\n\n- [x] 已完成\n- 待办\n\n> 引用\n\n```js\nconst value = 1;\n```\n\n| 功能 | 状态 |\n| --- | --- |\n| 登录 | 完成 |\n\n![示意](./image.svg)\n\n[详情](./details.md)\n\n[危险](javascript:alert(1))\n\n<img src=x onerror="window.injected=1">';
await fs.mkdir(path.join(root,prefix,'docs'),{recursive:true});
await fs.mkdir(path.join(root,'data'),{recursive:true});
await fs.writeFile(path.join(root,'workspace.json'),JSON.stringify({id:'prd-drop',formatVersion:1}));
await fs.cp(path.join(repo,'src/templates/infinite-canvas'),path.join(root,prefix,'v1'),{recursive:true});
await fs.writeFile(path.join(root,docPath),source);
await fs.writeFile(path.join(root,prefix,'docs/其他.md'),'# 其他文档\n\n从磁盘读取');
await fs.writeFile(path.join(root,prefix,'docs/image.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120"><rect width="100" height="120" fill="green"/></svg>');
await fs.writeFile(path.join(root,'data/projects.json'),JSON.stringify({projects:[{id:'demo',pages:[{id:'design',name:'Canvas',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']}]}]}));
let html=await fs.readFile(path.join(repo,'portal/index.html'),'utf8');
html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replaceAll('href="modules/','href="/portal/modules/').replace('href="shell.css','href="/portal/shell.css');
html=html.replace('</body>',`<iframe id="canvas-test" src="${prefix}v1/index.html" style="position:fixed;inset:0 auto 0 0;width:760px;height:100vh;border:0;z-index:500"></iframe><script type="module">
import {PRDModule} from '/portal/modules/prd/index.js';
const host={activeProjectId:'demo',activePageId:'design',activeVersion:'v1',docDrawerMode:'prd',
annotationDrawer:document.querySelector('#annotationDrawer'),annotationDrawerMeta:document.querySelector('#annotationDrawerMeta'),annotationDrawerBody:document.querySelector('#annotationDrawerBody'),
mainIframe:document.querySelector('#canvas-test'),getPageRecord:()=>({versions:['v1'],pageMode:'infinite-canvas'}),upgradeCanvasEditorIfNeeded:async()=>{await fetch('/api/canvas/upgrade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:'demo',pageId:'design',version:'v1'})});document.querySelector('#canvas-test').contentWindow.location.reload();},getPrdRelativePath:()=>null,showToast:message=>{window.lastToast=message;},showConfirm:async()=>true};
host.annotationDrawer.classList.add('is-visible','is-prd-mode');
Object.assign(host.annotationDrawer.style,{position:'fixed',inset:'20px 12px 20px auto',width:'600px',minWidth:'0',height:'auto',zIndex:'1000',transform:'none',transition:'none'});
window.prd=new PRDModule(host);await prd.switchContext('design','v1');await prd.manager.loadDocument({force:true,path:${JSON.stringify(docPath)}});window.ready=true;
</script></body>`);
await fs.writeFile(path.join(root,'harness.html'),html);
const server=spawn('python3',['-u','-c',`
import sys, os, http.server, urllib.parse
sys.path.insert(0,sys.argv[1])
from server import bridge
from server.canvas_autosave import start_worker
from server.prd_autosave import start_worker as start_prd_worker
repo,root=sys.argv[1:3]
bridge.get_project_root=lambda:root
start_worker(lambda:root,lambda:False)
start_prd_worker(lambda:root,lambda:False)
class Handler(bridge.BridgeHandler):
 def translate_path(self,path):
  clean=urllib.parse.unquote(path.split('?')[0]).lstrip('/')
  return os.path.join(repo if clean.startswith('portal/') else root,clean)
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
print(server.server_port,flush=True)
server.serve_forever()
`,repo,root],{env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(root,'config')},stdio:['ignore','pipe','pipe']});
let browser,logs='';server.stderr.on('data',d=>logs+=d);
try {
 const port=await new Promise((resolve,reject)=>{server.stdout.once('data',d=>resolve(Number(String(d).trim())));server.once('exit',code=>reject(new Error(`${code}: ${logs}`)));});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.setDefaultTimeout(10000);
 page.on('response',async r=>{if(r.url().includes('/api/canvas/save')&&!r.ok())console.error('SAVE:',r.status(),await r.text());});
 page.on('request',r=>{if(r.url().includes('/api/prd-doc'))console.error('PRDREQ:',r.postData());});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://fonts.googleapis.com/**',r=>r.abort());
 await page.goto(`http://127.0.0.1:${port}/harness.html`);await page.waitForFunction(()=>window.ready);
 const frame=page.frames().find(f=>f.url().includes('/v1/index.html'));await frame.waitForFunction(()=>window.protaCanvas);
 const trigger=page.locator('[data-prd-manage-trigger]');
 const drag=async(source,x,y)=>{
   const box=await source.boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
   await page.mouse.move(box.x+box.width/2-10,box.y+box.height/2,{steps:3});
   await page.mouse.move(x,y,{steps:15});await page.mouse.move(x+1,y);await page.mouse.move(x,y);await page.mouse.up();
 };
 await drag(trigger,100,100);
 const preview=frame.locator('.node.text .node-content');await preview.locator('h1').waitFor();
 assert.equal(await preview.locator('h1').innerText(),'产品需求');
 for(const tag of ['strong','em','ul','blockquote','pre','code','table']) assert.ok(await preview.locator(tag).count(),tag);
 assert.equal(await preview.locator('input:checked:disabled').count(),1);
 const image=preview.locator('img');await image.evaluate(img=>{img.loading='eager';return img.decode();});
 assert.ok((await image.getAttribute('src')).endsWith('/docs/image.svg'));
 assert.ok((await preview.locator('a').first().getAttribute('href')).endsWith('/docs/details.md'));
 assert.equal(await preview.locator('[onerror],script,a[href^="javascript:"]').count(),0);
 const node=await frame.evaluate(()=>protaCanvas.getState().nodes[0]);
 assert.equal(node.text,source);assert.equal(node.x,-20);assert.equal(node.y,0);
 await frame.waitForFunction(()=>!protaCanvas.isDirty());
 await frame.locator('#undo').click();assert.equal(await frame.locator('.node.text').count(),0);
 await frame.locator('#redo').click();await preview.locator('h1').waitFor();
 await frame.waitForFunction(()=>!protaCanvas.isDirty());await frame.goto(frame.url());await preview.locator('h1').waitFor();
 assert.equal(await frame.evaluate(()=>protaCanvas.getState().nodes[0].text),source);
 // A linked document uses the saved original even if the drawer has an unsaved draft.
 await page.evaluate(()=>prd.manager.updateState({editMode:true,dirty:true,draftContent:'# 未保存草稿\n\n**新内容**'}));
 await drag(trigger,140,120);
 await frame.waitForFunction(()=>protaCanvas.getState().nodes.length===2);
 assert.equal(await frame.locator('.node.text').last().locator('h1').innerText(),'产品需求');
 // Changing the source on disk updates every linked preview automatically, without a canvas reload/save.
 await frame.waitForFunction(()=>!protaCanvas.isDirty());
 const before=await frame.evaluate(()=>({state:protaCanvas.getState(),selection:protaCanvas.getSelection()}));
 await fs.writeFile(path.join(root,docPath),'# 原文已更新\n\n| 新增 | 需求 |\n| --- | --- |\n| 自动 | 同步 |');
 await frame.waitForFunction(()=>[...document.querySelectorAll('.node.text h1')].filter(el=>el.textContent==='原文已更新').length===2);
 const after=await frame.evaluate(()=>({state:protaCanvas.getState(),selection:protaCanvas.getSelection()}));
 assert.deepEqual(after.state.viewport,before.state.viewport);assert.deepEqual(after.selection,before.selection);
 assert.equal(after.state.revision,before.state.revision,'live refresh does not rewrite canvas layout');
 // A missing source preserves the last successfully loaded preview.
 await fs.rm(path.join(root,docPath));await frame.evaluate(()=>protaCanvas.syncPrds());
 assert.equal(await frame.locator('.node.text').last().locator('h1').innerText(),'原文已更新');
 await fs.writeFile(path.join(root,docPath),'# 原文已恢复');
 await frame.waitForFunction(()=>document.querySelector('.node.text h1')?.textContent==='原文已恢复');
 // A non-current document carries a path and loads its own Markdown at drop time.
 await trigger.click();
 await drag(page.locator('[data-prd-switch-path]').filter({hasText:'其他'}),180,140);
 await frame.waitForFunction(()=>protaCanvas.getState().nodes.length===3);
 assert.equal(await frame.locator('.node.text').last().locator('h1').innerText(),'其他文档');
 // Linked text uses the same inline editor and expanded live preview as normal text.
 await frame.locator('.node.text').last().dispatchEvent('dblclick');
 assert.equal(await frame.locator('.node.text.editing').count(),1);
 const inline=frame.locator('.node.text.editing .node-content');
 await inline.fill('# 可编辑的关联文档\n\n**写回原文**');
 await frame.getByRole('button',{name:'展开 Markdown 编辑器'}).click();
 const dialog=frame.getByRole('dialog',{name:'其他.md'});
 await dialog.waitFor();
 assert.equal(await dialog.locator('.markdown-editor-preview h1').innerText(),'可编辑的关联文档');
 await dialog.locator('textarea').fill('# 双栏编辑\n\n| 功能 | 状态 |\n| --- | --- |\n| 渲染 | 完成 |');
 await dialog.locator('.markdown-editor-preview table').waitFor();
 await dialog.getByRole('button',{name:'保存',exact:true}).click();
 await dialog.waitFor({state:'detached'});
 await frame.waitForFunction(async()=>(await (await fetch('/src/pages/demo/design/docs/其他.md',{cache:'no-store'})).text()).includes('# 双栏编辑'));
 assert.equal(await frame.locator('.node.text').last().locator('h1').innerText(),'双栏编辑');
 // A newer source cannot be overwritten by the canvas draft.
 await frame.locator('.node.text').last().dispatchEvent('dblclick');
 await inline.fill('# 待保存的草稿');
 await frame.getByRole('button',{name:'展开 Markdown 编辑器'}).click();
 await fs.writeFile(path.join(root,prefix,'docs/其他.md'),'# 外部新内容');
 const conflict=frame.getByRole('dialog');
 await conflict.getByRole('button',{name:'保存',exact:true}).click();
 await conflict.getByRole('alert').filter({hasText:'原文档已被修改'}).waitFor();
 assert.equal(await conflict.locator('textarea').inputValue(),'# 待保存的草稿');
 assert.equal(await fs.readFile(path.join(root,prefix,'docs/其他.md'),'utf8'),'# 外部新内容');
 await conflict.getByRole('button',{name:'取消',exact:true}).click();
 await page.keyboard.press('Escape');
 await fs.writeFile(path.join(root,prefix,'docs/其他.md'),'# 双栏编辑\n\n| 功能 | 状态 |\n| --- | --- |\n| 渲染 | 完成 |');
 await frame.evaluate(()=>protaCanvas.syncPrds());
 await frame.waitForFunction(()=>document.querySelector('.node.text:last-of-type h1')?.textContent==='双栏编辑');
 await frame.locator('.node.text').last().dispatchEvent('dblclick');
 const conflictInline=frame.locator('.node.text.editing .node-content');
 // Linked-source edits also reach disk while a canvas run owns the page; a stale Agent write is repaired.
 await fs.writeFile(path.join(root,prefix,'v1/.canvas-autosave.json'),JSON.stringify({runs:['prd-run'],operations:{},pending:false}));
 await page.waitForTimeout(600);
 await frame.evaluate(()=>protaCanvas.agentState({active:true}));
 await conflictInline.fill('# Agent 运行中的手动修改');
 assert.equal(await frame.evaluate(()=>protaCanvas.getState().nodes.at(-1).text),'# Agent 运行中的手动修改');
 await frame.getByRole('button',{name:'完成',exact:true}).click();
 await frame.waitForFunction(()=>!document.querySelector('.node.text.editing'));
 for(let i=0;i<100 && await fs.readFile(path.join(root,prefix,'docs/其他.md'),'utf8')!=='# Agent 运行中的手动修改';i++) await page.waitForTimeout(50);
 assert.equal(await fs.readFile(path.join(root,prefix,'docs/其他.md'),'utf8'),'# Agent 运行中的手动修改');
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,prefix,'v1/.canvas-autosave.json'),'utf8')).runs,['prd-run']);
 await fs.writeFile(path.join(root,prefix,'docs/其他.md'),'# 较旧的 Agent PRD');
 for(let i=0;i<100 && await fs.readFile(path.join(root,prefix,'docs/其他.md'),'utf8')!=='# Agent 运行中的手动修改';i++) await page.waitForTimeout(50);
 assert.equal(await fs.readFile(path.join(root,prefix,'docs/其他.md'),'utf8'),'# Agent 运行中的手动修改');
 await fs.writeFile(path.join(root,prefix,'v1/.canvas-autosave.json'),JSON.stringify({runs:[],operations:{},pending:false}));
 await page.waitForTimeout(700);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,prefix,'.prd-autosave.json'),'utf8')).operations,{});
 // Drops during a run are treated as additions; the end-of-run merge keeps them.
 await frame.evaluate(()=>protaCanvas.agentState({active:true}));
 await drag(trigger,200,160);
 await frame.waitForFunction(()=>protaCanvas?.getState().nodes.length===4);
 assert.equal(await frame.locator('.node.text').last().locator('h1').innerText(),'原文已恢复');
 // A stale installed editor upgrades at drop time and retains the pending PRD and existing nodes.
 await frame.evaluate(()=>{protaCanvas.agentState({active:false,previewManaged:true});delete protaCanvas.importPrd;});
 await frame.waitForFunction(()=>!protaCanvas.isDirty());
 const ids=await frame.evaluate(()=>protaCanvas.getState().nodes.map(n=>n.id));
 await drag(trigger,220,180);
 await frame.waitForFunction(()=>protaCanvas?.getState().nodes.length===5);
 assert.deepEqual(await frame.evaluate(()=>protaCanvas.getState().nodes.slice(0,4).map(n=>n.id)),ids);
 assert.equal(await frame.locator('.node.text').last().locator('h1').innerText(),'原文已恢复');
 // Local text uses the identical editor, toolbar transforms and renderer.
 await frame.locator('#stage').dispatchEvent('dblclick',{clientX:400,clientY:800});
 const localInline=frame.locator('.node.text.editing .node-content');
 await localInline.fill('# 普通文本\n\n与关联文档使用同一套编辑器。');
 await frame.getByRole('button',{name:'展开 Markdown 编辑器'}).click();
 const localDialog=frame.getByRole('dialog'), sourceInput=localDialog.getByRole('textbox',{name:'Markdown 源码'});
 await sourceInput.fill('格式文本');
 await sourceInput.evaluate(el=>{el.focus();el.select();});
 await localDialog.locator('[data-markdown-command=bold]').click();
 assert.equal(await sourceInput.inputValue(),'**格式文本**');
 await sourceInput.press('ControlOrMeta+z');
 assert.equal(await sourceInput.inputValue(),'格式文本','format commands retain native undo');
 await sourceInput.fill('- 列表');await sourceInput.press('End');await sourceInput.press('Enter');await sourceInput.pressSequentially('next');
 assert.equal(await sourceInput.inputValue(),'- 列表\n- next');
 await sourceInput.press('Tab');assert.ok((await sourceInput.inputValue()).endsWith('next  '));
 const localSource='# 普通文本\n\n**统一排版**与 *斜体*\n\n> 同一个 Markdown 组件\n\n- [x] 编辑完成\n\n```js\nconst shared = true;\n```\n\n| 功能 | 状态 |\n| :--- | ---: |\n| 编辑 | 完成 |';
 await sourceInput.fill(localSource);
 await localDialog.locator('.markdown-editor-preview table').waitFor();
 await page.screenshot({path:'/tmp/prota-markdown-shared-editor.png'});
 const previewHtml=await localDialog.locator('.markdown-editor-preview').innerHTML();
 await localDialog.getByRole('button',{name:'保存',exact:true}).click();await localDialog.waitFor({state:'detached'});
 assert.equal((await frame.locator('.node.text').last().locator('.node-content').innerHTML()).replaceAll(' style=""',''),previewHtml.replaceAll(' style=""',''),'canvas and live preview use exactly the same renderer');
 assert.equal(await frame.evaluate(()=>protaCanvas.getState().nodes.at(-1).text),localSource);
 await frame.locator('.node.text').last().dispatchEvent('dblclick');
 await frame.getByRole('button',{name:'展开 Markdown 编辑器'}).click();
 await frame.getByRole('dialog').locator('textarea').fill('取消的修改');
 await frame.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();
 await page.keyboard.press('Escape');
 assert.equal(await frame.evaluate(()=>protaCanvas.getState().nodes.at(-1).text),localSource);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/prota-prd-canvas-drop.png'});
 console.log('PASS: native PRD drag across iframe, GFM, relative images, unsafe HTML, undo/redo, persistence, linked source polling, recovery from missing source, shared editor, live preview, write-back, conflict protection, other documents and busy feedback');
} catch(error) {console.error(logs);throw error;} finally {await browser?.close();server.kill();await fs.rm(root,{recursive:true,force:true});}
