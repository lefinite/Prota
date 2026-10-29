import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const app = process.cwd(), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-board-versions-browser-'));
const root = path.join(temp, 'workspace'), directory = path.join(root, 'src/pages/demo/design/v1');
const port = await new Promise((resolve, reject) => { const server = net.createServer(); server.on('error', reject); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const base = `http://127.0.0.1:${port}`;
let child, browser, logs = '';
try {
  await fs.cp(path.join(app, 'src/templates/infinite-canvas'), directory, { recursive: true });
  await fs.cp(path.join(app, 'tests/fixtures/canvas-v1'), directory, { recursive: true });
  await fs.mkdir(path.join(root, 'data'), { recursive: true });
  await fs.writeFile(path.join(root, 'workspace.json'), JSON.stringify({ id: 'schema-test', formatVersion: 1 }));
  await fs.writeFile(path.join(root, 'data/projects.json'), JSON.stringify({ projects: [{ id: 'demo', name: 'Test', pages: [{ id: 'design', name: 'Canvas', targetDevice: 'canvas', pageMode: 'infinite-canvas', versions: ['v1', 'v2'] }] }] }));
  await fs.writeFile(path.join(directory, 'harness.html'), '<script>window.agentOpens=0;addEventListener("message",e=>{if(e.data?.type==="prota:canvas-open-agent")agentOpens++})</script><iframe style="width:1400px;height:960px" src="index.html"></iframe>');
  child = spawn('python3', ['server/bridge.py'], { cwd: app, env: { ...process.env, READIFY_WORKSPACE: root, READIFY_CONFIG_DIR: path.join(temp, 'config'), READIFY_PORT: String(port), PYTHONDONTWRITEBYTECODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => logs += data); child.stderr.on('data', data => logs += data);
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/api/workspace')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.ok(ready, logs);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/src/pages/demo/design/v1/harness.html`);
  const frame = page.frames().find(frame => frame.url().endsWith('/index.html'));
  await frame.waitForFunction(() => Boolean(window.protaCanvas));
  await frame.evaluate(() => window.protaCanvasSchemaReady);
  const state = () => frame.evaluate(() => window.protaCanvas.getState());
  const boardFile = path.join(directory, 'boards/home/index.html');
  const original = await fs.readFile(boardFile, 'utf8');
  const catalog = async () => {
    const node = (await state()).nodes.find(n => n.id === 'home');
    return await fetch(base + '/api/boards/versions?' + new URLSearchParams({ projectId: 'demo', pageId: 'design', boardId: node.boardId })).then(r => r.json());
  };
  const trigger = () => frame.locator('.node[data-id="home"] .board-version');
  const menu = async () => {
    await trigger().click();
    await frame.locator('#context-menu[data-board-versions] .version-row').first().waitFor();
  };
  const waitLabel = async label => {
    await trigger().filter({ hasText: label }).waitFor();
    assert.equal((await trigger().textContent()).trim(), label);
  };
  const run = async (action, status) => {
    await menu();
    await frame.locator(`[data-action="board-version-${action}"]`).click();
    await frame.waitForFunction(expected => document.querySelector('#save-status').textContent === expected, status);
  };
  await waitLabel('V1');
  await menu();
  assert.deepEqual(await frame.locator('.version-row__label').allTextContents(), ['V1']);
  const panelWidth = (await frame.locator('#context-menu').boundingBox()).width;
  assert.ok((await frame.locator('.version-row').boundingBox()).width >= panelWidth - 12, 'version rows fill the dropdown');
  assert.equal(await frame.locator('[data-action="board-version-delete-v1"]').isDisabled(), true);
  assert.equal(await frame.locator('.version-panel__action').textContent(), '基于 V1 迭代');
  await trigger().click();
  assert.equal(await frame.locator('#context-menu').isHidden(), true);
  await run('fork-current', '已创建 V2');
  await waitLabel('V2');
  assert.deepEqual(Object.keys((await catalog()).versions), ['v1', 'v2']);
  assert.equal(await fs.readFile(boardFile, 'utf8'), original);
  assert.equal(await page.evaluate(() => window.agentOpens), 0, 'fork copies the source without opening Agent');
  const unchanged = (await state()).nodes.filter(n => n.id !== 'home');
  await fs.writeFile(boardFile, original.replace('旧版首页', '第二版首页'));
  await run('switch-v1', '已切换版本');
  await waitLabel('V1');
  assert.equal(await fs.readFile(boardFile, 'utf8'), original);
  assert.deepEqual((await state()).nodes.filter(n => n.id !== 'home'), unchanged);
  assert.equal(Object.keys((await catalog()).versions).length, 2, 'switch does not add versions');
  await menu();
  assert.deepEqual(await frame.locator('.version-row__label').allTextContents(), ['V2', 'V1']);
  assert.equal(await frame.locator('.version-row.is-active').getAttribute('data-version'), 'v1');
  await page.keyboard.press('Escape');
  assert.equal(await trigger().getAttribute('aria-expanded'), 'false');
  await run('switch-v2', '已切换版本');
  await waitLabel('V2');
  assert.ok((await fs.readFile(boardFile, 'utf8')).includes('第二版首页'), 'switch back keeps V2 changes');
  await run('fork-v1', '已创建 V3');
  await waitLabel('V3');
  assert.equal(await fs.readFile(boardFile, 'utf8'), original, 'row plus forks the chosen source');
  await menu();
  page.once('dialog', dialog => dialog.dismiss());
  await frame.locator('[data-action="board-version-delete-v1"]').click();
  assert.equal(Object.keys((await catalog()).versions).length, 3, 'cancel leaves history untouched');
  await menu();
  page.once('dialog', dialog => dialog.accept());
  await frame.locator('[data-action="board-version-delete-v1"]').click();
  await frame.waitForFunction(() => document.querySelector('#save-status').textContent === '已删除版本');
  assert.deepEqual(Object.keys((await catalog()).versions), ['v2', 'v3']);
  await menu();
  page.once('dialog', dialog => dialog.accept());
  await frame.locator('[data-action="board-version-delete-v3"]').click();
  await frame.waitForFunction(() => window.protaCanvas.getState().nodes.find(n => n.id === 'home').boardVersionId === 'v2');
  await waitLabel('V2');
  await run('fork-current', '已创建 V4');
  await waitLabel('V4');
  await frame.goto(`${base}/src/pages/demo/design/v1/index.html`);
  await frame.waitForFunction(() => Boolean(window.protaCanvas));
  await frame.evaluate(() => window.protaCanvasSchemaReady);
  await waitLabel('V4');
  await menu();
  assert.deepEqual(await frame.locator('.version-row__label').allTextContents(), ['V4', 'V2']);
  if (process.env.BOARD_VERSION_SCREENSHOT) await page.screenshot({ path: process.env.BOARD_VERSION_SCREENSHOT, animations: "disabled" });
  await page.keyboard.press('Escape');
  // Reproduce a running older Python service: it returns revisions but no versions.
  for (const legacyVersions of [undefined, null]) {
    await page.route('**/api/boards/versions?*', route => route.fulfill({ json: { boardId: 'b_home', revisions: [], ...(legacyVersions === null ? { versions: null } : {}) } }));
    await frame.goto(`${base}/src/pages/demo/design/v1/index.html`);
    await frame.waitForFunction(() => Boolean(window.protaCanvas));
    await frame.evaluate(() => window.protaCanvasSchemaReady);
    await menu();
    assert.deepEqual(await frame.locator('.version-row__label').allTextContents(), ['V1']);
    const layoutBefore = await fs.readFile(path.join(directory, 'canvas-data.js'), 'utf8');
    await frame.locator('[data-action="board-version-fork-current"]').click();
    await frame.waitForFunction(() => document.querySelector('#notice').textContent.includes('本地服务版本较旧'));
    assert.equal(await fs.readFile(path.join(directory, 'canvas-data.js'), 'utf8'), layoutBefore, 'unsupported operations do not migrate or overwrite business data');
    assert.equal((await frame.locator('#notice').textContent()).includes('Cannot convert'), false);
    await page.unroute('**/api/boards/versions?*');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: page-style initial V1, row switch/fork/delete, footer fork, stable versions on switch, independent edits, delete confirmation, no Agent launch, monotonic numbering and reload');
} finally {
  await browser?.close();
  if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
  await fs.rm(temp, { recursive: true, force: true });
}
