import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const app = process.cwd(), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-schema-browser-'));
const root = path.join(temp, 'workspace'), directory = path.join(root, 'src/pages/demo/design/v1');
const config = path.join(root, 'data/canvas-features.json');
const port = await new Promise((resolve, reject) => { const server = net.createServer(); server.on('error', reject); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const base = `http://127.0.0.1:${port}`;
let child, browser, logs = '';
try {
  await fs.cp(path.join(app, 'src/templates/infinite-canvas'), directory, { recursive: true });
  await fs.cp(path.join(app, 'tests/fixtures/canvas-v1'), directory, { recursive: true });
  const original = await fs.readFile(path.join(directory, 'canvas-data.js'));
  await fs.mkdir(path.join(root, 'data'), { recursive: true });
  await fs.writeFile(path.join(root, 'workspace.json'), JSON.stringify({ id: 'schema-test', formatVersion: 1 }));
  await fs.writeFile(path.join(root, 'data/projects.json'), JSON.stringify({ projects: [{ id: 'demo', name: 'Test', pages: [{ id: 'design', name: 'Canvas', targetDevice: 'canvas', pageMode: 'infinite-canvas', versions: ['v1', 'v2'] }] }] }));
  await fs.writeFile(config, JSON.stringify({ testWorkspaceIds: ['schema-test'], overrides: { canvasSchemaV2: true } }));
  child = spawn('python3', ['server/bridge.py'], { cwd: app, env: { ...process.env, READIFY_WORKSPACE: root, READIFY_CONFIG_DIR: path.join(temp, 'config'), READIFY_PORT: String(port), PYTHONDONTWRITEBYTECODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => logs += data); child.stderr.on('data', data => logs += data);
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/api/workspace')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.ok(ready, logs);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const open = async (version = 'v1') => {
    await page.goto(`${base}/src/pages/demo/design/${version}/index.html`);
    await page.waitForFunction(() => Boolean(window.protaCanvas));
    await page.evaluate(() => window.protaCanvasSchemaReady);
  };
  const state = () => page.evaluate(() => window.protaCanvas.getState());
  await open();
  const migrated = await state(), boardId = migrated.nodes[0].boardId;
  assert.equal(migrated.schemaVersion, 2); assert.equal(migrated.nodes[0].boardRevisionId, null);
  assert.equal(await page.evaluate(() => window.protaCanvas.isDirty()), false);
  assert.deepEqual(await fs.readFile(path.join(directory, 'canvas-data.js')), original, 'opening must not write migration');
  assert.equal(await fs.stat(path.join(directory, '.canvas-migrations')).then(() => true, () => false), false);
  await page.reload(); await page.waitForFunction(() => Boolean(window.protaCanvas)); await page.evaluate(() => window.protaCanvasSchemaReady);
  assert.equal((await state()).nodes[0].boardId, boardId);
  await page.locator('.node[data-id="home"] .node-title').click();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => !window.protaCanvas.isDirty() && window.protaCanvas.getState().revision === 8);
  const saved = await fs.readFile(path.join(directory, 'canvas-data.js'), 'utf8');
  assert.equal(JSON.parse(saved.slice('window.PROTA_CANVAS = '.length).trim().replace(/;$/, '')).schemaVersion, 2);
  const backups = await fs.readdir(path.join(directory, '.canvas-migrations'));
  assert.equal(backups.filter(name => name.endsWith('.js')).length, 1);
  assert.deepEqual(await fs.readFile(path.join(directory, '.canvas-migrations', backups[0])), original);
  await page.keyboard.press('ControlOrMeta+d');
  await page.waitForFunction(() => !window.protaCanvas.isDirty() && window.protaCanvas.getState().nodes.filter(n => n.type === 'board').length === 2);
  const copied = (await state()).nodes.find(n => n.type === 'board' && n.id !== 'home');
  assert.notEqual(copied.boardId, boardId); assert.equal(copied.originBoardId, boardId); assert.equal(copied.boardRevisionId, null);
  assert.ok((await fs.readFile(path.join(directory, copied.src), 'utf8')).includes('旧版首页'));
  const second = path.join(root, 'src/pages/demo/design/v2');
  await fs.cp(path.join(app, 'src/templates/infinite-canvas'), second, { recursive: true });
  await fs.cp(path.join(app, 'tests/fixtures/canvas-v1'), second, { recursive: true });
  await open('v2'); assert.equal((await state()).nodes[0].boardId, boardId, 'v1/v2 legacy copies share logical identity');
  assert.deepEqual(await fs.readFile(path.join(second, 'canvas-data.js')), original);
  await fs.writeFile(config, JSON.stringify({ testWorkspaceIds: ['schema-test'], overrides: { canvasSchemaV2: false, boardRevisions: false } }));
  await open('v1'); assert.equal((await state()).schemaVersion, 2, 'flag off must still read existing v2');
  assert.equal((await state()).nodes[0].boardId, boardId);
  await open('v2'); assert.equal((await state()).schemaVersion, 1, 'flag off must keep legacy editing path');
  await page.locator('.node[data-id="home"] .node-title').click(); await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => !window.protaCanvas.isDirty() && window.protaCanvas.getState().revision === 8);
  const unchangedSchema = await fs.readFile(path.join(second, 'canvas-data.js'), 'utf8');
  assert.equal(JSON.parse(unchangedSchema.slice('window.PROTA_CANVAS = '.length).trim().replace(/;$/, '')).schemaVersion, 1);
  // Invalid v2 fails closed: the source remains intact and the UI cannot save an empty fallback.
  const broken = structuredClone(migrated); delete broken.nodes[0].boardId;
  const invalidSource = 'window.PROTA_CANVAS = ' + JSON.stringify(broken) + ';\n';
  await fs.writeFile(path.join(second, 'canvas-data.js'), invalidSource); await open('v2');
  assert.equal(await page.locator('body.readonly').count(), 1);
  assert.equal(await page.evaluate(() => window.protaCanvas.save()), false);
  assert.equal(await fs.readFile(path.join(second, 'canvas-data.js'), 'utf8'), invalidSource);
  // Offline v2 remains self-contained and interactive; no API/config access is required.
  const offline = await context.newPage();
  await offline.goto(pathToFileURL(path.join(directory, 'index.html')).href);
  await offline.waitForFunction(() => Boolean(window.protaCanvas));
  assert.equal(await offline.evaluate(() => window.protaCanvas.getState().schemaVersion), 2);
  assert.equal(await offline.evaluate(() => window.protaCanvas.getState().nodes[0].boardId), boardId);
  const board = offline.frameLocator('.node[data-id="home"] iframe');
  await board.locator('#count').waitFor();
  await board.locator('#count').evaluate(button => button.click());
  assert.equal(await board.locator('#count').textContent(), '1');
  assert.deepEqual(errors, []);
  console.log('PASS: v1 read-only migration, byte-exact first-save backup, stable identities across reload/version copy, independent duplicate, flag rollback, invalid v2 preservation and offline board interaction');
} finally {
  await browser?.close();
  if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
  await fs.rm(temp, { recursive: true, force: true });
}
