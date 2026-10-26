import { renderShareGate } from './share_gate_page.mjs';
/** Private Vercel Function: every resource passes the same expiry/session check. */
import { createHmac, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const derive = promisify(scrypt);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.zip':'application/zip','.pdf':'application/pdf','.mp4':'video/mp4','.mp3':'audio/mpeg','.wasm':'application/wasm','.xml':'application/xml; charset=utf-8'};
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createShareHandler(manifest, contentRoot, { now = Date.now, secureCookies = true } = {}) {
    const policies = manifest.shares;
    const entries = new Map();
    const resources = new Map();
    for (const policy of policies) {
        for (const entry of policy.entries) entries.set(entry, policy);
        for (const file of policy.files) {
            if (!resources.has(file)) resources.set(file, []);
            resources.get(file).push(policy);
        }
    }
    const attempts = new Map(); // Bounded, per-instance backoff; platform firewall can add distributed limits.
    const cookieName = policy => `prota_share_${policy.id}`;
    const sign = (policy, value) => createHmac('sha256', policy.sessionKey).update(value).digest('hex');
    const session = (policy, cookies) => {
        const token = cookies[cookieName(policy)] || '';
        const [expiry, signature] = token.split('.');
        return /^\d+$/.test(expiry || '') && Number(expiry) > now() && equal(sign(policy, expiry), signature);
    };
    const active = policy => policy.expiresAt === null || policy.expiresAt > now();
    return async function handler(req, res) {
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('Vary', 'Cookie');
        const reply = (code, message, form = false) => { res.statusCode = code; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(req.method === 'HEAD' ? undefined : renderShareGate(message, form, code)); };
        let path;
        try {
            path = decodeURIComponent(req.url.split('?')[0]);
            if (!path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').some(part => part === '..' || part === '.' || part.startsWith('.'))) return reply(404, '分享不存在。');
        } catch { return reply(400, '链接格式无效。'); }
        if (path.endsWith('/')) path += 'index.html';
        const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(value => { const i = value.indexOf('='); return [value.slice(0, i).trim(), value.slice(i + 1)]; }));
        const entry = entries.get(path);
        if (!['GET', 'HEAD', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD, POST'); return reply(405, '请求方式不支持。'); }
        if (entry) {
            if (!active(entry)) return reply(410, '此分享已过期，请联系分享者重新分享。');
            if (req.method === 'POST') {
                if (req.headers.origin && req.headers.origin !== `https://${req.headers.host}` && !(secureCookies === false && req.headers.origin === `http://${req.headers.host}`)) return reply(403, '请从分享链接提交密码。');
                const key = `${entry.id}:${req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown'}`;
                const recent = attempts.get(key);
                if (recent && recent.until > now() && recent.count >= 5) { res.setHeader('Retry-After', String(Math.ceil((recent.until - now()) / 1000))); return reply(429, '尝试次数过多，请稍后再试。', true); }
                let body = ''; let size = 0;
                for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 4096) return reply(413, '密码请求过长。'); body += chunk; }
                const password = new URLSearchParams(body).get('password') || '';
                let valid = !entry.passwordHash;
                if (entry.passwordHash && [...password].length <= 128) {
                    const derived = await derive(password, Buffer.from(entry.salt, 'hex'), 32, {N:16384, r:8, p:1});
                    valid = equal(derived.toString('hex'), entry.passwordHash);
                }
                if (!valid) {
                    if (attempts.size > 10000) attempts.clear();
                    attempts.set(key, { count: recent && recent.until > now() ? recent.count + 1 : 1, until: recent && recent.until > now() ? recent.until : now() + 900000 });
                    return reply(401, '密码不正确，请重试。', true);
                }
                attempts.delete(key);
                if (!active(entry)) return reply(410, '此分享已过期，请联系分享者重新分享。');
            } else if (entry.passwordHash && !session(entry, cookies)) {
                return reply(401, '此链接已启用密码保护，请向分享者获取密码。', true);
            }
            const expires = Math.min(now() + 86400000, entry.expiresAt ?? Infinity);
            const value = `${expires}.${sign(entry, String(expires))}`;
            res.setHeader('Set-Cookie', `${cookieName(entry)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor((expires - now()) / 1000))}${secureCookies ? '; Secure' : ''}`);
            if (req.method === 'POST') { res.statusCode = 303; res.setHeader('Location', path); return res.end(); }
        } else {
            if (req.method === 'POST') return reply(405, '请从分享链接提交密码。');
            const owners = resources.get(path) || [];
            if (!owners.some(policy => active(policy) && session(policy, cookies))) return reply(404, '请使用有效的分享链接访问。');
        }
        const file = resolve(contentRoot, '.' + path);
        if (!file.startsWith(resolve(contentRoot) + sep)) return reply(404, '分享不存在。');
        let stat;
        try { stat = statSync(file); if (!stat.isFile()) throw new Error(); } catch { return reply(404, '文件不存在。'); }
        res.setHeader('Content-Type', types[extname(file).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);
        if (extname(file) === '.zip') res.setHeader('Content-Disposition', 'attachment');
        if (req.method === 'HEAD') return res.end();
        createReadStream(file).on('error', () => res.destroy()).pipe(res);
    };
}
let deployedHandler;
export default function handler(req, res) {
    if (!deployedHandler) {
        const root = dirname(fileURLToPath(import.meta.url));
        deployedHandler = createShareHandler(JSON.parse(readFileSync(resolve(root, 'access.json'))), resolve(root, 'content'));
    }
    return deployedHandler(req, res);
}
