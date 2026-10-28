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
      const from=ports(a,ab,edge.fromPort).map(p=>({...p,owner:a.id})),to=ports(b,bb,edge.toPort).map(p=>({...p,owner:b.id}));
      const avoid=rects.concat(labels.map((r,i)=>({id:'label-'+i,x:r.x-12,y:r.y-12,width:r.width+24,height:r.height+24})));
      const points=search(from,to,avoid,prior);
      if(!points){result.push({id:edge.id,edge,points:[],label:null,unroutable:true});continue;}
      const label=labelFor(edge,points,rects,labels,edge.fontSize||20,prior);if(label)labels.push(label);prior.push(points);result.push({id:edge.id,edge,points,label});
    }
    return result;
  }
  root.CanvasConnections={routeEdges,obstacles,intersects,overlap};
})(globalThis);
(function(root){
  'use strict';
  root.CanvasConnections.editorVersion=2;
  root.CanvasConnections.install=function(host){
    const NS='http://www.w3.org/2000/svg',stage=document.querySelector('#stage'),world=document.querySelector('#world');
    const make=(tag,attrs={})=>{const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;};
    const svg=make('svg',{id:'canvas-connections',width:1,height:1,'aria-label':'画布连线'});world.append(svg);
    const navigation=document.createElement('nav');navigation.className='canvas-section-nav floating';navigation.setAttribute('aria-label','画布区域导航');navigation.hidden=true;document.body.append(navigation);
    const legend=document.createElement('div');legend.className='canvas-connection-legend';legend.hidden=true;legend.innerHTML='<span><i></i>主流程</span><span><i class="secondary"></i>可选路径</span><span><i class="exception"></i>异常分支</span>';document.body.append(legend);
    const preview=make('svg',{class:'connection-preview',width:1,height:1});world.append(preview);
    const handles=make('svg',{class:'connection-handles',width:1,height:1});world.append(handles);
    const portLayer=make('svg',{class:'connection-ports',width:1,height:1});world.append(portLayer);
    const toolbar=document.createElement('section');toolbar.id='connection-tools';toolbar.className='floating';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','连线设置');toolbar.hidden=true;stage.append(toolbar);
    const hint=document.createElement('div');hint.className='connection-hint';hint.hidden=true;hint.setAttribute('role','status');document.body.append(hint);
    const colors={main:'#2e8465',secondary:'#71829b',exception:'#bd7327'},names={main:'主流程',secondary:'可选路径',exception:'异常分支'};
    const sideNames={left:'左',right:'右',top:'上',bottom:'下'},sides=['left','right','top','bottom'];
    let selected=null,source=null,sourceSide='auto',drag=null,signature='',routes=[],queued=0,currentTool='select',sectionSignature='',obstacleIds=new Set(),inline=null,hovered=null,target=null,lastPointer=null,previewFrame=0;
    const edge=()=>host.state().edges?.find(e=>e.id===selected);
    function clearNodes(){host.clearSelection();for(const el of world.querySelectorAll('.node.selected'))el.classList.remove('selected');}
    const stateNode=id=>host.state().nodes.find(n=>n.id===id&&n.type!=='group'&&!n.hidden);
    const nodeAt=e=>{const el=document.elementFromPoint(e.clientX,e.clientY),port=el?.closest('[data-connection-port]');return stateNode(port?.dataset.nodeId||el?.closest('.node')?.dataset.id);};
    const worldPoint=e=>{const r=stage.getBoundingClientRect(),v=host.state().viewport;return {x:(e.clientX-r.left-v.x)/v.zoom,y:(e.clientY-r.top-v.y)/v.zoom};};
    const midpoint=(n,side)=>side==='left'?{x:n.x,y:n.y+n.height/2}:side==='right'?{x:n.x+n.width,y:n.y+n.height/2}:side==='top'?{x:n.x+n.width/2,y:n.y}:{x:n.x+n.width/2,y:n.y+n.height};
    function nearestSide(n,p){return sides.reduce((best,s)=>{const a=midpoint(n,s),b=midpoint(n,best);return Math.hypot(a.x-p.x,a.y-p.y)<Math.hypot(b.x-p.x,b.y-p.y)?s:best;},'left');}
    function clearPreview(){source=null;sourceSide='auto';drag=null;target=null;hovered=null;preview.replaceChildren();portLayer.replaceChildren();world.querySelectorAll('.connection-source,.connection-target').forEach(n=>n.classList.remove('connection-source','connection-target'));updateHint();}
    function updateHint(){hint.hidden=!(host.tool()==='connect'||drag);hint.textContent=drag&&!drag.creating?'拖到目标边的中点重连 · Esc 取消':source?'选择终点，或拖到连接点松开 · Esc 取消':'点击或拖动四边连接点创建连线 · Esc 取消';}
    function choose(id){if(inline&&inline.id!==id)finishInline(true);selected=id;clearNodes();render();}
    function add(from,to,changes={}){
      if(!host.canEdit()||from===to||![from,to].every(id=>stateNode(id)))return null;
      const next={...changes,id:'e_'+crypto.randomUUID().replaceAll('-',''),fromInstanceId:from,toInstanceId:to,label:String(changes.label||'').slice(0,200),kind:['main','secondary','exception'].includes(changes.kind)?changes.kind:'main'};
      host.mutate(doc=>(doc.edges||=[]).push(next));choose(next.id);clearPreview();host.setTool('select');return next.id;
    }
    function update(id,changes){if(!host.canEdit()||!host.state().edges?.some(e=>e.id===id))return;const allowed={};for(const k of ['label','kind','fromPort','toPort','fromInstanceId','toInstanceId'])if(k in changes)allowed[k]=changes[k];host.mutate(doc=>Object.assign(doc.edges.find(e=>e.id===id),allowed));}
    function remove(){if(!selected||!host.canEdit())return;finishInline(false);const id=selected;selected=null;host.mutate(doc=>doc.edges=(doc.edges||[]).filter(e=>e.id!==id));toolbar.hidden=true;}
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
      const e=edge();toolbar.hidden=!e||!!inline;if(!e||inline)return;
      if(toolbar.dataset.edge!==e.id){
        toolbar.replaceChildren();toolbar.dataset.edge=e.id;
        const edit=document.createElement('button');edit.type='button';edit.textContent='编辑文字';edit.title='双击连线或按 Enter / F2';edit.onclick=()=>startInline(e.id);toolbar.append(edit);
        function select(key,title,values){const control=document.createElement('select');control.setAttribute('aria-label',title);control.dataset.field=key;for(const[value,text]of values){const o=document.createElement('option');o.value=value;o.textContent=text;control.append(o);}control.onchange=()=>update(e.id,{[key]:control.value});toolbar.append(control);}
        select('kind','连线类型',Object.entries(names));select('fromPort','起点连接位置',[['auto','起点：自动'],...sides.map(s=>[s,'起点：'+sideNames[s]+'中点'])]);select('toPort','终点连接位置',[['auto','终点：自动'],...sides.map(s=>[s,'终点：'+sideNames[s]+'中点'])]);
        const reverse=document.createElement('button');reverse.type='button';reverse.textContent='反向';reverse.onclick=()=>{const now=edge();if(now)update(now.id,{fromInstanceId:now.toInstanceId,toInstanceId:now.fromInstanceId,fromPort:now.toPort||'auto',toPort:now.fromPort||'auto'});};toolbar.append(reverse);
        const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='删除';del.onclick=remove;toolbar.append(del);
      }
      for(const control of toolbar.querySelectorAll('select'))control.value=e[control.dataset.field]||(control.dataset.field==='kind'?'main':'auto');
      for(const control of toolbar.querySelectorAll('select,button'))control.disabled=!host.canEdit();
      const r=routes.find(r=>r.id===e.id),p=r?.label||r?.points?.[Math.floor(r.points.length/2)];if(!p)return;
      const v=host.state().viewport,anchor={x:p.x*v.zoom+v.x,y:p.y*v.zoom+v.y,width:(p.width||0)*v.zoom,height:(p.height||0)*v.zoom};
      const avoid=[...document.querySelectorAll('body > .floating,.canvas-connection-legend,.canvas-identity')].filter(el=>el!==toolbar&&!el.hidden).map(el=>el.getBoundingClientRect());
      const placement=CanvasCore.placeOverlay({anchor,width:Math.min(toolbar.offsetWidth||620,innerWidth-24),height:toolbar.offsetHeight||52,viewport:{width:innerWidth,height:innerHeight},obstacles:avoid});toolbar.style.left=placement.x+'px';toolbar.style.top=placement.y+'px';
    }
    function updateSelection(){
      const zoom=host.state().viewport.zoom;handles.replaceChildren();
      for(const group of svg.querySelectorAll('.connection')){
        const active=group.dataset.edgeId===selected;group.classList.toggle('selected',active);group.setAttribute('aria-pressed',String(active));group.classList.toggle('is-editing',inline?.id===group.dataset.edgeId);
        const path=group.querySelector('.connection-line');if(path)path.setAttribute('stroke-width',active?3:2);
        const rect=group.querySelector('.connection-label');if(rect)rect.setAttribute('stroke',active?'#6475ce':'#dce5e4');
      }
      const r=routes.find(r=>r.id===selected);if(r&&!r.unroutable&&host.canEdit()&&!inline)for(const[end,p]of [['from',r.points[0]],['to',r.points.at(-1)]])handles.append(make('circle',{cx:p.x,cy:p.y,r:7/zoom,fill:'#fff',stroke:'#6475ce','stroke-width':2/zoom,'data-connection-end':end}));
    }
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
      queued=0;const doc=host.state();if(selected&&!doc.edges?.some(e=>e.id===selected)){finishInline(false);selected=null;}
      if(inline&&!host.canEdit())finishInline(false);
      const navSig=JSON.stringify(doc.sections||[]);if(navSig!==sectionSignature){sectionSignature=navSig;navigation.replaceChildren();navigation.hidden=!doc.sections?.length;for(const section of doc.sections||[]){const button=document.createElement('button');button.type='button';button.textContent=section.label;button.classList.toggle('active',(doc.initialFocusNodeIds||[]).length>0&&(doc.initialFocusNodeIds||[]).every(id=>(section.nodeIds||[]).includes(id)));button.onclick=()=>{finishInline(true);selected=null;toolbar.hidden=true;clearNodes();host.focus(section.nodeIds||[]);for(const b of navigation.children)b.classList.toggle('active',b===button);};navigation.append(button);}}legend.hidden=!(doc.edges?.length);
      const sig=JSON.stringify([doc.nodes.map(n=>[n.id,n.x,n.y,n.width,n.height,n.hidden]),doc.edges,Math.round(doc.viewport.zoom*100)/100,Math.ceil(28/doc.viewport.zoom/10)]);
      if(sig!==signature){
        signature=sig;obstacleIds=new Set(doc.edges?.length?root.CanvasConnections.obstacles(doc.nodes,doc.viewport.zoom).map(r=>r.id):[]);routes=root.CanvasConnections.routeEdges(doc.nodes,doc.edges,{zoom:doc.viewport.zoom});svg.replaceChildren();const defs=make('defs');svg.append(defs);
        for(const[k,color]of Object.entries(colors)){const marker=make('marker',{id:'canvas-arrow-'+k,viewBox:'0 0 12 12',refX:10,refY:6,markerWidth:7,markerHeight:7,orient:'auto',markerUnits:'strokeWidth'});marker.append(make('path',{d:'M1 1L11 6L1 11Z',fill:color}));defs.append(marker);}
        for(const r of routes){
          const group=make('g',{'data-edge-id':r.id,'data-kind':r.edge.kind||'main',class:'connection',role:'button',tabindex:0,'aria-label':(r.edge.label||'未命名连线')+' · '+(names[r.edge.kind]||names.main)});
          const title=make('title');title.textContent=(r.edge.label||'未命名连线')+' · 双击直接编辑文字';group.append(title);
          if(r.unroutable){const n=stateNode(r.edge.fromInstanceId);const t=make('text',{x:n.x,y:n.y-80,fill:'#ad6333','font-size':20});t.textContent='连接被遮挡 · 拉开重叠对象';group.append(t);}
          else{
            const d=r.points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '),kind=colors[r.edge.kind]?r.edge.kind:'main';
            group.append(make('path',{d,class:'connection-hit',fill:'none',stroke:'transparent','stroke-width':14,'vector-effect':'non-scaling-stroke'}));
            const path=make('path',{d,class:'connection-line',fill:'none',stroke:colors[kind],'stroke-width':2,'vector-effect':'non-scaling-stroke','marker-end':'url(#canvas-arrow-'+kind+')','stroke-linejoin':'round','stroke-linecap':'round'});if(kind==='exception')path.setAttribute('stroke-dasharray','8 6');group.append(path);
            if(r.label){const l=r.label;group.append(make('rect',{class:'connection-label',x:l.x,y:l.y,width:l.width,height:l.height,rx:7,fill:'#fff',stroke:'#dce5e4','stroke-width':1}));const text=make('text',{'text-anchor':'middle',fill:colors[kind],'font-size':l.font,'font-family':'-apple-system, PingFang SC, sans-serif'});l.lines.forEach((line,i)=>{const span=make('tspan',{x:l.x+l.width/2,y:l.y+10+l.font+i*(l.font+5)});span.textContent=line;text.append(span);});group.append(text);}
          }
          group.addEventListener('pointerdown',event=>{if(event.button!==0||host.panning())return;event.stopPropagation();event.preventDefault();choose(r.id);stage.focus();});
          group.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();startInline(r.id,worldPoint(event));});
          group.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();choose(r.id);});
          group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();choose(r.id);if(event.key==='Enter')startInline(r.id);}});svg.append(group);
        }
      }
      syncLayers();updateSelection();editor();positionInline();updateHint();
    }
    function schedule(){if(!queued)queued=requestAnimationFrame(render);}
    function drawPorts(node){
      portLayer.replaceChildren();if(!node||!host.canEdit())return;const zoom=host.state().viewport.zoom;
      for(const side of sides){const p=midpoint(node,side);portLayer.append(make('circle',{cx:p.x,cy:p.y,r:6/zoom,fill:target===node.id?'#e6f5ef':'#fff',stroke:target===node.id?'#2e8465':'#7184cf','stroke-width':1.7/zoom,'data-connection-port':side,'data-node-id':node.id,role:'button','aria-label':(node.name||'对象')+' · '+sideNames[side]+'侧连接点'}));}
    }
    function ghost(e){
      const origin=source||drag?.fixed,node=stateNode(origin);if(!node)return;
      const hit=nodeAt(e),candidate=hit&&hit.id!==origin&&!hit.locked?hit:null;target=candidate?.id||null;syncLayers();drawPorts(candidate||node);
      const q=worldPoint(e),toSide=candidate?nearestSide(candidate,q):'auto';
      const existing=drag&&!drag.creating?host.state().edges?.find(e=>e.id===drag.id):null;
      const cfg=existing?{...existing,fromInstanceId:drag.end==='from'?candidate?.id:existing.fromInstanceId,toInstanceId:drag.end==='to'?candidate?.id:existing.toInstanceId,[drag.end==='from'?'fromPort':'toPort']:toSide}:{id:'preview',fromInstanceId:origin,toInstanceId:candidate?.id,fromPort:sourceSide,toPort:toSide};
      let points=candidate?root.CanvasConnections.routeEdges(host.state().nodes,[cfg],{zoom:host.state().viewport.zoom})[0]?.points:null;
      if(!points?.length){const p=midpoint(node,sourceSide==='auto'?nearestSide(node,q):sourceSide);points=[p,{x:(p.x+q.x)/2,y:p.y},{x:(p.x+q.x)/2,y:q.y},q];}
      preview.replaceChildren(make('path',{d:points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '),fill:'none',stroke:candidate?'#2e8465':'#6475ce','stroke-width':2,'stroke-dasharray':'5 5','vector-effect':'non-scaling-stroke'}));
    }
    stage.addEventListener('pointerdown',e=>{
      if(e.button!==0||host.panning()||e.target.closest('.floating'))return;
      const handle=e.target.closest('[data-connection-end]');if(handle&&selected&&host.canEdit()){finishInline(true);const now=edge();drag={id:now.id,end:handle.dataset.connectionEnd,fixed:handle.dataset.connectionEnd==='from'?now.toInstanceId:now.fromInstanceId};e.preventDefault();e.stopImmediatePropagation();updateHint();return;}
      if(host.tool()==='connect'&&host.canEdit()){
        const n=nodeAt(e);e.preventDefault();e.stopImmediatePropagation();if(!n||n.locked){clearPreview();return;}
        const port=e.target.closest('[data-connection-port]')?.dataset.connectionPort||'auto';
        if(source&&source!==n.id){add(source,n.id,{fromPort:sourceSide,toPort:port==='auto'?nearestSide(n,worldPoint(e)):port});return;}source=n.id;sourceSide=port;drag={creating:true};syncLayers();drawPorts(n);updateHint();return;
      }
      if(!e.target.closest('#canvas-connections')&&selected){finishInline(true);selected=null;toolbar.hidden=true;schedule();}
    },true);
    document.addEventListener('pointermove',e=>{
      lastPointer=e;if(source||drag){if(!previewFrame)previewFrame=requestAnimationFrame(()=>{previewFrame=0;if(source||drag)ghost(lastPointer);});return;}
      if(host.tool()==='connect'&&host.canEdit()){const n=nodeAt(e);if(n?.id!==hovered){hovered=n?.id||null;drawPorts(n&&!n.locked?n:null);}}
    });
    document.addEventListener('pointerup',e=>{
      if(!drag)return;const pending=drag,n=nodeAt(e);
      if(pending.creating){drag=null;if(n&&source&&n.id!==source&&!n.locked)add(source,n.id,{fromPort:sourceSide,toPort:nearestSide(n,worldPoint(e))});updateHint();return;}
      if(n&&n.id!==pending.fixed&&!n.locked&&host.canEdit())update(pending.id,{[pending.end==='from'?'fromInstanceId':'toInstanceId']:n.id,[pending.end==='from'?'fromPort':'toPort']:nearestSide(n,worldPoint(e))});clearPreview();schedule();
    });
    const cancel=()=>{clearPreview();schedule();};document.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('beforeunload',()=>finishInline(true));
    document.addEventListener('keydown',e=>{
      if(e.isComposing||e.target.matches('input,select,textarea')||e.target.isContentEditable)return;
      if(e.key==='Escape'&&(source||drag||selected||host.tool()==='connect')){e.preventDefault();e.stopImmediatePropagation();finishInline(false);selected=null;toolbar.hidden=true;clearPreview();host.setTool('select');schedule();}
      else if((e.key==='Delete'||e.key==='Backspace')&&selected){e.preventDefault();e.stopImmediatePropagation();remove();}
      else if((e.key==='Enter'||e.key==='F2')&&selected){e.preventDefault();e.stopImmediatePropagation();startInline(selected);}
      else if(!e.metaKey&&!e.ctrlKey&&e.key.toLowerCase()==='l'&&host.canEdit()){e.preventDefault();host.setTool('connect');}
    },true);
    return {schedule,render,add,update,remove,clear:()=>{finishInline(true);selected=null;clearPreview();toolbar.hidden=true;schedule();},setTool(value){if(value!==currentTool){currentTool=value;clearPreview();if(value==='connect'){finishInline(true);selected=null;clearNodes();toolbar.hidden=true;}}updateHint();},getRoutes:()=>routes,getSelection:()=>selected};
  };
})(globalThis);
