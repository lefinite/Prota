import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import '../src/templates/infinite-canvas/canvas-domain.js';
import '../src/templates/infinite-canvas/canvas-core.js';
const D = globalThis.CanvasDomain, C = globalThis.CanvasCore;
const legacy = () => ({ schemaVersion: 1, revision: 7, extra: { keep: true }, viewport: { x: -20, y: 10, zoom: .75 }, nodes: [
  { id: 'home', type: 'board', x: -100, y: 10, width: 390, height: 844, src: 'boards/home/index.html', custom: [1, 2] },
  { id: 'label', type: 'text', parentId: 'home', x: -80, y: 20, width: 200, height: 40, text: '你好' },
] });
const scope = { projectId: 'demo', pageId: 'design' };

test('migration is pure, repeatable, page scoped, and identical in Python', async () => {
  const source = legacy(), before = structuredClone(source);
  const state = await D.load(source, scope);
  assert.deepEqual(source, before);
  assert.equal(state.schemaVersion, 2); assert.equal(state.revision, 7);
  assert.deepEqual(state.edges, []); assert.deepEqual(state.extra, source.extra);
  assert.deepEqual(state.nodes[1], source.nodes[1]);
  assert.equal(state.nodes[0].boardRevisionId, null);
  assert.equal(state.nodes[0].src, source.nodes[0].src);
  assert.deepEqual(await D.load(source, { ...scope, version: 'v2' }), state);
  assert.deepEqual(await D.load(state, scope), state);
  assert.notEqual((await D.load(source, { ...scope, pageId: 'other' })).nodes[0].boardId, state.nodes[0].boardId);
  const python = execFileSync('python3', ['-c', 'import json,sys; from server.canvas_domain import migrate_document; x=json.load(sys.stdin); print(json.dumps(migrate_document(x, "demo", "design")))'], { input: JSON.stringify(source), env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(python), state);
});

test('indexes distinguish logical boards from instances and preserve source arrays', async () => {
  const state = await D.load(legacy(), scope);
  state.nodes.push({ ...state.nodes[0], id: 'linked' });
  const index = D.createIndex(state.nodes);
  assert.equal(index.byId.get('home'), state.nodes[0]);
  assert.deepEqual(index.children.get('home').map(n => n.id), ['label']);
  assert.deepEqual(index.boards.get(state.nodes[0].boardId).map(n => n.id), ['home', 'linked']);
});

test('independent copies get new board identity, origin and no fictional revision', async () => {
  const state = await D.load(legacy(), scope);
  state.nodes[0].boardRevisionId = 'br_old';
  state.nodes[0].boardVersionId = 'v3';
  const result = C.duplicate(state.nodes, ['home']);
  assert.notEqual(result.nodes[0].boardId, state.nodes[0].boardId);
  assert.equal(result.nodes[0].originBoardId, state.nodes[0].boardId);
  assert.equal(result.nodes[0].boardRevisionId, null);
  assert.equal(result.nodes[0].boardVersionId, undefined);
  assert.notEqual(result.nodes[0].id, state.nodes[0].id);
  assert.equal(result.nodes[1].parentId, result.nodes[0].id);
});

test('three way recovery retains independent top level and edge changes', async () => {
  const base = await D.load(legacy(), scope), local = structuredClone(base), remote = structuredClone(base);
  base.edges.push({ id: 'e_1', fromInstanceId: 'home', toInstanceId: 'home', label: 'before' });
  local.edges = structuredClone(base.edges); remote.edges = structuredClone(base.edges);
  local.extra.keep = false; local.edges[0].label = 'local'; remote.description = 'external'; remote.revision++;
  const merged = C.mergeDocuments(base, local, remote);
  assert.deepEqual(merged.conflicts, []); assert.equal(merged.state.extra.keep, false);
  assert.equal(merged.state.description, 'external'); assert.equal(merged.state.edges[0].label, 'local');
});

test('shared validation corpus agrees between frontend and backend', async () => {
  const state = await D.load(legacy(), scope);
  const cases = [state, legacy()];
  for (const edit of [
    s => s.nodes[0].boardId = '../escape', s => delete s.nodes[0].boardId,
    s => s.nodes[0].boardRevisionId = 7, s => s.nodes[0].boardVersionId = [], s => s.nodes[0].boardVersionId = 'v0', s => s.nodes[0].x = true,
    s => s.nodes[0].src = 'boards/../escape/index.html', s => s.nodes[1].parentId = 'label',
    s => s.nodes.push(structuredClone(s.nodes[0])), s => s.revision = -1,
    s => s.revision = null, s => s.nodes[0].id = 'bad\n', s => s.nodes[0].src += '\n', s => s.nodes[0].cloneFrom = [], s => s.viewport.x = 10000001, s => s.nodes[0].opacity = true,
    s => s.nodes[0].parentId = [], s => s.edges = {},
    s => s.edges = [{ id: 'e', fromInstanceId: 'home', toInstanceId: '../x' }],
    s => s.edges = [{ id: 'e', fromInstanceId: 'home', toInstanceId: 'home' }, { id: 'e', fromInstanceId: 'home', toInstanceId: 'home' }],
  ]) { const next = structuredClone(state); edit(next); cases.push(next); }
  const js = cases.map(value => { try { D.validate(value); return true; } catch { return false; } });
  assert.deepEqual(js, [true, true, ...Array(cases.length - 2).fill(false)]);
  const python = execFileSync('python3', ['-c', 'import json,sys; from server.canvas_domain import validate_document\ndef valid(s):\n try: validate_document(s); return True\n except (ValueError,TypeError): return False\nprint(json.dumps([valid(s) for s in json.load(sys.stdin)]))'], { input: JSON.stringify(cases), env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(python), js);
});

test('stable legacy identity matches platform SHA-256 across multi-block and UTF-8 namespaces', async () => {
  const { createHash } = await import('node:crypto');
  for (const [projectId, pageId] of [['a'.repeat(80), 'b'.repeat(80)], ['中文', '页面'], ['', '']]) {
    const state = await D.load(legacy(), { projectId, pageId });
    const expected = 'b_' + createHash('sha256').update(JSON.stringify(['prota-board-v1', projectId, pageId, 'home'])).digest('hex').slice(0, 32);
    assert.equal(state.nodes[0].boardId, expected);
  }
});

test('unknown JSON fields survive recovery without becoming object prototypes', async () => {
  const base = await D.load(legacy(), scope), local = structuredClone(base), remote = structuredClone(base);
  Object.defineProperty(local, '__proto__', { value: { retained: true }, enumerable: true });
  const merged = C.mergeDocuments(base, local, remote);
  assert.equal(Object.hasOwn(merged.state, '__proto__'), true);
  assert.deepEqual(merged.state.__proto__, { retained: true });
  assert.equal({}.retained, undefined);
});


test('board version responses normalize missing/null catalogs from older running services', () => {
  for (const versions of [undefined, null, {}]) {
    const original = { boardId: 'b_home', revisions: [], versions };
    const catalog = D.normalizeBoardVersions(original);
    assert.deepEqual(catalog.versions, { v1: { revisionId: null } });
    assert.equal(catalog.manageSupported, false);
    assert.equal(original.versions, versions);
  }
  const old = D.normalizeBoardVersions({ revisions: [
    { revisionId: 'br_1', kind: 'snapshot' }, { revisionId: 'br_r', kind: 'recovery' },
    { revisionId: 'br_s', kind: 'restore', parentRevisionId: 'br_1' }, { revisionId: 'br_2', kind: 'snapshot' },
  ] });
  assert.deepEqual(old.versions, { v1: { revisionId: 'br_1' }, v2: { revisionId: 'br_2' } });
  const modern = D.normalizeBoardVersions({ versions: { v2: { revisionId: 'br_2' }, v4: { revisionId: 'br_4' } } });
  assert.equal(modern.manageSupported, true);
  assert.deepEqual(Object.keys(modern.versions), ['v2', 'v4']);
  for (const invalid of [null, [], { versions: [] }, { versions: { v1: null } }]) {
    assert.throws(() => D.normalizeBoardVersions(invalid), /画板版本数据无效/);
  }
});
