/**
 * Readify PRD Module - State & Network Manager
 * Manages the asynchronous lifecycle, loading, and saving of PRD markdown files
 */

export class PRDManager extends EventTarget {
    /**
     * @param {Object} host - The main DemoShell framework instance
     */
    constructor(host) {
        super();
        this.host = host;
        this._prdLoadToken = 0;
        this.state = this.getDefaultState();
    }

    /**
     * Returns the default PRD document state schema
     */
    getDefaultState() {
        return {
            status: 'idle', // 'idle' | 'loading' | 'ready' | 'empty' | 'error'
            path: '',
            content: '',
            draftContent: '',
            editMode: false,
            dirty: false,
            saving: false,
            saveError: '',
            documents: [], // Array of discovered PRD documents: { path, filename, label, updatedAt, ... }
            error: '',
            savedAt: null
        };
    }

    /**
     * Reset manager to clean initial state
     */
    resetState() {
        this._prdLoadToken += 1;
        this.updateState(this.getDefaultState());
    }

    /**
     * Perform updates on the state tree and dispatch state-changed event
     */
    updateState(patch) {
        const prevState = { ...this.state };
        this.state = {
            ...this.state,
            ...patch
        };

        if (patch.hasOwnProperty('editMode') && patch.status !== 'idle' && prevState.status !== 'idle') {
            const pageId = this.host.activePageId || '';
            const prdPath = this.state.path || '';
            if (pageId && prdPath) {
                this.setLocalStorageItem(`readify:prd-edit-mode:${pageId}:${prdPath}`, this.state.editMode ? 'true' : 'false');
            }
        }

        // Reading history belongs to the page, shared across prototype versions.
        if (patch.path && patch.status && patch.status !== 'loading' && patch.status !== 'idle') {
            const pageId = this.host.activePageId || '';
            if (pageId && patch.path) {
                this.setLocalStorageItem(this.getLastDocumentKey(), patch.path);
                this.persistActiveDocumentContext(patch.path);
            }
        }

        // Notify subscribers of the state transition
        this.dispatchEvent(new CustomEvent('prd-state-change', {
            detail: {
                state: this.state,
                prevState
            }
        }));
    }

    getLastDocumentKey() {
        return `readify:prd-last-doc:${this.host.activeProjectId || 'readify'}:${this.host.activePageId}`;
    }

    isReadOnly() {
        return Boolean(this.host.isShareMode || window.__READIFY_SHARE__ || window.location.pathname.includes('/shares/'));
    }

