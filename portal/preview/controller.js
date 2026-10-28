import { PreviewState, scopeKey } from './state.js';
import { prepareFrame, replaceStyles } from './transition.js';

export class PreviewController {
    constructor(shell) { this.shell = shell; this.state = new PreviewState(); this.token = 0; }
    current() { const s = this.shell; return { projectId: s.activeProjectId, pageId: s.activePageId, version: s.activeVersion }; }
    start(event) {
        this.token++; this.state.start(event.runId); this.origin = scopeKey(this.current());
        this.context = event.payload.context || {}; this.latest = this.pending = this.shown = null;
        clearTimeout(this.retry); this.showStatus('原型生成中');
    }
    navigate() {
        if (this.state.runId) { this.token++; this.state.detached = true; this.pending = null; clearTimeout(this.retry); this.badge?.remove(); }
    }
    showStatus(text) {
        if (!this.badge?.isConnected) {
            this.badge = document.createElement('div'); this.badge.className = 'prota-preview-status';
            Object.assign(this.badge.style, { position: 'absolute', right: '16px', bottom: '16px', zIndex: '30', padding: '7px 11px', borderRadius: '8px', background: 'rgba(255,255,255,.94)', color: '#555', fontSize: '12px', pointerEvents: 'none', boxShadow: '0 1px 8px #0001' });
            this.badge.setAttribute('role', 'status'); this.shell.mainIframe?.parentElement?.append(this.badge);
        }
        this.badge.textContent = text;
    }
    receive(event) {
        if (!this.state.accepts(event) || scopeKey(this.current()) !== this.origin) return;
        if (event.scope.projectId !== this.current().projectId) return;
        if (this.context.pageId && this.context.pageId !== '__global__' && event.scope.pageId !== this.context.pageId) return;
        if (this.latest && event.revision <= this.latest.revision) return;
        this.latest = this.pending = event; this.drain();
    }
    async swap(url, token, scope = this.latest?.scope || this.current()) {
        const s = this.shell;
        return prepareFrame(s.mainIframe, url, {
            valid: () => token === this.token && !this.state.detached && scopeKey(this.current()) === this.origin,
            commit: frame => {
                s.mainIframe = frame; s.bindPreviewFrameEvents(frame);
                const page = s.getProjectRecord(scope.projectId)?.pages?.find(p => p.id === scope.pageId);
                const temporary = scopeKey(scope) !== scopeKey(this.current());
                const manual = ['mobile', 'web', 'canvas'].includes(s.newPageTargetDevice) ? s.newPageTargetDevice : null;
                const presentation = page || (temporary ? { targetDevice: manual || (frame.contentDocument?.querySelector('.demo-stage > .phone-shell') ? 'mobile' : 'web') } : null);
                s.handleIframeLoad({ presentation });
            }
        });
    }
    async drain() {
        if (this.busy || !this.pending || this.state.detached) return;
        this.busy = true; const event = this.pending, token = this.token; this.pending = null; this.state.status = 'updating';
        let ok = false;
        try {
            const s = this.shell, editor = s.mainIframe?.contentWindow?.protaCanvas;
            if (editor && scopeKey(event.scope) === scopeKey(this.current()) && new URL(s.mainIframe.src).pathname.startsWith('/src/pages/')) {
                if (editor.isDirty() || !editor.refreshBoards) ok = false;
                else {
                    ok = !event.changes.layout || await editor.reloadFromDisk(false, { previewSync: true, snapshotUrl: event.snapshotUrl });
                    if (ok) ok = await editor.refreshBoards(event.changes.boardIds, { snapshotUrl: event.snapshotUrl });
                }
            } else if (event.changes.css && !event.changes.html && !event.changes.javascript && !event.changes.assets && this.shown && scopeKey(event.scope) === scopeKey(this.shown.scope)) {
                ok = await replaceStyles(s.mainIframe, event.snapshotUrl, () => token === this.token);
                if (!ok) ok = await this.swap(event.snapshotUrl, token);
            } else ok = await this.swap(event.snapshotUrl, token);
            if (ok && token === this.token) {
                this.state.revision = event.revision; this.shown = event; this.state.status = 'previewing';
                this.showStatus(`原型生成中 · 预览已自动更新 · Revision ${event.revision}`);
            }
        } catch (error) { console.debug('[preview]', error); }
        finally {
            this.busy = false;
            if (!ok && token === this.token && !this.state.detached) {
                this.pending ||= event;
                this.retry = setTimeout(() => this.drain(), 1000);
            } else if (this.pending && !['completed', 'failed'].includes(this.state.status)) this.drain();
        }
    }
    async disable() {
        const token = ++this.token; this.pending = null; clearTimeout(this.retry);
        this.state.runId = null; this.state.status = 'idle';
        if (!this.state.detached) {
            const scope = this.current(), editor = this.shell.mainIframe?.contentWindow?.protaCanvas;
            if (editor && new URL(this.shell.mainIframe.src).pathname.startsWith('/src/pages/')) {
                if (await editor.reloadFromDisk(false, { previewSync: true })) await editor.refreshBoards?.(null);
            } else if (scope.pageId && scope.version) {
                await this.swap(`/src/pages/${scope.projectId}/${scope.pageId}/${scope.version}/index.html?t=${Date.now()}`, token, scope);
            }
        }
        if (token === this.token) { this.state.detached = true; this.badge?.remove(); }
    }

