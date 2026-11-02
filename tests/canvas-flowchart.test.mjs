import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/templates/infinite-canvas/canvas-domain.js';
import '../src/templates/infinite-canvas/canvas-core.js';
import '../src/templates/infinite-canvas/canvas-connections.js';
const D=globalThis.CanvasDomain,C=globalThis.CanvasCore,R=globalThis.CanvasConnections;
const shape=(flowShape,id='step',x=500)=>({id,type:'rect',flowShape,x,y:0,width:220,height:152,text:'审核通过？'});
const document=nodes=>({schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes,edges:[]});
test('flowchart kinds are validated without changing legacy rectangle documents',()=>{
 for(const kind of ['terminator','process','decision','subprocess','connector'])assert.equal(D.validate(document([shape(kind)])).nodes[0].flowShape,kind);
 for(const invalid of ['diamond','',null,{},['process']])assert.throws(()=>D.validate(document([shape(invalid)])),/流程图/);
 assert.throws(()=>D.validate(document([{...shape('decision'),type:'board'}])),/流程图/);
 const old=shape('process');delete old.flowShape;assert.doesNotThrow(()=>D.validate(document([old])));
});
test('decision ports land on all four vertices and mixed board edges remain orthogonal',()=>{
 const board={id:'board',type:'board',x:0,y:0,width:200,height:400},diamond=shape('decision');
 for(const [side,end] of Object.entries({left:{x:500,y:76},right:{x:720,y:76},top:{x:610,y:0},bottom:{x:610,y:152}})){
  const route=R.routeEdges([board,diamond],[{id:'edge',fromInstanceId:'board',toInstanceId:'step',toPort:side}])[0];
  assert.ok(!route.unroutable);assert.deepEqual(route.points.at(-1),end);
  for(let i=1;i<route.points.length;i++)assert.ok(route.points[i].x===route.points[i-1].x||route.points[i].y===route.points[i-1].y);
 }
});
test('flow shapes remain obstacles when another small object falls inside their bounds',()=>{
 const diamond=shape('decision'),inside={id:'small',type:'note',x:550,y:45,width:40,height:30};
 assert.ok(R.obstacles([diamond,inside]).some(n=>n.id===diamond.id));
 const region={...diamond,id:'region'};delete region.flowShape;
 assert.ok(!R.obstacles([region,inside]).some(n=>n.id===region.id));
});
test('duplicate and merge retain flow kinds and independently remap branch edges',()=>{
 const nodes=[shape('process','a',0),shape('decision','b',500)],edges=[{id:'e',fromInstanceId:'a',toInstanceId:'b',label:'是'}];
 const duplicated=C.duplicate(nodes,['a','b']),branches=C.duplicateEdges(edges,duplicated.mapping);
 assert.deepEqual(duplicated.nodes.map(n=>n.flowShape),['process','decision']);assert.equal(branches[0].toInstanceId,duplicated.mapping.b);
 const base={...document(nodes),edges},local=structuredClone(base),remote=structuredClone(base);
 local.nodes[1].text='校验通过？';remote.edges[0].label='否';
 const merged=C.mergeDocuments(base,local,remote);assert.deepEqual(merged.conflicts,[]);assert.equal(merged.state.nodes[1].flowShape,'decision');assert.equal(merged.state.nodes[1].text,'校验通过？');assert.equal(merged.state.edges[0].label,'否');
});
