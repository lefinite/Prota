import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import '../src/templates/infinite-canvas/canvas-domain.js';
import '../src/templates/infinite-canvas/canvas-core.js';

const D=globalThis.CanvasDomain,C=globalThis.CanvasCore;
const pin=()=>({version:1,adapterVersion:1,route:'index.html?tab=login#verify',data:{page:'verify',dialog:false},ui:{x:0,y:100,controls:[{selector:'#code',tag:'input',type:'text',value:'7351',checked:false}],scroll:[]}});
const document=()=>({schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[{id:'a',name:'Login',type:'board',x:0,y:0,width:360,height:600,src:'boards/a/index.html',pinnedState:pin()}]});
test('fixed state validates identically in JS/Python, rejecting malformed payloads and paths',()=>{
  const valid=document(),corpus=[valid];
  for(const change of [
    p=>p.version=2,p=>p.adapterVersion=true,p=>p.route='../other/index.html',p=>p.route='https://example.org/',p=>p.route='/index.html',
    p=>p.route='index.html\\bad',p=>p.ui=null,p=>p.ui.controls=[{}],p=>p.ui.controls[0].type='password',p=>p.data={text:'x'.repeat(262144)},p=>p.ui.scroll=[{selector:'#x',x:'10',y:0}],
    p=>p.data=JSON.parse('{"__proto__":{"bad":true}}')
  ]) {const doc=structuredClone(valid);change(doc.nodes[0].pinnedState);corpus.push(doc);}
  const values=corpus.map(doc=>{try{D.validate(doc);return true}catch{return false}});
  assert.deepEqual(values,[true,...Array(corpus.length-1).fill(false)]);
  const python=spawnSync('python3',['-c',`import sys,json\nfrom server.canvas_domain import validate_document\nresult=[]\nfor item in json.load(sys.stdin):\n try: validate_document(item); result.append(True)\n except ValueError: result.append(False)\nprint(json.dumps(result))`],{input:JSON.stringify(corpus),encoding:'utf8'});
  assert.equal(python.status,0,python.stderr);assert.deepEqual(JSON.parse(python.stdout),values);
});
test('board copies own independent fixed-state data, with instance-relative routes',()=>{
  const doc=document(),result=C.duplicate(doc.nodes,['a']);
  result.nodes[0].pinnedState.data.page='success';
  assert.equal(doc.nodes[0].pinnedState.data.page,'verify');
  assert.equal(result.nodes[0].pinnedState.route,doc.nodes[0].pinnedState.route);
  assert.notEqual(result.nodes[0].src,doc.nodes[0].src);
});
test('concurrent state captures are atomic while unrelated position changes merge',()=>{
  const base=document(),ours=structuredClone(base),theirs=structuredClone(base);
  ours.nodes[0].pinnedState.data.page='success';theirs.nodes[0].pinnedState.data.dialog=true;theirs.nodes[0].x=500;
  const merged=C.mergeDocuments(base,ours,theirs);
  assert.deepEqual(merged.conflicts,['a']);assert.deepEqual(merged.state.nodes[0].pinnedState,ours.nodes[0].pinnedState);assert.equal(merged.state.nodes[0].x,500);
});
