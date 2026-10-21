import { DrawioManager } from './manager.js?v=20260630-drawio-modes-v17';

export class DrawioModule {
    constructor(host) {
        this.host = host;
        this.manager = new DrawioManager(host);
        this.frame = null;
        this.previewFrames = new Map();
        this.previewXmlCache = new Map();
        this.editorMode = 'compact';
        this.contextKey = '';
        this.pendingDiagramPath = '';
        this.pendingEditorMode = '';
        this.pendingEditorModeTimer = null;
        this.pendingSwitchTimer = null;
        this.panelFullscreenBeforeBrowser = false;
        this.browserFullscreenActive = false;
        // 保存状态条 / 本地草稿恢复 相关
        this.currentStatus = null;
        this._savedFlashTimer = null;
        this._beforeUnloadHandler = (event) => this.handleBeforeUnload(event);
        this._messageHandler = (event) => this.handleMessage(event);
        this._fullscreenHandler = () => {
            const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
            if (!fullscreenElement && this.browserFullscreenActive) {
                this.browserFullscreenActive = false;
                this.host.prdDrawerFullscreen = this.panelFullscreenBeforeBrowser;
                this.host.renderAnnotationDrawer();
            } else if (this.host.docDrawerMode === 'diagram') {
                this.syncEditorControls();
            }
        };
        window.addEventListener('message', this._messageHandler);
        document.addEventListener('fullscreenchange', this._fullscreenHandler);
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
        this._unsubStatus = this.manager.onStatus((status) => this.setStatus(status));
        this.ensureStylesheet();
    }

