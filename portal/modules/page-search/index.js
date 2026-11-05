import { match } from './vendor/pinyin-match.js';

// Keep names and queries comparable across full-width input, tones and separators.
export function normalizePageSearch(value) {
    return String(value || '').normalize('NFKC').toLowerCase()
        .replace(/u:/g, 'v').replace(/[üǖǘǚǜ]/g, 'v')
        .normalize('NFD').replace(/\p{M}/gu, '')
        .replace(/[\s\p{P}\p{S}]/gu, '');
}

export function matchesPageSearch(page, query) {
    const needle = normalizePageSearch(query);
    if (!needle) return true;
    return [page.name, page.id].some(value => {
        const text = normalizePageSearch(value);
        return text.includes(needle) || match(text, needle, { precision: 'start', v: true }) !== null;
    });
}

// Preserve ordering and ancestor context without changing saved collapse state.
export function filterPageTree(items, query) {
    if (!normalizePageSearch(query)) return items;
    const visible = new Set();
    const ancestors = [];
    for (const item of items) {
        ancestors.length = item.depth;
        if (item.type === 'folder') {
            ancestors[item.depth] = item;
        } else if (matchesPageSearch(item.page, query)) {
            visible.add(item);
            ancestors.forEach(ancestor => visible.add(ancestor));
        }
    }
    return items.filter(item => visible.has(item));
}
