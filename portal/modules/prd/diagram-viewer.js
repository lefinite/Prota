let viewerSequence = 0;

export function openDiagramViewer(svgMarkup) {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    const titleId = `prd-diagram-viewer-title-${++viewerSequence}`;
    dialog.className = 'prd-diagram-viewer';
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.innerHTML = `<header class="prd-diagram-viewer__header">
        <h2 id="${titleId}">流程图</h2>
        <div class="prd-diagram-viewer__controls">
            <button type="button" data-zoom-out aria-label="缩小">−</button>
            <output data-zoom-level aria-live="polite">100%</output>
            <button type="button" data-zoom-in aria-label="放大">＋</button>
            <button type="button" data-fit>显示全图</button>
            <button type="button" data-close aria-label="关闭大图">关闭</button>
        </div>
    </header><div class="prd-diagram-viewer__viewport" tabindex="0" aria-label="流程图画布，可拖动，滚轮缩放">
        <div class="prd-diagram-viewer__content">${svgMarkup}</div>
    </div><p class="prd-diagram-viewer__help">拖动画布移动 · 滚轮或按钮缩放 · Esc 关闭</p>`;
    document.body.appendChild(dialog);
    const viewport = dialog.querySelector('.prd-diagram-viewer__viewport');
    const content = dialog.querySelector('.prd-diagram-viewer__content');
    const svg = content.querySelector('svg');
    const bounds = svg.viewBox.baseVal;
    const width = bounds.width || 800, height = bounds.height || 600;
    content.style.width = `${width}px`;
    content.style.height = `${height}px`;
    svg.style.cssText = 'display:block;width:100%;height:100%;max-width:none;';
    let scale = 1, fittedScale = 1, x = 0, y = 0, drag = null;
    const paint = () => {
        content.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        dialog.querySelector('[data-zoom-level]').textContent = `${Math.round(scale * 100)}%`;
    };
    const fit = () => {
        scale = Math.min(Math.max(1, viewport.clientWidth - 48) / width, Math.max(1, viewport.clientHeight - 48) / height);
        scale = Math.min(4, scale);
        fittedScale = scale;
        x = (viewport.clientWidth - width * scale) / 2;
        y = (viewport.clientHeight - height * scale) / 2;
        paint();
    };
    const zoom = (factor, anchorX = viewport.clientWidth / 2, anchorY = viewport.clientHeight / 2) => {
        const next = Math.max(Math.min(0.02, fittedScale / 4), Math.min(8, scale * factor));
        x = anchorX - (anchorX - x) * next / scale;
        y = anchorY - (anchorY - y) * next / scale;
        scale = next;
        paint();
    };
    dialog.querySelector('[data-zoom-in]').addEventListener('click', () => zoom(1.25));
    dialog.querySelector('[data-zoom-out]').addEventListener('click', () => zoom(0.8));
    dialog.querySelector('[data-fit]').addEventListener('click', fit);
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    viewport.addEventListener('wheel', (event) => {
        event.preventDefault();
        const rect = viewport.getBoundingClientRect();
        zoom(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });
    viewport.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        drag = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x, y };
        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add('is-dragging');
    });
    viewport.addEventListener('pointermove', (event) => {
        if (drag?.id !== event.pointerId) return;
        x = drag.x + event.clientX - drag.clientX;
        y = drag.y + event.clientY - drag.clientY;
        paint();
    });
    const endDrag = () => { drag = null; viewport.classList.remove('is-dragging'); };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('lostpointercapture', endDrag);
    window.addEventListener('blur', endDrag);
    dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    dialog.addEventListener('close', () => {
        observer.disconnect();
        window.removeEventListener('blur', endDrag);
        dialog.remove();
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }, { once: true });
    dialog.showModal();
    fit();
    dialog.querySelector('[data-close]').focus({ preventScroll: true });
    return dialog;
}
