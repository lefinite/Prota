import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PiRuntimeManager } from '../server/pi/runtime-manager.mjs';

const cli = fileURLToPath(new URL('./fixtures/pi-rpc-child.mjs', import.meta.url));
function manager(t, options = {}) {
    const value = new PiRuntimeManager({ configure: async () => ({ cwd: path.dirname(cli), env: { PATH: process.env.PATH } }),
        cli, idleTimeoutMs: 60_000, ...options });
    t.after(() => value.disposeAll());
    return value;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Pi runtime starts lazily, deduplicates startup and reuses sessions', async t => {
    const runtimes = manager(t);
    assert.equal(runtimes.entries.size, 0);
    const [first, second] = await Promise.all([runtimes.ensure('a'), runtimes.ensure('a')]);
    assert.equal(first, second);
    assert.equal(runtimes.entries.size, 1);
    await runtimes.prompt('a', { message: 'first' });
    await runtimes.prompt('a', { message: 'second' });
    assert.equal(runtimes.get('a').child.pid, first.child.pid);
    const other = await runtimes.ensure('b');
    assert.notEqual(first.child.pid, other.child.pid);
});

test('Pi run waits for agent_settled after agent_end and retains final assistant', async t => {
    const runtimes = manager(t);
    const events = [];
    let done = false;
    const run = runtimes.prompt('a', { message: 'work', onEvent: record => events.push(record.type) }).then(result => { done = true; return result; });
    while (!events.includes('agent_end')) await delay(5);
    assert.equal(done, false);
    const result = await run;
    assert.equal(result.message.content[0].text, 'done');
    assert.equal(events.at(-1), 'agent_settled');
});

test('Pi handles a consumed prompt without waiting for nonexistent lifecycle events', async t => {
    const runtimes = manager(t);
    assert.deepEqual(await runtimes.prompt('a', { message: 'handled' }), { handled: true, aborted: false });
    assert.equal(runtimes.get('a').busy, false);
});

test('Pi timeout before acceptance retains the timeout classification and never waits for the RPC timeout', async t => {
    const runtimes = manager(t, { rpcOptions: { timeoutMs: 10000 } });
    await assert.rejects(runtimes.prompt('a', { message: 'no-accept', timeoutMs: 30 }), { code: 'PI_TIMEOUT' });
    assert.equal(runtimes.entries.size, 0);
});

test('Pi cancellation before acceptance stops the process after abort acknowledgment', async t => {
    const runtimes = manager(t);
    const controller = new AbortController();
    const run = runtimes.prompt('a', { message: 'no-accept', timeoutMs: 5000, signal: controller.signal });
    while (!runtimes.get('a')?.busy) await delay(2);
    controller.abort();
    await assert.rejects(run, { code: 'PI_ABORTED' });
    assert.equal(runtimes.entries.size, 0);
});

test('Pi event adapter failure before acceptance rejects the run and closes the native dialog', async t => {
    const runtimes = manager(t);
    await assert.rejects(runtimes.prompt('a', { message: 'native-dialog', timeoutMs: 5000,
        onEvent: record => { if (record.type === 'extension_ui_request') throw Object.assign(new Error('Unsupported native dialog'), { code: 'PI_UNSUPPORTED_UI' }); }
    }), { code: 'PI_UNSUPPORTED_UI' });
    assert.equal(runtimes.entries.size, 0);
});

test('Pi run treats provider errors as failure after acceptance', async t => {
    const runtimes = manager(t);
    await assert.rejects(runtimes.prompt('a', { message: 'error' }), { code: 'PI_PROVIDER_ERROR' });
    assert.equal(runtimes.entries.size, 0);
});

test('Pi rejects overlapping prompts without starting a duplicate run', async t => {
    const runtimes = manager(t);
    const run = runtimes.prompt('a', { message: 'hang' });
    const rejected = assert.rejects(run, { code: 'PI_ABORTED' });
    while (!runtimes.get('a')?.busy) await delay(5);
    await assert.rejects(runtimes.prompt('a', { message: 'duplicate' }), { code: 'PI_BUSY' });
    await runtimes.abort('a');
    await rejected;
});

test('Pi abort signal terminates a running task and clears listeners', async t => {
    const runtimes = manager(t);
    const controller = new AbortController();
    const run = runtimes.prompt('a', { message: 'hang', signal: controller.signal });
    const rejected = assert.rejects(run, { code: 'PI_ABORTED' });
    while (!runtimes.get('a')?.busy) await delay(5);
    controller.abort();
    await rejected;
});

test('Pi timeout closes the uncertain run before allowing another task', async t => {
    const runtimes = manager(t);
    await assert.rejects(runtimes.prompt('a', { message: 'hang', timeoutMs: 30 }), { code: 'PI_TIMEOUT' });
    assert.equal(runtimes.entries.size, 0);
    assert.equal((await runtimes.prompt('a', { message: 'resume' })).aborted, false);
});

test('Pi unexpected process exit can recover with a fresh runtime', async t => {
    const runtimes = manager(t);
    const first = await runtimes.ensure('a');
    await assert.rejects(runtimes.prompt('a', { message: 'crash' }));
    const restored = await runtimes.ensure('a');
    assert.notEqual(restored.child.pid, first.child.pid);
    assert.equal((await runtimes.prompt('a', { message: 'continue' })).aborted, false);
});

test('Pi capacity includes concurrent startup reservations', async t => {
    const runtimes = manager(t, { maxProcesses: 1 });
    const first = runtimes.ensure('a');
    await assert.rejects(runtimes.ensure('b'), { code: 'PI_CAPACITY' });
    const runtime = await first;
    const next = await runtimes.ensure('b');
    assert.notEqual(runtime.child.pid, next.child.pid);
    assert.equal(runtimes.entries.size, 1);
});

test('Pi idle collection preserves active runs and reclaims idle instances', async t => {
    const runtimes = manager(t, { idleTimeoutMs: 10 });
    await runtimes.ensure('idle');
    await delay(30);
    await runtimes.collectIdle();
    assert.equal(runtimes.get('idle'), null);
    const run = runtimes.prompt('active', { message: 'work' });
    while (!runtimes.get('active')?.busy) await delay(2);
    await delay(20);
    await runtimes.collectIdle();
    assert.equal(runtimes.get('active')?.busy, true);
    await run;
});

test('Pi shutdown during configuration never launches an orphan process', async t => {
    let release;
    const configure = () => new Promise(resolve => { release = resolve; });
    const runtimes = manager(t, { configure });
    const starting = runtimes.ensure('a');
    const rejected = assert.rejects(starting, /cancelled/);
    const closing = runtimes.disposeAll();
    release({ cwd: path.dirname(cli), env: {} });
    await closing;
    await rejected;
    assert.equal(runtimes.entries.size, 0);
});
