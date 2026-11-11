import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const server = createServer(async (req, res) => {
    try {
        if (req.url === '/') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<body><div id="body"><textarea data-prd-editor style="width:360px;height:180px;padding:20px;font:14px/24px monospace;box-sizing:border-box"></textarea><div class="prd-editor-preview">预览内容可以选择</div></div><input id="agent"></body>');
            return;
        }
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (!pathname.startsWith('/portal/modules/prd/')) { res.writeHead(404).end(); return; }
        res.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
        res.end(await readFile(new URL(`..${pathname}`, import.meta.url)));
    } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => console.error(error));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async () => {
        const { PRDModule } = await import('/portal/modules/prd/index.js');
        const host = {
            docDrawerMode: 'prd', prdEditorLayout: 'source',
            annotationDrawerBody: document.querySelector('#body'),
            agentInput: document.querySelector('#agent'),
            openAgentWorkbench() { window.opened = true; },
            setAgentPrdContext(...context) { window.context = context; }
        };
        window.prd = new PRDModule(host);
        prd.manager.state.status = 'ready';
        prd.manager.state.editMode = true;
        const editor = document.querySelector('textarea');
        editor.value = '开头内容，选中这段文字，后面的内容不应传入。\n' + '用于测试换行与滚动的内容。'.repeat(180);
        prd.bindEditorActions(host.annotationDrawerBody);
        editor.focus(); editor.setSelectionRange(0, 0); editor.scrollTop = 0;
    });
    await page.waitForTimeout(100);
    const button = page.locator('#prdSelectionAiPopover button');
    const select = async (start, end) => page.locator('textarea').evaluate((editor, [start, end]) => {
        editor.focus(); editor.setSelectionRange(start, end);
    }, [start, end]);
    await select(5, 11);
    await button.waitFor({ state: 'visible' });
    assert.equal((await button.innerText()).trim(), 'Prota');
    await button.click();
    assert.deepEqual(await page.evaluate(() => window.context), ['selection', 'PRD 选区', '选中这段文字']);
    assert.equal(await page.evaluate(() => window.opened && document.activeElement.id === 'agent'), true);
    assert.equal(await page.locator('textarea').inputValue(), '开头内容，选中这段文字，后面的内容不应传入。\n' + '用于测试换行与滚动的内容。'.repeat(180));
    await select(0, 0);
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Shift');
    await button.waitFor({ state: 'visible' });
    await page.keyboard.press('ArrowRight');
    await button.waitFor({ state: 'hidden' });
    await select(5, 11);
    await button.waitFor({ state: 'visible' });
    await page.locator('textarea').evaluate(editor => { editor.scrollTop = 300; });
    await button.waitFor({ state: 'hidden' });
    // A wrapped, scrolled selection must still anchor inside the editor viewport.
    await select(350, 420);
    await button.waitFor({ state: 'visible' });
    const geometry = await page.evaluate(() => {
        const editor = document.querySelector('textarea');
        return { rect: prd.getEditorSelectionRect(editor), top: editor.getBoundingClientRect().top,
            bottom: editor.getBoundingClientRect().bottom };
    });
    assert.ok(geometry.rect.top >= geometry.top && geometry.rect.top < geometry.bottom);
    await page.locator('#agent').focus();
    await button.waitFor({ state: 'hidden' });
    // Preview selection remains supported in edit mode.
    await page.locator('.prd-editor-preview').evaluate(preview => {
        const range = document.createRange(); range.selectNodeContents(preview);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    });
    await button.waitFor({ state: 'visible' });
    await button.click();
    assert.deepEqual(await page.evaluate(() => window.context), ['selection', 'PRD 选区', '预览内容可以选择']);
    await page.evaluate(() => { prd.host.isShareMode = true; document.querySelector('textarea').scrollTop = 0; });
    await select(5, 11);
    await button.waitFor({ state: 'hidden' });
    await page.evaluate(() => prd.destroy());
    assert.equal(await page.locator('#prdSelectionAiPopover').count(), 0);
    console.log('PRD selection browser checks passed');
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
