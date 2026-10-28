// Host-only transitions. No script or animation is added to generated documents.
export async function prepareFrame(current, url, { valid = () => true, commit, timeoutMs = 8000 } = {}) {
    const next = current.cloneNode(false);
    next.removeAttribute('id'); next.classList.add('prota-preview-buffer');
    Object.assign(next.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0', opacity: '0', pointerEvents: 'none' });
    next.setAttribute('aria-hidden', 'true');
    let timer;
    const loaded = new Promise(resolve => {
        timer = setTimeout(() => resolve(false), timeoutMs);
        next.onload = () => {
            try {
                const doc = next.contentDocument;
                const body = doc?.body;
                const meaningful = body && (body.innerText.trim() || body.querySelector('img,svg,canvas,iframe,video,input,button') || [...body.children].some(el => el.getBoundingClientRect().height > 0 && getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'));
                resolve(Boolean(meaningful) && !doc.querySelector('parsererror'));
            } catch { resolve(false); }
        };
        next.onerror = () => resolve(false);
    });
    current.parentElement.append(next); next.src = url;
    const ok = await loaded; clearTimeout(timer); next.onload = next.onerror = null;
    if (!ok || !valid() || !current.isConnected) { next.remove(); return false; }
    const scroll = (() => { try { return [current.contentWindow.scrollX, current.contentWindow.scrollY]; } catch { return [0, 0]; } })();
    current.removeAttribute('id'); next.id = 'mainIframe';
    next.removeAttribute('aria-hidden'); next.style.pointerEvents = 'auto'; current.style.pointerEvents = 'none';
    commit(next);
    try { next.contentWindow.scrollTo(...scroll); } catch {}
    const animation = next.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180, fill: 'forwards' });
    if (animation) await animation.finished.catch(() => {});
    current.remove(); animation?.cancel(); next.removeAttribute('style'); next.classList.remove('prota-preview-buffer');
    return true;
}

export async function replaceStyles(frame, url, valid = () => true) {
    let doc; try { doc = frame.contentDocument; } catch { return false; }
    const links = [...(doc?.querySelectorAll('link[rel="stylesheet"][href]') || [])];
    if (!links.length) return false;
    const copies = []; const timers = [];
    try {
        const loaded = await Promise.all(links.map(link => new Promise(resolve => {
            const old = new URL(link.href), base = new URL(frame.src);
            if (old.origin !== base.origin || !old.pathname.startsWith(base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1))) { resolve(true); return; }
            const relative = old.pathname.slice(base.pathname.lastIndexOf('/') + 1);
            const next = link.cloneNode(); next.media = 'not all';
            next.href = new URL(relative, new URL(url, location.href)).href;
            copies.push([link, next]);
            timers.push(setTimeout(() => resolve(false), 4000));
            next.onload = () => resolve(true); next.onerror = () => resolve(false); link.after(next);
        })));
        if (!loaded.every(Boolean) || !copies.length || !valid()) return false;
        copies.forEach(([old, next]) => { next.onload = next.onerror = null; next.media = old.media; old.remove(); });
        return true;
    } finally {
        timers.forEach(clearTimeout);
        copies.forEach(([old, next]) => { if (old.isConnected) next.remove(); });
    }
}
