import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {flowManifest,flowHtml,doneHtml} from './fixtures/tracking-flow.mjs';
import {validateTrackingManifest,excelSheets} from '../portal/modules/tracking/model.js';
import {trackingWorkbook} from '../portal/modules/tracking/excel.js';
const spec=()=>flowManifest();
test('company keys, camelCase parameters and complete screen inventory are valid',()=>{const m=spec();assert.equal(validateTrackingManifest(m,m.scope),m);});
test('validation rejects malformed keys, duplicate keys, wrong screens and unsafe paths',()=>{
  for(const change of [m=>m.events[0].name+='click',m=>m.events[1].name=m.events[0].name,m=>m.events[0].screenId='missing',m=>m.events[0].targets[0].path='register.html',m=>m.screens[0].path='../outside.html',m=>m.events[0].registrationId='invented',m=>m.screens[0].navigation=[{action:'submit',anchor:{method:'selector',value:'form'}}]]){const m=spec();change(m);assert.throws(()=>validateTrackingManifest(m,m.scope));}
});
test('event budget is per screen, so later screens are not dropped at 12',()=>{
  const m=spec();m.events=[];for(const screen of m.screens.slice(0,2))for(let i=0;i<8;i++){const e=structuredClone(spec().events[0]);e.id=screen.id+'_event_'+i;e.screenId=screen.id;e.element.code='action'+i;e.name=`rdify_ainvest_${screen.code}_form_action${i}`;m.events.push(e);}
  assert.equal(validateTrackingManifest(m,m.scope).events.length,16);
  const e=structuredClone(m.events[0]);e.id='over_budget';e.element.code='extra';e.name='rdify_ainvest_webLogin_form_extra';m.events.push(...Array.from({length:5},(_,i)=>({...e,id:'extra_'+i,name:'rdify_ainvest_webLogin_form_extra'+i,element:{code:'extra'+i,label:'附加动作'}})));
  assert.throws(()=>validateTrackingManifest(m,m.scope),/12/);
});
test('Excel expands every parameter and operation and preserves zero-event screens',()=>{
  const sheets=excelSheets(spec());assert.equal(sheets[0].name,'Web端');assert.equal(sheets[0].rows.length,7);assert.deepEqual(sheets[0].rows[0].slice(0,8),['埋点id','埋点key','埋点中文','支持的操作类型','上报字段名称','字段类型','字段含义','备注']);assert.equal(sheets[0].rows[1][4],'loginMethod');assert.equal(sheets[0].rows[2][4],'retryCount');assert.equal(sheets[1].rows.at(-1)[0],'帮助说明');
});
test('download is a real XLSX with frozen/filterable headers and formula-safe text',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tracking-xlsx-'));
 try{const m=spec();m.events[0].fullName='=HYPERLINK("danger")';const file=path.join(dir,'events.xlsx');await fs.writeFile(file,new Uint8Array(await trackingWorkbook(m).arrayBuffer()));const result=spawnSync('python3',['-c',`import zipfile,sys,xml.etree.ElementTree as E
z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None
for n in z.namelist(): E.fromstring(z.read(n))
r=E.fromstring(z.read('xl/worksheets/sheet1.xml'));ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
assert not r.findall('.//s:f',ns);assert r.find('s:autoFilter',ns) is not None
assert r.find('s:sheetViews/s:sheetView/s:pane',ns).get('state')=='frozen'
assert '=HYPERLINK' in z.read('xl/worksheets/sheet1.xml').decode()
`,file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('skill validator checks full screen files and value scores with company casing',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tracking-validate-')),dir=path.join(root,'src/pages/demo/web/v2');
 try{await fs.mkdir(path.join(dir,'tracking'),{recursive:true});for(const [name,html]of [['index.html',flowHtml],['done.html',doneHtml],['help.html','help']])await fs.writeFile(path.join(dir,name),html);const file=path.join(dir,'tracking/events.json');await fs.writeFile(file,JSON.stringify(spec()));const result=spawnSync(process.execPath,['.claude/skills/demo-event-tracking/scripts/validate.mjs',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const invalidPrefix=spec();invalidPrefix.naming.business={code:'auth',label:'账户与登录'};for(const event of invalidPrefix.events)event.name=event.name.replace('rdify_ainvest_','rdify_auth_');
 await fs.writeFile(file,JSON.stringify(invalidPrefix));const rejected=spawnSync(process.execPath,['.claude/skills/demo-event-tracking/scripts/validate.mjs',file],{encoding:'utf8'});assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/ainvest/);
 const customPage=spec();customPage.screens[0].code='loginPage';customPage.events[0].name='rdify_ainvest_loginPage_form_submitBtn';await fs.writeFile(file,JSON.stringify(customPage));const approved=spawnSync(process.execPath,['.claude/skills/demo-event-tracking/scripts/validate.mjs',file],{encoding:'utf8'});assert.equal(approved.status,0,approved.stderr);
 await fs.writeFile(file,JSON.stringify(spec()));await fs.rm(path.join(dir,'help.html'));const invalid=spawnSync(process.execPath,['.claude/skills/demo-event-tracking/scripts/validate.mjs',file],{encoding:'utf8'});assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/file not found/);}finally{await fs.rm(root,{recursive:true,force:true});}
});

test('mixed app and web boards export into separate company-format sheets',()=>{const m=spec();m.screens[0].platform='app';const sheets=excelSheets(m);assert.deepEqual(sheets.map(s=>s.name),['App端','Web端','页面覆盖']);assert.equal(sheets[0].rows[1][1],m.events[0].name);assert.ok(sheets[1].rows.slice(1).every(row=>row[1]!==m.events[0].name));});
