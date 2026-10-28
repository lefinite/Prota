// Reproducible v4 baseline; all writes go to a throwaway workspace.
// Usage: node tests/canvas-performance.browser.mjs [--runtime-ref=HEAD] [--output=/absolute/report.json]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const app = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'prota-canvas-performance-'));
const root = path.join(temp, 'workspace');
const output = path.resolve(process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || path.join(temp, 'report.json'));
const scenarioFilter = process.argv.find(arg => arg.startsWith('--scenario='))?.slice(11);
const runtimeRef = process.argv.find(arg => arg.startsWith('--runtime-ref='))?.slice(14);
const runtimeSource = path.join(temp, 'runtime');
const percentile = values => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * .95) - 1)];
const port = await new Promise((resolve, reject) => {
  const server = net.createServer(); server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
});
const base = `http://127.0.0.1:${port}`;
let child, browser, logs = '';
const report = {
  recordedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: app, encoding: 'utf8' }).trim(),
  runtimeSource: runtimeRef ? execFileSync('git', ['rev-parse', '--verify', runtimeRef + '^{commit}'], { cwd: app, encoding: 'utf8' }).trim() : 'working-tree',
  backendSource: 'working-tree; --runtime-ref selects only the frontend template',
  dirtyFiles: execFileSync('git', ['status', '--short'], { cwd: app, encoding: 'utf8' }).trim().split('\n').filter(Boolean),
  machine: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, cores: os.cpus().length, memoryBytes: os.totalmem(), node: process.version },
  viewport: { width: 1440, height: 1000 },
  scenarioFilter: scenarioFilter || null,
  methodology: {
    ready: 'navigation start to runtime API ready plus two animation frames; excludes loading offscreen lazy iframes',
    frame: 'requestAnimationFrame intervals during 48 pan and 48 Ctrl-wheel inputs; includes automation scheduling',
    input: 'browser event timestamp to next animation frame; not OS-to-photon latency',
    memory: 'largest sampled Performance.getMetrics JSHeapUsedSize for main page; not total browser/process peak',
    save: 'five real /api/canvas/save round trips including layout history; excludes 300ms debounce',
    refresh: 'reloadFromDisk(false, {targetIds:[id]}) through existing Agent completion path; asserts other iframe element identity',
    capacity: '3000 nodes must be rejected by v4; not a successful performance measurement',
  },
  scenarios: [],
};

