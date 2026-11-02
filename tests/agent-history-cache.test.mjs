import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const shellSource = fs.readFileSync(new URL('../portal/shell.js', import.meta.url), 'utf8');
const storageMethodsStart = shellSource.indexOf('    getAgentStorageKey(');
const storageMethodsEnd = shellSource.indexOf('    getAgentPanelWidthBounds', storageMethodsStart);
const cacheMethodsStart = shellSource.indexOf('    agentHistoryStoragePrefix(');
const cacheMethodsEnd = shellSource.indexOf('    cacheCurrentAgentSession(', cacheMethodsStart);
assert.ok(storageMethodsStart >= 0 && storageMethodsEnd > storageMethodsStart, 'Agent storage methods not found');
assert.ok(cacheMethodsStart >= 0 && cacheMethodsEnd > cacheMethodsStart, 'Agent cache methods not found');
const methods = [
  shellSource.slice(storageMethodsStart, storageMethodsEnd),
  shellSource.slice(cacheMethodsStart, cacheMethodsEnd),
].join('\n');

function createCache() {
  const values = new Map();
  const localStorage = {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  const Cache = vm.runInNewContext(`(class {${methods}})`, {
    window: { localStorage },
    workspaceStorageKey: key => `${key}:workspace`,
    console,
    Date,
    JSON,
    Number,
  });
  const cache = new Cache();
  cache.agentSessionId = 'current';
  return { cache, values };
}

test('Agent history cache evicts oldest entries and preserves unrelated storage', () => {
  const { cache, values } = createCache();
  const prefix = cache.agentHistoryStoragePrefix();
  const old = 'x'.repeat(700 * 1024);

  values.set(`${prefix}oldest:workspace`, JSON.stringify({ savedAt: 1, timeline: old }));
  values.set(`${prefix}middle:workspace`, JSON.stringify({ savedAt: 2, timeline: old }));
  values.set(`${prefix}newest:workspace`, JSON.stringify({ savedAt: 3, timeline: old }));
  values.set('unrelated:workspace', old);

  assert.equal(cache.cacheAgentSessionHistory('current', { timeline: ['saved'] }), true);

  const currentKey = `${prefix}current:workspace`;
  assert.equal(values.has(currentKey), true);
  assert.equal(values.has(`${prefix}oldest:workspace`), false);
  assert.equal(values.has(`${prefix}middle:workspace`), false);
  assert.equal(values.has(`${prefix}newest:workspace`), true);
  assert.equal(values.get('unrelated:workspace'), old);
  assert.ok(JSON.parse(values.get(currentKey)).savedAt > 0);
});

test('Agent history cache refuses a single entry larger than its budget', () => {
  const { cache, values } = createCache();
  const prefix = cache.agentHistoryStoragePrefix();
  const currentKey = `${prefix}current:workspace`;

  assert.equal(cache.cacheAgentSessionHistory('current', { timeline: ['x'.repeat(2 * 1024 * 1024)] }), false);
  assert.equal(values.has(currentKey), false);
});

test('Agent history cache always retains the active session', () => {
  const { cache, values } = createCache();
  const prefix = cache.agentHistoryStoragePrefix();
  const currentKey = `${prefix}current:workspace`;
  const payload = 'x'.repeat(700 * 1024);

  values.set(currentKey, JSON.stringify({ savedAt: 0, timeline: ['active'] }));
  values.set(`${prefix}newer:workspace`, JSON.stringify({ savedAt: 10, timeline: payload }));

  assert.equal(cache.cacheAgentSessionHistory('current', { timeline: ['active-updated'] }), true);
  assert.equal(values.has(currentKey), true);
});
