import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('src/templates/infinite-canvas');
const fixture={schemaVersion:1,revision:0,nodes:[{id:'sample',type:'rect',flowShape:'process',name:'阅读笔记',x:200,y:150,width:300,height:80,fontSize:24,text:'让想法在画布上展开',textColor:'#424650'}],viewport:{x:0,y:0,zoom:1}};
const server=http.createServer(async(req,res)=>{try {let file=(req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0].slice(1));const data=file==='canvas-data.js'?'window.PROTA_CANVAS = '+JSON.stringify(fixture):file==='boards/board/index.html'?'<html><body><button>预览交互</button></body></html>':await fs.readFile(path.join(root,file));res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});const errors=[];
try {
// Exercise the actual double-click activation path with a full-size web board.
const originalNodes = fixture.nodes;
fixture.nodes = [{id:'board',type:'board',name:'Web 画板',src:'boards/board/index.html',x:0,y:0,width:1440,height:900}];
const boardPage = await browser.newPage();
boardPage.on('pageerror',e=>errors.push(e.message));
try {
 for (const [width,height] of [[1376,900],[1116,768],[800,600],[560,700],[390,844],[760,400]]) {
  await boardPage.setViewportSize({width,height});
  await boardPage.goto('http://127.0.0.1:'+server.address().port);
  await boardPage.waitForFunction(()=>window.protaCanvas);
  const board=boardPage.locator('.node[data-id=board]');
  await board.dblclick();
  await boardPage.waitForTimeout(280);
  assert.ok(await board.evaluate(el=>el.classList.contains('interacting')),'double click activates board');
  const metrics=await boardPage.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
   return {hint:rect('#interaction-hint'),board:rect('.node[data-id=board]'),rails:['.creation-tools','.right-tools'].map(s=>({ ...rect(s),direction:getComputedStyle(document.querySelector(s)).flexDirection}))};
  });
  for (const r of metrics.rails) {
   assert.equal(r.direction,'column');
   assert.ok(r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height,`rail in viewport ${width}×${height}`);
   const b=metrics.board;
   assert.ok(!(b.x<r.right&&b.right>r.x&&b.y<r.bottom&&b.bottom>r.y),`activated board clears rail ${width}×${height}`);
  }
  assert.equal(metrics.rails[1].right-metrics.rails[1].x,metrics.rails[0].right-metrics.rails[0].x,'both rails share the same narrow width');
  assert.ok(metrics.rails[1].right-metrics.rails[1].x<=50,'right rail stays compact');
  assert.ok(metrics.hint.y>=metrics.board.bottom,'interaction hint stays below the board');
  assert.ok(metrics.board.y>=40&&metrics.board.bottom<=height-40,'board has vertical breathing room');
  if(width===1116) await boardPage.screenshot({path:'/tmp/canvas-vertical-toolbars-qa.png'});
  await boardPage.keyboard.press('Escape');
  assert.equal(await board.evaluate(el=>el.classList.contains('interacting')),false);
  
  await boardPage.locator('#add-board').click();
  const menu=await boardPage.locator('#context-menu').boundingBox();
  const creation=await boardPage.locator('.creation-tools').boundingBox();
  assert.ok(menu.x>=creation.x+creation.width,'creation menu opens beside the rail');
  assert.ok(menu.y>=0&&menu.y+menu.height<=height,'creation menu stays in viewport');
  await boardPage.keyboard.press('Escape');
 }
} finally { fixture.nodes=originalNodes; await boardPage.close(); }
assert.deepEqual(errors,[]);console.log('PASS vertical toolbars and double-click activation across 6 viewport sizes');
}finally{await browser.close();server.close();}
