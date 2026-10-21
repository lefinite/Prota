import assert from 'node:assert/strict';
import test from 'node:test';

import { PRDRenderer } from '../portal/modules/prd/renderer.js';

const renderer = new PRDRenderer({
    state: { path: '' },
    host: {}
});

test('Mermaid fences render as diagrams with hidden source rather than visible code', () => {
    const html = renderer.renderMarkdownDocument('## 流程\n```mermaid\nflowchart TD\nA["入口"] --> B["完成"]\n```');
    assert.match(html, /class="prd-mermaid-diagram" data-line="1" data-prd-mermaid/);
    assert.match(html, /<pre hidden data-mermaid-source>/);
    assert.match(html, /data-mermaid-canvas/);
    assert.doesNotMatch(html, /prd-code-block|prd-code-copy-btn/);
});

test('Mermaid source is escaped and ordinary code fences retain their code view', () => {
    assert.doesNotMatch(renderer.renderMarkdownDocument('```mermaid\n<script>alert(1)</script>\n```'), /<script>/);
    assert.match(renderer.renderMarkdownDocument('```js\nconst value = 1;\n```'), /prd-code-block/);
});

test('renders unchecked and checked Markdown task list items as checkboxes', () => {
    const html = renderer.renderMarkdownDocument([
        '- [ ] 新增平台弹窗有「开播自动转推」开关，默认开',
        '- [x] 编辑平台时开关正确回显'
    ].join('\n'));

    assert.match(html, /<li class="prd-task-list-item" data-line="0"><input class="prd-task-list-item__checkbox" data-prd-task-checkbox type="checkbox" aria-label="未完成">/);
    assert.match(html, /<li class="prd-task-list-item" data-line="1"><input class="prd-task-list-item__checkbox" data-prd-task-checkbox type="checkbox" checked aria-label="已完成">/);
    assert.doesNotMatch(html, /&lt;input type=&quot;checkbox&quot;/);
});

test('updates a task marker by source line', () => {
    const source = ['- [ ] first', 'paragraph', '  * [X] nested'].join('\n');

    assert.equal(renderer.setMarkdownTaskChecked(source, 0, true), ['- [x] first', 'paragraph', '  * [X] nested'].join('\n'));
    assert.equal(renderer.setMarkdownTaskChecked(source, 2, false), ['- [ ] first', 'paragraph', '  * [ ] nested'].join('\n'));
    assert.equal(renderer.setMarkdownTaskChecked(source, 1, true), source);
});

test('keeps task checkboxes disabled in share mode', () => {
    const shareRenderer = new PRDRenderer({ state: { path: '' }, host: { isShareMode: true } });
    const html = shareRenderer.renderMarkdownDocument('- [ ] read only');

    assert.match(html, /data-prd-task-checkbox type="checkbox" disabled/);
});

test('keeps task item content escaped while preserving inline Markdown formatting', () => {
    const html = renderer.renderMarkdownDocument('- [X] **完成** <script>alert(1)</script>');

    assert.match(html, /<strong>完成<\/strong>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>/);
});

test('does not treat brackets without a following space as a task item', () => {
    const html = renderer.renderMarkdownDocument('- [ ]not a task');

    assert.doesNotMatch(html, /prd-task-list-item/);
    assert.match(html, /\[ \]not a task/);
});
