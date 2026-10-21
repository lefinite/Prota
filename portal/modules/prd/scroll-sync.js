/**
 * Readify PRD Module - Scroll Synchronizer & Double-Click Locator
 * Manages bi-directional scroll synchronization and double-click source code targeting
 */

export class PRDScrollSync {
    /**
     * @param {PRDManager} manager - The state manager instance
     */
    constructor(manager) {
        this.manager = manager;
        this._isSyncing = false;
        this._syncTarget = null;
        this._activeScrollPane = null;
        this._scrollTimeout = null;
        this._cleanup = null;
        this._sourceLineMapCache = new WeakMap();
        this._sourceMirror = null;
    }

    /**
     * Bind all synchronizing event listeners on editor textarea and preview container
     * @param {HTMLElement} container - The active annotation drawer body container
     */
    bindEvents(container) {
        if (!container) return;

        if (this._cleanup) {
            this._cleanup();
            this._cleanup = null;
        }

        const textarea = container.querySelector('[data-prd-editor]');
        const previewContainer = container.querySelector('.prd-editor-preview');

        if (!textarea) return;

        const activatePane = (pane) => {
            this._activeScrollPane = pane;
            if (this._isSyncing && this._syncTarget === pane) {
                clearTimeout(this._scrollTimeout);
                this._isSyncing = false;
                this._syncTarget = null;
            }
        };
        const activateSource = () => activatePane('source');
        const activatePreview = () => activatePane('preview');
        const interactionEvents = ['wheel', 'pointerdown', 'touchstart', 'keydown'];
        interactionEvents.forEach((eventName) => {
            textarea.addEventListener(eventName, activateSource, { passive: eventName !== 'keydown' });
            previewContainer?.addEventListener(eventName, activatePreview, { passive: eventName !== 'keydown' });
        });

        // 1. Textarea scroll synchronization to Preview
        const handleTextareaScroll = () => {
            if (this._isSyncing) return;

            const currentLayout = this.manager.host.prdEditorLayout || 'source';
            if (currentLayout !== 'split' || !previewContainer) return;

            this.syncFromSource(textarea, previewContainer);
        };

        textarea.addEventListener('scroll', handleTextareaScroll, { passive: true });

        // 2. Preview scroll synchronization back to source
        const handlePreviewScroll = () => {
            if (this._isSyncing) return;
            // DOM replacement, image loading and browser scroll anchoring also
            // emit scroll events. Only user interaction with preview may drive source.
            if (this._activeScrollPane !== 'preview') return;

            const currentLayout = this.manager.host.prdEditorLayout || 'source';
            if (currentLayout !== 'split' || !previewContainer) return;

            this.syncFromPreview(textarea, previewContainer);
        };

        if (previewContainer) {
            previewContainer.addEventListener('scroll', handlePreviewScroll, { passive: true });
        }

        // 3. Double-Click Preview Targeting -> Focus code source line
        const handlePreviewDblClick = (e) => {
            if (!previewContainer) return;
            const elWithLine = e.target.closest('[data-line]');
            let lineNum = -1;
            if (elWithLine && elWithLine.hasAttribute('data-line')) {
                lineNum = parseInt(elWithLine.getAttribute('data-line'), 10);
            }
            const currentLayout = this.manager.host.prdEditorLayout || 'source';
            if (currentLayout === 'preview') {
                if (lineNum === -1 && textarea) {
                    const lines = textarea.value.split('\n');
                    lineNum = Math.max(0, lines.length - 1);
                }
                
                if (lineNum >= 0) {
                    this.manager._pendingScrollToLine = lineNum;
                }

                // Switch back to split view and expand drawer for interactive editing
                this.manager.host.prdEditorLayout = 'split';
                this.manager.host.docDrawerExpanded = true;
                this.manager.host.renderAnnotationDrawer?.();
                this.manager.host.persistPrdEditorLayout?.();
                this.manager.render();
            } else if (lineNum >= 0) {
                // Ensure drawer is expanded to display split layout comfortably
                if (!this.manager.host.docDrawerExpanded) {
                    this.manager.host.docDrawerExpanded = true;
                    this.manager.host.renderAnnotationDrawer?.();
                }
                this.scrollToSourceLine(textarea, lineNum);
            }
        };

        if (previewContainer) {
            previewContainer.addEventListener('dblclick', handlePreviewDblClick);
        }

        this._cleanup = () => {
            clearTimeout(this._scrollTimeout);
            this._isSyncing = false;
            this._syncTarget = null;
            this._activeScrollPane = null;
            textarea.removeEventListener('scroll', handleTextareaScroll);
            previewContainer?.removeEventListener('scroll', handlePreviewScroll);
            previewContainer?.removeEventListener('dblclick', handlePreviewDblClick);
            interactionEvents.forEach((eventName) => {
                textarea.removeEventListener(eventName, activateSource);
                previewContainer?.removeEventListener(eventName, activatePreview);
            });
            this.destroySourceMirror();
        };

        // Handle pending scroll-to-line requests from layout toggles or double-click transition
        if (typeof this.manager._pendingScrollToLine === 'number') {
            const pendingLine = this.manager._pendingScrollToLine;
            this.manager._pendingScrollToLine = null;
            requestAnimationFrame(() => {
                const updatedTextarea = container.querySelector('[data-prd-editor]');
                if (updatedTextarea) {
                    this.scrollToSourceLine(updatedTextarea, pendingLine);
                }
            });
        }
    }

