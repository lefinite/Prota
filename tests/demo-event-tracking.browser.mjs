import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const app=process.cwd();
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'prota-tracking-offline-'));
let browser;
const makeBundle=async({canvas=false}={})=>{
  const dir=path.join(temp,canvas?'canvas':'page');
  const version='v1',versionDir=path.join(dir,version);
  await fs.mkdir(versionDir,{recursive:true});
  const board='boards/board-a/index.html';
  const targetPath=canvas?board:'index.html';
  const event={id:'submit_attempt',name:'submit_attempt',title:'提交',
    purpose:'验证转化',decision:'优化转化',
    trigger:{type:'click',when:'点击提交'},
    targets:[{kind:canvas?'canvas-board':'page',boardId:canvas?'board-a':undefined,
      path:targetPath,status:'bound',
      anchor:{method:'data-attribute',value:'submit'}}]};
  const manifest={schemaVersion:1,events:[event]};
  const python=`import sys,json,pathlib
from server.demo_tracking_review import build_review_bundle
base=pathlib.Path(sys.argv[1]); manifest=json.loads(sys.argv[2])
viewer,bridges=build_review_bundle('v1',manifest)
(base/'review.html').write_text(viewer,encoding='utf-8')
for name,code in bridges.items():
  file=base/'v1'/name
  file.parent.mkdir(parents=True,exist_ok=True)
  if file.exists():
    text=file.read_text(encoding='utf-8')
    file.write_text(text.replace('</head>',code+'</head>'),encoding='utf-8')
`;
  const html='<!doctype html><html><head><meta charset="utf-8"></head><body><button data-prota-track-id="submit" onclick="window.activations=(window.activations||0)+1">提交</button></body></html>';
  if(canvas) {
    await fs.mkdir(path.join(versionDir,'boards/board-a'),{recursive:true});
    await fs.writeFile(path.join(versionDir,board),html);
    await fs.writeFile(path.join(versionDir,'index.html'),'<!doctype html><html><head><meta charset="utf-8"></head><body><iframe style="width:300px;height:200px" src="boards/board-a/index.html"></iframe></body></html>');
  } else await fs.writeFile(path.join(versionDir,'index.html'),html);
  const result=spawnSync('python3',['-c',python,dir,JSON.stringify(manifest)],{cwd:app,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  return pathToFileURL(path.join(dir,'review.html')).href;
};
try {
  browser=await chromium.launch({headless:true});
  for(const canvas of [false,true]){
    const page=await browser.newPage();
    const url=await makeBundle({canvas});
    await page.goto(url);
    await page.waitForSelector('.marker:not([hidden])',{timeout:15000});
    assert.equal(await page.locator('.item').count(),1);
    await page.locator('.marker').click();
    assert.equal(await page.locator('.item.active').count(),1);
    const target=canvas?page.frameLocator('#demo').frameLocator('iframe').locator('[data-prota-track-id="submit"]'):
      page.frameLocator('#demo').locator('[data-prota-track-id="submit"]');
    await target.click();
    assert.equal(await target.evaluate(el=>el.ownerDocument.defaultView.activations||0),0,'inspection should not execute a tracked action');
    await page.locator('#mode').click();
    await target.click();
    assert.equal(await target.evaluate(el=>el.ownerDocument.defaultView.activations||0),1,'preview mode should restore business actions');
    await page.close();
  }
  console.log('Offline ZIP viewer passed page + nested iframe review, selection, and preview-mode isolation');
} finally {
  await browser?.close();
  await fs.rm(temp,{recursive:true,force:true});
}
