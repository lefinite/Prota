const svg = paths => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const icons = {
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33A1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82A1.65 1.65 0 0 0 20.83 10H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z"/>'),
    storage: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
    sharing: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-3.4m-6.6 6.1 6.6 3.4"/>'),
    models: svg('<rect x="5" y="5" width="14" height="14" rx="3"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>'),
    close: svg('<path d="m18 6-12 12M6 6l12 12"/>'),
    about: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>')
};
// Brand marks from GitHub's octicons are filled, so they bypass the stroke helper.
const githubMark = '<svg width="21" height="21" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.66-.21-2.2.82a7.68 7.68 0 0 0-2.92 0C6.16 2.67 5.5 2.88 5.5 2.88c-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>';
const starIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>';
const REPO_URL = 'https://github.com/lefinite/Prota';
const labels = { models: '模型配置', storage: '存储位置', sharing: '分享配置', about: '关于' };

export class UnifiedSettings {
    constructor(shell) {
        this.shell = shell;
        this.baselines = {};
        this.initialized = new Set();
        this.userTouched = new Set();
        this.root = document.createElement('div');
        this.root.className = 'unified-settings';
        this.root.hidden = true;
        this.root.innerHTML = `<div class="us-scrim" data-us-close></div><section class="us-window" role="dialog" aria-modal="true" aria-labelledby="usTitle" tabindex="-1"><aside class="us-sidebar"><div class="us-sidebar-title"><h2 id="usTitle">设置</h2></div><nav aria-label="设置分类">${Object.entries(labels).map(([id,label]) => `<button type="button" data-us-tab="${id}" aria-controls="us-${id}">${icons[id]}<span class="us-nav-label">${label}</span><i aria-label="有未保存修改"></i></button>`).join('')}</nav><p class="us-sidebar-note">为你的工作方式而设</p></aside><main class="us-main"><header class="us-heading"><h3 id="usSectionTitle">存储位置</h3><button type="button" class="us-close" data-us-close aria-label="关闭设置">${icons.close}</button></header><div class="us-body"><section id="us-storage" class="us-storage"><div id="usSetup" class="us-callout" hidden><strong>给项目选择一个存放位置</strong><p>项目资产可独立于程序保存；已有项目可以完整迁移。</p><button type="button" class="us-link" data-us-keep>暂时使用原位置</button></div><div class="us-storage-label"><label class="us-field-label" for="usCurrentPath">保存文件夹</label><p>项目与聊天记录自动保存在这里。</p></div><div class="us-folder"><div class="us-folder-location"><span class="us-folder-icon">${icons.storage}</span><div class="us-folder-text"><strong id="usFolderName">正在读取…</strong><code id="usCurrentPath">正在读取…</code></div></div><div class="us-folder-footer"><span>本机存储</span><button type="button" class="us-link" data-us-copy>复制路径</button></div></div><div class="us-storage-actions"><div><strong>切换工作区</strong><p>打开其他文件夹，现有内容留在原处。</p></div><button type="button" class="us-secondary" data-us-mode="switch">切换文件夹</button><div><strong>迁移现有内容</strong><p>复制项目与聊天记录到新文件夹，再切换位置。</p></div><button type="button" class="us-secondary" data-us-mode="migrate">迁移内容</button></div><span id="usAvailability" role="status"></span><section id="usLocationForm" class="us-location-form" hidden><h4 id="usLocationTitle">迁移当前工作区</h4><label for="usTarget">目标文件夹</label><div class="us-choose-row"><input id="usTarget" type="text" autocomplete="off" spellcheck="false" placeholder="点击右侧选择文件夹，也可粘贴完整路径"><button type="button" class="us-secondary" data-us-choose>选择文件夹</button></div><small id="usLocationHint">选择一个空文件夹，现有项目会自动复制过去。</small><div class="us-form-actions"><button type="button" class="us-secondary" data-us-location-cancel>取消</button><button type="button" class="us-primary" data-us-plan>继续</button></div></section><section id="usPlan" class="us-plan" hidden><h4 id="usPlanTitle">确认迁移</h4><dl><dt>来源</dt><dd id="usSource"></dd><dt>目标</dt><dd id="usDestination"></dd><dt>内容</dt><dd id="usContents"></dd></dl><p id="usPlanHint">复制并校验成功后才切换，原位置的文件会保留。</p><div class="us-form-actions"><button type="button" class="us-secondary" data-us-plan-cancel>返回修改</button><button type="button" class="us-primary" data-us-change>确认迁移</button></div></section><div id="usProgress" class="us-callout" hidden role="status"></div><div id="usStorageError" class="us-error" role="alert"></div></section><section id="us-sharing" hidden></section><section id="us-models" hidden></section><section id="us-about" class="us-about" hidden><div class="us-about-intro"><strong>Prota 是为产品经理打造的开源 AI Agent</strong><p>一句话描述产品想法，它生成可点击的产品原型，再基于原型写出完整 PRD。全程在本机运行，使用你自己的模型 API。</p></div><div class="us-about-repo"><div class="us-about-repo-location"><span class="us-about-mark">${githubMark}</span><div class="us-about-text"><strong>lefinite/Prota</strong><code>github.com/lefinite/Prota</code></div></div><div class="us-about-repo-footer"><span>开源项目 · MIT License</span><div class="us-path-buttons"><a class="us-secondary" href="${REPO_URL}" target="_blank" rel="noopener noreferrer">查看源码</a><a class="us-about-star" href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${starIcon}<span>在 GitHub 上 Star</span></a></div></div></div><p class="us-about-note">觉得好用就点个 Star 吧：这是对开源项目最直接的支持，也能让更多产品经理发现 Prota。</p></section></div><footer class="us-footer"><div class="us-footer-status"><span id="usSaveFeedback" class="us-save-feedback" role="status" aria-live="polite"></span><span id="usEditStatus" role="status" aria-live="polite"></span></div><div id="usModelActions" hidden></div><div id="usShareActions" hidden></div></footer><div id="usGuard" class="us-guard" role="alertdialog" aria-modal="true" aria-labelledby="usGuardTitle" hidden><div><h3 id="usGuardTitle">有尚未保存的修改</h3><p>保存后继续，或放弃本次修改。</p><div class="us-form-actions"><button type="button" class="us-secondary" data-us-guard-cancel>继续编辑</button><button type="button" class="us-secondary" data-us-discard>放弃修改</button><button type="button" class="us-primary" data-us-save-continue>保存并继续</button></div><div class="us-error" id="usGuardError" role="alert"></div></div></div></main></section>`;
        document.body.append(this.root);
        this.dialog = this.root.querySelector('.us-window');
        const trigger = document.createElement('button');
        trigger.id = 'globalSettingsBtn'; trigger.type = 'button'; trigger.className = 'btn btn-ghost header-icon-action global-settings-trigger';
        trigger.innerHTML = document.querySelector('#shareSettingsBtn svg')?.outerHTML || icons.settings;
        trigger.title = '设置'; trigger.setAttribute('aria-label', '设置'); trigger.setAttribute('aria-haspopup', 'dialog');
        document.querySelector('.content-header')?.append(trigger);
        trigger.addEventListener('click', () => this.open('models'));
        for (const [id, panel] of [['sharing', shell.shareSettingsModal], ['models', shell.agentConfigModal]]) {
            if (!panel) continue;
            this.root.querySelector(`#us-${id}`).append(panel);
            panel.querySelectorAll('[role="dialog"]').forEach(node => { node.removeAttribute('role'); node.removeAttribute('aria-modal'); });
        }
        this.q('#usModelActions').append(this.q('.agent-config-panel__actions'));
        this.q('#usShareActions').append(this.q('.settings-modal__actions'));
        this.q('#usShareActions button[type="submit"]').setAttribute('form', 'shareSettingsForm');
        this.q('#agentSaveProviderBtn').textContent = '保存配置';
        this.q('#settingsCancelBtn').textContent = '关闭';
        const addProvider = this.q('#addCustomProviderBtn');
        addProvider.insertAdjacentHTML('beforeend', '<span>添加服务商</span>');
        addProvider.setAttribute('aria-label', '添加服务商');
        // Keep list and form in one reading column; saved connections remain one click away.
        this.q('.provider-list-panel__section-title').textContent = '我的服务商';
        this.root.addEventListener('click', event => this.click(event));
        const touch = event => { const tab = event.target.closest('#us-models') ? 'models' : event.target.closest('#us-sharing') ? 'sharing' : null; if (tab) this.userTouched.add(tab); this.refreshDirty(); };
        this.root.addEventListener('input', touch);
        this.root.addEventListener('input', event => { if (event.target.id === 'staticDomainInput') this.shell.vercelConnection?.updateSummary(); });
        this.root.addEventListener('change', touch);
        this.root.addEventListener('change', event => {
            if (event.target.name !== 'shareSetup') return;
            const mode = event.target.value;
            if (mode === 'custom' && this.shell.staticDomainInput.value.endsWith('.vercel.app')) this.shell.staticDomainInput.value = this.customDomainDraft || '';
            if (mode === 'vercel' && !this.shell.staticDomainInput.value.endsWith('.vercel.app')) this.customDomainDraft = this.shell.staticDomainInput.value;
            this.shell.gitAutoPushCheckbox.checked = true;
            this.updateShareChoice(mode);
            this.refreshDirty();
        });
        this.root.addEventListener('click', event => { if (event.target.closest('#providerFormContent')) this.userTouched.add('models'); }, true);
        // Capture Escape before legacy modal handlers. Keep keyboard focus inside
        // the single visible settings window, including the unsaved-change guard.
        document.addEventListener('keydown', event => {
            if (this.root.hidden) return;
            // A product-level confirm (e.g. provider delete) floats above the
            // settings window: Esc cancels it and Tab stays inside it.
            const confirmOpen = this.shell.confirmModal && !this.shell.confirmModal.hidden;
            if (confirmOpen) {
                if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.shell._closeConfirm(false); return; }
                if (event.key === 'Tab') {
                    const scope = this.shell.confirmModal.querySelector('.confirm-modal__dialog');
                    const items = [...scope.querySelectorAll('button:not(:disabled)')].filter(node => node.getClientRects().length);
                    const first = items[0], last = items.at(-1);
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                    return;
                }
                return;
            }
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (!this.busy) this.requestClose(); }
            if (event.key === 'Tab') {
                const scope = this.q('#usGuard').hidden ? this.dialog : this.q('#usGuard');
                const items = [...scope.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(node => node.getClientRects().length);
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
    async open(tab = 'models') {
        const opening = this.root.hidden;
        if (this.closing) { clearTimeout(this.closeTimer); this.closing = false; this.root.classList.remove('is-closing'); }
        if (opening) {
            this.returnFocus = document.activeElement;
            this.root.hidden = false;
            this.previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; document.body.classList.add('us-open');
            this.background = [...document.body.children].filter(node => node !== this.root && node.tagName !== 'SCRIPT' && node.id !== 'confirmModal' && node.id !== 'toast' && !node.inert);
            this.background.forEach(node => node.inert = true);
        }
        this.setTab(tab);
        if (opening) this.q('.us-body').scrollTop = 0;
        if (opening) this.q(`[data-us-tab="${tab}"]`).focus();
        if (tab === 'storage') {
            try { this.workspace = await this.api(''); this.renderWorkspace(); }
            catch (error) { this.error(error.message); }
        }
    }
    setTab(tab) {
        if (!labels[tab] || this.busy) return;
        const changed = this.tab !== tab;
        if (!this.initialized.has(tab)) {
            if (tab === 'sharing') { this.shell.renderSettingsInfo(); this.shell.settingsHelpOpen = false; this.shell.updateHelpBannerText(); }
            if (tab === 'models') { this.shell.syncAgentConfigForm(); this.shell.renderProviderList(); }
            this.initialized.add(tab); this.markSaved(tab);
        }
        this.tab = tab;
        this.root.dataset.tab = tab;
        if (tab === 'storage') this.api('').then(data => { this.workspace = data; this.renderWorkspace(); }).catch(error => this.error(error.message));
        clearTimeout(this.feedbackTimer);
        this.q('#usSaveFeedback').textContent = '';
        this.q('#usSaveFeedback').classList.remove('us-error-feedback');
        for (const id of Object.keys(labels)) this.q(`#us-${id}`).hidden = id !== tab;
        this.shell.shareSettingsOpen = tab === 'sharing'; this.shell.shareSettingsModal.hidden = tab !== 'sharing';
        this.shell.agentConfigModalOpen = tab === 'models'; this.shell.agentConfigModal.hidden = tab !== 'models';
        this.q('#usSectionTitle').textContent = labels[tab];
        for (const button of this.root.querySelectorAll('[data-us-tab]')) { button.classList.toggle('is-active', button.dataset.usTab === tab); button.setAttribute('aria-current', button.dataset.usTab === tab ? 'page' : 'false'); }
        this.refreshDirty();
        if (changed) this.q('.us-body').scrollTop = 0;
        if (tab === 'sharing') this.shell.vercelConnection?.refresh();
    }
    updateShareChoice(mode) {
        mode = mode === 'custom' ? 'custom' : 'vercel';
        this.shell.gitAutoPushCheckbox.checked = true;
        const selected = this.q(`[name=shareSetup][value=${mode}]`);
        if (selected) selected.checked = true;
        this.q('#shareChoiceTitle').textContent = mode === 'vercel' ? '无需购买域名，适合快速分享' : '使用专属网址，方便识别与长期对外分享';
        this.q('#shareChoiceDescription').textContent = mode === 'vercel' ? '使用 Vercel 提供的固定 *.vercel.app 项目地址。同一页面版本重新发布后，链接不变，打开即可查看更新。' : '使用你拥有的域名，体现产品或团队品牌。同一页面版本重新发布后链接不变，将来更换托管服务也可保留域名。需要先购买域名并完成解析设置。';
        this.q('[data-custom-requirements]').hidden = mode !== 'custom';
        this.shell.staticDomainInput.closest('.settings-form__group').hidden = mode !== 'custom';
        this.shell.staticDomainInput.disabled = mode !== 'custom';
        this.shell.gitAutoPushCheckbox.closest('.settings-form__group').hidden = true;
        for (const guide of this.root.querySelectorAll('[data-share-guide]')) guide.hidden = guide.dataset.shareGuide !== mode;
        this.shell.staticDomainInput.placeholder = '例如 share.example.com';
        this.shell.vercelConnection?.updateSummary();
    }

    snapshot(tab) {
        const selector = tab === 'models' ? '#providerFormContent' : '#shareSettingsForm';
        return JSON.stringify({ fields: [...this.q(selector)?.querySelectorAll('input,select,textarea') || []].map(input => [input.id, ['checkbox','radio'].includes(input.type) ? input.checked : input.id === 'staticDomainInput' && input.disabled ? '' : input.value]), models: tab === 'models' ? this.shell.getSelectedProvider()?.models || [] : undefined });
    }
    markSaved(tab, announce = false) { const existing = this.baselines[tab] !== undefined; this.baselines[tab] = this.snapshot(tab); this.userTouched.delete(tab); this.refreshDirty(); if (announce && existing && !this.root.hidden) { this.setFeedback(`${labels[tab]}已保存`); clearTimeout(this.feedbackTimer); this.feedbackTimer = setTimeout(() => { this.q('#usSaveFeedback').textContent = ''; this.refreshDirty(); }, 3000); } }
    dirtyPanels() { return ['sharing','models'].filter(tab => this.initialized.has(tab) && this.userTouched.has(tab) && this.baselines[tab] !== this.snapshot(tab)); }
    setFeedback(message, error = false) { const node = this.q('#usSaveFeedback'); node.textContent = message; node.classList.toggle('us-error-feedback', error); node.setAttribute('role', error ? 'alert' : 'status'); }
    refreshDirty() {
        if (!this.root) return;
        const dirty = this.dirtyPanels();
        for (const tab of ['sharing','models']) {
            const button = this.q(`[data-us-tab="${tab}"]`);
            button?.classList.toggle('is-dirty', dirty.includes(tab));
            button?.setAttribute('aria-label', `${labels[tab]}${dirty.includes(tab) ? '，有未保存的修改' : ''}`);
        }
        this.q('#usModelActions').hidden = this.tab !== 'models';
        this.q('#usShareActions').hidden = this.tab !== 'sharing';
        const status = this.q('#usEditStatus');
        status.textContent = dirty.includes(this.tab) ? '有未保存的修改' : ({ models: '配置保存在本机', sharing: '连接成功后即可发布原型', storage: '项目与聊天记录自动保存', about: '开源 · MIT License' }[this.tab] || '');
        status.classList.toggle('is-dirty', dirty.includes(this.tab));
    }
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
        if (this.closing) return;
        const finish = () => {
            this.closing = false;
            this.root.hidden = true; this.root.classList.remove('is-closing');
            this.q('#usGuard').hidden = true; document.body.classList.remove('us-open');
            this.shell.agentConfigModalOpen = false; this.shell.agentConfigModal.hidden = true;
            this.shell.shareSettingsOpen = false; this.shell.shareSettingsModal.hidden = true;
            this.background?.forEach(node => node.inert = false); document.body.style.overflow = this.previousOverflow || '';
            this.returnFocus?.focus();
        };
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
        this.closing = true;
        this.root.classList.add('is-closing');
        this.closeTimer = setTimeout(finish, 130);
    }
    renderWorkspace() {
        const data = this.workspace;
        this.q('#usCurrentPath').textContent = data.path;
        this.q('#usFolderName').textContent = data.path?.split(/[\\/]/).filter(Boolean).at(-1) || data.path;
        this.q('#usCurrentPath').title = data.path;
        this.q('#usAvailability').textContent = !data.available ? '不可用，请重新选择文件夹。' : '';
        this.q('#usSetup').hidden = true;
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
                this.guard(async () => {
                    this.error(); this.mode = button.dataset.usMode;
                    this.q('#usLocationForm').hidden = true; this.q('#usPlan').hidden = true;
                    this.q('#usTarget').value = '';
                    this.q('#usLocationTitle').textContent = this.mode === 'migrate' ? '迁移到新文件夹' : '更改保存文件夹';
                    this.q('#usLocationHint').textContent = this.mode === 'migrate' ? '目标必须是空文件夹，现有内容会复制过去。' : '只切换文件夹，原内容留在原位置。';
                    button.disabled = true;
                    try {
                        const chosen = await this.api('/choose', {});
                        if (!chosen.path) return;
                        this.q('#usTarget').value = chosen.path;
                        this.q('[data-us-plan]').click();
                    } catch (error) {
                        this.error(error.message);
                        this.q('#usLocationForm').hidden = false;
                        this.q('#usTarget').focus();
                    } finally { button.disabled = false; }
                }); return;
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
                this.q('#usContents').textContent = this.mode === 'migrate' ? `${this.proposal.files} 个文件，约 ${(this.proposal.bytes / 1024 / 1024).toFixed(1)} MB` : this.proposal.mode === 'new' ? '从空白开始，现有内容不迁移' : '显示目标文件夹里的项目，现有内容不迁移';
                const title = this.mode === 'migrate' ? '确认迁移到此文件夹' : '确认更改保存文件夹';
                this.q('#usPlanTitle').textContent = title; this.q('[data-us-change]').textContent = title;
                this.q('#usPlanHint').textContent = this.mode === 'migrate' ? '复制并校验成功后才切换，原位置的文件会保留。' : '仅更改保存位置，原文件保留在原处，不会复制到新文件夹。';
                this.q('#usLocationForm').hidden = true; this.q('#usPlan').hidden = false;
            }
            if (button.hasAttribute('data-us-change')) {
                if (this.dirtyPanels().length) { this.guard(() => this.q('[data-us-change]').click()); return; }
                this.error(); button.disabled = true;
                const job = await this.api('/change', { path: this.proposal.target, mode: this.proposal.mode, source: this.proposal.source });
                this.pollJob(job.id);
            }
        } catch (error) { if (!this.q('#usGuard').hidden) this.q('#usGuardError').textContent = error.message; else { this.error(error.message); if (button.hasAttribute('data-us-plan')) this.q('#usLocationForm').hidden = false; } }
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