try {
  if (runtimeRef) {
    const prefix = 'src/templates/infinite-canvas/';
    const files = execFileSync('git', ['ls-tree', '-r', '--name-only', report.runtimeSource, '--', prefix], { cwd: app, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    assert.ok(files.length, 'runtime reference must contain the infinite-canvas template');
    for (const file of files) {
      const target = path.join(runtimeSource, file.slice(prefix.length));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, execFileSync('git', ['show', `${report.runtimeSource}:${file}`], { cwd: app }));
    }
  }
  await fs.mkdir(path.join(root, 'data'), { recursive: true });
  await fs.writeFile(path.join(root, 'workspace.json'), JSON.stringify({ id: 'canvas-baseline', formatVersion: 1 }));
  await fs.writeFile(path.join(root, 'data/projects.json'), JSON.stringify({ projects: [] }));
  child = spawn('python3', ['server/bridge.py'], { cwd: app, env: { ...process.env, READIFY_WORKSPACE: root, READIFY_CONFIG_DIR: path.join(temp, 'config'), READIFY_PORT: String(port), PYTHONDONTWRITEBYTECODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => logs += data); child.stderr.on('data', data => logs += data);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base + '/api/workspace')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, logs);
  browser = await chromium.launch({ headless: true });
  report.browser = browser.version();
  for (const [count, boards] of [[50, 0], [200, 0], [1000, 0], [3000, 0], [50, 5], [200, 20], [1000, 50]]) {
    if (scenarioFilter && scenarioFilter !== `${count}:${boards}`) continue;
    const id = `nodes_${count}_boards_${boards}`;
    const directory = path.join(root, 'src/pages/baseline', id, 'v1');
    await fs.cp(runtimeRef ? runtimeSource : path.join(app, 'src/templates/infinite-canvas'), directory, { recursive: true });
    const state = { schemaVersion: 1, revision: 0, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [] };
    for (let i = 0; i < count; i++) {
      const node = { id: `n_${i}`, type: i < boards ? 'board' : 'rect', name: `Node ${i}`, x: (i % 10) * 420, y: Math.floor(i / 10) * 900, width: 390, height: 844 };
      if (i < boards) {
        node.src = `boards/${node.id}/index.html`;
        const board = path.join(directory, 'boards', node.id);
        await fs.mkdir(board, { recursive: true });
        await fs.writeFile(path.join(board, 'index.html'), '<!doctype html><html><title>Baseline</title><button onclick="this.textContent=Number(this.textContent)+1">0</button></html>');
      }
      state.nodes.push(node);
    }
    await fs.writeFile(path.join(directory, 'canvas-data.js'), `window.PROTA_CANVAS = ${JSON.stringify(state)};\n`);
    const context = await browser.newContext({ viewport: report.viewport });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/src/pages/baseline/${id}/v1/index.html`);
    await page.waitForFunction(() => Boolean(window.protaCanvas));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const row = { count, boards, readyMs: await page.evaluate(() => performance.now()) };
    if (count > 1000) {
      assert.equal(await page.locator('body.readonly').count(), 1);
      assert.equal(await page.locator('#world .node').count(), 0);
      const response = await page.request.post(base + '/api/canvas/save', { data: { projectId: 'baseline', pageId: id, version: 'v1', revision: 0, baseline: state, state } });
      assert.equal(response.status(), 400);
      row.status = 'capacity-rejected'; row.saveStatus = response.status();
    } else {
      assert.equal(await page.locator('#world .node').count(), count);
      row.status = 'measured';
      const session = await context.newCDPSession(page); await session.send('Performance.enable');
      const memory = [];
      const sampleMemory = async () => memory.push((await session.send('Performance.getMetrics')).metrics.find(metric => metric.name === 'JSHeapUsedSize').value);
      await sampleMemory();
      row.zooms = [];
      for (const zoom of [.1, 1, 2]) {
        // Set only the remembered view and reload: business files are never changed.
        await page.evaluate(zoom => sessionStorage.setItem(`prota-canvas-draft:${location.pathname}:view`, JSON.stringify({ x: 40, y: 40, zoom })), zoom);
        await page.reload(); await page.waitForFunction(() => Boolean(window.protaCanvas));
        await page.evaluate(() => {
          window.baselineTimings = { frames: [], input: [], running: true };
          let previous;
          const tick = now => { if (previous !== undefined) baselineTimings.frames.push(now - previous); previous = now; if (baselineTimings.running) requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
          document.querySelector('#stage').addEventListener('wheel', event => requestAnimationFrame(() => baselineTimings.input.push(performance.now() - event.timeStamp)), { passive: true });
        });
        await page.mouse.move(900, 500);
        for (let i = 0; i < 48; i++) await page.mouse.wheel(i % 2 ? -16 : 16, 8);
        await page.keyboard.down('Control');
        try { for (let i = 0; i < 48; i++) await page.mouse.wheel(0, i % 2 ? -4 : 4); } finally { await page.keyboard.up('Control'); }
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        const timings = await page.evaluate(() => { baselineTimings.running = false; return baselineTimings; });
        assert.ok(timings.frames.length > 20 && timings.input.length > 20);
        row.zooms.push({ zoom, frameP95Ms: percentile(timings.frames), inputP95Ms: percentile(timings.input), frameSamples: timings.frames.length, inputSamples: timings.input.length });
        await sampleMemory();
      }
      // Real selection and drag, with undo to leave the generated baseline intact.
      await page.evaluate(() => sessionStorage.setItem(`prota-canvas-draft:${location.pathname}:view`, JSON.stringify({ x: 40, y: 40, zoom: 1 })));
      await page.reload(); await page.waitForFunction(() => Boolean(window.protaCanvas));
      let started = performance.now();
      await page.mouse.move(30, 110); await page.mouse.down(); await page.mouse.move(870, 920, { steps: 20 }); await page.mouse.up();
      row.marqueeMs = performance.now() - started;
      await page.keyboard.press('Escape');
      started = performance.now();
      await page.mouse.move(200, 300); await page.mouse.down(); await page.mouse.move(250, 330, { steps: 20 }); await page.mouse.up();
      row.dragMs = performance.now() - started;
      assert.ok(await page.evaluate(() => window.protaCanvas.isDirty()), 'drag must modify the layout');
      await page.evaluate(() => window.protaCanvas.save());
      assert.equal(await page.evaluate(() => window.protaCanvas.isDirty()), false);
      if (boards) {
        await page.waitForFunction(() => document.querySelector('.node[data-id="n_0"] iframe')?.contentDocument?.querySelector('button'));
        await page.evaluate(() => { window.baselineUntouchedFrame = document.querySelector('.node[data-id="n_1"] iframe'); });
        const loaded = page.waitForEvent('framenavigated', { predicate: frame => frame.url().includes('/boards/n_0/') });
        started = performance.now();
        await page.evaluate(() => window.protaCanvas.reloadFromDisk(false, { targetIds: ['n_0'] }));
        await loaded; row.localRefreshMs = performance.now() - started;
        assert.equal(await page.evaluate(() => baselineUntouchedFrame === document.querySelector('.node[data-id="n_1"] iframe')), true);
      }
      row.mountedIframes = await page.locator('iframe').count();
      row.loadedIframes = await page.locator('iframe').evaluateAll(frames => frames.filter(frame => frame.contentDocument?.readyState === 'complete' && frame.contentDocument?.querySelector('button')).length);
      const saveTimes = [];
      for (let i = 0; i < 5; i++) {
        const source = await fs.readFile(path.join(directory, 'canvas-data.js'), 'utf8');
        const baseline = JSON.parse(source.slice('window.PROTA_CANVAS = '.length).trim().replace(/;$/, ''));
        const next = structuredClone(baseline); next.nodes.at(-1).x += 1;
        started = performance.now();
        const response = await page.request.post(base + '/api/canvas/save', { data: { projectId: 'baseline', pageId: id, version: 'v1', revision: baseline.revision, baseline, state: next } });
        assert.equal(response.status(), 200, await response.text()); saveTimes.push(performance.now() - started);
      }
      row.saveP95Ms = percentile(saveTimes); await sampleMemory(); row.sampledMainPageHeapPeakBytes = Math.max(...memory);
    }
    assert.deepEqual(errors, []); report.scenarios.push(row);
    console.log(JSON.stringify(row)); await context.close();
  }
  assert.ok(report.scenarios.length, 'No matching scenario; use --scenario=<nodes>:<boards>');
  report.status = 'complete';
} catch (error) {
  report.status = 'failed'; report.error = error.stack; throw error;
} finally {
  await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  if (child && child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve)); child.kill();
    await exited;
  }
  if (report.status === 'complete') await fs.rm(temp, { recursive: true, force: true });
  // The default output lives in temp; preserve it even after successful cleanup.
  await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Report: ${output}`);
}
