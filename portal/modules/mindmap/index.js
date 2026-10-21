/**
 * Readify MindMap Decoupled Module - Main Controller
 *
 * Mirrors the DrawioModule surface so the shell treats every visual document
 * module uniformly. The controller owns:
 *   - the SVG preview cards embedded inside PRD documents — rendered by the
 *     framework-free pure pipeline in preview.js (instant, no React), and
 *   - the interactive mindmap editor drawer — an iframe running the local
 *     React + @xiangfa/mindmap bundle (canvas editing: double-click, Enter,
 *     Delete, drag — an XMind-style experience), with no runtime CDN.
 *
 * Decoupling boundary: the parent never imports React. The whole React stack
 * is sealed inside editor.html + the prebuilt vendor bundle. Swapping the
 * renderer means touching only preview.js (previews), editor.html +
 * editor-app.js + vendor/mindmap-react.bundle.mjs (editor) — nothing else.
 */

import { MindmapManager } from './manager.js?v=20260701-xmind-v8';
import { markdownToMindmapSvg, svgToDataUrl } from './preview.js?v=20260701-xmind-v8';

const CACHE_VERSION = '20260701-xmind-v12';

export class MindmapModule {
    constructor(host) {
        this.host = host;
        this.manager = new MindmapManager(host);
        this.previewMarkdownCache = new Map();
        this.contextKey = '';
        this.pendingMindmapPath = '';
        this.frame = null;
        this._flushResolver = null;
        this._flushToken = 0;
        this._messageHandler = (event) => this.handleMessage(event);
        window.addEventListener('message', this._messageHandler);
        this.ensureStylesheet();
    }

