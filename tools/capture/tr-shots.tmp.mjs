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

// 1. 初始：缓存命中两段 + 第三段转圈
await page.waitForTimeout(350);
await shot('01-initial-spinner');

// 2. 等翻译完成
await page.waitForTimeout(1800);
await shot('02-page-done');

// 3. 打开翻译面板
await page.click('#trStatusChip');
await page.waitForTimeout(600);
await shot('03-panel');

// 4. 切换引擎到普通用户（轻量小模型）
await page.click('[data-tr-engine="standard"]');
await page.waitForTimeout(400);
await shot('04-panel-standard');

// 5. 关闭面板，翻到下一页（往后加载，速度慢的小模型，能看到转圈）
await page.click('.sheet-panel__handle');
await page.waitForTimeout(400);
await page.evaluate(() => {
  // 模拟点击右侧翻页
  document.querySelector('.tap-zone--right').click();
});
await page.waitForTimeout(700);
await shot('05-next-page-loading');

// 6. 等本页完成
await page.waitForTimeout(5000);
await shot('06-next-page-done');

console.log('pageerrors:', errors.length ? errors : 'none');
await browser.close();
