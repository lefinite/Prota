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
await page.waitForTimeout(2200);

// 开启听书 → 打开音色弹窗（原文视图）
await page.evaluate(() => document.getElementById('ttsFab').click());
await page.waitForTimeout(600);
await page.evaluate(() => document.getElementById('ttsVoiceButton').click());
await page.waitForTimeout(600);
const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
await shot('T1-voice-source-view');

const sourceInfo = await page.evaluate(() => ({
  langBtn: document.querySelector('#ttsLanguageButton')?.textContent.trim() || null,
  sourceViewHidden: document.querySelector('#ttsSourceView')?.hidden
}));

// 切到译文视图
await page.evaluate(() => document.getElementById('ttsLangTranslation').click());
await page.waitForTimeout(600);
await shot('T2-voice-translation-view');
const trInfo = await page.evaluate(() => ({
  hint: document.querySelector('#ttsBilingualHintText')?.textContent.trim() || null,
  trViewHidden: document.querySelector('#ttsTranslationView')?.hidden,
  voiceCards: document.querySelectorAll('#ttsVoiceGridTr .tts-voice-card').length
}));

console.log(JSON.stringify({ sourceInfo, trInfo, pageerrors: errors.length ? errors : 'none' }, null, 2));
await browser.close();