    getLineHeight(textarea) {
        if (!textarea) return 20;
        const computed = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(computed.lineHeight);
        if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
        const fontSize = parseFloat(computed.fontSize) || 13;
        return fontSize * 1.72;
    }

    getSourceMetrics(textarea) {
        const lineHeight = this.getLineHeight(textarea);
        const sourceScrollable = Math.max(0, (textarea?.scrollHeight || 0) - (textarea?.clientHeight || 0));
        const value = typeof textarea?.value === 'string' ? textarea.value : '';
        const lineCount = Math.max(1, value.replace(/\r\n?/g, '\n').split('\n').length);
        const maxTopLine = lineHeight > 0 ? sourceScrollable / lineHeight : 0;
        return {
            lineHeight,
            sourceScrollable,
            lineCount,
            maxTopLine
        };
    }

    getSourceTopLine(textarea) {
        if (!textarea) return 0;
        const { lineHeight } = this.getSourceMetrics(textarea);
        return lineHeight > 0 ? Math.max(0, textarea.scrollTop / lineHeight) : 0;
    }

    destroySourceMirror() {
        this._sourceMirror?.remove?.();
        this._sourceMirror = null;
    }

    getSourceLineMap(textarea) {
        const metrics = this.getSourceMetrics(textarea);
        if (!textarea || typeof document === 'undefined' || !document.body) {
            return Array.from({ length: metrics.lineCount }, (_, line) => ({
                line,
                top: line * metrics.lineHeight,
                center: (line + 0.5) * metrics.lineHeight,
                bottom: (line + 1) * metrics.lineHeight
            }));
        }

        const computed = window.getComputedStyle(textarea);
        const signature = [
            textarea.value,
            textarea.clientWidth,
            computed.fontFamily,
            computed.fontSize,
            computed.fontWeight,
            computed.fontStyle,
            computed.letterSpacing,
            computed.lineHeight,
            computed.paddingTop,
            computed.paddingRight,
            computed.paddingBottom,
            computed.paddingLeft,
            computed.tabSize,
            computed.whiteSpace,
            computed.overflowWrap,
            computed.wordBreak
        ].join('\u0000');
        const cached = this._sourceLineMapCache.get(textarea);
        if (cached?.signature === signature) return cached.anchors;

        this.destroySourceMirror();
        const mirror = document.createElement('div');
        mirror.setAttribute('aria-hidden', 'true');
        Object.assign(mirror.style, {
            position: 'fixed',
            top: '0',
            left: '-100000px',
            width: `${textarea.clientWidth}px`,
            boxSizing: 'border-box',
            visibility: 'hidden',
            pointerEvents: 'none',
            overflow: 'hidden',
            border: '0',
            margin: '0',
            padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
            fontFamily: computed.fontFamily,
            fontSize: computed.fontSize,
            fontWeight: computed.fontWeight,
            fontStyle: computed.fontStyle,
            letterSpacing: computed.letterSpacing,
            lineHeight: computed.lineHeight,
            tabSize: computed.tabSize,
            whiteSpace: textarea.wrap === 'off' ? 'pre' : 'pre-wrap',
            overflowWrap: computed.overflowWrap || 'break-word',
            wordBreak: computed.wordBreak || 'normal'
        });

        textarea.value.replace(/\r\n?/g, '\n').split('\n').forEach((line) => {
            const row = document.createElement('div');
            row.style.minHeight = computed.lineHeight;
            row.textContent = line || '\u200b';
            mirror.appendChild(row);
        });
        document.body.appendChild(mirror);
        this._sourceMirror = mirror;

        const anchors = Array.from(mirror.children, (row, line) => ({
            line,
            top: row.offsetTop,
            center: row.offsetTop + row.offsetHeight / 2,
            bottom: row.offsetTop + row.offsetHeight
        }));
        this._sourceLineMapCache.set(textarea, { signature, anchors });
        return anchors;
    }

