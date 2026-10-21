/**
 * Readify MindMap Decoupled Module - State & Bridge Manager
 *
 * Owns mindmap document state and the `/api/mindmap-diagram` Bridge API.
 * Mirrors the DrawioManager contract so the shell can treat every visual
 * document module uniformly. The document format is a plain Markdown nested
 * list (the native input format of @xiangfa/mindmap), stored as `.mindmap`
 * text files alongside the page docs.
 *
 * Boundary: this file knows nothing about React or the rendering library.
 * Swapping the underlying mindmap service only touches editor.html and never
 * the manager, the controller, or the shell wiring.
 */

export class MindmapManager {
    constructor(host) {
        this.host = host;
        this.state = this.getDefaultState();
        this._loadToken = 0;
        this._saveChain = Promise.resolve();
    }

    getDefaultState() {
        return {
            status: 'idle',
            markdown: '',
            path: '',
            filename: '',
            mindmaps: [],
            error: ''
        };
    }

    createBlankMarkdown(title = '思维导图') {
        const root = String(title || '思维导图').trim() || '思维导图';
        return `${root}\n  - 主题一\n    - 要点 A\n    - 要点 B\n  - 主题二\n    - 要点 C\n`;
    }

    getDefaultPath() {
        const projectId = this.host.activeProjectId || 'readify';
        const pageId = this.host.activePageId || '';
        const version = this.host.activeVersion || 'v1';
        return `/src/pages/${projectId}/${pageId}/docs/mindmaps/${version}.mindmap`;
    }

    normalizeShareMindmaps(share = {}) {
        if (Array.isArray(share.mindmaps) && share.mindmaps.length > 0) {
            return share.mindmaps.map((item) => ({
                path: item.path || '',
                filename: item.filename || String(item.path || '').split('/').pop() || 'mindmap.mindmap',
                label: item.label || item.filename || '思维导图',
                content: item.content || ''
            }));
        }
        if (share.mindmapContent) {
            return [{
                path: share.mindmapPath || '',
                filename: share.mindmapFilename || String(share.mindmapPath || '').split('/').pop() || 'mindmap.mindmap',
                label: share.mindmapFilename || '思维导图',
                content: share.mindmapContent
            }];
        }
        return [];
    }

    async load(preferredPath = '') {
        const token = ++this._loadToken;
        this.state = { ...this.state, status: 'loading', error: '' };
        try {
            const share = this.host.shareConfig || window.__READIFY_SHARE__ || {};
            if (this.host.isShareMode) {
                const mindmaps = this.normalizeShareMindmaps(share);
                const selected = mindmaps.find((item) => item.path === preferredPath)
                    || mindmaps.find((item) => item.path === this.state.path)
                    || mindmaps[0];
                if (token !== this._loadToken) return;
                this.state = selected ? {
                    status: 'ready',
                    markdown: selected.content || this.createBlankMarkdown(),
                    path: selected.path,
                    filename: selected.filename,
                    mindmaps,
                    error: ''
                } : {
                    ...this.getDefaultState(),
                    status: 'empty'
                };
                return;
            }

            const params = new URLSearchParams({
                projectId: this.host.activeProjectId || 'readify',
                pageId: this.host.activePageId || '',
                version: this.host.activeVersion || ''
            });
            const requestedPath = preferredPath || this.state.path;
            if (requestedPath) params.set('path', requestedPath);
            const response = await fetch(`/api/mindmap-diagram?${params.toString()}&t=${Date.now()}`);
            if (!response.ok) throw new Error(await response.text() || '读取思维导图失败');
            const data = await response.json();
            if (token !== this._loadToken) return;
            this.state = {
                status: data.content ? 'ready' : 'empty',
                markdown: data.content || this.createBlankMarkdown(),
                path: data.path || this.getDefaultPath(),
                filename: data.filename || `${this.host.activeVersion || 'v1'}.mindmap`,
                mindmaps: Array.isArray(data.mindmaps) ? data.mindmaps : [],
                error: ''
            };
        } catch (error) {
            if (token !== this._loadToken) return;
            this.state = { ...this.getDefaultState(), status: 'error', error: error.message || String(error) };
        }
    }

    save(markdown) {
        if (this.host.isShareMode) return Promise.resolve();
        this.state = { ...this.state, markdown, status: 'ready' };
        this._saveChain = this._saveChain.then(async () => {
            const response = await fetch('/api/mindmap-diagram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.host.activeProjectId || 'readify',
                    pageId: this.host.activePageId,
                    version: this.host.activeVersion,
                    path: this.state.path || this.getDefaultPath(),
                    content: markdown
                })
            });
            if (!response.ok) throw new Error(await response.text() || '保存思维导图失败');
            const data = await response.json();
            this.state = {
                ...this.state,
                path: data.path || this.state.path,
                filename: data.filename || this.state.filename,
                mindmaps: Array.isArray(data.mindmaps) ? data.mindmaps : this.state.mindmaps
            };
        }).catch((error) => {
            this.host.showToast(`思维导图保存失败：${error.message || error}`, 'error');
        });
        return this._saveChain;
    }

    async createMindmap({ title = '思维导图' } = {}) {
        if (this.host.isShareMode) throw new Error('分享页面不支持新增思维导图');
        const version = this.host.activeVersion || 'v1';
        const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
        const path = `/src/pages/${this.host.activeProjectId || 'readify'}/${this.host.activePageId}/docs/mindmaps/${version}-${stamp}.mindmap`;
        const content = this.createBlankMarkdown(title);
        const response = await fetch('/api/mindmap-diagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: this.host.activeProjectId || 'readify',
                pageId: this.host.activePageId,
                version,
                path,
                content
            })
        });
        if (!response.ok) throw new Error(await response.text() || '新增思维导图失败');
        const data = await response.json();
        this.state = {
            ...this.state,
            mindmaps: Array.isArray(data.mindmaps) ? data.mindmaps : this.state.mindmaps
        };
        return {
            path: data.path || path,
            filename: data.filename || path.split('/').pop(),
            title
        };
    }
}
