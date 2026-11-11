/** Inert review overlay. Never installs telemetry or alters business handlers. */
import {validateTrackingManifest,reviewScreens,eventScreenId,anchorSelector,operationLabels,chineseName,parameterType} from './model.js';
import {downloadTrackingWorkbook} from './excel.js';
export {validateTrackingManifest} from './model.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shown=el=>Boolean(el?.getClientRects().length)&&el.ownerDocument.defaultView.getComputedStyle(el).visibility!=='hidden';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const icon='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></svg>';
export class TrackingReview {
  constructor(shell){
    this.shell=shell;this.events=[];this.screens=[];this.omitted=[];this.manifest=null;
    this.error='';this.active='';this.scope='all';this.generation=0;this.boundFrames=new Map();this.frameRoots=new WeakMap();this.markers=[];
    this.layer=document.getElementById('trackingMarkerLayer');this.lastContextKey='';this.loading=false;this.hasManifest=false;this.navigationToken=0;this.statusSignature='';
    document.addEventListener('pointerdown',event=>{for(const menu of this.shell.annotationDrawerBody?.querySelectorAll('.tracking-picker[open],.tracking-more[open],.tracking-state[open]')||[])if(!menu.contains(event.target))menu.open=false;});
    this.layer?.addEventListener('click',event=>{const marker=event.target.closest('[data-track-event]');if(marker){event.preventDefault();this.select(marker.dataset.trackEvent);}});
  }
  context(){const s=this.shell;return {projectId:s.activeProjectId,pageId:s.activePageId,version:s.activeVersion};}
  key(){return Object.values(this.context()).join('/');}
  visible(){return this.shell.shouldShowDocumentDrawer()&&this.shell.docDrawerMode==='tracking';}
  async load(){
    const token=++this.generation,context=this.context();this.navigationToken++;
    this._loadAbort?.abort();this._loadAbort=new AbortController();
    this.events=[];this.screens=[];this.omitted=[];this.manifest=null;this.error='';this.active='';this.scope='all';this.frameRoots=new WeakMap();
    this.loading=true;this.hasManifest=false;this.undoId='';this.editError='';this.lastContextKey=this.key();this.clear();this.render();
    if(!context.projectId||!context.pageId||!context.version){this.loading=false;this.render();return;}
    try{
      let data;
      if(this.shell.isShareMode){const meta=this.shell.shareConfig.mode==='folder'?this.shell.getActiveFolderSharePageMeta(context.pageId,context.version):this.shell.shareConfig;data=meta?.tracking||null;}
      else{
        const base=Object.values(context).map(encodeURIComponent).join('/');
        const response=await fetch(`/src/pages/${base}/tracking/events.json?t=${Date.now()}`,{signal:this._loadAbort.signal,cache:'no-store'});
        if(response.status===404)data=null;else{if(!response.ok)throw Error('埋点清单加载失败');data=await response.json();}
      }
      if(token!==this.generation)return;
      if(data){this.manifest=validateTrackingManifest(data,context);this.hasManifest=true;this.events=data.events;this.screens=reviewScreens(data);this.omitted=Array.isArray(data.omitted)?data.omitted:[];}
    }catch(error){if(token!==this.generation||error.name==='AbortError')return;this.error=error.message||'埋点数据不可用';}
    this.loading=false;this.render();this.bindFrames();this.paint();
  }
  start(){
    if(this._tick){this.bindFrames();this.paint();return;}
    this.stop();
    this._tick=window.setInterval(()=>{
      if(!this.visible()){this.stop();return;}
      if(this.key()!==this.lastContextKey){this.load();return;}
      this.bindFrames();this.paint();this.updateStatuses();
    },300);
    this.bindFrames();this.paint();
  }
  stop(){if(this._tick)window.clearInterval(this._tick);this._tick=null;this.navigationToken++;for(const controller of this.boundFrames.values())controller.abort();this.boundFrames.clear();this.clear();}
  clear(){this.layer?.replaceChildren();this.markers=[];}
  frameFor(target){
    if(target.kind==='page'){
      if(this.shell.isInfiniteCanvasPage())return null;
      const iframe=this.shell.mainIframe;return iframe?{iframe,type:'page'}:null;
    }
    if(!this.shell.isInfiniteCanvasPage())return null;
    const frame=this.shell.getCanvasBoardFrame(target.nodeId||target.boardId);
    return frame?.boardId===target.boardId&&frame.iframe?{...frame,type:'canvas-board'}:null;
  }
  resolveFrame(target){
    const ctx=this.frameFor(target);if(!ctx)return null;
    try{
      ctx.document=ctx.iframe.contentDocument;ctx.window=ctx.iframe.contentWindow;
      if(!ctx.document)return null;
      if(!this.frameRoots.has(ctx.iframe)){
        let entry=target.kind==='canvas-board'?`boards/${target.boardId}/index.html`:'index.html';
        const initial=new URL(ctx.iframe.src,location.href);
        if(!initial.pathname.endsWith('/'+entry)&&initial.pathname.endsWith('/'+target.path))entry=target.path;
        if(initial.pathname.endsWith('/'+entry))this.frameRoots.set(ctx.iframe,new URL(initial.href.slice(0,initial.href.indexOf(initial.pathname))+initial.pathname.slice(0,-entry.length)));
      }
      return ctx;
    }catch{return null;}
  }
  screenFor(event){return this.screens.find(s=>s.id===eventScreenId(event));}
  targetScreen(target){return target.screenId?this.screens.find(s=>s.id===target.screenId):null;}
  matchesScreen(ctx,screen,path){
    try{
      const root=this.frameRoots.get(ctx.iframe),current=new URL(ctx.window.location.href);
      if(root){const expected=new URL(path,root);if(current.origin!==expected.origin||current.pathname!==expected.pathname)return false;}
      else if(!decodeURIComponent(current.pathname).endsWith('/'+path))return false;
      if(screen?.route?.hash!==undefined&&current.hash!==screen.route.hash)return false;
      if(screen?.route?.search!==undefined&&current.search!==screen.route.search)return false;
      if(screen?.anchor){const matches=ctx.document.querySelectorAll(anchorSelector(screen.anchor));if(matches.length!==1||!shown(matches[0]))return false;}
      return true;
    }catch{return false;}
  }
  resolveElement(target,screen=this.targetScreen(target)){
    const ctx=this.resolveFrame(target);
    if(!ctx||!this.matchesScreen(ctx,screen,target.path))return null;
    try{const root=screen?.anchor?ctx.document.querySelector(anchorSelector(screen.anchor)):ctx.document;const selector=anchorSelector(target.anchor);const matches=[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)].filter(shown);if(matches.length!==1)return null;return {element:matches[0],ctx};}catch{return null;}
  }
  locationTargets(event){
    const screen=this.screenFor(event);
    return event.targets.length?event.targets:screen?.anchor?[{kind:screen.boardId?'canvas-board':'page',...screen}]:[];
  }
  resolved(event){const screen=this.screenFor(event);return this.locationTargets(event).map(t=>this.resolveElement(t,screen)).find(Boolean);}
  bindFrames(){
    if(!this.visible())return;const current=new Set();
    // One listener per live document; rebinding follows full-page navigation.
    for(const event of this.events)for(const target of event.targets){
      const ctx=this.resolveFrame(target);if(!ctx?.document?.body)continue;const doc=ctx.document;current.add(doc);
      if(this.boundFrames.has(doc))continue;
      const controller=new AbortController();
      doc.addEventListener('click',e=>{
        if(!this.visible()||this.replaying)return;
        const ids=this.findAt(e.target,doc);
        if(ids.length)this.select(ids[0],{navigate:false});
        // Business navigation deliberately continues, including tracked links.
      },{capture:true,signal:controller.signal});
      this.boundFrames.set(doc,controller);
    }
    for(const [doc,controller]of this.boundFrames)if(!current.has(doc)){controller.abort();this.boundFrames.delete(doc);}
  }
  findAt(node,doc){
    const found=[];
    if(!(node instanceof doc.defaultView.Element))return found;
    for(const event of this.events)if(event.controlType!=='page')for(const target of event.targets){const match=this.resolveElement(target,this.screenFor(event));if(match?.ctx.document===doc&&(match.element===node||match.element.contains(node))){found.push({id:event.id,element:match.element});break;}}
    // Prefer the inner control when page/section wrappers also have a binding.
    found.sort((a,b)=>a.element===b.element?0:a.element.contains(b.element)?1:b.element.contains(a.element)?-1:0);
    return found.map(x=>x.id);
  }
  async locate(event,token){
    const screen=this.screenFor(event),target=event.targets[0]|| (screen?{kind:screen.boardId?'canvas-board':'page',...screen}:null);
    if(!target)return null;
    let ctx=this.resolveFrame(target);if(!ctx)return null;
    if(ctx.nodeId)try{this.shell.mainIframe.contentWindow.protaCanvas?.focus([ctx.nodeId]);}catch{}
    let found=this.resolved(event);if(found)return found;
    // Dynamic demos can render a review scene without replaying form submissions.
    // The page owns its scene setup; the shell still verifies the declared anchors.
    try{
      if(screen&&this.matchesScreen(ctx,null,target.path)&&typeof ctx.window.protaTrackingReview?.revealScreen==='function'){
        this.replaying=true;
        try{await ctx.window.protaTrackingReview.revealScreen(screen.id);}finally{this.replaying=false;}
        if(token!==this.navigationToken||!this.visible())return null;
        found=this.resolved(event);if(found)return found;
      }
    }catch{this.replaying=false;}
    if(!this.matchesScreen(ctx,screen,target.path)){
      const root=this.frameRoots.get(ctx.iframe);
      if(!root)return null;
      const url=new URL(target.path,root);url.hash=screen?.route?.hash||'';url.search=screen?.route?.search||'';
      let navigatedFrame=ctx.iframe;
      navigatedFrame.src=url.href;
      const deadline=Date.now()+5000;
      while(Date.now()<deadline){
        if(token!==this.navigationToken||!this.visible())return null;
        await wait(60);ctx=this.resolveFrame(target);
        if(ctx&&ctx.iframe!==navigatedFrame){navigatedFrame=ctx.iframe;navigatedFrame.src=url.href;}
        if(ctx?.document?.readyState==='complete'&&ctx.window.location.href===url.href)break;
      }
      for(const step of screen?.navigation||[]){
        let element=null;const until=Date.now()+2000;
        while(Date.now()<until&&!element){if(token!==this.navigationToken)return null;ctx=this.resolveFrame(target);try{const matches=ctx.document.querySelectorAll(anchorSelector(step.anchor));if(matches.length===1&&shown(matches[0]))element=matches[0];}catch{}if(!element)await wait(60);}
        if(!element)return null;this.replaying=true;try{element.click();}finally{this.replaying=false;}await wait(60);
      }
    }
    const deadline=Date.now()+2000;
    while(Date.now()<deadline){if(token!==this.navigationToken||!this.visible())return null;found=this.resolved(event);if(found)return found;await wait(60);}
    return null;
  }
  async select(id,{navigate=true}={}){
    const event=this.events.find(e=>e.id===id);if(!event)return;
    const token=++this.navigationToken;this.active=id;
    if(this.scope!=='all'&&this.scope!==eventScreenId(event))this.scope=eventScreenId(event);
    this.render();this.paint();
    this.shell.annotationDrawerBody?.querySelector(`[data-tracking-card="${id}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});
    const found=navigate?await this.locate(event,token):null;
    if(token!==this.navigationToken)return;
    if(found){
      this.shell.scrollAnnotationTargetInsideLocalContainer(found.element,found.ctx.window);
      if(navigate)this.shell.showToast(event.targets.length?'已定位到埋点位置':'已定位到埋点所在页面');
    }else if(navigate){
      this.shell.showToast(event.targets.length?'当前无法定位到这条埋点的位置':event.controlType==='page'?'这条页面事件没有绑定具体位置':'这条逻辑事件没有绑定具体控件',true);
    }
    this.paint();this.updateStatuses();
  }
  async edit(action,id){
    if(this.shell.isShareMode||this.saving)return;
    const key=this.key(),expected=this.manifest;
    this.saving=true;this.editError='';this.render();
    try{
      const response=await fetch('/api/tracking/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope:this.context(),expectedManifest:expected,action,id})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'保存失败，请重试');
      if(key!==this.key())return;
      this.manifest=validateTrackingManifest(result.manifest,this.context());this.events=this.manifest.events;this.screens=reviewScreens(this.manifest);
      if(action==='delete_event'){this.undoId=id;this.undoTitle=expected.events.find(e=>e.id===id)?.title;if(this.active===id)this.active='';}
      if(action==='restore_event')this.undoId='';
    }catch(error){if(key===this.key())this.editError=error.message;}
    finally{this.saving=false;if(key===this.key()){this.render();this.bindFrames();this.paint();}}
  }
  status(event){
    if(event.reviewStatus==='valid')return '';
    const screen=this.screenFor(event);
    if(event.reviewStatus==='needs_review'||event.targets.some(t=>t.status==='needs_review')||(!screen?.reviewedByUser&&screen?.status==='needs_review'))return '需核对';
    if(!event.targets.length||this.resolved(event))return '';
    const current=event.targets.some(t=>{const ctx=this.resolveFrame(t);return ctx&&this.matchesScreen(ctx,screen,t.path);});
    return current?'控件未显示':'';
  }
  updateStatuses(){
    const body=this.shell.annotationDrawerBody;if(!body)return;
    for(const event of this.events){
      const el=body.querySelector(`[data-tracking-status="${event.id}"]`);if(!el)continue;
      const status=this.status(event);el.textContent=status;const state=el.closest('.tracking-state');if(state){state.hidden=!status;if(!status)state.open=false;}
    }
  }
  managementMenu(id){
    if(this.shell.isShareMode)return '';
    return `<details class="tracking-more"><summary aria-label="更多事件操作" title="更多事件操作"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></summary><div class="tracking-micro-panel"><button type="button" class="tracking-remove-action" data-review-action="delete_event" data-review-id="${esc(id)}" ${this.saving?'disabled':''}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg><span>删除事件</span></button></div></details>`;
  }
  statusControl(id,kind,status){
    if(this.shell.isShareMode)return `<span class="tracking-status needs-review" ${status?'':'hidden'}>${esc(status)}</span>`;
    return `<details class="tracking-state" ${status?'':'hidden'}><summary aria-label="${kind==='screen'?'页面状态':'事件状态'}"><span data-tracking-status="${esc(id)}">${esc(status)}</span><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m4 6 4 4 4-4"/></svg></summary><div class="tracking-micro-panel"><button type="button" data-tracking-confirm="${esc(id)}" data-review-action="valid_${kind}" data-review-id="${esc(id)}" ${this.saving?'disabled':''}><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 8 3 3 7-7"/></svg>确认有效</button></div></details>`;
  }
  pagePicker(){
    const selected=this.screens.find(screen=>screen.id===this.scope);
    return `<details class="tracking-picker"><summary id="trackingPageFilter" aria-label="筛选页面"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8m-8 4h5"/></svg><span>${esc(selected?.title||'全部页面')}</span><svg class="tracking-picker__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m7 10 5 5 5-5"/></svg></summary><div class="tracking-picker__panel"><input type="search" aria-label="搜索页面" placeholder="搜索页面" autocomplete="off"><div class="tracking-picker__options" role="listbox" aria-label="页面"><button type="button" role="option" aria-selected="${this.scope==='all'}" data-page-option="all">全部页面</button>${this.screens.map(screen=>`<button type="button" role="option" aria-selected="${this.scope===screen.id}" data-page-option="${esc(screen.id)}">${esc(screen.title)}</button>`).join('')}</div><p class="tracking-picker__no-results" hidden>没有匹配的页面</p></div></details>`;
  }
  paint(){
    if(!this.layer)return;if(!this.visible()){this.clear();return;}
    const fragment=document.createDocumentFragment();this.markers=[];const positions=new Map();
    this.events.forEach((event,index)=>{
      if(this.scope!=='all'&&this.scope!==eventScreenId(event))return;
      const screen=this.screenFor(event);
      for(const target of event.targets){
        if(target.status==='needs_review'&&event.reviewStatus!=='valid')continue;
        const resolved=this.resolveElement(target,screen);if(!resolved)continue;
        const g=this.shell.getMarkerGeometry(resolved.element,resolved.ctx);if(!g||!Number.isFinite(g.left)||!Number.isFinite(g.top))continue;
        const key=`${Math.round(g.left)},${Math.round(g.top)}`,stack=positions.get(key)||0;positions.set(key,stack+1);
        const marker=document.createElement('button');marker.type='button';marker.className='tracking-marker'+(this.active===event.id?' is-active':'');marker.dataset.trackEvent=event.id;
        marker.textContent=String(index+1).padStart(2,'0');marker.title=`${event.title}\n${event.name}`;marker.setAttribute('aria-label',`查看埋点 ${event.title}`);
        marker.style.left=`${g.left+stack*30}px`;marker.style.top=`${g.top}px`;fragment.appendChild(marker);
      }
    });this.layer.replaceChildren(fragment);
  }
  copyableKey(event){
    const labels=['分类','业务线','页面名','区块名','元素名'];
    return `<code class="tracking-event-key">${event.name.split('_').map((part,index)=>`${index?'<span class="tracking-key-separator" aria-hidden="true">_</span>':''}<button type="button" class="tracking-key-part" data-tracking-copy="${esc(part)}" title="复制${labels[index]||'名称'}：${esc(part)}" aria-label="复制${labels[index]||'名称'} ${esc(part)}">${esc(part)}</button>`).join('')}<button type="button" class="tracking-copy-full" data-tracking-copy="${esc(event.name)}" title="复制完整 ID" aria-label="复制完整 ID"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg></button></code>`;
  }
  parameterTable(event){
    const rows=event.parameters.map(p=>[p.name,parameterType(p),[p.meaning||p.description||p.source,p.allowedValues?.join(' / '),p.notes,p.operation?'适用操作：'+p.operation:''].filter(Boolean).join('\n')]);
    const cell=(value,index)=>`<td><button type="button" class="tracking-cell-copy" data-tracking-copy="${esc(value)}" title="复制此格内容" aria-label="复制${['字段名','字段类型','字段含义和取值'][index]} ${esc(value)}">${index===0?`<code>${esc(value)}</code>`:index===2?`${esc(value.split('\n')[0])}${value.includes('\n')?`<span class="tracking-param-notes">${esc(value.split('\n').slice(1).join('\n'))}</span>`:''}`:esc(value)}</button></td>`;
    return `<div class="tracking-table-wrap"><table><thead><tr><th>上报字段</th><th>类型</th><th>含义 / 取值 <button type="button" class="tracking-copy-table" data-tracking-copy="${esc(['上报字段\t类型\t含义 / 取值',...rows.map(row=>row.map(value=>value.replace(/\n/g,'；')).join('\t'))].join('\n'))}" title="复制参数表" aria-label="复制参数表"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg></button></th></tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  card(event){
    const index=this.events.indexOf(event),active=this.active===event.id,status=this.status(event);
    return `<article class="tracking-card${active?' is-active':''}" data-tracking-card="${esc(event.id)}"><div class="tracking-card__heading"><button class="tracking-card__title" type="button" data-tracking-event="${esc(event.id)}" aria-label="定位 ${esc(event.title)}" title="定位到对应页面和控件"><span class="tracking-number">${String(index+1).padStart(2,'0')}</span><strong>${esc(event.title)}</strong></button>${this.statusControl(event.id,'event',status)}${this.managementMenu(event.id)}</div><div class="tracking-card__content"><div class="tracking-id-row">${this.copyableKey(event)}<span class="tracking-operation">${esc(operationLabels(event))}</span></div>${event.registrationId?`<span class="tracking-registration">平台 ID ${esc(event.registrationId)}</span>`:''}<details class="tracking-rationale"><summary aria-label="展开事件说明"><svg class="tracking-disclosure-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 5 5 5-5 5"/></svg><span class="tracking-trigger">${esc(event.trigger?.when)}</span></summary><div class="tracking-rationale__body">${this.manifest?.naming?`<dl class="tracking-config"><dt>业务线</dt><dd>${esc(this.manifest.naming.business.label)}</dd><dt>控件类型</dt><dd>${event.controlType==='page'?'页面':'元素'}</dd>${event.block?`<dt>区块</dt><dd>${esc(event.block.label)}</dd><dt>元素</dt><dd>${esc(event.element.label)}</dd>`:''}<dt>埋点中文</dt><dd>${esc(chineseName(this.manifest,event))}</dd></dl>`:''}<p>${esc(event.purpose)}</p><p>${esc(event.question)}</p><p>${esc(event.decision)}</p></div></details>${event.parameters?.length?this.parameterTable(event):''}</div></article>`;
  }
  render(){
    if(!this.visible())return;const s=this.shell,body=s.annotationDrawerBody,meta=s.annotationDrawerMeta;if(!body||!meta)return;
    for(const btn of [s.prdAiBtn,s.prdEditBtn,s.prdSaveBtn,s.prdCancelEditBtn,s.prdOpenNewTabBtn,s.prdDownloadBtn,s.prdExpandBtn])if(btn)btn.hidden=true;
    if(s.docDrawerTitle)s.docDrawerTitle.textContent='埋点方案';if(s.docDrawerEyebrow)s.docDrawerEyebrow.textContent='';meta.replaceChildren();
    const downloadButton=`<button type="button" class="tracking-download" data-tracking-download title="下载 Excel" aria-label="下载 Excel">${icon}</button>`;
    const bindDownload=()=>body.querySelector('[data-tracking-download]')?.addEventListener('click',()=>downloadTrackingWorkbook(this.manifest));
    if(this.loading){body.innerHTML='<div class="tracking-empty" role="status"><h4>正在读取埋点方案</h4></div>';return;}
    if(this.error){body.innerHTML=`<div class="tracking-empty"><h4>埋点方案暂时无法显示</h4><p>${esc(this.error)}</p><button type="button" data-tracking-retry>重试</button></div>`;body.querySelector('[data-tracking-retry]').onclick=()=>this.load();return;}
    if(!this.hasManifest){body.innerHTML=`<div class="tracking-empty tracking-empty--onboarding"><div class="tracking-empty__art" aria-hidden="true"><svg width="256" height="138" viewBox="0 0 256 138" fill="none"><rect x="38" y="13" width="142" height="110" rx="12" fill="var(--bg-primary,#fff)" stroke="var(--border-color,#e5e6eb)"/><path d="M54 33h45m-45 9h74" stroke="var(--border-color,#e5e6eb)" stroke-width="4" stroke-linecap="round"/><rect x="54" y="61" width="110" height="22" rx="5" fill="var(--accent-glow,#f0edff)"/><rect x="54" y="93" width="70" height="5" rx="2.5" fill="var(--bg-secondary,#f2f2f5)"/><path d="M166 72h23a9 9 0 0 0 9-9V49" stroke="var(--accent,#7c6cff)" stroke-dasharray="3 4"/><rect x="178" y="22" width="44" height="29" rx="8" fill="var(--accent,#7c6cff)"/><path d="m191 37 5 4 10-11" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="54" cy="72" r="4" fill="var(--accent,#7c6cff)"/></svg></div><h4>从关键行为开始</h4><p>筛选值得记录的事件，<br>在原型上逐一核对。</p>${!s.isShareMode?'<button type="button" class="tracking-empty__primary" data-tracking-generate><span aria-hidden="true">+</span>生成埋点方案</button>':''}</div>`;
      body.querySelector('[data-tracking-generate]')?.addEventListener('click',async()=>{
        s.agentActiveSkill=s.getAgentSkill?.('demo-event-tracking')||null;s.openAgentWorkbench?.();await s.ensureAgentSession?.({sessionScope:'page'});
        if(s.agentInput){s.agentInput.value='/demo-event-tracking 请分析当前版本所有画板、页面跳转、路由及弹窗状态，按公司埋点规范生成完整方案。';s.renderAgentWorkbench?.();s.agentInput.focus();}
      });return;
    }
    if(!this.screens.length){body.innerHTML=`<div class="tracking-page-filter">${downloadButton}</div>${this.undoId?`<div class="tracking-undo" role="status"><span>事件已删除</span><button type="button" data-last-undo>撤销</button></div>`:''}<div class="tracking-empty"><h4>当前版本无需新增埋点</h4><p>已完成分析，暂无需要保留的事件。</p></div>`;bindDownload();body.querySelector('[data-last-undo]')?.addEventListener('click',()=>this.edit('restore_event',this.undoId));return;}
    const screens=this.screens.filter(screen=>this.scope==='all'||this.scope===screen.id);
    body.innerHTML=`<div class="tracking-page-filter">${this.pagePicker()}${downloadButton}</div>${this.editError?`<div class="tracking-edit-error" role="alert">${esc(this.editError)}<button type="button" data-tracking-reload>重新加载</button></div>`:''}${this.undoId?`<div class="tracking-undo" role="status"><span>已删除「${esc(this.undoTitle)}」</span><button type="button" data-review-action="restore_event" data-review-id="${esc(this.undoId)}">撤销</button></div>`:''}<div class="tracking-groups">${screens.map(screen=>{
      const events=this.events.filter(event=>eventScreenId(event)===screen.id);
      return `<section class="tracking-group"><header class="tracking-group__heading"><h4>${esc(screen.title)}</h4>${this.statusControl(screen.id,'screen',screen.status==='needs_review'?'待分析':'')}</header>${screen.status==='needs_review'&&screen.reason?`<p class="tracking-coverage-note">${esc(screen.reason)}</p>`:''}${events.map(event=>this.card(event)).join('')||`<p class="tracking-no-events">${screen.status==='reviewed'?'已分析，无需新增埋点':'尚未完成此页面的埋点分析'}</p>`}</section>`;
    }).join('')}</div>${this.omitted.length?`<details class="tracking-omitted"><summary>未纳入的事件</summary>${this.omitted.map(x=>`<p>${esc(x.candidate)}：${esc(x.reason)}</p>`).join('')}</details>`:''}`;
    bindDownload();
    body.querySelectorAll('.tracking-more,.tracking-state').forEach(menu=>{menu.addEventListener('toggle',()=>{if(menu.open)for(const other of body.querySelectorAll('.tracking-more[open],.tracking-state[open],.tracking-picker[open]'))if(other!==menu)other.open=false;});menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();}});});
    body.querySelectorAll('[data-tracking-copy]').forEach(button=>button.onclick=async()=>{
      try{await navigator.clipboard.writeText(button.dataset.trackingCopy);const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;button.animate([{opacity:1,transform:'translateY(0)'},{opacity:.65,transform:reduced?'translateY(0)':'translateY(.5px)'},{opacity:1,transform:'translateY(0)'}],{duration:150,easing:'ease-out'});}
      catch{this.shell.showToast('复制失败，请重试',true);}
    });
    const picker=body.querySelector('.tracking-picker');
    picker?.addEventListener('toggle',()=>{if(picker.open)picker.querySelector('input').focus();});
    picker?.querySelector('input').addEventListener('input',event=>{
      let count=0;for(const option of picker.querySelectorAll('[data-page-option]')){option.hidden=!option.textContent.toLowerCase().includes(event.target.value.toLowerCase());if(!option.hidden)count++;}
      picker.querySelector('.tracking-picker__no-results').hidden=count>0;
    });
    picker?.addEventListener('keydown',event=>{
      const options=[...picker.querySelectorAll('[data-page-option]:not([hidden])')];
      if(event.key==='Escape'){picker.open=false;picker.querySelector('summary').focus();}
      if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const i=options.indexOf(document.activeElement);options[(i+(event.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();}
    });
    body.querySelectorAll('[data-page-option]').forEach(button=>button.onclick=()=>{this.scope=button.dataset.pageOption;this.render();this.paint();body.querySelector('#trackingPageFilter')?.focus();});
    body.querySelectorAll('[data-review-action]').forEach(button=>button.onclick=()=>this.edit(button.dataset.reviewAction,button.dataset.reviewId));
    body.querySelector('[data-tracking-reload]')?.addEventListener('click',()=>this.load());
    body.querySelectorAll('[data-tracking-card]').forEach(card=>card.onclick=event=>{
      // Keep rationale controls and text selection usable without navigating.
      if(event.target.closest('details,a,input,select,textarea,.tracking-event-key,button:not([data-tracking-event])'))return;
      if(window.getSelection()?.toString())return;
      this.select(card.dataset.trackingCard);
    });
  }
}
