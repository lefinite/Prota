import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {flowManifest,flowHtml,doneHtml} from './fixtures/tracking-flow.mjs';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'tracking-v2-offline-'));
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const canvas of [false,true]){
  const root=path.join(temp,canvas?'canvas':'web'),versionDir=path.join(root,'v1'),boardDir=canvas?path.join(versionDir,'boards/board_a'):versionDir;
  await fs.mkdir(boardDir,{recursive:true});
  await fs.writeFile(path.join(boardDir,'index.html'),flowHtml);
  await fs.writeFile(path.join(boardDir,'done.html'),doneHtml);
  await fs.writeFile(path.join(boardDir,'help.html'),'help');
  if(canvas)await fs.writeFile(path.join(versionDir,'index.html'),'<html><head></head><body><iframe style="width:500px;height:600px" src="boards/board_a/index.html"></iframe></body></html>');
  const m=flowManifest({canvas});m.scope.version='v1';
  const result=spawnSync('python3',['-c',`import sys,json,pathlib
from server.demo_tracking_review import build_review_bundle
root=pathlib.Path(sys.argv[1]);viewer,bridges=build_review_bundle('v1',json.loads(sys.argv[2]));(root/'review.html').write_text(viewer)
for name,code in bridges.items():
 p=root/'v1'/name
 if p.exists():p.write_text(p.read_text().replace('</head>',code+'</head>'))
`,root,JSON.stringify(m)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'review.html')).href);
  await page.locator('.marker[data-id="login_submit"]:not([hidden])').waitFor();
  assert.equal(await page.locator('.item').count(),4);
  assert.equal(await page.locator('.marker[data-id="register_submit"]:not([hidden])').count(),0);
  await page.locator('.item[data-id="register_submit"]').click();
  await page.locator('.marker[data-id="register_submit"]:not([hidden])').waitFor();
  await page.locator('.item[data-id="recovery_submit"]').click();
  await page.locator('.marker[data-id="recovery_submit"]:not([hidden])').waitFor();
  await page.locator('.item[data-id="done_submit"]').click();
  await page.locator('.marker[data-id="done_submit"]:not([hidden])').waitFor();
  const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();assert.match((await downloadPromise).suggestedFilename(),/\.xlsx$/);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Offline v2 screen routes, state navigation, local document destinations, board isolation and XLSX passed');
}finally{await browser?.close();await fs.rm(temp,{recursive:true,force:true});}
