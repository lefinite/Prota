import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrackingManifest } from '../portal/modules/tracking/index.js';

const scope = {projectId:'example',pageId:'login',version:'v2'};
function manifest() {
  return {schemaVersion:1,scope:{...scope,pageMode:'standard'},events:[{
    id:'login_submit',name:'login_submit',title:'提交登录',
    purpose:'衡量登录尝试',question:'用户是否提交',decision:'是否优化登录',
    score:{impact:3,actionability:3,gap:2,cost:1,duplicate:0,total:7},
    priority:'P0',signal:'attempt',trigger:{type:'submit',when:'有效表单提交'},
    parameters:[],targets:[{kind:'page',path:'index.html',
      anchor:{method:'data-attribute',value:'login-submit'},status:'bound',confidence:'high'}]
  }],omitted:[]};
}
test('accepts a valid version-scoped measurement specification',()=>{
  const data=manifest();
  assert.equal(validateTrackingManifest(data,scope),data);
});
test('accepts meaningful zero events',()=>{
  const data=manifest();data.events=[];
  assert.equal(validateTrackingManifest(data,scope),data);
});
test('rejects stale versions',()=>{
  assert.throws(()=>validateTrackingManifest(manifest(),{...scope,version:'v1'}),/不匹配/);
});
test('rejects duplicate ids and overlarge plans',()=>{
  const data=manifest();data.events.push({...data.events[0]});
  assert.throws(()=>validateTrackingManifest(data,scope),/重复/);
  data.events=Array.from({length:13},(_,i)=>({...data.events[0],id:'event_'+i}));
  assert.throws(()=>validateTrackingManifest(data,scope),/格式无效/);
});
test('rejects unsafe iframe paths and ambiguous board identity',()=>{
  const data=manifest();data.events[0].targets[0].path='../index.html';
  assert.throws(()=>validateTrackingManifest(data,scope),/路径无效/);
  data.events[0].targets[0]={kind:'canvas-board',boardId:'a',path:'boards/b/index.html',anchor:{method:'selector',value:'.button'}};
  assert.throws(()=>validateTrackingManifest(data,scope),/路径无效/);
});
