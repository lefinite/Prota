import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const app=process.cwd(), tmp=await fs.mkdtemp(path.join(os.tmpdir(),'prota-pin-')), root=path.join(tmp,'workspace'), dir=path.join(root,'src/pages/demo/flow/v1');
const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
let child,browser,logs='';
try {
  await fs.mkdir(dir,{recursive:true}); await fs.cp(path.join(app,'src/templates/infinite-canvas'),dir,{recursive:true});
  await fs.mkdir(path.join(root,'data')); await fs.writeFile(path.join(root,'workspace.json'),JSON.stringify({id:'pin-test',formatVersion:1}));
  await fs.writeFile(path.join(root,'data/projects.json'),JSON.stringify({projects:[{id:'demo',name:'Demo',pages:[{id:'flow',name:'Flow',targetDevice:'canvas',pageMode:'infinite-canvas',versions:['v1']}]}]}));
  const html=`<!doctype html><html><head><style>body{margin:24px;font:16px sans-serif}button,input{display:block;margin:16px 0;padding:10px}#scroll{height:65px;overflow:auto}#scroll div{height:400px}</style></head><body>
    <h1 id="heading"></h1><button id="next">下一步</button><button id="submit">提交验证码</button><input id="code"><input id="secret" type="password"><details id="details"><summary>说明</summary>详细说明</details><div id="scroll"><div>滚动区域</div></div><p id="error"></p>
    <script>(()=>{let model={step:1,error:false,code:''}; window.submissions=0;
    const render=()=>{document.querySelector('#heading').textContent=model.step===1?'登录':'验证码';document.querySelector('#error').textContent=model.error?'验证码错误':'';document.querySelector('#code').value=model.code;};
    document.querySelector('#next').onclick=()=>{model.step=2;history.replaceState(null,'','#verify');render()};
    document.querySelector('#code').oninput=e=>model.code=e.target.value;
    document.querySelector('#submit').onclick=()=>{window.submissions++;model.error=true;render()};
    window.ProtaBoardState={version:1,capture:()=>structuredClone(model),restore:data=>{model=structuredClone(data);render()}};render();})();</script></body></html>`;
  const auto=`<!doctype html><html><body><h1 id="value"></h1><button id="advance">改变状态</button><script>const state={step:1};function render(){document.querySelector('#value').textContent=state.step}document.querySelector('#advance').onclick=()=>{state.step++;render()};render();</script></body></html>`;
  for (const [id,content] of [['a',html],['b',auto],['c','<!doctype html><html><body><button>内部闭包，无状态契约</button></body></html>']]) {
    await fs.mkdir(path.join(dir,'boards',id),{recursive:true}); await fs.writeFile(path.join(dir,'boards',id,'index.html'),content);
  }
  const board=(id,x)=>({id,type:'board',name:{a:'登录流程',b:'普通 JS',c:'旧画板'}[id],x,y:0,width:360,height:540,src:`boards/${id}/index.html`});
  await fs.writeFile(path.join(dir,'canvas-data.js'),'window.PROTA_CANVAS = '+JSON.stringify({schemaVersion:1,revision:0,nodes:[board('a',0),board('b',500),board('c',1000)],edges:[],viewport:{x:60,y:200,zoom:1}})+';');
  child=spawn('python3',['server/bridge.py'],{cwd:app,env:{...process.env,READIFY_WORKSPACE:root,READIFY_CONFIG_DIR:path.join(tmp,'config'),READIFY_PORT:String(port),PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const base=`http://127.0.0.1:${port}`;
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/workspace')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1500,height:1000}});page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/src/pages/demo/flow/v1/index.html');await page.waitForFunction(()=>window.protaCanvas?.runtimeVersion===37);await page.evaluate(()=>window.protaCanvasSchemaReady);
  const node=id=>page.locator(`.node[data-id="${id}"]`), frame=id=>page.frameLocator(`.node[data-id="${id}"] iframe`), pin=id=>node(id).locator('.board-state-pin');
  const waitRestore=id=>page.waitForFunction(id=>{const el=document.querySelector(`.node[data-id="${id}"]`);return el?.querySelector('iframe')?.contentDocument?.readyState==='complete' && !el.classList.contains('restoring-state')},id);
  const preview=async id=>{await page.evaluate(id=>protaCanvas.focus([id]),id);await page.waitForTimeout(250);await waitRestore(id);await node(id).locator('.node-content').dblclick({position:{x:10,y:10}});};
  await frame('a').locator('#next').waitFor(); await preview('a');
  await frame('a').locator('#next').click();await frame('a').locator('#code').fill('7351');await frame('a').locator('#secret').fill('not-saved');await frame('a').locator('#submit').click();
  await frame('a').locator('summary').click();await frame('a').locator('#scroll').evaluate(el=>el.scrollTop=80);
  await pin('a').click(); await page.waitForFunction(()=>protaCanvas.getState().nodes.find(n=>n.id==='a').pinnedState);await waitRestore('a');
  await page.waitForFunction(()=>!protaCanvas.isDirty());
  assert.equal(await frame('a').locator('#heading').innerText(),'验证码');assert.equal(await frame('a').locator('#error').innerText(),'验证码错误');
  assert.equal(await frame('a').locator('#code').inputValue(),'7351');assert.equal(await frame('a').locator('#secret').inputValue(),'');
  assert.equal(await frame('a').locator('#details').getAttribute('open'),'');assert.equal(await frame('a').locator('#scroll').evaluate(el=>el.scrollTop),80);
  assert.equal(await frame('a').locator('body').evaluate(()=>window.submissions),0);
  assert.equal(await pin('a').getAttribute('aria-pressed'),'true');assert.equal(await pin('a').locator('.button-label').count(),0);
  console.log('PASS unobtrusive pin captures route, app state, forms, details and scroll without replaying submit');
  // Reload with empty storage proves state is on disk rather than browser cache.
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await page.reload();await page.waitForFunction(()=>window.protaCanvas);await waitRestore('a');
  assert.equal(await frame('a').locator('#error').innerText(),'验证码错误');assert.equal(await frame('a').locator('#code').inputValue(),'7351');
  assert.equal(await frame('a').locator('body').evaluate(()=>location.hash),'#verify');
  await preview('a');await frame('a').locator('#code').fill('temporary');await frame('a').locator('#code').press('Escape');await waitRestore('a');
  assert.equal(await frame('a').locator('#code').inputValue(),'7351');
  // Preserve the source baseline while capturing a different state into a new board.
  await preview('a');await frame('a').locator('#code').fill('copy-only');await pin('a').click();
  await page.locator('#context-menu').getByRole('menuitem',{name:'以当前状态复制',exact:true}).click();
  await page.waitForFunction(()=>protaCanvas.getState().nodes.length===4&&!protaCanvas.isDirty());
  const copied=await page.evaluate(()=>protaCanvas.getState().nodes.find(n=>n.id!=='a'&&n.cloneFrom==='boards/a/index.html'));
  await page.evaluate(id=>protaCanvas.focus(['a',id]),copied.id);await waitRestore(copied.id);await waitRestore('a');
  assert.equal(await frame(copied.id).locator('#code').inputValue(),'copy-only');assert.equal(await frame('a').locator('#code').inputValue(),'7351');
  assert.notEqual(copied.src,'boards/a/index.html');await fs.access(path.join(dir,copied.src));
  console.log('PASS durable refresh, Esc reset and independent current-state copy');
  // Update is explicit; undo restores the previous baseline including its UI.
  await preview('a');await frame('a').locator('#code').fill('updated');await pin('a').click();await page.locator('#context-menu').getByRole('menuitem',{name:'更新固定状态',exact:true}).click();
  await page.waitForFunction(()=>protaCanvas.getState().nodes.find(n=>n.id==='a').pinnedState.data.code==='updated'&&!protaCanvas.isDirty());await waitRestore('a');
  await page.getByRole('button',{name:'撤销',exact:true}).click();await waitRestore('a');assert.equal(await frame('a').locator('#code').inputValue(),'7351');
  await pin('a').click();await page.locator('#context-menu').getByRole('menuitem',{name:'取消固定',exact:true}).click();
  assert.equal(await pin('a').getAttribute('aria-pressed'),'false');await page.getByRole('button',{name:'撤销',exact:true}).click();await waitRestore('a');
  console.log('PASS explicit update, unpin and undo restore prior baseline');
  // Legacy global state works; a closed application with no contract fails visibly.
  await page.evaluate(()=>protaCanvas.focus(['b','c']));await page.waitForTimeout(250);await preview('b');await frame('b').locator('#advance').click();await pin('b').click();
  await page.waitForFunction(()=>protaCanvas.getState().nodes.find(n=>n.id==='b').pinnedState);await waitRestore('b');assert.equal(await frame('b').locator('#value').innerText(),'2');
  await pin('c').click();await page.getByRole('button',{name:'适配状态保存',exact:true}).waitFor();assert.match(await page.locator('#notice-text').innerText(),/适配/);
  assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes.find(n=>n.id==='c').pinnedState),undefined);
  // A no-op restore passes on the current page but must fail fresh-load validation.
  await fs.writeFile(path.join(dir,'boards/c/index.html'),auto.replace('render();</script>', 'window.ProtaBoardState={version:1,capture:()=>structuredClone(state),restore:()=>{}};render();</script>'));
  await page.waitForFunction(()=>!protaCanvas.isDirty());await page.evaluate(()=>protaCanvas.refreshBoards(['c']));
  await preview('c');await frame('c').locator('#advance').click();await pin('c').click();
  await page.waitForFunction(()=>document.querySelector('#notice-text').textContent.includes('未能完整恢复'));
  assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes.find(n=>n.id==='c').pinnedState),undefined);
  // A failed round-trip must leave an existing pin intact.
  await preview('b');await frame('b').locator('body').evaluate(()=>window.ProtaBoardState={version:1,capture:()=>({bad:true}),restore:()=>{throw Error('恢复失败')}});
  await pin('b').click();await page.locator('#context-menu').getByRole('menuitem',{name:'更新固定状态',exact:true}).click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>protaCanvas.getState().nodes.find(n=>n.id==='b').pinnedState.data.step),2);
  assert.match(await page.locator('#notice-text').innerText(),/恢复|接口/);
  console.log('PASS legacy adapter, unsupported-state guidance and failure preserves previous pin');
  await page.evaluate(()=>protaCanvas.focus(['a']));await page.waitForTimeout(250);await waitRestore('a');
  if(process.env.CANVAS_SCREENSHOTS)await page.screenshot({path:'/tmp/prota-board-state.png'});
  await page.evaluate(()=>window.postMessage({type:'prota:canvas-config',readOnly:true},location.origin));await page.locator('body.readonly').waitFor();assert.equal(await page.locator('.board-state-pin').count(),0);
  await preview('a');await frame('a').locator('#code').fill('read-only-try');await frame('a').locator('#code').press('Escape');await waitRestore('a');assert.equal(await frame('a').locator('#code').inputValue(),'7351');
  assert.deepEqual(errors,[]);console.log('PASS read-only viewing and transient interaction preserve the pin');
} catch(error) { for(const page of browser?.contexts()[0]?.pages() || []) { console.error(await page.locator('#notice-text').textContent().catch(()=>'')); await page.screenshot({path:'/tmp/prota-pin-failure.png'}).catch(()=>{}); } throw error; } finally {await browser?.close();child?.kill('SIGTERM');await fs.rm(tmp,{recursive:true,force:true});}
