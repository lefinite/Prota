import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

test('窄栏完整居中预览无滚动条，展开后可缩放、拖动、复位和关闭', async () => {
    const root = new URL('../', import.meta.url);
    const server = createServer(async (req, res) => {
        if (req.url === '/') {
            res.setHeader('Content-Type', 'text/html');
            res.end('<main style="width:340px;margin:auto" class="prd-document"></main>');
            return;
        }
        try {
            const path = new URL(req.url, 'http://localhost').pathname;
            const file = new URL(path.slice(1), root);
            if (!file.href.startsWith(root.href)) throw new Error('Invalid path');
            res.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : 'text/javascript');
            res.end(await readFile(fileURLToPath(file)));
        } catch { res.statusCode = 404; res.end(); }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.addStyleTag({ url: '/portal/modules/prd/prd.css' });
        await page.evaluate(async () => {
            const { PRDRenderer } = await import('/portal/modules/prd/renderer.js');
            const { mountMermaidDiagrams } = await import('/portal/modules/prd/mermaid-preview.js');
            const main = document.querySelector('main');
            main.innerHTML = new PRDRenderer({ host: {}, state: {} }).renderMarkdownDocument([
                '```mermaid', 'flowchart TD', 'A["入口"] --> B{"选择方式"}',
                'B --> C["验证码"]', 'B --> D["密码"]', 'C --> E["完成"]',
                'D --> E', 'D -.-> B', '```'
            ].join('\n'));
            await mountMermaidDiagrams(main);
        });
        const preview = await page.locator('[data-prd-mermaid]').evaluate((card) => {
            const canvas = card.querySelector('[data-mermaid-canvas]');
            const svg = canvas.querySelector('svg').getBoundingClientRect();
            const bounds = canvas.getBoundingClientRect();
            return { scrollWidth: card.scrollWidth, width: card.clientWidth,
                centerDelta: Math.abs((svg.left + svg.right - bounds.left - bounds.right) / 2) };
        });
        assert.ok(preview.scrollWidth <= preview.width);
        assert.ok(preview.centerDelta < 1);
        await page.locator('[data-mermaid-canvas]').click();
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const dialog = page.locator('.prd-diagram-viewer');
        assert.equal(await dialog.isVisible(), true);
        const transform = () => page.locator('.prd-diagram-viewer__content').evaluate((content) => content.style.transform);
        const fitted = await transform();
        assert.equal(await page.locator('.prd-diagram-viewer__viewport').evaluate((viewport) => {
            const frame = viewport.getBoundingClientRect();
            const diagram = viewport.querySelector('svg').getBoundingClientRect();
            return diagram.left >= frame.left && diagram.right <= frame.right
                && diagram.top >= frame.top && diagram.bottom <= frame.bottom;
        }), true);
        await page.getByRole('button', { name: '放大', exact: true }).click();
        assert.notEqual(await transform(), fitted);
        const viewport = await page.locator('.prd-diagram-viewer__viewport').boundingBox();
        const beforeDrag = await transform();
        await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
        await page.mouse.down();
        await page.mouse.move(viewport.x + viewport.width / 2 + 100, viewport.y + viewport.height / 2 + 60, { steps: 5 });
        await page.mouse.up();
        assert.notEqual(await transform(), beforeDrag);
        const afterDrag = await transform();
        await page.mouse.wheel(0, -200);
        await page.waitForFunction((previous) => document.querySelector('.prd-diagram-viewer__content').style.transform !== previous, afterDrag);
        await page.getByRole('button', { name: '显示全图' }).click();
        assert.equal(await transform(), fitted);
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        assert.equal(await dialog.count(), 0);
        assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-mermaid-canvas')), true);
        // Keyboard opening and zoom-out also work on a small viewport.
        await page.setViewportSize({ width: 375, height: 812 });
        await page.keyboard.press('Enter');
        const beforeZoomOut = await transform();
        await page.getByRole('button', { name: '缩小', exact: true }).click();
        assert.notEqual(await transform(), beforeZoomOut);
        await page.getByRole('button', { name: '关闭大图' }).click();
        await dialog.waitFor({ state: 'detached' });
        assert.equal(await dialog.count(), 0);
        const nativePaths = await page.evaluate(async () => {
            const { PRDRenderer } = await import('/portal/modules/prd/renderer.js');
            const { mountMermaidDiagrams } = await import('/portal/modules/prd/mermaid-preview.js');
            const main = document.querySelector('main');
            main.innerHTML += new PRDRenderer({ host: {}, state: {} }).renderMarkdownDocument([
                '```mermaid', 'flowchart LR', 'A["开始"] --> B{"判断"}',
                'B --> C["分支一"]', 'B --> D["分支二"]', 'C --> E["完成"]', 'D --> E', '```'
            ].join('\n'));
            await mountMermaidDiagrams(main);
            return Array.from(main.querySelectorAll('path.flowchart-link'), (path) => path.getAttribute('d'));
        });
        assert.ok(nativePaths.length > 0, '水平图应使用 Mermaid 原生渲染');
        assert.ok(nativePaths.some((path) => path.includes('C')), '分支连线应包含平滑曲线');
        const nativeStyle = await page.locator('[data-prd-mermaid]').last().evaluate((card) => {
            const nodes = Array.from(card.querySelectorAll('.node'));
            const decision = nodes.find((node) => node.textContent.includes('判断'));
            const terminal = nodes.find((node) => node.textContent.includes('完成'));
            return { decisionFill: getComputedStyle(decision.querySelector('.label-container')).fill,
                terminalFill: getComputedStyle(terminal.querySelector('.label-container')).fill,
                radius: terminal.querySelector('rect').getAttribute('rx') };
        });
        assert.deepEqual(nativeStyle, { decisionFill: 'rgb(239, 244, 252)', terminalFill: 'rgb(237, 246, 240)', radius: '12' });
        const largeDiagram = await page.evaluate(async () => {
            const { PRDRenderer } = await import('/portal/modules/prd/renderer.js');
            const { mountMermaidDiagrams } = await import('/portal/modules/prd/mermaid-preview.js');
            const main = document.querySelector('main');
            const edges = Array.from({ length: 29 }, (_, index) => `N${index}["步骤${index}"] --> N${index + 1}["步骤${index + 1}"]`);
            main.innerHTML = new PRDRenderer({ host: {}, state: {} }).renderMarkdownDocument(['```mermaid', 'flowchart TD', ...edges, '```'].join('\n'));
            await mountMermaidDiagrams(main);
            const svg = main.querySelector('svg');
            return { aligned: svg.classList.contains('prd-aligned-flowchart'), nodes: svg.querySelectorAll('.flow-node').length,
                noScrollbar: main.querySelector('figure').scrollWidth <= main.querySelector('figure').clientWidth };
        });
        assert.deepEqual(largeDiagram, { aligned: true, nodes: 30, noScrollbar: true });
        const textFits = await page.evaluate(async () => {
            const { PRDRenderer } = await import('/portal/modules/prd/renderer.js');
            const { mountMermaidDiagrams } = await import('/portal/modules/prd/mermaid-preview.js');
            const main = document.querySelector('main');
            main.innerHTML = new PRDRenderer({ host: {}, state: {} }).renderMarkdownDocument([
                '```mermaid', 'flowchart TD', 'A{"收到短信验证码后校验手机号并根据账户状态继续执行自动注册或登录"} --> B["验证成功<br/>进入书架"]', '```'
            ].join('\n'));
            await mountMermaidDiagrams(main);
            return Array.from(main.querySelectorAll('.flow-node')).every((node) => {
                const shape = node.querySelector('path, rect').getBBox();
                const text = node.querySelector('text').getBBox();
                if (node.querySelector('path')) {
                    return [[text.x, text.y], [text.x + text.width, text.y], [text.x, text.y + text.height], [text.x + text.width, text.y + text.height]]
                        .every(([x, y]) => Math.abs(x) / (shape.width / 2) + Math.abs(y) / (shape.height / 2) <= 1);
                }
                return text.x >= shape.x && text.y >= shape.y && text.x + text.width <= shape.x + shape.width && text.y + text.height <= shape.y + shape.height;
            }) && main.querySelectorAll('.flow-node').length === 2;
        });
        assert.equal(textFits, true, '长文案应完整容纳在矩形和菱形内部');
        const tallFits = await page.evaluate(async () => {
            const { openDiagramViewer } = await import('/portal/modules/prd/diagram-viewer.js');
            openDiagramViewer('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 100000"><rect width="800" height="100000" fill="white"/></svg>');
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const viewport = document.querySelector('.prd-diagram-viewer__viewport');
            const frame = viewport.getBoundingClientRect();
            const diagram = viewport.querySelector('svg').getBoundingClientRect();
            return diagram.top >= frame.top && diagram.bottom <= frame.bottom && diagram.left >= frame.left && diagram.right <= frame.right;
        });
        assert.equal(tallFits, true, '超长图显示全图也不能被最小缩放比例裁切');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
});
