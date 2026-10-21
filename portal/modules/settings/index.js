const svg = paths => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const icons = {
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33A1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82A1.65 1.65 0 0 0 20.83 10H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z"/>'),
    storage: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
    sharing: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-3.4m-6.6 6.1 6.6 3.4"/>'),
    models: svg('<rect x="5" y="5" width="14" height="14" rx="3"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>'),
    close: svg('<path d="m18 6-12 12M6 6l12 12"/>')
};
const labels = { storage: '存储位置', sharing: '分享配置', models: '模型配置' };

export class UnifiedSettings {
    constructor(shell) {
        this.shell = shell;
        this.baselines = {};
        this.initialized = new Set();
        this.userTouched = new Set();
        this.root = document.createElement('div');
        this.root.className = 'unified-settings';
        this.root.hidden = true;
        this.root.innerHTML = `<div class="us-scrim" data-us-close></div><section class="us-window" role="dialog" aria-modal="true" aria-labelledby="usTitle" tabindex="-1"><aside class="us-sidebar"><h2 id="usTitle">设置</h2><p>工作区与应用偏好</p><nav aria-label="设置分类">${Object.entries(labels).map(([id,label]) => `<button type="button" data-us-tab="${id}" aria-controls="us-${id}">${icons[id]}<span>${label}</span><i aria-label="有未保存修改"></i></button>`).join('')}</nav></aside><main class="us-main"><header class="us-heading"><div><h3 id="usSectionTitle">存储位置</h3><p id="usSectionHint">选择独立文件夹，保存你的项目资产。</p><span id="usSaveFeedback" class="us-save-feedback" role="status"></span></div><button type="button" class="us-close" data-us-close aria-label="关闭设置">${icons.close}</button></header><div class="us-body"><section id="us-storage" class="us-storage"><div id="usSetup" class="us-callout" hidden><strong>给项目选择一个存放位置</strong><p>项目资产可独立于程序保存；已有项目可以完整迁移。</p><button type="button" class="us-link" data-us-keep>暂时使用原位置</button></div><label class="us-field-label">当前工作区</label><div class="us-path"><code id="usCurrentPath">正在读取…</code><span id="usAvailability"></span></div><div class="us-path-actions"><button type="button" class="us-link" data-us-copy>复制路径</button></div><p class="us-description">包含项目页面、素材、PRD、标注、会话与附件。<br>程序、内置模板与模型密钥单独保存在本机。</p><div class="us-storage-actions"><button type="button" class="us-primary" data-us-mode="migrate">更改位置</button><button type="button" class="us-secondary" data-us-mode="open">打开已有工作区</button><button type="button" class="us-link" data-us-mode="new">新建工作区</button></div><section id="usLocationForm" class="us-location-form" hidden><h4 id="usLocationTitle">迁移当前工作区</h4><label for="usTarget">目标文件夹</label><div class="us-choose-row"><input id="usTarget" type="text" autocomplete="off" spellcheck="false" placeholder="选择文件夹，或输入本机完整路径"><button type="button" class="us-secondary" data-us-choose>选择文件夹</button></div><small>选择的是运行 Prota 的这台电脑上的文件夹。</small><div class="us-form-actions"><button type="button" class="us-secondary" data-us-location-cancel>取消</button><button type="button" class="us-primary" data-us-plan>检查位置</button></div></section><section id="usPlan" class="us-plan" hidden><h4 id="usPlanTitle">确认迁移</h4><dl><dt>来源</dt><dd id="usSource"></dd><dt>目标</dt><dd id="usDestination"></dd><dt>内容</dt><dd id="usContents"></dd></dl><p id="usPlanHint">复制并校验成功后才切换，原位置的文件会保留。</p><div class="us-form-actions"><button type="button" class="us-secondary" data-us-plan-cancel>返回修改</button><button type="button" class="us-primary" data-us-change>确认迁移</button></div></section><div id="usProgress" class="us-callout" hidden role="status"></div><div id="usStorageError" class="us-error" role="alert"></div></section><section id="us-sharing" hidden></section><section id="us-models" hidden></section></div><div id="usGuard" class="us-guard" role="alertdialog" aria-modal="true" aria-labelledby="usGuardTitle" hidden><div><h3 id="usGuardTitle">有尚未保存的修改</h3><p>保存后继续，或放弃本次修改。</p><div class="us-form-actions"><button type="button" class="us-secondary" data-us-guard-cancel>继续编辑</button><button type="button" class="us-secondary" data-us-discard>放弃修改</button><button type="button" class="us-primary" data-us-save-continue>保存并继续</button></div><div class="us-error" id="usGuardError" role="alert"></div></div></div></main></section>`;
        document.body.append(this.root);
        this.dialog = this.root.querySelector('.us-window');
        const trigger = document.createElement('button');
        trigger.id = 'globalSettingsBtn'; trigger.type = 'button'; trigger.className = 'btn btn-ghost header-icon-action global-settings-trigger';
        trigger.innerHTML = document.querySelector('#shareSettingsBtn svg')?.outerHTML || icons.settings;
        trigger.title = '设置'; trigger.setAttribute('aria-label', '设置'); trigger.setAttribute('aria-haspopup', 'dialog');
        document.querySelector('.content-header')?.append(trigger);
        trigger.addEventListener('click', () => this.open('storage'));
        for (const [id, panel] of [['sharing', shell.shareSettingsModal], ['models', shell.agentConfigModal]]) {
            if (!panel) continue;
            this.root.querySelector(`#us-${id}`).append(panel);
            panel.querySelectorAll('[role="dialog"]').forEach(node => { node.removeAttribute('role'); node.removeAttribute('aria-modal'); });
        }
        this.root.addEventListener('click', event => this.click(event));
        const touch = event => { const tab = event.target.closest('#us-models') ? 'models' : event.target.closest('#us-sharing') ? 'sharing' : null; if (tab) this.userTouched.add(tab); this.refreshDirty(); };
        this.root.addEventListener('input', touch);
        this.root.addEventListener('change', touch);
        this.root.addEventListener('click', event => { if (event.target.closest('#providerFormContent')) this.userTouched.add('models'); }, true);
        // Capture Escape before legacy modal handlers. Keep keyboard focus inside
        // the single visible settings window, including the unsaved-change guard.
        document.addEventListener('keydown', event => {
            if (this.root.hidden) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (!this.busy) this.requestClose(); }
            if (event.key === 'Tab') {
                const scope = this.q('#usGuard').hidden ? this.dialog : this.q('#usGuard');
                const items = [...scope.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(node => node.getClientRects().length);
                const first = items[0], last = items.at(-1);
                if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
            }
            if (event.target.matches('[data-us-tab]') && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
                event.preventDefault(); const tabs = [...this.root.querySelectorAll('[data-us-tab]')];
                const index = tabs.indexOf(event.target); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (['ArrowUp','ArrowLeft'].includes(event.key) ? -1 : 1) + tabs.length) % tabs.length;
                this.setTab(tabs[next].dataset.usTab); tabs[next].focus();
            }
        }, true);
        window.addEventListener('beforeunload', event => { if (this.busy || this.dirtyPanels().length) { event.preventDefault(); event.returnValue = ''; } });
    }
    q(selector) { return this.root.querySelector(selector); }
    async api(route, body) {
        const response = await fetch(`/api/workspace${route}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        let data; try { data = await response.json(); } catch { throw Error('无法连接本地服务，请启动服务后重试。'); }
        if (!response.ok) throw Error(data.error || '操作失败，请重试。');
        return data;
    }
    async bootstrap() {
        if (this.shell.isShareMode) return;
        try {
            this.workspace = await this.api('');
            this.renderWorkspace();
            if (this.workspace.needsSetup || !this.workspace.available) this.open('storage');
        } catch (error) { this.loadError = error.message; }
    }
    async open(tab = 'storage') {
        const opening = this.root.hidden;
        if (opening) {
            this.returnFocus = document.activeElement;
            this.root.hidden = false;
            this.previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; document.body.classList.add('us-open');
            this.background = [...document.body.children].filter(node => node !== this.root && node.tagName !== 'SCRIPT' && !node.inert);
            this.background.forEach(node => node.inert = true);
        }
        this.setTab(tab);
        if (opening) this.q(`[data-us-tab="${tab}"]`).focus();
        if (tab === 'storage') {
            try { this.workspace = await this.api(''); this.renderWorkspace(); }
            catch (error) { this.error(error.message); }
        }
    }
    setTab(tab) {
        if (!labels[tab] || this.busy) return;
        if (!this.initialized.has(tab)) {
            if (tab === 'sharing') { this.shell.renderSettingsInfo(); this.shell.settingsHelpOpen = false; this.shell.shareSettingsModal.querySelector('.settings-modal__dialog')?.classList.add('is-collapsed'); this.shell.updateHelpBannerText(); }
            if (tab === 'models') { this.shell.syncAgentConfigForm(); this.shell.renderProviderList(); }
            this.initialized.add(tab); this.markSaved(tab);
        }
        this.tab = tab;
        this.q('#usSaveFeedback').textContent = '';
        for (const id of Object.keys(labels)) this.q(`#us-${id}`).hidden = id !== tab;
        this.shell.shareSettingsOpen = tab === 'sharing'; this.shell.shareSettingsModal.hidden = tab !== 'sharing';
        this.shell.agentConfigModalOpen = tab === 'models'; this.shell.agentConfigModal.hidden = tab !== 'models';
        this.q('#usSectionTitle').textContent = tab === 'storage' ? '项目存放位置' : labels[tab];
        this.q('#usSectionHint').textContent = { storage: '选择独立文件夹，保存你的项目资产。', sharing: '当前工作区的分享域名与发布策略。', models: '连接信息保存在本机，不随工作区迁移。' }[tab];
        for (const button of this.root.querySelectorAll('[data-us-tab]')) { button.classList.toggle('is-active', button.dataset.usTab === tab); button.setAttribute('aria-current', button.dataset.usTab === tab ? 'page' : 'false'); }
        this.refreshDirty();
    }
    snapshot(tab) {
        const selector = tab === 'models' ? '#providerFormContent' : '#shareSettingsForm';
        return JSON.stringify({ fields: [...this.q(selector)?.querySelectorAll('input,select,textarea') || []].map(input => [input.id, input.type === 'checkbox' ? input.checked : input.value]), models: tab === 'models' ? this.shell.getSelectedProvider()?.models || [] : undefined });
    }
    markSaved(tab, announce = false) { const existing = this.baselines[tab] !== undefined; this.baselines[tab] = this.snapshot(tab); this.userTouched.delete(tab); this.refreshDirty(); if (announce && existing && !this.root.hidden) { this.setFeedback(`${labels[tab]}已保存`); clearTimeout(this.feedbackTimer); this.feedbackTimer = setTimeout(() => this.q('#usSaveFeedback').textContent = '', 2500); } }
    dirtyPanels() { return ['sharing','models'].filter(tab => this.initialized.has(tab) && this.userTouched.has(tab) && this.baselines[tab] !== this.snapshot(tab)); }
    setFeedback(message, error = false) { const node = this.q('#usSaveFeedback'); node.textContent = message; node.classList.toggle('us-error-feedback', error); node.setAttribute('role', error ? 'alert' : 'status'); }
    refreshDirty() { if (!this.root) return; for (const tab of ['sharing','models']) this.q(`[data-us-tab="${tab}"]`)?.classList.toggle('is-dirty', this.dirtyPanels().includes(tab)); }
    guard(action, only = null) {
        const dirty = this.dirtyPanels().filter(tab => !only || tab === only);
        if (!dirty.length) { action(); return false; }
        this.pendingAction = action; this.guardPanels = dirty; this.guardReturn = document.activeElement;
        this.q('#usGuard').hidden = false; this.q('#usGuardError').textContent = ''; this.q('[data-us-guard-cancel]').focus();
        return true;
    }
    guardModels(action) { return this.dirtyPanels().includes('models') ? this.guard(action, 'models') : false; }
    requestClose() { if (!this.root.hidden && !this.busy) this.guard(() => this.close()); }
    close() {
        this.root.hidden = true; this.q('#usGuard').hidden = true; document.body.classList.remove('us-open');
        this.shell.agentConfigModalOpen = false; this.shell.agentConfigModal.hidden = true;
        this.shell.shareSettingsOpen = false; this.shell.shareSettingsModal.hidden = true;
        this.background?.forEach(node => node.inert = false); document.body.style.overflow = this.previousOverflow || '';
        this.returnFocus?.focus();
    }
    renderWorkspace() {
        const data = this.workspace;
        this.q('#usCurrentPath').textContent = data.path;
        this.q('#usAvailability').textContent = !data.available ? '不可用' : data.legacy ? '程序目录' : '独立工作区';
        this.q('#usSetup').hidden = !data.needsSetup;
        if (data.error) this.error(data.error);
        if (data.job?.state === 'running' && !this.polling) this.pollJob(data.job.id);
    }
    error(message = '') { this.q('#usStorageError').textContent = message; }
    async click(event) {
        if (event.target.matches('.us-scrim')) { this.requestClose(); return; }
        const button = event.target.closest('button'); if (!button) return;
        if (button.dataset.usTab) { this.setTab(button.dataset.usTab); return; }
        if (button.hasAttribute('data-us-close')) { this.requestClose(); return; }
        try {
            if (button.hasAttribute('data-us-guard-cancel')) { this.q('#usGuard').hidden = true; this.guardReturn?.focus(); return; }
            if (button.hasAttribute('data-us-save-continue')) {
                button.disabled = true;
                for (const tab of this.guardPanels) {
                    if (tab === 'sharing' && !this.shell.shareSettingsForm.checkValidity()) { this.setTab('sharing'); this.q('#usGuard').hidden = true; this.shell.shareSettingsForm.reportValidity(); return; }
                    const ok = await (tab === 'sharing' ? this.shell.saveSettings() : this.shell.saveActiveProvider());
                    if (!ok) throw Error('配置未能保存，请检查表单和本地服务。');
                }
                this.q('#usGuard').hidden = true; await this.pendingAction?.(); return;
            }
            if (button.hasAttribute('data-us-discard')) {
                for (const tab of this.guardPanels) { if (tab === 'sharing') { this.userTouched.delete('sharing'); this.shell.renderSettingsInfo(); } else { this.shell.newProviderDraft = null; this.shell.editProviderDraft = structuredClone(this.shell.agentProviderStore?.getSelectedProvider() || null); this.userTouched.delete('models'); this.shell.syncAgentConfigForm(); } this.markSaved(tab); }
                this.q('#usGuard').hidden = true; await this.pendingAction?.(); return;
            }
            if (this.busy) return;
            if (button.dataset.usMode) {
                this.guard(() => { this.mode = button.dataset.usMode; this.q('#usLocationForm').hidden = false; this.q('#usPlan').hidden = true; this.q('#usTarget').value = ''; this.q('#usLocationTitle').textContent = { migrate: '迁移当前工作区', open: '打开已有工作区', new: '新建空白工作区' }[this.mode]; this.q('#usTarget').focus(); }); return;
            }
            if (button.hasAttribute('data-us-copy')) { await navigator.clipboard.writeText(this.workspace.path); button.textContent = '已复制'; setTimeout(() => button.textContent = '复制路径', 1800); return; }
            if (button.hasAttribute('data-us-keep')) { this.workspace = await this.api('/keep', {}); this.renderWorkspace(); return; }
            if (button.hasAttribute('data-us-choose')) { button.disabled = true; const chosen = await this.api('/choose', {}); if (chosen.path) this.q('#usTarget').value = chosen.path; return; }
            if (button.hasAttribute('data-us-location-cancel')) { this.q('#usLocationForm').hidden = true; return; }
            if (button.hasAttribute('data-us-plan-cancel')) { this.q('#usPlan').hidden = true; this.q('#usLocationForm').hidden = false; return; }
            if (button.hasAttribute('data-us-plan')) {
                this.error(); button.disabled = true;
                this.proposal = await this.api('/plan', { path: this.q('#usTarget').value.trim(), mode: this.mode });
                this.q('#usSource').textContent = this.proposal.source; this.q('#usDestination').textContent = this.proposal.target;
                this.q('#usContents').textContent = this.mode === 'migrate' ? `${this.proposal.files} 个文件，约 ${(this.proposal.bytes / 1024 / 1024).toFixed(1)} MB` : this.mode === 'new' ? '创建空白工作区，当前内容保留在原位置' : '加载目标文件夹的项目，当前内容保留在原位置';
                const title = { migrate: '确认迁移', new: '确认新建工作区', open: '确认打开工作区' }[this.mode];
                this.q('#usPlanTitle').textContent = title; this.q('[data-us-change]').textContent = title;
                this.q('#usPlanHint').textContent = this.mode === 'migrate' ? '复制并校验成功后才切换，原位置的文件会保留。' : '不合并或覆盖现有项目。切换后将重新加载项目列表。';
                this.q('#usLocationForm').hidden = true; this.q('#usPlan').hidden = false;
            }
            if (button.hasAttribute('data-us-change')) {
                if (this.dirtyPanels().length) { this.guard(() => this.q('[data-us-change]').click()); return; }
                this.error(); button.disabled = true;
                const job = await this.api('/change', { path: this.proposal.target, mode: this.proposal.mode, source: this.proposal.source });
                this.pollJob(job.id);
            }
        } catch (error) { if (!this.q('#usGuard').hidden) this.q('#usGuardError').textContent = error.message; else this.error(error.message); }
        finally { if (!this.busy) button.disabled = false; }
    }
    async pollJob(id) {
        this.busy = true; this.polling = true; this.q('#usProgress').hidden = false;
        this.q('#usPlan').hidden = true;
        const lock = [...this.root.querySelectorAll('button,input,select,textarea')].map(node => [node, node.disabled]);
        lock.forEach(([node]) => node.disabled = true);
        try {
            while (true) {
                const state = await this.api(''); const job = state.job;
                if (!job || job.id !== id) throw Error('迁移状态已变化，请刷新设置查看当前存放位置。');
                this.q('#usProgress').textContent = `${job.phase}${job.files ? ` · ${job.completed} / ${job.files} 个文件` : ''}，请勿关闭程序。`;
                if (job.state === 'failed') throw Error(job.error || '迁移失败，仍使用原位置。');
                if (job.state === 'complete') {
                    this.q('#usProgress').textContent = '位置已更新，正在重新加载项目列表。';
                    this.busy = false; this.baselines = {}; this.initialized.clear();
                    // Clear only workspace-bound UI state; preserve local model connections.
                    for (const key of Object.keys(localStorage)) if (key.startsWith('readify:') && !/provider|image-upload|agent-panel|api-key/.test(key)) localStorage.removeItem(key);
                    location.href = '/portal/index.html'; return;
                }
                await new Promise(resolve => setTimeout(resolve, 650));
            }
        } catch (error) { this.error(error.message); this.q('#usProgress').textContent = '未切换位置，原项目仍保留。'; }
        finally { this.busy = false; this.polling = false; lock.forEach(([node, disabled]) => node.disabled = disabled); this.q('[data-us-change]').disabled = false; }
    }
}
