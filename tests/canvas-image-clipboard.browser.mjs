import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const app=process.cwd(), temp=await fs.mkdtemp(path.join(os.tmpdir(),'prota-image-clipboard-'));
const root=path.join(temp,'workspace'), dir=path.join(root,'src/pages/demo/design/v1');
const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
let child,browser,logs='';
try {
  await fs.mkdir(dir,{recursive:true});
  await fs.cp(path.join(app,'src/templates/infinite-canvas'),dir,{recursive:true});
  await fs.mkdir(path.join(root,'data'),{recursive:true});
  await fs.writeFile(path.join(root,'workspace.json'),JSON.stringify({id:'image-clipboard',formatVersion:1}));
  await fs.writeFile(path.join(root,'data/projects.json'),JSON.stringify({projects:[{id:'demo',name:'Demo',pages:[{id:'design',name:'Canvas',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']}]}],activeProjectId:'demo',activePageId:'design'}));
  child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(temp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const base=`http://127.0.0.1:${port}`;
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,logs);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=32;c.height=24;const ctx=c.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,16,24);return c.toDataURL();});
  const jpeg=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=48;c.height=20;return c.toDataURL('image/jpeg');});
  await fs.mkdir(path.join(dir,'assets'));
  await fs.writeFile(path.join(dir,'assets/photo.jpg'),Buffer.from(jpeg.split(',')[1],'base64'));
  const nodes=[
    {id:'png',type:'image',name:'PNG',src:png,x:0,y:0,width:320,height:240},
    {id:'jpeg',type:'image',name:'JPEG',locked:true,src:'assets/photo.jpg',x:400,y:0,width:320,height:200},
    {id:'broken',type:'image',name:'Missing',src:'assets/missing.png',x:800,y:0,width:200,height:200},
  ];
  await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify({schemaVersion:1,revision:0,nodes,viewport:{x:100,y:80,zoom:1}})+';');
  // Exercise the real system clipboard from a Portal-style same-origin iframe.
  await page.route(base+'/clipboard-test',route=>route.fulfill({contentType:'text/html',body:'<iframe style="width:1400px;height:900px" src="/src/pages/demo/design/v1/index.html"></iframe>'}));
  await page.goto(base+'/clipboard-test');
  const frame=page.frames().find(f=>f.url().includes('/src/pages/'));
  await frame.waitForFunction(()=>window.protaCanvas);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const state=()=>frame.evaluate(()=>window.protaCanvas.getState());
  const readImage=()=>frame.evaluate(async()=>{
    const items=await navigator.clipboard.read();const blob=await items[0].getType('image/png');
    const image=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
    const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
    return {type:blob.type,width:image.width,height:image.height,pixel:[...ctx.getImageData(image.width-1,0,1,1).data]};
  });
  const original=await state();
  await frame.locator('.node[data-id="png"]').click();
  await page.keyboard.press('Control+Shift+C');
  await frame.waitForFunction(()=>document.querySelector('#notice-text').textContent==='图片已复制到剪贴板');
  assert.deepEqual(await readImage(),{type:'image/png',width:32,height:24,pixel:[0,0,0,0]});
  assert.deepEqual(await state(),original,'clipboard copy preserves document and creates no duplicate');
  assert.equal(await frame.evaluate(()=>window.protaCanvas.isDirty()),false);

  await frame.locator('.node[data-id="jpeg"]').click();
  await frame.locator('#notice-text').evaluate(el=>el.textContent='');
  await frame.locator('[data-action="copy-image"]').click();
  await frame.waitForFunction(()=>document.querySelector('#notice-text').textContent==='图片已复制到剪贴板');
  const converted=await readImage();assert.equal(converted.width,48);assert.equal(converted.height,20);
  assert.equal(converted.type,'image/png');assert.deepEqual(await state(),original);

  // macOS modifier, permission denial, unsupported API, broken source, and input isolation.
  await frame.evaluate(()=>Object.defineProperty(navigator.clipboard,'write',{configurable:true,value:()=>Promise.reject(new DOMException('Denied','NotAllowedError'))}));
  await page.keyboard.press('Meta+Shift+C');
  await frame.waitForFunction(()=>document.querySelector('#notice-text').textContent.startsWith('图片复制失败'));
  assert.deepEqual(await state(),original);
  await frame.evaluate(()=>delete navigator.clipboard.write);
  await frame.locator('.node[data-id="broken"]').click();
  await frame.locator('#notice-text').evaluate(el=>el.textContent='');
  await page.keyboard.press('Control+Shift+C');
  await frame.waitForFunction(()=>document.querySelector('#notice-text').textContent.startsWith('图片复制失败'));
  await frame.evaluate(()=>Object.defineProperty(navigator.clipboard,'write',{configurable:true,value:undefined}));
  await page.keyboard.press('Control+Shift+C');
  await frame.waitForFunction(()=>document.querySelector('#notice-text').textContent.startsWith('当前环境不支持复制图片'));
  await frame.evaluate(()=>{const i=document.createElement('input');document.body.append(i);i.focus();i.id='clipboard-input';document.querySelector('#notice-text').textContent='editing';});
  await page.keyboard.press('Control+Shift+C');
  assert.equal(await frame.locator('#notice-text').textContent(),'editing');
  await frame.locator('#clipboard-input').evaluate(el=>el.remove());
  await frame.locator('.node[data-id="png"]').click();
  await page.keyboard.press('Control+C');
  await frame.waitForFunction(()=>document.querySelector('#notice-text').textContent==='已复制 1 个对象');
  await page.keyboard.press('Control+D');
  assert.equal((await state()).nodes.length,4,'duplicate shortcut still creates a canvas copy');
  assert.deepEqual(errors,[]);
  console.log('PASS: image clipboard from iframe, PNG transparency and native size, local JPEG conversion, both modifiers, failures, editing guard, existing copy and duplicate');
} finally {
  await browser?.close();child?.kill('SIGTERM');await fs.rm(temp,{recursive:true,force:true});
}
