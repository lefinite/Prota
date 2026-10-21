/**
 * Readify PRD Decoupled Module - Main Controller
 * Orchestrates PRDManager, PRDRenderer and PRDScrollSync to deliver high-quality PRD experiences.
 */

import { PRDManager } from './manager.js?v=20260808-task-list-v2';
import { PRDRenderer } from './renderer.js?v=20261013-auto-polish-v1';
import { PRDScrollSync } from './scroll-sync.js?v=20261013-stable-edit-scroll-v1';

export class PRDModule {
    /**
     * @param {Object} host - The main DemoShell framework instance
     */
    constructor(host) {
        this.host = host;
        
        // Ensure styling is loaded (handles caching & share paths)
        this.ensureStylesheet();

        // 1. Initialize decoupled sub-components
        this.manager = new PRDManager(host);
        this.renderer = new PRDRenderer(this.manager);
        this.scrollSync = new PRDScrollSync(this.manager);

        // 2. Local variables for Editor & Slash Suggestions
        this.slashCommand = {
            active: false,
            query: '',
            start: 0,
            end: 0,
            selectedIndex: 0
        };

        this._eventCleanup = null;
        this._previewRenderTimer = null;
        this._previewDiagramSignature = '';
        this._previewMindmapSignature = '';
        
        // 3. Register state listeners
        this.manager.addEventListener('prd-state-change', (e) => this.handleStateChange(e.detail.state, e.detail.prevState));
        this.manager.addEventListener('prd-save-success', (e) => {
            this.host.showToast('PRD 已成功保存');
            this.render();
        });
        this.manager.addEventListener('prd-save-error', (e) => {
            this.host.showToast(`保存失败: ${e.detail.error}`, 'error');
        });
        this.manager.addEventListener('prd-create-success', (e) => {
            this.host.showToast(`已新增文件「${e.detail.filename}」`);
            this.render();
        });
        this.manager.addEventListener('prd-create-error', (e) => {
            this.host.showToast(`新增失败: ${e.detail.error}`, 'error');
        });
        
        // Close switcher dropdown when clicking outside
        this._outsideClickListener = (e) => {
            if (this.host.docDrawerMode !== 'prd') return;
            const metaEl = this.host.annotationDrawerMeta;
            if (!metaEl) return;
            
            const wrapper = metaEl.querySelector('.prd-meta__switcher-wrapper');
            const dropdown = metaEl.querySelector('[data-prd-dropdown]');
            const trigger = metaEl.querySelector('[data-prd-manage-trigger]');
            
            if (wrapper && !wrapper.contains(e.target) && dropdown && !dropdown.hidden) {
                dropdown.hidden = true;
                trigger?.classList.remove('is-active');
            }
        };
        document.addEventListener('click', this._outsideClickListener);

        this._boundSelectionChange = this.handleSelectionChange.bind(this);
        document.addEventListener('selectionchange', this._boundSelectionChange);
    }

    getLocalStorageItem(key, fallback = '') {
        try {
            return window.localStorage.getItem(key) ?? fallback;
        } catch {
            return fallback;
        }
    }

    setLocalStorageItem(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch {
            // Best-effort UI memory only; quota errors should never block PRD work.
        }
    }

    removeLocalStorageItem(key) {
        try {
            window.localStorage.removeItem(key);
        } catch {
            // Ignore storage failures for non-critical PRD preferences.
        }
    }

    /**
     * Dynamically injects prd.css into the parent document if not already loaded.
     * In share mode, also repairs a relative href that the share-page generator
     * failed to rewrite (it would resolve under /shares/ and 404), so already
     * deployed share pages render correctly without being regenerated.
     */
    ensureStylesheet() {
        const isShare = window.__READIFY_SHARE__ || window.location.pathname.includes('/shares/');
        const href = isShare ? '/portal/modules/prd/prd.css?v=20261013-direction-viewer-v1' : 'modules/prd/prd.css?v=20261013-direction-viewer-v1';

        const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .find((link) => (link.getAttribute('href') || '').includes('prd.css'));

        if (!existing) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
            return;
        }

