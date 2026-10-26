import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const pageDir = process.argv[2];
if (!pageDir) throw new Error('Usage: node tr-dbg2.tmp.mjs <page-dir>');
const url = pathToFileURL(path.resolve(pageDir, 'index.html')).href;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 490, height: 900 }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1200);
const info = await page.evaluate(() => {
  const player = document.getElementById('ttsPlayer');
  const chip = document.getElementById('trStatusChip');
  const pr = player.getBoundingClientRect();
  const cr = chip.getBoundingClientRect();
  return {
    playerTop: Math.round(pr.top), playerBottom: Math.round(pr.bottom), playerH: Math.round(pr.height),
    chipTop: Math.round(cr.top), chipBottom: Math.round(cr.bottom),
    overlap: cr.bottom > pr.top
  };
});
console.log(JSON.stringify(info));
await browser.close();
