/** Branded, self-contained access screens. Assets never need an authenticated request. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const roots = [resolve(here, 'brand'), resolve(here, '../portal/assets/prota')];
const cache = new Map();
function asset(path, mime) {
    if (!cache.has(path)) {
        const file = roots.map(root => resolve(root, path)).find(existsSync);
        cache.set(path, file ? `data:${mime};base64,${readFileSync(file).toString('base64')}` : '');
    }
    return cache.get(path);
}
const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function renderShareGate(message, form = false, status = 401) {
    const wrong = form && message.includes('密码不正确');
    const paused = status === 429;
    const expired = status === 410;
    const state = expired ? 'expired' : paused ? 'paused' : wrong ? 'error' : form ? 'locked' : 'unavailable';
    const locked = form && !wrong && !paused;
    const mascot = asset(locked ? 'pet/share-guardian.webp' : expired || !form || paused ? 'pet/disconnected.webp' : 'pet/failed.webp', 'image/webp');
    const title = expired ? '这份分享已到期' : paused ? '稍等一下，再来试试' : wrong ? '密码好像不对' : form ? '小狗正在守护这份分享' : '暂时无法打开分享';
    const description = wrong ? '再检查一下密码，小狗会为你打开这份分享。' : form && !paused ? '输入访问密码，查看分享的原型与文档。' : message;
    const eye = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
    return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title} · Prota</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;grid-template-rows:auto 1fr;background:#f8f9fc;color:#1a1d24;font:14px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}header{display:flex;align-items:center;gap:18px;padding:28px 40px}header img{display:block;width:110px;height:auto}header span{padding-left:18px;border-left:1px solid #dfe2eb;color:#7b8192;font-size:13px}main{width:min(360px,calc(100% - 48px));margin:24px auto 40px;align-self:center;text-align:center}.guardian{height:208px;display:flex;align-items:center;justify-content:center;margin-bottom:24px}.guardian img{display:block;width:212px;height:208px;object-fit:contain}h1{margin:0 0 10px;font-size:24px;line-height:1.5;font-weight:600;letter-spacing:-.6px}.description{margin:0;color:#747b8c;font-size:14px;line-height:1.8;text-wrap:pretty}form{margin-top:30px;text-align:left}.password-field{position:relative}input{display:block;width:100%;height:48px;padding:0 48px 0 14px;border:1px solid #dce0e9;border-radius:9px;background:#fff;color:#1a1d24;font:inherit;font-size:16px;outline:0;box-shadow:none}input::placeholder{color:#a1a6b3;font-size:14px}input:focus{border-color:#6b63ed}input[aria-invalid=true]{border-color:#cf5361}.visibility{position:absolute;right:5px;top:5px;display:grid;place-items:center;width:38px;height:38px;padding:0;border:0;border-radius:6px;background:transparent;color:#83899a;cursor:pointer}.visibility[aria-pressed=true]{color:#635bea}.error{margin:8px 0 0;color:#b64050;font-size:12px}.submit{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:46px;margin-top:14px;border:1px solid #635bea;border-radius:9px;background:#635bea;color:white;font:inherit;font-weight:500;cursor:pointer}.submit:disabled{cursor:wait;opacity:.75}.submit svg{flex-shrink:0}.contact{margin:20px 0 0;color:#8a90a0;font-size:12px}button:focus-visible{outline:2px solid #635bea;outline-offset:3px}.state-note{margin-top:24px;padding-top:20px;border-top:1px solid #e6e8ef;font-size:13px;color:#83899a}@media(hover:hover) and (pointer:fine){.submit:hover:not(:disabled){background:#554cdd}.visibility:hover{background:#f3f3fc}}@media(max-width:600px){header{padding:22px 24px}header img{width:100px}main{margin:16px auto 24px}.guardian{height:184px;margin-bottom:22px}.guardian img{height:184px;width:188px}h1{font-size:22px}}@media(max-height:650px){main{margin:8px auto 20px}.guardian{height:140px;margin-bottom:16px}.guardian img{height:140px;width:148px}header{padding-top:18px;padding-bottom:18px}form{margin-top:22px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style></head><body data-state="${state}">
<header><img src="${asset('prota-logo-light.svg', 'image/svg+xml')}" alt="Prota" width="110" height="31"><span>链接分享</span></header>
<main><div class="guardian"><img src="${mascot}" alt="${wrong ? 'Prota 小狗提示密码错误' : expired || !form || paused ? 'Prota 小狗休息中' : 'Prota 小狗守护分享'}" width="212" height="208"></div>
${locked ? '' : `<h1>${title}</h1>`}<p class="description" id="shareDescription">${escape(description)}</p>
${form ? `<form method="post"><div class="password-field"><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128" placeholder="输入分享者提供的密码" aria-label="访问密码" aria-describedby="${wrong ? 'passwordError' : 'shareDescription'}"${wrong ? ' aria-invalid="true"' : ''}><button class="visibility" type="button" aria-label="显示密码" aria-pressed="false">${eye}</button></div>${wrong ? '<p class="error" id="passwordError" role="alert">密码不正确，请重试。</p>' : ''}<button class="submit" type="submit"><span>查看分享</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button></form><p class="contact">没有密码？请联系分享者获取。</p>` : '<p class="state-note">请联系分享者，获取新的访问链接。</p>'}
</main>
${form ? `<script>
const form=document.querySelector('form'),field=document.querySelector('#password'),visibility=document.querySelector('.visibility');
visibility.addEventListener('click',()=>{const visible=field.type==='password';field.type=visible?'text':'password';visibility.setAttribute('aria-pressed',String(visible));visibility.setAttribute('aria-label',visible?'隐藏密码':'显示密码');});
form.addEventListener('submit',()=>{const button=form.querySelector('.submit');button.disabled=true;button.querySelector('span').textContent='正在验证…';form.setAttribute('aria-busy','true');});
window.addEventListener('pageshow',()=>{const button=form.querySelector('.submit');button.disabled=false;button.querySelector('span').textContent='查看分享';form.removeAttribute('aria-busy');});
</script>` : ''}</body></html>`;
}
