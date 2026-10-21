export class DrawioManager {
    constructor(host) {
        this.host = host;
        this.state = this.getDefaultState();
        this._loadToken = 0;
        this._saveChain = Promise.resolve();
        // 保存状态追踪：dirty=有尚未确认落盘的内容；lastSaveError=最近一次保存失败原因；
        // saving=有保存请求在途；online=当前是否联网。这些字段驱动编辑器底部的状态条与退出拦截。
        this._saveSeq = 0;
        this.dirty = false;
        this.saving = false;
        this.lastSaveError = null;
        this.lastXml = '';
        this.online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        this._recoverableBackup = null;
        this._statusListeners = new Set();
        this._bindConnectivity();
    }

    getDefaultState() {
        return {
            status: 'idle',
            xml: '',
            path: '',
            filename: '',
            diagrams: [],
            error: ''
        };
    }

    _bindConnectivity() {
        if (typeof window === 'undefined') return;
        this._onlineHandler = () => {
            const wasOffline = !this.online;
            this.online = true;
            this._emitStatus();
            if (wasOffline) this._retryPending();
        };
        this._offlineHandler = () => {
            this.online = false;
            this._emitStatus();
        };
        window.addEventListener('online', this._onlineHandler);
        window.addEventListener('offline', this._offlineHandler);
    }

    /** 订阅保存状态变化，返回取消订阅函数。 */
    onStatus(fn) {
        this._statusListeners.add(fn);
        return () => this._statusListeners.delete(fn);
    }

    _emitStatus() {
        const status = this.getSaveStatus();
        this._statusListeners.forEach((fn) => {
            try { fn(status); } catch { /* 监听者异常不应影响保存链路 */ }
        });
    }

    /**
     * 返回当前保存状态，供 UI 决定提示。
     * state: readonly | saved | pending | saving | error | offline
     */
    getSaveStatus() {
        if (this.host.isShareMode) return { state: 'readonly', online: this.online };
        if (!this.online) {
            return { state: 'offline', online: false, dirty: this.dirty, error: this.lastSaveError };
        }
        if (this.lastSaveError) {
            return { state: 'error', online: true, dirty: this.dirty, error: this.lastSaveError };
        }
        if (this.saving) return { state: 'saving', online: true, dirty: this.dirty };
        if (this.dirty) return { state: 'pending', online: true, dirty: true };
        return { state: 'saved', online: true, dirty: false };
    }

    /** 退出/切换前判断是否有未落盘的心血，决定是否要拦截。 */
    hasUnsavedWork() {
        if (this.host.isShareMode) return false;
        return this.dirty || Boolean(this.lastSaveError) || !this.online;
    }

    createBlankXml() {
        return '<mxfile host="Prota" type="device"><diagram id="page-1" name="流程图"><mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
    }

    getDefaultPath() {
        const projectId = this.host.activeProjectId || 'readify';
        const pageId = this.host.activePageId || '';
        const version = this.host.activeVersion || 'v1';
        return `/src/pages/${projectId}/${pageId}/docs/diagrams/${version}.drawio`;
    }

    // ── 本地备份（断网/保存失败时的兜底，避免心血丢失） ───────────────
    _backupKey() {
        const projectId = this.host.activeProjectId || 'readify';
        const pageId = this.host.activePageId || '';
        const path = this.state.path || this.getDefaultPath();
        return `readify:drawio:backup:${projectId}/${pageId}/${path}`;
    }

    _writeBackup(xml) {
        try {
            localStorage.setItem(this._backupKey(), JSON.stringify({ xml, ts: Date.now() }));
        } catch {
            // 隐私模式 / 配额不足时忽略，至少状态条仍会提示保存失败。
        }
    }

    _clearBackup() {
        try { localStorage.removeItem(this._backupKey()); } catch { /* noop */ }
    }

    _readBackup() {
        try {
            const raw = localStorage.getItem(this._backupKey());
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    /** 若仍有未落盘内容，把最新 xml 写入本地备份，作为退出前的最后一道保险。 */
    ensureBackupIfDirty() {
        if (this.host.isShareMode) return;
        if (this.dirty && this.lastXml) this._writeBackup(this.lastXml);
    }

    hasRecoverableBackup() {
        return Boolean(this._recoverableBackup);
    }

    getRecoverableBackup() {
        return this._recoverableBackup;
    }

    /** 用户点击「恢复」：取回备份内容并清理。 */
    consumeBackup() {
        const backup = this._recoverableBackup;
        this._recoverableBackup = null;
        if (backup) this._clearBackup();
        return backup;
    }

    /** 用户点击「忽略」：丢弃本次本地备份。 */
    dismissBackup() {
        this._recoverableBackup = null;
        this._clearBackup();
    }

    normalizeShareDiagrams(share = {}) {
        if (Array.isArray(share.diagrams) && share.diagrams.length > 0) {
            return share.diagrams.map((item) => ({
                path: item.path || '',
                filename: item.filename || String(item.path || '').split('/').pop() || 'diagram.drawio',
                label: item.label || item.filename || '流程图',
                content: item.content || ''
            }));
        }
        if (share.diagramContent) {
            return [{
                path: share.diagramPath || '',
                filename: share.diagramFilename || String(share.diagramPath || '').split('/').pop() || 'diagram.drawio',
                label: share.diagramFilename || '流程图',
                content: share.diagramContent
            }];
        }
        return [];
    }

    async load(preferredPath = '') {
        const token = ++this._loadToken;
        this._recoverableBackup = null;
        this.state = { ...this.state, status: 'loading', error: '' };
        try {
            const share = this.host.shareConfig || window.__READIFY_SHARE__ || {};
            if (this.host.isShareMode) {
                const diagrams = this.normalizeShareDiagrams(share);
                const selected = diagrams.find((item) => item.path === preferredPath)
                    || diagrams.find((item) => item.path === this.state.path)
                    || diagrams[0];
                if (token !== this._loadToken) return;
                this.state = selected ? {
                    status: 'ready',
                    xml: selected.content,
                    path: selected.path,
                    filename: selected.filename,
                    diagrams,
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
            const response = await fetch(`/api/drawio-diagram?${params.toString()}&t=${Date.now()}`);
            if (!response.ok) throw new Error(await response.text() || '读取流程图失败');
            const data = await response.json();
            if (token !== this._loadToken) return;
            this.state = {
                status: data.content ? 'ready' : 'empty',
                xml: data.content || this.createBlankXml(),
                path: data.path || this.getDefaultPath(),
                filename: data.filename || `${this.host.activeVersion || 'v1'}.drawio`,
                diagrams: Array.isArray(data.diagrams) ? data.diagrams : [],
                error: ''
            };
            this.lastXml = this.state.xml || '';
            // 加载完成后检查是否有上次断网/失败遗留的本地草稿，若有则交给 UI 提示恢复。
            const backup = this._readBackup();
            if (backup && backup.xml && backup.xml !== this.state.xml) {
                this._recoverableBackup = backup;
            }
        } catch (error) {
            if (token !== this._loadToken) return;
            this.state = { ...this.getDefaultState(), status: 'error', error: error.message || String(error) };
        }
    }

    save(xml) {
        if (this.host.isShareMode) return Promise.resolve();
        this.state = { ...this.state, xml, status: 'ready' };
        this.lastXml = xml;
        // 序列号用于判断保存完成时是否已有更新的内容进来：只有「最新一次」保存成功才清掉 dirty，
        // 避免排在后面的新内容被前面那次成功误判为已落盘。
        const seq = ++this._saveSeq;
        this.dirty = true;
        this._saveChain = this._saveChain.then(async () => {
            this.saving = true;
            this._emitStatus();
            try {
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    throw new Error('网络未连接');
                }
                const response = await fetch('/api/drawio-diagram', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId: this.host.activeProjectId || 'readify',
                        pageId: this.host.activePageId,
                        version: this.host.activeVersion,
                        path: this.state.path || this.getDefaultPath(),
                        content: xml
                    })
                });
                if (!response.ok) throw new Error(await response.text() || '保存流程图失败');
                const data = await response.json();
                this.state = {
                    ...this.state,
                    path: data.path || this.state.path,
                    filename: data.filename || this.state.filename,
                    diagrams: Array.isArray(data.diagrams) ? data.diagrams : this.state.diagrams
                };
                if (seq === this._saveSeq) this.dirty = false;
                this.lastSaveError = null;
                this._clearBackup();
            } catch (error) {
                this.lastSaveError = error.message || String(error);
                // 写入本地备份，断网/关闭页面后仍可恢复。
                this._writeBackup(xml);
            } finally {
                this.saving = false;
                this._emitStatus();
            }
        });
        return this._saveChain;
    }

    /** 等待当前保存链路落定（最多等 timeout），用于退出前确认是否真的存好。 */
    settle(timeout = 2000) {
        return Promise.race([
            this._saveChain,
            new Promise((resolve) => window.setTimeout(resolve, timeout))
        ]);
    }

    async _retryPending() {
        if (this.host.isShareMode || !this.lastXml) return;
        if (!this.dirty && !this.lastSaveError) return;
        this.host.showToast?.('网络已恢复，正在重新保存流程图…');
        await this.save(this.lastXml);
        await this.settle(3000);
        if (!this.lastSaveError) {
            this.host.showToast?.('流程图已保存成功', false);
        }
    }

    async createDiagram({ title = '流程图' } = {}) {
        if (this.host.isShareMode) throw new Error('分享页面不支持新增流程图');
        const version = this.host.activeVersion || 'v1';
        const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
        const path = `/src/pages/${this.host.activeProjectId || 'readify'}/${this.host.activePageId}/docs/diagrams/${version}-${stamp}.drawio`;
        const xml = this.createBlankXml().replace('name="流程图"', `name="${String(title || '流程图').replace(/[<>&"]/g, '')}"`);
        const response = await fetch('/api/drawio-diagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: this.host.activeProjectId || 'readify',
                pageId: this.host.activePageId,
                version,
                path,
                content: xml
            })
        });
        if (!response.ok) throw new Error(await response.text() || '新增流程图失败');
        const data = await response.json();
        this.state = {
            ...this.state,
            diagrams: Array.isArray(data.diagrams) ? data.diagrams : this.state.diagrams
        };
        return {
            path: data.path || path,
            filename: data.filename || path.split('/').pop(),
            title
        };
    }
}