    getSourceCenterForLine(textarea, line) {
        const anchors = this.getSourceLineMap(textarea);
        return this.interpolate(anchors, line, 'line', 'center');
    }

    getSourceLineBounds(textarea, line) {
        const anchors = this.getSourceLineMap(textarea);
        if (!anchors.length) return { top: 0, bottom: 0 };
        const index = this.clamp(Math.floor(line), 0, anchors.length - 1);
        const anchor = anchors[index];
        return {
            top: Number.isFinite(anchor.top) ? anchor.top : anchor.center,
            bottom: Number.isFinite(anchor.bottom) ? anchor.bottom : anchor.center
        };
    }

    getSourceCenterLine(textarea) {
        if (!textarea) return 0;
        const { lineCount } = this.getSourceMetrics(textarea);
        const anchors = this.getSourceLineMap(textarea);
        const center = textarea.scrollTop + textarea.clientHeight / 2;
        return this.clamp(
            this.interpolate(anchors, center, 'center', 'line'),
            0,
            Math.max(0, lineCount - 1)
        );
    }

    getElementTopInScroller(scroller, element) {
        if (!scroller || !element) return 0;
        const scrollerRect = scroller.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        return elementRect.top - scrollerRect.top + scroller.scrollTop;
    }

    getElementCenterInScroller(scroller, element) {
        if (!scroller || !element) return 0;
        const elementRect = element.getBoundingClientRect();
        return this.getElementTopInScroller(scroller, element) + elementRect.height / 2;
    }

    clamp(value, min, max) {
        if (!Number.isFinite(value)) return min;
        return Math.min(Math.max(value, min), max);
    }

    normalizeAnchors(anchors, primaryKey, secondaryKey) {
        const normalized = [];
        const sorted = anchors
            .filter((anchor) => Number.isFinite(anchor?.[primaryKey]) && Number.isFinite(anchor?.[secondaryKey]))
            .sort((a, b) => {
                const primaryDiff = a[primaryKey] - b[primaryKey];
                return primaryDiff !== 0 ? primaryDiff : a[secondaryKey] - b[secondaryKey];
            });

        sorted.forEach((anchor) => {
            const previous = normalized[normalized.length - 1];
            if (!previous) {
                normalized.push({ ...anchor });
                return;
            }

            if (Math.abs(anchor[primaryKey] - previous[primaryKey]) < 0.001) {
                previous[secondaryKey] = Math.min(previous[secondaryKey], anchor[secondaryKey]);
                return;
            }

            normalized.push({
                ...anchor,
                [secondaryKey]: Math.max(anchor[secondaryKey], previous[secondaryKey])
            });
        });

        return normalized;
    }

