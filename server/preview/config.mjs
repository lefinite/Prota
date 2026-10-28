import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const previewConfig = Object.freeze({
    enabled: process.env.PROTA_PROGRESSIVE_PREVIEW === '1',
    stableMs: 250, mergeMs: 1000, refreshMs: 500, scanMs: 1000,
    maxFiles: 2000, maxBytes: 50 * 1024 * 1024, maxRevisions: 10,
    cacheBytes: 512 * 1024 * 1024, retentionMs: 30 * 60 * 1000
});
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export function previewCacheRoot(configDirectory, workspaceRoot) {
    const canonical = p => { try { return fs.realpathSync(p); } catch { const parent = path.dirname(p); return parent === p ? p : path.join(canonical(parent), path.basename(p)); } };
    return path.join(os.tmpdir(), `prota-preview-${digest(canonical(path.resolve(configDirectory))).slice(0, 16)}`, digest(canonical(workspaceRoot)).slice(0, 16));
}
export const safeId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);

// Internal development switch; re-read so rollback never requires restarting Agent.
export function progressivePreviewEnabled(configDirectory) {
    try { return JSON.parse(fs.readFileSync(path.join(configDirectory, 'preview.json'), 'utf8')).progressivePreview === true; }
    catch (error) { return error.code === 'ENOENT' ? previewConfig.enabled : false; }
}
