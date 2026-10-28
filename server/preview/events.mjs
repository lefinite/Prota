import { posix } from 'node:path';
import { references } from './validator.mjs';
export function revisionEvent(runId, scope, snapshot) {
    const names = [...snapshot.changed];
    const boardIds = new Set(names.map(n => /^boards\/([^/]+)\//.exec(n)?.[1]).filter(Boolean));
    const shared = new Set(names.filter(n => !n.startsWith('boards/')));
    if (shared.size) {
        for (const file of snapshot.files.keys()) {
            const match = /^boards\/([^/]+)\/index\.html$/.exec(file);
            if (!match || boardIds.has(match[1])) continue;
            const visited = new Set();
            const affected = name => {
                if (shared.has(name)) return true;
                if (visited.has(name) || !snapshot.files.has(name)) return false;
                visited.add(name);
                if (!/\.(?:html?|css|[cm]?js)$/.test(name)) return false;
                return references(name, snapshot.files.get(name).toString('utf8')).some(ref => {
                    const dependency = posix.normalize(posix.join(posix.dirname(name), decodeURIComponent(ref.split(/[?#]/)[0])));
                    return affected(dependency);
                });
            };
            if (affected(file)) boardIds.add(match[1]);
        }
    }
    return {
        runId, revision: snapshot.revision, scope,
        snapshotUrl: `/__prota_preview/${runId}/${snapshot.revision}/index.html`,
        changes: {
            html: names.some(n => /\.html?$/.test(n)), css: names.some(n => /\.css$/.test(n)),
            javascript: names.some(n => /\.[cm]?js$/.test(n) && n !== 'canvas-data.js'),
            layout: names.includes('canvas-data.js'),
            assets: names.some(n => !/\.(?:html?|css|[cm]?js)$/.test(n)),
            boardIds: [...boardIds]
        },
        createdAt: new Date().toISOString()
    };
}
