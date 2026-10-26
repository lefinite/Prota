import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pageDir = process.argv[2];
if (!pageDir) throw new Error('Usage: node tr-dbg.tmp.mjs <page-dir>');
const url = pathToFileURL(path.resolve(pageDir, 'index.html')).href;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 490, height: 900 }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.click('#trStatusChip');
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const btn = document.querySelector('[data-tr-recovery="old"]');
  const panel = document.querySelector('.sheet-panel[data-panel="translation"]');
  const r = btn.getBoundingClientRect();
  const el = document.elementFromPoint(Math.round(r.x + r.width/2), Math.round(r.y + r.height/2));
  return {
    btnRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    elementAtPoint: el ? `${el.tagName}.${el.className}` : null,
    panelScrollHeight: panel.scrollHeight,
    panelClientHeight: panel.clientHeight,
    sheetHeight: getComputedStyle(document.getElementById('phoneScreen')).getPropertyValue('--sheet-height')
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
