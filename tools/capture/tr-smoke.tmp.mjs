import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pageDir = process.argv[2];
const url = pathToFileURL(path.resolve(pageDir, 'index.html')).href;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 490, height: 900 }, deviceScaleFactor: 2 });
const logs = [];
page.on('console', (msg) => logs.push(`[console:${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));
await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const screen = document.getElementById('phoneScreen');
  const chip = document.getElementById('trStatusChip');
  const content = document.getElementById('pageContent');
  return {
    screenBg: screen ? getComputedStyle(screen).backgroundColor : null,
    chipText: chip ? chip.textContent.trim() : null,
    paraCount: content ? content.querySelectorAll('p').length : 0,
    translationCount: content ? content.querySelectorAll('p.reader-translation').length : 0,
    cursorCount: content ? content.querySelectorAll('.tr-cursor').length : 0
  };
});
console.log(JSON.stringify(info, null, 2));
console.log('--- console logs ---');
logs.slice(0, 30).forEach((l) => console.log(l));
await browser.close();
