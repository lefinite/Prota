// Navigation width and compact scroll indicators are independent of the Agent panel.
export function initSidebarLayout(shell) {
    const sidebar = shell.sidebar;
    if (!sidebar || sidebar.querySelector('.sidebar-resize-handle')) return;
    const storageKey = 'prota:sidebar-width';
    const minWidth = 180;
    const defaultWidth = 220;
    const maxWidth = () => Math.max(minWidth, Math.min(360, window.innerWidth - 440));
    let preferredWidth = defaultWidth;
    try {
        const saved = Number(localStorage.getItem(storageKey));
        if (Number.isFinite(saved) && saved >= minWidth) preferredWidth = saved;
    } catch {}
    const handle = document.createElement('div');
    handle.className = 'sidebar-resize-handle';
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', '调整侧栏宽度');
    handle.title = '拖动调整宽度，双击恢复默认';
    sidebar.appendChild(handle);
    let width = defaultWidth;
    const apply = (value) => {
        width = Math.round(Math.max(minWidth, Math.min(maxWidth(), value)));
        document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
        handle.setAttribute('aria-valuemin', String(minWidth));
        handle.setAttribute('aria-valuemax', String(maxWidth()));
        handle.setAttribute('aria-valuenow', String(width));
    };
    const save = () => {
        preferredWidth = width;
        try { localStorage.setItem(storageKey, String(width)); } catch {}
    };
    apply(preferredWidth);
    let drag = null;
    const finish = (event) => {
        if (!drag || (event?.pointerId != null && event.pointerId !== drag.pointerId)) return;
        const pointerId = drag.pointerId;
        drag = null;
        document.body.classList.remove('is-resizing-sidebar');
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        save();
        shell.refreshAnnotationUI();
    };
    handle.addEventListener('pointerdown', event => {
        if (event.button !== 0 || shell.agentWorkbenchOpen) return;
        event.preventDefault();
        drag = {x:event.clientX, width, pointerId:event.pointerId};
        handle.setPointerCapture(event.pointerId);
        document.body.classList.add('is-resizing-sidebar');
    });
    handle.addEventListener('pointermove', event => {
        if (drag && drag.pointerId === event.pointerId) apply(drag.width + event.clientX - drag.x);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(type, finish);
    window.addEventListener('blur', () => finish());
    handle.addEventListener('dblclick', () => { apply(defaultWidth); save(); shell.refreshAnnotationUI(); });
    handle.addEventListener('keydown', event => {
        const values = {ArrowLeft:width - (event.shiftKey ? 32 : 8), ArrowRight:width + (event.shiftKey ? 32 : 8), Home:minWidth, End:maxWidth()};
        if (!(event.key in values)) return;
        event.preventDefault(); apply(values[event.key]); save(); shell.refreshAnnotationUI();
    });
    window.addEventListener('resize', () => apply(preferredWidth));

    for (const list of sidebar.querySelectorAll('.page-nav > .nav-section > .nav-list')) {
        initCompactScroll(list, sidebar, () => sidebar.classList.contains('is-agent-open'));
    }
    initSessionSidebarLayout(shell);
}

function initCompactScroll(list, sidebar, isHidden) {
    const track = document.createElement('div');
    track.className = 'sidebar-scroll-track';
    const thumb = document.createElement('div');
    thumb.className = 'sidebar-scroll-thumb';
    // The real list remains the keyboard- and screen-reader-accessible scroller.
    track.setAttribute('aria-hidden', 'true');
    track.appendChild(thumb);
    sidebar.appendChild(track);
    let thumbHeight = 0, travel = 0, scrollRange = 0, scrollDrag = null, raf = 0;
    const update = () => {
        raf = 0;
        const box = list.getBoundingClientRect(), parent = sidebar.getBoundingClientRect();
        scrollRange = list.scrollHeight - list.clientHeight;
        track.hidden = box.height <= 0 || scrollRange <= 1 || isHidden();
        if (track.hidden) return;
        thumbHeight = Math.min(48, Math.max(28, box.height * list.clientHeight / list.scrollHeight));
        travel = Math.max(0, box.height - thumbHeight);
        track.style.top = `${box.top - parent.top}px`;
        track.style.height = `${box.height}px`;
        thumb.style.height = `${thumbHeight}px`;
        thumb.style.transform = `translateY(${Math.min(1, Math.max(0, list.scrollTop / scrollRange)) * travel}px)`;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    list.addEventListener('scroll', schedule, {passive:true});
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(list); resizeObserver.observe(sidebar);
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(list, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class','hidden','style']});
    const sectionObserver = new MutationObserver(schedule);
    sectionObserver.observe(list.parentElement, {attributes:true, attributeFilter:['hidden']});
    sectionObserver.observe(sidebar, {attributes:true, attributeFilter:['class']});
    track.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault(); update();
        if (event.target !== thumb) {
            list.scrollTop = Math.max(0, Math.min(1, (event.clientY - track.getBoundingClientRect().top - thumbHeight / 2) / travel)) * scrollRange;
        }
        scrollDrag = {y:event.clientY, scrollTop:list.scrollTop, pointerId:event.pointerId};
        track.setPointerCapture(event.pointerId); track.classList.add('is-dragging');
    });
    track.addEventListener('pointermove', event => {
        if (!scrollDrag || scrollDrag.pointerId !== event.pointerId || !travel) return;
        list.scrollTop = scrollDrag.scrollTop + (event.clientY - scrollDrag.y) / travel * scrollRange;
    });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) track.addEventListener(type, () => { scrollDrag = null; track.classList.remove('is-dragging'); });
    schedule();
}

function initSessionSidebarLayout(shell) {
    const sidebar = shell.agentWorkbench?.querySelector('.agent-session-sidebar');
    const list = shell.agentSessionList;
    if (!sidebar || !list) return;
    const handle = document.createElement('div');
    handle.className = 'agent-session-resize-handle';
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', '调整会话列表宽度');
    handle.title = '拖动调整宽度，双击与页面列表同宽';
    sidebar.appendChild(handle);
    const defaultWidth = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 220;
    const maxWidth = () => Math.max(180, Math.min(360, shell.agentWorkbench.clientWidth - (shell.agentWorkbench.classList.contains('is-narrow') ? 48 : 320)));
    let preferredWidth = Number(shell.readAgentStorage('session-sidebar-width', 0)) || null;
    let width, drag;
    const apply = value => {
        width = Math.round(Math.max(180, Math.min(maxWidth(), value)));
        document.documentElement.style.setProperty('--agent-session-sidebar-width', `${width}px`);
        handle.setAttribute('aria-valuemin', '180');
        handle.setAttribute('aria-valuemax', String(maxWidth()));
        handle.setAttribute('aria-valuenow', String(width));
    };
    const save = () => { preferredWidth = width; shell.writeAgentStorage('session-sidebar-width', width); };
    const finish = event => {
        if (!drag || (event?.pointerId != null && event.pointerId !== drag.pointerId)) return;
        const pointerId = drag.pointerId;
        drag = null;
        document.body.classList.remove('is-resizing-session-sidebar');
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        save();
    };
    handle.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        drag = {x:event.clientX, width, pointerId:event.pointerId};
        handle.setPointerCapture(event.pointerId);
        document.body.classList.add('is-resizing-session-sidebar');
    });
    handle.addEventListener('pointermove', event => {
        if (drag?.pointerId === event.pointerId) apply(drag.width + event.clientX - drag.x);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(type, finish);
    window.addEventListener('blur', () => finish());
    handle.addEventListener('dblclick', () => {
        preferredWidth = null;
        shell.writeAgentStorage('session-sidebar-width', 0);
        apply(defaultWidth());
    });
    handle.addEventListener('keydown', event => {
        const values = {ArrowLeft:width - (event.shiftKey ? 32 : 8), ArrowRight:width + (event.shiftKey ? 32 : 8), Home:180, End:maxWidth()};
        if (!(event.key in values)) return;
        event.preventDefault(); apply(values[event.key]); save();
    });
    const observer = new ResizeObserver(() => { if (!drag) apply(preferredWidth ?? defaultWidth()); });
    observer.observe(shell.agentWorkbench);
    observer.observe(shell.sidebar);
    apply(preferredWidth ?? defaultWidth());
    initCompactScroll(list, sidebar, () => !sidebar.classList.contains('is-open'));
}
