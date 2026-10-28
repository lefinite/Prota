import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { PiRpcTransport } from '../server/pi/rpc-transport.mjs';

function connection(options = {}, delay = 0) {
    const sent = [];
    const child = new EventEmitter();
    child.stdin = new Writable({ write(bytes, encoding, callback) {
        sent.push(JSON.parse(bytes));
        if (delay) setTimeout(callback, delay);
        else callback();
    } });
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const rpc = new PiRpcTransport(child, options);
    const reply = (record) => child.stdout.write(JSON.stringify(record) + '\n');
    return { child, rpc, sent, reply };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('RPC matches concurrent out-of-order replies by ID and separates stream events', async () => {
    const { rpc, sent, reply } = connection();
    const events = [];
    rpc.on('event', event => events.push(event));
    const first = rpc.request('get_state');
    const second = rpc.request('get_messages');
    await tick();
    reply({ type: 'message_update', delta: 'hello' });
    reply({ type: 'response', id: sent[1].id, success: true, data: { messages: [] } });
    reply({ type: 'response', id: sent[0].id, success: true, data: { isStreaming: false } });
    assert.deepEqual(await first, { isStreaming: false });
    assert.deepEqual(await second, { messages: [] });
    assert.equal(events.length, 1);
    assert.equal(rpc.pending.size, 0);
});

test('RPC preserves split UTF-8 and Unicode U+2028/U+2029 within a record', () => {
    const { rpc, child } = connection();
    const records = [];
    rpc.on('event', record => records.push(record));
    const record = { type: 'message_update', delta: '中文😀\u2028后\u2029续' };
    const bytes = Buffer.from(JSON.stringify(record) + '\n');
    for (const byte of bytes) child.stdout.write(Buffer.from([byte]));
    assert.deepEqual(records, [record]);
    assert.equal(rpc.buffer.length, 0);
});

test('RPC rejects failed commands without disconnecting', async () => {
    const { rpc, sent, reply } = connection();
    const response = rpc.request('set_model');
    const rejected = assert.rejects(response, /Model not found/);
    await tick();
    reply({ type: 'response', id: sent[0].id, success: false, error: 'Model not found' });
    await rejected;
    assert.equal(rpc.closed, false);
});

test('RPC timeout is final for that request and never retransmits an accepted prompt', async () => {
    const { rpc, sent, reply } = connection({ timeoutMs: 10 });
    await assert.rejects(rpc.request('prompt', { message: 'create file' }), /timed out/);
    assert.equal(sent.length, 1);
    reply({ type: 'response', id: sent[0].id, success: true, data: { disposition: 'started' } });
    assert.equal(rpc.pending.size, 0);
});

test('RPC cancellation cleans pending requests and abort listeners', async () => {
    const { rpc, sent } = connection();
    const controller = new AbortController();
    const response = rpc.request('get_state', {}, { signal: controller.signal });
    controller.abort(new Error('cancelled by test'));
    await assert.rejects(response, /cancelled by test/);
    assert.equal(rpc.pending.size, 0);
    await assert.rejects(rpc.request('get_state', {}, { signal: controller.signal }), /cancelled by test/);
    await tick();
    assert.equal(sent.length, 0, 'A cancelled command must not be sent from a queued write');
});

for (const failure of ['exit', 'close', 'error', 'stdout-end', 'invalid-json', 'oversized']) {
    test(`RPC rejects all pending commands on ${failure}`, async () => {
        const { rpc, child } = connection({ maxRecordBytes: 200 });
        const one = assert.rejects(rpc.request('get_state'));
        const two = assert.rejects(rpc.request('get_messages'));
        let disconnects = 0;
        rpc.on('disconnect', () => disconnects++);
        if (failure === 'stdout-end') child.stdout.end();
        else if (failure === 'invalid-json') child.stdout.write('broken json\n');
        else if (failure === 'oversized') child.stdout.write('x'.repeat(201));
        else if (failure === 'error') child.emit('error', new Error('spawn failed'));
        else child.emit(failure, 1, null);
        await Promise.all([one, two]);
        child.emit('close', 1, null);
        assert.equal(disconnects, 1);
        assert.equal(rpc.pending.size, 0);
        assert.equal(rpc.closed, true);
    });
}

test('RPC size limit applies to individual records even in a batched stdout chunk', () => {
    const { rpc, child } = connection({ maxRecordBytes: 50 });
    let records = 0;
    rpc.on('event', () => records++);
    child.stdout.write(Array.from({ length: 100 }, () => '{"type":"agent_start"}\n').join(''));
    assert.equal(records, 100);
    assert.equal(rpc.closed, false);
});

test('RPC bounds diagnostics separately from stdout and pending requests', async () => {
    const { rpc, child } = connection({ maxStderrBytes: 10, maxPending: 1 });
    const first = rpc.request('get_state');
    const rejected = assert.rejects(first, /shutdown/);
    child.stderr.write('credentials must stay private');
    assert.equal(rpc.stderr.length, 10);
    await assert.rejects(rpc.request('get_messages'), /Too many/);
    rpc.fail(new Error('shutdown'));
    await rejected;
});

test('RPC UI responses reuse the supplied ID and require no command response', async () => {
    const { rpc, sent } = connection({}, 5);
    await Promise.all([
        rpc.respondToUI('dialog-1', { value: 'allow_once' }),
        rpc.respondToUI('dialog-2', { cancelled: true })
    ]);
    assert.deepEqual(sent, [
        { type: 'extension_ui_response', id: 'dialog-1', value: 'allow_once' },
        { type: 'extension_ui_response', id: 'dialog-2', cancelled: true }
    ]);
    assert.equal(rpc.pending.size, 0);
});
