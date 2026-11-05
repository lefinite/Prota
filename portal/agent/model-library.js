const check = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8 3 3 6-6"/></svg>';

// One stable list: select the models that appear in the chat model switcher.
export class ModelLibrary {
    constructor(host, { escape, onChange, onFetch, allowCustom = false }) {
        this.host = host;
        this.escape = value => escape(String(value ?? ''));
        this.onChange = onChange;
        this.onFetch = onFetch;
        this.catalog = []; this.selected = []; this.disabled = false;
        this.query = '';
        host.classList.add('model-library');
        host.innerHTML = `<div class="model-library__heading"><h4>可用模型 <span data-model-count></span></h4>${onFetch ? '<button type="button" class="model-library__fetch" data-model-fetch>更新列表</button>' : ''}</div><div class="model-library__list"><label class="model-library__search" data-model-search hidden><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg><input type="search" data-model-filter placeholder="查找模型" aria-label="查找模型" autocomplete="off"></label><div class="model-library__catalog" data-model-catalog role="group" aria-label="选择在聊天中使用的模型"></div></div>${allowCustom ? '<details class="model-library__manual"><summary>手动添加模型</summary><form class="model-library__custom" data-model-custom><input type="text" name="modelId" placeholder="输入模型 ID" aria-label="自定义模型 ID" autocomplete="off" spellcheck="false"><button type="submit">添加</button></form></details>' : ''}<div class="model-library__feedback" data-model-feedback role="status" aria-live="polite"></div>`;
        this.catalogHost = host.querySelector('[data-model-catalog]');
        this.search = host.querySelector('[data-model-filter]');
        host.addEventListener('click', event => {
            const target = event.target.closest('button');
            if (!target || target.disabled) return;
            if (target.hasAttribute('data-model-id')) {
                const id = target.dataset.modelId;
                this.change(this.selected.includes(id) ? this.selected.filter(value => value !== id) : [...this.selected, id]);
            }
            if (target.hasAttribute('data-model-fetch')) this.fetch();
        });
        this.search.addEventListener('input', () => { this.query = this.search.value; this.feedback(''); this.renderCatalog(); });
        host.addEventListener('keydown', event => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            const items = [...(!this.search.closest('[hidden]') ? [this.search] : []), ...this.catalogHost.querySelectorAll('button:not(:disabled)')];
            const index = items.indexOf(event.target);
            if (index < 0 || event.target === this.search && !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
        });
        host.querySelector('[data-model-custom]')?.addEventListener('submit', event => {
            event.preventDefault(); event.stopPropagation();
            const input = event.target.elements.modelId, id = input.value.trim();
            if (!id || this.disabled) { input.focus(); return; }
            if (!this.catalog.some(model => model.id === id)) this.catalog.push({ id, name: id });
            if (!this.selected.includes(id)) this.change([...this.selected, id]);
            else this.feedback('这个模型已经选中');
            input.value = '';
            this.query = ''; this.search.value = ''; this.render();
            const row = [...this.catalogHost.querySelectorAll('[data-model-id]')].find(row => row.dataset.modelId === id);
            row?.focus();
        });
    }
    update({ key, catalog, selected, disabled = false, emptyMessage = '还没有模型列表' }) {
        const changedProvider = this.key !== key;
        if (changedProvider) {
            this.key = key; this.query = ''; this.search.value = '';
            const manual = this.host.querySelector('details');
            if (manual) manual.open = false;
        }
        const byId = new Map(catalog.map(model => [model.id, model]));
        const order = changedProvider ? [...selected, ...byId.keys()] : [...this.catalog.map(model => model.id), ...byId.keys()];
        this.catalog = [...new Set(order)].map(id => byId.get(id)).filter(Boolean);
        this.selected = [...new Set(selected)];
        this.disabled = disabled;
        this.emptyMessage = emptyMessage;
        this.render();
    }
    change(ids) {
        if (this.disabled) return;
        this.selected = [...new Set(ids)];
        this.onChange(this.selected, this.catalog);
        this.render();
        this.feedback(`已选择 ${this.selected.length} 个模型`);
    }
    setDisabled(disabled) {
        if (this.disabled === disabled) return;
        this.disabled = disabled;
        this.render();
    }
    feedback(message) { this.host.querySelector('[data-model-feedback]').textContent = message; }
    async fetch() {
        if (this.fetching || this.disabled) return;
        const button = this.host.querySelector('[data-model-fetch]');
        this.fetching = true; button.disabled = true; button.textContent = '更新中…';
        try { await this.onFetch(); }
        finally { this.fetching = false; button.disabled = this.disabled; button.textContent = '更新列表'; }
    }
    render() {
        this.host.querySelector('[data-model-count]').textContent = `已选 ${this.selected.length}`;
        this.host.querySelector('[data-model-search]').hidden = this.catalog.length <= 8 && !this.query;
        this.host.querySelectorAll('[data-model-custom] input, [data-model-custom] button').forEach(node => { node.disabled = this.disabled; });
        const fetch = this.host.querySelector('[data-model-fetch]');
        if (fetch) { fetch.disabled = this.disabled || this.fetching; if (!this.fetching) fetch.textContent = this.catalog.length ? '更新列表' : '获取模型'; }
        this.renderCatalog();
    }
    renderCatalog() {
        const e = this.escape, query = this.query.trim().toLowerCase();
        const visible = this.catalog.filter(model => `${model.name} ${model.id}`.toLowerCase().includes(query));
        const html = visible.map(model => {
            const selected = this.selected.includes(model.id);
            return `<button type="button" role="checkbox" aria-checked="${selected}" class="model-library__option" data-model-id="${e(model.id)}" ${this.disabled || model.unavailable && !selected ? 'disabled' : ''}><span class="model-library__name"><span>${e(model.name || model.id)}</span>${model.name && model.name !== model.id ? `<small>${e(model.id)}</small>` : ''}${model.unavailable ? '<small>暂不可用</small>' : ''}</span><span class="model-library__check" aria-hidden="true">${selected ? check : ''}</span></button>`;
        }).join('') || `<div class="model-library__empty">${query ? '没有找到匹配的模型' : e(this.emptyMessage)}</div>`;
        if (this.catalogHost._content !== html) {
            const focusId = this.catalogHost.contains(document.activeElement) ? document.activeElement.dataset.modelId : null;
            const scroll = this.catalogHost.scrollTop;
            this.catalogHost._content = html; this.catalogHost.innerHTML = html;
            this.catalogHost.scrollTop = scroll;
            if (focusId) [...this.catalogHost.querySelectorAll('[data-model-id]')].find(row => row.dataset.modelId === focusId)?.focus({ preventScroll: true });
        }
    }
}
