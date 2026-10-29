import { removeShareSurface } from './surface.js';
/** Access options are transient: plaintext passwords are never saved in browser storage. */
let activeRequest = null;
const icon = paths => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const eye = icon('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>');
const eyeOff = icon('<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A12 12 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 3.8M6.2 6.2A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.1-1.1"/>');

export function requestShareOptions(name = '当前页面') {
    // Rapid clicks must never stack modal dialogs or leave a promise unresolved.
    if (!activeRequest) activeRequest = openShareOptions(name).finally(() => { activeRequest = null; });
    return activeRequest;
}

function generatePassword() {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    return Array.from(crypto.getRandomValues(new Uint8Array(4)), value => alphabet[value & 31]).join('');
}

function openShareOptions(name) {
    return new Promise(resolve => {
        const previousFocus = document.activeElement;
        const dialog = document.createElement('dialog');
        removeShareSurface(document.querySelector('.share-flow'));
        dialog.className = 'share-access-dialog';
        dialog.contentEditable = 'false';
        dialog.setAttribute('aria-labelledby', 'shareAccessTitle');
        dialog.innerHTML = `<form novalidate>
            <header class="share-access-heading">
                <div class="share-access-title"><span class="share-access-emblem">${icon('<path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>')}</span><div><h2 id="shareAccessTitle">链接分享</h2></div></div>
                <button class="share-access-icon" type="button" data-cancel aria-label="关闭">${icon('<path d="m6 6 12 12M18 6 6 18"/>')}</button>
            </header>
            <div class="share-access-body">
                <fieldset class="share-access-expiry">
                    <legend>链接有效期</legend>
                    <div class="share-access-options">
                        ${[[1, '1 天'], [7, '7 天'], [30, '30 天'], [0, '永久有效']].map(([value, label]) => `<label><input type="radio" name="expiry" value="${value}" ${value === 30 ? 'checked' : ''}><span>${label}</span></label>`).join('')}
                    </div>
                    <p class="share-access-hint">到期后，原型、文档和下载包将无法访问。</p>
                </fieldset>
                <section class="share-access-security">
                    <div class="share-access-security-row">
                        <label for="shareProtection"><strong>设置访问密码</strong><span>仅知道密码的人可访问</span></label>
                        <input id="shareProtection" class="share-access-switch" type="checkbox" role="switch" name="protected" aria-controls="sharePasswordFields" aria-expanded="false">
                    </div>
                    <div id="sharePasswordFields" data-password hidden>
                        <label for="sharePassword">访问密码</label>
                        <div class="share-access-password-input">
                            <input id="sharePassword" name="password" type="password" minlength="4" maxlength="128" autocomplete="new-password" placeholder="输入 4–128 个字符" aria-describedby="sharePasswordError">
                            <button class="share-access-icon" type="button" data-visible aria-label="显示密码" aria-pressed="false">${eye}</button>
                        </div>
                        <p class="share-access-error" id="sharePasswordError" role="alert" hidden></p>
                        <p class="share-access-hint">复制时会包含访问密码，可一次性发送给接收者。</p>
                    </div>
                </section>
            </div>
            <footer class="share-access-actions"><button type="button" data-cancel>取消</button><button type="submit">创建分享链接</button></footer>
        </form>`;
        const form = dialog.querySelector('form');
        const password = form.elements.password;
        const protection = form.elements.protected;
        const visibility = dialog.querySelector('[data-visible]');
        const error = dialog.querySelector('.share-access-error');
        let settled = false;
        const done = value => {
            if (settled) return;
            settled = true;
            if (dialog.open) dialog.close();
            removeShareSurface(dialog);
            if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
            resolve(value);
        };
        const clearError = () => { error.hidden = true; error.textContent = ''; password.removeAttribute('aria-invalid'); };
        dialog.querySelectorAll('[data-cancel]').forEach(button => button.onclick = () => done(null));
        dialog.addEventListener('cancel', event => { event.preventDefault(); done(null); });
        dialog.addEventListener('close', () => done(null));
        const outside = event => {
            const bounds = dialog.getBoundingClientRect();
            return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
        };
        let pressedBackdrop = false;
        dialog.addEventListener('pointerdown', event => { pressedBackdrop = event.target === dialog && outside(event); });
        dialog.addEventListener('click', event => { if (pressedBackdrop && event.target === dialog && outside(event)) done(null); pressedBackdrop = false; });
        protection.onchange = () => {
            const enabled = protection.checked;
            dialog.querySelector('[data-password]').hidden = !enabled;
            protection.setAttribute('aria-expanded', String(enabled));
            password.required = enabled;
            password.disabled = !enabled;
            clearError();
            if (enabled) {
                password.value = generatePassword();
                password.focus();
                password.select();
            }
            else {
                password.value = '';
                password.type = 'password';
                visibility.setAttribute('aria-label', '显示密码');
                visibility.setAttribute('aria-pressed', 'false');
                visibility.innerHTML = eye;
            }
        };
        password.disabled = true;
        password.oninput = clearError;
        visibility.onclick = () => {
            const show = password.type === 'password';
            password.type = show ? 'text' : 'password';
            visibility.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
            visibility.setAttribute('aria-pressed', String(show));
            visibility.innerHTML = show ? eyeOff : eye;
        };
        form.onsubmit = event => {
            event.preventDefault();
            if (protection.checked && ([...password.value].length < 4 || [...password.value].length > 128)) {
                error.textContent = password.value ? '密码需要 4–128 个字符，请调整后重试。' : '请输入访问密码，或关闭密码保护。';
                error.hidden = false;
                password.setAttribute('aria-invalid', 'true');
                password.focus();
                return;
            }
            done({ expiresInDays: Number(form.elements.expiry.value), password: protection.checked ? password.value : '' });
        };
        document.body.append(dialog);
        dialog.showModal();
        form.querySelector('input[name=expiry]:checked').focus({ preventScroll: true });
    });
}
