// A focused native dialog: keyboard navigation and focus restoration are provided
// by the browser. All model/history text is inserted as text, never HTML.
export function requestPiChoice({ title, description = '', items = [], value = false, confirmLabel = '确定' }) {
    return new Promise(resolve => {
        const previous = document.activeElement;
        const dialog = document.createElement('dialog');
        dialog.className = 'pi-session-dialog';
        Object.assign(dialog.style, { width: 'min(680px, calc(100vw - 40px))', maxHeight: '80vh', padding: '24px',
            border: '1px solid var(--border, #ddd)', borderRadius: '16px', background: 'var(--bg, #fff)', color: 'var(--text, #222)' });
        const heading = document.createElement('h2'); heading.textContent = title;
        const detail = document.createElement('p'); detail.textContent = description; detail.style.whiteSpace = 'pre-wrap';
        const form = document.createElement('form'); form.method = 'dialog';
        form.style.cssText = 'display:grid;gap:12px';
        const field = document.createElement(value ? 'input' : 'select');
        field.setAttribute('aria-label', title);
        field.style.cssText = 'font:inherit;width:100%;box-sizing:border-box;padding:12px;min-height:44px';
        if (value) field.value = typeof value === 'string' ? value : '';
        else {
            field.size = Math.min(12, Math.max(2, items.length));
            for (const item of items) {
                const option = document.createElement('option');
                option.value = item.value; option.textContent = item.label;
                option.disabled = Boolean(item.disabled); field.append(option);
            }
            const first = [...field.options].find(option => !option.disabled);
            if (first) field.value = first.value;
        }
        const actions = document.createElement('div'); actions.style.cssText = 'display:flex;justify-content:flex-end;gap:12px';
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '取消';
        const accept = document.createElement('button'); accept.type = 'submit'; accept.textContent = confirmLabel;
        accept.disabled = !value && !items.some(item => !item.disabled);
        for (const button of [cancel, accept]) button.style.cssText = 'font:inherit;padding:9px 18px;cursor:pointer';
        actions.append(cancel, accept); form.append(field, actions); dialog.append(heading, detail, form);
        let result = null;
        cancel.onclick = () => dialog.close();
        form.onsubmit = event => { event.preventDefault(); result = field.value; dialog.close(); };
        dialog.addEventListener('close', () => { dialog.remove(); previous?.focus(); resolve(result); }, { once: true });
        document.body.append(dialog); dialog.showModal(); field.focus();
    });
}

export function flattenPiTree(tree, leafId, selectable) {
    const rows = [];
    const visit = (nodes, depth) => {
        for (const { entry, children = [] } of nodes) {
            const message = entry.message;
            const text = typeof message?.content === 'string' ? message.content : (message?.content || []).map(block => block.text || block.thinking || '').join(' ');
            rows.push({ value: entry.id, disabled: !selectable.has(entry.id),
                label: `${'　'.repeat(Math.min(depth, 8))}${entry.id === leafId ? '● ' : ''}${message?.role || entry.type} · ${text.replace(/\s+/g, ' ').slice(0, 130) || entry.id}` });
            visit(children, depth + 1);
        }
    };
    visit(tree, 0);
    return rows;
}
