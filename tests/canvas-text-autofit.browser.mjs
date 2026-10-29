import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const app=process.cwd(), temp=await fs.mkdtemp(path.join(os.tmpdir(),'prota-text-autofit-')), root=path.join(temp,'workspace');
const evidence=process.env.PROTA_CANVAS_EVIDENCE_DIR||temp;await fs.mkdir(evidence,{recursive:true});
const dir=path.join(root,'src/pages/demo/design/v1');
const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const LONG='这是一段很长的文本，用来测试画布文本组件在输入较多内容时的自动换行与高度自适应表现。'.repeat(8);
let child,browser,logs='';
const step=(name,value)=>console.log(`\n## ${name}\n`,JSON.stringify(value));
try {
  await fs.mkdir(dir,{recursive:true});
  await fs.cp(path.join(app,'src/templates/infinite-canvas'),dir,{recursive:true});
  await fs.mkdir(path.join(root,'data'),{recursive:true});
  await fs.writeFile(path.join(root,'workspace.json'),JSON.stringify({id:'text-autofit',formatVersion:1}));
  await fs.writeFile(path.join(root,'data/projects.json'),JSON.stringify({projects:[{id:'demo',name:'Demo',pages:[{id:'design',name:'Canvas',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']}]}],activeProjectId:'demo',activePageId:'design'}));
  child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(temp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const base=`http://127.0.0.1:${port}`;
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,logs);
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/src/pages/demo/design/v1/index.html');
  await page.waitForFunction(()=>window.protaCanvas);

  const tid=async()=>page.evaluate(()=>window.protaCanvas.getState().nodes.filter(n=>n.type==='text').at(-1)?.id);
  const geom=async()=>page.evaluate((id)=>{
    const n=window.protaCanvas.getState().nodes.find(n=>n.id===id);
    const el=document.querySelector(`.node[data-id="${id}"]`),inner=el?.querySelector('.node-content');
    return {width:n.width,height:n.height,nodeHeight:Math.round(parseFloat(el.style.height)),contentScroll:inner.scrollHeight,contentClient:inner.clientHeight,verticalOverflow:inner.scrollHeight-inner.clientHeight,horizontalOverflow:inner.scrollWidth-inner.clientWidth,editing:el.classList.contains('editing')};
  },await tid());

  // 1. Create through the text tool, type a long paragraph.
  await page.locator('[data-tool="text"]').click();
  await page.mouse.click(500,400);
  const id=await tid();
  step('created',await geom());
  await page.keyboard.type(LONG,{delay:0});
  await page.waitForTimeout(250);
  const typing=await geom();
  step('while typing',typing);
  assert.ok(typing.height>100,'height grows while typing');
  assert.equal(typing.nodeHeight,typing.height,'rendered node tracks stored height');
  assert.ok(typing.verticalOverflow<=1,'no vertical clipping while typing');

  // 2. Commit by clicking outside, then check the preview.
  await page.mouse.click(1200,880);
  await page.waitForTimeout(500);
  const committed=await geom();
  step('committed preview',committed);
  assert.ok(committed.verticalOverflow<=1,'no vertical clipping in preview');
  assert.ok(Math.abs(committed.height-committed.contentScroll)<=1,'stored height equals measured content height');

  // 3. Drag the east handle: width follows pointer, height re-measures the reflowed text.
  await page.locator(`.node[data-id="${id}"]`).click({position:{x:20,y:10}});
  await page.waitForTimeout(150);
  const before=await geom();
  const handle=await page.evaluate(()=>{const i=document.querySelector('#selection-frame i[data-handle="e"]');const r=i.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  await page.mouse.move(handle.x,handle.y);await page.mouse.down();
  await page.mouse.move(handle.x+260,handle.y+40,{steps:12});await page.mouse.up();
  await page.waitForTimeout(300);
  const widened=await geom();
  step('widened by east handle',widened);
  assert.ok(widened.width>before.width+200,'width grew with the pointer');
  assert.ok(widened.height<before.height,'narrower line count lowers the height');
  assert.ok(widened.verticalOverflow<=1,'no vertical clipping after widening');
  const handle2=await page.evaluate(()=>{const i=document.querySelector('#selection-frame i[data-handle="e"]');const r=i.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  await page.mouse.move(handle2.x,handle2.y);await page.mouse.down();
  await page.mouse.move(handle2.x-200,handle2.y,{steps:12});await page.mouse.up();
  await page.waitForTimeout(300);
  const narrowed=await geom();
  step('narrowed again',narrowed);
  assert.ok(narrowed.height>widened.height,'narrower width raises the height');
  assert.ok(narrowed.verticalOverflow<=1,'no vertical clipping after narrowing');

  // 4. Keep typing while narrowed, then delete most of it: height shrinks too.
  await page.locator(`.node[data-id="${id}"]`).dblclick();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(LONG);
  await page.waitForTimeout(250);
  const more=await geom();
  step('typed more while narrowed',more);
  assert.ok(more.verticalOverflow<=1,'no vertical clipping on continued typing');
  await page.evaluate(()=>{const el=document.querySelector('[contenteditable]');const r=document.createRange();r.selectNodeContents(el);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);});
  await page.keyboard.type('短');
  await page.waitForTimeout(250);
  const shrunk=await geom();
  step('shrunk after deleting',shrunk);
  assert.ok(shrunk.height<more.height,'height follows shrink');
  assert.ok(shrunk.height<=60,'single short line collapses back');

  // 5. Persistence after reload.
  await page.mouse.click(1200,880);
  await page.keyboard.press('Control+S');
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForFunction(()=>window.protaCanvas);
  await page.waitForTimeout(500);
  const reloaded=await geom();
  step('after reload',reloaded);
  assert.ok(reloaded.verticalOverflow<=1,'no clipping after reload');
  assert.ok(Math.abs(reloaded.height-reloaded.contentScroll)<=1,'height matches content after reload');
  assert.equal(errors.length,0,`page errors: ${errors.join(' | ')}`);
  await page.screenshot({path:path.join(evidence,'text-autofit.png')});
  console.log('PASS: text and note auto-height — grows while typing, re-measures on width drag, shrinks on delete, no clipping, survives reload');
  console.log('Screenshot: '+path.join(evidence,'text-autofit.png'));
} finally {
  await browser?.close();
  child?.kill('SIGTERM');
  await fs.rm(temp,{recursive:true,force:true});
}
