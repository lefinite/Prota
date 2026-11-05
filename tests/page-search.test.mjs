import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesPageSearch, filterPageTree } from '../portal/modules/page-search/index.js';

test('page names support Chinese, pinyin, initials, mixed input and normalization', () => {
    const page = { name: '阅读器设置', id: 'reader-settings' };
    for (const query of ['阅读', '阅读设置', 'YUE DU QI', 'YDQSZ', 'yue读qiSZ', 'yuè dú', 'reader settings', 'ＲＥＡＤＥＲ']) {
        assert.equal(matchesPageSearch(page, query), true, query);
    }
    assert.equal(matchesPageSearch(page, '图书馆'), false);
    assert.equal(matchesPageSearch({ name: '重庆银行' }, 'chongqingyinhang'), true);
    assert.equal(matchesPageSearch({ name: '吕布' }, 'lvbu'), true);
    assert.equal(matchesPageSearch({ name: '吕布' }, 'lǚ bù'), true);
});

test('search preserves only matched pages and their ancestors, keeping source data intact', () => {
    const items = [
        { type: 'folder', id: 'root', depth: 0, folder: { collapsed: true } },
        { type: 'folder', id: 'nested', depth: 1, folder: { collapsed: true } },
        { type: 'page', id: 'reader', depth: 2, page: { name: '阅读器' } },
        { type: 'folder', id: 'other', depth: 1, folder: {} },
        { type: 'page', id: 'library', depth: 2, page: { name: '图书馆' } },
        { type: 'page', id: 'home', depth: 0, page: { name: '首页' } }
    ];
    const original = structuredClone(items);
    assert.deepEqual(filterPageTree(items, 'YD').map(item => item.id), ['root', 'nested', 'reader']);
    assert.deepEqual(filterPageTree(items, 'TSG').map(item => item.id), ['root', 'other', 'library']);
    assert.deepEqual(filterPageTree(items, 'missing'), []);
    assert.equal(filterPageTree(items, '  '), items);
    assert.deepEqual(items, original);
});
