import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import '../src/templates/infinite-canvas/canvas-domain.js';
import '../src/templates/infinite-canvas/canvas-core.js';
import '../src/templates/infinite-canvas/flow-shapes.js';
import '../src/templates/infinite-canvas/canvas-connections.js';
import '../src/templates/infinite-canvas/flow-quick-create.js';
const D=globalThis.CanvasDomain,C=globalThis.CanvasCore,R=globalThis.CanvasConnections,F=globalThis.CanvasFlowShapes,Q=globalThis.CanvasFlowQuickCreate;
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
const pythonValid=cases=>JSON.parse(execFileSync('python3',['-c','import json,sys; from server.canvas_domain import validate_document, FLOW_SHAPES\ndef valid(s):\n try: validate_document(s); return True\n except (ValueError,TypeError): return False\nprint(json.dumps({"kinds":list(FLOW_SHAPES),"valid":[valid(s) for s in json.load(sys.stdin)]}))'],{input:JSON.stringify(cases),env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8'}));
test('the 25 flow shape ids are unique and identical in registry, frontend and backend',()=>{
 assert.equal(F.KINDS.length,25);assert.equal(new Set(F.KINDS).size,25);
 assert.deepEqual([...D.flowShapes],[...F.KINDS]);assert.deepEqual(pythonValid([]).kinds,[...F.KINDS]);
 // The picker shows every flow kind plus the two plain-node presets, each exactly once.
 assert.equal(F.MENU.length,27);assert.equal(new Set(F.MENU).size,27);
 assert.deepEqual(F.MENU.filter(id=>!F.KINDS.includes(id)).sort(),['circle','text']);
 for(const id of F.KINDS)assert.ok(F.MENU.includes(id),id);
});
test('every flow shape and stroke style validates identically in JavaScript and Python',()=>{
 const doc=node=>({schemaVersion:2,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[node],edges:[]});
 const base={id:'n',type:'rect',x:0,y:0,width:200,height:100};
 const cases=[...F.KINDS.map(flowShape=>doc({...base,flowShape})),doc({...base,flowShape:'process',strokeColor:'#1a2B3c',strokeWidth:2}),doc({...base,strokeColor:'#abc',strokeWidth:.5}),doc({...base,strokeWidth:10})];
 const invalid=[doc({...base,flowShape:'circle'}),doc({...base,flowShape:'text'}),doc({...base,type:'ellipse',flowShape:'cloud'}),doc({...base,strokeColor:'red'}),doc({...base,strokeColor:'#12345'}),doc({...base,strokeColor:'#123456\n'}),doc({...base,strokeColor:'url(#x)'}),doc({...base,strokeWidth:.4}),doc({...base,strokeWidth:11}),doc({...base,strokeWidth:true}),doc({...base,strokeWidth:'2'}),doc({...base,strokeColor:7})];
 const js=[...cases,...invalid].map(s=>{try{D.validate(s);return true;}catch{return false;}});
 assert.deepEqual(js,[...cases.map(()=>true),...invalid.map(()=>false)]);
 assert.deepEqual(pythonValid([...cases,...invalid]).valid,js);
});
test('shape outlines are static path data only and every endpoint is finite',()=>{
 for(const id of F.MENU)for(const [w,h] of [[220,100],[24,24],[64,240]]){
  const paths=F.paths(id,w,h);assert.ok(paths.length>=1,id);
  for(const d of paths)assert.match(d,/^M[-\d.\sMLHVAQCZaqclhvz]*$/,id);
  for(const side of ['top','right','bottom','left']){const p=F.endpoint(id,side,w,h);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),id+side);}
 }
});
test('polygon ports land on the real outline where the center rays leave the shape',()=>{
 const onSegment=(p,a,b)=>{const ex=b.x-a.x,ey=b.y-a.y,len=ex*ex+ey*ey,t=Math.max(0,Math.min(1,((p.x-a.x)*ex+(p.y-a.y)*ey)/len));return Math.hypot(a.x+t*ex-p.x,a.y+t*ey-p.y);};
 for(const id of F.KINDS){const outline=F.PRESETS[id].outline;if(!outline)continue;const [w,h]=[200,140],points=outline.map(([x,y])=>({x:x*w,y:y*h}));
  for(const side of ['top','right','bottom','left']){const p=F.endpoint(id,side,w,h);const distance=Math.min(...points.map((a,i)=>onSegment(p,a,points[(i+1)%points.length])));assert.ok(distance<.02,`${id} ${side} ${distance}`);}
 }
 // Diamond, rectangle, capsule and ellipse keep the established bounding-box midpoints.
 for(const id of ['decision','process','terminator','connector','database'])assert.deepEqual(F.endpoint(id,'top',220,152),{x:110,y:0});
 assert.deepEqual(F.endpoint('triangle','top',180,140),{x:90,y:0});assert.ok(F.endpoint('triangle','left',180,140).x>0);
});
test('routes and quick-create dots start from the same outline point',()=>{
 const tri={id:'t',type:'rect',flowShape:'triangle',x:600,y:100,width:180,height:140},box={id:'b',type:'rect',x:0,y:100,width:200,height:140};
 for(const side of ['left','top','bottom','right']){
  const route=R.routeEdges([box,tri],[{id:'e',fromInstanceId:'b',toInstanceId:'t',toPort:side}])[0];assert.ok(!route.unroutable,side);
  const p=F.endpoint('triangle',side,tri.width,tri.height);assert.deepEqual(route.points.at(-1),{x:tri.x+p.x,y:tri.y+p.y});assert.deepEqual(R.outlinePoint(tri,side),route.points.at(-1));
 }
});
const flowDoc=nodes=>({schemaVersion:2,revision:0,viewport:{x:0,y:0,zoom:1},nodes,edges:[]});
test('directional placement is collision free, stable, and never moves existing nodes',()=>{
 const source={id:'s',type:'rect',flowShape:'process',x:0,y:0,width:220,height:88};
 const node=Q.buildNode(source,'process',true);
 const empty=flowDoc([source]),before=structuredClone(empty);
 assert.deepEqual(Q.findPlacement(empty,source,node,'right',null),{x:320,y:0,toPort:'left'});
 assert.deepEqual(Q.findPlacement(empty,source,node,'left',null),{x:-320,y:0,toPort:'right'});
 assert.deepEqual(Q.findPlacement(empty,source,node,'bottom',null),{x:0,y:188,toPort:'top'});
 assert.deepEqual(empty,before,'placement is a pure read');
 // An occupied target slot shifts orthogonally instead of overlapping or pushing the blocker.
 const blocker={id:'x',type:'rect',flowShape:'process',x:320,y:0,width:220,height:88};
 const crowded=flowDoc([source,blocker]),spot=Q.findPlacement(crowded,source,node,'right',null);
 assert.ok(spot&&!(spot.x<blocker.x+blocker.width+24&&spot.x+node.width+24>blocker.x&&spot.y<blocker.y+blocker.height+24&&spot.y+node.height+24>blocker.y));
 assert.deepEqual(crowded.nodes[1],blocker);
 // A background plate that holds the flow is not an obstacle.
 const plate={id:'p',type:'rect',x:-100,y:-100,width:1200,height:600};
 assert.deepEqual(Q.findPlacement(flowDoc([plate,source]),source,node,'right',null),{x:320,y:0,toPort:'left'});
 // A wall of boards leaves no legal slot: nothing is proposed, so nothing is written.
 const wall={id:'w',type:'board',x:240,y:-4000,width:6000,height:8000};
 assert.equal(Q.findPlacement(flowDoc([source,wall]),source,node,'right',null),null);
});
test('a drop point steers placement while keeping the source direction',()=>{
 const source={id:'s',type:'rect',flowShape:'decision',x:0,y:0,width:220,height:152};
 const node=Q.buildNode(source,'database',false),drop={x:700,y:400};
 const spot=Q.findPlacement(flowDoc([source]),source,node,'right',drop);
 assert.deepEqual({x:spot.x,y:spot.y},{x:700,y:400-node.height/2});assert.equal(spot.toPort,'left');
});
test('quick-created nodes copy look and level but never identity, text, or lock',()=>{
 const source={id:'s',type:'rect',flowShape:'decision',name:'审批',text:'金额超限？',x:0,y:0,width:260,height:170,color:'#f2f5ff',strokeColor:'#22252c',strokeWidth:2,fontSize:18,textAlign:'center',textColor:'#123456',locked:true,parentId:'g'};
 const same=Q.buildNode(source,'decision',true);
 assert.notEqual(same.id,source.id);assert.match(same.id,/^n_[a-f0-9]{32}$/);assert.equal(same.text,'');assert.equal(same.locked,undefined);
 assert.deepEqual([same.type,same.flowShape,same.width,same.height,same.color,same.strokeColor,same.strokeWidth,same.fontSize,same.textColor,same.parentId],['rect','decision',260,170,'#f2f5ff','#22252c',2,18,'#123456','g']);
 const other=Q.buildNode(source,'database',false);assert.deepEqual([other.flowShape,other.width,other.height],['database',180,140]);
 const text=Q.buildNode(source,'text',false),circle=Q.buildNode(source,'circle',false);
 assert.deepEqual([text.type,'flowShape' in text,circle.type,'flowShape' in circle],['text',false,'ellipse',false]);
 for(const n of [same,other,text,circle])assert.doesNotThrow(()=>D.validate({schemaVersion:2,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[{id:'g',type:'group',x:0,y:0,width:400,height:400},{...n,x:0,y:0}],edges:[]}));
});
test('edge colors validate identically and stay inside the hex contract',()=>{
 const doc=color=>({schemaVersion:2,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[{id:'a',type:'rect',x:0,y:0,width:200,height:200},{id:'b',type:'rect',x:400,y:0,width:200,height:200}],edges:[{id:'e',fromInstanceId:'a',toInstanceId:'b',kind:'main',...(color==null?{}:{color})}]});
 const cases=[doc(),doc('#8b5cf6'),doc('#ABC'),doc('#000000')];
 const invalid=[doc(''),doc('red'),doc('#12345'),doc('#1234567'),doc('#12345g'),doc('url(#x)'),doc(7),doc(['#fff']),doc('#fff\n')];
 const js=[...cases,...invalid].map(s=>{try{D.validate(s);return true;}catch{return false;}});
 assert.deepEqual(js,[...cases.map(()=>true),...invalid.map(()=>false)]);
 assert.deepEqual(pythonValid([...cases,...invalid]).valid,js);
});
