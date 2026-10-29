/** A separate read-only directory: never reuse the editable workspace tree. */
export function renderShareNavigation(shell) {
    if (!shell.isShareMode || shell.shareConfig.mode !== 'folder') return;
    let aside = document.getElementById('shareNavigation');
    if (!aside) {
        aside = document.createElement('aside');
        aside.id = 'shareNavigation';
        aside.className = 'share-navigation';
        aside.setAttribute('aria-label', '分享页面目录');
        aside.innerHTML = `<button type="button" class="share-navigation__toggle" aria-label="页面目录" aria-expanded="true" aria-controls="shareNavigationPanel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg><span>页面</span>
        </button><div id="shareNavigationPanel" class="share-navigation__panel">
            <header class="share-navigation__header"><span>页面目录</span><div class="share-navigation__actions">
                <button type="button" class="share-navigation__pin" aria-label="固定页面目录" aria-pressed="false" title="固定目录"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l-1 7 4 4v2H5v-2l4-4-1-7Z"/><path d="M12 16v5"/></svg></button>
                <button type="button" class="share-navigation__close" aria-label="收起页面目录" title="收起目录"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
            </div></header>
            <nav aria-label="已分享页面"></nav></div>`;
        const toggle = aside.querySelector('.share-navigation__toggle');
        const panel = aside.querySelector('.share-navigation__panel');
        const pin = aside.querySelector('.share-navigation__pin');
        let pinned = false;
        pin.addEventListener('click', () => {
            pinned = !pinned;
            pin.setAttribute('aria-pressed', String(pinned));
            pin.setAttribute('aria-label', pinned ? '取消固定页面目录' : '固定页面目录');
            pin.title = pinned ? '取消固定目录' : '固定目录';
        });
        const setOpen = (open, restoreFocus = false) => {
            panel.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
            if (open) (panel.querySelector('[aria-current="page"]') || panel.querySelector('button'))?.focus();
            else if (restoreFocus) toggle.focus();
        };
        toggle.addEventListener('click', () => setOpen(panel.hidden, !panel.hidden));
        aside.querySelector('.share-navigation__close').addEventListener('click', () => setOpen(false, true));
        aside.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false, true); }
        });
        document.addEventListener('pointerdown', event => {
            if (!pinned && !panel.hidden && !aside.contains(event.target)) setOpen(false);
        });
        aside.closeDirectory = () => { if (!pinned) setOpen(false, true); };
        document.querySelector('.shell-container').prepend(aside);
        if (shell.pageSelectorTrigger) {
            shell.pageSelectorTrigger.disabled = true;
            shell.pageSelectorTrigger.title = '当前页面';
        }
    }
    const pages = (shell.projects?.pages || []).filter(page => !page.deleted);
    const folders = (shell.getProjectRecord()?.folders || []).filter(folder => !folder.deleted);
    const nav = aside.querySelector('nav');
    const folderOpenStates = new Map([...nav.querySelectorAll('details[data-share-folder]')]
        .map(group => [group.dataset.shareFolder, group.open]));
    const focusedId = nav.contains(document.activeElement) ? document.activeElement.dataset.sharePage : null;
    nav.replaceChildren();
    const visited = new Set();
    const rendered = new Set();
    const addPage = (page, container) => {
        if (rendered.has(page.id)) return;
        rendered.add(page.id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'share-navigation__page';
        button.dataset.sharePage = page.id;
        const slot = document.createElement('span');
        slot.className = 'share-navigation__page-slot';
        slot.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span');
        name.textContent = page.name || page.id;
        button.append(slot, name);
        button.title = page.name || page.id;
        if (page.id === shell.activePageId) button.setAttribute('aria-current', 'page');
        button.addEventListener('click', async () => {
            await shell.switchPage(page.id, page.activeVersion);
            aside.closeDirectory();
        });
        container.append(button);
    };
    const appendChildren = (parentId, container) => {
        const children = [
            ...folders.filter(folder => (folder.parentId || null) === parentId).map(folder => ({ ...folder, folder: true })),
            ...pages.filter(page => (page.parentId || null) === parentId)
        ].sort((a, b) => (a.order - b.order) || String(a.name).localeCompare(String(b.name), 'zh-CN'));
        for (const item of children) {
            if (!item.folder) { addPage(item, container); continue; }
            if (visited.has(item.id)) continue;
            visited.add(item.id);
            const group = document.createElement('details');
            group.className = 'share-navigation__group';
            group.dataset.shareFolder = item.id;
            // Workspace collapse state does not affect recipients: start expanded.
            group.open = folderOpenStates.get(item.id) ?? true;
            const label = document.createElement('summary');
            label.innerHTML = '<svg class="share-navigation__chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 4 4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            const folderName = document.createElement('span');
            folderName.textContent = item.name;
            label.append(folderName);
            group.append(label);
            const children = document.createElement('div');
            children.className = 'share-navigation__children';
            appendChildren(item.id, children);
            group.append(children);
            container.append(group);
        }
    };
    // The shared root may be omitted from the exported folders list.
    const folderIds = new Set(folders.map(folder => folder.id));
    for (const parentId of new Set([null, ...folders.map(f => f.parentId), ...pages.map(p => p.parentId)])) {
        if (!parentId || !folderIds.has(parentId)) appendChildren(parentId || null, nav);
    }
    // Malformed/cyclic folder metadata must not make an authorized page disappear.
    pages.forEach(page => addPage(page, nav));
    if (focusedId) [...nav.querySelectorAll('button')].find(button => button.dataset.sharePage === focusedId)?.focus();
}
