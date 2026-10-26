import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../src/templates/infinite-canvas/canvas-core.js';
const C=globalThis.CanvasCore;
const node=(id,type='rect',parentId=null)=>({id,type,parentId,name:id,x:0,y:0,width:100,height:100});
test('moving a selected container includes descendants exactly once',()=>{
 const nodes=[node('board','board'),node('group','group','board'),node('child','text','group')];
 assert.deepEqual(C.roots(nodes,['board','child']).map(n=>n.id),['board']);
 assert.equal(C.descendants(nodes,['board']).size,3);
 nodes[0].locked=true;assert.equal(C.locked(nodes,nodes[2]),true);
});
test('duplicate remaps hierarchy and makes runnable board source independent',()=>{
 const nodes=[{...node('board','board'),src:'boards/board/index.html'},node('text','text','board')];
 const result=C.duplicate(nodes,['board']);
 assert.equal(result.nodes.length,2);assert.notEqual(result.nodes[0].id,'board');
 assert.equal(result.nodes[1].parentId,result.nodes[0].id);
 assert.equal(result.nodes[0].cloneFrom,'boards/board/index.html');
 assert.notEqual(result.nodes[0].src,nodes[0].src);
 assert.equal(nodes[1].x,0);
});
test('reject cycles, missing containers, and duplicate IDs',()=>{
 const nodes=[node('board','board'),node('group','group','board')];
 assert.throws(()=>C.reparent(nodes,['board'],'group'));
 assert.throws(()=>C.reparent(nodes,['group'],'missing'));
 assert.throws(()=>C.validate({schemaVersion:1,viewport:{x:0,y:0,zoom:1},nodes:[node('a'),node('a')]}));
 nodes[0].parentId='group';assert.throws(()=>C.validate({schemaVersion:1,viewport:{x:0,y:0,zoom:1},nodes}));
});
test('reparent preserves world position and only moves top-level selections',()=>{
 const nodes=[node('a','board'),node('b','board'),node('child','text','a')];
 nodes[0].x=40;C.reparent(nodes,['a','child'],'b');assert.equal(nodes[0].x,40);assert.equal(nodes[2].parentId,'a');
});
