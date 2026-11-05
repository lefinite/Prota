import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {createShareHandler} from '../server/share_gateway.mjs';
import {createSnapshot} from '../server/preview/snapshot.mjs';
import {previewCacheRoot} from '../server/preview/config.mjs';

const app=process.cwd(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'canvas-shared-browser-'));
const root=path.join(temp,'workspace'),testapp=path.join(temp,'application');
let browser,bridge,gateway;let logs='';
try {
 for(const relative of ['src/templates/infinite-canvas','src/templates/infinite-canvas-document','src/canvas-runtime','portal']) await fs.cp(path.join(app,relative),path.join(testapp,relative),{recursive:true});
 const fixture=JSON.parse(execFileSync('python3',['-c',`
import sys,json,zipfile,io
from pathlib import Path
sys.path.insert(0,'tests')
from test_canvas_runtime_package import make_canvas
from server.bridge import build_page_zip_bytes, build_share_page_html
from server.canvas_runtime_package import pin_share_pages
from server.deployer import VercelDeployer
from server.share_security import create_policy
root=Path(sys.argv[1]);app=Path(sys.argv[2])
for page in ['a','b']: make_canvas(root,page)
make_canvas(root,'legacy',legacy=True)
make_canvas(root,'legacy-preview',legacy=True)
(root/'data').mkdir();(root/'shares').mkdir();(root/'workspace.json').write_text(json.dumps({'id':'shared-test','formatVersion':1}))
(root/'data/settings.json').write_text('{}')
(root/'data/projects.json').write_text(json.dumps({'projects':[{'id':'demo','name':'Demo','pages':[{'id':p,'name':p,'versions':['v1'],'targetDevice':'canvas','pageMode':'infinite-canvas'} for p in ['a','b','legacy','legacy-preview']]}],'activeProjectId':'demo','activePageId':'a'}))
payload={'enabled':True,'shareType':'static','projectId':'demo','pageId':'a','version':'v1','pageMode':'infinite-canvas','targetDevice':'canvas'}
pin_share_pages(root,payload,app)
payload['zipFilename']='a-v1-static.zip'
(root/'shares/a-v1-static.zip').write_bytes(build_page_zip_bytes(root,'demo','a','v1',payload['canvasRuntimeHash'],payload['canvasEntryPath']))
share=root/'shares/a-v1-static.html';share.write_text(build_share_page_html(payload))
(root/'data/share-access.json').write_text(json.dumps({share.name:create_policy({'expiresInDays':0,'password':'test-pass'})}))
deployer=VercelDeployer(root,app);output=root/'build';static=deployer.prepare(output,[share]);content=deployer.prepare_gateway(output,static,[share])
offline=root/'offline'
with zipfile.ZipFile(root/'shares/a-v1-static.zip') as z:z.extractall(offline)
print(json.dumps({'content':str(content),'entry':payload['canvasEntryPath'],'hash':payload['canvasRuntimeHash'],'offline':str(offline/'v1/index.html')}))
`,root,testapp],{cwd:app,encoding:'utf8'}));
 const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 bridge=spawn('python3',['-c',`import runpy,sys;from pathlib import Path;from server import workspace;workspace.APP_ROOT=Path(sys.argv[1]);runpy.run_path('server/bridge.py',run_name='__main__')`,testapp],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(temp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});
 bridge.stdout.on('data',d=>logs+=d);bridge.stderr.on('data',d=>logs+=d);
 const base=`http://127.0.0.1:${port}`;
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),a=await context.newPage(),b=await context.newPage();
 const errors=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
 const wait=p=>p.waitForFunction(()=>protaCanvas?.shellFormat==='shared-v1'&&document.documentElement.dataset.protaCanvasReady==='true');
 for(const [page,id] of [[a,'a'],[b,'b']]){await page.goto(base+`/src/pages/demo/${id}/v1/index.html`);await wait(page);}
 const original=await fs.readFile(path.join(root,'src/pages/demo/a/v1/canvas-data.js'));
 const hash1=await a.evaluate(()=>protaCanvas.runtimeHash);
 const css=path.join(testapp,'src/templates/infinite-canvas/styles.css');await fs.appendFile(css,'\n#selection-tools{--shared-runtime-probe:731;}');
 for(const page of [a,b]){await page.reload();await wait(page);assert.equal(await page.locator('#selection-tools').evaluate(el=>getComputedStyle(el).getPropertyValue('--shared-runtime-probe').trim()),'731');assert.notEqual(await page.evaluate(()=>protaCanvas.runtimeHash),hash1);}
 assert.deepEqual(await fs.readFile(path.join(root,'src/pages/demo/a/v1/canvas-data.js')),original);
 // Legacy entries resolve to the same current runtime without a disk copy.
 await b.goto(base+'/src/pages/demo/legacy/v1/index.html');await wait(b);
 assert.equal(await b.evaluate(()=>window.__protaCanvasLegacyEntry),true);
 assert.equal(await b.locator('#selection-tools').evaluate(el=>getComputedStyle(el).getPropertyValue('--shared-runtime-probe').trim()),'731');
 const res=await fetch(base+'/api/canvas/upgrade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:'demo',pageId:'legacy',version:'v1'})});assert.equal(res.status,200,await res.text());
 // New pages contain the document only.
 const created=await (await fetch(base+'/api/create-page',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:'demo',template:'infinite-canvas'})})).json();assert.equal(created.status,'success');
 const names=await fs.readdir(path.join(root,'src/pages/demo',created.pageId,'v1'));assert.deepEqual(names.sort(),['canvas-data.js','index.html']);
 for(const suffix of ['app.js','styles.css','runtime-manifest.js']){const get=await fetch(base+'/src/pages/demo/a/v1/__prota_runtime/'+suffix);const head=await fetch(get.url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),get.headers.get('content-length'));assert.match(head.headers.get('cache-control'),/no-store/);}
 for(const suffix of ['secret.env','%252e%252e/app.js'])assert.equal((await fetch(base+'/src/pages/demo/a/v1/__prota_runtime/'+suffix)).status,404);
 // Updating the inspector must not reload business iframes or leak their CSS.
 await a.frameLocator('.node[data-id=home] iframe').locator('button').waitFor();
 await a.frameLocator('.node[data-id=home] iframe').locator('body').evaluate(el=>el.dataset.probe='retained');
 await a.locator('.node[data-id=rect]').click();await a.locator('#selection-tools [data-action=style]').click();
 await a.getByRole('textbox',{name:'文字颜色 HEX',exact:true}).fill('223344');await a.getByRole('textbox',{name:'文字颜色 HEX',exact:true}).press('Tab');
 assert.equal(await a.frameLocator('.node[data-id=home] iframe').locator('body').getAttribute('data-probe'),'retained');
 assert.notEqual(await a.locator('#close-properties').evaluate(el=>getComputedStyle(el).color),'rgb(255, 0, 0)');
 await a.waitForFunction(()=>!protaCanvas.isDirty());
 const cache=previewCacheRoot(path.join(temp,'config'),root);
 const snapshot=await createSnapshot({pageRoot:await fs.realpath(path.join(root,'src/pages/demo/a/v1')),cacheRoot:cache,runId:'shared-preview',revision:1,runtimeOrigin:base});
 assert.ok(snapshot.files.has('__prota_runtime/app.js'));
 await b.goto(base+'/__prota_preview/shared-preview/1/index.html');await wait(b);
 await b.frameLocator('.node[data-id=home] iframe').locator('button').waitFor();
 await fs.rm(path.join(cache,'shared-preview'),{recursive:true,force:true});
 await fs.appendFile(path.join(root,'src/pages/demo/legacy-preview/v1/app.js'),';window.__obsoleteRuntime=true;');
 const legacyPreview=await createSnapshot({pageRoot:await fs.realpath(path.join(root,'src/pages/demo/legacy-preview/v1')),cacheRoot:cache,runId:'legacy-preview',revision:1,runtimeOrigin:base});
 assert.ok(legacyPreview.files.has('__prota_runtime/app.js'));assert.equal(legacyPreview.files.has('app.js'),false);
 await b.goto(base+'/__prota_preview/legacy-preview/1/index.html');await wait(b);
 assert.equal(await b.evaluate(()=>window.__obsoleteRuntime),undefined,'legacy preview also uses current product tools');
 await fs.rm(path.join(cache,'legacy-preview'),{recursive:true,force:true});
 // Stop the local product before testing both exported deployment forms.
 bridge.kill('SIGTERM');await new Promise(resolve=>bridge.once('exit',resolve));bridge=null;
 const manifest=JSON.parse(await fs.readFile(path.join(path.dirname(fixture.content),'access.json'),'utf8'));
 gateway=createServer(createShareHandler(manifest,fixture.content,{secureCookies:false}));await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${gateway.address().port}`,runtime='/__prota_runtime/'+fixture.hash+'/boot.js';
 assert.equal((await fetch(origin+runtime)).status,404,'runtime requires the share session');
 const shared=await context.newPage();await shared.goto(origin+'/shares/a-v1-static.html');await shared.locator('input[name=password]').fill('test-pass');await shared.locator('button[type=submit]').click();
 await shared.frameLocator('#mainIframe').locator('#stage').waitFor();
 const canvas=shared.frames().find(f=>f.url().includes('__prota_canvas/'));await canvas.waitForFunction(()=>protaCanvas?.shellFormat==='shared-v1');
 assert.equal(await canvas.evaluate(()=>protaCanvas.runtimeHash),fixture.hash,'published runtime stays pinned after local update');
 await canvas.frameLocator('.node[data-id=home] iframe').locator('button').waitFor();
 const response=await context.request.get(origin+runtime);assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/private.*no-store/);
 const download=await context.request.get(origin+'/shares/a-v1-static.zip');assert.equal(download.status(),200);assert.deepEqual(await download.body(),await fs.readFile(path.join(root,'shares/a-v1-static.zip')));
 // Expiry blocks HTML, runtime, business frames and ZIP under the same protocol.
 const expired=createServer(createShareHandler({shares:manifest.shares.map(p=>({...p,expiresAt:1}))},fixture.content,{secureCookies:false}));await new Promise(r=>expired.listen(0,'127.0.0.1',r));
 assert.equal((await fetch(`http://127.0.0.1:${expired.address().port}/shares/a-v1-static.html`)).status,410);await new Promise(r=>expired.close(r));
 // Actual extracted ZIP, file://, networking disabled. Includes lazy Mermaid rendering.
 const offlineContext=await browser.newContext({offline:true,viewport:{width:1440,height:1000}}),offline=await offlineContext.newPage(),requests=[];
 offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});offline.on('pageerror',e=>errors.push(e.message));
 await offline.goto(pathToFileURL(fixture.offline).href);await wait(offline);
 await offline.frameLocator('.node[data-id=home] iframe').locator('button').waitFor();
 await offline.locator('.node[data-id=home] .node-content').dblclick({position:{x:20,y:20}});await offline.frameLocator('.node[data-id=home] iframe').getByRole('button',{name:'Business action'}).click();assert.equal(await offline.frameLocator('.node[data-id=home] iframe').locator('button').textContent(),'Clicked');
 const diagram=await offline.evaluate(async()=>{const holder=document.createElement('div');holder.append(CanvasMarkdown.render('```mermaid\nflowchart LR\nA-->B\n```'));document.body.append(holder);await CanvasMarkdown.mount(holder);return holder.querySelector('.canvas-mermaid').dataset.state;});assert.equal(diagram,'ready');
 assert.deepEqual(requests,[],'offline editor makes no HTTP requests');assert.deepEqual(errors,[]);
 console.log('PASS shared A/B hot update without version bump; legacy compatibility/migration; lightweight creation; GET/HEAD allowlist; iframe isolation; real prepare+private gateway after product shutdown; pinned hash; password, expiry and ZIP; extracted file:// offline including Mermaid');
} finally {
 await browser?.close();if(bridge){bridge.kill('SIGTERM');}if(gateway)await new Promise(r=>gateway.close(r));await fs.rm(temp,{recursive:true,force:true});
}