    ensureStylesheet() {
        if (document.querySelector(`link[href*="modules/mindmap/mindmap.css"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = this.host.isShareMode
            ? `/portal/modules/mindmap/mindmap.css?v=${CACHE_VERSION}`
            : `modules/mindmap/mindmap.css?v=${CACHE_VERSION}`;
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
        if (this.host.docDrawerMode === 'mindmap') this.render();
        await this.manager.load(preferredPath);
        if (this.host.docDrawerMode === 'mindmap') this.render();
    }

    renderMeta() {
        const meta = this.host.annotationDrawerMeta;
        if (meta) meta.innerHTML = '';
    }

    getEditorUrl() {
        return `/portal/modules/mindmap/editor.html?v=${CACHE_VERSION}`;
    }

    render() {
        const body = this.host.annotationDrawerBody;
        if (!body || !this.host.annotationDrawerMeta) return;
        const state = this.manager.state;
        const readOnly = this.host.isShareMode;

        this.host.annotationDrawer.classList.add('is-mindmap-mode');
        this.renderMeta();

        if (state.status === 'loading' || state.status === 'idle') {
            body.innerHTML = this.renderEmptyState('正在加载思维导图', '正在准备画布与思维导图数据', 'loading');
            return;
        }
        if (state.status === 'error') {
            body.innerHTML = this.renderEmptyState('思维导图加载失败', state.error || '请稍后重试');
            return;
        }
        if (state.status === 'empty' && readOnly) {
            body.innerHTML = this.renderEmptyState('当前分享没有思维导图', '该页面尚未生成可展示的思维导图');
            return;
        }

        const diagrams = Array.isArray(state.mindmaps) ? state.mindmaps : [];
        const hasMultiple = diagrams.length > 1;
        const options = diagrams
            .map((item) => `<option value="${this.escapeHtml(item.path)}"${item.path === state.path ? ' selected' : ''}>${this.escapeHtml(item.label || item.filename || '思维导图')}</option>`)
            .join('');

        body.innerHTML = `
            <section class="mindmap-shell${readOnly ? ' is-readonly' : ''}">
                <div class="mindmap-frame-wrap">
                    <header class="mindmap-shell__bar">
                        <div class="mindmap-shell__left">
                            <button class="mindmap-shell__exit" type="button" data-mindmap-exit aria-label="返回文档" title="返回文档">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="m15 18-6-6 6-6"></path>
                                    <path d="M9 12h12"></path>
                                    <path d="M3 4v16"></path>
                                </svg>
                            </button>
                            <div class="mindmap-shell__seg-group" role="group" aria-label="布局方向">
                                <button class="mindmap-shell__seg is-active" type="button" data-mindmap-direction="right" title="全部在右侧">右</button>
                                <button class="mindmap-shell__seg" type="button" data-mindmap-direction="both" title="左右两侧分布">两边</button>
                            </div>
                        </div>
                        <div class="mindmap-shell__right">
                            <button class="mindmap-shell__win" type="button" data-mindmap-expand aria-label="${this.host.prdDrawerFullscreen ? '恢复窗口' : '最大化窗口'}" title="${this.host.prdDrawerFullscreen ? '恢复窗口' : '最大化窗口'}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    ${this.host.prdDrawerFullscreen
                                        ? '<path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"></path>'
                                        : '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"></path>'}
                                </svg>
                            </button>
                        </div>
                    </header>
                    <iframe class="mindmap-frame" data-path="${this.escapeHtml(state.path)}" title="${readOnly ? '思维导图查看' : '思维导图编辑器'}" referrerpolicy="no-referrer"></iframe>
                    ${readOnly ? '<div class="mindmap-readonly-shield" aria-hidden="true"></div>' : ''}
                </div>
            </section>
        `;

        this.frame = body.querySelector('.mindmap-frame');
        this.frame.addEventListener('load', () => this.syncEditorControls(), { once: true });
        this.frame.src = this.getEditorUrl();
        this.bindShellBar(body);
    }

    bindShellBar(body) {
        body.querySelector('[data-mindmap-exit]')?.addEventListener('click', () => this.host.exitEmbeddedMindmap?.());

        const expandBtn = body.querySelector('[data-mindmap-expand]');
        expandBtn?.addEventListener('click', () => {
            this.host.togglePrdDrawerExpanded?.();
            window.setTimeout(() => this.syncExpandButton(body), 0);
        });

        body.querySelector('[data-mindmap-switch]')?.addEventListener('change', (event) => {
            this.requestMindmapSwitch(event.target.value);
        });

        body.querySelectorAll('[data-mindmap-direction]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const dir = btn.dataset.mindmapDirection;
                body.querySelectorAll('[data-mindmap-direction]').forEach((b) => {
                    b.classList.toggle('is-active', b === btn);
                });
                this.post({ action: 'direction', dir });
            });
        });
    }

    syncExpandButton(body) {
        const btn = body.querySelector('[data-mindmap-expand]');
        if (!btn) return;
        const expanded = this.host.prdDrawerFullscreen;
        btn.setAttribute('aria-label', expanded ? '恢复窗口' : '最大化窗口');
        btn.title = expanded ? '恢复窗口' : '最大化窗口';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${expanded ? '<path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"></path>' : '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"></path>'}</svg>`;
    }

    post(message) {
        this.frame?.contentWindow?.postMessage(JSON.stringify(message), window.location.origin);
    }

    syncEditorControls() {
        if (!this.frame?.contentWindow) return;
        const state = this.manager.state;
        this.post({
            action: 'load',
            markdown: state.markdown || this.manager.createBlankMarkdown(),
            theme: 'light'
        });
    }

    async handleMessage(event) {
        if (event.origin !== window.location.origin) return;
        if (event.source !== this.frame?.contentWindow) return;
        let message;
        try {
            message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch {
            return;
        }
        if (message.event === 'prota-ready' || message.event === 'loaded') {
            this.syncEditorControls();
            return;
        }
        if (message.event === 'datachange' && typeof message.markdown === 'string') {
            await this.manager.save(message.markdown);
            this.invalidatePreviewCache(this.manager.state.path);
            if (message.flushToken != null) this._flushResolver?.(message.flushToken);
            if (this.pendingMindmapPath) await this.flushPendingSwitch();
        }
    }

    /**
     * Flush any pending edits to disk before navigating away, and WAIT for the
     * round-trip to complete. Called by the shell on exitEmbeddedMindmap, which
     * awaits the returned promise so the editor iframe is not torn down before
     * its final save lands.
     *
     * The flush uses a monotonic token: only the datachange that echoes THIS
     * flush's token resolves the promise, so a stale debounced datachange from
     * an earlier edit cannot resolve it prematurely (which would race the
     * teardown past the final commit). A 2s timeout resolves unconditionally as
     * a last resort so the exit can never hang.
     */
    flushSave() {
        this.invalidatePreviewCache(this.manager.state.path);
        if (!this.frame?.contentWindow) return Promise.resolve();
        this._flushToken += 1;
        const token = this._flushToken;
        return new Promise((resolve) => {
            const timer = window.setTimeout(() => {
                if (this._flushToken === token) this._flushResolver = null;
                resolve();
            }, 2000);
            this._flushResolver = (recvToken) => {
                if (recvToken !== token) return;
                window.clearTimeout(timer);
                this._flushResolver = null;
                resolve();
            };
            this.post({ action: 'flush', token });
        });
    }

    clearPreviews() {
        this.previewMarkdownCache.clear();
    }

    async loadPreviewMarkdown(path) {
        if (this.previewMarkdownCache.has(path)) return this.previewMarkdownCache.get(path);
        const pending = (async () => {
            if (this.host.isShareMode) {
                const mindmaps = this.manager.normalizeShareMindmaps(this.host.shareConfig || window.__READIFY_SHARE__ || {});
                return mindmaps.find((item) => item.path === path)?.content || '';
            }
            const params = new URLSearchParams({
                projectId: this.host.activeProjectId || 'readify',
                pageId: this.host.activePageId || '',
                version: this.host.activeVersion || '',
                path
            });
            const response = await fetch(`/api/mindmap-diagram?${params.toString()}&t=${Date.now()}`);
            if (!response.ok) throw new Error(await response.text() || '读取思维导图预览失败');
            const data = await response.json();
            return data.content || '';
        })();
        this.previewMarkdownCache.set(path, pending);
        try {
            return await pending;
        } catch (error) {
            this.previewMarkdownCache.delete(path);
            throw error;
        }
    }

    bindPreviewPan(previewHost, path) {
        const panLayer = previewHost.querySelector('[data-prd-mindmap-pan]');
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
            if (!moved) this.host.openEmbeddedMindmap?.(path);
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
                this.host.openEmbeddedMindmap?.(path);
            }
        });
    }

    /**
     * Render every [data-prd-mindmap-preview] card via the pure SVG pipeline.
     * Synchronous after the (cached) markdown fetch — each render is ~0.1ms,
     * so a document full of mindmaps paints instantly with no iframes.
     */
    mountPreviews(container) {
        if (!container) return;
        const hosts = Array.from(container.querySelectorAll('[data-prd-mindmap-preview]'));
        hosts.forEach(async (previewHost) => {
            if (previewHost.dataset.previewMounted === '1') return;
            const path = previewHost.dataset.prdMindmapPreview || '';
            if (!path) return;
            previewHost.dataset.previewMounted = '1';
            this.bindPreviewPan(previewHost, path);
            const card = previewHost.closest('.prd-mindmap-card');
            try {
                const markdown = await this.loadPreviewMarkdown(path);
                if (!previewHost.isConnected) return;
                const svg = markdownToMindmapSvg(markdown);
                if (!svg) throw new Error('思维导图内容为空');
                const image = document.createElement('img');
                image.className = 'prd-mindmap-card__render';
                image.alt = '思维导图预览';
                image.draggable = false;
                image.src = svgToDataUrl(svg);
                image.addEventListener('load', () => {
                    previewHost.classList.add('has-rendered-mindmap');
                    card?.classList.add('is-ready');
                }, { once: true });
                image.addEventListener('error', () => {
                    card?.classList.add('is-error');
                    const loading = previewHost.querySelector('.prd-mindmap-card__loading');
                    if (loading) loading.textContent = '思维导图预览渲染失败';
                });
                previewHost.appendChild(image);
            } catch (error) {
                card?.classList.add('is-error');
                const loading = previewHost.querySelector('.prd-mindmap-card__loading');
                if (loading) loading.textContent = error.message || '思维导图预览失败';
            }
        });
    }

    async requestMindmapSwitch(path) {
        if (!path || path === this.manager.state.path) return;
        this.pendingMindmapPath = path;
        // Flush the current mindmap's edits to disk BEFORE loading the next
        // one, awaiting the round-trip so the current editor's last edit is
        // not lost when its iframe is replaced by the new selection.
        await this.flushSave();
        await this.flushPendingSwitch();
    }

    async flushPendingSwitch() {
        const path = this.pendingMindmapPath;
        if (!path) return;
        this.pendingMindmapPath = '';
        await this.switchMindmap(path);
    }

    async switchMindmap(path) {
        this.frame = null;
        await this.manager.load(path);
        if (this.host.docDrawerMode === 'mindmap') this.render();
    }

    renderEmptyState(title, description, state = '') {
        return `
            <div class="mindmap-empty${state === 'loading' ? ' is-loading' : ''}">
                <div class="mindmap-empty__content">
                    <span class="mindmap-empty__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="2.2"></circle>
                            <circle cx="5" cy="6" r="1.8"></circle>
                            <circle cx="5" cy="18" r="1.8"></circle>
                            <circle cx="19" cy="6" r="1.8"></circle>
                            <circle cx="19" cy="18" r="1.8"></circle>
                            <path d="M10 11 6.4 7.2M10 13 6.4 16.8M14 11l3.6-3.8M14 13l3.6 3.8"></path>
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

    invalidatePreviewCache(path = '') {
        if (path) {
            this.previewMarkdownCache.delete(path);
        } else {
            this.previewMarkdownCache.clear();
        }
    }

    forcePreviewRemount(container) {
        if (!container) return;
        const hosts = Array.from(container.querySelectorAll('[data-prd-mindmap-preview]'));
        hosts.forEach((previewHost) => {
            previewHost.dataset.previewMounted = '';
            const img = previewHost.querySelector('.prd-mindmap-card__render');
            if (img) img.remove();
            const card = previewHost.closest('.prd-mindmap-card');
            card?.classList.remove('is-ready');
        });
    }
}
