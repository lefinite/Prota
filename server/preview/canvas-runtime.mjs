// Preview snapshots freeze the same verified bundle used by the product bridge.
// No second JS implementation of the Python runtime builder or editor view.
import { digest } from './config.mjs';
const bundles = new Map();
export async function sharedCanvasRuntime(pageRoot, origin = `http://127.0.0.1:${Number(process.env.READIFY_PORT || 8080)}`) {
    const route = pageRoot.replaceAll('\\', '/').match(/\/src\/pages\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/(v\d+)\/?$/);
    const host = new URL(origin);
    if (!route || host.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(host.hostname)) throw new Error('Invalid local canvas runtime origin');
    const base = new URL(`/src/pages/${route[1]}/${route[2]}/${route[3]}/__prota_runtime/`, host.origin);
    const read = async name => {
        const response = await fetch(new URL(name, base), { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error('Canvas runtime unavailable: ' + name);
        const data = Buffer.from(await response.arrayBuffer());
        if (data.length > 16 * 1024 * 1024) throw new Error('Canvas runtime file exceeds preview limit');
        return data;
    };
    const entry = (await read('../index.html')).toString().replace('<script>window.__protaCanvasLegacyEntry=true;</script>', '');
    if (!/data-prota-canvas-shell=["']shared-v1["']/.test(entry)) return null;
    const manifestBytes = await read('runtime-manifest.json'), manifest = JSON.parse(manifestBytes);
    if (!/^[a-f0-9]{64}$/.test(manifest.runtimeHash) || manifest.format !== 1 || !manifest.files || Object.keys(manifest.files).length > 32) throw new Error('Invalid canvas runtime manifest');
    const hashes = Object.fromEntries(Object.entries(manifest.files).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0));
    if (digest(JSON.stringify(hashes)) !== manifest.runtimeHash) throw new Error('Canvas runtime manifest hash mismatch');
    if (!bundles.has(manifest.runtimeHash)) {
        const promise = (async () => {
            const files = new Map();
            for (const [name, checksum] of Object.entries(hashes)) {
                if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/.test(name) || !/^[a-f0-9]{64}$/.test(checksum)) throw new Error('Invalid canvas runtime resource');
                const data = await read(name);
                if (digest(data) !== checksum) throw new Error('Canvas runtime resource hash mismatch: ' + name);
                files.set('__prota_runtime/' + name, data);
            }
            const script = await read('runtime-manifest.js');
            if (!script.equals(Buffer.from('window.__protaCanvasRuntimeManifest = ' + manifestBytes.toString() + ';\n'))) throw new Error('Canvas runtime metadata mismatch');
            files.set('__prota_runtime/runtime-manifest.json',manifestBytes);
            files.set('__prota_runtime/runtime-manifest.js',script);
            return files;
        })();
        bundles.set(manifest.runtimeHash,promise);
        promise.catch(() => bundles.delete(manifest.runtimeHash));
        if (bundles.size > 4) bundles.delete(bundles.keys().next().value);
    }
    const files = new Map(await bundles.get(manifest.runtimeHash));
    files.set('index.html', Buffer.from(entry));
    return files;
}
