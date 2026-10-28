// Debug helper for the annotation e2e setup.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const app = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-canvas-debug-'));
const root = path.join(temp, 'workspace');
const config = path.join(temp, 'config');
const write = async (relative, content) => { const file = path.join(root, relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content); };
const freePort = () => new Promise(resolve => { const server = net.createServer().listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const wait = async (predicate, label) => { for (let i = 0; i < 150; i++) { try { if (await predicate()) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw Error(`Timed out: ${label}`); };

const boardHtml = (id, label) => `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px}</style><h1>${label}</h1><div><button id="submit-button">${label}提交</button></div>`;
try {
  await fs.cp(path.join(app, 'src/templates/infinite-canvas'), path.join(root, 'src/pages/demo/design/v1'), { recursive: true });
  await write('src/pages/demo/design/v1/boards/board_a/index.html', boardHtml('board_a', '画板 A'));
  await write('src/pages/demo/design/v1/boards/board_b/index.html', boardHtml('board_b', '画板 B'));
  await write('src/pages/demo/design/v1/canvas-data.js', 'window.PROTA_CANVAS = ' + JSON.stringify({ schemaVersion: 1, revision: 0, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [
    { id: 'node_a', type: 'board', name: '画板 A', x: 40, y: 40, width: 360, height: 240, src: 'boards/board_a/index.html' },
    { id: 'node_b', type: 'board', name: '画板 B', x: 460, y: 40, width: 360, height: 240, src: 'boards/board_b/index.html' }
  ] }) + ';');
  await write('workspace.json', JSON.stringify({ id: 'debug', formatVersion: 1 }));
  await write('data/projects.json', JSON.stringify({ projects: [{ id: 'demo', name: 'D', pages: [{ id: 'design', name: 'Canvas', targetDevice: 'canvas', pageMode: 'infinite-canvas', versions: ['v1'], activeVersion: 'v1' }] }], activeProjectId: 'demo', activePageId: 'design' }));
  await fs.mkdir(config, { recursive: true });
  await fs.writeFile(path.join(config, 'workspace.json'), JSON.stringify({ path: root }));
  await fs.writeFile(path.join(config, 'agent-provider-config.json'), JSON.stringify({ providers: [], activeProviderId: '', selectedProviderId: '' }));

  const bridgePort = await freePort(), agentPort = await freePort();
  const base = `http://127.0.0.1:${bridgePort}`;
  const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', READIFY_CONFIG_DIR: config, READIFY_WORKSPACE: root, READIFY_PORT: String(bridgePort), READIFY_AGENT_PORT: String(agentPort) };
  const children = [];
  for (const [command, args] of [['python3', ['server/bridge.py']], ['node', ['server/agent-server.mjs']]]) {
    const child = spawn(command, args, { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stderr.on('data', c => process.stderr.write('[srv] ' + c));
    children.push(child);
  }
  await wait(async () => { try { return (await fetch(`${base}/api/workspace`)).ok; } catch { return false; } }, 'bridge');
  await fetch(`${base}/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
  await page.route(/http:\/\/(localhost|127\.0\.0\.1):8081\//, route => route.continue({ url: route.request().url().replace(/:8081\//, `:${agentPort}/`) }));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('readify:top-view', 'page');
      localStorage.setItem('readify:top-view:debug', 'page');
    } catch {}
  });
  await page.goto(`${base}/portal/index.html`, { waitUntil: 'domcontentloaded' });
  await wait(() => page.evaluate(() => Boolean(window.shell?.projects?.projects?.length)), 'shell metadata');
  await page.waitForTimeout(3000);
  const before = await page.evaluate(() => ({ top: window.shell?.currentTopView, view: window.shell?.currentView, stored: window.shell?.readShellNavigationState?.() }));
  console.log('before:', JSON.stringify(before));
  await page.evaluate(async () => { window.shell.switchTopView('page'); await window.shell.switchPage('design', 'v1'); });
  await page.waitForTimeout(1500);
  // Probe: instrument the canvas contextmenu path, then right-click board A's button.
  const probe = await page.evaluate(() => {
    const canvas = document.getElementById('mainIframe').contentWindow;
    const doc = canvas.document;
    window.__cm = [];
    doc.querySelector('#stage').addEventListener('contextmenu', e => {
      window.__cm.push({ target: e.target.className || e.target.tagName, closestNode: e.target.closest('.node')?.dataset?.id || null, defaultPrevented: e.defaultPrevented });
    }, { capture: true });
    const pt = (() => {
      const { iframe } = canvas.protaCanvas.getBoardFrame('board_a');
      const frame = iframe.getBoundingClientRect();
      const scale = frame.width / Math.max(1, iframe.contentWindow.innerWidth);
      const btn = iframe.contentDocument.querySelector('#submit-button').getBoundingClientRect();
      return { x: frame.left + (btn.left + btn.width / 2) * scale, y: frame.top + (btn.top + btn.height / 2) * scale, frame: { left: frame.left, top: frame.top, width: frame.width } };
    })();
    window.__pt = pt;
    return pt;
  });
  console.log('point:', JSON.stringify(probe));
  const occlusion = await page.evaluate(pt => {
    const el = document.elementFromPoint(pt.x, pt.y);
    const iframe = document.getElementById('mainIframe');
    const sidebar = document.querySelector('aside.sidebar');
    const stage = document.querySelector('.viewport-stage');
    const rect = target => { const r = target?.getBoundingClientRect(); return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null; };
    return {
      hit: el ? `${el.tagName}.${String(el.className).slice(0, 40)}` : null,
      iframe: rect(iframe), sidebar: rect(sidebar), stage: rect(stage),
      sidebarZ: sidebar ? getComputedStyle(sidebar).zIndex : null,
      sidebarPos: sidebar ? getComputedStyle(sidebar).position : null
    };
  }, probe);
  console.log('occlusion:', JSON.stringify(occlusion, null, 2));
  await page.evaluate(() => {
    window.__parentCm = [];
    document.addEventListener('contextmenu', e => {
      const chain = [];
      let el = e.target;
      for (let i = 0; i < 4 && el; i++, el = el.parentElement) chain.push(el.className ? `${el.tagName}.${String(el.className).slice(0, 40)}` : el.tagName);
      window.__parentCm.push({ x: e.clientX, y: e.clientY, chain });
    }, { capture: true });
  });
  await page.mouse.click(probe.x, probe.y, { button: 'right' });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    parentCm: window.__parentCm,
    interacting: document.getElementById('mainIframe').contentWindow.document.querySelectorAll('.node.interacting').length,
    annotation: document.getElementById('mainIframe').contentWindow.protaCanvas.getAnnotationState(),
    menuHidden: document.getElementById('mainIframe').contentWindow.document.querySelector('#context-menu').hidden,
    hint: document.getElementById('mainIframe').contentWindow.document.querySelector('#interaction-hint').textContent
  }));
  console.log('after right click:', JSON.stringify(after, null, 2));
  const diag = await page.evaluate(() => {
    const frame = document.getElementById('mainIframe');
    const canvas = frame?.contentWindow;
    let board = null;
    try {
      const b = canvas?.protaCanvas?.getBoardFrame?.('board_a');
      board = b ? { hasIframe: Boolean(b.iframe), src: b.iframe?.src, btn: Boolean(b.iframe?.contentDocument?.querySelector('#submit-button')) } : null;
    } catch (e) { board = String(e); }
    return {
      iframeSrc: frame?.src,
      readyState: canvas?.document?.readyState,
      runtimeVersion: canvas?.protaCanvas?.runtimeVersion,
      hasRuntime: Boolean(canvas?.protaCanvas),
      dataReady: canvas?.document?.documentElement?.dataset?.protaCanvasReady,
      board,
      activePage: window.shell?.activePageId,
      activeVersion: window.shell?.activeVersion
    };
  });
  console.log(JSON.stringify(diag, null, 2));
  await page.screenshot({ path: path.join(process.cwd(), 'debug-annotation.png') });
  await browser.close();
  for (const c of children) c.kill();
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
