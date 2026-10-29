/* Native canvas connections: deterministic orthogonal routing + editor integration. */
(function(root) {
  'use strict';
  const sides=['right','left','bottom','top'];
  const overlap=(a,b)=>a.x<b.x+b.width-.01&&a.x+a.width>b.x+.01&&a.y<b.y+b.height-.01&&a.y+a.height>b.y+.01;
  const inside=(p,r)=>p.x>r.x+.01&&p.x<r.x+r.width-.01&&p.y>r.y+.01&&p.y<r.y+r.height-.01;
  function intersects(a,b,r){
    if(Math.abs(a.x-b.x)<.01)return a.x>r.x+.01&&a.x<r.x+r.width-.01&&Math.max(a.y,b.y)>r.y+.01&&Math.min(a.y,b.y)<r.y+r.height-.01;
    return a.y>r.y+.01&&a.y<r.y+r.height-.01&&Math.max(a.x,b.x)>r.x+.01&&Math.min(a.x,b.x)<r.x+r.width-.01;
  }
  const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  function simplify(points){const out=[];for(const p of points){if(out.length&&distance(out.at(-1),p)<.01)continue;while(out.length>1){const a=out.at(-2),b=out.at(-1);if((a.x===b.x&&b.x===p.x)||(a.y===b.y&&b.y===p.y))out.pop();else break;}out.push(p);}return out;}
  // Move a whole orthogonal segment; terminal segments gain short doglegs so anchors stay put.
  function moveSegment(points,index,value){
    const a=points[index],b=points[index+1],horizontal=a.y===b.y,axis=horizontal?'y':'x',along=horizontal?'x':'y';
    const moved=p=>({...p,[axis]:value}),start=index===0,end=index===points.length-2;
    const stub=(p,q)=>({...p,[along]:p[along]+Math.sign(q[along]-p[along])*Math.min(24,Math.abs(q[along]-p[along])/3)});
    const left=start?[a,stub(a,b),moved(stub(a,b))]:[...points.slice(0,index),moved(a)];
    const right=end?[moved(stub(b,a)),stub(b,a),b]:[moved(b),...points.slice(index+2)];
    return simplify([...left,...right]);
  }
  function attachManual(points,from,to){
    const first=points[0],last=points.at(-1),dx=from.x-first.x,dy=from.y-first.y;
    if(Math.abs(to.x-last.x-dx)<.01&&Math.abs(to.y-last.y-dy)<.01)return points.map(p=>({x:p.x+dx,y:p.y+dy}));
    if(points.length===2){const horizontal=first.y===last.y;return simplify(horizontal?[from,{x:(from.x+to.x)/2,y:from.y},{x:(from.x+to.x)/2,y:to.y},to]:[from,{x:from.x,y:(from.y+to.y)/2},{x:to.x,y:(from.y+to.y)/2},to]);}
    const next=points.map(p=>({...p}));next[0]=from;next[next.length-1]=to;
    next[1][first.x===points[1].x?'x':'y']=from[first.x===points[1].x?'x':'y'];
    next[next.length-2][last.x===points.at(-2).x?'x':'y']=to[last.x===points.at(-2).x?'x':'y'];
    return simplify(next);
  }
  class Heap{
    constructor(){this.a=[];}
    push(v){const a=this.a;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}
    pop(){const a=this.a,first=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].f<a[j].f)j++;if(a[j].f>=v.f)break;a[i]=a[j];i=j;}a[i]=v;}return first;}
  }
  function obstacles(nodes,zoom=1){
    const visible=nodes.filter(n=>!n.hidden&&n.type!=='group');
    return visible.filter(n=>!(n.type==='rect'&&visible.some(o=>o.id!==n.id&&o.x>=n.x&&o.y>=n.y&&o.x+o.width<=n.x+n.width&&o.y+o.height<=n.y+n.height))).map(n=>{
      const top=n.type==='board'?Math.max(44,Math.ceil(28/zoom/10)*10+8):0,pad=24;
      return {id:n.id,x:n.x-pad,y:n.y-top-pad,width:n.width+2*pad,height:n.height+top+2*pad};
    });
  }
  function ports(n,box,side){
    return (side&&sides.includes(side)?[side]:sides).map((s,index)=>{
      const horizontal=s==='left'||s==='right';
      const p=s==='left'?{x:n.x,y:n.y+n.height/2}:s==='right'?{x:n.x+n.width,y:n.y+n.height/2}:s==='bottom'?{x:n.x+n.width/2,y:n.y+n.height}:{x:n.x+n.width/2,y:n.y};
      const q=s==='left'?{x:box.x,y:p.y}:s==='right'?{x:box.x+box.width,y:p.y}:s==='bottom'?{x:p.x,y:box.y+box.height}:{x:p.x,y:box.y};
      return {p,q,side:s,dir:horizontal?1:2,cost:distance(p,q)+(s==='top'?32:0)+index*.01};
    });
  }
  function search(from,to,rects,prior=[]){
    const valid=(port,own)=>!rects.some(r=>r.id!==own&&intersects(port.p,port.q,r));
    from=from.filter(p=>valid(p,p.owner));to=to.filter(p=>valid(p,p.owner));if(!from.length||!to.length)return null;
    const xs=[...new Set([...rects.flatMap(r=>[r.x,r.x+r.width]),...from.map(p=>p.q.x),...to.map(p=>p.q.x)])].sort((a,b)=>a-b);
    const ys=[...new Set([...rects.flatMap(r=>[r.y,r.y+r.height]),...from.map(p=>p.q.y),...to.map(p=>p.q.y)])].sort((a,b)=>a-b);
    xs.unshift(xs[0]-100);xs.push(xs.at(-1)+100);ys.unshift(ys[0]-100);ys.push(ys.at(-1)+100);
    const width=xs.length,heap=new Heap(),best=new Map(),records=new Map(),free=new Map(),clear=new Map();
    const coordinate=(x,y)=>({x:xs[x],y:ys[y]});const key=(x,y,d)=>(y*width+x)*3+d;
    const heuristic=p=>Math.min(...to.map(t=>distance(p,t.q)+distance(t.q,t.p)));
    const targets=new Map();to.forEach(t=>{const k=ys.indexOf(t.q.y)*width+xs.indexOf(t.q.x);if(!targets.has(k))targets.set(k,[]);targets.get(k).push(t);});
    for(const port of from){const x=xs.indexOf(port.q.x),y=ys.indexOf(port.q.y),k=key(x,y,port.dir);const rec={x,y,dir:port.dir,g:port.cost,f:port.cost+heuristic(port.q),k,port};best.set(k,rec.g);records.set(k,rec);heap.push(rec);}
    let winner=null,winnerCost=Infinity,steps=0;
    while(heap.a.length&&steps++<180000){
      const v=heap.pop();if(v.g!==best.get(v.k))continue;if(v.f>=winnerCost)break;
      const p=coordinate(v.x,v.y),ends=targets.get(v.y*width+v.x);
      if(ends)for(const end of ends){const cost=v.g+end.cost+(v.dir!==end.dir?35:0);if(cost<winnerCost){winnerCost=cost;winner={v,end};}}
      for(const [dx,dy,dir]of [[-1,0,1],[1,0,1],[0,-1,2],[0,1,2]]){
        const x=v.x+dx,y=v.y+dy;if(x<0||y<0||x>=xs.length||y>=ys.length)continue;
        const q=coordinate(x,y),pk=y*width+x;if(!free.has(pk))free.set(pk,!rects.some(r=>inside(q,r)));if(!free.get(pk))continue;
        const segment=[v.y*width+v.x,pk].sort((a,b)=>a-b).join(':');if(!clear.has(segment))clear.set(segment,!rects.some(r=>intersects(p,q,r)));if(!clear.get(segment))continue;
        let penalty=0;for(const line of prior){for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];if(dir===1&&a.y===b.y&&a.y===p.y){const shared=Math.max(0,Math.min(Math.max(p.x,q.x),Math.max(a.x,b.x))-Math.max(Math.min(p.x,q.x),Math.min(a.x,b.x)));if(shared)penalty+=20+shared*.2;}else if(dir===2&&a.x===b.x&&a.x===p.x){const shared=Math.max(0,Math.min(Math.max(p.y,q.y),Math.max(a.y,b.y))-Math.max(Math.min(p.y,q.y),Math.min(a.y,b.y)));if(shared)penalty+=20+shared*.2;}else if(dir===1&&a.x===b.x&&a.x>Math.min(p.x,q.x)&&a.x<Math.max(p.x,q.x)&&p.y>Math.min(a.y,b.y)&&p.y<Math.max(a.y,b.y))penalty+=48;else if(dir===2&&a.y===b.y&&a.y>Math.min(p.y,q.y)&&a.y<Math.max(p.y,q.y)&&p.x>Math.min(a.x,b.x)&&p.x<Math.max(a.x,b.x))penalty+=48;}}
        const g=v.g+distance(p,q)+(dir!==v.dir?35:0)+penalty,k=key(x,y,dir);if(g>=(best.get(k)??Infinity))continue;const next={x,y,dir,g,f:g+heuristic(q),k,previous:v.k};best.set(k,g);records.set(k,next);heap.push(next);
      }
    }
    if(!winner)return null;const path=[];let v=winner.v;while(v){path.push(coordinate(v.x,v.y));if(v.port){path.push(v.port.p);break;}v=records.get(v.previous);}path.reverse();path.push(winner.end.p);return simplify(path);
  }
  function labelFor(edge,path,rects,used,font,prior=[]){
    const text=String(edge.label||'');if(!text)return null;
    const horizontal=path.slice(1).map((p,i)=>p.y===path[i].y?Math.abs(p.x-path[i].x):0);const available=Math.max(...horizontal);const max=available>0?Math.max(4,Math.min(12,Math.floor((available-88)/font))):12,lines=[];let line='';for(const char of text){if(char==='\n'||line.length>=max){lines.push(line);line='';}if(char!=='\n')line+=char;}if(line)lines.push(line);
    const width=Math.max(...lines.map(s=>[...s].reduce((n,c)=>n+(/[\x00-\xff]/.test(c)?.6:1),0)))*font+24,height=lines.length*(font+5)+16;
    const candidates=[];
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],horizontal=a.y===b.y;
      for(const t of [.5,.3,.7])for(const offset of [0,1,-1,2,-2]){
        const x=a.x+(b.x-a.x)*t+(horizontal?0:offset*(width/2+16)),y=a.y+(b.y-a.y)*t+(horizontal?offset*(height/2+12):0);
        candidates.push({x:x-width/2,y:y-height/2,width,height,lines,font,score:Math.abs(offset)*60+Math.abs(t-.5)*20+((horizontal?width:height)>distance(a,b)?90:0)});
      }
    }
    candidates.sort((a,b)=>a.score-b.score);
    const blocked=r=>rects.some(o=>overlap(r,o))||prior.some(line=>line.slice(1).some((p,i)=>intersects(line[i],p,r)))||used.some(o=>overlap(r,{x:o.x-12,y:o.y-12,width:o.width+24,height:o.height+24}));
    let label=candidates.find(c=>!blocked(c));
    if(!label){const center=path[Math.floor(path.length/2)];for(let radius=100;!label&&radius<=1600;radius+=100)for(const [dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){const r={x:center.x+dx*radius-width/2,y:center.y+dy*radius-height/2,width,height,lines,font,detached:true};if(!blocked(r)){label=r;break;}}}
    return label||null;
  }
  function routeEdges(nodes,edges,options={}){
    if(!edges?.length)return [];
    const map=new Map(nodes.map(n=>[n.id,n])),rects=obstacles(nodes,options.zoom||1),byId=new Map(rects.map(r=>[r.id,r])),result=[],prior=[],labels=[];
    for(const edge of edges||[]){
      const a=map.get(edge.fromInstanceId),b=map.get(edge.toInstanceId);if(!a||!b||a.hidden||b.hidden||a.id===b.id)continue;
      const ab=byId.get(a.id)||{x:a.x-24,y:a.y-24,width:a.width+48,height:a.height+48},bb=byId.get(b.id)||{x:b.x-24,y:b.y-24,width:b.width+48,height:b.height+48};
      const anchorA=edge.fromAnchor?options.resolveAnchor?.(a,edge.fromAnchor):a,anchorB=edge.toAnchor?options.resolveAnchor?.(b,edge.toAnchor):b;
      if(!anchorA||!anchorB)continue;
      const from=ports(anchorA,ab,edge.fromPort).map(p=>({...p,owner:a.id})),to=ports(anchorB,bb,edge.toPort).map(p=>({...p,owner:b.id}));
      const avoid=rects.concat(labels.map((r,i)=>({id:'label-'+i,x:r.x-12,y:r.y-12,width:r.width+24,height:r.height+24})));
      const points=edge.manualRoute?.length?attachManual(edge.manualRoute,from[0].p,to[0].p):search(from,to,avoid,prior);
      if(!points){result.push({id:edge.id,edge,points:[],label:null,unroutable:true});continue;}
      const label=labelFor(edge,points,rects,labels,edge.fontSize||20,prior);if(label)labels.push(label);prior.push(points);result.push({id:edge.id,edge,points,label});
    }
    return result;
  }
  root.CanvasConnections={routeEdges,obstacles,intersects,overlap,moveSegment,attachManual};
})(globalThis);
(function(root){
  'use strict';
  root.CanvasConnections.editorVersion=6;
  root.CanvasConnections.install=function(host){
    const NS='http://www.w3.org/2000/svg',stage=document.querySelector('#stage'),world=document.querySelector('#world');
    const make=(tag,attrs={})=>{const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;};
    const svg=make('svg',{id:'canvas-connections',width:1,height:1,'aria-label':'画布连线'});world.append(svg);
    const navigation=document.createElement('nav');navigation.className='canvas-section-nav floating';navigation.setAttribute('aria-label','画布区域导航');navigation.hidden=true;document.body.append(navigation);
    const preview=make('svg',{class:'connection-preview',width:1,height:1});world.append(preview);
    const handles=make('svg',{class:'connection-handles',width:1,height:1});world.append(handles);
    const portLayer=make('svg',{class:'connection-ports',width:1,height:1});world.append(portLayer);
    const toolbar=document.createElement('section');toolbar.id='connection-tools';toolbar.className='floating';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','连线操作');toolbar.hidden=true;stage.append(toolbar);
    const hint=document.createElement('div');hint.className='connection-hint';hint.hidden=true;hint.setAttribute('role','status');document.body.append(hint);
    const colors={main:'#2e8465',secondary:'#71829b',exception:'#bd7327'},names={main:'绿色实线',secondary:'灰色实线',exception:'橙色虚线'};
    const sideNames={left:'左',right:'右',top:'上',bottom:'下'},sides=['left','right','top','bottom'];
    let selected=null,source=null,sourceSide='auto',sourceAnchor=null,hoverAnchor=null,displayedAnchor=null,displayedNode=null,drag=null,signature='',routes=[],queued=0,currentTool='select',sectionSignature='',obstacleIds=new Set(),inline=null,hovered=null,target=null,lastPointer=null,previewFrame=0,deleteKeyBlocked=false;
    const edge=()=>host.state().edges?.find(e=>e.id===selected);
    function clearNodes(){host.clearSelection();for(const el of world.querySelectorAll('.node.selected'))el.classList.remove('selected');}
    const stateNode=id=>host.state().nodes.find(n=>n.id===id&&n.type!=='group'&&!n.hidden);
    const nodeAt=e=>{const el=document.elementFromPoint(e.clientX,e.clientY),port=el?.closest('[data-connection-port]');return stateNode(port?.dataset.nodeId||el?.closest('.node')?.dataset.id);};
    const worldPoint=e=>{const r=stage.getBoundingClientRect(),v=host.state().viewport;return {x:(e.clientX-r.left-v.x)/v.zoom,y:(e.clientY-r.top-v.y)/v.zoom};};
    const midpoint=(n,side)=>side==='left'?{x:n.x,y:n.y+n.height/2}:side==='right'?{x:n.x+n.width,y:n.y+n.height/2}:side==='top'?{x:n.x+n.width/2,y:n.y}:{x:n.x+n.width/2,y:n.y+n.height};
    function nearestSide(n,p){return sides.reduce((best,s)=>{const a=midpoint(n,s),b=midpoint(n,best);return Math.hypot(a.x-p.x,a.y-p.y)<Math.hypot(b.x-p.x,b.y-p.y)?s:best;},'left');}
    // Snap near a connection dot; the rest of the object leaves routing automatic.
    function dropPort(e,node){
      const explicit=e.target.closest('[data-connection-port]')?.dataset.connectionPort;if(explicit)return explicit;
      if(!node)return 'auto';const p=worldPoint(e),side=nearestSide(node,p),dot=midpoint(node,side);
      return Math.hypot(p.x-dot.x,p.y-dot.y)<=18/host.state().viewport.zoom?side:'auto';
    }
    const controls='button,a[href],input:not([type=hidden]),select,textarea,[role=button],[data-connection-anchor]';
    const controlText=el=>(el.getAttribute('aria-label')||el.getAttribute('placeholder')||(el.matches('input,textarea,select')?'':el.textContent)||'').trim().replace(/\s+/g,' ').slice(0,256);
    const pageKey=doc=>JSON.stringify([doc.location.pathname,doc.location.hash,[...doc.querySelectorAll('h1,h2,form')].slice(0,20).map(el=>el.matches('form')?el.id:el.textContent.trim().slice(0,120))]).slice(0,2048);
    function boardFrame(node){return [...world.querySelectorAll('.node.board')].find(el=>el.dataset.id===node.id)?.querySelector('iframe');}
    function controlRect(node,el,frame){
      const r=el.getBoundingClientRect(),f=frame.getBoundingClientRect(),v=host.state().viewport,stageRect=stage.getBoundingClientRect();
      const style=frame.contentWindow.getComputedStyle(el);
      if(!el.isConnected||!el.getClientRects().length||style.visibility==='hidden'||style.display==='none'||Number(style.opacity)===0||r.width<=0||r.height<=0||r.right<=0||r.bottom<=0||r.left>=frame.clientWidth||r.top>=frame.clientHeight)return null;
      const sx=f.width/frame.clientWidth,sy=f.height/frame.clientHeight;
      // Controls clipped by a scrolling container must not leave floating connections.
      const x=Math.max(0,r.left)+Math.min(r.width,frame.clientWidth-Math.max(0,r.left))/2,y=Math.max(0,r.top)+Math.min(r.height,frame.clientHeight-Math.max(0,r.top))/2;
      const top=frame.contentDocument.elementFromPoint(x,y);if(!top||!(top===el||el.contains(top)))return null;
      return {x:(f.left+r.left*sx-stageRect.left-v.x)/v.zoom,y:(f.top+r.top*sy-stageRect.top-v.y)/v.zoom,width:r.width*sx/v.zoom,height:r.height*sy/v.zoom};
    }
    function resolveAnchor(node,anchor){
      try{const frame=boardFrame(node),doc=frame?.contentDocument;if(!doc||node.src!==anchor.src||pageKey(doc)!==anchor.page)return null;const matches=doc.querySelectorAll(anchor.selector);if(matches.length!==1)return null;const el=matches[0];if(el.tagName!==anchor.tag||controlText(el)!==anchor.text)return null;return controlRect(node,el,frame);}catch{return null;}
    }
    function controlAt(event,node){
      if(!node||node.type!=='board')return null;
      if(event.target?.closest?.('[data-control-port=true]')&&displayedNode===node.id)return displayedAnchor;
      try{const frame=boardFrame(node),doc=frame?.contentDocument;if(!doc)return null;const r=frame.getBoundingClientRect(),x=(event.clientX-r.left)*frame.clientWidth/r.width,y=(event.clientY-r.top)*frame.clientHeight/r.height;
        if(x<0||y<0||x>=frame.clientWidth||y>=frame.clientHeight)return null;
        const el=doc.elementFromPoint(x,y)?.closest(controls);if(!el)return null;
        let selector=el.id?'#'+CSS.escape(el.id):'';
        if(!selector){const parts=[];for(let n=el;n&&n!==doc.body;n=n.parentElement){const tag=n.localName;const peers=[...n.parentElement.children].filter(c=>c.localName===tag);parts.unshift(tag+':nth-of-type('+(peers.indexOf(n)+1)+')');}selector='body > '+parts.join(' > ');}
        if(selector.length>1024||doc.querySelectorAll(selector).length!==1)return null;
        const anchor={selector,tag:el.tagName,text:controlText(el),page:pageKey(doc),src:node.src};return resolveAnchor(node,anchor)?anchor:null;
      }catch{return null;}
    }
    const routeOptions=()=>({zoom:host.state().viewport.zoom,resolveAnchor});
    function clearPreview(){source=null;sourceSide='auto';sourceAnchor=null;hoverAnchor=null;drag=null;target=null;hovered=null;world.classList.remove('adjusting-connection');delete stage.dataset.connectionDrag;preview.replaceChildren();portLayer.replaceChildren();world.querySelectorAll('.connection-source,.connection-target').forEach(n=>n.classList.remove('connection-source','connection-target'));updateHint();}
    function updateHint(){hint.hidden=!(host.canEdit()&&(host.tool()==='connect'||drag));hint.textContent=drag?.segment!=null?'拖动调整折线 · Alt 暂停吸附 · Esc 取消':drag&&!drag.creating?'拖到对象自动连接 · 靠近圆点吸附 · Esc 取消':source?'选择终点，自动连接 · 也可拖到圆点':'从控件或画板拖出连线 · 页面切换后自动隐藏 · Esc 取消';}
    function choose(id){if(inline&&inline.id!==id)finishInline(true);selected=id;clearNodes();render();}
    function add(from,to,changes={}){
      if(!host.canEdit()||from===to||![from,to].every(id=>stateNode(id)))return null;
      const next={...changes,id:'e_'+crypto.randomUUID().replaceAll('-',''),fromInstanceId:from,toInstanceId:to,label:String(changes.label||'').slice(0,200),kind:['main','secondary','exception'].includes(changes.kind)?changes.kind:'main'};
      host.mutate(doc=>(doc.edges||=[]).push(next));choose(next.id);clearPreview();host.setTool('select');return next.id;
    }
    function update(id,changes){if(!host.canEdit()||!host.state().edges?.some(e=>e.id===id))return;const allowed={};for(const k of ['label','kind','fromPort','toPort','fromInstanceId','toInstanceId','fromAnchor','toAnchor','manualRoute'])if(k in changes)allowed[k]=changes[k];host.mutate(doc=>Object.assign(doc.edges.find(e=>e.id===id),allowed));}
    function remove(){if(!selected||!host.canEdit())return;finishInline(false);const id=selected;selected=null;host.mutate(doc=>doc.edges=(doc.edges||[]).filter(e=>e.id!==id));toolbar.hidden=true;}
    const isDeleteKey=event=>event.key==='Delete'||event.key==='Backspace'||event.code==='Backspace'||event.keyCode===8||event.keyCode===46;
    const isEditableTarget=event=>event.target instanceof Element&&Boolean(event.target.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])'));
    const deleteSelected=event=>{if(!selected||isEditableTarget(event))return false;event.preventDefault();event.stopImmediatePropagation();remove();return true;};
    function anchorOnPath(route,p){
      if(!p)return route.points[Math.floor(route.points.length/2)]||{x:0,y:0};
      let best=p,distance=Infinity;for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];const q=a.x===b.x?{x:a.x,y:Math.max(Math.min(a.y,b.y),Math.min(Math.max(a.y,b.y),p.y))}:{x:Math.max(Math.min(a.x,b.x),Math.min(Math.max(a.x,b.x),p.x)),y:a.y};const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<distance){distance=d;best=q;}}return best;
    }
    function positionInline(){
      if(!inline)return;const r=routes.find(r=>r.id===inline.id);if(!r)return;
      const v=host.state().viewport,l=r.label,anchor=l?{x:l.x+l.width/2,y:l.y+l.height/2}:inline.anchor;
      const width=Math.min(innerWidth-24,Math.max(180,Math.min(360,(l?.width||220)*v.zoom+20))),font=Math.max(14,Math.min(22,(l?.font||20)*v.zoom));
      inline.el.style.fontSize=font+'px';inline.el.style.width=width+'px';inline.el.style.height='0px';
      const height=Math.min(220,Math.max(44,inline.el.scrollHeight+4));inline.el.style.height=height+'px';
      inline.el.style.left=Math.max(12,Math.min(innerWidth-width-12,anchor.x*v.zoom+v.x-width/2))+'px';inline.el.style.top=Math.max(75,Math.min(innerHeight-height-90,anchor.y*v.zoom+v.y-height/2))+'px';
    }
    function finishInline(commit,focus=false){
      if(!inline)return;const pending=inline;inline=null;pending.el.remove();
      const current=host.state().edges?.find(e=>e.id===pending.id),value=pending.el.value.slice(0,200).trim();
      if(commit&&current&&host.canEdit()&&value!==(current.label||''))update(pending.id,{label:value});
      if(focus)stage.focus();schedule();
    }
    function startInline(id,point){
      if(!host.canEdit())return;if(inline?.id===id){inline.el.focus();return;}finishInline(true);choose(id);
      const e=edge(),route=routes.find(r=>r.id===id);if(!e||!route)return;
      const textarea=document.createElement('textarea');textarea.className='connection-label-editor floating';textarea.setAttribute('aria-label','在线编辑连线文字');textarea.setAttribute('placeholder','输入条件或说明');textarea.maxLength=200;textarea.spellcheck=false;textarea.value=e.label||'';
      inline={id,el:textarea,anchor:route.unroutable?{x:stateNode(e.fromInstanceId).x+100,y:stateNode(e.fromInstanceId).y-80}:anchorOnPath(route,point),composing:false,pendingBlur:false};stage.append(textarea);toolbar.hidden=true;
      textarea.addEventListener('input',positionInline);textarea.addEventListener('compositionstart',()=>{if(inline)inline.composing=true;});textarea.addEventListener('compositionend',()=>{if(!inline)return;inline.composing=false;if(inline.pendingBlur)finishInline(true);});
      textarea.addEventListener('keydown',event=>{if(event.isComposing||event.keyCode===229)return;if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();event.stopPropagation();finishInline(true,true);}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finishInline(false,true);}});
      textarea.addEventListener('blur',()=>{if(!inline||inline.el!==textarea)return;if(inline.composing){inline.pendingBlur=true;return;}finishInline(true);});
      updateSelection();positionInline();textarea.focus({preventScroll:true});textarea.select();
    }
    function editor(){
      const e=edge();toolbar.hidden=!e||!!inline||!!drag||!host.canEdit();if(toolbar.hidden)return;
      if(toolbar.dataset.edge!==e.id){
        toolbar.replaceChildren();toolbar.dataset.edge=e.id;
        function button(label,icon,run){
          const b=document.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);
          const graphic=make('svg',{viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'});
          graphic.innerHTML=root.ProtaCanvasIcons[icon];b.append(graphic);b.onclick=run;toolbar.append(b);return b;
        }
        const edit=button('编辑文字','type',()=>startInline(e.id));edit.title='编辑文字 · 双击连线 / Enter';
        const caption=document.createElement('span');caption.textContent='文字';edit.append(caption);
        const styles=document.createElement('div');styles.className='connection-styles';styles.setAttribute('role','group');styles.setAttribute('aria-label','线条样式');toolbar.append(styles);
        for(const [kind,color]of Object.entries(colors)){
          const b=button(names[kind],'minus',()=>update(e.id,{kind}));b.dataset.kind=kind;b.style.setProperty('--stroke-color',color);
          const line=b.querySelector('svg');line.setAttribute('viewBox','0 0 24 24');line.replaceChildren(make('path',{d:'M3 12h18',stroke:color,'stroke-width':2.5,...(kind==='exception'?{'stroke-dasharray':'4 4'}:{})}));styles.append(b);
        }
        const auto=button('恢复自动连接','sparkles',()=>update(e.id,{fromPort:'auto',toPort:'auto',manualRoute:null}));auto.dataset.action='auto';
        const autoLabel=document.createElement('span');autoLabel.textContent='自动';auto.append(autoLabel);
        const reverse=button('反向','waypoints',()=>{const now=edge();if(now)update(now.id,{fromInstanceId:now.toInstanceId,toInstanceId:now.fromInstanceId,fromPort:now.toPort||'auto',toPort:now.fromPort||'auto',fromAnchor:now.toAnchor||null,toAnchor:now.fromAnchor||null,manualRoute:now.manualRoute?[...now.manualRoute].reverse():null});});
        // Reuse the canvas icon family; two arrows make direction reversal explicit.
        reverse.querySelector('svg').innerHTML='<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>';
        button('删除','trash-2',remove).className='danger';
      }
      for(const b of toolbar.querySelectorAll('[data-kind]'))b.setAttribute('aria-pressed',String(b.dataset.kind===(e.kind||'main')));
      toolbar.querySelector('[data-action="auto"]').hidden=!e.manualRoute?.length&&![e.fromPort,e.toPort].some(port=>port&&port!=='auto');
      const r=routes.find(r=>r.id===e.id),p=r?.label||r?.points?.[Math.floor(r.points.length/2)]||(r?.unroutable?{x:stateNode(e.fromInstanceId).x,y:stateNode(e.fromInstanceId).y-80}:null);if(!p){toolbar.hidden=true;return;}
      const v=host.state().viewport,anchor={x:p.x*v.zoom+v.x,y:p.y*v.zoom+v.y,width:(p.width||0)*v.zoom,height:(p.height||0)*v.zoom};
      const avoid=[...document.querySelectorAll('body > .floating,.canvas-identity')].filter(el=>el!==toolbar&&!el.hidden).map(el=>el.getBoundingClientRect());
      const placement=CanvasCore.placeOverlay({anchor,width:Math.min(toolbar.offsetWidth||340,innerWidth-24),height:toolbar.offsetHeight||48,viewport:{width:innerWidth,height:innerHeight},obstacles:avoid});toolbar.style.left=placement.x+'px';toolbar.style.top=placement.y+'px';
    }
    function updateSelection(){
      const zoom=host.state().viewport.zoom;handles.replaceChildren();
      for(const group of svg.querySelectorAll('.connection')){
        const active=group.dataset.edgeId===selected;group.classList.toggle('selected',active);group.setAttribute('aria-pressed',String(active));group.classList.toggle('is-editing',inline?.id===group.dataset.edgeId);
        const path=group.querySelector('.connection-line');if(path)path.setAttribute('stroke-width',active?3:2);
        const rect=group.querySelector('.connection-label');if(rect)rect.setAttribute('stroke',active?'#6475ce':'#dce5e4');
      }
      const activeRoute=routes.find(r=>r.id===selected);
      if(activeRoute&&!activeRoute.unroutable&&host.canEdit()&&!inline&&drag?.segment==null){
        for(let i=0;i<activeRoute.points.length-1;i++){
          const a=activeRoute.points[i],b=activeRoute.points[i+1];if(Math.hypot(a.x-b.x,a.y-b.y)*zoom<28)continue;
          const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
          const grip=make('g',{'data-connection-segment':i,class:a.y===b.y?'segment-horizontal':'segment-vertical','aria-label':a.y===b.y?'上下拖动线段':'左右拖动线段'});
          grip.append(make('rect',{x:x-11/zoom,y:y-11/zoom,width:22/zoom,height:22/zoom,fill:'transparent'}),make('rect',{x:x-3.5/zoom,y:y-3.5/zoom,width:7/zoom,height:7/zoom,rx:1.5/zoom,fill:'#fff',stroke:'#6475ce','stroke-width':1.5/zoom,class:'segment-grip'}));handles.append(grip);
        }
      }
      const r=routes.find(r=>r.id===selected);if(r&&!r.unroutable&&host.canEdit()&&!inline&&drag?.segment==null)for(const[end,p]of [['from',r.points[0]],['to',r.points.at(-1)]])handles.append(make('circle',{cx:p.x,cy:p.y,r:7/zoom,fill:'#fff',stroke:'#6475ce','stroke-width':2/zoom,'data-connection-end':end,role:'img','aria-label':end==='from'?'拖动起点':'拖动终点'}));
    }
    function beginSegment(event,route,index){
      if(!host.canEdit()||index<0||index>=route.points.length-1)return;
      finishInline(true);const points=route.points.map(p=>({...p}));
      const a=stateNode(route.edge.fromInstanceId),b=stateNode(route.edge.toInstanceId);
      const boxA=route.edge.fromAnchor?resolveAnchor(a,route.edge.fromAnchor):a,boxB=route.edge.toAnchor?resolveAnchor(b,route.edge.toAnchor):b;
      drag={id:route.id,segment:index,points,start:worldPoint(event),horizontal:points[index].y===points[index+1].y,moved:false,
        fromPort:nearestSide(boxA,points[0]),toPort:nearestSide(boxB,points.at(-1))};
      toolbar.hidden=true;stage.dataset.connectionDrag=drag.horizontal?'horizontal':'vertical';updateHint();
    }
    function segmentPreview(event){
      if(drag?.segment==null)return;if(!edge()||!host.canEdit()){clearPreview();schedule();return;}const d=drag,zoom=host.state().viewport.zoom,axis=d.horizontal?'y':'x',along=d.horizontal?'x':'y',p=worldPoint(event);
      const delta=p[axis]-d.start[axis];if(!d.moved&&Math.abs(delta)*zoom<3)return;
      d.moved=true;world.classList.add('adjusting-connection');let value=d.points[d.segment][axis]+delta,guide=null;
      if(!event.altKey){
        const candidates=d.points.map(p=>p[axis]);
        for(const n of host.state().nodes.filter(n=>!n.hidden&&n.type!=='group')){const length=axis==='x'?n.width:n.height;candidates.push(n[axis],n[axis]+length/2,n[axis]+length,n[axis]-24,n[axis]+length+24);}
        for(const r of routes)if(r.id!==d.id)candidates.push(...r.points.map(p=>p[axis]));
        const nearest=candidates.reduce((best,n)=>Math.abs(n-value)<Math.abs(best-value)?n:best,Infinity);
        if(Math.abs(nearest-value)<=6/zoom){value=nearest;guide=value;}
        else{const grid=Math.round(value/10)*10;if(Math.abs(grid-value)<=4/zoom){value=grid;guide=value;}}
      }
      d.next=root.CanvasConnections.moveSegment(d.points,d.segment,value);
      const original=edge(),doc=host.state(),candidate={...original,fromPort:d.fromPort,toPort:d.toPort,manualRoute:d.next};
      const routed=root.CanvasConnections.routeEdges(doc.nodes,[candidate],routeOptions())[0];
      if(!routed)return;d.next=routed.points;
      preview.replaceChildren();
      if(guide!=null){const v=doc.viewport,min={x:-v.x/zoom,y:-v.y/zoom},max={x:(stage.clientWidth-v.x)/zoom,y:(stage.clientHeight-v.y)/zoom};preview.append(make('path',{class:'connection-snap-guide',d:d.horizontal?`M${min.x} ${value}H${max.x}`:`M${value} ${min.y}V${max.y}`,fill:'none',stroke:'#8b98d9','stroke-width':1,'stroke-dasharray':'3 4','vector-effect':'non-scaling-stroke'}));}
      preview.append(make('path',{class:'connection-drag-preview',d:d.next.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '),fill:'none',stroke:colors[original.kind]||colors.main,'stroke-dasharray':original.kind==='exception'?'8 6':'','stroke-width':3,'stroke-linejoin':'round','stroke-linecap':'round','vector-effect':'non-scaling-stroke','marker-end':'url(#canvas-arrow-'+(original.kind||'main')+')'}));
      if(routed.label){const l=routed.label,color=colors[original.kind]||colors.main;
        preview.append(make('rect',{x:l.x,y:l.y,width:l.width,height:l.height,rx:7,fill:'#fff',stroke:'#c4cee9','stroke-width':1}));
        const text=make('text',{'text-anchor':'middle',fill:color,'font-size':l.font,'font-family':'-apple-system, PingFang SC, sans-serif'});
        l.lines.forEach((line,i)=>{const span=make('tspan',{x:l.x+l.width/2,y:l.y+10+l.font+i*(l.font+5)});span.textContent=line;text.append(span);});preview.append(text);
      }
      const center=(d.points[d.segment][along]+d.points[d.segment+1][along])/2;
      preview.append(make('rect',{x:(d.horizontal?center:value)-4/zoom,y:(d.horizontal?value:center)-4/zoom,width:8/zoom,height:8/zoom,rx:2/zoom,fill:'#fff',stroke:'#6475ce','stroke-width':1.5,'vector-effect':'non-scaling-stroke'}));
      handles.replaceChildren();
    }
    // Midpoint grips are rebuilt after selection; delegate double-click to their stable SVG layer.
    handles.addEventListener('dblclick',event=>{if(!selected||!host.canEdit())return;event.preventDefault();event.stopPropagation();startInline(selected,worldPoint(event));});
    function syncLayers(){
      // Node rendering resets className. Restore region layering even when cached routes did not change.
      const topPorts=new Set();for(const r of routes){const a=stateNode(r.edge.fromInstanceId),b=stateNode(r.edge.toInstanceId);if(a&&r.points[0]?.y===a.y&&r.points[0]?.x===a.x+a.width/2)topPorts.add(a.id);if(b&&r.points.at(-1)?.y===b.y&&r.points.at(-1)?.x===b.x+b.width/2)topPorts.add(b.id);}
      for(const el of world.querySelectorAll('.node')){
        el.classList.toggle('connection-top-port',topPorts.has(el.dataset.id));
        el.classList.toggle('connection-container',!!host.state().edges?.length&&!obstacleIds.has(el.dataset.id));
        el.classList.toggle('connection-source',el.dataset.id===source);el.classList.toggle('connection-target',el.dataset.id===target);
      }
    }
    function render(){
      queued=0;const doc=host.state();if(selected&&!doc.edges?.some(e=>e.id===selected)){finishInline(false);selected=null;clearPreview();}
      if(inline&&!host.canEdit())finishInline(false);
      const navSig=JSON.stringify(doc.sections||[]);if(navSig!==sectionSignature){sectionSignature=navSig;navigation.replaceChildren();navigation.hidden=!doc.sections?.length;for(const section of doc.sections||[]){const button=document.createElement('button');button.type='button';button.textContent=section.label;button.classList.toggle('active',(doc.initialFocusNodeIds||[]).length>0&&(doc.initialFocusNodeIds||[]).every(id=>(section.nodeIds||[]).includes(id)));button.onclick=()=>{finishInline(true);selected=null;toolbar.hidden=true;clearNodes();host.focus(section.nodeIds||[]);for(const b of navigation.children)b.classList.toggle('active',b===button);};navigation.append(button);}}
      const sig=JSON.stringify([doc.nodes.map(n=>[n.id,n.x,n.y,n.width,n.height,n.hidden]),doc.edges,(doc.edges||[]).map(e=>[e.fromAnchor?resolveAnchor(stateNode(e.fromInstanceId),e.fromAnchor):null,e.toAnchor?resolveAnchor(stateNode(e.toInstanceId),e.toAnchor):null]),Math.round(doc.viewport.zoom*100)/100,Math.ceil(28/doc.viewport.zoom/10)]);
      if(sig!==signature){
        signature=sig;obstacleIds=new Set(doc.edges?.length?root.CanvasConnections.obstacles(doc.nodes,doc.viewport.zoom).map(r=>r.id):[]);routes=root.CanvasConnections.routeEdges(doc.nodes,doc.edges,routeOptions());svg.replaceChildren();const defs=make('defs');svg.append(defs);
        for(const[k,color]of Object.entries(colors)){const marker=make('marker',{id:'canvas-arrow-'+k,viewBox:'0 0 12 12',refX:10,refY:6,markerWidth:7,markerHeight:7,orient:'auto',markerUnits:'strokeWidth'});marker.append(make('path',{d:'M1 1L11 6L1 11Z',fill:color}));defs.append(marker);}
        for(const r of routes){
          const group=make('g',{'data-edge-id':r.id,'data-kind':r.edge.kind||'main',class:'connection',role:'button',tabindex:0,'aria-keyshortcuts':'Delete Backspace','aria-label':(r.edge.label||'未命名连线')+' · '+(names[r.edge.kind]||names.main)});
          const title=make('title');title.textContent=(r.edge.label||'未命名连线')+' · 双击直接编辑文字';group.append(title);
          if(r.unroutable){const n=stateNode(r.edge.fromInstanceId);const t=make('text',{x:n.x,y:n.y-80,fill:'#ad6333','font-size':20});t.textContent='连接被遮挡 · 拉开重叠对象';group.append(t);}
          else{
            const d=r.points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '),kind=colors[r.edge.kind]?r.edge.kind:'main';
            group.append(make('path',{d,class:'connection-hit',fill:'none',stroke:'transparent','stroke-width':14,'vector-effect':'non-scaling-stroke'}));
            const path=make('path',{d,class:'connection-line',fill:'none',stroke:colors[kind],'stroke-width':2,'vector-effect':'non-scaling-stroke','marker-end':'url(#canvas-arrow-'+kind+')','stroke-linejoin':'round','stroke-linecap':'round'});if(kind==='exception')path.setAttribute('stroke-dasharray','8 6');group.append(path);
            if(r.label){const l=r.label;group.append(make('rect',{class:'connection-label',x:l.x,y:l.y,width:l.width,height:l.height,rx:7,fill:'#fff',stroke:'#dce5e4','stroke-width':1}));const text=make('text',{'text-anchor':'middle',fill:colors[kind],'font-size':l.font,'font-family':'-apple-system, PingFang SC, sans-serif'});l.lines.forEach((line,i)=>{const span=make('tspan',{x:l.x+l.width/2,y:l.y+10+l.font+i*(l.font+5)});span.textContent=line;text.append(span);});group.append(text);}
          }
          group.addEventListener('pointerdown',event=>{if(event.button!==0||host.panning())return;event.stopPropagation();event.preventDefault();choose(r.id);stage.focus();if(host.canEdit()&&event.target.classList.contains('connection-hit')){
            const p=worldPoint(event);let index=0,best=Infinity;
            for(let i=0;i<r.points.length-1;i++){const a=r.points[i],b=r.points[i+1],q=a.x===b.x?{x:a.x,y:Math.max(Math.min(a.y,b.y),Math.min(Math.max(a.y,b.y),p.y))}:{x:Math.max(Math.min(a.x,b.x),Math.min(Math.max(a.x,b.x),p.x)),y:a.y};const distance=Math.hypot(q.x-p.x,q.y-p.y);if(distance<best){best=distance;index=i;}}
            beginSegment(event,r,index);
          }});
          group.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();startInline(r.id,worldPoint(event));});
          group.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();choose(r.id);});
          group.addEventListener('keydown',event=>{if(isDeleteKey(event)){selected=r.id;deleteSelected(event);}else if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();choose(r.id);if(event.key==='Enter')startInline(r.id);}});svg.append(group);
        }
      }
      syncLayers();updateSelection();editor();positionInline();updateHint();
    }
    function schedule(){if(!queued)queued=requestAnimationFrame(render);}
    function drawPorts(node,anchor=null,activeSide='auto'){
      portLayer.replaceChildren();displayedAnchor=anchor;displayedNode=node?.id;if(!node||!host.canEdit())return;const zoom=host.state().viewport.zoom,box=anchor?resolveAnchor(node,anchor):node;if(!box)return;
      if(anchor)portLayer.append(make('rect',{x:box.x,y:box.y,width:box.width,height:box.height,fill:'#6475ce12',stroke:'#6475ce','stroke-width':1.5/zoom,'pointer-events':'none'}));
      for(const side of sides){const p=midpoint(box,side);portLayer.append(make('circle',{cx:p.x,cy:p.y,r:6/zoom,fill:side===activeSide?'#2e8465':'#fff',stroke:target===node.id?'#2e8465':'#7184cf','stroke-width':1.7/zoom,'data-connection-port':side,'data-node-id':node.id,'data-control-port':anchor?'true':'false',role:'button','aria-label':(node.name||'对象')+' · '+sideNames[side]+'侧连接点'}));}
    }
    function ghost(e){
      const origin=source||drag?.fixed,node=stateNode(origin);if(!node)return;
      const hit=nodeAt(e),candidate=hit&&hit.id!==origin&&!hit.locked?hit:null;target=candidate?.id||null;
      const q=worldPoint(e),targetAnchor=candidate?controlAt(e,candidate):null,toSide=candidate?(targetAnchor?nearestSide(resolveAnchor(candidate,targetAnchor),q):dropPort(e,candidate)):'auto';syncLayers();drawPorts(candidate||node,targetAnchor,toSide);
      const existing=drag&&!drag.creating?host.state().edges?.find(e=>e.id===drag.id):null;
      const cfg=existing?{...existing,manualRoute:null,fromInstanceId:drag.end==='from'?candidate?.id:existing.fromInstanceId,toInstanceId:drag.end==='to'?candidate?.id:existing.toInstanceId,[drag.end==='from'?'fromPort':'toPort']:toSide,[drag.end==='from'?'fromAnchor':'toAnchor']:targetAnchor}:{id:'preview',fromInstanceId:origin,toInstanceId:candidate?.id,fromPort:sourceSide,toPort:toSide,fromAnchor:sourceAnchor,toAnchor:targetAnchor};
      let points=candidate?root.CanvasConnections.routeEdges(host.state().nodes,[cfg],routeOptions())[0]?.points:null;
      if(!points?.length){const box=sourceAnchor?resolveAnchor(node,sourceAnchor):node;if(!box){clearPreview();return;}const p=midpoint(box,sourceSide==='auto'?nearestSide(box,q):sourceSide);points=[p,{x:(p.x+q.x)/2,y:p.y},{x:(p.x+q.x)/2,y:q.y},q];}
      preview.replaceChildren(make('path',{d:points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '),fill:'none',stroke:candidate?'#2e8465':'#6475ce','stroke-width':2,'stroke-dasharray':'5 5','vector-effect':'non-scaling-stroke'}));
    }
    stage.addEventListener('pointerdown',e=>{
      if(e.button!==0||host.panning()||e.target.closest('.floating'))return;
      const segment=e.target.closest('[data-connection-segment]');
      if(segment&&selected&&host.canEdit()){const route=routes.find(r=>r.id===selected);if(route){e.preventDefault();e.stopImmediatePropagation();beginSegment(e,route,Number(segment.dataset.connectionSegment));}return;}
      const handle=e.target.closest('[data-connection-end]');if(handle&&selected&&host.canEdit()){finishInline(true);const now=edge();drag={id:now.id,end:handle.dataset.connectionEnd,fixed:handle.dataset.connectionEnd==='from'?now.toInstanceId:now.fromInstanceId};e.preventDefault();e.stopImmediatePropagation();toolbar.hidden=true;updateHint();return;}
      if(host.tool()==='connect'&&host.canEdit()){
        const n=nodeAt(e);e.preventDefault();e.stopImmediatePropagation();if(!n||n.locked){clearPreview();return;}
        const anchor=controlAt(e,n),port=anchor?(e.target.closest('[data-connection-port]')?.dataset.connectionPort||nearestSide(resolveAnchor(n,anchor),worldPoint(e))):dropPort(e,n);
        if(source&&source!==n.id){add(source,n.id,{fromPort:sourceSide,toPort:port,fromAnchor:sourceAnchor,toAnchor:anchor});return;}source=n.id;sourceSide=port;sourceAnchor=anchor;drag={creating:true};syncLayers();drawPorts(n,anchor);updateHint();return;
      }
      if(!e.target.closest('#canvas-connections')&&selected){finishInline(true);selected=null;toolbar.hidden=true;schedule();}
    },true);
    document.addEventListener('pointermove',e=>{
      lastPointer=e;if(source||drag){if(!previewFrame)previewFrame=requestAnimationFrame(()=>{previewFrame=0;if(drag?.segment!=null)segmentPreview(lastPointer);else if(source||drag)ghost(lastPointer);});return;}
      if(host.tool()==='connect'&&host.canEdit()){const n=nodeAt(e);const anchor=controlAt(e,n);if(n?.id!==hovered||JSON.stringify(anchor)!==JSON.stringify(hoverAnchor)){hovered=n?.id||null;hoverAnchor=anchor;drawPorts(n&&!n.locked?n:null,anchor);}}
    });
    document.addEventListener('pointerup',e=>{
      if(drag?.segment!=null){
        segmentPreview(e);const pending=drag;clearPreview();
        if(pending.moved&&pending.next&&JSON.stringify(pending.next)!==JSON.stringify(pending.points))update(pending.id,{manualRoute:pending.next,fromPort:pending.fromPort,toPort:pending.toPort});
        schedule();return;
      }
      if(!drag)return;const pending=drag,n=nodeAt(e),anchor=n?controlAt(e,n):null,port=n?(anchor?(e.target.closest('[data-connection-port]')?.dataset.connectionPort||nearestSide(resolveAnchor(n,anchor),worldPoint(e))):dropPort(e,n)):'auto';
      if(pending.creating){drag=null;if(n&&source&&n.id!==source&&!n.locked)add(source,n.id,{fromPort:sourceSide,toPort:port,fromAnchor:sourceAnchor,toAnchor:anchor});updateHint();return;}
      if(n&&n.id!==pending.fixed&&!n.locked&&host.canEdit())update(pending.id,{[pending.end==='from'?'fromInstanceId':'toInstanceId']:n.id,[pending.end==='from'?'fromPort':'toPort']:port,[pending.end==='from'?'fromAnchor':'toAnchor']:anchor,manualRoute:null});clearPreview();schedule();
    });
    const cancel=()=>{clearPreview();schedule();};document.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('beforeunload',()=>finishInline(true));
    document.addEventListener('keydown',e=>{
      // Handle deletion before the composition guard: some IMEs keep isComposing set
      // even when focus has returned from the inline editor to the canvas.
      if(isDeleteKey(e)){
        if(isEditableTarget(e)){deleteKeyBlocked=true;return;}
        if(deleteSelected(e)){deleteKeyBlocked=false;return;}
      }
      if(e.isComposing||isEditableTarget(e))return;
      if(e.key==='Escape'&&(source||drag||selected||host.tool()==='connect')){e.preventDefault();e.stopImmediatePropagation();finishInline(false);selected=null;toolbar.hidden=true;clearPreview();host.setTool('select');schedule();}
      else if((e.key==='Enter'||e.key==='F2')&&selected){e.preventDefault();e.stopImmediatePropagation();startInline(selected);}
      else if(!e.metaKey&&!e.ctrlKey&&e.key.toLowerCase()==='l'&&host.canEdit()){e.preventDefault();host.setTool('connect');}
    },true);
    // Some IMEs consume the Backspace keydown. A selected line can still be
    // removed on keyup; the keydown path clears selection first, so this is a no-op.
    document.addEventListener('keyup',e=>{
      if(!isDeleteKey(e))return;
      if(deleteKeyBlocked){deleteKeyBlocked=false;return;}
      deleteSelected(e);
    },true);
    // Only anchored documents need DOM tracking; routing is cached until geometry or page identity changes.
    const tracker=setInterval(()=>{if(host.state().edges?.some(e=>e.fromAnchor||e.toAnchor))schedule();},200);window.addEventListener('pagehide',()=>clearInterval(tracker),{once:true});
    return {schedule,render,add,update,remove,clear:()=>{finishInline(true);selected=null;clearPreview();toolbar.hidden=true;schedule();},setTool(value){if(value!==currentTool){currentTool=value;clearPreview();if(value==='connect'){finishInline(true);selected=null;clearNodes();toolbar.hidden=true;}}updateHint();},getRoutes:()=>routes,getSelection:()=>selected};
  };
})(globalThis);