        if (isShare && !existing.getAttribute('href').startsWith('/portal/')) {
            existing.href = href;
        }
    }

    /**
     * Entry: Called by DemoSell when active workspace context (page/version) is changed
     */
    async switchContext(pageId, version, preferredPath = '') {
        this.manager.resetState();
        await this.manager.loadDocument({ force: true, path: preferredPath });
    }

    /**
     * Route Guard: Verifies if we can safely navigate away from current page
     */
    async canNavigate() {
        if (!this.manager.isDirty()) return true;
        return this.host.showConfirm({
            title: '放弃修改',
            message: 'PRD 有未保存修改，确定要放弃这些修改吗？',
            okText: '放弃修改'
        });
    }

    /**
     * Actions: Enter edit mode targeting a specific visual element or text
     */
    enterEditMode(clickedText = '', targetElement = null) {
        if (this.manager.state.status !== 'ready') return;

        const draftContent = this.manager.state.draftContent || this.manager.state.content || '';
        let matchIndex = -1;
        let matchLength = 0;
        let exactLineMatch = -1;

        if (targetElement) {
            const elWithLine = targetElement.closest('[data-line]');
            if (elWithLine && elWithLine.hasAttribute('data-line')) {
                exactLineMatch = parseInt(elWithLine.getAttribute('data-line'), 10);
            }
        }

        if (exactLineMatch >= 0 && !isNaN(exactLineMatch)) {
            const lines = draftContent.split('\n');
            if (exactLineMatch < lines.length) {
                matchIndex = lines.slice(0, exactLineMatch).join('\n').length + (exactLineMatch > 0 ? 1 : 0);
                matchLength = lines[exactLineMatch].length;
            }
        } else if (clickedText && typeof clickedText === 'string') {
            const normalizedQuery = clickedText.trim().replace(/\s+/g, ' ');
            if (normalizedQuery) {
                const lines = draftContent.split('\n');
                let bestLineIdx = -1;
                let bestScore = 0;
                
                lines.forEach((line, idx) => {
                    const cleanLine = line.replace(/[#*_\-`\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
                    if (normalizedQuery.length > 3 && cleanLine.includes(normalizedQuery)) {
                        bestLineIdx = idx;
                        bestScore = 100;
                    } else if (normalizedQuery.length > 0) {
                        const queryWords = normalizedQuery.split(' ').filter(w => w.length > 1);
                        if (queryWords.length > 0) {
                            let matchCount = 0;
                            queryWords.forEach(word => {
                                if (cleanLine.includes(word)) matchCount++;
                            });
                            const score = matchCount / queryWords.length;
                            if (score > bestScore && score > 0.4) {
                                bestScore = score;
                                bestLineIdx = idx;
                            }
                        }
                    }
                });
                
                if (bestLineIdx !== -1) {
                    matchIndex = lines.slice(0, bestLineIdx).join('\n').length + (bestLineIdx > 0 ? 1 : 0);
                    matchLength = lines[bestLineIdx].length;
                }
            }
        }

        // Persist and expand
        this.host.prdEditorLayout = this.host.readPrdEditorLayout?.() || 'source';
        this.host.persistPrdEditorLayout?.();
        this.host.docDrawerExpanded = true;

        this.manager.updateState({
            editMode: true,
            dirty: false
        });

        // Trigger focus and align caret height
        window.setTimeout(() => {
            const editor = this.host.annotationDrawerBody?.querySelector('[data-prd-editor]');
            if (editor) {
                editor.focus();
                if (matchIndex !== -1) {
                    editor.setSelectionRange(matchIndex, matchIndex + matchLength);
                    const lines = draftContent.split('\n');
                    const totalLines = lines.length;
                    const matchLine = draftContent.substring(0, matchIndex).split('\n').length;
                    if (totalLines > 0) {
                        editor.scrollTop = (editor.scrollHeight * (matchLine / totalLines)) - (editor.clientHeight / 2);
                    }
                }
            }
        }, 80);
    }

    /**
     * Actions: Save active edits
     */
    async save() {
        await this.manager.saveDocument();
    }

    async createNewDocument() {
        if (this.manager.isDirty() && !(await this.canNavigate())) return;
        await this.manager.createNewDocument();
    }

    /**
     * Actions: Discard edits and scroll back to last focused position
     */
    async cancel() {
        if (!this.manager.state.editMode) return;
        if (!(await this.canNavigate())) return;

        const activeLine = this.scrollSync.captureActiveLine(
            this.host.annotationDrawerBody?.querySelector('[data-prd-editor]')
        );

        this.manager.updateState({
            draftContent: this.manager.state.content || '',
            editMode: false,
            dirty: false,
            saving: false
        });

        if (activeLine >= 0) {
            this.scrollSync.scrollToPreviewLine(this.host.annotationDrawerBody, activeLine);
        }
    }

    /**
     * Internal: Listens to managers state machine changes and issues repaints
     */
    handleStateChange(state, prevState) {
        if (state.status !== prevState.status || state.editMode !== prevState.editMode || state.path !== prevState.path) {
            this.render();
        } else {
            // Smaller diff patches (like dirty flag)
            this.renderer.rendererPrdMeta?.(state);
            this.syncPrdActionButtons(state);
        }
    }

    /**
     * Core Render Loop: Mount visual blocks and bind DOM hooks
     */
    render() {
        const body = this.host.annotationDrawerBody;
        if (!body) return;

        // Clean up previous event bindings
        if (this._eventCleanup) {
            this._eventCleanup();
            this._eventCleanup = null;
        }

        const state = this.manager.state;
        this.host.annotationDrawer?.classList.toggle('is-prd-editing', Boolean(state.editMode));

        if (this.host.annotationDrawerMeta) {
            this.host.annotationDrawerMeta.innerHTML = this.renderer.renderPrdMeta(state);
            this.bindMetaSwitcherEvents();
        }

        // Toggle host action buttons
        this.syncPrdActionButtons(state);
        if (this.host.prdOpenNewTabBtn) {
            this.host.prdOpenNewTabBtn.hidden = state.status !== 'ready';
        }
        if (this.host.prdDownloadBtn) {
            this.host.prdDownloadBtn.hidden = state.status !== 'ready';
        }
        if (this.host.prdExpandBtn) {
            const isFullscreen = Boolean(this.host.prdDrawerFullscreen);
            this.host.prdExpandBtn.hidden = state.status !== 'ready';
            this.host.prdExpandBtn.title = isFullscreen ? '收起文档' : '展开文档';
            this.host.prdExpandBtn.setAttribute('aria-label', this.host.prdExpandBtn.title);
            this.host.prdExpandBtn.setAttribute('aria-pressed', isFullscreen ? 'true' : 'false');
            this.host.prdExpandBtn.innerHTML = isFullscreen
                ? `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M4 14h6v6"></path>
                        <path d="M20 10h-6V4"></path>
                        <path d="m14 10 7-7"></path>
                        <path d="m3 21 7-7"></path>
                    </svg>
                `
                : `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M15 3h6v6"></path>
                        <path d="M9 21H3v-6"></path>
                        <path d="m21 3-7 7"></path>
                        <path d="m3 21 7-7"></path>
                    </svg>
                `;
        }

        // Status routes
        if (state.status === 'loading' || state.status === 'idle') {
            body.innerHTML = `
                <div class="prd-loading-skeleton">
                    <div class="prd-skeleton-item prd-skeleton-title"></div>
                    <div class="prd-skeleton-item prd-skeleton-meta"></div>
                    <div class="prd-skeleton-item prd-skeleton-line"></div>
                    <div class="prd-skeleton-item prd-skeleton-line short"></div>
                    <div class="prd-skeleton-item prd-skeleton-line"></div>
                    <div class="prd-skeleton-item prd-skeleton-line very-short"></div>
                    <div class="prd-skeleton-item prd-skeleton-block"></div>
                </div>
            `;
            return;
        }

        if (state.status === 'empty') {
            body.innerHTML = `
                <div class="annotation-drawer__empty prd-empty">
                    <strong>当前版本还没有 PRD</strong>
                    <p>可以先补充交互标注，让 Prota 生成一份 PRD。</p>
                    <button class="prd-empty__action" type="button" data-generate-prd="1">生成 PRD</button>
                </div>
            `;
            this.bindEmptyActions(body);
            return;
        }

        if (state.status === 'error') {
            body.innerHTML = `
                <div class="annotation-drawer__empty prd-empty">
                    <strong>PRD 加载失败</strong>
                    <p>${this.renderer.escapeHtml(state.error || '无法与服务端建立连接，请确认 Bridge 服务已启动。')}</p>
                    <button class="prd-empty__action" type="button" data-retry-prd="1">重新加载</button>
                </div>
            `;
            this.bindEmptyActions(body);
            return;
        }

        if (state.editMode) {
            body.innerHTML = this.renderer.renderPrdMarkdownEditor(state);
            this.renderer.preparePrdImages(body);
            if ((this.host.prdEditorLayout || 'source') !== 'source') {
                this.host.drawioModule?.mountPreviews(body);
                this.host.mindmapModule?.mountPreviews(body);
            }
            this.renderer.generatePrdToc(body, this.host.annotationDrawer, state);
            this.bindEditorActions(body);
            this.scrollSync.bindEvents(body);

            // Restore edit mode scroll progress
            if (state.status === 'ready') {
                const pageId = this.host.activePageId || '';
                const prdPath = state.path || '';
                if (pageId && prdPath) {
                    const textarea = body.querySelector('[data-prd-editor]');
                    const preview = body.querySelector('.prd-editor-preview');
                    
                    // Temporarily disable scroll sync during restore to avoid conflicts
                    if (this.scrollSync) {
                        this.scrollSync._isSyncing = true;
                    }

                    const percentKey = `readify:prd-scroll-percent:${pageId}:${prdPath}`;
                    const lineKey = `readify:prd-scroll-line:${pageId}:${prdPath}`;
                    const percent = parseFloat(this.getLocalStorageItem(percentKey, '0') || '0');
                    const savedLine = parseFloat(this.getLocalStorageItem(lineKey, '') || '');
                    const hasSavedLine = Number.isFinite(savedLine) && savedLine >= 0;

                    const restoreEditScroll = () => {
                        const wasSyncing = this.scrollSync ? this.scrollSync._isSyncing : false;
                        if (this.scrollSync) {
                            this.scrollSync._isSyncing = true;
                        }
                        if (hasSavedLine && this.scrollSync) {
                            if (textarea) {
                                this.scrollSync.scrollSourceToLine(textarea, savedLine, {
                                    behavior: 'auto',
                                    block: 'start'
                                });
                            }
                            if (preview) {
                                this.scrollSync.scrollPreviewToLine(body, savedLine, {
                                    behavior: 'auto',
                                    block: 'start'
                                });
                            }
                        } else if (textarea) {
                            textarea.scrollTop = percent * (textarea.scrollHeight - textarea.clientHeight);
                            if (preview) {
                                preview.scrollTop = percent * (preview.scrollHeight - preview.clientHeight);
                            }
                        } else if (preview) {
                            preview.scrollTop = percent * (preview.scrollHeight - preview.clientHeight);
                        }
                        if (!wasSyncing) {
                            setTimeout(() => {
                                if (this.scrollSync) {
                                    this.scrollSync._isSyncing = false;
                                }
                            }, 100);
                        }
                    };

                    if (hasSavedLine || percent > 0) {
                        restoreEditScroll();
                        setTimeout(restoreEditScroll, 50);
                        setTimeout(restoreEditScroll, 150);
                        setTimeout(restoreEditScroll, 300);
                        
                        // Listen for image load events inside preview pane to re-align as images load asynchronously
                        if (preview) {
                            const imgs = preview.querySelectorAll('img');
                            imgs.forEach(img => {
                                img.addEventListener('load', restoreEditScroll, { once: true });
                            });
                        }
                    }

                    // Enable scroll sync back after elements are laid out, scrolled, and potential events are flushed
                    setTimeout(() => {
                        if (this.scrollSync) {
                            this.scrollSync._isSyncing = false;
                        }
                    }, 500);
                }
            }
            return;
        }

        // Read-only visual mode
        body.innerHTML = `
            <article class="prd-document">
                ${this.renderer.renderMarkdownDocument(state.content)}
            </article>
        `;
        
        this.renderer.preparePrdImages(body);
        this.host.drawioModule?.mountPreviews(body);
        this.host.mindmapModule?.mountPreviews(body);
        this.renderer.generatePrdToc(body, this.host.annotationDrawer, state);
        this.bindViewActions(body);

        // Restore reader scroll progress
        if (state.status === 'ready' && !state.editMode) {
            const pageId = this.host.activePageId || '';
            const prdPath = state.path || '';
            if (pageId && prdPath) {
                const key = `readify:prd-scroll-percent:${pageId}:${prdPath}`;
                const percent = parseFloat(this.getLocalStorageItem(key, '0') || '0');
                if (percent > 0) {
                    const restoreReadScroll = () => {
                        body.scrollTop = percent * (body.scrollHeight - body.clientHeight);
                    };
                    restoreReadScroll();
                    setTimeout(restoreReadScroll, 50);
                    setTimeout(restoreReadScroll, 150);
                    setTimeout(restoreReadScroll, 300);

                    // Listen for image load events to re-align scroll progress as layout sizes adjust
                    const imgs = body.querySelectorAll('img');
                    imgs.forEach(img => {
                        img.addEventListener('load', restoreReadScroll, { once: true });
                    });
                }
            }
        }
    }

    /**
     * Binds click events on empty and error routes
     */
    bindEmptyActions(body) {
        const generateBtn = body.querySelector('[data-generate-prd]');
        const retryBtn = body.querySelector('[data-retry-prd]');

        generateBtn?.addEventListener('click', () => {
            this.host.triggerPrdGeneration?.();
        });
        retryBtn?.addEventListener('click', () => {
            this.manager.loadDocument({ force: true });
        });

        this._eventCleanup = () => {};
    }

    /**
     * Binds active document view elements (file switcher)
     */
    bindViewActions(body) {
        const handleTaskChange = async (event) => {
            const checkbox = event.target.closest('[data-prd-task-checkbox]');
            if (!checkbox) return;
            const item = checkbox.closest('[data-line]');
            const lineIndex = Number.parseInt(item?.dataset.line || '', 10);
            const currentContent = String(this.manager.state.content || '');
            const nextContent = this.renderer.setMarkdownTaskChecked(currentContent, lineIndex, checkbox.checked);
            if (nextContent === currentContent) {
                checkbox.checked = !checkbox.checked;
                return;
            }

            checkbox.disabled = true;
            const saved = await this.manager.saveDocument({ content: nextContent });
            checkbox.disabled = false;
            if (!saved) {
                checkbox.checked = !checkbox.checked;
                this.host.showToast?.(this.manager.state.saveError || '待办状态保存失败', true);
                return;
            }
            checkbox.setAttribute('aria-label', checkbox.checked ? '已完成' : '未完成');
            this.host.showToast?.(checkbox.checked ? '已完成待办' : '已恢复为未完成');
        };
        body.addEventListener('change', handleTaskChange);

        const handleDiagramClick = (event) => {
            const trigger = event.target.closest('[data-prd-open-diagram]');
            if (!trigger) return;
            event.preventDefault();
            this.host.openEmbeddedDiagram?.(trigger.dataset.prdOpenDiagram || '');
        };
        body.addEventListener('click', handleDiagramClick);

        // Read scroll logger
        const handleScrollRecord = () => {
            this.hideFloatingAiBtn();
            if (this.host.docDrawerMode !== 'prd' || this.manager.state.status !== 'ready' || this.manager.state.editMode) return;
            const scrollTop = body.scrollTop;
            const pageId = this.host.activePageId || '';
            const prdPath = this.manager.state.path || '';
            if (pageId && prdPath) {
                const percent = scrollTop / (body.scrollHeight - body.clientHeight || 1);
                this.setLocalStorageItem(`readify:prd-scroll-percent:${pageId}:${prdPath}`, percent);
            }
        };
        body.addEventListener('scroll', handleScrollRecord, { passive: true });

        this._eventCleanup = () => {
            body.removeEventListener('scroll', handleScrollRecord);
            body.removeEventListener('click', handleDiagramClick);
            body.removeEventListener('change', handleTaskChange);
        };
    }

    /**
     * Binds text-area shortcuts, tab indentations, format clicks and slash suggesting items
     */
    bindEditorActions(body) {
        const textarea = body.querySelector('[data-prd-editor]');
        const toolbar = body.querySelector('.prd-editor-global-toolbar');
        const slashMenu = body.querySelector('[data-prd-slash-menu]');

        if (!textarea) return;

        const handleDiagramClick = (event) => {
            const trigger = event.target.closest('[data-prd-open-diagram]');
            if (!trigger) return;
            event.preventDefault();
            this.host.openEmbeddedDiagram?.(trigger.dataset.prdOpenDiagram || '');
        };
        body.addEventListener('click', handleDiagramClick);

        const handleTaskChange = (event) => {
            const checkbox = event.target.closest('[data-prd-task-checkbox]');
            if (!checkbox) return;
            const item = checkbox.closest('[data-line]');
            const lineIndex = Number.parseInt(item?.dataset.line || '', 10);
            const nextContent = this.renderer.setMarkdownTaskChecked(textarea.value, lineIndex, checkbox.checked);
            if (nextContent === textarea.value) return;
            textarea.value = nextContent;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        };
        body.addEventListener('change', handleTaskChange);

        // 1. Textarea keystroke events (Shortcuts & Auto list continuations)
        const handleKeydown = (e) => {
            if (this.handleSlashKeydown(e, textarea)) {
                return;
            }

            const key = String(e.key || '').toLowerCase();
            
            // Cmd/Ctrl + S -> Save
            if ((e.metaKey || e.ctrlKey) && key === 's') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.insertPrototypeScreenshotAtCursor(textarea);
                } else {
                    this.save();
                }
                return;
            }

            // Shortcuts format bindings
            const simpleKeymap = {
                b: 'bold',
                i: 'italic',
                k: 'link',
                e: 'inline-code'
            };
            if ((e.metaKey || e.ctrlKey) && simpleKeymap[key]) {
                e.preventDefault();
                this.applyFormat(simpleKeymap[key], textarea);
                return;
            }

            // Command Alt [1-6] -> Headings
            if ((e.metaKey || e.ctrlKey) && e.altKey && /^[1-6]$/.test(key)) {
                e.preventDefault();
                this.applyFormat(`heading-${key}`, textarea);
                return;
            }

            // Command Shift bindings
            const shiftKeymap = {
                '7': 'ordered',
                '8': 'unordered',
                x: 'strikethrough',
                c: 'code-block',
                q: 'quote'
            };
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && shiftKeymap[key]) {
                e.preventDefault();
                this.applyFormat(shiftKeymap[key], textarea);
                return;
            }

            // Smart Enter lists continuations
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const value = textarea.value;
                const start = textarea.selectionStart;
                const lineStartIndex = value.lastIndexOf('\n', start - 1) + 1;
                const lineUpToCursor = value.substring(lineStartIndex, start);

                const unorderedRegex = /^(\s*[-*+]\s+(?:\[[ xX]\]\s+)?)(.*)$/;
                const orderedRegex = /^(\s*)(\d+)\.\s+(.*)$/;
                const quoteRegex = /^(\s*>\s*)(.*)$/;

                let match = lineUpToCursor.match(unorderedRegex);
                if (match) {
                    e.preventDefault();
                    const prefix = match[1];
                    const rest = match[2];

                    if (rest.trim() === '') {
                        textarea.value = value.substring(0, lineStartIndex) + value.substring(start);
                        textarea.setSelectionRange(lineStartIndex, lineStartIndex);
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        let nextPrefix = prefix;
                        if (prefix.includes('[x]') || prefix.includes('[X]')) {
                            nextPrefix = prefix.replace(/\[[xX]\]/, '[ ]');
                        }
                        this.insertRawText(textarea, '\n' + nextPrefix);
                    }
                    return;
                }

                match = lineUpToCursor.match(orderedRegex);
                if (match) {
                    e.preventDefault();
                    const indent = match[1];
                    const numStr = match[2];
                    const rest = match[3];

                    if (rest.trim() === '') {
                        textarea.value = value.substring(0, lineStartIndex) + value.substring(start);
                        textarea.setSelectionRange(lineStartIndex, lineStartIndex);
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        const nextNum = parseInt(numStr, 10) + 1;
                        this.insertRawText(textarea, `\n${indent}${nextNum}. `);
                    }
                    return;
                }

                match = lineUpToCursor.match(quoteRegex);
                if (match) {
                    e.preventDefault();
                    const prefix = match[1];
                    const rest = match[2];

                    if (rest.trim() === '') {
                        textarea.value = value.substring(0, lineStartIndex) + value.substring(start);
                        textarea.setSelectionRange(lineStartIndex, lineStartIndex);
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        this.insertRawText(textarea, '\n' + prefix);
                    }
                    return;
                }
            }

            // Tab & Shift+Tab indents
            if (e.key === 'Tab') {
                e.preventDefault();
                this.indentSelection(textarea, e.shiftKey);
                return;
            }

            // Suggestion Escape close
            if (e.key === 'Escape') {
                this.closeSlashCommand(slashMenu);
            }
        };

        const renderEditorPreview = () => {
            if ((this.host.prdEditorLayout || 'source') === 'source') return;
            const preview = body.querySelector('.prd-editor-preview');
            if (preview) {
                this.scrollSync.refreshPreview(textarea, preview, () => {
                    // Capture existing rendered visual cards (diagrams + mindmaps)
                    // before rebuilding innerHTML, so we don't destroy and reload
                    // their preview iframes on every keystroke.
                    const captureCards = (selector, pathAttr, renderSelector) => {
                        const map = new Map();
                        preview.querySelectorAll(selector).forEach((card) => {
                            const path = card.dataset[pathAttr] || '';
                            const render = card.querySelector(renderSelector);
                            if (path && render) map.set(path, card);
                        });
                        return map;
                    };
                    const restoreCards = (selector, pathAttr, previewAttr, previousCards, prevSignature) => {
                        const nextSignature = Array.from(preview.querySelectorAll(selector))
                            .map((card) => card.dataset[pathAttr])
                            .join('|');
                        const changed = nextSignature !== prevSignature;
                        if (!changed && previousCards.size > 0) {
                            preview.querySelectorAll(selector).forEach((card) => {
                                const path = card.dataset[pathAttr] || '';
                                const previousCard = previousCards.get(path);
                                if (!previousCard) return;
                                const previousPreview = previousCard.querySelector(`[${previewAttr}]`);
                                const currentPreview = card.querySelector(`[${previewAttr}]`);
                                if (previousPreview && currentPreview) {
                                    currentPreview.replaceWith(previousPreview);
                                    card.classList.add('is-ready');
                                }
                            });
                        }
                        return nextSignature;
                    };

                    const previousDiagrams = captureCards('[data-prd-diagram-path]', 'prdDiagramPath', '.prd-diagram-card__frame');
                    const previousMindmaps = captureCards('[data-prd-mindmap-path]', 'prdMindmapPath', '.prd-mindmap-card__render');

                    preview.innerHTML = textarea.value.trim()
                        ? this.renderer.renderMarkdownDocument(textarea.value)
                        : '<p class="prd-editor-preview-empty">这里会显示 Markdown 预览。</p>';
                    this.renderer.preparePrdImages(preview);

                    // Restore previously rendered cards to avoid reloading their iframes on each keystroke.
                    this._previewDiagramSignature = restoreCards(
                        '[data-prd-diagram-path]', 'prdDiagramPath', 'data-prd-diagram-preview',
                        previousDiagrams, this._previewDiagramSignature
                    );
                    this._previewMindmapSignature = restoreCards(
                        '[data-prd-mindmap-path]', 'prdMindmapPath', 'data-prd-mindmap-preview',
                        previousMindmaps, this._previewMindmapSignature
                    );

                    this.host.drawioModule?.mountPreviews(preview);
                    this.host.mindmapModule?.mountPreviews(preview);
                    this.renderer.generatePrdToc(body, this.host.annotationDrawer, this.manager.state);
                });
            }
        };

        const scheduleEditorPreviewRender = () => {
            window.clearTimeout(this._previewRenderTimer);
            if ((this.host.prdEditorLayout || 'source') === 'source') return;
            this._previewRenderTimer = window.setTimeout(renderEditorPreview, 260);
        };

        // 2. Typing Input event (Updates draft & processes slash command trigger)
        const handleInput = () => {
            this.manager.updateDraft(textarea.value);

            // Sync live word count stats
            this.updateStatsCounters(body);

            // Preview rendering can rebuild draw.io exports, so keep it off the keystroke path.
            scheduleEditorPreviewRender();

            // Check Slash suggested overlays
            this.updateSlashCommandState(textarea, slashMenu);
        };

        const handleSelect = () => {
            // Keep stats current on mouse highlights
            this.updateStatsCounters(body);
        };

        // 6. Image paste handler — uploads pasted images to docs/prd-assets/ and
        // inserts the corresponding Markdown at the caret.
        const handlePaste = (event) => {
            const items = event.clipboardData?.items;
            if (!items) return;
            let imageFile = null;
            for (const item of items) {
                if (item.kind === 'file' && typeof item.type === 'string' && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        imageFile = file;
                        break;
                    }
                }
            }
            if (!imageFile) return; // Plain-text pastes fall through to default behavior
            event.preventDefault();
            this.insertPastedImageAtCursor(textarea, imageFile);
        };

        textarea.addEventListener('keydown', handleKeydown);
        textarea.addEventListener('input', handleInput);
        textarea.addEventListener('select', handleSelect);
        textarea.addEventListener('paste', handlePaste);

        // 3. Toolbar format click actions
        const handleToolbarClick = (e) => {
            const targetBtn = e.target.closest('[data-prd-format]');
            if (targetBtn) {
                e.stopPropagation();
                const fmt = targetBtn.dataset.prdFormat;
                this.applyFormat(fmt, textarea);
            }
            
            // Layout toggles
            const layoutBtn = e.target.closest('[data-prd-layout]');
            if (layoutBtn) {
                e.stopPropagation();
                const lyt = layoutBtn.dataset.prdLayout;
                
                // Failsafe: record current progress before changing layout
                const pageId = this.host.activePageId || '';
                const prdPath = this.manager.state.path || '';
                if (pageId && prdPath) {
                    const currentLayout = this.host.prdEditorLayout || 'source';
                    const textarea = body.querySelector('[data-prd-editor]');
                    const preview = body.querySelector('.prd-editor-preview');
                    let percent = 0;
                    let line = null;
                    if (currentLayout === 'preview' && preview) {
                        percent = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1);
                        if (this.scrollSync && textarea) {
                            line = this.scrollSync.getPreviewTopLine(textarea, preview, {
                                limitToSourceScroll: false
                            });
                        }
                    } else if (textarea) {
                        percent = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight || 1);
                        if (this.scrollSync) {
                            line = this.scrollSync.getSourceTopLine(textarea);
                        }
                    }
                    if (percent > 0) {
                        this.setLocalStorageItem(`readify:prd-scroll-percent:${pageId}:${prdPath}`, percent);
                    }
                    if (Number.isFinite(line) && line >= 0) {
                        this.setLocalStorageItem(`readify:prd-scroll-line:${pageId}:${prdPath}`, String(line));
                    }
                }

                this.host.prdEditorLayout = lyt;
                this.host.persistPrdEditorLayout?.();
                this.render();
            }
        };

        toolbar?.addEventListener('click', handleToolbarClick);

        // 4. Slash suggest popup click events
        const handleSlashMenuClick = (e) => {
            const item = e.target.closest('[data-prd-slash-command]');
            if (item) {
                e.stopPropagation();
                this.executeSlashCommand(item.dataset.prdSlashCommand, textarea, slashMenu);
            }
        };

        slashMenu?.addEventListener('click', handleSlashMenuClick);
        // 5. Scroll recorders for edit mode (Source and Preview)
        const preview = body.querySelector('.prd-editor-preview');
        const pageId = this.host.activePageId || '';
        const prdPath = this.manager.state.path || '';

        const handleTextareaScrollRecord = () => {
            this.hideFloatingAiBtn();
            if (this.host.docDrawerMode !== 'prd' || this.manager.state.status !== 'ready' || !this.manager.state.editMode) return;
            if (this.scrollSync && this.scrollSync._isSyncing) return;
            if (pageId && prdPath) {
                const percent = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight || 1);
                this.setLocalStorageItem(`readify:prd-scroll-percent:${pageId}:${prdPath}`, percent);
                if (this.scrollSync) {
                    const line = this.scrollSync.getSourceTopLine(textarea);
                    if (Number.isFinite(line) && line >= 0) {
                        this.setLocalStorageItem(`readify:prd-scroll-line:${pageId}:${prdPath}`, String(line));
                    }
                }
            }
        };

        const handlePreviewScrollRecord = () => {
            this.hideFloatingAiBtn();
            if (this.host.docDrawerMode !== 'prd' || this.manager.state.status !== 'ready' || !this.manager.state.editMode) return;
            if (this.scrollSync && this.scrollSync._isSyncing) return;
            if (pageId && prdPath && preview) {
                const percent = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1);
                this.setLocalStorageItem(`readify:prd-scroll-percent:${pageId}:${prdPath}`, percent);
                if (this.scrollSync) {
                    const line = this.scrollSync.getPreviewTopLine(textarea, preview, {
                        limitToSourceScroll: this.host.prdEditorLayout !== 'preview'
                    });
                    if (Number.isFinite(line) && line >= 0) {
                        this.setLocalStorageItem(`readify:prd-scroll-line:${pageId}:${prdPath}`, String(line));
                    }
                }
            }
        };

        textarea.addEventListener('scroll', handleTextareaScrollRecord, { passive: true });
        preview?.addEventListener('scroll', handlePreviewScrollRecord, { passive: true });

        // Cleanup bindings
        this._eventCleanup = () => {
            window.clearTimeout(this._previewRenderTimer);
            this._previewRenderTimer = null;
            textarea.removeEventListener('keydown', handleKeydown);
            textarea.removeEventListener('input', handleInput);
            textarea.removeEventListener('select', handleSelect);
            textarea.removeEventListener('paste', handlePaste);
            textarea.removeEventListener('scroll', handleTextareaScrollRecord);
            preview?.removeEventListener('scroll', handlePreviewScrollRecord);
            toolbar?.removeEventListener('click', handleToolbarClick);
            slashMenu?.removeEventListener('click', handleSlashMenuClick);
            body.removeEventListener('click', handleDiagramClick);
            body.removeEventListener('change', handleTaskChange);
        };

        // Render visual stats immediately
        this.updateStatsCounters(body);
    }

    /**
     * Inserts text safely at current caret position with undo support
     */
    insertRawText(textarea, insertText) {
        textarea.focus();
        try {
            if (!document.execCommand('insertText', false, insertText)) {
                throw new Error();
            }
        } catch {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const val = textarea.value;
            textarea.value = val.substring(0, start) + insertText + val.substring(end);
            const newPos = start + insertText.length;
            textarea.setSelectionRange(newPos, newPos);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    /**
     * Resolves metadata stats about characters and lines
     */
    updateStatsCounters(body) {
        const textarea = body.querySelector('[data-prd-editor]');
        if (!textarea) return;

        const val = textarea.value;
        const selected = val.slice(textarea.selectionStart, textarea.selectionEnd);
        const sourceText = selected || val;

        const linesCount = val.split('\n').length;
        const charsCount = sourceText.length;
        const wordsCount = (sourceText.trim().match(/[\u4e00-\u9fa5]|\b\w+\b/g) || []).length;

        const linesEl = body.querySelector('[data-prd-editor-stat="lines"]');
        const wordsEl = body.querySelector('[data-prd-editor-stat="words"]');
        const charsEl = body.querySelector('[data-prd-editor-stat="chars"]');

        const prefix = selected ? '选中 ' : '';

        if (linesEl) linesEl.textContent = `${prefix}${linesCount} 行`;
        if (wordsEl) wordsEl.textContent = `${prefix}${wordsCount} 词`;
        if (charsEl) charsEl.textContent = `${prefix}${charsCount} 字符`;
    }

    /**
     * Formatting processor mapping actions to Markdown styles
     */
    applyFormat(format, textarea) {
        textarea.focus();
        const value = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = value.slice(start, end);

        const linePrefixmap = {
            quote: '> ',
            unordered: '- ',
            ordered: '1. ',
            task: '- [ ] '
        };

        const headingMatch = /^heading-([1-6])$/.exec(format);
        if (headingMatch) {
            this.setHeadingLevel(Number(headingMatch[1]), textarea);
            return;
        }

        if (format === 'heading') {
            this.setHeadingLevel(2, textarea);
            return;
        }

        if (linePrefixmap[format]) {
            this.prefixEditorLines(linePrefixmap[format], textarea);
            return;
        }

        // Wrapping actions
        const wrapperKeymaps = {
            bold: ['**', '**', '重点文字'],
            italic: ['_', '_', '补充说明'],
            strikethrough: ['~~', '~~', '删除线文字'],
            'inline-code': ['`', '`', 'code']
        };

        if (wrapperKeymaps[format]) {
            const [before, after, placeholder] = wrapperKeymaps[format];
            const text = selected || placeholder;
            const replaced = `${before}${text}${after}`;
            this.replaceSelection(replaced, textarea, start, end, start + before.length, start + before.length + text.length);
            return;
        }

        // Block replacements
        if (format === 'code-block') {
            this.replaceSelection(`\n\`\`\`\n${selected || '示例内容'}\n\`\`\`\n`, textarea);
            return;
        }
        if (format === 'link') {
            this.replaceSelection(selected ? `[${selected}](https://example.com)` : '[链接文字](https://example.com)', textarea);
            return;
        }
        if (format === 'table') {
            this.replaceSelection('\n| 字段 | 说明 |\n| --- | --- |\n| 示例 | 内容 |\n', textarea);
            return;
        }
        if (format === 'hr') {
            this.replaceSelection('\n---\n', textarea);
            return;
        }
        if (format === 'shot') {
            this.insertPrototypeScreenshotAtCursor(textarea);
        }
    }

    replaceSelection(nextText, textarea, start = textarea.selectionStart, end = textarea.selectionEnd, nextStart = null, nextEnd = null) {
        const val = textarea.value;
        const replaced = `${val.slice(0, start)}${nextText}${val.slice(end)}`;
        textarea.value = replaced;
        const caretStart = nextStart ?? (start + nextText.length);
        const caretEnd = nextEnd ?? caretStart;
        textarea.setSelectionRange(caretStart, caretEnd);
        this.manager.updateDraft(replaced);
        
        // Trigger manual input to force update preview
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    prefixEditorLines(prefix, textarea) {
        const val = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const lineStart = val.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const lineEndIndex = val.indexOf('\n', end);
        const lineEnd = lineEndIndex === -1 ? val.length : lineEndIndex;
        const selectedBlock = val.slice(lineStart, lineEnd);
        const nextBlock = selectedBlock
            .split('\n')
            .map((line) => line.startsWith(prefix) ? line.slice(prefix.length) : `${prefix}${line}`)
            .join('\n');
        this.replaceSelection(nextBlock, textarea, lineStart, lineEnd, lineStart, lineStart + nextBlock.length);
    }

    setHeadingLevel(level, textarea) {
        const val = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const lineStart = val.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const lineEndIndex = val.indexOf('\n', end);
        const lineEnd = lineEndIndex === -1 ? val.length : lineEndIndex;
        const selectedBlock = val.slice(lineStart, lineEnd);
        const prefix = `${'#'.repeat(Math.max(1, Math.min(level, 6)))} `;
        const nextBlock = selectedBlock
            .split('\n')
            .map((line) => `${prefix}${line.replace(/^#{1,6}\s+/, '')}`)
            .join('\n');
        this.replaceSelection(nextBlock, textarea, lineStart, lineEnd, lineStart, lineStart + nextBlock.length);
    }

    indentSelection(textarea, outdent = false) {
        const val = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const lineStart = val.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const lineEndIndex = val.indexOf('\n', end);
        const lineEnd = lineEndIndex === -1 ? val.length : lineEndIndex;
        const selectedBlock = val.slice(lineStart, lineEnd);

        const isMultiLine = val.slice(start, end).includes('\n');
        const nextBlock = selectedBlock
            .split('\n')
            .map((line) => outdent ? line.replace(/^ {1,2}/, '') : `  ${line}`)
            .join('\n');

        this.replaceSelection(nextBlock, textarea, lineStart, lineEnd, null, null);

        if (isMultiLine) {
            textarea.setSelectionRange(lineStart, lineStart + nextBlock.length);
        } else {
            const diff = nextBlock.length - selectedBlock.length;
            const newCaret = Math.max(lineStart, start + diff);
            textarea.setSelectionRange(newCaret, newCaret);
        }
    }

    /**
     * Triggers host Playwright screenshot logic
     */
    async insertPrototypeScreenshotAtCursor(textarea) {
        if (!textarea) return;

        // Let host process full iframe serialization
        if (this.host.insertPrototypeScreenshotAtCursor) {
            await this.host.insertPrototypeScreenshotAtCursor(textarea);
        } else {
            this.host.showToast('截图功能需要在 Bridge 运行环境中才能使用', 'error');
        }
    }

    /**
     * Uploads a pasted image to docs/prd-assets/ via the Bridge and inserts
     * the corresponding Markdown image at the caret. Reuses the same /api/prd-asset
     * pipeline as prototype screenshots so assets land in a single shared folder.
     */
    async insertPastedImageAtCursor(textarea, file) {
        if (!textarea || !file || this._pastingImage) return;
        this._pastingImage = true;
        this.host.showToast('正在保存粘贴的图片...');

        try {
            const supportedTypes = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
            let dataUrl = null;
            let ext = 'png';
            let contentType = 'image/png';

            if (Object.prototype.hasOwnProperty.call(supportedTypes, file.type)) {
                dataUrl = await this._readBlobAsDataUrl(file);
                ext = supportedTypes[file.type];
                contentType = file.type;
            } else {
                // Normalize unsupported formats (gif/bmp/svg/…) to PNG via canvas.
                dataUrl = await this.convertBlobToPngDataUrl(file);
            }

            const baseName = (file.name && file.name.trim())
                ? file.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 40)
                : `paste`;
            const filename = `${baseName || 'paste'}-${Date.now()}.${ext}`;

            const response = await fetch('http://localhost:8080/api/prd-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.host.activeProjectId || 'readify',
                    pageId: this.host.activePageId,
                    version: this.host.activeVersion,
                    prdPath: this.manager.state.path || '',
                    filename,
                    contentType,
                    dataUrl
                })
            });

            if (!response.ok) {
                throw new Error((await response.text()) || '保存粘贴图片失败');
            }

            const result = await response.json();
            const markdownPath = result.markdownPath || result.path;
            if (!markdownPath) throw new Error('保存粘贴图片失败：缺少图片路径');

            const label = baseName || '图片';
            this.replaceSelection(`\n![${label}](${markdownPath})\n`, textarea);
            this.host.showToast('已插入粘贴的图片');
        } catch (error) {
            this.host.showToast(`粘贴图片失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
        } finally {
            this._pastingImage = false;
        }
    }

    _readBlobAsDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('读取剪贴板图片失败'));
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Decodes an arbitrary image blob and re-encodes it as a PNG data URL so the
     * Bridge asset pipeline (which only accepts png/jpeg/webp) can persist it.
     */
    convertBlobToPngDataUrl(blob) {
        return new Promise((resolve, reject) => {
            this._readBlobAsDataUrl(blob).then((dataUrl) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width;
                        canvas.height = img.naturalHeight || img.height;
                        canvas.getContext('2d').drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    } catch (err) {
                        reject(err instanceof Error ? err : new Error('图片转换失败'));
                    }
                };
                img.onerror = () => reject(new Error('无法解析剪贴板图片'));
                img.src = dataUrl;
            }).catch(reject);
        });
    }

    // --- Slash Suggestions ---

    getSlashCommands() {
        return [
            { id: 'shot', label: '/shot', description: '截取当前原型界面并插入图片', aliases: ['screenshot', 'screen', '截图', 'jietu'] },
            { id: 'table', label: '/table', description: '表格', aliases: ['表格'] },
            { id: 'diagram', label: '/diagram', description: '在当前位置插入可编辑流程图', aliases: ['drawio', 'flow', '流程图', 'liuchengtu'] },
            { id: 'mindmap', label: '/mindmap', description: '在当前位置插入可编辑思维导图', aliases: ['mind', '脑图', '思维导图', 'siweidaotu'] },
            { id: 'heading-1', label: '/h1', description: '一级标题', aliases: ['title', '标题1'] },
            { id: 'heading-2', label: '/h2', description: '二级标题', aliases: ['heading', '标题2'] },
            { id: 'heading-3', label: '/h3', description: '三级标题', aliases: ['标题3'] },
            { id: 'bold', label: '/bold', description: '加粗', aliases: ['b', 'strong', '加粗'] },
            { id: 'italic', label: '/italic', description: '斜体', aliases: ['i', 'em', '斜体'] },
            { id: 'strikethrough', label: '/strike', description: '删除线', aliases: ['s', 'del', '删除线'] },
            { id: 'quote', label: '/quote', description: '引用块', aliases: ['q', '引用'] },
            { id: 'unordered', label: '/ul', description: '无序列表', aliases: ['list', 'bullet', '列表'] },
            { id: 'ordered', label: '/ol', description: '有序列表', aliases: ['number', '编号'] },
            { id: 'task', label: '/task', description: '待办列表', aliases: ['todo', 'checkbox', '待办', '任务'] },
            { id: 'inline-code', label: '/code', description: '行内代码', aliases: ['inline', '代码'] },
            { id: 'code-block', label: '/block', description: '代码块', aliases: ['pre', '代码块'] },
            { id: 'link', label: '/link', description: '链接', aliases: ['url', '链接'] },
            { id: 'hr', label: '/hr', description: '分割线', aliases: ['line', '分割线'] }
        ];
    }

    getFilteredSlashCommands(query = '') {
        const normalized = String(query || '').trim().toLowerCase();
        const commands = this.getSlashCommands();
        if (!normalized) return commands.slice(0, 8);
        return commands.filter((cmd) => {
            const haystack = [cmd.id, cmd.label, cmd.description, ...(cmd.aliases || [])].join(' ').toLowerCase();
            return haystack.includes(normalized);
        }).slice(0, 8);
    }

    updateSlashCommandState(textarea, menu) {
        if (!textarea || !menu) return;
        const caret = textarea.selectionStart;
        const beforeCaret = textarea.value.slice(0, caret);
        const tokenMatch = /(^|[\s\n])\/([\w\u4e00-\u9fff-]*)$/.exec(beforeCaret);
        
        if (!tokenMatch) {
            this.closeSlashCommand(menu);
            return;
        }

        const query = tokenMatch[2] || '';
        const start = caret - query.length - 1;
        const commands = this.getFilteredSlashCommands(query);
        
        if (!commands.length) {
            this.closeSlashCommand(menu);
            return;
        }

        this.slashCommand = {
            active: true,
            query,
            start,
            end: caret,
            selectedIndex: Math.min(this.slashCommand?.selectedIndex || 0, commands.length - 1)
        };

        this.renderer.renderPrdSlashCommandMenu(commands, menu, this.slashCommand.selectedIndex);
    }

    closeSlashCommand(menu) {
        this.slashCommand = {
            active: false,
            query: '',
            start: 0,
            end: 0,
            selectedIndex: 0
        };
        if (menu) menu.hidden = true;
    }

    handleSlashKeydown(event, textarea) {
        if (!this.slashCommand?.active) return false;
        
        const menu = this.host.annotationDrawerBody?.querySelector('[data-prd-slash-menu]');
        if (!menu) return false;

        const commands = this.getFilteredSlashCommands(this.slashCommand.query);
        if (!commands.length) {
            this.closeSlashCommand(menu);
            return false;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.slashCommand.selectedIndex = (this.slashCommand.selectedIndex + 1) % commands.length;
            this.renderer.renderPrdSlashCommandMenu(commands, menu, this.slashCommand.selectedIndex);
            return true;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.slashCommand.selectedIndex = (this.slashCommand.selectedIndex - 1 + commands.length) % commands.length;
            this.renderer.renderPrdSlashCommandMenu(commands, menu, this.slashCommand.selectedIndex);
            return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            this.executeSlashCommand(commands[this.slashCommand.selectedIndex]?.id, textarea, menu);
            return true;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            this.closeSlashCommand(menu);
            return true;
        }
        return false;
    }

    async executeSlashCommand(commandId, textarea, menu) {
        if (!textarea || !commandId) return;
        const slash = this.slashCommand || {};
        if (commandId === 'diagram') {
            const insertionStart = slash.active ? slash.start : textarea.selectionStart;
            const insertionEnd = slash.active ? slash.end : textarea.selectionEnd;
            this.closeSlashCommand(menu);
            try {
                this.host.showToast('正在创建流程图…');
                const diagram = await this.host.drawioModule?.manager.createDiagram({ title: '流程图' });
                if (!diagram?.path) throw new Error('未能创建流程图文件');
                const before = textarea.value.slice(0, insertionStart);
                const after = textarea.value.slice(insertionEnd);
                const prefix = before && !before.endsWith('\n') ? '\n' : '';
                const suffix = after && !after.startsWith('\n') ? '\n' : '';
                const directive = `${prefix}:::drawio path="${diagram.path}" title="流程图"${suffix}`;
                const caret = insertionStart + directive.length;
                this.replaceSelection(directive, textarea, insertionStart, insertionEnd, caret, caret);
                this.host.showToast('流程图已插入，点击预览即可编辑');
            } catch (error) {
                this.host.showToast(`新增流程图失败：${error.message || error}`, 'error');
                textarea.focus();
            }
            return;
        }
        if (commandId === 'mindmap') {
            const insertionStart = slash.active ? slash.start : textarea.selectionStart;
            const insertionEnd = slash.active ? slash.end : textarea.selectionEnd;
            this.closeSlashCommand(menu);
            try {
                this.host.showToast('正在创建思维导图…');
                const mindmap = await this.host.mindmapModule?.manager.createMindmap({ title: '思维导图' });
                if (!mindmap?.path) throw new Error('未能创建思维导图文件');
                const before = textarea.value.slice(0, insertionStart);
                const after = textarea.value.slice(insertionEnd);
                const prefix = before && !before.endsWith('\n') ? '\n' : '';
                const suffix = after && !after.startsWith('\n') ? '\n' : '';
                const directive = `${prefix}:::mindmap path="${mindmap.path}" title="思维导图"${suffix}`;
                const caret = insertionStart + directive.length;
                this.replaceSelection(directive, textarea, insertionStart, insertionEnd, caret, caret);
                this.host.showToast('思维导图已插入，点击预览即可编辑');
            } catch (error) {
                this.host.showToast(`新增思维导图失败：${error.message || error}`, 'error');
                textarea.focus();
            }
            return;
        }
        if (slash.active) {
            this.replaceSelection('', textarea, slash.start, slash.end, slash.start, slash.start);
        }
        this.closeSlashCommand(menu);
        textarea.focus();
        this.applyFormat(commandId, textarea);
    }

    /**
     * Synchronizes edit, save, cancel, and status UI controls based on active document state.
     */
    syncPrdActionButtons(state = this.manager.state) {
        const isPrdMode = this.host.docDrawerMode === 'prd';
        const isReady = state?.status === 'ready';
        const isEditing = Boolean(state?.editMode);
        const isSaving = Boolean(state?.saving);
        const isDirty = Boolean(state?.dirty);
        const isShareMode = this.host.isShareMode || window.__READIFY_SHARE__ || window.location.pathname.includes('/shares/');

        if (this.host.prdAiBtn) {
            this.host.prdAiBtn.hidden = !isPrdMode || !isReady || isEditing || isShareMode;
            this.host.prdAiBtn.disabled = !isReady;
            if (isShareMode) {
                this.host.prdAiBtn.style.display = 'none';
            }
        }

        if (this.host.prdEditBtn) {
            this.host.prdEditBtn.hidden = !isPrdMode || !isReady || isEditing || isShareMode;
            this.host.prdEditBtn.disabled = !isReady || isSaving;
            if (isShareMode) {
                this.host.prdEditBtn.style.display = 'none';
            }
        }
        if (this.host.prdSaveBtn) {
            this.host.prdSaveBtn.hidden = !isPrdMode || !isEditing || isShareMode;
            this.host.prdSaveBtn.disabled = !isDirty || isSaving;
            this.host.prdSaveBtn.title = isSaving ? '正在保存 PRD' : '保存 PRD';
            if (isShareMode) {
                this.host.prdSaveBtn.style.display = 'none';
            }
        }
        if (this.host.prdCancelEditBtn) {
            this.host.prdCancelEditBtn.hidden = !isPrdMode || !isEditing || isShareMode;
            this.host.prdCancelEditBtn.disabled = isSaving;
            if (isShareMode) {
                this.host.prdCancelEditBtn.style.display = 'none';
            }
        }

        const body = this.host.annotationDrawerBody;
        body?.querySelectorAll('[data-prd-save]').forEach((button) => {
            button.disabled = !isDirty || isSaving;
            button.textContent = isSaving ? '保存中' : (isDirty ? '保存' : '已保存');
        });
        body?.querySelectorAll('[data-prd-cancel]').forEach((button) => {
            button.disabled = isSaving;
        });

        const status = body?.querySelector('[data-prd-editor-status]');
        if (status) {
            if (state?.saveError) {
                status.textContent = state.saveError;
                status.classList.add('is-error');
            } else {
                status.classList.remove('is-error');
                status.textContent = isSaving
                    ? '正在写入本地 Markdown'
                    : isDirty
                        ? '有未保存修改'
                        : '已保存';
            }
        }
    }

    /**
     * Binds dropdown toggle, document switching, and physical deletion inside the metadata switcher dropdown
     */
    bindMetaSwitcherEvents() {
        const metaEl = this.host.annotationDrawerMeta;
        if (!metaEl) return;

        const trigger = metaEl.querySelector('[data-prd-manage-trigger]');
        const dropdown = metaEl.querySelector('[data-prd-dropdown]');

        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isHidden = dropdown.hidden;
                dropdown.hidden = !isHidden;
                trigger.classList.toggle('is-active', isHidden);
            });
        }

        // Bind switch document events
        const switchItems = metaEl.querySelectorAll('[data-prd-switch-path]');
        switchItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dropdown) {
                    dropdown.hidden = true;
                    trigger?.classList.remove('is-active');
                }
                const path = item.dataset.prdSwitchPath;
                if (path && path !== this.manager.state.path) {
                    this.manager.loadDocument({ force: true, path });
                }
            });
        });

        // Bind delete document events
        const deleteBtns = metaEl.querySelectorAll('[data-prd-delete-path]');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const path = btn.dataset.prdDeletePath;
                const filename = btn.dataset.prdDeleteFilename || '';
                await this.deleteDocumentFlow(path, filename);
            });
        });

        const createBtn = metaEl.querySelector('[data-prd-create-document]');
        createBtn?.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dropdown) {
                dropdown.hidden = true;
                trigger?.classList.remove('is-active');
            }
            await this.createNewDocument();
        });
    }

    /**
     * Executes physical deletion flow of a PRD file with user confirmation
     */
    async deleteDocumentFlow(path, filename) {
        const confirmed = await this.host.showConfirm({
            title: '确认物理删除 PRD 文件',
            message: `此操作将从磁盘上永久删除文件「${filename}」，且无法从回收站恢复！确认删除吗？`,
            okText: '确认删除'
        });
        if (!confirmed) return;

        try {
            const response = await fetch('http://localhost:8080/api/prd-doc/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.host.activeProjectId || 'readify',
                    pageId: this.host.activePageId,
                    version: this.host.activeVersion,
                    path
                })
            });

            if (!response.ok) {
                throw new Error(await response.text() || '删除 PRD 失败');
            }

            const result = await response.json();
            this.host.showToast(`已删除文件「${filename}」`);

            // Clear local storage entries for this document
            const pageId = this.host.activePageId || '';
            this.removeLocalStorageItem(`readify:prd-scroll-percent:${pageId}:${path}`);
            this.removeLocalStorageItem(`readify:prd-edit-mode:${pageId}:${path}`);

            // Update manager state
            const updatedDocs = Array.isArray(result.documents) ? result.documents : [];
            
            // If the deleted document was the current active document
            if (this.manager.state.path === path) {
                // Switch to the first remaining document
                const nextDoc = updatedDocs[0];
                if (nextDoc) {
                    await this.manager.loadDocument({ force: true, path: nextDoc.path });
                } else {
                    // No documents left, reset to empty state
                    this.manager.updateState({
                        status: 'empty',
                        content: '',
                        draftContent: '',
                        path: '',
                        outputUrl: '',
                        documents: []
                    });
                }
            } else {
                // Just update the documents list in state
                this.manager.updateState({
                    documents: this.manager.sortPrdDocuments(this.manager.getUniquePrdDocuments(updatedDocs))
                });
            }
        } catch (error) {
            console.error('Delete PRD error:', error);
            this.host.showToast(`删除失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    }

    /**
     * Handles selectionchange event to show/hide the floating AI popover
     */
    handleSelectionChange() {
        if (this.host.docDrawerMode !== 'prd') {
            this.hideFloatingAiBtn();
            return;
        }

        const isShareMode = this.host.isShareMode || window.__READIFY_SHARE__ || window.location.pathname.includes('/shares/');
        if (isShareMode) {
            this.hideFloatingAiBtn();
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            this.hideFloatingAiBtn();
            return;
        }

        const range = selection.getRangeAt(0);
        const text = selection.toString().trim();
        if (!text) {
            this.hideFloatingAiBtn();
            return;
        }

        // Verify if the selection is inside .prd-document or .prd-editor-preview
        let node = range.commonAncestorContainer;
        if (node.nodeType !== 1) {
            node = node.parentElement;
        }

        const isInsidePrd = node && node.closest('.prd-document, .prd-editor-preview');
        if (!isInsidePrd) {
            this.hideFloatingAiBtn();
            return;
        }

        // Display floating button
        const rect = range.getBoundingClientRect();
        this.showFloatingAiBtn(rect, text);
    }

    /**
     * Renders and positions the floating AI context popover
     * @param {DOMRect} rect - The selection bounding rect
     * @param {string} text - The selected text
     */
    showFloatingAiBtn(rect, text) {
        const isShareMode = this.host.isShareMode || window.__READIFY_SHARE__ || window.location.pathname.includes('/shares/');
        if (isShareMode) {
            this.hideFloatingAiBtn();
            return;
        }
        let popover = document.getElementById('prdSelectionAiPopover');
        if (!popover) {
            popover = document.createElement('div');
            popover.id = 'prdSelectionAiPopover';
            popover.className = 'prd-selection-ai-popover';
            popover.innerHTML = `
                <button class="prd-selection-ai-btn" type="button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                    </svg>
                    <span>问 AI</span>
                </button>
            `;
            document.body.appendChild(popover);

            popover.querySelector('button').addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const selectedText = popover.dataset.text;
                this.askAiAboutSelection(selectedText);
            });
        }

        popover.dataset.text = text;

        // Position the popover above the center of the bounding rect (fixed placement)
        const left = rect.left + rect.width / 2;
        const top = rect.top;

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        popover.style.display = 'flex';
    }

    /**
     * Hides the floating AI popover
     */
    hideFloatingAiBtn() {
        const popover = document.getElementById('prdSelectionAiPopover');
        if (popover) {
            popover.style.display = 'none';
        }
    }

    /**
     * Sends selected text context to Prota Agent
     */
    askAiAboutSelection(text) {
        if (!text) return;
        this.hideFloatingAiBtn();

        // Collapse selection
        window.getSelection()?.removeAllRanges();

        // Open workbench
        this.host.openAgentWorkbench?.();

        // Set context in host
        if (typeof this.host.setAgentPrdContext === 'function') {
            this.host.setAgentPrdContext('selection', 'PRD 选区', text);
        }
        if (this.host.agentInput) {
            this.host.agentInput.focus();
        }
    }

    /**
     * Sends the entire PRD document as context to Prota Agent
     */
    askAiAboutWholePrd() {
        const state = this.manager.state;
        if (state.status !== 'ready') return;

        // Use draft content if dirty, otherwise use original content
        const content = state.editMode ? (state.draftContent || '') : (state.content || '');
        if (!content.trim()) return;

        // Open workbench
        this.host.openAgentWorkbench?.();

        // Set context in host
        const docName = this.manager.getPrdDocumentLabel(state.path);
        if (typeof this.host.setAgentPrdContext === 'function') {
            this.host.setAgentPrdContext('whole', docName, content);
        }
        if (this.host.agentInput) {
            this.host.agentInput.focus();
        }
    }

    /**
     * Cleanups and destroys all event listeners
     */
    destroy() {
        if (this._eventCleanup) {
            this._eventCleanup();
            this._eventCleanup = null;
        }
        if (this._boundSelectionChange) {
            document.removeEventListener('selectionchange', this._boundSelectionChange);
        }
        const popover = document.getElementById('prdSelectionAiPopover');
        if (popover) {
            popover.remove();
        }
        this.manager.resetState();
    }
}