    buildScrollMap(textarea, previewContainer, options = {}) {
        const metrics = this.getSourceMetrics(textarea);
        const previewScrollable = Math.max(0, (previewContainer?.scrollHeight || 0) - (previewContainer?.clientHeight || 0));
        const limitToSourceScroll = options.limitToSourceScroll !== false;
        const sourceMaxLine = limitToSourceScroll
            ? metrics.maxTopLine
            : Math.max(0, metrics.lineCount - 1);

        const anchors = [{ line: 0, top: 0 }];
        const anchorsByLine = new Map();
        previewContainer?.querySelectorAll('[data-line]').forEach((element) => {
            const line = parseInt(element.getAttribute('data-line'), 10);
            if (!Number.isFinite(line) || line < 0) return;

            const top = this.clamp(this.getElementTopInScroller(previewContainer, element), 0, previewScrollable);
            const existing = anchorsByLine.get(line);
            if (!existing || top < existing.top) {
                anchorsByLine.set(line, { line, top });
            }
        });

        anchorsByLine.forEach((anchor) => {
            if (anchor.line <= sourceMaxLine && anchor.top <= previewScrollable) {
                anchors.push(anchor);
            }
        });

        anchors.push({
            line: Math.max(0, sourceMaxLine),
            top: previewScrollable
        });

        return {
            byLine: this.normalizeAnchors(anchors, 'line', 'top'),
            byTop: this.normalizeAnchors(anchors, 'top', 'line'),
            metrics,
            previewScrollable,
            sourceMaxLine: Math.max(0, sourceMaxLine)
        };
    }

    buildCenterMap(textarea, previewContainer) {
        const metrics = this.getSourceMetrics(textarea);
        const previewHeight = Math.max(0, previewContainer?.scrollHeight || 0);
        const anchorsByLine = new Map();

        previewContainer?.querySelectorAll('[data-line]').forEach((element) => {
            const line = parseInt(element.getAttribute('data-line'), 10);
            if (!Number.isFinite(line) || line < 0) return;

            const center = this.clamp(
                this.getElementCenterInScroller(previewContainer, element),
                0,
                previewHeight
            );
            const existing = anchorsByLine.get(line);
            if (!existing || center < existing.center) {
                anchorsByLine.set(line, { line, center });
            }
        });

        const anchors = Array.from(anchorsByLine.values());
        if (!anchors.length) {
            anchors.push(
                { line: 0, center: 0 },
                { line: Math.max(0, metrics.lineCount - 1), center: previewHeight }
            );
        }

        return {
            byLine: this.normalizeAnchors(anchors, 'line', 'center'),
            byCenter: this.normalizeAnchors(anchors, 'center', 'line'),
            metrics,
            previewHeight
        };
    }

    interpolate(anchors, value, primaryKey, secondaryKey) {
        if (!anchors.length) return 0;
        if (value <= anchors[0][primaryKey]) return anchors[0][secondaryKey];

        for (let i = 1; i < anchors.length; i += 1) {
            const previous = anchors[i - 1];
            const current = anchors[i];
            if (value <= current[primaryKey]) {
                const span = current[primaryKey] - previous[primaryKey];
                if (Math.abs(span) < 0.001) return current[secondaryKey];
                const ratio = (value - previous[primaryKey]) / span;
                return previous[secondaryKey] + ratio * (current[secondaryKey] - previous[secondaryKey]);
            }
        }

        return anchors[anchors.length - 1][secondaryKey];
    }

    getPreviewTopForSourceLine(textarea, previewContainer, line, options = {}) {
        const map = this.buildScrollMap(textarea, previewContainer, options);
        if (map.previewScrollable <= 0) return 0;
        if (line <= 0) return 0;
        if (line >= map.sourceMaxLine - 0.1) {
            return map.previewScrollable;
        }
        return this.clamp(this.interpolate(map.byLine, line, 'line', 'top'), 0, map.previewScrollable);
    }

