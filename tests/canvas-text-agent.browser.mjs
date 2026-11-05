import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve('src/templates/infinite-canvas');
const source = '前文🙂\n' + '保留原文。'.repeat(240) + '需要改写的部分' + '\n末尾保留。';
const start = source.indexOf('需要改写'), end = start + '需要改写的部分'.length;
const fixture = {schemaVersion:1, revision:0, viewport:{x:0,y:0,zoom:1}, nodes:[
  {id:'text',type:'text',name:'文本',text:source,x:180,y:180,width:500,height:300,fontSize:20},
  {id:'rect',type:'rect',name:'矩形',text:'其他对象',x:800,y:180,width:160,height:100},
  {id:'short',type:'text',name:'短文本',text:'选中的短文本',x:800,y:400,width:300,height:100,fontSize:20}
]};
const server = http.createServer(async (req,res) => {
  const file = req.url.split('?')[0].slice(1) || 'index.html';
  try {
    if (file === 'host') {
      res.setHeader('Content-Type','text/html');
      res.end('<iframe style="width:100%;height:800px" src="/"></iframe><script>window.messages=[];addEventListener("message",e=>messages.push(e.data))</script>');
      return;
    }
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
    res.end(file === 'canvas-data.js' ? 'window.PROTA_CANVAS='+JSON.stringify(fixture) : await fs.readFile(path.join(root,file)));
  } catch { res.writeHead(404);res.end(); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/host`);
  const frame = page.frames().find(frame=>frame.parentFrame());
  await frame.waitForFunction(()=>window.protaCanvas);
  await frame.locator('.node[data-id=text]').click();
  assert.equal(await frame.locator('#selection-tools [data-action=agent]').count(),1);
  const ids=await frame.locator('#selection-tools button').evaluateAll(buttons=>buttons.map(button=>button.dataset.action));
  assert.deepEqual(ids.slice(-2),['agent','more']);
  await frame.locator('.node[data-id=text]').dblclick();
  const editor=frame.locator('textarea.node-content');
  await editor.waitFor();
  await editor.evaluate((el,{start,end})=>el.setSelectionRange(start,end),{start,end});
  await editor.dispatchEvent('contextmenu',{clientX:420,clientY:320,button:2,bubbles:true});
  assert.equal(await frame.locator('.node[data-id=text].editing textarea').count(),1,'right click keeps editing active');
  assert.equal(await frame.locator('#selection-tools').isVisible(),false,'no floating object toolbar while editing');
  assert.equal(await frame.locator('.markdown-inline-tools').count(),0,'plain text has no new floating toolbar');
  assert.deepEqual(await editor.evaluate(el=>[el.selectionStart,el.selectionEnd]),[start,end]);
  assert.equal(await frame.locator('#context-menu [data-action=text-agent]').isVisible(),true);
  assert.equal(await editor.evaluate(el=>document.activeElement===el),true,'opening right-click menu retains active selection highlight');
  await frame.locator('#context-menu [data-action=text-agent]').hover();
  assert.equal(await editor.evaluate(el=>document.activeElement===el),true,'hovering menu keeps textarea focused');
  await frame.locator('#context-menu').press('Escape');
  assert.equal(await editor.evaluate(el=>document.activeElement===el),true,'Escape returns focus to editor');
  assert.deepEqual(await editor.evaluate(el=>[el.selectionStart,el.selectionEnd]),[start,end]);
  await editor.dispatchEvent('contextmenu',{clientX:420,clientY:320,button:2,bubbles:true});
  const agentItem=frame.locator('#context-menu [data-action=text-agent]');
  await agentItem.hover();
  await page.mouse.down();
  assert.equal(await editor.evaluate(el=>document.activeElement===el),true,'pressing menu action keeps active selection until activation');
  assert.deepEqual(await editor.evaluate(el=>[el.selectionStart,el.selectionEnd]),[start,end]);
  await page.mouse.up();
  await page.waitForFunction(()=>messages.some(message=>message.type==='prota:canvas-open-agent'));
  const selection=await page.evaluate(()=>messages.filter(message=>message.type==='prota:canvas-selection').at(-1).selected);
  assert.deepEqual(selection[0].textSelection,{start,end,text:source.slice(start,end)},'Agent receives exact source offsets beyond truncated object preview');
  assert.equal((await frame.evaluate(()=>protaCanvas.getState())).nodes[0].text,source,'opening Agent preserves text');
  // Ordinary object selection clears the previous fragment scope.
  await frame.locator('.node[data-id=rect]').click();
  await frame.locator('.node[data-id=text]').click();
  await frame.locator('#selection-tools [data-action=agent]').click();
  await page.waitForFunction(()=>messages.filter(message=>message.type==='prota:canvas-open-agent').length===2);
  assert.equal(await page.evaluate(()=>messages.filter(message=>message.type==='prota:canvas-selection').at(-1).selected[0].textSelection),undefined);
  await frame.locator('.node[data-id=short]').dblclick();
  await editor.evaluate(el=>el.select());
  await editor.click({button:'right',position:{x:30,y:12}});
  assert.equal(await frame.locator('#context-menu[data-text-editing]').isVisible(),true,'native mouse right-click opens text menu');
  assert.equal(await frame.locator('.node[data-id=short].editing textarea').count(),1);
  assert.equal(await editor.evaluate(el=>document.activeElement===el),true,'native right-click keeps active selection highlight');
  assert.deepEqual(await editor.evaluate(el=>[el.selectionStart,el.selectionEnd]),[0,'选中的短文本'.length]);
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await frame.locator('#context-menu [data-action=text-copy]').click();
  await page.waitForFunction(()=>navigator.clipboard.readText().then(text=>text==='选中的短文本'));
  assert.equal(await editor.evaluate(el=>document.activeElement===el),true,'copy restores editor focus');
  await editor.click({button:'right',position:{x:30,y:12}});
  await frame.locator('#context-menu [data-action=text-cut]').click();
  await frame.waitForFunction(()=>document.querySelector('textarea.node-content')?.value==='');
  await editor.click({button:'right',position:{x:30,y:12}});
  await frame.locator('#context-menu [data-action=text-paste]').click();
  await frame.waitForFunction(()=>document.querySelector('textarea.node-content')?.value==='选中的短文本');
  assert.equal(await frame.locator('.node[data-id=short].editing textarea').count(),1,'clipboard operations keep editor active');
  assert.deepEqual(errors,[]);
  console.log('PASS: text context menu preserves editing/selection; Escape restores editor; Prota sends exact partial-text scope and clears stale scope.');
} finally { await browser.close();server.close(); }
