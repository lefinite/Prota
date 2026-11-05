import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const app=process.cwd(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'canvas-runtime-perf-')),processes=[];
let browser;
try{
 const instances=[];
 for(const mode of ['legacy','shared']){
  const root=path.join(temp,mode);
  execFileSync('python3',['-c',`
import sys,json
from pathlib import Path
sys.path.insert(0,'tests')
from test_canvas_runtime_package import make_canvas
root=Path(sys.argv[1]);directory=make_canvas(root,legacy=sys.argv[2]=='legacy')
state={'schemaVersion':1,'revision':0,'nodes':[],'viewport':{'x':30,'y':30,'zoom':0.25}}
for i in range(1000):
 n={'id':'n'+str(i),'type':'board' if i<50 else 'rect','name':'Object '+str(i),'x':(i%40)*180,'y':(i//40)*160,'width':150,'height':130}
 if i<50:n['src']='boards/home/index.html'
 state['nodes'].append(n)
(directory/'canvas-data.js').write_text('window.PROTA_CANVAS = '+json.dumps(state)+';')
(root/'data').mkdir();(root/'workspace.json').write_text(json.dumps({'id':'perf','formatVersion':1}));(root/'data/projects.json').write_text(json.dumps({'projects':[{'id':'demo','pages':[{'id':'a','name':'a','versions':['v1'],'targetDevice':'canvas','pageMode':'infinite-canvas'}]}],'activeProjectId':'demo','activePageId':'a'}))
`,root,mode],{cwd:app});
  const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
  const child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(root,'config'),READIFY_PORT:String(port),PROTA_SHARED_CANVAS_RUNTIME:mode==='legacy'?'0':'1'},stdio:['ignore','pipe','pipe']});let serverLogs='';child.stdout.on('data',d=>serverLogs+=d);child.stderr.on('data',d=>serverLogs+=d);processes.push(child);
  const origin='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,serverLogs);instances.push({mode,url:origin+'/src/pages/demo/a/v1/index.html',readyMs:[],panP95:[],saveMs:[]});
 }
 browser=await chromium.launch({headless:true});
 for(let repeat=0;repeat<3;repeat++)for(const instance of instances){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await page.route('**/api/canvas/features',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({features:{canvasSchemaV2:false,boardRevisions:false}})}));
  const start=performance.now();await page.goto(instance.url);await page.waitForFunction(()=>window.protaCanvas&&document.documentElement.dataset.protaCanvasReady==='true');
  await page.waitForFunction(()=>document.querySelectorAll('.node').length===1000&&document.querySelectorAll('.node iframe').length===50&&[...document.querySelectorAll('.node iframe')].every(f=>f.contentDocument?.readyState==='complete'));
  instance.readyMs.push(Math.round(performance.now()-start));
  instance.panP95.push(await page.evaluate(async()=>{const frames=[];for(let i=0;i<30;i++){const start=performance.now();document.querySelector('#stage').dispatchEvent(new WheelEvent('wheel',{deltaX:11,deltaY:7,bubbles:true}));await new Promise(requestAnimationFrame);frames.push(performance.now()-start);}frames.sort((a,b)=>a-b);return Math.round(frames[Math.floor(frames.length*.95)]*10)/10;}));
  await page.evaluate(()=>protaCanvas.focus(['n50']));await page.waitForTimeout(250);await page.locator('.node[data-id=n50]').click();await page.locator('#selection-tools [data-action=style]').click();
  const saveStart=performance.now();const opacity=page.getByRole('spinbutton',{name:'不透明度',exact:true});await opacity.fill(String(90+repeat));await opacity.press('Tab');await page.waitForFunction(()=>!protaCanvas.isDirty());instance.saveMs.push(Math.round(performance.now()-saveStart));
  await context.close();
 }
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
 const report=instances.map(v=>({mode:v.mode,readyMs:v.readyMs,readyMedianMs:median(v.readyMs),panP95Ms:median(v.panP95),autosaveMedianMs:median(v.saveMs)}));
 assert.ok(report[1].readyMedianMs<report[0].readyMedianMs*1.5+300,'shared startup stays within measured baseline tolerance');assert.ok(report[1].panP95Ms<report[0].panP95Ms+30,'same renderer keeps pan latency comparable');
 console.log(JSON.stringify({nodes:1000,boards:50,repeats:3,results:report},null,2));
}finally{await browser?.close();for(const child of processes)child.kill('SIGTERM');await fs.rm(temp,{recursive:true,force:true});}