    getPreviewTopLine(textarea, previewContainer, options = {}) {
        const map = this.buildScrollMap(textarea, previewContainer, options);
        if (map.previewScrollable <= 0 || previewContainer.scrollTop <= 2) return 0;
        if (previewContainer.scrollTop >= map.previewScrollable - 2) return map.sourceMaxLine;
        return this.clamp(this.interpolate(map.byTop, previewContainer.scrollTop, 'top', 'line'), 0, map.sourceMaxLine);
    }

    getPreviewCenterForSourceLine(textarea, previewContainer, line) {
        const map = this.buildCenterMap(textarea, previewContainer);
        return this.clamp(
            this.interpolate(map.byLine, line, 'line', 'center'),
            0,
            map.previewHeight
        );
    }

    getPreviewCenterLine(textarea, previewContainer) {
        const map = this.buildCenterMap(textarea, previewContainer);
        const viewportCenter = previewContainer.scrollTop + previewContainer.clientHeight / 2;
        return this.clamp(
            this.interpolate(map.byCenter, viewportCenter, 'center', 'line'),
            0,
            Math.max(0, map.metrics.lineCount - 1)
        );
    }

    withSyncLock(targetPane, fn) {
        this._isSyncing = true;
        this._syncTarget = targetPane;
        try {
            fn();
        } catch (err) {
            console.warn('Scroll sync failed:', err);
        }

        clearTimeout(this._scrollTimeout);
        this._scrollTimeout = setTimeout(() => {
            this._isSyncing = false;
            this._syncTarget = null;
        }, 80);
    }

    syncFromSource(textarea, previewContainer) {
        if (!textarea || !previewContainer) return;

        this.withSyncLock('preview', () => {
            const { sourceScrollable } = this.getSourceMetrics(textarea);
            const previewScrollable = Math.max(0, previewContainer.scrollHeight - previewContainer.clientHeight);
            if (sourceScrollable <= 0 || textarea.scrollTop <= 2) {
                previewContainer.scrollTop = 0;
                return;
            }
            if (textarea.scrollTop >= sourceScrollable - 2) {
                previewContainer.scrollTop = previewScrollable;
                return;
            }

            const sourceLine = this.getSourceCenterLine(textarea);
            const targetCenter = this.getPreviewCenterForSourceLine(textarea, previewContainer, sourceLine);
            previewContainer.scrollTop = this.clamp(
                targetCenter - previewContainer.clientHeight / 2,
                0,
                previewScrollable
            );
        });
    }

    refreshPreview(textarea, previewContainer, render) {
        // Lock before changing the DOM: rebuilding a shorter preview can clamp
        // its scroll offset before the next animation frame runs.
        this._activeScrollPane = 'source';
        this.withSyncLock('preview', () => {
            render();
            if ((this.manager.host.prdEditorLayout || 'source') === 'split') {
                this.syncFromSource(textarea, previewContainer);
            }
        });
    }

    syncFromPreview(textarea, previewContainer) {
        if (!textarea || !previewContainer) return;

        this.withSyncLock('source', () => {
            const { sourceScrollable } = this.getSourceMetrics(textarea);
            const previewScrollable = Math.max(0, previewContainer.scrollHeight - previewContainer.clientHeight);
            if (previewScrollable <= 0 || previewContainer.scrollTop <= 2) {
                textarea.scrollTop = 0;
                return;
            }
            if (previewContainer.scrollTop >= previewScrollable - 2) {
                textarea.scrollTop = sourceScrollable;
                return;
            }

            const sourceLine = this.getPreviewCenterLine(textarea, previewContainer);
            textarea.scrollTop = this.clamp(
                this.getSourceCenterForLine(textarea, sourceLine) - textarea.clientHeight / 2,
                0,
                sourceScrollable
            );
        });
    }

