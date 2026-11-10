import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const uiRoot = path.join(root, 'portal/ui');
const screenshots = process.env.PROTA_UI_ARTIFACT_DIR || mkdtempSync(path.join(os.tmpdir(), 'prota-ui-'));
mkdirSync(screenshots, { recursive: true });
const files = new Map([
  ['/showcase.html', ['showcase.html', 'text/html; charset=utf-8']],
  ['/showcase.css', ['showcase.css', 'text/css; charset=utf-8']],
  ['/showcase.js', ['showcase.js', 'text/javascript; charset=utf-8']],
  ['/tokens.css', ['tokens.css', 'text/css; charset=utf-8']],
  ['/components.css', ['components.css', 'text/css; charset=utf-8']]
]);
const server = createServer((req, res) => {
  const entry = files.get(new URL(req.url, 'http://localhost').pathname);
  if (!entry) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'content-type': entry[1] });
  res.end(readFileSync(path.join(uiRoot, entry[0])));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/showcase.html`);
  await page.getByRole('heading', { name: 'Prota UI' }).waitFor();
  const computed = await page.locator('.pui-button--primary').first().evaluate(node => {
    const css = getComputedStyle(node);
    return { background: css.backgroundColor, height: node.getBoundingClientRect().height };
  });
  assert.equal(computed.background, 'rgb(79, 70, 229)');
  assert.ok(computed.height >= 36);
  assert.equal(await page.locator('[data-color-token="primary"]').textContent(), '#4F46E5');
  assert.equal(await page.getByRole('button', { name: '正在处理' }).getAttribute('aria-busy'), 'true');

  for (const width of [1440, 1024, 860, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    assert.ok(sizes.content <= sizes.viewport, `${width}px horizontal overflow (${JSON.stringify(sizes)})`);
    await page.screenshot({ path: path.join(screenshots, `pui-${width}.png`), fullPage: true });
  }

  const trigger = page.getByRole('button', { name: /主要操作 · 打开弹窗/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '确认示例' });
  await dialog.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(node => document.activeElement === node), true, 'focus returns to modal trigger');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await trigger.evaluate(node => getComputedStyle(node).transitionDuration);
  assert.equal(duration, '0s', 'reduced motion removes button transitions');
  assert.deepEqual(errors, []);
  console.log(`Product UI browser smoke passed (1440/1024/860/390, dialog, focus, reduced motion). Screenshots: ${screenshots}`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
