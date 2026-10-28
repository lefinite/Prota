// End-to-end: infinite-canvas board annotation over the real Portal + Bridge + Agent server.
// Covers the full loop: right-click gesture → inspector in the nested board iframe →
// dialog → persistence (boardId + selector isolation) → markers under zoom/pan →
// historical locate → delete → Agent feedback context → runtime auto-upgrade →
// normal-page annotation regression.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const app = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-canvas-annotation-'));
const root = path.join(temp, 'workspace');
const config = path.join(temp, 'config');
const children = [];
let browser, logs = '';
const write = async (relative, content) => { const file = path.join(root, relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content); };
const freePort = () => new Promise(resolve => { const server = net.createServer().listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const wait = async (predicate, label) => { for (let i = 0; i < 200; i++) { try { if (await predicate()) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw Error(`Timed out: ${label}\n${logs.slice(-2000)}`); };

const boardHtml = (id, label) => `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:sans-serif;padding:24px;background:#fff}h1{font-size:18px;margin:0 0 18px}.actions{display:flex;gap:12px}#submit-button{padding:12px 22px;background:#5364cf;color:#fff;border:0;border-radius:8px;font-size:14px}.ghost{padding:12px 18px;border:1px solid #dfe3ee;background:#fff;border-radius:8px}</style><h1>${label}</h1><div class="actions"><button id="submit-button">${label}提交</button><button class="ghost">取消</button></div><!-- board:${id} -->`;
const canvasDoc = nodes => 'window.PROTA_CANVAS = ' + JSON.stringify({ schemaVersion: 1, revision: 0, viewport: { x: 0, y: 0, zoom: 1 }, nodes }) + ';';

try {
  // --- Workspace fixture -------------------------------------------------
  await fs.cp(path.join(app, 'src/templates/infinite-canvas'), path.join(root, 'src/pages/demo/design/v1'), { recursive: true });
  await write('src/pages/demo/design/v1/boards/board_a/index.html', boardHtml('board_a', '画板 A'));
  await write('src/pages/demo/design/v1/boards/board_b/index.html', boardHtml('board_b', '画板 B'));
  await write('src/pages/demo/design/v1/canvas-data.js', canvasDoc([
    { id: 'node_a', type: 'board', name: '画板 A', x: 40, y: 40, width: 360, height: 240, src: 'boards/board_a/index.html' },
    { id: 'node_b', type: 'board', name: '画板 B', x: 460, y: 40, width: 360, height: 240, src: 'boards/board_b/index.html' }
  ]));
  // v2 simulates a canvas created by an older runtime: stale app.js that the
  // portal must auto-upgrade without touching data, boards or annotations.
  await fs.cp(path.join(app, 'src/templates/infinite-canvas'), path.join(root, 'src/pages/demo/design/v2'), { recursive: true });
  await write('src/pages/demo/design/v2/boards/board_a/index.html', boardHtml('board_a', '历史画板'));
  await write('src/pages/demo/design/v2/canvas-data.js', canvasDoc([
    { id: 'legacy_node', type: 'board', name: '历史画板', x: 40, y: 40, width: 360, height: 240, src: 'boards/board_a/index.html' }
  ]));
  await write('src/pages/demo/design/v2/annotations.json', JSON.stringify([
    { id: 'ann_legacy', target: { type: 'canvas-board', boardId: 'board_a', boardPath: 'boards/board_a/index.html' }, selector: '#submit-button', description: '历史画板标注', timestamp: '2026-01-01T00:00:00.000Z', meta: {} }
  ], null, 2));
  await write('src/pages/demo/design/v2/app.js', 'window.protaCanvas={runtimeVersion:4};\n');
  const v2BoardBefore = await fs.readFile(path.join(root, 'src/pages/demo/design/v2/boards/board_a/index.html'), 'utf8');
  const v2DataBefore = await fs.readFile(path.join(root, 'src/pages/demo/design/v2/canvas-data.js'), 'utf8');
  const v2AnnotationsBefore = await fs.readFile(path.join(root, 'src/pages/demo/design/v2/annotations.json'), 'utf8');
  // A normal mobile page for the non-canvas annotation regression.
  await fs.cp(path.join(app, 'src/templates/mobile-frame'), path.join(root, 'src/pages/demo/normal/v1'), { recursive: true });
  await write('src/pages/demo/web/v1/index.html', boardHtml('web', '普通 Web'));
  await write('src/pages/demo/web/v1/styles.css', '');
  await write('src/pages/demo/web/v1/app.js', '');
  await write('workspace.json', JSON.stringify({ id: 'annotation-fixture', formatVersion: 1 }));
  await write('data/projects.json', JSON.stringify({
    projects: [{ id: 'demo', name: '标注验证', pages: [
      { id: 'design', name: '无限画布', targetDevice: 'canvas', pageMode: 'infinite-canvas', versions: ['v1', 'v2'], activeVersion: 'v1' },
      { id: 'normal', name: '普通页面', targetDevice: 'mobile', versions: ['v1'], activeVersion: 'v1' },
      { id: 'web', name: '普通 Web', targetDevice: 'web', versions: ['v1'], activeVersion: 'v1' }
    ] }], activeProjectId: 'demo', activePageId: 'design'
  }));
  await fs.mkdir(config, { recursive: true });
  await fs.writeFile(path.join(config, 'workspace.json'), JSON.stringify({ path: root }));
  await fs.writeFile(path.join(config, 'agent-provider-config.json'), JSON.stringify({ providers: [{ id: 'fixture', label: '测试模型', model: 'fixture-model', apiKey: 'fixture-key', baseURL: 'https://example.invalid/v1', apiType: 'openai-completions', sdkOptions: {} }], activeProviderId: 'fixture', selectedProviderId: 'fixture' }));

  const bridgePort = await freePort(), agentPort = await freePort();
  const base = `http://127.0.0.1:${bridgePort}`;
  const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', READIFY_CONFIG_DIR: config, READIFY_WORKSPACE: root, READIFY_PORT: String(bridgePort), READIFY_AGENT_PORT: String(agentPort) };
  for (const [command, args] of [['python3', ['server/bridge.py']], ['node', ['server/agent-server.mjs']]]) {
    const child = spawn(command, args, { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => logs += chunk); child.stderr.on('data', chunk => logs += chunk);
    children.push(child);
  }
  await wait(async () => (await fetch(`${base}/api/workspace`)).ok, 'bridge');
  await wait(async () => (await fetch(`http://127.0.0.1:${agentPort}/api/agent/health`)).ok, 'agent');
  assert.equal((await fetch(`${base}/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).ok, true);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // The portal hardcodes localhost:8080 for annotation persistence; proxy it to the test bridge.
  await page.route(/fonts\.google/, route => route.abort());
  await page.route('http://localhost:8080/**', route => route.continue({ url: `${base}${new URL(route.request().url()).pathname}` }));
  await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//, route => route.continue({ url: route.request().url().replace(/:8081\//, `:${agentPort}/`) }));
  await page.goto(`${base}/portal/index.html`, { waitUntil: 'domcontentloaded' });
  await wait(() => page.evaluate(() => Boolean(window.shell?.projects?.projects?.length)), 'shell metadata');
  // The portal boots on the projects home; enter the page view and open the canvas.
  await page.evaluate(async () => { window.shell.switchTopView('page'); await window.shell.switchPage('design', 'v1'); });

  await wait(() => page.evaluate(() => {
    const editor = document.getElementById('mainIframe')?.contentWindow?.protaCanvas;
    return Boolean(editor && editor.runtimeVersion >= 8 && editor.getBoardFrame('board_a')?.iframe?.contentDocument?.querySelector('#submit-button'));
  }), 'canvas runtime v8 with boards loaded');

  // --- Helpers -----------------------------------------------------------
  // Board iframes report rects in the canvas document's viewport; add the
  // main-iframe offset to translate into top-level screen coordinates.
  const boardPoint = boardId => page.evaluate(id => {
    const main = document.getElementById('mainIframe');
    const mainRect = main.getBoundingClientRect();
    const { iframe } = main.contentWindow.protaCanvas.getBoardFrame(id);
    const frame = iframe.getBoundingClientRect();
    const scaleX = frame.width / Math.max(1, iframe.contentWindow.innerWidth);
    const scaleY = frame.height / Math.max(1, iframe.contentWindow.innerHeight);
    const btn = iframe.contentDocument.querySelector('#submit-button').getBoundingClientRect();
    return { x: mainRect.left + frame.left + (btn.left + btn.width / 2) * scaleX, y: mainRect.top + frame.top + (btn.top + btn.height / 2) * scaleY };
  }, boardId);
  const rightClick = async (x, y) => { await page.mouse.click(x, y, { button: 'right' }); };
  const isAnnotating = () => page.evaluate(() => document.getElementById('mainIframe').contentWindow.protaCanvas.getAnnotationState().active);
  const canvasState = () => page.evaluate(() => ({
    annotation: document.getElementById('mainIframe').contentWindow.protaCanvas.getAnnotationState(),
    interacting: document.getElementById('mainIframe').contentWindow.document.querySelectorAll('.node.interacting').length
  }));
  const shellState = () => page.evaluate(() => ({
    mode: window.shell.annotationMode,
    target: window.shell.canvasAnnotationTarget ? { ...window.shell.canvasAnnotationTarget } : null
  }));
  // Right-click until the board annotation is on; robust to whether the board
  // was already activated (2 clicks) or not (3 clicks).
  const enterAnnotation = async point => {
    for (let i = 0; i < 4 && !(await isAnnotating()); i++) await rightClick(point.x, point.y);
    if (!(await isAnnotating())) throw Error('failed to enter board annotation');
    await wait(() => page.evaluate(() => {
      const shell = window.shell;
      const context = shell.getAnnotationFrameContext();
      return shell.annotationMode && context.type === 'canvas-board' && context.window?.__readifyInspecting
        && context.boardId === document.getElementById('mainIframe').contentWindow.protaCanvas.getAnnotationState().boardId;
    }), 'board inspector ready');
  };
  const dispatchEscape = where => page.evaluate(target => {
    const canvas = document.getElementById('mainIframe').contentWindow;
    const doc = target === 'canvas' ? canvas.document : canvas.document.querySelector('.node.interacting iframe')?.contentDocument || canvas.document;
    doc.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  }, where);
  const closeCanvasMenu = () => page.evaluate(() => {
    const canvas = document.getElementById('mainIframe').contentWindow;
    canvas.document.querySelector('#context-menu').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
  const leavePreview = async () => {
    await closeCanvasMenu();
    await dispatchEscape('canvas');
    await wait(async () => (await canvasState()).interacting === 0, 'leave preview');
  };
  const persistAnnotations = async () => {
    const payload = await page.evaluate(() => ({ projectId: window.shell.activeProjectId, pageId: window.shell.activePageId, version: window.shell.activeVersion, annotations: window.shell.currentAnnotations }));
    const response = await fetch(`${base}/api/annotations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(response.ok, true, 'bridge annotation persistence');
  };
  const readAnnotationsFile = async version => (await fetch(`${base}/src/pages/demo/design/${version}/annotations.json`)).json();

  // --- 1. Right-click gesture: 3 clicks from an inactive board ------------
  console.log('Annotation scenario 1');
  const pointA = await boardPoint('board_a');
  const pointB = await boardPoint('board_b');
  await rightClick(pointA.x, pointA.y);
  let state = await canvasState();
  assert.equal(state.annotation.active, false, 'first right click only activates');
  assert.equal(state.interacting, 1, 'first right click activates the board');
  await rightClick(pointA.x, pointA.y);
  state = await canvasState();
  assert.equal(state.annotation.active, false, 'second click has not entered annotation yet');
  await rightClick(pointA.x, pointA.y);
  await wait(isAnnotating, 'annotation entered from inactive board');
  state = await canvasState();
  assert.equal(state.annotation.boardId, 'board_a');
  assert.equal(state.annotation.nodeId, 'node_a');
  let shell = await shellState();
  await wait(async () => {
    const next = await shellState();
    return next.mode === true && next.target?.boardId === 'board_a';
  }, 'portal entered annotation mode');
  shell = await shellState();
  assert.equal(shell.target.type, 'canvas-board');
  // Inspector injected into the nested board iframe only (async after the state message).
  await wait(() => page.evaluate(() => Boolean(document.getElementById('mainIframe').contentWindow.protaCanvas.getBoardFrame('board_a').iframe.contentDocument.getElementById('__readify_inspector_script'))), 'inspector injected into the annotated board');
  const injected = await page.evaluate(() => {
    const canvas = document.getElementById('mainIframe').contentWindow;
    const a = canvas.protaCanvas.getBoardFrame('board_a').iframe;
    const b = canvas.protaCanvas.getBoardFrame('board_b').iframe;
    return {
      aScript: Boolean(a.contentDocument.getElementById('__readify_inspector_script')),
      aInspecting: a.contentWindow.__readifyInspecting === true,
      bScript: Boolean(b.contentDocument.getElementById('__readify_inspector_script')),
      editorScript: Boolean(canvas.document.getElementById('__readify_inspector_script'))
    };
  });
  assert.deepEqual(injected, { aScript: true, aInspecting: true, bScript: false, editorScript: false }, 'inspector targets only the annotated board');

  // Neither a sibling frame nor a relayed payload naming another board may
  // open the dialog, including messages that omit the board identity entirely.
  await page.evaluate(() => {
    const canvas = document.getElementById('mainIframe').contentWindow;
    const sibling = canvas.protaCanvas.getBoardFrame('board_b').iframe.contentWindow;
    sibling.eval(`parent.parent.postMessage({type:'readify:element-selected',selector:'#submit-button'}, location.origin)`);
    sibling.eval(`parent.postMessage({type:'readify:element-selected',selector:'#submit-button'}, location.origin)`);
  });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => Boolean(window.shell.pendingAnnotation)), false, 'sibling cannot spoof a selection');
  // Reload the very same iframe element: old document listeners/Inspector must
  // be removed and the fresh document must receive both, exactly once.
  await page.evaluate(() => {
    const frame = document.getElementById('mainIframe').contentWindow.protaCanvas.getBoardFrame('board_a').iframe;
    frame.contentDocument.documentElement.dataset.annotationReload = 'old';
    frame.contentWindow.location.reload();
  });
  await wait(() => page.evaluate(() => {
    const doc = document.getElementById('mainIframe').contentWindow.protaCanvas.getBoardFrame('board_a').iframe.contentDocument;
    return doc.readyState === 'complete' && doc.documentElement.dataset.annotationReload !== 'old' && doc.querySelectorAll('#__readify_inspector_script').length === 1;
  }), 'inspector rebound after board reload');
  await page.evaluate(() => {
    const context = window.shell.getAnnotationFrameContext();
    context.window.eval('window.state = {activePanel: "hidden"}; window.render = function() { document.body.dataset.activePanel = state.activePanel; };');
  });
  assert.equal(await page.evaluate(() => window.shell.syncIframeState({ activePanel: 'details' }, 400, window.shell.getAnnotationFrameContext())), true, 'nested board state synchronization receives its acknowledgement');
  assert.equal(await page.evaluate(() => window.shell.getAnnotationFrameContext().document.body.dataset.activePanel), 'details');
  const nodesBeforeKeys = await page.evaluate(() => JSON.stringify(document.getElementById('mainIframe').contentWindow.protaCanvas.getState().nodes));
  await page.frameLocator('#mainIframe').locator('#stage').focus();
  await page.keyboard.press('Delete');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => JSON.stringify(document.getElementById('mainIframe').contentWindow.protaCanvas.getState().nodes)), nodesBeforeKeys, 'annotation blocks canvas edit shortcuts');

  // --- 2. Hover highlights real board DOM --------------------------------
  console.log('Annotation scenario 2');
  await page.mouse.move(pointA.x - 30, pointA.y - 30);
  await page.mouse.move(pointA.x, pointA.y, { steps: 4 });
  await page.locator('.annotation-hover-box').waitFor({ state: 'visible' });
  assert.ok((await page.locator('.annotation-hover-box__label').textContent()).includes('submit-button'));

  // --- 3. Click opens the annotation dialog, save persists board target ---
  console.log('Annotation scenario 3');
  await page.mouse.click(pointA.x, pointA.y);
  await page.locator('.annotation-dialog').waitFor({ state: 'visible' });
  await page.evaluate(() => window.shell.selectParentAnnotationElement());
  assert.equal(await page.evaluate(() => window.shell.pendingAnnotation.element.ownerDocument === window.shell.getAnnotationFrameContext().document), true, 'parent selection stays in board document');
  await page.evaluate(() => window.shell.selectChildAnnotationElement());
  assert.equal(await page.evaluate(() => window.shell.pendingAnnotation.selector), '#submit-button', 'child selection returns to board button');
  await page.locator('.annotation-dialog__textarea').fill('按钮需要增加加载状态');
  await page.locator('.annotation-dialog__save').click();
  await wait(() => page.evaluate(() => window.shell.currentAnnotations.length === 1), 'annotation stored in memory');
  const storedA = await page.evaluate(() => window.shell.currentAnnotations[0]);
  assert.equal(storedA.selector, '#submit-button');
  assert.equal(storedA.target.type, 'canvas-board');
  assert.equal(storedA.target.boardId, 'board_a');
  assert.equal(storedA.target.boardPath, 'boards/board_a/index.html');
  let disk = await readAnnotationsFile('v1');
  assert.equal(disk.length, 1);
  assert.equal(disk[0].target.boardId, 'board_a');

  // --- 4. Other boards and the editor are never selectable ---------------
  console.log('Annotation scenario 4');
  await page.mouse.click(pointB.x, pointB.y);
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.annotation-dialog').isVisible(), false, 'other board stays unannotatable');
  assert.equal(await page.evaluate(() => Boolean(window.shell.pendingAnnotation)), false, 'no pending annotation from another board');

  // --- 5. Single right click exits annotation, board stays activated -----
  console.log('Annotation scenario 5');
  await rightClick(pointA.x, pointA.y);
  await wait(async () => {
    const next = await shellState();
    return !next.mode && next.target === null;
  }, 'portal exits annotation mode with the canvas');
  state = await canvasState();
  assert.equal(state.interacting, 1, 'board remains activated after exiting annotation');

  // --- 6. Single right click still opens the (deferred) board menu -------
  console.log('Annotation scenario 6');
  await rightClick(pointA.x, pointA.y);
  const canvasMenu = page.frameLocator('#mainIframe').locator('#context-menu');
  await canvasMenu.waitFor({ state: 'visible' });
  assert.equal(await canvasMenu.getByRole('menuitem').count() > 0, true, 'deferred board menu keeps regular actions');
  assert.equal((await canvasState()).interacting, 1, 'deferred menu preserves board activation');
  await closeCanvasMenu();
  await canvasMenu.waitFor({ state: 'hidden' });

  // --- 7. Gesture resets: timeout, cross-board, distance -----------------
  console.log('Annotation scenario 7');
  // Timeout: one click then nothing → the deferred menu opens, never annotation.
  await rightClick(pointA.x, pointA.y);
  await canvasMenu.waitFor({ state: 'visible' });
  assert.equal(await isAnnotating(), false, 'timeout leaves the gesture unfinished');
  await leavePreview();
  // Cross-board: click A then B does not accumulate into one gesture.
  await rightClick(pointA.x, pointA.y);
  await rightClick(pointB.x, pointB.y);
  await page.waitForTimeout(560);
  state = await canvasState();
  assert.equal(state.annotation.active, false, 'cross-board clicks never enter annotation');
  assert.equal(state.interacting, 1, 'last clicked board owns the activation');
  // Distance: two clicks 40px apart on an active board restart the count.
  await rightClick(pointB.x, pointB.y);
  await rightClick(pointB.x + 40, pointB.y);
  await page.waitForTimeout(560);
  assert.equal(await isAnnotating(), false, 'beyond 12px resets the gesture');
  await leavePreview();

  // --- 8. Two clicks on an already-active board; Esc exits from both docs -
  console.log('Annotation scenario 8');
  await rightClick(pointA.x, pointA.y); // activate A, sequence discarded
  await page.waitForTimeout(560); // gesture window expires, menu opens
  await closeCanvasMenu();
  await rightClick(pointA.x, pointA.y);
  assert.equal(await isAnnotating(), false, 'one click on an active board is not enough');
  await rightClick(pointA.x, pointA.y);
  await wait(isAnnotating, 'two clicks on an active board enter annotation');
  await dispatchEscape('board');
  await wait(async () => !(await isAnnotating()), 'esc inside board exits annotation');
  assert.equal((await canvasState()).interacting, 1, 'esc keeps the board activated');
  await rightClick(pointA.x, pointA.y);
  await rightClick(pointA.x, pointA.y);
  await wait(isAnnotating, 're-enter for canvas-level esc');
  await dispatchEscape('canvas');
  await wait(async () => !(await isAnnotating()), 'esc on canvas exits annotation');
  await leavePreview();

  // --- 9. Same selector on two boards stays independent -------------------
  console.log('Annotation scenario 9');
  await enterAnnotation(pointB);
  assert.equal((await canvasState()).annotation.boardId, 'board_b');
  await page.mouse.click(pointB.x, pointB.y);
  await page.locator('.annotation-dialog').waitFor({ state: 'visible' });
  await page.locator('.annotation-dialog__textarea').fill('B 画板同名按钮的独立标注');
  await page.locator('.annotation-dialog__save').click();
  await wait(() => page.evaluate(() => window.shell.currentAnnotations.length === 2), 'two board annotations coexist');
  await rightClick(pointB.x, pointB.y); // exit annotation
  await wait(async () => !(await isAnnotating()), 'B exit before A update');
  // Board A update: same selector must update A's record, never B's.
  await enterAnnotation(pointA);
  await page.mouse.click(pointA.x, pointA.y);
  await page.locator('.annotation-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.annotation-dialog__textarea').inputValue(), '按钮需要增加加载状态', 'board A record is prefetched, not board B');
  await page.locator('.annotation-dialog__textarea').fill('按钮需要增加加载状态（更新）');
  await page.locator('.annotation-dialog__save').click();
  await page.waitForTimeout(150);
  const bothBoards = await page.evaluate(() => window.shell.currentAnnotations.map(a => ({ board: a.target?.boardId, text: a.description })));
  assert.deepEqual(bothBoards.sort((x, y) => x.board.localeCompare(y.board)), [
    { board: 'board_a', text: '按钮需要增加加载状态（更新）' },
    { board: 'board_b', text: 'B 画板同名按钮的独立标注' }
  ], 'boardId + selector matching keeps records independent');
  await persistAnnotations();
  disk = await readAnnotationsFile('v1');
  assert.equal(disk.length, 2);
  await rightClick(pointA.x, pointA.y); // exit annotation

  // --- 10. Markers stay accurate through zoom and pan --------------------
  console.log('Annotation scenario 10');
  await page.evaluate(() => window.shell.openDocumentDrawer('annotations'));
  await page.locator('.annotation-marker').first().waitFor({ state: 'visible' });
  const expectMarker = async label => {
    const expected = await page.evaluate(() => {
      const shell = window.shell;
      const item = shell.visibleAnnotations.find(item => item.annotation.target.boardId === 'board_a');
      const mainRect = document.getElementById('mainIframe').getBoundingClientRect();
      const frame = item.context.iframe.getBoundingClientRect();
      const scaleX = frame.width / Math.max(1, item.context.window.innerWidth);
      const scaleY = frame.height / Math.max(1, item.context.window.innerHeight);
      const btn = item.element.getBoundingClientRect();
      const x = mainRect.left + frame.left + Math.max(0, btn.left) * scaleX;
      const y = mainRect.top + frame.top + Math.max(0, btn.top) * scaleY;
      const right = mainRect.left + frame.left + Math.min(item.context.window.innerWidth, btn.right) * scaleX;
      const bottom = mainRect.top + frame.top + Math.min(item.context.window.innerHeight, btn.bottom) * scaleY;
      return { x, y, w: right - x, h: bottom - y };
    });
    const box = await page.locator('.annotation-marker').filter({ has: page.locator('[data-annotation-marker="0"]') }).boundingBox();
    assert.ok(box, 'marker box exists ' + label);
    assert.ok(Math.abs(box.x - expected.x) <= 8, `${label}: marker x ${box.x} ≈ ${expected.x}`);
    assert.ok(Math.abs(box.y - expected.y) <= 8, `${label}: marker y ${box.y} ≈ ${expected.y}`);
    assert.ok(Math.abs(box.width - expected.w) <= 10, `${label}: marker width ${box.width} ≈ ${expected.w}`);
    assert.ok(Math.abs(box.height - expected.h) <= 10, `${label}: marker height ${box.height} ≈ ${expected.h}`);
  };
  await expectMarker('zoom 100%');
  await page.evaluate(() => window.shell.setAnnotationListScope('current'));
  assert.deepEqual(await page.evaluate(() => window.shell.getAnnotationDrawerItems().map(item => item.annotation.target.boardId)), ['board_a'], 'current list only shows the active board');
  await page.evaluate(() => window.shell.setAnnotationListScope('all'));
  assert.equal(await page.evaluate(() => window.shell.getAnnotationDrawerItems().length), 2, 'all list includes both boards');
  await page.evaluate(() => {
    const frame = document.getElementById('mainIframe').contentWindow.protaCanvas.getBoardFrame('board_a').iframe;
    frame.contentDocument.body.style.minHeight = '1200px';
    frame.contentWindow.scrollTo(0, 12);
  });
  await page.waitForTimeout(150);
  await expectMarker('board document scrolled');
  await page.evaluate(() => document.getElementById('mainIframe').contentWindow.protaCanvas.getBoardFrame('board_a').iframe.contentWindow.scrollTo(0, 75));
  await page.waitForTimeout(150);
  await expectMarker('element clipped by board viewport');
  await page.evaluate(() => document.getElementById('mainIframe').contentWindow.protaCanvas.getBoardFrame('board_a').iframe.contentWindow.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const zoomTo = async targetZoom => {
    const anchor = await boardPoint('board_a');
    await page.evaluate(({ targetZoom, anchor }) => {
      const main = document.getElementById('mainIframe'), base = main.getBoundingClientRect();
      const canvas = main.contentWindow;
      const deltaY = -Math.log(targetZoom / canvas.protaCanvas.getState().viewport.zoom) / 0.008;
      canvas.document.querySelector('#stage').dispatchEvent(new WheelEvent('wheel', { deltaY, ctrlKey: true, clientX: anchor.x - base.left, clientY: anchor.y - base.top, bubbles: true, cancelable: true }));
    }, { targetZoom, anchor });
    await page.waitForTimeout(200);
    assert.ok(Math.abs(await page.evaluate(() => document.getElementById('mainIframe').contentWindow.protaCanvas.getState().viewport.zoom) - targetZoom) < 0.001);
  };
  await zoomTo(1);
  await expectMarker('zoom 100%');
  await zoomTo(2);
  await expectMarker('zoom 200%');
  await zoomTo(0.5);
  await expectMarker('zoom 50%');
  await page.evaluate(() => {
    const canvas = document.getElementById('mainIframe').contentWindow;
    canvas.document.querySelector('#stage').dispatchEvent(new WheelEvent('wheel', { deltaX: 160, deltaY: 90, shiftKey: true, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(320);
  await expectMarker('panned');

  // --- 11. Historical locate focuses the owning board --------------------
  console.log('Annotation scenario 11');
  await page.evaluate(() => window.shell.focusAnnotationFromCard(1));
  await wait(() => page.evaluate(() => window.shell.activeAnnotationSourceIndex === 1), 'card focus');
  await page.waitForTimeout(450); // canvas focus animation
  const focusedBoard = await page.evaluate(() => {
    const canvas = document.getElementById('mainIframe').contentWindow;
    const stage = canvas.document.querySelector('#stage').getBoundingClientRect();
    return ['board_a', 'board_b'].map(id => {
      const r = canvas.protaCanvas.getBoardFrame(id).iframe.getBoundingClientRect();
      return { id, center: Math.hypot(r.left + r.width / 2 - (stage.left + stage.width / 2), r.top + r.height / 2 - (stage.top + stage.height / 2)) };
    }).sort((a, b) => a.center - b.center)[0].id;
  });
  assert.equal(focusedBoard, 'board_b', 'locate centers the owning board');
  assert.equal(await page.evaluate(() => {
    const shell = window.shell;
    const idx = shell.activeAnnotationSourceIndex;
    const node = shell._annotationMarkerNodes.get(shell.getAnnotationMarkerKey(shell.currentAnnotations[idx], idx));
    return node ? node.wrapper.classList.contains('is-active') : false;
  }), true, 'located annotation marker is active');

  // --- 12. Delete removes only its own board record ----------------------
  console.log('Annotation scenario 12');
  await page.evaluate(() => window.shell.deleteAnnotation(1));
  await wait(() => page.evaluate(() => window.shell.currentAnnotations.length === 1), 'delete annotation');
  await persistAnnotations();
  disk = await readAnnotationsFile('v1');
  assert.deepEqual(disk.map(a => a.target.boardId), ['board_a'], 'delete keeps the other board record');

  // --- 13. Feedback to the Agent carries board context -------------------
  console.log('Annotation scenario 13');
  await page.evaluate(() => document.getElementById('mainIframe').contentWindow.protaCanvas.focus(['node_a']));
  await page.waitForTimeout(300);
  const feedbackPoint = await boardPoint('board_a');
  await enterAnnotation(feedbackPoint);
  await page.mouse.click(feedbackPoint.x, feedbackPoint.y);
  await page.locator('.annotation-dialog').waitFor({ state: 'visible' });
  await page.locator('.annotation-dialog__textarea').fill('把提交按钮改成胶囊形状');
  await page.locator('.annotation-dialog__add-feedback').click();
  await page.locator('#agentFeedbackBar').waitFor({ state: 'visible' });
  await page.evaluate(() => {
    window.__agentRuns = [];
    window.shell.startAgentRun = async (kind, payload = {}) => {
      window.__agentRuns.push({ kind, message: payload.message || '' });
      return false;
    };
    window.shell.agentInput.value = '请处理以上反馈';
  });
  await page.evaluate(() => window.shell.submitAgentMessage());
  await wait(() => page.evaluate(() => window.__agentRuns.length === 1), 'agent run captured');
  const agentMessage = await page.evaluate(() => window.__agentRuns[0].message);
  assert.ok(agentMessage.includes('#submit-button'));
  assert.ok(agentMessage.includes('**所属画板**: `board_a`'));
  assert.ok(agentMessage.includes('boards/board_a/index.html'));
  assert.ok(agentMessage.includes('把提交按钮改成胶囊形状'));
  assert.equal(await page.evaluate(() => window.shell.feedbackItems.length), 0, 'feedback consumed once');

  // --- 14. Normal pages keep the original annotation flow ---------------
  console.log('Annotation scenario 14');
  await page.evaluate(() => window.shell.switchPage('normal', 'v1'));
  await wait(() => page.evaluate(() => Boolean(document.getElementById('mainIframe').contentWindow.location.pathname.includes('/normal/') && document.getElementById('mainIframe').contentDocument.getElementById('__readify_shortcut_bridge'))), 'normal page loaded with shortcut bridge');
  const normalBox = await page.frameLocator('#mainIframe').locator('.placeholder-panel h1').boundingBox();
  const normalPoint = { x: normalBox.x + normalBox.width / 2, y: normalBox.y + normalBox.height / 2 };
  await rightClick(normalPoint.x, normalPoint.y);
  await rightClick(normalPoint.x, normalPoint.y);
  await wait(() => page.evaluate(() => window.shell.annotationMode), 'normal page double-right-click enters annotation');
  assert.equal(await page.evaluate(() => window.shell.canvasAnnotationTarget), null, 'normal pages never get a board target');
  assert.equal(await page.evaluate(() => Boolean(document.getElementById('mainIframe').contentDocument.getElementById('__readify_inspector_script'))), true, 'inspector back on the main iframe');

  await page.mouse.click(normalPoint.x, normalPoint.y);
  await page.locator('.annotation-dialog').waitFor({ state: 'visible' });
  await page.locator('.annotation-dialog__textarea').fill('普通手机页面标注');
  await page.locator('.annotation-dialog__save').click();
  assert.equal(await page.evaluate(() => window.shell.currentAnnotations[0].target), undefined);
  await page.evaluate(async () => { await window.shell.exitAnnotationMode(); await window.shell.switchPage('web', 'v1'); });
  await wait(() => page.evaluate(() => document.getElementById('mainIframe').contentWindow.location.pathname.includes('/web/') && Boolean(document.getElementById('mainIframe').contentDocument.getElementById('__readify_shortcut_bridge'))), 'web shortcut bridge');
  const webBox = await page.frameLocator('#mainIframe').locator('#submit-button').boundingBox();
  const webPoint = { x: webBox.x + webBox.width / 2, y: webBox.y + webBox.height / 2 };
  await rightClick(webPoint.x, webPoint.y);
  await rightClick(webPoint.x, webPoint.y);
  await wait(() => page.evaluate(() => window.shell.annotationMode && document.getElementById('mainIframe').contentWindow.__readifyInspecting), 'web inspector');
  await page.mouse.click(webPoint.x, webPoint.y);
  await page.locator('.annotation-dialog').waitFor({ state: 'visible' });
  await page.locator('.annotation-dialog__textarea').fill('普通 Web 页面标注');
  await page.locator('.annotation-dialog__save').click();
  assert.equal(await page.evaluate(() => window.shell.currentAnnotations[0].target), undefined);

  // --- 15. Old canvas runtime auto-upgrades to V8 ------------------------
  console.log('Annotation scenario 15');
  await page.evaluate(() => window.shell.switchPage('design', 'v2'));
  await wait(() => page.evaluate(() => {
    const editor = document.getElementById('mainIframe')?.contentWindow?.protaCanvas;
    return Boolean(editor && editor.runtimeVersion >= 8 && editor.getBoardFrame('board_a')?.iframe);
  }), 'legacy canvas upgraded to runtime v8');
  assert.equal(await fs.readFile(path.join(root, 'src/pages/demo/design/v2/boards/board_a/index.html'), 'utf8'), v2BoardBefore, 'board source untouched by upgrade');
  assert.equal(await fs.readFile(path.join(root, 'src/pages/demo/design/v2/canvas-data.js'), 'utf8'), v2DataBefore, 'canvas layout untouched by upgrade');
  assert.equal(await fs.readFile(path.join(root, 'src/pages/demo/design/v2/annotations.json'), 'utf8'), v2AnnotationsBefore, 'annotations untouched by upgrade');
  assert.ok((await fs.readFile(path.join(root, 'src/pages/demo/design/v2/.canvas-runtime-backup/app.js'), 'utf8')).includes('runtimeVersion:4'), 'old runtime backed up');
  // The upgraded canvas still resolves the historical board annotation.
  await wait(() => page.evaluate(() => window.shell.currentAnnotations.length === 1), 'legacy annotation loaded');
  assert.equal(await page.evaluate(() => window.shell.currentAnnotations[0].target.boardId), 'board_a');
  await page.evaluate(() => window.shell.openDocumentDrawer('annotations'));
  await page.locator('.annotation-marker').first().waitFor({ state: 'visible' });
  await page.evaluate(() => window.shell.focusAnnotationFromCard(0));
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => window.shell.activeAnnotationSourceIndex), 0, 'legacy annotation locates after upgrade');

  // Upgrade must be deferred while either the live editor or a recoverable
  // browser draft contains unsaved work, even for an explicitly forced repair.
  let upgradeRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/canvas/upgrade') upgradeRequests++; });
  await page.evaluate(async () => {
    const canvas = document.getElementById('mainIframe').contentWindow;
    const editor = canvas.protaCanvas, original = editor.isDirty;
    editor.isDirty = () => true;
    await window.shell.upgradeCanvasEditorIfNeeded({ force: true });
    editor.isDirty = original;
    const state = editor.getState();
    state.nodes.push({ id: 'unsaved-note', type: 'note', x: 10, y: 10, width: 120, height: 80, text: 'unsaved draft' });
    canvas.localStorage.setItem('prota-canvas-draft:' + canvas.location.pathname, JSON.stringify({ state }));
    await window.shell.upgradeCanvasEditorIfNeeded({ force: true });
  });
  assert.equal(upgradeRequests, 0, 'live dirty state and recovery drafts both defer repair');
  assert.equal(await page.evaluate(() => {
    const canvas = document.getElementById('mainIframe').contentWindow;
    return JSON.parse(canvas.localStorage.getItem('prota-canvas-draft:' + canvas.location.pathname)).state.nodes.at(-1).text;
  }), 'unsaved draft', 'upgrade never discards a recovery draft');
  await page.evaluate(() => {
    const canvas = document.getElementById('mainIframe').contentWindow;
    canvas.localStorage.removeItem('prota-canvas-draft:' + canvas.location.pathname);
  });

  assert.deepEqual(errors, []);
  console.log('PASS: infinite-canvas board annotation — gesture entry/exit, nested-iframe inspector, boardId+selector isolation, zoom/pan markers, locate, delete, agent feedback context, runtime v8 auto-upgrade, normal-page regression');
} finally {
  await browser?.close();
  for (const child of children) child.kill();
  if (!process.env.PROTA_KEEP_ANNOTATION_FIXTURE) await fs.rm(temp, { recursive: true, force: true });
}