    async finish(failed = false) {
        if (!this.state.runId || this.state.detached) return;
        const token = ++this.token; this.pending = null; clearTimeout(this.retry);
        this.state.status = failed ? 'failed' : 'completed';
        if (failed) { this.showStatus('生成已停止 · 保留最后有效预览'); return; }
        await this.shell.refreshProjectsAfterAgentRun({ preservePreview: Boolean(this.shown) });
        if (token !== this.token || this.state.detached) return;
        const scope = this.shown?.scope || this.current();
        const editor = this.shell.mainIframe?.contentWindow?.protaCanvas;
        if (editor && scopeKey(scope) === scopeKey(this.current()) && new URL(this.shell.mainIframe.src).pathname.startsWith('/src/pages/')) {
            const ok = await editor.reloadFromDisk(false, { previewSync: true });
            if (!ok && !editor.refreshBoards && !editor.isDirty()) {
                await this.swap(`/src/pages/${scope.projectId}/${scope.pageId}/${scope.version}/index.html?t=${Date.now()}`, token, scope);
                this.badge?.remove(); return;
            }
            if (!ok) {
                this.showStatus('生成已完成 · 本机草稿已保留，等待同步');
                this.retry = setTimeout(() => { if (token === this.token && !this.state.detached) this.finish(false); }, 1000);
                return;
            }
            await editor.refreshBoards?.(null);
        } else {
            const url = `/src/pages/${scope.projectId}/${scope.pageId}/${scope.version}/index.html?t=${Date.now()}`;
            if (!(await this.swap(url, token, scope))) { this.showStatus('生成已完成 · 保留最后有效预览'); return; }
        }
        // Registration belongs to the normal catalog flow, only after a valid final page.
        if (this.shown && scopeKey(scope) !== scopeKey(this.current())) {
            const page = this.shell.getProjectRecord(scope.projectId)?.pages?.find(p => p.id === scope.pageId);
            if (page?.versions?.includes(scope.version)) {
                this.shell.activePageId = scope.pageId; this.shell.activeVersion = scope.version;
                this.shell.renderSidebar(); this.shell.renderVersionPanel(page); this.shell.writeShellNavigationState();
                if (this.shell.currentPageNameEl) this.shell.currentPageNameEl.textContent = page.name;
                this.shell.updateAgentContextLabel();
                await this.shell.handleIframeLoad();
                if (this.shell.agentSessionId) await this.shell.bindAgentSessionToPage(scope.pageId, scope.version);
            }
        }
        this.badge?.remove();
    }
}
