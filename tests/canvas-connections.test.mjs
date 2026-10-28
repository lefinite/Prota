import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/templates/infinite-canvas/canvas-domain.js';
import '../src/templates/infinite-canvas/canvas-core.js';
import '../src/templates/infinite-canvas/canvas-connections.js';
const R=globalThis.CanvasConnections,C=globalThis.CanvasCore;
const board=(id,x,y,width=200,height=200)=>({id,type:'board',x,y,width,height});
const edge=(id,a,b,label='继续')=>({id,fromInstanceId:a,toInstanceId:b,label,kind:'main'});
function safe(nodes,routes){
 const rects=R.obstacles(nodes);
 for(const r of routes){assert.ok(!r.unroutable,r.id);assert.ok(r.points.length>=2);for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];assert.ok(a.x===b.x||a.y===b.y,'orthogonal segment');for(const box of rects){if(i===1&&box.id===r.edge.fromInstanceId||i===r.points.length-1&&box.id===r.edge.toInstanceId)continue;assert.ok(!R.intersects(a,b,box),`${r.id} crosses ${box.id}`);}}if(r.label)for(const box of rects)assert.ok(!R.overlap(r.label,box),`${r.id} label overlaps ${box.id}`);}
 for(const a of routes)for(const b of routes)if(a.id!==b.id&&a.label)for(let k=1;k<b.points.length;k++)assert.ok(!R.intersects(b.points[k-1],b.points[k],a.label),'label obscures another connection');
 for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)if(routes[i].label&&routes[j].label)assert.ok(!R.overlap(routes[i].label,routes[j].label),'label collision');
}
test('routes avoid boards, note cards and titles; endpoints are automatically chosen',()=>{
 const nodes=[board('a',0,0),board('b',900,0),board('block',350,-150,350,600),{...board('note',700,-230,150,100),type:'note'}];
 const result=R.routeEdges(nodes,[edge('e','a','b')]);safe(nodes,result);assert.ok(result[0].points.length>2);assert.deepEqual(result,R.routeEdges(nodes,[edge('e','a','b')]));
});
test('routing reacts to moved and resized obstacles without saved control points',()=>{
 const nodes=[board('a',0,0),board('b',900,0),board('block',350,-150,250,450)];const first=R.routeEdges(nodes,[edge('e','a','b')]);nodes[2].y=400;nodes[1].x=700;nodes[1].height=350;const next=R.routeEdges(nodes,[edge('e','a','b')]);safe(nodes,next);assert.notDeepEqual(first[0].points,next[0].points);
});
test('multiple branches reserve label space and support containers and negative coordinates',()=>{
 const nodes=[{id:'region',type:'rect',x:-500,y:-700,width:2500,height:2200},board('a',-300,-200),board('b',700,-200),board('c',200,500)];
 const result=R.routeEdges(nodes,[edge('e1','a','b','成功 · 继续登录'),{...edge('e2','a','c','验证码错误 · 返回重试'),kind:'exception'},edge('e3','b','c','忘记密码')]);safe(nodes.filter(n=>n.id!=='region'),result);
});
test('dangling endpoints are retained in data without drawing fictional connections',()=>{const edges=[edge('e','a','missing')];assert.deepEqual(R.routeEdges([board('a',0,0)],edges),[]);assert.equal(edges.length,1);});
test('v1 validation, three-way merge and independent duplication preserve editable edges',()=>{
 const base={schemaVersion:1,revision:0,viewport:{x:0,y:0,zoom:1},nodes:[board('a',0,0),board('b',600,0)],edges:[edge('e','a','b')]};C.validate(base);
 const local=structuredClone(base),remote=structuredClone(base);local.edges[0].label='本机文案';remote.edges[0].kind='exception';const merged=C.mergeDocuments(base,local,remote);assert.equal(merged.state.edges[0].label,'本机文案');assert.equal(merged.state.edges[0].kind,'exception');assert.deepEqual(merged.conflicts,[]);
 const copy=C.duplicate(base.nodes,['a','b']);const edges=C.duplicateEdges(base.edges,copy.mapping);assert.notEqual(edges[0].id,'e');assert.equal(edges[0].fromInstanceId,copy.mapping.a);assert.equal(edges[0].toInstanceId,copy.mapping.b);
 assert.throws(()=>C.validate({...base,edges:[{...base.edges[0],fromPort:'javascript:bad'}]}));
});

test('coincident overlapping endpoints are reported, never connected through an interface',()=>{const nodes=[board('a',0,0),board('b',0,0)];const r=R.routeEdges(nodes,[edge('e','a','b')]);assert.equal(r[0].unroutable,true);assert.deepEqual(r[0].points,[]);});
test('title clearance remains safe across zoom thresholds and long labels wrap inside a narrow gap',()=>{const nodes=[board('a',0,0,390,844),board('b',600,0,390,844)];for(const zoom of [.05,.2,.419,.42,.559,.56,.8,1,2]){const rs=R.routeEdges(nodes,[edge('e','a','b','验证通过 · 未注册手机号自动注册')],{zoom});const boxes=R.obstacles(nodes,zoom);assert.ok(rs[0].label);for(const box of boxes)assert.ok(!R.overlap(rs[0].label,box));assert.ok(!rs[0].label.detached);}});
test('duplication never treats inherited object keys as selected endpoints',()=>{const copied=C.duplicateEdges([edge('e','a','constructor')],{a:'a_copy'});assert.deepEqual(copied,[]);});

test('automatic and fixed-side endpoints are always the exact center of a side',()=>{
 const nodes=[board('a',-100,50,280,360),board('b',800,420,420,260)];
 const midpoints=n=>[{x:n.x,y:n.y+n.height/2},{x:n.x+n.width,y:n.y+n.height/2},{x:n.x+n.width/2,y:n.y},{x:n.x+n.width/2,y:n.y+n.height}];
 const edges=[edge('e0','a','b'),...['left','right','top','bottom'].map((side,i)=>({...edge('e'+(i+1),'a','b'),fromPort:side,toPort:side}))];
 for(const e of edges){const r=R.routeEdges(nodes,[e])[0];assert.ok(!r.unroutable);assert.ok(midpoints(nodes[0]).some(p=>p.x===r.points[0].x&&p.y===r.points[0].y));assert.ok(midpoints(nodes[1]).some(p=>p.x===r.points.at(-1).x&&p.y===r.points.at(-1).y));}
});
