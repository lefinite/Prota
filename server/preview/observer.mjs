import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { previewConfig, previewCacheRoot, safeId } from './config.mjs';
import { createSnapshot, pruneCache } from './snapshot.mjs';
import { revisionEvent } from './events.mjs';

export function previewScope(context = {}, descriptor = {}) {
    if (!safeId(context.projectId)) return null;
    const task = `${descriptor.skillId || ''} ${descriptor.commandId || ''}`;
    if (descriptor.kind === 'skill' && descriptor.skillId !== 'create-new-page') return null;
    if (/prd|flow|diagram|document|report/i.test(task)) return null;
    const creating = /create-new-page|new-page/.test(task);
    const iterating = /iterate/.test(task);
    if (!creating && (!safeId(context.pageId) || !/^v\d+$/.test(context.version || ''))) return null;
    return { projectId: context.projectId, pageId: creating ? null : context.pageId, version: creating || iterating ? null : context.version, mode: creating ? 'create' : iterating ? 'iterate' : 'page' };
}

export class PreviewObserver {
    constructor({ workspaceRoot, configDirectory, runId, scope, publish, isCurrent = () => true, config = previewConfig, log = () => {} }) {
        Object.assign(this, { workspaceRoot, runId, scope, publish, isCurrent, config, log });
        this.cacheRoot = previewCacheRoot(configDirectory, workspaceRoot);
        this.watchers = new Map(); this.previous = new Map(); this.revision = 0;
        this.stopped = false; this.busy = false; this.pending = false;
    }
    start() {
        this.scopeRoot = path.join(this.workspaceRoot, 'src/pages', this.scope.projectId, ...(this.scope.pageId ? [this.scope.pageId] : []), ...(this.scope.version ? [this.scope.version] : []));
        this.baselinePages = new Set();
        if (['create', 'iterate'].includes(this.scope.mode)) {
            const collect = dir => {
                try {
                    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                        if (!e.isDirectory() || e.isSymbolicLink() || !safeId(e.name)) continue;
                        const child = path.join(dir, e.name);
                        if (/^v\d+$/.test(e.name)) this.baselinePages.add(child);
                        else if (path.relative(this.scopeRoot, child).split(path.sep).length < 2) collect(child);
                    }
                } catch {}
            };
            collect(this.scopeRoot);
        }
        this.poll = setInterval(() => this.scan(), this.config.scanMs); this.poll.unref?.();
        this.scan();
        this.gc = setInterval(() => pruneCache(this.cacheRoot, this.config).catch(this.log), this.config.retentionMs); this.gc.unref?.();
        pruneCache(this.cacheRoot, this.config).catch(this.log);
        return this;
    }
    trigger() {
        if (this.stopped) return;
        this.pending = true;
        const now = Date.now(); this.firstChange ||= now;
        clearTimeout(this.timer);
        const delay = Math.max(0, Math.max(this.lastPublish ? this.lastPublish + this.config.refreshMs - now : 0, Math.min(this.config.stableMs, this.config.mergeMs - (now - this.firstChange))));
        this.timer = setTimeout(() => this.flush(), delay);
    }
    async scan() {
        if (this.stopped || this.scanning) return;
        this.scanning = true;
        try {
            if (!this.isCurrent()) { this.stop(); return; }
            const dirs = new Set(), entries = [], pages = []; let count = 0;
            const walk = async dir => {
                const stat = await fsp.lstat(dir).catch(() => null);
                if (!stat?.isDirectory() || stat.isSymbolicLink()) return;
                if (++count > this.config.maxFiles * 2) throw new Error('Preview scan capacity exceeded');
                dirs.add(dir);
                for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
                    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
                    const file = path.join(dir, entry.name);
                    if (entry.isDirectory()) await walk(file);
                    else if (entry.isFile()) {
                        if (++count > this.config.maxFiles * 2) throw new Error('Preview scan capacity exceeded');
                        const s = await fsp.stat(file); entries.push(`${file}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`);
                        if (entry.name === 'index.html') {
                            const parts = path.relative(path.join(this.workspaceRoot, 'src/pages'), dir).split(path.sep);
                            if (!this.baselinePages.has(dir) && parts.length === 3 && parts.every(safeId) && /^v\d+$/.test(parts[2])) pages.push({ dir, scope: { projectId: parts[0], pageId: parts[1], version: parts[2] } });
                        }
                    }
                }
            };
            await walk(this.scopeRoot);
            if (this.stopped || !this.isCurrent()) { this.stop(); return; }
            // Watch the nearest existing ancestor too, to discover newly created scopes.
            let ancestor = this.scopeRoot;
            while (!fs.existsSync(ancestor) && ancestor !== this.workspaceRoot) ancestor = path.dirname(ancestor);
            dirs.add(ancestor);
            for (const [dir, watcher] of this.watchers) if (!dirs.has(dir)) { watcher.close(); this.watchers.delete(dir); }
            for (const dir of dirs) if (!this.watchers.has(dir) && this.watchers.size < (this.config.maxWatchers || 256)) {
                try { const w = fs.watch(dir, () => { this.trigger(); }); w.on('error', () => { w.close(); this.watchers.delete(dir); }); this.watchers.set(dir, w); } catch {}
            }
            this.pages = pages;
            const signature = entries.sort().join('\n');
            if (signature !== this.signature) { this.signature = signature; this.trigger(); }
        } catch (error) { this.log(error); }
        finally { this.scanning = false; }
    }
    async flush() {
        if (this.stopped || this.busy || !this.pending) return;
        if (!this.isCurrent()) { this.stop(); return; }
        this.busy = true; this.pending = false; this.firstChange = 0;
        try {
            await this.scan();
            for (const page of this.pages || []) {
                if (this.stopped) break;
                try {
                    const snapshot = await createSnapshot({ pageRoot: page.dir, cacheRoot: this.cacheRoot, runId: this.runId, revision: this.revision + 1, previous: this.previous.get(page.dir), config: this.config });
                    if (!snapshot || this.stopped || !this.isCurrent()) continue;
                    this.revision++; this.previous.set(page.dir, snapshot); this.lastPublish = Date.now();
                    this.latestRevision = revisionEvent(this.runId, page.scope, snapshot);
                    this.publish(this.latestRevision);
                    const obsolete = this.revision - this.config.maxRevisions;
                    if (obsolete > 0) await fsp.rm(path.join(this.cacheRoot, this.runId, String(obsolete)), { recursive: true, force: true });
                } catch (error) { this.log(error); }
            }
            await pruneCache(this.cacheRoot, this.config);
        } catch (error) { this.log(error); }
        finally { this.busy = false; if (this.pending && !this.stopped) this.trigger(); }
    }
    stop() {
        if (this.stopped) return;
        this.stopped = true; clearInterval(this.poll); clearInterval(this.gc); clearTimeout(this.timer);
        for (const w of this.watchers.values()) w.close(); this.watchers.clear();
        this.previous.clear();
        // Keep the last valid preview available after failure; expire after retention.
        const cleanup = setTimeout(() => fsp.rm(path.join(this.cacheRoot, this.runId), { recursive: true, force: true }).catch(this.log), this.config.retentionMs); cleanup.unref?.();
    }
}
