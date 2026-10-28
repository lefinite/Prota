import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { previewConfig, digest, safeId } from './config.mjs';
import { validateFiles } from './validator.mjs';
const allowed = /\.(?:html?|css|[cm]?js|json|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|mp[34]|webm|ogg|wav|pdf|txt|wasm)$/i;
export async function readPage(root, config = previewConfig) {
    const files = new Map(), stats = new Map(); let bytes = 0;
    // Reject symlinks on every path component, including project/page/version.
    for (let part = path.resolve(root); part !== path.dirname(part); part = path.dirname(part)) {
        if ((await fs.lstat(part)).isSymbolicLink()) throw new Error('Symlink path rejected');
    }
    async function visit(dir, prefix = '') {
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            if (entry.isSymbolicLink()) throw new Error('Symlink rejected');
            if (entry.name.startsWith('.') || /(?:secret|credential|api.?key|password|provider|session|node_modules)/i.test(entry.name)) continue;
            const name = prefix + entry.name, absolute = path.join(dir, entry.name);
            if (entry.isDirectory()) { await visit(absolute, name + '/'); continue; }
            if (!entry.isFile() || !allowed.test(name)) continue;
            const stat = await fs.lstat(absolute);
            if (!stat.isFile() || await fs.realpath(absolute) !== absolute) throw new Error('Symlink path rejected');
            bytes += stat.size;
            if (bytes > config.maxBytes || files.size >= config.maxFiles) throw new Error('Preview capacity exceeded');
            const handle = await fs.open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
            let data;
            try {
                const opened = await handle.stat();
                if (!opened.isFile() || opened.ino !== stat.ino || opened.size !== stat.size) throw new Error('File changed while opening');
                data = await handle.readFile();
                const after = await handle.stat();
                if (data.length !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) throw new Error('File changed while reading');
            } finally { await handle.close(); }
            files.set(name, data); stats.set(name, `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}:${stat.ino}`);
        }
    }
    await visit(root);
    const hash = digest([...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => `${name}:${digest(data)}`).join('\n'));
    return { files, stats, hash, bytes };
}
export async function createSnapshot({ pageRoot, cacheRoot, runId, revision, previous, config = previewConfig }) {
    if (!safeId(runId) || !Number.isSafeInteger(revision) || revision < 1) throw new Error('Invalid snapshot identity');
    const first = await readPage(pageRoot, config);
    if (first.hash === previous?.hash) return null;
    await validateFiles(first.files);
    const second = await readPage(pageRoot, config);
    if (first.hash !== second.hash || JSON.stringify([...first.stats]) !== JSON.stringify([...second.stats])) throw new Error('Files still changing');
    const runRoot = path.join(cacheRoot, runId), candidate = path.join(runRoot, `.candidate-${randomUUID()}`);
    await fs.mkdir(candidate, { recursive: true, mode: 0o700 });
    try {
        for (const [name, data] of first.files) {
            const target = path.join(candidate, name);
            await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
            await fs.writeFile(target, data, { mode: 0o400 });
        }
        await fs.rename(candidate, path.join(runRoot, String(revision)));
    } finally { await fs.rm(candidate, { recursive: true, force: true }); }
    const changed = new Set([...new Set([...first.files.keys(), ...(previous?.files.keys() || [])])].filter(name => (!first.files.has(name) || !previous?.files.has(name) || !first.files.get(name).equals(previous.files.get(name)))));
    return { ...first, changed, revision };
}
export async function pruneCache(root, config = previewConfig) {
    const revisions = []; let total = 0;
    for (const run of await fs.readdir(root, { withFileTypes: true }).catch(() => [])) {
        if (!run.isDirectory() || !safeId(run.name)) continue;
        const runDir = path.join(root, run.name);
        for (const entry of await fs.readdir(runDir, { withFileTypes: true })) {
            const dir = path.join(runDir, entry.name), stat = await fs.lstat(dir);
            if (!entry.isDirectory() || stat.isSymbolicLink()) continue;
            if (Date.now() - stat.mtimeMs > config.retentionMs) { await fs.rm(dir, { recursive: true, force: true }); continue; }
            let bytes = 0;
            async function size(p) { for (const e of await fs.readdir(p, { withFileTypes: true })) { const f = path.join(p, e.name); if (e.isDirectory()) await size(f); else if (e.isFile()) bytes += (await fs.stat(f)).size; } }
            await size(dir); total += bytes; revisions.push({ dir, bytes, time: stat.mtimeMs });
        }
    }
    for (const item of revisions.sort((a,b) => a.time - b.time)) {
        if (total <= config.cacheBytes) break;
        await fs.rm(item.dir, { recursive: true, force: true }); total -= item.bytes;
    }
}
