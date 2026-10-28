import { spawn } from 'node:child_process';
import vm from 'node:vm';
import { posix } from 'node:path';
const textExtensions = /\.(?:html?|css|[cm]?js|svg)$/i;
// Only local references participate. Unsupported root-relative/build inputs fall back
// to the existing formal preview; no generated source is rewritten.
export function references(name, source) {
    const refs = [];
    if (/\.html?$/i.test(name)) {
        for (const m of source.matchAll(/<(script|link|img|source|iframe)\b[^>]*?\s(?:src|href)\s*=\s*["']([^"']+)["']/gi)) refs.push(m[2]);
    }
    if (/\.(?:html?|css)$/i.test(name)) {
        for (const m of source.matchAll(/(?:url\(\s*["']?([^\s"')]+)|@import\s+["']([^"']+))/gi)) refs.push(m[1] || m[2]);
    }
    if (/\.[cm]?js$/i.test(name)) {
        for (const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)) refs.push(m[1]);
    }
    return refs.filter(ref => !/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(ref));
}
async function checkJavaScript(source, module = false) {
    if (!module) { try { new vm.Script(source); return true; } catch { return false; } }
    return new Promise(resolve => {
        const child = spawn(process.execPath, ['--check', '--input-type=module'], { stdio: ['pipe', 'ignore', 'ignore'] });
        const timer = setTimeout(() => { child.kill(); resolve(false); }, 1000);
        child.on('error', () => { clearTimeout(timer); resolve(false); });
        child.on('close', code => { clearTimeout(timer); resolve(code === 0); });
        child.stdin.on('error', () => {}); child.stdin.end(source);
    });
}
export async function validateFiles(files) {
    const html = files.get('index.html')?.toString('utf8') || '';
    if (!html.trim() || !/<[a-z][\s\S]*>/i.test(html)) throw new Error('Entry HTML is empty or incomplete');
    const modules = new Set();
    const attribute = (source, name) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(source)?.[1];
    for (const [name, data] of files) if (/\.html?$/i.test(name)) {
        for (const match of data.toString('utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
            const src = attribute(match[1], 'src'), type = attribute(match[1], 'type')?.toLowerCase();
            if (src && type === 'module') modules.add(posix.normalize(posix.join(posix.dirname(name), src.split(/[?#]/)[0])));
            if (src || (type && !['module', 'text/javascript', 'application/javascript'].includes(type))) continue;
            if (!(await checkJavaScript(match[2], type === 'module'))) throw new Error(`Inline JavaScript is incomplete: ${name}`);
        }
    }
    for (const [name, data] of files) {
        if (!textExtensions.test(name)) continue;
        const source = data.toString('utf8');
        if (/\.html?$/i.test(name) && !source.trim()) throw new Error(`Empty HTML: ${name}`);
        for (let ref of references(name, source)) {
            ref = decodeURIComponent(ref.split(/[?#]/)[0]);
            if (!ref) continue;
            if (ref.startsWith('/') || ref.includes('\\')) throw new Error('Unsupported absolute reference');
            const resolved = posix.normalize(posix.join(posix.dirname(name), ref));
            if (resolved.startsWith('../') || !files.has(resolved)) throw new Error(`Local dependency unavailable: ${resolved}`);
        }
        const module = modules.has(name) || /\.mjs$/i.test(name) || /^\s*(?:import\s|export\s)/m.test(source);
        if (/\.[cm]?js$/i.test(name) && !(await checkJavaScript(source, module))) throw new Error(`JavaScript is incomplete: ${name}`);
    }
}
