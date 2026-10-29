import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import '../src/templates/infinite-canvas/canvas-core.js';
import { CANVAS_FEATURE_DEFAULTS, resolveCanvasFeatures } from '../server/canvas-features.mjs';

test('shipped board versions default on and experimental features require explicit workspaces', () => {
  assert.equal(Object.keys(CANVAS_FEATURE_DEFAULTS).length, 12);
  assert.equal(resolveCanvasFeatures().canvasSchemaV2, true);
  assert.equal(resolveCanvasFeatures().boardRevisions, true);
  assert.equal(resolveCanvasFeatures().canvasVirtualization, false);
  const options = { workspaceId: 'business', testWorkspaceIds: ['test'], overrides: { boardRevisions: true } };
  assert.equal(resolveCanvasFeatures(options).boardRevisions, true);
  const flags = resolveCanvasFeatures({ ...options, workspaceId: 'test', overrides: { boardRevisions: true, canvasSchemaV2: 'true', unknown: true } });
  assert.equal(flags.boardRevisions, true);
  assert.equal(flags.canvasSchemaV2, false);
  assert.equal('unknown' in flags, false);
  assert.equal(Object.isFrozen(flags), true);
  assert.equal(CANVAS_FEATURE_DEFAULTS.boardRevisions, true);
});

test('archived v1 fixture loads without changing IDs, hierarchy, source, or viewport', async () => {
  const context = { window: {} };
  vm.runInNewContext(await fs.readFile(new URL('./fixtures/canvas-v1/canvas-data.js', import.meta.url), 'utf8'), context);
  const state = JSON.parse(JSON.stringify(context.window.PROTA_CANVAS));
  const before = structuredClone(state);
  assert.equal(globalThis.CanvasCore.validate(state), state);
  assert.deepEqual(state, before);
  assert.deepEqual(state.nodes.map(node => node.id), ['home', 'details', 'label', 'reference']);
  assert.equal(state.nodes[2].parentId, 'details');
});

test('v4 capacity boundary stays explicit until S5 validates a higher budget', () => {
  const state = { schemaVersion: 1, revision: 0, viewport: { x: 0, y: 0, zoom: 1 }, nodes: Array.from({ length: 1000 }, (_, i) => ({ id: `n_${i}`, type: 'rect', x: i * 20, y: 0, width: 16, height: 16 })) };
  globalThis.CanvasCore.validate(state);
  state.nodes.push({ ...state.nodes[0], id: 'overflow' });
  assert.throws(() => globalThis.CanvasCore.validate(state));
});
