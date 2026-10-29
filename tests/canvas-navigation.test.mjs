import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../portal/shell.js', import.meta.url), 'utf8');
const method = source.slice(source.indexOf('    async confirmCanvasNavigation()'), source.indexOf('    async switchVersion('));
const navigate = vm.runInNewContext(`({${method}}).confirmCanvasNavigation`);
const shellFor = editor => ({ mainIframe: { contentWindow: { protaCanvas: editor } }, errors: [], showToast(message) { this.errors.push(message); } });

test('canvas navigation waits for persistence before allowing a switch', async () => {
    let finish;
    const shell = shellFor({ prepareNavigation: () => new Promise(resolve => { finish = resolve; }) });
    let settled = false;
    const result = navigate.call(shell).then(value => { settled = true; return value; });
    await Promise.resolve();
    assert.equal(settled, false);
    finish(true);
    assert.equal(await result, true);
    assert.deepEqual(shell.errors, []);
});

test('failed persistence or exceptions keep the current canvas open', async () => {
    for (const prepareNavigation of [async () => false, async () => { throw Error('unavailable'); }]) {
        const shell = shellFor({ prepareNavigation });
        assert.equal(await navigate.call(shell), false);
        assert.equal(shell.errors.length, 1);
    }
});

test('older canvases save before switching and ordinary demos navigate normally', async () => {
    let dirty = true;
    const shell = shellFor({ save: async () => { dirty = false; }, isDirty: () => dirty });
    assert.equal(await navigate.call(shell), true);
    assert.equal(dirty, false);
    assert.equal(await navigate.call(shellFor(null)), true);
});
