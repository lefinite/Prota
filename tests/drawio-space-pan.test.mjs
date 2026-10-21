import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

test('空格绕过隐藏输入框用于平移，文字编辑保留空格，失焦清理状态', async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.setContent(`
            <div class="geDiagramContainer">
                <textarea class="mxTypingShim"></textarea>
                <div contenteditable="true" id="label"></div>
            </div>
            <input id="search">
        `);
        await page.evaluate(() => {
            window.EditorUi = function () {};
            window.EditorUi.prototype.isSpaceDown = function () { return this.spaceDown; };
            window.testUi = new window.EditorUi();
            window.testUi.spaceDown = false;
        });
        await page.addScriptTag({
            path: fileURLToPath(new URL('../portal/modules/drawio/editor-prota.js', import.meta.url))
        });
        const isPanning = () => page.evaluate(() => window.testUi.isSpaceDown());
        await page.locator('.mxTypingShim').focus();
        await page.keyboard.down('Space');
        assert.equal(await isPanning(), true);
        assert.equal(await page.locator('.mxTypingShim').inputValue(), '');
        // Releasing another key while Space is held must not end panning.
        await page.keyboard.press('Shift');
        assert.equal(await isPanning(), true);
        await page.keyboard.up('Space');
        assert.equal(await isPanning(), false);

        await page.locator('#label').focus();
        await page.keyboard.press('Space');
        assert.equal(await isPanning(), false);
        assert.equal(await page.locator('#label').textContent(), '\u00a0');
        await page.locator('#search').focus();
        await page.keyboard.press('Space');
        assert.equal(await page.locator('#search').inputValue(), ' ');

        await page.locator('.mxTypingShim').focus();
        await page.keyboard.down('Space');
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        assert.equal(await isPanning(), false);
        await page.keyboard.up('Space');
    } finally {
        await browser.close();
    }
});
