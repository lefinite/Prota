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

test('common selection scaling transforms spacing and size using one origin',()=>{
 const items=[{...node('a'),x:10,y:20,width:100,height:80},{...node('b'),x:210,y:120,width:100,height:80}];
 const base=C.bounds(items);const result=C.resizeSelection(base,items,'se',300,180);
 assert.deepEqual(result.map(({x,y,width,height})=>({x,y,width,height})),[{x:10,y:20,width:200,height:160},{x:410,y:220,width:200,height:160}]);
 assert.equal(items[0].width,100);
});
test('Shift scaling keeps the opposite corner fixed and both axes proportional',()=>{
 const item={...node('a'),x:40,y:60,width:200,height:100};const result=C.resizeSelection(C.bounds([item]),[item],'nw',-100,-10,true)[0];
 assert.equal(result.width/result.height,2);assert.equal(result.x+result.width,240);assert.equal(result.y+result.height,160);
 const side=C.resizeSelection(C.bounds([item]),[item],'e',100,0,true)[0];assert.equal(side.y+side.height/2,110);
});
test('group scaling clamps all members above the minimum without changing their proportions',()=>{
 const items=[{...node('a'),width:20,height:20},{...node('b'),x:100,width:100,height:100}];
 const result=C.resizeSelection(C.bounds(items),items,'se',-1000,-1000,true);
 assert.ok(result.every(n=>n.width>=16&&n.height>=16));assert.equal(result[1].width/result[0].width,5);
});
test('overlay positioning avoids selection titles and floating navigation when space exists',()=>{
 const anchor={x:400,y:300,width:500,height:250};const obstacles=[{x:600,y:900,width:400,height:60}];
 const rect=C.placeOverlay({anchor,width:480,height:44,viewport:{width:1440,height:1000},obstacles});
 assert.equal(rect.placement,'above');assert.ok(rect.y+rect.height<anchor.y-20);
 const top=C.placeOverlay({anchor:{...anchor,y:40},width:480,height:44,viewport:{width:1440,height:1000},obstacles:[{x:0,y:0,width:1440,height:60}]});assert.equal(top.placement,'below');
});
test('three-way restoration keeps independent external additions and edits',()=>{
 const base={schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[{...node('a'),text:'old'},{...node('b'),color:'red'}]};
 const local=C.copy(base);local.nodes[0].text='local';
 const remote=C.copy(base);remote.revision=1;remote.nodes[1].color='blue';remote.nodes.push(node('external'));
 const merged=C.mergeDocuments(base,local,remote);
 assert.equal(merged.state.nodes.find(n=>n.id==='a').text,'local');assert.equal(merged.state.nodes.find(n=>n.id==='b').color,'blue');assert.ok(merged.state.nodes.find(n=>n.id==='external'));assert.equal(merged.state.revision,1);assert.deepEqual(merged.conflicts,[]);
});

test('field-level recovery merges independent changes within the same object',()=>{
 const base={schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[{...node('a'),text:'old',color:'red'}]};
 const local=C.copy(base);local.nodes[0].text='ours';const remote=C.copy(base);remote.nodes[0].color='blue';
 const result=C.mergeDocuments(base,local,remote);assert.equal(result.state.nodes[0].text,'ours');assert.equal(result.state.nodes[0].color,'blue');assert.deepEqual(result.conflicts,[]);
 remote.nodes[0].text='theirs';assert.deepEqual(C.mergeDocuments(base,local,remote).conflicts,['a']);
});
test('floating controls avoid navigation even when selection covers most of a small viewport',()=>{
 const nav={x:120,y:740,width:180,height:42};const rect=C.placeOverlay({anchor:{x:-80,y:250,width:700,height:700},width:280,height:80,viewport:{width:320,height:844},obstacles:[nav,{x:10,y:786,width:300,height:48}]});
 assert.ok(rect.x>=0&&rect.x+rect.width<=320);assert.ok(rect.y+rect.height<=740||rect.x+rect.width<=nav.x);
});