    ensureStylesheet() {
        if (document.querySelector('link[href*="modules/drawio/drawio.css"]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = this.host.isShareMode ? '/portal/modules/drawio/drawio.css' : 'modules/drawio/drawio.css';
        document.head.appendChild(link);
    }

    async switchContext(preferredPath = '') {
        const nextContextKey = [
            this.host.activeProjectId,
            this.host.activePageId,
            this.host.activeVersion
        ].join(':');
        if (this.contextKey !== nextContextKey) {
            this.contextKey = nextContextKey;
            this.manager.state = this.manager.getDefaultState();
            this.frame = null;
        }
        if (this.host.docDrawerMode === 'diagram') this.render();
        await this.manager.load(preferredPath);
        if (this.host.docDrawerMode === 'diagram') this.render();
    }

    renderMeta() {
        const meta = this.host.annotationDrawerMeta;
        if (!meta) return;
        meta.innerHTML = '';
    }

    syncEditorControls() {
        if (!this.frame?.contentWindow) return;
        const state = this.manager.state;
        this.post({
            event: 'prota-controls',
            data: {
                currentPath: state.path || '',
                filename: state.filename || '流程图',
                diagrams: (Array.isArray(state.diagrams) ? state.diagrams : []).map((item) => ({
                    path: item.path || '',
                    filename: item.filename || '',
                    label: item.label || item.filename || '流程图'
                })),
                readOnly: Boolean(this.host.isShareMode),
                canExit: Boolean(this.host.diagramEditorReturnState),
                editorMode: this.editorMode,
                panelFullscreen: Boolean(this.host.prdDrawerFullscreen),
                browserFullscreen: Boolean(document.fullscreenElement || document.webkitFullscreenElement)
            }
        });
    }

    render() {
        const body = this.host.annotationDrawerBody;
        if (!body || !this.host.annotationDrawerMeta) return;
        const state = this.manager.state;
        const readOnly = this.host.isShareMode;

        this.host.annotationDrawer.classList.add('is-drawio-mode');
        this.renderMeta();

        if (state.status === 'loading' || state.status === 'idle') {
            body.innerHTML = this.renderEmptyState('正在加载流程图', '正在准备可编辑画布与图表数据', 'loading');
            return;
        }
        if (state.status === 'error') {
            body.innerHTML = this.renderEmptyState('流程图加载失败', state.error || '请稍后重试');
            return;
        }
        if (state.status === 'empty' && readOnly) {
            body.innerHTML = this.renderEmptyState('当前分享没有流程图', '该页面尚未生成可展示的流程图');
            return;
        }

        const existingFrame = body.querySelector('.drawio-frame');
        if (
            existingFrame
            && existingFrame.dataset.path === state.path
            && existingFrame.dataset.editorMode === this.editorMode
        ) {
            this.frame = existingFrame;
            this.syncEditorControls();
            this.refreshStatus();
            this.refreshRecovery();
            return;
        }

        body.innerHTML = `
            <section class="drawio-shell${readOnly ? ' is-readonly' : ''}">
                <div class="drawio-frame-wrap">
                    <iframe class="drawio-frame" data-path="${this.escapeHtml(state.path)}" data-editor-mode="${this.escapeHtml(this.editorMode)}" title="${readOnly ? '流程图查看' : '流程图编辑器'}" referrerpolicy="no-referrer"></iframe>
                    ${readOnly ? '<div class="drawio-readonly-shield drawio-readonly-shield--full" aria-hidden="true"></div>' : ''}
                </div>
                <div class="drawio-status-layer" aria-live="polite">
                    <div class="drawio-status-slot" data-slot="current"></div>
                    <div class="drawio-status-slot" data-slot="recovery"></div>
                </div>
            </section>
        `;
        this.frame = body.querySelector('.drawio-frame');
        this.frame.addEventListener('load', () => this.syncEditorControls(), { once: true });
        this.frame.src = this.getEditorUrl(readOnly, this.editorMode);
        this.refreshStatus();
        this.refreshRecovery();
    }

    getEditorUrl(readOnly, mode = 'compact') {
        const params = new URLSearchParams({
            embed: '1',
            proto: 'json',
            configure: '1',
            spin: '1',
            libraries: '1',
            noExitBtn: '1',
            noSaveBtn: readOnly ? '1' : '0',
            saveAndExit: '0',
            lang: 'zh'
        });
        if (readOnly) params.set('preview', '1');
        if (mode !== 'full') params.set('ui', 'min');
        return `/portal/modules/drawio/editor.html?${params.toString()}`;
    }

    getPreviewUrl() {
        const params = new URLSearchParams({
            embed: '1',
            proto: 'json',
            configure: '1',
            spin: '1',
            libraries: '0',
            noExitBtn: '1',
            noSaveBtn: '1',
            saveAndExit: '0',
            ui: 'min',
            lang: 'zh',
            preview: '1'
        });
        return `/portal/modules/drawio/editor.html?${params.toString()}`;
    }

    clearPreviews() {
        this.previewFrames.clear();
    }

    async loadPreviewXml(path) {
        if (this.previewXmlCache.has(path)) return this.previewXmlCache.get(path);
        const pending = (async () => {
            if (this.host.isShareMode) {
                const diagrams = this.manager.normalizeShareDiagrams(this.host.shareConfig || window.__READIFY_SHARE__ || {});
                return this.normalizePreviewXml(diagrams.find((item) => item.path === path)?.content || '');
            }
            const params = new URLSearchParams({
                projectId: this.host.activeProjectId || 'readify',
                pageId: this.host.activePageId || '',
                version: this.host.activeVersion || '',
                path
            });
            const response = await fetch(`/api/drawio-diagram?${params.toString()}&t=${Date.now()}`);
            if (!response.ok) throw new Error(await response.text() || '读取流程图预览失败');
            const data = await response.json();
            return this.normalizePreviewXml(data.content || '');
        })();
        this.previewXmlCache.set(path, pending);
        try {
            return await pending;
        } catch (error) {
            this.previewXmlCache.delete(path);
            throw error;
        }
    }

    normalizePreviewXml(xml = '') {
        const source = String(xml || '');
        if (!source.includes('<mxfile')) return source;
        try {
            const documentXml = new DOMParser().parseFromString(source, 'application/xml');
            if (documentXml.querySelector('parsererror')) return source;
            const root = documentXml.documentElement;
            const diagrams = Array.from(root.children).filter((node) => node.tagName === 'diagram');
            const populated = diagrams.find((diagram) =>
                diagram.querySelector('mxCell[vertex="1"], mxCell[edge="1"]')
                || diagram.textContent.trim().length > 40
            );
            if (!populated || diagrams.length === 1) return source;
            diagrams.forEach((diagram) => {
                if (diagram !== populated) diagram.remove();
            });
            root.setAttribute('pages', '1');
            return new XMLSerializer().serializeToString(documentXml);
        } catch {
            return source;
        }
    }

    bindPreviewPan(previewHost, path) {
        const panLayer = previewHost.querySelector('[data-prd-diagram-pan]');
        if (!panLayer || panLayer.dataset.panBound === '1') return;
        panLayer.dataset.panBound = '1';
        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let originX = 0;
        let originY = 0;
        let panX = 0;
        let panY = 0;
        let moved = false;

        const apply = () => {
            previewHost.style.setProperty('--preview-pan-x', `${panX}px`);
            previewHost.style.setProperty('--preview-pan-y', `${panY}px`);
        };
        panLayer.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            originX = panX;
            originY = panY;
            moved = false;
            previewHost.classList.add('is-dragging');
            panLayer.setPointerCapture?.(pointerId);
        });
        panLayer.addEventListener('pointermove', (event) => {
            if (pointerId !== event.pointerId) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
            panX = originX + dx;
            panY = originY + dy;
            apply();
        });
        const finish = (event) => {
            if (pointerId !== event.pointerId) return;
            panLayer.releasePointerCapture?.(pointerId);
            pointerId = null;
            previewHost.classList.remove('is-dragging');
            if (!moved) this.host.openEmbeddedDiagram?.(path);
        };
        panLayer.addEventListener('pointerup', finish);
        panLayer.addEventListener('pointercancel', (event) => {
            if (pointerId !== event.pointerId) return;
            pointerId = null;
            previewHost.classList.remove('is-dragging');
        });
        panLayer.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.host.openEmbeddedDiagram?.(path);
            }
        });
    }

    mountPreviews(container) {
        if (!container) return;
        const hosts = Array.from(container.querySelectorAll('[data-prd-diagram-preview]'));
        hosts.forEach(async (previewHost) => {
            if (previewHost.dataset.previewMounted === '1') return;
            const path = previewHost.dataset.prdDiagramPreview || '';
            if (!path) return;
            previewHost.dataset.previewMounted = '1';
            this.bindPreviewPan(previewHost, path);
            const card = previewHost.closest('.prd-diagram-card');
            try {
                const xml = await this.loadPreviewXml(path);
                if (!previewHost.isConnected) return;
                if (!xml) throw new Error('流程图文件为空');
                const iframe = document.createElement('iframe');
                iframe.className = 'prd-diagram-card__frame';
                iframe.title = '流程图预览';
                iframe.tabIndex = -1;
                iframe.setAttribute('aria-hidden', 'true');
                iframe.src = this.getPreviewUrl();
                previewHost.appendChild(iframe);
                this.previewFrames.set(iframe.contentWindow, {
                    iframe,
                    xml,
                    path,
                    card,
                    previewHost
                });
            } catch (error) {
                card?.classList.add('is-error');
                const loading = previewHost.querySelector('.prd-diagram-card__loading');
                if (loading) loading.textContent = error.message || '流程图预览加载失败';
            }
        });
    }

    post(message) {
        this.frame?.contentWindow?.postMessage(JSON.stringify(message), window.location.origin);
    }

    scheduleCanvasFit(targetWindow = this.frame?.contentWindow) {
        if (!targetWindow) return;
        [80, 260, 720, 1400].forEach((delay) => {
            window.setTimeout(() => {
                targetWindow.postMessage(JSON.stringify({ action: 'zoom', zoom: 'fit' }), window.location.origin);
                targetWindow.postMessage(JSON.stringify({ event: 'prota-center' }), window.location.origin);
            }, delay);
        });
    }

    async toggleBrowserFullscreen() {
        const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
        const requestFullscreen = document.documentElement.requestFullscreen
            || document.documentElement.webkitRequestFullscreen;
        const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
        try {
            if (fullscreenElement) {
                await exitFullscreen?.call(document);
            } else if (requestFullscreen) {
                this.panelFullscreenBeforeBrowser = Boolean(this.host.prdDrawerFullscreen);
                this.browserFullscreenActive = true;
                if (!this.host.prdDrawerFullscreen) {
                    this.host.prdDrawerFullscreen = true;
                    this.host.renderAnnotationDrawer();
                }
                await requestFullscreen.call(document.documentElement);
            } else {
                if (!this.host.prdDrawerFullscreen) this.host.togglePrdDrawerExpanded();
                this.host.showToast('当前浏览器不支持原生全屏，已切换为最大窗口');
            }
        } catch (error) {
            this.browserFullscreenActive = false;
            if (!this.host.prdDrawerFullscreen) this.host.togglePrdDrawerExpanded();
            this.host.showToast('浏览器阻止了原生全屏，已切换为最大窗口');
        }
    }

    requestDiagramSwitch(path) {
        if (!path || path === this.manager.state.path) return;
        if (this.host.isShareMode) {
            this.switchDiagram(path);
            return;
        }
        this.pendingDiagramPath = path;
        this.post({ action: 'invokeAction', actionName: 'save' });
        window.clearTimeout(this.pendingSwitchTimer);
        this.pendingSwitchTimer = window.setTimeout(() => this.flushPendingSwitch(), 500);
    }

    async flushPendingSwitch() {
        const path = this.pendingDiagramPath;
        if (!path) return;
        this.pendingDiagramPath = '';
        window.clearTimeout(this.pendingSwitchTimer);
        this.pendingSwitchTimer = null;
        await this.switchDiagram(path);
    }

    async switchDiagram(path) {
        this.frame = null;
        await this.manager.load(path);
        if (this.host.docDrawerMode === 'diagram') this.render();
    }

    async switchEditorMode(mode) {
        const nextMode = mode === 'full' ? 'full' : 'compact';
        if (nextMode === this.editorMode || nextMode === this.pendingEditorMode) return;
        if (this.host.isShareMode) {
            this.applyEditorMode(nextMode);
            return;
        }
        this.pendingEditorMode = nextMode;
        this.post({ action: 'invokeAction', actionName: 'save' });
        window.clearTimeout(this.pendingEditorModeTimer);
        this.pendingEditorModeTimer = window.setTimeout(() => {
            this.applyEditorMode(this.pendingEditorMode || nextMode);
        }, 900);
    }

    applyEditorMode(mode) {
        const nextMode = mode === 'full' ? 'full' : 'compact';
        window.clearTimeout(this.pendingEditorModeTimer);
        this.pendingEditorModeTimer = null;
        this.pendingEditorMode = '';
        this.editorMode = nextMode;
        this.frame = null;
        if (this.host.docDrawerMode === 'diagram') this.render();
    }

    async handleMessage(event) {
        if (event.origin !== window.location.origin) return;
        let message;
        try {
            message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch {
            return;
        }
        const preview = this.previewFrames.get(event.source);
        if (preview) {
            if (message.event === 'configure') {
                event.source.postMessage(JSON.stringify({
                    action: 'configure',
                    config: {
                        defaultFonts: ['Inter', 'Arial'],
                        customFonts: [],
                        preserveViewState: false,
                        passiveScroll: true
                    }
                }), window.location.origin);
            } else if (message.event === 'init') {
                const previewWindow = event.source;
                previewWindow.postMessage(JSON.stringify({
                    action: 'load',
                    xml: preview.xml,
                    autosave: 0,
                    fit: 1,
                    maxFitScale: 1,
                    title: '流程图预览'
                }), window.location.origin);
                this.scheduleCanvasFit(previewWindow);
            } else if (message.event === 'load') {
                event.source.postMessage(JSON.stringify({
                    action: 'export',
                    format: 'svg',
                    crop: true,
                    border: 20,
                    spinKey: 'export'
                }), window.location.origin);
            } else if (message.event === 'export' && message.data) {
                let source = String(message.data);
                if (source.trim().startsWith('<svg')) {
                    source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
                }
                const image = document.createElement('img');
                image.className = 'prd-diagram-card__frame';
                image.alt = '流程图预览';
                image.draggable = false;
                image.src = source;
                image.addEventListener('load', () => {
                    preview.previewHost?.classList.add('has-rendered-diagram');
                    preview.card?.classList.add('is-ready');
                    preview.iframe.remove();
                    this.previewFrames.delete(event.source);
                }, { once: true });
                preview.previewHost?.appendChild(image);
            }
            return;
        }
        if (event.source !== this.frame?.contentWindow) return;
        if (message.event === 'configure') {
            this.post({
                action: 'configure',
                config: {
                    defaultFonts: ['Inter', 'Arial'],
                    customFonts: [],
                    preserveViewState: true,
                    passiveScroll: true
                }
            });
            return;
        }
        if (message.event === 'prota-ready') {
            this.syncEditorControls();
            return;
        }
        if (message.event === 'prota-action') {
            if (message.action === 'switchDiagram') {
                this.requestDiagramSwitch(message.path);
            } else if (message.action === 'panelFullscreen') {
                this.host.togglePrdDrawerExpanded();
                window.setTimeout(() => this.syncEditorControls(), 0);
            } else if (message.action === 'browserFullscreen') {
                await this.toggleBrowserFullscreen();
                window.setTimeout(() => this.syncEditorControls(), 0);
            } else if (message.action === 'exitDiagram') {
                this.host.exitEmbeddedDiagram?.();
            } else if (message.action === 'switchEditorMode') {
                await this.switchEditorMode(message.mode);
            } else if (message.action === 'zoomIn' || message.action === 'zoomOut') {
                this.post({ action: 'invokeAction', actionName: message.action });
            } else if (message.action === 'saveDiagram') {
                this.post({ action: 'invokeAction', actionName: 'save' });
            }
            return;
        }
        if (message.event === 'init') {
            this.post({
                action: 'load',
                xml: this.manager.state.xml || this.manager.createBlankXml(),
                autosave: this.host.isShareMode ? 0 : 1,
                modified: 'unsavedChanges',
                fit: 1,
                maxFitScale: 1.1,
                title: this.manager.state.filename || `${this.host.activePageId || 'page'}-${this.host.activeVersion || 'v1'}.drawio`
            });
            this.syncEditorControls();
            this.scheduleCanvasFit();
            return;
        }
        if (message.event === 'load') {
            this.scheduleCanvasFit();
            return;
        }
        if (!this.host.isShareMode && ['save', 'autosave', 'export'].includes(message.event) && message.xml) {
            await this.manager.save(message.xml);
            this.syncEditorControls();
            this.invalidatePreviewCache(this.manager.state.path);
            if (this.pendingDiagramPath) await this.flushPendingSwitch();
            if (this.pendingEditorMode) this.applyEditorMode(this.pendingEditorMode);
        }
    }

    renderEmptyState(title, description, state = '') {
        return `
            <div class="drawio-empty${state === 'loading' ? ' is-loading' : ''}">
                <div class="drawio-empty__content">
                    <span class="drawio-empty__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="6" height="6" rx="1.5"></rect>
                            <rect x="15" y="3" width="6" height="6" rx="1.5"></rect>
                            <rect x="9" y="15" width="6" height="6" rx="1.5"></rect>
                            <path d="M6 9v2.5h12V9M12 11.5V15"></path>
                        </svg>
                    </span>
                    <strong>${this.escapeHtml(title)}</strong>
                    <p>${this.escapeHtml(description)}</p>
                </div>
            </div>
        `;
    }

    escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ── 保存状态条 / 退出拦截 / 本地草稿恢复 ───────────────────────
    setStatus(status) {
        const prev = this.currentStatus?.state;
        this.currentStatus = status;
        // 仅在从「断网 / 保存失败」恢复到已保存时短暂亮一下「已保存」，
        // 给用户闭环反馈；正常 autosave 的 saving→saved 不闪，避免编辑时一直弹。
        if (status && status.state === 'saved' && (prev === 'error' || prev === 'offline')) {
            this._flashSaved();
        }
        this.refreshStatus();
    }

    _flashSaved() {
        window.clearTimeout(this._savedFlashTimer);
        this._savedFlashTimer = window.setTimeout(() => {
            this._savedFlashTimer = null;
            this.refreshStatus();
        }, 1600);
        this.refreshStatus();
    }

    refreshStatus() {
        const slot = this.host.annotationDrawerBody?.querySelector('[data-slot="current"]');
        if (!slot) return;
        const s = this.currentStatus;
        if (this.host.isShareMode || !s) { slot.innerHTML = ''; return; }
        let html = '';
        if (s.state === 'offline') {
            html = `
                <div class="drawio-status-banner is-offline" role="status">
                    <span class="drawio-status-dot" aria-hidden="true"></span>
                    <span class="drawio-status-text">网络已断开，修改已暂存到本地，恢复网络后将自动保存</span>
                </div>`;
        } else if (s.state === 'error') {
            html = `
                <div class="drawio-status-banner is-error" role="status">
                    <span class="drawio-status-dot" aria-hidden="true"></span>
                    <span class="drawio-status-text">保存失败：${this.escapeHtml(s.error || '未知原因')}，已暂存本地</span>
                    <button type="button" class="drawio-status-action" data-action="retry">重试保存</button>
                </div>`;
        } else if (this._savedFlashTimer) {
            html = `
                <div class="drawio-status-banner is-saved" role="status">
                    <span class="drawio-status-dot" aria-hidden="true"></span>
                    <span class="drawio-status-text">已保存</span>
                </div>`;
        }
        slot.innerHTML = html;
        slot.querySelector('[data-action="retry"]')?.addEventListener('click', () => this.retrySave());
    }

    refreshRecovery() {
        const slot = this.host.annotationDrawerBody?.querySelector('[data-slot="recovery"]');
        if (!slot) return;
        const backup = this.manager.getRecoverableBackup?.();
        if (!backup) { slot.innerHTML = ''; return; }
        const when = backup.ts ? new Date(backup.ts).toLocaleString('zh-CN') : '';
        slot.innerHTML = `
            <div class="drawio-status-banner is-recovery" role="status">
                <span class="drawio-status-text">检测到本地有未保存的草稿${when ? `（${when}）` : ''}，是否恢复？</span>
                <button type="button" class="drawio-status-action" data-recovery="restore">恢复草稿</button>
                <button type="button" class="drawio-status-action is-ghost" data-recovery="dismiss">忽略</button>
            </div>`;
        slot.querySelector('[data-recovery="restore"]')?.addEventListener('click', () => this.recoverBackup());
        slot.querySelector('[data-recovery="dismiss"]')?.addEventListener('click', () => {
            this.manager.dismissBackup();
            this.refreshRecovery();
        });
    }

    async retrySave() {
        if (this.host.isShareMode || !this.manager.lastXml) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.host.showToast?.('当前仍处于离线状态，请恢复网络后重试', true);
            return;
        }
        await this.manager.save(this.manager.lastXml);
        await this.manager.settle(3000);
        if (this.manager.lastSaveError) {
            this.host.showToast?.(`保存失败：${this.manager.lastSaveError}`, true);
        } else {
            this.host.showToast?.('流程图已保存成功', false);
        }
    }

    async recoverBackup() {
        const backup = this.manager.consumeBackup();
        if (!backup?.xml) { this.refreshRecovery(); return; }
        // 把备份内容塞回编辑器并触发一次保存，实现跨会话恢复。
        this.post({ action: 'load', xml: backup.xml, autosave: this.host.isShareMode ? 0 : 1 });
        this.refreshRecovery();
        this.host.showToast?.('已恢复本地草稿，正在保存…', false);
        window.setTimeout(() => this.post({ action: 'invokeAction', actionName: 'save' }), 400);
    }

    /** 退出流程图前的拦截：有未落盘内容时弹确认，避免心血丢失。 */
    async canExit() {
        if (this.host.isShareMode) return true;
        if (!this.manager.hasUnsavedWork()) return true;
        const status = this.manager.getSaveStatus();
        let message;
        if (status.state === 'offline') {
            message = '当前网络已断开，最新修改尚未保存（已暂存到本地，下次打开可恢复）。确定要退出吗？';
        } else if (status.state === 'error') {
            message = `流程图保存失败（${status.error || '未知原因'}），最新修改已暂存到本地。确定要退出吗？`;
        } else {
            message = '流程图有未保存的修改，确定要退出吗？';
        }
        return this.host.showConfirm({
            title: '退出流程图',
            message,
            okText: '仍然退出'
        });
    }

    /** 退出前强制把编辑器最新内容落盘；落盘失败则写入本地备份兜底。 */
    async flushSave() {
        if (this.host.isShareMode) return;
        // 已是干净状态（无未落盘内容）则无需额外等待，直接放行，避免拖慢正常退出。
        if (!this.manager.hasUnsavedWork()) return;
        // 触发编辑器立即吐出最新内容，避免最后一点编辑没被 autosave 带走。
        this.post({ action: 'invokeAction', actionName: 'save' });
        await new Promise((resolve) => window.setTimeout(resolve, 180));
        await this.manager.settle(2000);
        if (this.manager.dirty && this.manager.lastXml) {
            await this.manager.save(this.manager.lastXml);
            await this.manager.settle(1500);
        }
        this.manager.ensureBackupIfDirty();
    }

    handleBeforeUnload(event) {
        if (this.host.isShareMode) return;
        if (this.host.docDrawerMode !== 'diagram') return;
        if (this.manager.hasUnsavedWork()) {
            // 关闭/刷新页面时的最后一道拦截，触发浏览器原生「离开此网站？」提示。
            event.preventDefault();
            event.returnValue = '';
        }
    }

    invalidatePreviewCache(path = '') {
        if (path) {
            this.previewXmlCache.delete(path);
        } else {
            this.previewXmlCache.clear();
        }
    }

    forcePreviewRemount(container) {
        if (!container) return;
        const hosts = Array.from(container.querySelectorAll('[data-prd-diagram-preview]'));
        hosts.forEach((previewHost) => {
            previewHost.dataset.previewMounted = '';
            const img = previewHost.querySelector('.prd-diagram-card__frame');
            if (img) img.remove();
            const card = previewHost.closest('.prd-diagram-card');
            card?.classList.remove('is-ready');
        });
    }
}
