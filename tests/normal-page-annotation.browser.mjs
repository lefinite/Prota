// Regression: a visible normal page must support annotation while parser-blocking
// resources are pending, and keep its shortcuts after the load event.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const app = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-normal-annotation-'));
const root = path.join(temp, 'workspace'), config = path.join(temp, 'config');
const children = [];
let browser, logs = '';
const write = async (relative, content) => {
  const file = path.join(root, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
};
const freePort = () => new Promise(resolve => {
  const server = net.createServer().listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
const wait = async (predicate, label) => {
  for (let i = 0; i < 200; i++) {
    try { if (await predicate()) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Timed out: ${label}\n${logs.slice(-2000)}`);
};

try {
  for (const id of ['mobile', 'web']) {
    await write(`src/pages/demo/${id}/v1/index.html`, '<!doctype html><body><button id="target" style="margin:80px;padding:20px">标注目标</button><script src="./pending.js"></script>');
    await write(`src/pages/demo/${id}/v1/styles.css`, '');
    await write(`src/pages/demo/${id}/v1/app.js`, '');
  }
  await write('workspace.json', JSON.stringify({ id: 'normal-annotation-fixture', formatVersion: 1 }));
  await write('data/projects.json', JSON.stringify({ projects: [{ id: 'demo', name: '标注测试', pages:
    // pageMode can describe a newer canvas version while v1 remains a normal demo.
    ['mobile', 'web'].map(id => ({ id, name: id, targetDevice: id, pageMode: 'infinite-canvas', versions: ['v1'], activeVersion: 'v1' }))
  }], activeProjectId: 'demo', activePageId: 'mobile' }));
  await fs.mkdir(config, { recursive: true });
  await fs.writeFile(path.join(config, 'workspace.json'), JSON.stringify({ path: root }));
  const bridgePort = await freePort(), agentPort = await freePort();
  const base = `http://127.0.0.1:${bridgePort}`;
  const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', READIFY_CONFIG_DIR: config, READIFY_WORKSPACE: root, READIFY_PORT: String(bridgePort), READIFY_AGENT_PORT: String(agentPort) };
  for (const [command, args] of [['python3', ['server/bridge.py']], ['node', ['server/agent-server.mjs']]]) {
    const child = spawn(command, args, { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => logs += chunk);
    child.stderr.on('data', chunk => logs += chunk);
    children.push(child);
  }
  await wait(async () => (await fetch(`${base}/api/workspace`)).ok, 'bridge');
  await wait(async () => (await fetch(`http://127.0.0.1:${agentPort}/api/agent/health`)).ok, 'agent');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/fonts\.google/, route => route.abort());
  await page.route('http://localhost:8080/**', route => route.continue({ url: `${base}${new URL(route.request().url()).pathname}` }));
  await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//, route => route.continue({ url: route.request().url().replace(/:8081\//, `:${agentPort}/`) }));
  let releaseResource;
  await page.route('**/pending.js', async route => {
    await new Promise(resolve => { releaseResource = resolve; });
    await route.fulfill({ contentType: 'text/javascript', body: '' });
  });
  await page.goto(`${base}/portal/index.html`, { waitUntil: 'domcontentloaded' });
  await wait(() => page.evaluate(() => Boolean(window.shell?.projects?.projects?.length)), 'shell');
  await page.evaluate(() => window.shell.switchTopView('page'));
  for (const id of ['mobile', 'web']) {
    await page.evaluate(id => window.shell.switchPage(id, 'v1'), id);
    const frame = page.frameLocator('#mainIframe'), target = frame.locator('#target');
    await target.waitFor({ state: 'visible' });
    await wait(() => Boolean(releaseResource), 'pending resource');
    assert.equal(await page.evaluate(() => window.shell.mainIframe.contentDocument.readyState), 'loading');
    assert.equal(await page.evaluate(() => window.shell.isInfiniteCanvasPage()), false, 'normal version overrides shared canvas metadata');
    // Longer than the watchdog interval, but the resource stays blocked.
    await page.waitForTimeout(350);
    await target.click({ button: 'right' });
    assert.equal(await page.evaluate(() => window.shell.annotationMode), false, 'one right click does not enter');
    await target.click({ button: 'right' });
    await wait(() => page.evaluate(() => window.shell.annotationMode && window.shell.mainIframe.contentWindow.__readifyInspecting), `${id} enters while loading`);
    await target.click({ button: 'right' });
    await wait(() => page.evaluate(() => !window.shell.annotationMode), 'one right click exits');
    releaseResource(); releaseResource = null;
    await wait(() => page.evaluate(() => window.shell.mainIframe.contentDocument.readyState === 'complete'), 'resource finished');
    await target.click({ button: 'right' });
    await target.click({ button: 'right' });
    await wait(() => page.evaluate(() => window.shell.annotationMode && window.shell.mainIframe.contentWindow.__readifyInspecting), 'entry after load');
    assert.equal(await frame.locator('#__readify_shortcut_bridge').count(), 1, 'load does not duplicate bridge');
    await target.click();
    await page.locator('.annotation-dialog').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.shell.exitAnnotationMode());
    await target.press('Control+d');
    await wait(() => page.evaluate(() => window.shell.annotationMode), 'Ctrl+D still enters');
    await target.click({ button: 'right' });
    await wait(() => page.evaluate(() => !window.shell.annotationMode), 'exit before navigation');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: normal mobile/web annotation during blocked script loading and after load, single-click exit, inspector selection, Ctrl+D, no duplicate bridge');
} finally {
  await browser?.close();
  for (const child of children) child.kill();
  await fs.rm(temp, { recursive: true, force: true });
}
