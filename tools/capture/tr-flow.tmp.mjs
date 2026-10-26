import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const pageDir = process.argv[2];
const outDir = process.argv[3];
const url = pathToFileURL(path.resolve(pageDir, 'index.html')).href;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 490, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
await page.goto(url, { waitUntil: 'load', timeout: 30000 });
const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });

await page.waitForTimeout(2200); // 首屏翻译完成

// —— 场景A：切 Web 引擎（快） → 关面板 → 翻页看转圈 ——
await page.click('#trStatusChip');
const scrollBtn = async (sel) => { await page.evaluate((s) => { const el = document.querySelector(s); el && el.scrollIntoView({ block: 'center' }); }, sel); await page.waitForTimeout(150); };
await scrollBtn('[data-tr-engine="web"]');
await page.click('[data-tr-engine="web"]');
await page.evaluate(() => { if (typeof closeSheet === 'function') closeSheet(); });
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('.tap-zone--right').click());
await page.waitForTimeout(500);
await shot('A1-next-page-web-loading');

// —— 场景B：报错注入（旧方案：重试也不行） ——
await page.click('#trStatusChip');
await scrollBtn('[data-tr-recovery="old"]');
await page.click('[data-tr-recovery="old"]');
await page.click('[data-tr-inject="error"]', { force: true });
await page.evaluate(() => { if (typeof closeSheet === 'function') closeSheet(); });
await page.evaluate(() => document.querySelector('.tap-zone--right').click());
await page.waitForTimeout(2600);
await shot('B1-error-old-scheme');

// 点重试 → 仍失败
const retryBtn = await page.$('[data-tr-retry]');
if (retryBtn) { await retryBtn.click(); await page.waitForTimeout(600); }
await shot('B2-retry-still-fails');

// —— 场景C：切新方案 → 重试成功 ——
await page.click('#trStatusChip');
await scrollBtn('[data-tr-recovery="new"]');
await page.click('[data-tr-recovery="new"]');
await page.evaluate(() => { if (typeof closeSheet === 'function') closeSheet(); });
await page.waitForTimeout(300);
const retryBtn2 = await page.$('[data-tr-retry]');
if (retryBtn2) { await retryBtn2.click(); await page.waitForTimeout(1500); }
await shot('C1-retry-success-new-scheme');

// —— 场景D：坏缓存注入（校验开启 → 自动修复） ——
await page.click('#trStatusChip');
await page.click('[data-tr-inject="badcache"]', { force: true });
await page.waitForTimeout(2200);
await shot('D1-badcache-autofix');
await page.evaluate(() => { if (typeof closeSheet === 'function') closeSheet(); });

// —— 场景E：间距验证（原文-译文 8px / 段落 16px） ——
const spacing = await page.evaluate(() => {
  const ps = Array.from(document.querySelectorAll('#pageContent > p'));
  const gaps = [];
  for (let i = 1; i < ps.length; i++) {
    const prev = ps[i-1].getBoundingClientRect();
    const cur = ps[i].getBoundingClientRect();
    gaps.push({ from: ps[i-1].className || 'original', gap: Math.round(cur.top - prev.bottom) });
  }
  return gaps;
});
console.log('SPACING:', JSON.stringify(spacing));

console.log('pageerrors:', errors.length ? errors : 'none');
await browser.close();
