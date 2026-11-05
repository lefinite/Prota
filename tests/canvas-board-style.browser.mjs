import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('src/templates/infinite-canvas');
const fixture = { schemaVersion: 1, revision: 0, nodes: [{ id: 'board', type: 'board', name: '画板', x: 100, y: 100, width: 390, height: 844 }], viewport: { x: 0, y: 0, zoom: 1 } };
const server = http.createServer(async (req, res) => {
  try {
    const file = req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0].slice(1);
    const data = file === 'canvas-data.js' ? 'window.PROTA_CANVAS = ' + JSON.stringify(fixture)
      : file === 'boards/demo/index.html' ? '<html><body>Demo</body></html>' : await fs.readFile(path.join(root, file));
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html'); res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const src of ['', 'boards/demo/index.html']) {
    fixture.nodes[0].src = src;
    const page = await browser.newPage({ viewport: { width: 1116, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.protaCanvas);
    const board = page.locator('.node[data-id=board]');
    await board.click();
    await page.locator('#selection-tools [data-action=style]').click();
    await page.locator('#property-popover').waitFor({ state: 'visible' });
    for (const label of ['X', 'Y', 'W', 'H', '不透明度']) assert.equal(await page.getByRole('spinbutton', { name: label, exact: true }).count(), 1);
    await page.getByRole('spinbutton', { name: 'W', exact: true }).fill('480');
    await page.getByRole('spinbutton', { name: 'W', exact: true }).press('Tab');
    assert.equal(await page.evaluate(() => protaCanvas.getState().nodes[0].width), 480);
    await page.locator('summary[aria-label="设备预设"]').click();
    await page.getByRole('option', { name: 'Web', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => { const n = protaCanvas.getState().nodes[0]; return [n.width, n.height]; }), [1440, 900]);
    await page.getByRole('spinbutton', { name: '不透明度', exact: true }).fill('65');
    await page.getByRole('spinbutton', { name: '不透明度', exact: true }).press('Tab');
    assert.equal(await page.evaluate(() => protaCanvas.getState().nodes[0].opacity), .65);
    await page.locator('#close-properties').click();
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal(await page.evaluate(() => protaCanvas.getState().nodes[0].opacity ?? 1), 1);
    await board.locator('.node-title').click();
    await page.locator('#selection-tools [data-action=more]').click();
    await page.locator('#context-menu [data-action=rename]').click();
    assert.equal(await page.locator('#properties input').count(), 1, 'rename stays focused on the name');
    await page.locator('#close-properties').click();
    await board.locator('.node-title').click({ button: 'right' });
    await page.locator('#context-menu [data-action=style]').click();
    assert.equal(await page.getByRole('spinbutton', { name: 'W', exact: true }).count(), 1, 'right-click opens full style panel');
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS empty and populated boards: style toolbar/context menu, dimensions, presets, opacity, undo and rename');
} finally { await browser.close(); server.close(); }
