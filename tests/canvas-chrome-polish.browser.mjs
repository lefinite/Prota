import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('src/templates/infinite-canvas');
const fixture={schemaVersion:1,revision:0,nodes:[{id:'sample',type:'rect',flowShape:'process',name:'阅读笔记',x:200,y:150,width:300,height:80,fontSize:24,text:'让想法在画布上展开',textColor:'#424650'}],viewport:{x:0,y:0,zoom:1}};
const server=http.createServer(async(req,res)=>{try {let file=(req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0].slice(1));const data=file==='canvas-data.js'?'window.PROTA_CANVAS = '+JSON.stringify(fixture):await fs.readFile(path.join(root,file));res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1116,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.protaCanvas);
for (const width of [1376,1116,1000,900,800,760,560,390,320]) {
 await page.setViewportSize({width,height:900});await page.waitForTimeout(100);
 const boxes=await page.evaluate(()=>['.creation-tools','.zoom-tools'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,r:r.right,b:r.bottom}}));const [a,b]=boxes;
 assert.ok(a.r<=width+1&&a.x>=-1,`creation in bounds ${width}`);assert.ok(!(a.x<b.r&&a.r>b.x&&a.y<b.b&&a.b>b.y),`no toolbar overlap ${width}`);
 assert.ok(await page.locator('#save-status').isVisible());assert.equal(await page.locator('#document-name').isVisible(),false);
}
await page.setViewportSize({width:1116,height:900});
await page.locator('.node[data-id=sample]').click();await page.locator('#selection-tools [data-action=style]').click();
await page.locator('#property-popover').waitFor({state:'visible'});
await page.screenshot({path:'/tmp/canvas-inspector-before-qa.png'});
assert.equal(await page.locator('#properties select').count(),0,'inspector has no native dropdowns');
assert.equal(await page.locator('#selection-tools .button-label').count(),0,'toolbar uses icons only');
assert.equal(await page.locator('#selection-tools [data-action=duplicate]').count(),0,'duplicate is in more');
const originalShape = await page.evaluate(()=>protaCanvas.getState().nodes[0]);
const inspectorMetrics = () => page.locator('#property-popover').evaluate(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height,el.scrollHeight];});
const shapeMetrics = await inspectorMetrics();
await page.locator('summary[aria-label="形状"]').click();
assert.deepEqual(await inspectorMetrics(),shapeMetrics,'shape dropdown must not resize or extend inspector');
assert.equal(await page.locator('.shape-options [role=option] svg').count(),25);
await page.getByRole('option',{name:'判断',exact:true}).click();
assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes[0].flowShape),'decision');
assert.deepEqual(await page.evaluate(()=>{ const n=protaCanvas.getState().nodes[0];return [n.id,n.x,n.y,n.width,n.height,n.text]; }),[originalShape.id,originalShape.x,originalShape.y,originalShape.width,originalShape.height,originalShape.text]);
await page.locator('summary[aria-label="形状"]').click();await page.locator('#property-popover').screenshot({path:'/tmp/canvas-shape-picker-qa.png'});
await page.locator('summary[aria-label="形状"]').press('Escape');
const dragFont = async (dx, modifier, cancel=false) => {
 const handle=page.locator('.field-fontSize .field-unit'); const box=await handle.boundingBox();
 if(modifier) await page.keyboard.down(modifier);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2,{steps:5});
 if(cancel) await page.keyboard.press('Escape');
 await page.mouse.up(); if(modifier) await page.keyboard.up(modifier);
};
await dragFont(12); assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes[0].fontSize),36,'drag adjusts numeric value');
await page.locator('.field-fontSize input').blur();await page.keyboard.press('Meta+z');assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes[0].fontSize),24,'whole drag undoes in one step');
await dragFont(4,'Shift');assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes[0].fontSize),64,'Shift accelerates');
await dragFont(10,'Alt');assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes[0].fontSize),65,'Alt fine tunes');
await dragFont(10,null,true);assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes[0].fontSize),65,'Escape restores drag start');
await page.locator('summary[aria-label="字重"]').scrollIntoViewIfNeeded();
const weightMetrics=await inspectorMetrics();
await page.locator('summary[aria-label="字重"]').click();
assert.deepEqual(await inspectorMetrics(),weightMetrics,'weight dropdown must not change inspector layout or scroll height');
const weightPopup=page.getByRole('listbox',{name:'字重',exact:true});
assert.equal(await weightPopup.getAttribute('data-placement'),'above','near-bottom dropdown flips above the trigger');
const popupBounds=await weightPopup.boundingBox();assert.ok(popupBounds.y>=8&&popupBounds.y+popupBounds.height<=892,'popup stays within viewport');
await page.screenshot({path:'/tmp/canvas-weight-popup-qa.png'});
await page.locator('summary[aria-label="字重"]').press('Escape');
assert.equal(await page.locator('.inspector-options:popover-open').count(),0,'Escape dismisses popup');
await page.locator('summary[aria-label="字重"]').click();
await page.locator('.field-name input').click();
assert.equal(await page.locator('.inspector-options:popover-open').count(),0,'outside click dismisses popup');
await page.locator('summary[aria-label="字重"]').click();
await page.getByRole('option',{name:'半粗',exact:true}).click();
assert.equal(await page.locator('.inspector-options:popover-open').count(),0,'selection dismisses popup');assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes[0].fontWeight),600);