    async bindDocument(path, prototypeVersion) {
        if (this.isReadOnly() || this._bindingPending) return false;
        this._bindingPending = true;
        const token = this._prdLoadToken;
        try {
            const response = await fetch('/api/prd-doc/binding', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: this.host.activeProjectId, pageId: this.host.activePageId,
                    version: this.host.activeVersion, path, prototypeVersion })
            });
            const text = await response.text();
            let result;
            try { result = JSON.parse(text); } catch {
                throw new Error('文档关联服务尚未就绪，请重新打开 Prota 后重试。');
            }
            if (!response.ok) throw new Error(result.error || '关联未保存，请重试。');
            if (token === this._prdLoadToken) this.updateState({ documents: this.sortPrdDocuments(result.documents || []) });
            return token === this._prdLoadToken;
        } catch (error) {
            this.host.showToast?.(error instanceof TypeError ? '未能连接本地服务，请重新打开 Prota 后重试。' : error.message || '关联未保存，请重试。', true);
            return false;
        } finally {
            this._bindingPending = false;
        }
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
            // PRD preference storage is best-effort; quota errors must not block document loading.
        }
    }

    persistActiveDocumentContext(path) {
        if (!path || this.host.isShareMode) return;
        fetch('/api/prd-active-context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: this.host.activeProjectId || 'readify',
                pageId: this.host.activePageId,
                version: this.host.activeVersion,
                path
            })
        }).catch(() => {
            // Context persistence is best-effort and must not block document work.
        });
    }

    /**
     * Utility: Checks if document is currently in edit mode and has unsaved changes
     */
    isDirty() {
        return this.state.editMode && this.state.dirty;
    }

    /**
     * Utility: Resolves the filename from a given path
     */
    getPrdFileName(path = '') {
        const rawName = String(path || '').split('/').pop() || '';
        try {
            return decodeURIComponent(rawName);
        } catch {
            return rawName;
        }
    }

    /**
     * Helper: Validates if a filename is a markdown document
     */
    isPrdFilename(filename = '') {
        const lowered = String(filename || '').trim().toLowerCase();
        return lowered.endsWith('.md');
    }

    /**
     * Helper: Computes a clean human-readable label for a file path
     */
    getPrdDocumentLabel(path = '') {
        return this.getPrdFileName(path) || 'product-doc.md';
    }

    /**
     * Helper: Resolve standard absolute web URL for local/offline protocols
     */
    getPrdDocumentUrl(path = this.state.path) {
        if (!path) return '';
        if (window.location.protocol === 'file:') {
            return path;
        }
        const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
        return `${window.location.origin}/${normalizedPath}`;
    }

    getPrdRelativePath() {
        return null;
    }

    getPageVersionDirectoryPath(pageId = this.host.activePageId, version = this.host.activeVersion) {
        if (!pageId || !version) return '';
        return `/src/pages/${this.host.activeProjectId || 'readify'}/${pageId}/${version}`;
    }

    /**
     * Asynchronously discovers all Markdown PRD files across the active page
     */
    async discoverPrdDocuments({ preferredPath = '' } = {}) {
        const pageDir = this.getPageVersionDirectoryPath();
        if (!pageDir) return [];

        const isShareMode = this.host.isShareMode || window.__READIFY_SHARE__ || window.location.pathname.includes('/shares/');
        if (isShareMode) {
            const shareConfig = this.host.shareConfig || window.__READIFY_SHARE__ || {};
            // Shared readers get exactly the published selection, without local
            // discovery or access to the editor's complete document library.
            if (!shareConfig.prdPath) return [];
            const doc = (shareConfig.documents || []).find(doc => doc.path === shareConfig.prdPath) || {};
            return [{
                    ...doc,
                    path: shareConfig.prdPath,
                    filename: doc.filename || this.getPrdFileName(shareConfig.prdPath),
                    label: doc.label || this.getPrdDocumentLabel(shareConfig.prdPath),
                    updatedAt: doc.updatedAt || doc.lastModified || '',
                    updatedAtMs: doc.updatedAtMs ?? doc.mtimeMs ?? null,
                    size: doc.size ?? null
            }];
        }

        let documents = [];
        let discoveredByApi = false;
        this._serverLastOpenedPath = '';
        const activePageId = this.host.activePageId;
        const activeVersion = this.host.activeVersion;

        // 1. Try querying the Bridge server API
        try {
            const apiUrl = `/api/prd-docs?projectId=${encodeURIComponent(this.host.activeProjectId || 'readify')}&pageId=${encodeURIComponent(activePageId)}&version=${encodeURIComponent(activeVersion)}&t=${Date.now()}`;
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();
                discoveredByApi = true;
                this._serverLastOpenedPath = data.lastOpenedPath || '';
                documents = Array.isArray(data.documents)
                    ? data.documents
                        .filter((doc) => doc?.path && this.isPrdFilename(doc.filename || this.getPrdFileName(doc.path), doc.path.includes('/docs/')))
                        .map((doc) => ({
                            ...doc,
                            path: doc.path,
                            filename: doc.filename || this.getPrdFileName(doc.path),
                            label: doc.label || this.getPrdDocumentLabel(doc.path),
                            updatedAt: doc.updatedAt || doc.lastModified || '',
                            updatedAtMs: doc.updatedAtMs ?? doc.mtimeMs ?? null,
                            size: doc.size ?? null
                        }))
                    : [];
            }
        } catch {
            documents = [];
        }

        // 2. Local Fallback directory scanning via HTML dir indexes (offline support)
        try {
            if (documents.length === 0) {
                const scanDirs = [
                    `/src/pages/${this.host.activeProjectId || 'readify'}/${activePageId}/docs`,
                    ...(this.host.getPageRecord?.()?.versions || [activeVersion]).map(version =>
                        `/src/pages/${this.host.activeProjectId || 'readify'}/${activePageId}/${version}`)
                ];
                
                for (const dir of scanDirs) {
                    try {
                        const response = await fetch(`${dir}/?t=${Date.now()}`);
                        if (!response.ok) continue;
                        
                        const html = await response.text();
                        const regex = /href="([^"?#]+\.md)(?:[?#][^"]*)?"/gi;
                        let match;
                        while ((match = regex.exec(html)) !== null) {
                            const filename = this.getPrdFileName(match[1]);
                            if (!this.isPrdFilename(filename, dir.includes('/docs/'))) continue;
                            
                            const fullPath = `${dir}/${filename}`;
                            if (documents.some(d => d.path === fullPath)) continue;

                            documents.push({
                                prototypeVersion: /\/(v\d+)$/.exec(dir)?.[1] || null,
                                path: fullPath,
                                filename,
                                label: this.getPrdDocumentLabel(filename)
                            });
                        }
                    } catch (e) {
                        console.warn(`Fallback directory scan failed for ${dir}:`, e);
                    }
                }
            }
        } catch {
            documents = documents || [];
        }

        // 3. Fallback: If in share mode and we have pre-loaded PRD content, and we haven't found any documents via API/directories
        if (documents.length === 0 && this.host.isShareMode && this.host.shareConfig.prdContent !== null) {
            const prdPath = this.host.shareConfig.prdPath || `/src/pages/${this.host.activeProjectId || 'readify'}/${activePageId}/docs/product-doc.md`;
            const filename = this.host.shareConfig.prdFilename || this.getPrdFileName(prdPath);
            documents.push({
                path: prdPath,
                filename,
                label: this.getPrdDocumentLabel(prdPath),
                updatedAt: '',
                updatedAtMs: null,
                size: null
            });
        }

        // 4. Ensure preferred path is listed
        if (!discoveredByApi && preferredPath && !documents.some(d => d.path === preferredPath)) {
            const filename = this.getPrdFileName(preferredPath);
            if (this.isPrdFilename(filename)) {
                documents.push({
                    path: preferredPath,
                    filename,
                    label: this.getPrdDocumentLabel(filename)
                });
            }
        }


        // Enrich and sort
        documents = await this.enrichPrdDocumentMetadata(documents);
        return this.sortPrdDocuments(this.getUniquePrdDocuments(documents));
    }

    getUniquePrdDocuments(documents = []) {
        const seen = new Set();
        return documents.filter((doc) => {
            if (!doc?.path || seen.has(doc.path)) return false;
            seen.add(doc.path);
            return true;
        });
    }

    sortPrdDocuments(documents = []) {
        return [...documents].sort((left, right) => {
            const leftName = left.filename || this.getPrdFileName(left.path);
            const rightName = right.filename || this.getPrdFileName(right.path);
            const leftTime = this.getPrdDocumentUpdatedTime(left);
            const rightTime = this.getPrdDocumentUpdatedTime(right);
            if (leftTime !== rightTime) return rightTime - leftTime;
            return leftName.localeCompare(rightName, 'zh-CN', { numeric: true });
        });
    }

    getPrdDocumentUpdatedTime(doc = {}) {
        const numeric = Number(doc.updatedAtMs ?? doc.updatedAt ?? doc.mtimeMs ?? doc.mtime);
        if (Number.isFinite(numeric) && numeric > 0) {
            return numeric < 100000000000 ? numeric * 1000 : numeric;
        }
        const parsed = Date.parse(doc.updatedAt || doc.modifiedAt || doc.lastModified || '');
        return Number.isFinite(parsed) ? parsed : 0;
    }

    async enrichPrdDocumentMetadata(documents = []) {
        const pending = documents
            .filter((doc) => doc?.path && !this.getPrdDocumentUpdatedTime(doc))
            .map(async (doc) => {
                try {
                    const response = await fetch(`${doc.path.startsWith('/') ? '' : '/'}${doc.path}?t=${Date.now()}`, { method: 'HEAD' });
                    const lastModified = response.headers.get('last-modified') || '';
                    if (lastModified) {
                        doc.updatedAt = lastModified;
                        doc.updatedAtMs = Date.parse(lastModified);
                    }
                } catch {
                    // Head request failed, falls back silently
                }
            });

        if (pending.length) {
            await Promise.all(pending);
        }
        return documents;
    }

    /**
     * Main async method to fetch and load PRD content
     */
    async loadDocument({ force = false, path = '' } = {}) {
        const requestedPath = path || this.state.path || '';
        const activePrdPath = requestedPath || this.state.path || '';

        if (!force && activePrdPath && this.state.path === activePrdPath && ['ready', 'empty', 'error'].includes(this.state.status)) {
            // No loading required, trigger state refresh to make sure views are synced
            this.updateState({});
            return;
        }

        const token = ++this._prdLoadToken;
        this.updateState({
            status: 'loading',
            path: requestedPath || '',
            outputUrl: requestedPath ? this.getPrdDocumentUrl(requestedPath) : '',
            error: ''
        });

        try {
            const documents = await this.discoverPrdDocuments({ preferredPath: requestedPath });
            if (token !== this._prdLoadToken) return;

            let activePath;
            if (requestedPath && documents.some((doc) => doc.path === requestedPath)) {
                activePath = requestedPath;
            } else if (this.host.isShareMode && documents.some(doc => doc.path === this.host.shareConfig?.prdPath)) {
                // The sender's selection is part of the snapshot, independent of
                // the recipient's reading history and document modification times.
                activePath = this.host.shareConfig.prdPath;
            } else {
                const pageId = this.host.activePageId || '';
                const version = this.host.activeVersion || '';
                const lastPath = [this.getLocalStorageItem(this.getLastDocumentKey()), this._serverLastOpenedPath,
                    this.getLocalStorageItem(`readify:prd-last-doc:${pageId}:${version}`)]
                    .find(candidate => documents.some(doc => doc.path === candidate));
                const associated = documents.filter(doc => doc.prototypeVersion === version);
                activePath = associated.find(doc => this.getPrdFileName(doc.path).toLowerCase() !== 'readme.md')?.path
                    || associated[0]?.path || lastPath || documents[0]?.path || '';
            }

            if (!activePath) {
                this.updateState({
                    status: 'empty',
                    content: '',
                    draftContent: '',
                    path: '',
                    outputUrl: '',
                    documents: []
                });
                return;
            }

            // Fetch the raw markdown content
            let content;
            if (this.host.isShareMode && activePath === this.host.shareConfig.prdPath && this.host.shareConfig.prdContent !== null) {
                content = this.host.shareConfig.prdContent;
            } else {
                const response = await fetch(`${activePath.startsWith('/') ? '' : '/'}${activePath}?t=${Date.now()}`);
                if (token !== this._prdLoadToken) return;

                if (response.status === 404) {
                    console.warn(`PRD file not found: ${activePath}`);
                    this.updateState({
                        status: 'empty',
                        content: '',
                        draftContent: '',
                        editMode: false,
                        dirty: false,
                        saving: false,
                        saveError: '',
                        path: activePath,
                        outputUrl: this.getPrdDocumentUrl(activePath),
                        documents
                    });
                    return;
                } else if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                } else {
                    content = await response.text();
                }
            }

            if (token !== this._prdLoadToken) return;
            const pageId = this.host.activePageId || '';
            const savedEditMode = this.getLocalStorageItem(`readify:prd-edit-mode:${pageId}:${activePath}`) === 'true';

            this.updateState({
                status: content.trim() ? 'ready' : 'empty',
                content,
                draftContent: content,
                editMode: !this.isReadOnly() && savedEditMode,
                dirty: false,
                saving: false,
                saveError: '',
                path: activePath,
                outputUrl: this.getPrdDocumentUrl(activePath),
                documents
            });
        } catch (error) {
            if (token !== this._prdLoadToken) return;
            this.updateState({
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
                editMode: false,
                dirty: false,
                saving: false
            });
        }
    }

    /**
     * Triggers the saving sequence via Bridge Server
     */
    async saveDocument(options = {}) {
        if (this.isReadOnly()) return false;
        const directContent = typeof options.content === 'string' ? options.content : null;
        if ((!this.state.editMode && directContent === null) || this.state.saving) return false;
        
        const content = directContent !== null
            ? directContent
            : (typeof this.state.draftContent === 'string' ? this.state.draftContent : String(this.state.content || ''));
        const path = this.state.path || `/src/pages/${this.host.activeProjectId || 'readify'}/${this.host.activePageId}/docs/product-doc.md`;
        
        const token = this._prdLoadToken;
        this.updateState({
            saving: true,
            saveError: ''
        });

        try {
            const response = await fetch('/api/prd-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.host.activeProjectId || 'readify',
                    pageId: this.host.activePageId,
                    version: this.host.activeVersion,
                    path,
                    content
                })
            });

            if (!response.ok) {
                throw new Error(await response.text() || '保存 PRD 失败');
            }

            const result = await response.json();
            if (token !== this._prdLoadToken) return;
            const nextPath = result.path || path;

            this.updateState({
                status: 'ready',
                content,
                draftContent: content,
                path: nextPath,
                outputUrl: this.getPrdDocumentUrl(nextPath),
                documents: Array.isArray(result.documents) && result.documents.length
                    ? this.sortPrdDocuments(this.getUniquePrdDocuments(result.documents))
                    : this.state.documents,
                dirty: false,
                saving: false,
                saveError: '',
                savedAt: result.updatedAt || new Date().toISOString()
            });

            // Dispatch save success event
            this.dispatchEvent(new CustomEvent('prd-save-success', { detail: { path: nextPath } }));
            return true;
        } catch (error) {
            if (token !== this._prdLoadToken) return;
            const message = error instanceof Error ? error.message : String(error);
            this.updateState({
                saving: false,
                saveError: message || '保存失败'
            });
            // Dispatch save error event
            this.dispatchEvent(new CustomEvent('prd-save-error', { detail: { error: message } }));
            return false;
        }
    }

    /**
     * Creates a new PRD markdown file with server-side unique naming.
     */
    async createNewDocument({ derivedFrom = '' } = {}) {
        if (this.isReadOnly()) return;
        if (this.state.saving) return;

        const token = this._prdLoadToken;
        this.updateState({
            saving: true,
            saveError: ''
        });

        try {
            const response = await fetch('/api/prd-doc/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.host.activeProjectId || 'readify',
                    pageId: this.host.activePageId,
                    pageName: this.host.getPageRecord?.()?.name || this.host.activePageId || '',
                    version: this.host.activeVersion,
                    derivedFrom
                })
            });

            if (!response.ok) {
                throw new Error(await response.text() || '新建 PRD 失败');
            }

            const result = await response.json();
            if (token !== this._prdLoadToken) return;
            const path = result.path || '';
            const content = typeof result.content === 'string' ? result.content : '';

            this.updateState({
                status: 'ready',
                content,
                draftContent: content,
                path,
                outputUrl: this.getPrdDocumentUrl(path),
                documents: Array.isArray(result.documents) && result.documents.length
                    ? this.sortPrdDocuments(this.getUniquePrdDocuments(result.documents))
                    : this.state.documents,
                editMode: true,
                dirty: false,
                saving: false,
                saveError: '',
                savedAt: result.updatedAt || new Date().toISOString()
            });

            this.dispatchEvent(new CustomEvent('prd-create-success', {
                detail: {
                    path,
                    filename: result.filename || this.getPrdFileName(path)
                }
            }));
        } catch (error) {
            if (token !== this._prdLoadToken) return;
            const message = error instanceof Error ? error.message : String(error);
            this.updateState({
                saving: false,
                saveError: message || '新建失败'
            });
            this.dispatchEvent(new CustomEvent('prd-create-error', { detail: { error: message } }));
        }
    }

    /**
     * Safely updates current active draft in local memory
     */
    updateDraft(newContent) {
        if (newContent === this.state.draftContent) return;
        this.updateState({
            draftContent: newContent,
            dirty: true
        });
    }

    /**
     * Creates a standard empty boilerplate template inside active draft content
     */
    createEmptyDraft() {
        if (this.isReadOnly()) return;
        const path = this.state.path || `/src/pages/${this.host.activeProjectId || 'readify'}/${this.host.activePageId}/docs/product-doc.md`;
        const content = [
            `# ${this.host.getPageRecord()?.name || this.host.activePageId || '页面'} PRD`,
            '',
            '> 状态: 草稿',
            '',
            '## 1. 背景与目标',
            '',
            '## 2. 功能范围',
            '',
            '## 3. 交互规则',
            '',
            '## 4. 验收标准',
            ''
        ].join('\n');

        this.updateState({
            status: 'ready',
            content: '',
            draftContent: content,
            path,
            outputUrl: this.getPrdDocumentUrl(path),
            editMode: true,
            dirty: true,
            documents: this.state.documents.length ? this.state.documents : [{
                path,
                filename: this.getPrdFileName(path),
                label: this.getPrdDocumentLabel(path)
            }]
        });
    }
}
