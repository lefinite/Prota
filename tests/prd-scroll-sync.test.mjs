import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { PRDScrollSync } from '../portal/modules/prd/scroll-sync.js';

globalThis.window = {
    getComputedStyle: () => ({ lineHeight: '20px', fontSize: '13px' })
};

class FakeScroller extends EventTarget {
    constructor(properties = {}) {
        super();
        Object.assign(this, properties);
    }
}

function createFixture() {
    const manager = { host: { prdEditorLayout: 'split' } };
    const sync = new PRDScrollSync(manager);
    const textarea = new FakeScroller({
        value: Array.from({ length: 100 }, (_, index) => `line ${index}`).join('\n'),
        scrollTop: 600,
        scrollHeight: 2000,
        clientHeight: 200,
        focus(options) {
            this.focusOptions = options;
        },
        setSelectionRange(start, end) {
            this.selectionStart = start;
            this.selectionEnd = end;
        },
        scrollTo({ top }) {
            this.scrollTop = top;
            this.dispatchEvent(new Event('scroll'));
        }
    });
    const preview = new FakeScroller({
        scrollTop: 0,
        scrollHeight: 3000,
        clientHeight: 400,
        getBoundingClientRect: () => ({ top: 0, height: 400 })
    });
    const anchors = [
        { line: 20, top: 450, height: 100 },
        { line: 40, top: 1400, height: 200 },
        { line: 80, top: 2450, height: 100 }
    ];
    preview.querySelectorAll = () => anchors.map((anchor) => ({
        getAttribute: () => String(anchor.line),
        getBoundingClientRect: () => ({
            top: anchor.top - preview.scrollTop,
            height: anchor.height
        })
    }));

    return { manager, sync, textarea, preview };
}

test('双栏滚动以两侧视口中线对应的内容为锚点', () => {
    const { sync, textarea, preview } = createFixture();

    assert.equal(sync.getSourceCenterLine(textarea), 34.5);
    sync.syncFromSource(textarea, preview);
    assert.equal(preview.scrollTop, 1025);

    sync._isSyncing = false;
    sync._syncTarget = null;
    sync.syncFromPreview(textarea, preview);
    assert.ok(Math.abs(textarea.scrollTop - 600) < 0.001);
});

test('顶部和底部仍保持两栏边界一致', () => {
    const { sync, textarea, preview } = createFixture();

    textarea.scrollTop = 0;
    sync.syncFromSource(textarea, preview);
    assert.equal(preview.scrollTop, 0);

    sync._isSyncing = false;
    textarea.scrollTop = textarea.scrollHeight - textarea.clientHeight;
    sync.syncFromSource(textarea, preview);
    assert.equal(preview.scrollTop, preview.scrollHeight - preview.clientHeight);
});

test('用户操作跟随栏时可立即接管滚动', () => {
    const { sync, textarea, preview } = createFixture();
    const container = {
        querySelector: (selector) => selector === '[data-prd-editor]' ? textarea : preview
    };
    preview.querySelector = () => null;
    sync.bindEvents(container);

    sync.withSyncLock('preview', () => {});
    assert.equal(sync._isSyncing, true);
    preview.dispatchEvent(new Event('pointerdown'));

    assert.equal(sync._isSyncing, false);
    assert.equal(sync._activeScrollPane, 'preview');
    sync._cleanup?.();
});

test('光标和选区变化不参与预览区定位', () => {
    const controllerSource = readFileSync(
        new URL('../portal/modules/prd/index.js', import.meta.url),
        'utf8'
    );

    assert.doesNotMatch(controllerSource, /syncFromActiveSourceLine|syncPreviewToActiveSourceLine|handleSourcePositionChange/);
    assert.match(controllerSource, /this\.scrollSync\.refreshPreview\(textarea, preview, \(\) =>/);
});

test('重建预览产生的滚动和延迟布局滚动不会移动源码栏', () => {
    const { sync, textarea, preview } = createFixture();
    sync.bindEvents({
        querySelector: (selector) => selector === '[data-prd-editor]' ? textarea : preview
    });
    preview.dispatchEvent(new Event('pointerdown'));
    sync.refreshPreview(textarea, preview, () => {
        preview.scrollTop = 0;
        preview.dispatchEvent(new Event('scroll'));
    });
    assert.equal(textarea.scrollTop, 600);
    assert.equal(preview.scrollTop, 1025);

    // Simulate an image load or scroll anchoring after the temporary lock expires.
    sync._isSyncing = false;
    preview.scrollTop = 0;
    preview.dispatchEvent(new Event('scroll'));
    assert.equal(textarea.scrollTop, 600);

    // Explicit scrolling of the preview still drives source.
    preview.dispatchEvent(new Event('wheel'));
    preview.dispatchEvent(new Event('scroll'));
    assert.equal(textarea.scrollTop, 0);
    sync._cleanup?.();
});

test('双击预览定位时，目标已可见则两栏都不滚动', () => {
    const { sync, textarea, preview } = createFixture();
    preview.scrollTop = 1025;
    preview.querySelector = () => null;
    sync.bindEvents({
        querySelector: (selector) => selector === '[data-prd-editor]' ? textarea : preview
    });

    sync.scrollToSourceLine(textarea, 35);

    assert.equal(textarea.scrollTop, 600);
    assert.equal(preview.scrollTop, 1025);
    assert.deepEqual(textarea.focusOptions, { preventScroll: true });
    sync._cleanup?.();
});

test('双击预览定位时，目标不可见则仅最小幅度滚动源码栏', () => {
    const { sync, textarea, preview } = createFixture();
    preview.scrollTop = 1025;
    preview.querySelector = () => null;
    sync.bindEvents({
        querySelector: (selector) => selector === '[data-prd-editor]' ? textarea : preview
    });

    sync.scrollToSourceLine(textarea, 50);

    assert.equal(textarea.scrollTop, 820);
    assert.equal(preview.scrollTop, 1025);
    sync._cleanup?.();
});