    scrollSourceToLine(textarea, lineIndex, options = {}) {
        if (!textarea || lineIndex < 0) return;

        const { sourceScrollable } = this.getSourceMetrics(textarea);
        const block = options.block || 'start';
        let offset = 0;
        if (block === 'center') {
            offset = textarea.clientHeight / 2;
        } else if (block === 'third') {
            offset = textarea.clientHeight / 3;
        }

        textarea.scrollTo({
            top: this.clamp(this.getSourceCenterForLine(textarea, lineIndex) - offset, 0, sourceScrollable),
            behavior: options.behavior || 'auto'
        });
    }

    scrollPreviewToLine(container, lineIndex, options = {}) {
        if (lineIndex < 0 || !container) return;

        requestAnimationFrame(() => {
            const previewWrap = container.querySelector('.prd-editor-preview') || container;
            if (!previewWrap) return;

            const textarea = container.querySelector('[data-prd-editor]');
            const previewScrollable = Math.max(0, previewWrap.scrollHeight - previewWrap.clientHeight);
            let targetTop = 0;

            if (textarea) {
                targetTop = this.getPreviewCenterForSourceLine(textarea, previewWrap, lineIndex);
            } else {
                let target = null;
                for (let i = Math.floor(lineIndex); i >= 0; i -= 1) {
                    target = previewWrap.querySelector(`[data-line="${i}"]`);
                    if (target) break;
                }
                if (target) {
                    targetTop = this.getElementTopInScroller(previewWrap, target);
                }
            }

            const block = options.block || 'start';
            if (block === 'center') {
                targetTop -= previewWrap.clientHeight / 2;
            }

            previewWrap.scrollTo({
                top: this.clamp(targetTop, 0, previewScrollable),
                behavior: options.behavior || 'auto'
            });
        });
    }

    /**
     * Captures the physical line index of the active cursor in the editor textarea
     */
    captureActiveLine(textarea) {
        if (!textarea) return -1;
        const cursorIndex = textarea.selectionStart;
        if (typeof cursorIndex === 'number') {
            return textarea.value.substring(0, cursorIndex).split('\n').length - 1;
        }
        return -1;
    }

    /**
     * Scrolls the Preview container smoothly to a specific parsed line
     */
    scrollToPreviewLine(container, lineIndex) {
        this.scrollPreviewToLine(container, lineIndex, { behavior: 'auto', block: 'center' });
    }

    /**
     * Focuses, selects, and scrolls editor textarea to target raw line
     */
    scrollToSourceLine(textarea, lineIndex) {
        if (!textarea || lineIndex < 0) return;

        const content = textarea.value;
        const lines = content.split('\n');
        if (lineIndex >= lines.length) return;

        const charIndex = lines.slice(0, lineIndex).join('\n').length + (lineIndex > 0 ? 1 : 0);
        const lineLength = lines[lineIndex].length;
        const { sourceScrollable } = this.getSourceMetrics(textarea);
        const bounds = this.getSourceLineBounds(textarea, lineIndex);
        const originalTop = textarea.scrollTop;
        const visibilityPadding = Math.min(24, textarea.clientHeight * 0.1);
        const visibleTop = originalTop + visibilityPadding;
        const visibleBottom = originalTop + textarea.clientHeight - visibilityPadding;
        let targetTop = originalTop;

        if (bounds.bottom <= visibleTop) {
            targetTop = bounds.bottom - visibilityPadding;
        } else if (bounds.top >= visibleBottom) {
            targetTop = bounds.top - textarea.clientHeight + visibilityPadding;
        }
        targetTop = this.clamp(targetTop, 0, sourceScrollable);

        // Selecting text can make the browser scroll the textarea automatically.
        // Keep that programmatic movement isolated so the preview pane remains fixed.
        this.withSyncLock('source', () => {
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(charIndex, charIndex + lineLength);
            textarea.scrollTo({
                top: targetTop,
                behavior: 'auto'
            });
        });
    }
}
