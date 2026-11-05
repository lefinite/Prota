/**
 * Prota Demo tracking review. No collection, SDK or backend writes.
 * Review state lives in Portal, never in generated business CSS/JS.
 */
export function validateTrackingManifest(data, scope) {
  if (!data || data.schemaVersion !== 1 || !data.scope || !Array.isArray(data.events) || data.events.length > 12) {
    throw new Error('埋点清单格式无效');
  }
  for (const key of ['projectId', 'pageId', 'version']) {
    if (data.scope[key] !== scope[key]) throw new Error('埋点清单与当前页面版本不匹配');
  }
  const ids = new Set();
  for (const event of data.events) {
    if (!/^[a-z][a-z0-9_]*$/.test(event.id || '') || ids.has(event.id) || !Array.isArray(event.targets)) {
      throw new Error('埋点事件 ID 重复或无效');
    }
    ids.add(event.id);
    for (const t of event.targets) {
      if (!['page', 'canvas-board'].includes(t.kind) || !t.anchor || !['data-attribute', 'selector'].includes(t.anchor.method)) throw new Error('埋点目标格式无效');
      if (t.kind === 'page' && t.path !== 'index.html') throw new Error('页面目标路径无效');
      if (t.kind === 'canvas-board' && (!t.boardId || t.path !== `boards/${t.boardId}/index.html`)) throw new Error('画板目标路径无效');
    }
  }
  return data;
}
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const cssQuote = value => '"' + String(value).replace(/[\\"]/g, '\\$&') + '"';

export class TrackingReview {
  constructor(shell) {
    this.shell = shell;
    this.events = [];
    this.omitted = [];
    this.error = '';
    this.active = '';
    this.inspect = true;
    this.scope = 'all';
    this.generation = 0;
    this.boundFrames = new Map();
    this.markers = [];
    this.layer = document.getElementById('trackingMarkerLayer');
    this._tick = null;
    this._loadAbort = null;
    this.lastContextKey = '';
    this.layer?.addEventListener('click', event => {
      const marker = event.target.closest('[data-track-event]');
      if (!marker) return;
      event.preventDefault();
      this.select(marker.dataset.trackEvent);
    });
  }
  context() {
    const s = this.shell;
    return {projectId:s.activeProjectId, pageId:s.activePageId, version:s.activeVersion};
  }
  key() {return Object.values(this.context()).join('/');}
  visible() { return this.shell.shouldShowDocumentDrawer() && this.shell.docDrawerMode === 'tracking'; }
  async load() {
    const token = ++this.generation, context = this.context();
    this._loadAbort?.abort();
    this._loadAbort = new AbortController();
    this.events = []; this.omitted = []; this.error = ''; this.active = '';
    this.lastContextKey = this.key();
    this.render();
    if (!context.projectId || !context.pageId || !context.version) return;
    try {
      let data;
      if (this.shell.isShareMode) {
        const meta = this.shell.shareConfig.mode === 'folder'
          ? this.shell.getActiveFolderSharePageMeta(context.pageId,context.version)
          : this.shell.shareConfig;
        data = meta?.tracking || null;
      } else {
        const base = [context.projectId,context.pageId,context.version].map(encodeURIComponent).join('/');
        const response = await fetch(`/src/pages/${base}/tracking/events.json?t=${Date.now()}`, {signal:this._loadAbort.signal, cache:'no-store'});
        if (response.status === 404) data = null;
        else {
          if (!response.ok) throw new Error('埋点清单加载失败');
          data = await response.json();
        }
      }
      if (token !== this.generation) return;
      if (data) {
        const verified = validateTrackingManifest(data,context);
        this.events = verified.events;
        this.omitted = Array.isArray(verified.omitted) ? verified.omitted : [];
      }
    } catch (error) {
      if (token !== this.generation || error.name === 'AbortError') return;
      this.error = error.message || '埋点数据不可用';
    }
    this.render();
    this.paint();
  }
  start() {
    this.stop();
    this._tick = window.setInterval(() => {
      if (!this.visible()) { this.stop(); return; }
      if (this.key() !== this.lastContextKey) { this.load(); return; }
      this.bindFrames();
      this.paint();
    }, 300);
    this.bindFrames();
    this.paint();
  }
  stop() {
    if (this._tick) window.clearInterval(this._tick);
    this._tick = null;
    for (const controller of this.boundFrames.values()) controller.abort();
    this.boundFrames.clear();
    this.clear();
  }
  clear() { if (this.layer) this.layer.replaceChildren(); this.markers = []; }
  resolveFrame(target) {
    if (target.kind === 'page') {
      if (this.shell.isInfiniteCanvasPage()) return null;
      const iframe=this.shell.mainIframe;
      try { return {iframe,document:iframe?.contentDocument,window:iframe?.contentWindow,type:'page'}; } catch {return null;}
    }
    if (!this.shell.isInfiniteCanvasPage()) return null;
    const frame = this.shell.getCanvasBoardFrame(target.nodeId || target.boardId);
    if (!frame || frame.boardId !== target.boardId || !frame.iframe) return null;
    try {return {type:'canvas-board',boardId:frame.boardId,nodeId:frame.nodeId,iframe:frame.iframe,document:frame.iframe.contentDocument,window:frame.iframe.contentWindow};} catch {return null;}
  }
  resolveElement(target) {
    const ctx=this.resolveFrame(target);
    if (!ctx?.document || !target.anchor?.value) return null;
    const selector=target.anchor.method === 'data-attribute'
      ? `[data-prota-track-id=${cssQuote(target.anchor.value)}]`
      : target.anchor.value;
    try {
      const matches=ctx.document.querySelectorAll(selector);
      if(matches.length !== 1) return null;
      return {element:matches[0],ctx};
    } catch {return null;}
  }
  bindFrames() {
    if (!this.visible()) return;
    const current=new Set();
    for (const event of this.events) for (const t of event.targets) {
      const ctx=this.resolveFrame(t);
      if (!ctx?.document || !ctx.document.body) continue;
      const doc=ctx.document;
      current.add(doc);
      if (this.boundFrames.has(doc)) continue;
      const controller=new AbortController();
      // The inspect mode is non-destructive: selecting a bound element does not
      // execute its click/submit handler. Unbound elements are unaffected.
      const capture = e => {
        if (!this.visible() || !this.inspect) return;
        const found=this.findAt(e.target,doc);
        if (!found) return;
        if (e.type === 'keydown' && !['Enter',' '].includes(e.key)) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.type === 'click' || e.type === 'keydown') this.select(found);
      };
      for(const type of ['pointerdown','pointerup','click','submit','keydown']) doc.addEventListener(type,capture,{capture:true,signal:controller.signal});
      this.boundFrames.set(doc,controller);
    }
    for (const [doc,controller] of this.boundFrames) if (!current.has(doc)) {controller.abort();this.boundFrames.delete(doc);}
  }
  findAt(node,doc) {
    if (!(node instanceof doc.defaultView.Element)) return null;
    for(const event of this.events) for(const t of event.targets) {
      const found=this.resolveElement(t);
      if(found?.ctx.document === doc && (found.element === node || found.element.contains(node))) return event.id;
    }
    return null;
  }
  select(id) {
    const event=this.events.find(x=>x.id===id);
    if(!event) return;
    this.active=id;
    const found=(event.targets||[]).map(t=>this.resolveElement(t)).find(Boolean);
    if(found) {
      const target=event.targets.find(t=>this.resolveElement(t)?.element===found.element);
      if(target?.kind==='canvas-board' && found.ctx.nodeId) {
        try {this.shell.mainIframe.contentWindow.protaCanvas?.focus([found.ctx.nodeId]);} catch {}
      }
      try {found.element.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});} catch {}
    }
    this.render();
    this.paint();
    this.shell.annotationDrawerBody?.querySelector(`[data-tracking-card=${cssQuote(id)}]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  paint() {
    if(!this.layer) return;
    if(!this.visible()) {this.clear();return;}
    const fragment=document.createDocumentFragment();
    this.markers=[];
    this.events.forEach((event,index)=>{
      if(this.scope==='current' && this.shell.isInfiniteCanvasPage()) {
        const active=this.shell.mainIframe?.contentWindow?.protaCanvas?.getActiveBoard?.();
        if(active && !event.targets.some(t=>t.boardId===active.boardId)) return;
      }
      for(const t of event.targets) {
        if(t.status==='needs_review') continue;
        const resolved=this.resolveElement(t);
        if(!resolved || !resolved.element.getClientRects().length) continue;
        const g=this.shell.getMarkerGeometry(resolved.element,resolved.ctx);
        if(!g || !Number.isFinite(g.left) || !Number.isFinite(g.top)) continue;
        const marker=document.createElement('button');
        marker.type='button';marker.className='tracking-marker'+(this.active===event.id?' is-active':'');
        marker.dataset.trackEvent=event.id;
        marker.textContent=String(index+1);
        marker.title=`${event.title} · ${event.name}`;
        marker.setAttribute('aria-label',`查看埋点 ${event.title}`);
        marker.style.left=`${g.left}px`;marker.style.top=`${g.top}px`;
        fragment.appendChild(marker);
      }
    });
    this.layer.replaceChildren(fragment);
  }
  render() {
    if(!this.visible()) return;
    const s=this.shell, body=s.annotationDrawerBody, meta=s.annotationDrawerMeta;
    if(!body||!meta)return;
    for(const btn of [s.prdAiBtn,s.prdEditBtn,s.prdSaveBtn,s.prdCancelEditBtn,s.prdOpenNewTabBtn,s.prdDownloadBtn,s.prdExpandBtn]) if(btn)btn.hidden=true;
    if(s.docDrawerTitle)s.docDrawerTitle.textContent='埋点方案';
    if(s.docDrawerEyebrow)s.docDrawerEyebrow.textContent='EVENT TRACKING';
    meta.replaceChildren();
    const info=document.createElement('span');
    info.textContent=`${this.events.length} 个建议事件 · 仅设计，不会实际上报`;
    meta.appendChild(info);
    if(this.error){body.innerHTML=`<div class="tracking-empty">${escapeHtml(this.error)}</div>`;return;}
    if(!this.events.length){
      body.innerHTML='<div class="tracking-empty">当前版本暂无埋点方案。<p>在 Agent 中运行 /demo-event-tracking 即可生成。</p></div>';
      return;
    }
    const filter=this.scope;
    body.innerHTML=`<div class="tracking-toolbar">
      <button type="button" data-tracking-action="scope">${filter==='all'?'全部事件':'当前画板'} · 切换</button>
      <button type="button" data-tracking-action="inspect">${this.inspect?'选择控件':'预览交互'}</button>
      <button type="button" data-tracking-action="reload">刷新</button>
      <button type="button" data-tracking-action="copy">复制清单</button>
    </div><div class="tracking-cards">${this.events.map((event,i)=>{
      const active=this.active===event.id;
      return `<article class="tracking-card ${active?'is-active':''}" data-tracking-card="${escapeHtml(event.id)}">
        <button class="tracking-card__title" data-tracking-event="${escapeHtml(event.id)}"><span class="tracking-number">${i+1}</span><strong>${escapeHtml(event.title)}</strong> <small>${escapeHtml(event.priority)}</small></button>
        <code>${escapeHtml(event.name)}</code>
        <p>${escapeHtml(event.purpose)}</p>
        <p class="tracking-muted">触发：${escapeHtml(event.trigger?.when)}</p>
        ${active?`<div class="tracking-details">问题：${escapeHtml(event.question)}<p>决策：${escapeHtml(event.decision)}</p>
          <p>参数：${escapeHtml((event.parameters||[]).map(p=>p.name).join(', ')||'无')}</p>
          <p>${event.targets.length?'控件目标 '+event.targets.length+' 个':'逻辑事件 · 无实体控件'}</p></div>`:''}
      </article>`;
    }).join('')}</div>
    ${this.omitted.length?`<details class="tracking-omitted"><summary>已排除 ${this.omitted.length} 个低价值事件</summary>${this.omitted.map(x=>`<p>${escapeHtml(x.candidate)}：${escapeHtml(x.reason)}</p>`).join('')}</details>`:''}`;
    body.querySelectorAll('[data-tracking-event]').forEach(button=>button.addEventListener('click',()=>this.select(button.dataset.trackingEvent)));
    body.querySelectorAll('[data-tracking-action]').forEach(button=>button.addEventListener('click',()=>{
      const action=button.dataset.trackingAction;
      if(action==='inspect'){this.inspect=!this.inspect;this.render();}
      if(action==='scope'){this.scope=this.scope==='all'?'current':'all';this.render();this.paint();}
      if(action==='reload')this.load();
      if(action==='copy')navigator.clipboard?.writeText(JSON.stringify({events:this.events,omitted:this.omitted},null,2));
    }));
  }
}
