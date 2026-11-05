import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const app=process.cwd(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'prota-canvas-test-')),root=path.join(temp,'workspace');
const dir=path.join(root,'src/pages/demo/design/v1');
const evidence=process.env.PROTA_CANVAS_EVIDENCE_DIR||temp;await fs.mkdir(evidence,{recursive:true});
const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
let child,browser,logs='';
try {
 await fs.mkdir(dir,{recursive:true});await fs.cp(path.join(app,'src/templates/infinite-canvas'),dir,{recursive:true});
 if(process.env.PROTA_CANVAS_TEST_APP) await fs.copyFile(process.env.PROTA_CANVAS_TEST_APP,path.join(dir,'app.js'));
 await fs.mkdir(path.join(root,'data'),{recursive:true});await fs.writeFile(path.join(root,'workspace.json'),JSON.stringify({id:'canvas-test',formatVersion:1}));
 await fs.writeFile(path.join(root,'data/projects.json'),JSON.stringify({projects:[{id:'demo',name:'Demo',pages:[{id:'design',name:'Canvas',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']}]}],activeProjectId:'demo',activePageId:'design'}));
 child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(temp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 const base=`http://127.0.0.1:${port}`;
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const nodes=[
  {id:'group',type:'group',name:'Container',x:300,y:300,width:550,height:150},
  {id:'a',type:'rect',name:'Target',parentId:'group',x:320,y:320,width:100,height:80},
  {id:'b',type:'rect',name:'Sibling',parentId:'group',x:650,y:320,width:100,height:80},
  {id:'c',type:'board',name:'Other board',x:950,y:320,width:160,height:180}
 ];
 await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify({schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes})+';');
 await page.goto(base+'/src/pages/demo/design/v1/index.html');
 await page.evaluate(()=>window.protaCanvasSchemaReady);
 const node=id=>page.locator(`.node[data-id="${id}"]`);
 const select=async id=>{if(id==='group') { await node('a').click({position:{x:20,y:20}}); await page.keyboard.press('Control+k'); await page.locator('#command-input').fill('选择容器'); await page.locator('#command-input').press('Enter'); } else await node(id).click({position:{x:20,y:20}});await page.locator('#stage').focus();};
 const get=id=>page.evaluate(id=>window.protaCanvas.getState().nodes.find(n=>n.id===id),id);
 await page.evaluate(()=>window.protaCanvas.setPreparing(true,['a']));
 await select('a');const before=await get('a');
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Delete');
 assert.deepEqual(await get('a'),before,'preparing target stays protected');
 await select('c');await page.keyboard.press('ArrowRight');
 assert.equal((await get('c')).x,951,'unrelated board stays editable during preparation');
 await page.evaluate(()=>window.protaCanvas.agentState({active:true,targetIds:['a']}));
 await select('b');await page.keyboard.press('ArrowRight');
 assert.equal((await get('b')).x,651,'sibling remains editable despite shared protected container');
 await select('group');const groupBefore=await get('group');await page.keyboard.press('Delete');
 assert.deepEqual(await get('group'),groupBefore,'cannot delete ancestor of target');
 await select('c');await page.keyboard.press('Delete');
 assert.equal(await get('c'),undefined,'unrelated board can be deleted during Agent work');
 await page.keyboard.press('Control+z');
 assert.ok(await get('c'),'unrelated deletion can be undone');
 assert.deepEqual(await get('a'),before,'undo preserves protected target');
 await page.evaluate(()=>window.protaCanvas.agentState({active:false}));
 await select('a');await page.keyboard.press('ArrowRight');
 assert.equal((await get('a')).x,before.x+1,'target unlocks after Agent finishes');
 await page.evaluate(()=>window.protaCanvas.prepareNavigation());
 assert.deepEqual(errors,[]);
 console.log('PASS: Agent preparation and execution lock only targets/ancestors; siblings and other boards can edit/delete/undo; targets unlock at completion');
}finally{await browser?.close();child?.kill();}
