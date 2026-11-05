import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../portal/shell.js', import.meta.url), 'utf8');
const method = source.slice(source.indexOf('    isInfiniteCanvasPage() {'), source.indexOf('    notifyCanvasAnnotationExit() {'));
const detect = vm.runInNewContext(`({${method}}).isInfiniteCanvasPage`);
const shell = ({ pageMode, frame = {}, stage = false, script = false, body = true } = {}) => ({
  getPageRecord: () => ({ pageMode }),
  mainIframe: { contentWindow: { document: {
    body: body ? {} : null,
    getElementById: () => stage ? {} : null,
    querySelector: () => script ? {} : null
  }, ...frame } }
});

test('normal loaded versions override shared infinite-canvas metadata', () => {
  assert.equal(detect.call(shell({ pageMode: 'infinite-canvas' })), false);
  assert.equal(detect.call(shell()), false);
});

test('canvas evidence works before initialization and with legacy metadata', () => {
  for (const evidence of [{ frame: { protaCanvas: {} } }, { frame: { PROTA_CANVAS: {} } }, { stage: true }, { script: true }]) {
    assert.equal(detect.call(shell(evidence)), true);
  }
});

test('metadata is a fallback only before a document body is available', () => {
  assert.equal(detect.call(shell({ pageMode: 'infinite-canvas', body: false })), true);
  assert.equal(detect.call(shell({ body: false })), false);
});
