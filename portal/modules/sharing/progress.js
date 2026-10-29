import { removeShareSurface } from './surface.js';
const svg = paths => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">${paths}</svg>`;
const close = svg('<path d="m6 6 12 12M18 6 6 18"/>');
const spinner = '<svg class="share-status-spinner" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-opacity=".22" stroke-width="1.5"/><path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const check = svg('<path d="m5 12 4 4L19 6"/>');

/** A small top-centered toast; no backdrop, focus trap, or page-sized click surface. */
export function showShareProgress(name, isStatic, { surface } = {}) {
    const previousFocus = document.activeElement;
    const panel = surface || document.createElement('dialog');
    if (!surface) removeShareSurface(document.querySelector('.share-flow'));
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
    panel.className = 'share-access-dialog share-flow share-progress';
    panel.removeAttribute('aria-labelledby');
    panel.setAttribute('aria-label', '链接分享');
    panel.dataset.state = 'publishing';
    panel.innerHTML = `<div class="share-status-row">
        <span class="share-status-symbol" aria-hidden="true">${spinner}</span>
        <button type="button" class="share-status-action" data-status disabled><span data-label role="status" aria-live="polite">分享中</span></button>
        <span data-elapsed></span>
        <a data-open target="_blank" rel="noopener noreferrer" hidden>打开</a>
        <button type="button" class="share-access-icon" data-dismiss aria-label="关闭分享进度" hidden>${close}</button>
    </div>
    <p class="share-flow-error" role="alert" hidden></p>
    <textarea class="share-copy-fallback" readonly aria-label="手动复制分享信息" hidden></textarea>`;
    const status = panel.querySelector('[data-status]');
    const label = panel.querySelector('[data-label]');
    const elapsed = panel.querySelector('[data-elapsed]');
    const dismissButton = panel.querySelector('[data-dismiss]');
    const started = Date.now();
    let finished = false;
    const tick = () => {
        const seconds = Math.floor((Date.now() - started) / 1000);
        elapsed.textContent = seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
    };
    const timer = setInterval(tick, 1000);
    let dismissTimer;
    const dismiss = () => { clearTimeout(dismissTimer); panel.close(); removeShareSurface(panel); };
    const scheduleDismiss = (delay = 4000) => {
        clearTimeout(dismissTimer);
        dismissTimer = setTimeout(() => {
            if (!panel.isConnected) return;
            if (panel.matches(':hover') || panel.contains(document.activeElement)) scheduleDismiss(1000);
            else dismiss();
        }, delay);
    };
    dismissButton.onclick = dismiss;
    panel.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !finished) return;
        event.preventDefault();
        dismiss();
    });
    if (!surface) {
        document.body.append(panel);
        panel.show();
        if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true });
        else if (panel.contains(document.activeElement)) document.activeElement.blur();
    }
    tick();
    return {
        // Copying draft text is not completion. Keep the pending line unchanged until publication succeeds.
        update() {},
        finish({ error, url, copied, text, copy, retry } = {}) {
            if (finished) return;
            finished = true;
            clearInterval(timer);
            panel.dataset.state = error ? 'error' : 'success';
            elapsed.hidden = true;
            status.disabled = false;
            label.textContent = error ? '分享失败' : copied ? '已复制' : '复制链接';
            panel.querySelectorAll('.share-status-symbol').forEach(symbol => { symbol.innerHTML = error ? '' : check; });
            dismissButton.hidden = false;
            if (error) {
                const detail = panel.querySelector('.share-flow-error');
                detail.textContent = error;
                status.title = '查看失败原因';
                status.setAttribute('aria-label', '查看失败原因');
                status.setAttribute('aria-expanded', 'false');
                status.onclick = () => { detail.hidden = !detail.hidden; status.setAttribute('aria-expanded', String(!detail.hidden)); };
                if (retry) {
                    const retryButton = document.createElement('button');
                    retryButton.className = 'share-status-action';
                    retryButton.textContent = '重试';
                    retryButton.onclick = () => retry();
                    dismissButton.before(retryButton);
                }
            } else {
                const link = panel.querySelector('[data-open]');
                link.hidden = false;
                link.href = url;
                // Open only the published result; keep the editor available in its current tab.
                if (url) window.open(url, '_blank', 'noopener,noreferrer');
                status.setAttribute('aria-label', '复制分享信息');
                status.title = '再次复制分享信息';
                if (copied) scheduleDismiss();
                status.onclick = async () => {
                    status.disabled = true;
                    try {
                        if (!await copy?.(text || url)) throw Error('copy failed');
                        label.textContent = '已复制';
                        scheduleDismiss();
                        panel.querySelector('.share-copy-fallback').hidden = true;
                    } catch {
                        clearTimeout(dismissTimer);
                        label.textContent = '复制失败';
                        const fallback = panel.querySelector('.share-copy-fallback');
                        fallback.value = text || url;
                        fallback.hidden = false;
                    } finally { status.disabled = false; }
                };
            }
        }
    };
}
