import { formatShareText } from './copy.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses = {active: '已发布', local: '仅本地', expired: '已过期', revoked: '已撤回'};
const types = {static: '链接分享', public: '公网分享', local: '本机分享'};
const icon = paths => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const moreIcon=icon('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>');
const date = value => value ? new Date(value).toLocaleString('zh-CN', {hour12:false}) : '—';
export class ShareManager {
    constructor(shell) {
        this.shell = shell; this.items = []; this.selected = new Set(); this.busy = false;
        const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = new URL('./manager.css', import.meta.url).href; document.head.append(style);
        const trigger = document.getElementById('shareManagerBtn');
        this.dialog = document.createElement('dialog'); this.dialog.className = 'sm-dialog'; this.dialog.setAttribute('aria-labelledby', 'smTitle');
        this.dialog.innerHTML = `<header class="sm-header"><div class="sm-title"><button type="button" data-back hidden aria-label="返回分享列表">${icon('<path d="m14 6-6 6 6 6"/>')}</button><h2 id="smTitle">分享管理</h2><span data-count></span></div><div class="sm-header-actions"><details class="sm-menu sm-global-menu"><summary aria-label="更多管理操作" aria-expanded="false" aria-haspopup="menu">${moreIcon}</summary><div><button type="button" data-refresh>刷新列表</button><button type="button" data-export>导出清单</button><button type="button" data-batch-mode>批量管理</button></div></details><button type="button" data-close aria-label="关闭分享管理">${icon('<path d="m6 6 12 12M18 6 6 18"/>')}</button></div></header>
        <div class="sm-feedback"><p class="sm-message" role="status" aria-live="polite"></p><button type="button" data-retry hidden>重试</button></div>
        <section class="sm-list-view">
        <div class="sm-tools"><input type="search" data-search aria-label="搜索分享" placeholder="搜索分享"><select data-status aria-label="筛选状态"><option value="">全部状态</option>${Object.entries(statuses).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select><button type="button" data-filter-toggle aria-expanded="false" aria-controls="smFilters">筛选<span data-filter-count></span></button></div><section id="smFilters" class="sm-filter" hidden aria-label="高级筛选"><div><label>项目<select data-project aria-label="筛选项目"><option value="">全部项目</option></select></label><label>分享方式<select data-type aria-label="筛选分享方式"><option value="">全部分享方式</option>${Object.entries(types).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label><label>排序<select data-sort aria-label="排序"><option value="recent">最近分享</option><option value="oldest">最早分享</option><option value="name">名称排序</option></select></label><button type="button" data-reset-filters>重置筛选</button></div></section>
        <div class="sm-batch" hidden><span data-selected-count></span><div><button type="button" data-batch-done>完成</button><button type="button" data-revoke-selected class="sm-danger">撤回所选</button></div></div>
        <div class="sm-table-wrap"><table><thead><tr><th class="sm-selection"><input type="checkbox" data-all aria-label="选择当前筛选结果"></th><th>分享内容</th><th>状态</th><th class="sm-date">分享时间</th><th><span class="sm-sr-only">操作</span></th></tr></thead><tbody></tbody></table></div>
        </section>
        <section class="sm-confirm" hidden aria-labelledby="smConfirmTitle"><h3 id="smConfirmTitle">撤回分享？</h3><p data-confirm-text></p><p class="sm-muted">撤回后，固定地址下的链接和下载包将不可访问。已下载文件及历史部署独立地址不受影响。</p><div><button type="button" data-cancel>取消</button><button type="button" data-confirm class="sm-danger">确认撤回</button></div></section>
        <section class="sm-detail" hidden aria-label="分享详情"></section>
        <section class="sm-unsaved" hidden aria-labelledby="smUnsavedTitle"><h3 id="smUnsavedTitle">备注还没有保存</h3><p>保存后再离开，或放弃本次修改。</p><div><button type="button" data-stay>继续编辑</button><button type="button" data-discard class="sm-danger">放弃修改</button><button type="button" data-save-leave>保存并继续</button></div></section>`;
        document.body.append(this.dialog);
        if (trigger) trigger.onclick = () => { this.shell.closeShareMenu?.(); this.open(); };
        this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.escape(); });
        this.dialog.addEventListener('keydown', event => this.keydown(event));
        this.dialog.addEventListener('close', () => { this.readController?.abort(); this.readController=null; if(this.busy==='read') this.lock(false); this.closeMenus(false); this.returnFocus?.focus(); });
        this.dialog.addEventListener('click', event => {
            const summary=event.target.closest('.sm-menu > summary');
            if(summary) { event.preventDefault(); if(!this.busy) this.openMenu(summary.parentElement); return; }
            for(const menu of this.dialog.querySelectorAll('.sm-menu[open]')) if(!menu.contains(event.target)) { if(menu.matches('.sm-menu')) this.closeMenu(menu); else menu.open=false; }
            if(event.target===this.dialog) { const rect=this.dialog.getBoundingClientRect(); if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) this.requestClose(); }
            this.click(event);
        });
        this.q('.sm-table-wrap').addEventListener('scroll', () => { if(this.dialog.querySelector('.sm-menu[open]') && Math.abs(this.q('.sm-table-wrap').scrollTop-this.menuScrollTop)>1) this.closeMenus(false); });
        this.onResize=()=>this.closeMenus(false); window.addEventListener('resize',this.onResize);
        window.addEventListener('beforeunload', event => { if(this.dialog.open && (this.busy==='write' || this.noteDirty())) { event.preventDefault(); event.returnValue=''; } });
        this.dialog.addEventListener('input', event => { if(event.target.matches('[data-search]')) this.filterChanged();
            if(event.target.id==='smNote') this.syncNoteActions(); });
        this.dialog.addEventListener('change', event => {
            if(event.target.matches('select')) this.filterChanged();
            if(event.target.matches('[data-select]')) { if(event.target.checked && this.selected.size>=500) { event.target.checked=false; this.message('每次最多选择 500 条，请分批处理。'); return; } event.target.checked ? this.selected.add(event.target.dataset.select) : this.selected.delete(event.target.dataset.select); this.render(); }
            if(event.target.matches('[data-all]')) { const eligible=this.visible().filter(item=>item.status!=='revoked'); if(event.target.checked) { for(const item of eligible.slice(0,500)) this.selected.add(item.id); if(eligible.length>500) this.message('已选择前 500 条，请分批处理。'); } else this.selected.clear(); this.render(); }
        });
    }
    q(selector) { return this.dialog.querySelector(selector); }
    message(text, error = false) { const node=this.q('.sm-message'); node.textContent=text; node.setAttribute('role',error?'alert':'status'); node.classList.toggle('sm-danger',error); }
    async api(body, signal) {
        const response=await fetch(body ? '/api/shares/manage' : '/api/shares', body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal} : {signal});
        let data; try {data=await response.json();} catch {throw Error('无法读取分享记录，请确认本地服务正在运行。');}
        if(!response.ok) throw Error(data.error || '操作失败，请重试。'); return data;
    }
    async open() {
        if(this.dialog.open) return;
        this.returnFocus=this.shell.shareMenuTrigger || document.activeElement;
        this.closeMenus(false); this.toggleFilters(false); this.selecting=false; this.selected.clear();
        this.message(''); this.setView('list'); this.dialog.showModal(); this.q('[data-search]').focus();
        await this.load();
    }
    async load() {
        if(this.busy) return;
        const controller=new AbortController(); this.readController=controller;
        this.q('[data-retry]').hidden=true; this.lock('read'); this.message('正在读取分享记录…');
        const timeout=setTimeout(()=>controller.abort(),15000);
        try { const data=await this.api(undefined,controller.signal); if(!this.dialog.open || this.readController!==controller) return; this.update(data.items); this.message(''); }
        catch(error) { if(this.dialog.open && this.readController===controller) { this.message(error.name==='AbortError'?'读取超时，请重试。':error.message,true); this.q('[data-retry]').hidden=false; } }
        finally { clearTimeout(timeout); if(this.readController===controller) { this.readController=null; this.lock(false); } }
    }
    filterChanged() {
        const visible=new Set(this.visible().map(item=>item.id));
        const before=this.selected.size; this.selected=new Set([...this.selected].filter(id=>visible.has(id)));
        if(this.selected.size!==before) this.message('已取消不在当前筛选结果中的选择。');
        this.closeMenus(false); this.q('.sm-table-wrap').scrollTop=0; this.render();
    }
    update(items) {
        this.items=items; this.selected=new Set([...this.selected].filter(id=>items.some(item=>item.id===id && item.status!=='revoked')));
        const project=this.q('[data-project]'), current=project.value;
        const projects=new Map(items.map(item=>[item.projectId,item.projectName]));
        project.innerHTML='<option value="">全部项目</option>'+[...projects].map(([id,name])=>`<option value="${escape(id)}">${escape(name || '未知项目')}</option>`).join('');
        project.value=projects.has(current)?current:''; this.render();
    }
    visible() {
        const query=this.q('[data-search]').value.trim().toLowerCase();
        return this.items.filter(item => (!query || [item.name,item.projectName,item.note,item.url,item.version].join(' ').toLowerCase().includes(query)) && (!this.q('[data-project]').value || item.projectId===this.q('[data-project]').value) && (!this.q('[data-status]').value || item.status===this.q('[data-status]').value) && (!this.q('[data-type]').value || item.shareType===this.q('[data-type]').value)).sort((a,b)=>this.q('[data-sort]').value==='name'?a.name.localeCompare(b.name,'zh-CN'):(this.q('[data-sort]').value==='oldest'?1:-1)*String(a.updatedAt).localeCompare(String(b.updatedAt)));
    }
    render() {
        const active=document.activeElement;
        const activeRow=active?.closest('tr[data-share-id]');
        const restore=activeRow ? {id:activeRow.dataset.shareId,selector:active.matches('[data-select]')?'[data-select]':active.matches('.sm-name')?'.sm-name':active.matches('[data-copy]')?'[data-copy]':active.tagName==='SUMMARY'?'summary':null} : null;
        const items=this.visible();
        this.q('[data-count]').textContent=`${items.length} 条`;
        this.q('[data-selected-count]').textContent=`已选 ${this.selected.size} 条`;
        this.q('.sm-batch').hidden=!this.selecting;
        this.dialog.dataset.selecting=String(!!this.selecting);
        const filters=[this.q('[data-project]').value,this.q('[data-type]').value,this.q('[data-sort]').value!=='recent'].filter(Boolean).length;
        this.q('[data-filter-count]').textContent=filters?` · ${filters}`:'';
        const selectable=items.filter(item=>item.status!=='revoked').slice(0,500); const count=selectable.filter(item=>this.selected.has(item.id)).length;
        this.q('[data-all]').checked=!!selectable.length && count===selectable.length; this.q('[data-all]').indeterminate=count>0 && count<selectable.length;
        this.q('tbody').innerHTML=items.map(item=>`<tr data-share-id="${escape(item.id)}"><td class="sm-selection"><input type="checkbox" data-select="${escape(item.id)}" aria-label="选择 ${escape(item.name)}" ${this.selected.has(item.id)?'checked':''} ${item.status==='revoked'?'disabled':''}></td><td class="sm-content"><button type="button" class="sm-name" title="${escape(item.name)}" data-detail="${escape(item.id)}">${escape(item.name)}</button><small>${escape(item.projectName)} · ${item.scope==='folder'?`${item.pageCount} 个页面`:escape(item.version)}</small></td><td><span class="sm-status" data-state="${escape(item.status)}">${statuses[item.status]}</span></td><td class="sm-date" title="${escape(date(item.updatedAt))}">${item.updatedAt?escape(new Date(item.updatedAt).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})):'—'}</td><td class="sm-row-actions"><button type="button" data-copy="${escape(item.id)}" ${['revoked','expired'].includes(item.status) || !item.url?'disabled':''}>复制链接</button><details class="sm-menu"><summary aria-label="${escape(item.name)}的更多操作" aria-haspopup="menu" aria-expanded="false">${moreIcon}</summary><div><button type="button" data-detail="${escape(item.id)}">查看详情</button><button type="button" class="sm-danger" data-revoke="${escape(item.id)}" ${item.status==='revoked'?'disabled':''}>撤回分享</button></div></details></td></tr>`).join('') || `<tr><td colspan="5" class="sm-empty"><strong>${this.items.length?'没有匹配的分享':'还没有分享内容'}</strong><p>${this.items.length?'试试其他关键词或筛选条件。':'分享页面或文件夹后，在这里统一管理。'}</p>${this.items.length?'<button type="button" data-reset-all>清除筛选</button>':''}</td></tr>`;
        this.q('[data-revoke-selected]').disabled=!!this.busy || !this.selected.size;
        if(restore?.selector) [...this.dialog.querySelectorAll('tr[data-share-id]')].find(node=>node.dataset.shareId===restore.id)?.querySelector(restore.selector)?.focus({preventScroll:true});
    }
    lock(mode) {
        const previousMode=this.busy;
        if(mode && !previousMode) this.busyFocus=document.activeElement;
        this.busy=mode;
        for(const node of this.dialog.querySelectorAll('button,input,select,textarea,summary')) {
            if(mode) {
                if(node.matches('[data-close]') && mode==='read') continue;
                if(!('wasDisabled' in node.dataset)) node.dataset.wasDisabled=String(node.disabled || false);
                if(node.tagName==='SUMMARY') node.setAttribute('aria-disabled','true'); else node.disabled=true;
            } else if('wasDisabled' in node.dataset) {
                if(node.tagName==='SUMMARY') node.removeAttribute('aria-disabled'); else node.disabled=node.dataset.wasDisabled==='true';
                delete node.dataset.wasDisabled;
            }
        }
        this.dialog.setAttribute('aria-busy',String(!!mode));
        if(!mode) {
            this.render(); this.syncNoteActions();
            if(previousMode && this.dialog.open) {
                const focus=this.busyFocus;
                if(focus?.isConnected && !focus.disabled && focus.getClientRects().length) focus.focus({preventScroll:true});
                else if(this.dialog.dataset.view==='confirm') this.q('[data-confirm]').focus();
                else if(this.dialog.dataset.view==='unsaved') this.q('[data-save-leave]').focus();
                else if(this.dialog.dataset.view==='detail') this.q('[data-back]').focus();
                else if(this.dialog.dataset.view==='list') ([...this.dialog.querySelectorAll('.sm-name')].find(node=>node.dataset.detail===this.listOrigin) || this.q('[data-search]')).focus({preventScroll:true});
            }
        }
    }
    setView(view) {
        this.dialog.dataset.view=view;
        this.q('.sm-detail').hidden=view!=='detail'; this.q('.sm-confirm').hidden=view!=='confirm'; this.q('.sm-unsaved').hidden=view!=='unsaved';
        this.q('[data-back]').hidden=view==='list' || view==='unsaved';
        this.q('[data-count]').hidden=view!=='list';
        this.q('#smTitle').textContent={list:'分享管理',detail:'分享详情',confirm:'撤回分享',unsaved:'未保存的修改'}[view];
    }
    noteDirty() { return !!this.q('#smNote') && this.q('#smNote').value !== this.noteBaseline; }
    syncNoteActions() { const save=this.q('[data-note-save]'); if(save) save.disabled=!!this.busy || !this.noteDirty(); }
    navigate(action) {
        if(this.busy==='write') return;
        if(['detail','unsaved'].includes(this.dialog.dataset.view) && this.noteDirty()) {
            this.pendingNavigation=action; this.setView('unsaved'); this.message(''); this.q('[data-stay]').focus(); return;
        }
        action();
    }
    requestClose() { this.navigate(()=>this.dialog.close()); }
    detail(item) {
        if(!item) return;
        this.listScroll=this.q('.sm-table-wrap').scrollTop; this.listOrigin=item.id;
        this.closeMenus(false); this.message(''); this.setView('detail');
        this.detailId=item.id; const panel=this.q('.sm-detail'); panel.hidden=false;
        const url=/^https?:\/\//.test(item.url)?item.url:'';
        panel.innerHTML=`<div class="sm-detail-heading"><h3>${escape(item.name)}</h3><span class="sm-status" data-state="${escape(item.status)}">${statuses[item.status]}</span></div><dl><dt>分享地址</dt><dd>${escape(item.url || '尚未配置地址')}${url && !['revoked','expired'].includes(item.status)?` <a href="${escape(url)}" target="_blank" rel="noopener noreferrer">打开</a>`:''}</dd><dt>访问权限</dt><dd>${item.passwordRequired?'密码保护':'无需密码'}${item.shareType==='static'?` · ${item.expiresAt?`到期：${escape(date(item.expiresAt))}`:'长期有效'}`:''}</dd><dt>分享范围</dt><dd>${escape(item.projectName)} / ${item.scope==='folder'?`${item.pageCount} 个页面`:escape(item.version)}</dd>${item.revokedAt && item.status==='revoked'?`<dt>撤回时间</dt><dd>${escape(date(item.revokedAt))}</dd>`:''}</dl><label for="smNote">备注 / 接收对象</label><textarea id="smNote" maxlength="2000" placeholder="例如：发给设计评审组，评审结束后撤回">${escape(item.note || '')}</textarea><button type="button" data-note-save>保存备注</button>`;
        this.noteBaseline=item.note || ''; this.syncNoteActions();
        this.q('[data-back]').focus();
    }
    confirm(ids) {
        if(!ids.length) return;
        this.confirmFrom=this.dialog.dataset.view;
        this.listScroll=this.q('.sm-table-wrap').scrollTop; this.listOrigin=ids.length===1?ids[0]:null;
        this.closeMenus(false); this.message(''); this.setView('confirm');
        this.pending=ids; this.q('.sm-confirm').hidden=false;
        this.q('#smConfirmTitle').textContent=`确认撤回 ${ids.length} 条分享？`;
        const names=ids.slice(0,3).map(id=>this.items.find(item=>item.id===id)?.name).join('、');
        this.q('[data-confirm-text]').textContent=`${names}${ids.length>3?` 等 ${ids.length} 条分享`:''}。原始页面和文档保留。`;
        this.q('[data-cancel]').focus();
    }
    toggleFilters(open) { this.q('.sm-filter').hidden=!open; this.q('[data-filter-toggle]').setAttribute('aria-expanded',String(open)); }
    closeMenu(menu, restore=false) {
        const panel=menu.querySelector(':scope > div'); if(panel.matches(':popover-open')) panel.hidePopover();
        menu.open=false; const trigger=menu.querySelector('summary'); trigger.setAttribute('aria-expanded','false');
        if(restore) trigger.focus({preventScroll:true});
    }
    closeMenus(restore=true) { this.dialog.querySelectorAll('.sm-menu[open]').forEach(menu=>this.closeMenu(menu,restore)); }
    openMenu(menu) {
        if(menu.open) { this.closeMenu(menu,true); return; }
        this.closeMenus(false); this.toggleFilters(false);
        const trigger=menu.querySelector('summary'), panel=menu.querySelector(':scope > div');
        panel.setAttribute('popover','manual'); panel.setAttribute('role','menu'); panel.classList.add('sm-action-popover');
        panel.querySelectorAll('button').forEach(button=>button.setAttribute('role','menuitem'));
        this.menuScrollTop=this.q('.sm-table-wrap').scrollTop;
        menu.open=true; trigger.setAttribute('aria-expanded','true'); panel.showPopover();
        const rect=trigger.getBoundingClientRect(), bounds=panel.getBoundingClientRect();
        panel.style.setProperty('--sm-menu-left',`${Math.max(12,Math.min(rect.right-bounds.width,innerWidth-bounds.width-12))}px`);
        panel.style.setProperty('--sm-menu-top',`${Math.max(12,Math.min(rect.bottom+bounds.height+6<=innerHeight-12?rect.bottom+6:rect.top-bounds.height-6,innerHeight-bounds.height-12))}px`);
        panel.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
    }
    showList(clear=true) {
        this.setView('list'); if(clear) this.message(''); this.q('.sm-table-wrap').scrollTop=this.listScroll || 0;
        const origin=[...this.dialog.querySelectorAll('.sm-name')].find(node=>node.dataset.detail===this.listOrigin);
        (origin || this.q('[data-search]')).focus({preventScroll:true});
    }
    back() {
        this.navigate(()=>{ if(this.dialog.dataset.view==='confirm' && this.confirmFrom==='detail') { this.setView('detail'); this.q('[data-back]').focus(); } else this.showList(); });
    }
    escape() {
        if(this.busy==='write') return;
        if(this.dialog.querySelector('.sm-menu[open]')) { this.closeMenus(); return; }
        if(this.dialog.dataset.view==='list' && !this.q('.sm-filter').hidden) { this.toggleFilters(false); this.q('[data-filter-toggle]').focus(); return; }
        if(this.dialog.dataset.view==='unsaved') { this.setView('detail'); this.q('#smNote').focus(); return; }
        if(this.dialog.dataset.view!=='list') this.back(); else if(this.selecting) { this.selecting=false; this.selected.clear(); this.render(); this.q('[data-search]').focus(); } else this.requestClose();
    }
    keydown(event) {
        if(event.key==='Escape') { event.preventDefault(); event.stopPropagation(); this.escape(); return; }
        if(this.busy) return;
        const trigger=event.target.closest('.sm-menu > summary');
        if(trigger && ['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); this.openMenu(trigger.parentElement); if(event.key==='ArrowUp') trigger.parentElement.querySelector('button:not(:disabled):last-child')?.focus(); return; }
        const menu=event.target.closest('.sm-action-popover');
        if(!menu) return;
        const items=[...menu.querySelectorAll('button:not(:disabled)')];
        if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
            event.preventDefault(); const current=items.indexOf(document.activeElement);
            const index=event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
            items[index]?.focus({preventScroll:true});
        }
        if(event.key==='Tab') { this.closeMenus(); }
    }
    async click(event) {
        if(!this.busy && this.selecting && event.target.closest('td.sm-content')) { const checkbox=event.target.closest('tr').querySelector('[data-select]'); if(!checkbox.disabled) { checkbox.checked=!checkbox.checked; checkbox.dispatchEvent(new Event('change',{bubbles:true})); } return; }
        const button=event.target.closest('button'); if(!button || (this.busy && !(this.busy==='read' && button.hasAttribute('data-close')))) return;
        try {
            if(button.hasAttribute('data-batch-mode')) { this.closeMenus(false); this.selecting=true; this.render(); this.q('[data-all]').focus(); }
            if(button.hasAttribute('data-batch-done')) { this.selecting=false; this.selected.clear(); this.render(); this.q('[data-search]').focus(); }
            if(button.hasAttribute('data-reset-filters') || button.hasAttribute('data-reset-all')) { for(const selector of ['[data-project]','[data-type]','[data-status]','[data-search]']) this.q(selector).value=''; this.q('[data-sort]').value='recent'; this.filterChanged(); }
            if(button.hasAttribute('data-filter-toggle')) this.toggleFilters(this.q('.sm-filter').hidden);
            if(button.hasAttribute('data-refresh') || button.hasAttribute('data-export')) this.closeMenus();
            if(button.hasAttribute('data-close')) this.requestClose();
            if(button.hasAttribute('data-back')) this.back();
            if(button.hasAttribute('data-stay')) { this.setView('detail'); this.q('#smNote').focus(); }
            if(button.hasAttribute('data-discard')) { this.noteBaseline=this.q('#smNote').value; this.pendingNavigation?.(); }
            if(button.hasAttribute('data-retry')) await this.load();
            if(button.hasAttribute('data-refresh')) await this.load();
            if(button.dataset.detail) this.detail(this.items.find(item=>item.id===button.dataset.detail));
            if(button.hasAttribute('data-detail-close')) this.back();
            if(button.dataset.copy) {
                const original=button.textContent; button.disabled=true; button.textContent='复制中…';
                try {
                    const { share }=await this.api({action:'copy',ids:[button.dataset.copy]}); const text=formatShareText(share);
                    if(this.shell.copyTextToClipboard) { if(!await this.shell.copyTextToClipboard(text)) throw Error('复制失败，请重试。'); }
                    else await navigator.clipboard.writeText(text);
                    button.textContent='已复制'; this.message('分享信息已复制。');
                    setTimeout(()=>{ if(button.isConnected) button.textContent=original; },1800);
                } catch(error) { button.textContent=original; throw error; }
                finally { button.disabled=false; }
            }
            if(button.dataset.revoke) this.confirm([button.dataset.revoke]);
            if(button.hasAttribute('data-revoke-selected')) this.confirm([...this.selected]);
            if(button.hasAttribute('data-cancel')) this.back();
            if(button.hasAttribute('data-confirm') || button.hasAttribute('data-note-save') || button.hasAttribute('data-save-leave')) {
                const revoke=button.hasAttribute('data-confirm'); this.lock('write'); this.message(revoke?'正在撤回，请等待线上部署完成…':'正在保存备注…');
                try {
                    const data=await this.api(revoke?{action:'revoke',ids:this.pending}:{action:'annotate',ids:[this.detailId],note:this.q('#smNote').value});
                    this.closeMenus(false); this.update(data.items);
                    if(revoke) { this.selecting=false; this.showList(false); }
                    else { this.noteBaseline=this.q('#smNote').value; if(button.hasAttribute('data-save-leave')) this.pendingNavigation?.(); }
                    this.message(revoke?'所选分享已撤回。':'备注已保存。');
                } finally { this.lock(false); }
            }
            if(button.hasAttribute('data-export')) {
                const cell=value=>'"'+String(value ?? '').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
                const rows=[['分享名称','项目','范围','版本','状态','分享方式','分享时间','撤回时间','链接','备注'],...this.visible().map(item=>[item.name,item.projectName,item.scope==='folder'?'文件夹':'页面',item.version,statuses[item.status],types[item.shareType],item.updatedAt,item.revokedAt,item.url,item.note])];
                const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
                const a=document.createElement('a'); a.href=url; a.download='分享清单.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); this.message(`已导出当前筛选的 ${rows.length-1} 条分享。`);
            }
        } catch(error) { this.message(error.message,true); }
    }
}