for (const [label,value,key,expected] of [['不透明度','65','opacity',.65],['字号','28','fontSize',28],['行高','2','lineHeight',2],['字距','1.5','letterSpacing',1.5],['文字颜色 HEX','#123ABC','textColor','#123abc']]) {
 const input=page.getByRole('textbox',{name:label,exact:true}); const field=label.includes('HEX')?input:page.getByRole('spinbutton',{name:label,exact:true});
 await field.fill(value);await field.press('Tab');assert.equal(await page.evaluate(k=>protaCanvas.getState().nodes[0][k],key),expected,label);
}
// Each color has its own alpha; focus retains the shared background and labels align.
for (const [label,key,value] of [['颜色不透明度','fillOpacity','55'],['描边不透明度','strokeOpacity','45'],['文字颜色不透明度','textOpacity','35']]) {
 const field=page.getByRole('spinbutton',{name:label,exact:true});
 await field.fill(value); await field.press('Tab');
 assert.equal(await page.evaluate(k=>protaCanvas.getState().nodes[0][k],key),Number(value)/100);
}
assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes[0].opacity),.65,'color alpha does not change object opacity');
const colorInput=page.getByRole('textbox',{name:'文字颜色 HEX',exact:true});
const surface=page.locator('.field-textColor > .inspector-color-control');
const background=await surface.evaluate(el=>getComputedStyle(el).backgroundColor);
await colorInput.focus(); assert.equal(await surface.evaluate(el=>getComputedStyle(el).backgroundColor),background,'focus retains color background');
const columns=await page.locator('.field-name > .inspector-control,.inspector-special-row > .inspector-choice,.field-color > .inspector-control,.field-textColor > .inspector-control,.property-section .inspector-choice').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().left));
assert.ok(Math.max(...columns)-Math.min(...columns)<1,'full-width controls share a left edge');
await page.waitForFunction(()=>{ const el=document.querySelector('.node[data-id=sample]'); const expected=document.createElement('span'); expected.style.color='color-mix(in srgb, #123abc 35%, transparent)'; return el.style.color === expected.style.color; });
await page.locator('#property-popover').screenshot({path:'/tmp/canvas-colors-refined.png'});
await page.getByRole('button',{name:'居中',exact:true}).click();assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes[0].textAlign),'center');
await page.waitForTimeout(120);assert.equal(await page.getByRole('button',{name:'居中',exact:true}).getAttribute('aria-pressed'),'true'); assert.equal(await page.locator('.node-content').evaluate(e=>getComputedStyle(e).lineHeight),'56px');await page.screenshot({path:'/tmp/canvas-inspector-qa.png'});
await page.getByRole('button',{name:'关闭属性',exact:true}).click();await page.keyboard.press('Meta+z');assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes[0].textAlign || 'left'),'left');
await page.mouse.click(650,100,{button:'right'});assert.equal(await page.locator('.menu-section').evaluate(e=>getComputedStyle(e).textAlign),'left');
const separators = await page.getByRole('separator').evaluateAll(els=>els.map(e=>{ const r=e.getBoundingClientRect(); return {width:r.width,height:r.height}; }));
assert.equal(separators.length,2,'creation, clipboard and view actions have two group separators');
assert.ok(separators.every(r=>r.height>=1&&r.width>=180),'group separators must have visible height and span the menu');
await page.locator('#context-menu').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
await page.screenshot({path:'/tmp/canvas-menu-qa.png'});
assert.deepEqual(errors,[]);console.log('PASS 9 viewport widths; status; grouped inspector; numeric/HEX edits; alignment undo; menu separators; no page errors');
}finally{await browser.close();server.close();}
