import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

// RPC records are delimited by LF bytes, never by Unicode line separators.
export class PiRpcTransport extends EventEmitter {
    constructor(child, { timeoutMs = 30_000, maxRecordBytes = 64 * 1024 * 1024,
        maxStderrBytes = 32 * 1024, maxPending = 128 } = {}) {
        super();
        this.child = child;
        this.timeoutMs = timeoutMs;
        this.maxRecordBytes = maxRecordBytes;
        this.maxPending = maxPending;
        this.pending = new Map();
        this.buffer = Buffer.alloc(0);
        this.stderr = Buffer.alloc(0);
        this.closed = false;
        this.writeTail = Promise.resolve();
        child.stdout.on('data', chunk => this.consume(chunk));
        child.stderr.on('data', chunk => {
            this.stderr = Buffer.concat([this.stderr, chunk]).subarray(-maxStderrBytes);
            // Keep diagnostics local; they can contain provider data and must not reach SSE.
        });
        child.stdin.on('error', error => this.fail(error));
        child.stdout.on('error', error => this.fail(error));
        child.stderr.on('error', error => this.fail(error));
        child.on('error', error => this.fail(error));
        child.on('exit', (code, signal) => this.fail(new Error(`Pi exited (${code ?? signal})`)));
        child.on('close', (code, signal) => this.fail(new Error(`Pi closed (${code ?? signal})`)));
        child.stdout.on('end', () => this.fail(new Error('Pi stdout disconnected')));
    }

    consume(chunk) {
        if (this.closed) return;
        // Decode only complete records, so split UTF-8 sequences remain intact.
        const data = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
        let offset = 0;
        while (offset < data.length) {
            const lf = data.indexOf(10, offset);
            const end = lf < 0 ? data.length : lf;
            if (end - offset > this.maxRecordBytes) {
                this.fail(new Error('Pi RPC record exceeds size limit'));
                return;
            }
            if (lf < 0) break;
            const line = data.subarray(offset, lf);
            offset = lf + 1;
            if (!line.length) continue;
            let record;
            try {
                record = JSON.parse(line.toString('utf8'));
                if (!record || typeof record !== 'object' || Array.isArray(record)
                    || typeof record.type !== 'string') throw new Error('Invalid record');
            } catch {
                this.fail(new Error('Invalid Pi RPC JSON record'));
                return;
            }
            if (record.type === 'response') {
                const pending = this.pending.get(record.id);
                if (pending) {
                    if (record.success === true) pending.resolve(record.data);
                    else pending.reject(new Error(record.error || `Pi command failed: ${record.command}`));
                }
            } else this.emit('event', record);
            if (this.closed) return;
        }
        this.buffer = Buffer.from(data.subarray(offset));
    }

    send(record, { shouldSend } = {}) {
        let bytes;
        try {
            bytes = Buffer.from(JSON.stringify(record) + '\n');
            if (bytes.length - 1 > this.maxRecordBytes) throw new Error('Pi RPC record exceeds size limit');
        } catch (error) { return Promise.reject(error); }
        const write = this.writeTail.then(() => new Promise((resolve, reject) => {
            if (shouldSend && !shouldSend()) { resolve(); return; }
            if (this.closed || !this.child.stdin.writable) {
                reject(new Error('Pi RPC transport is closed'));
                return;
            }
            // Await the write callback before enqueueing another record: bounds the
            // writable queue and handles backpressure without interleaving commands.
            this.child.stdin.write(bytes, error => error ? reject(error) : resolve());
        }));
        this.writeTail = write.catch(() => {});
        return write;
    }

    request(type, payload = {}, { timeoutMs = this.timeoutMs, signal } = {}) {
        if (this.closed) return Promise.reject(new Error('Pi RPC transport is closed'));
        if (signal?.aborted) return Promise.reject(signal.reason || new Error('Pi request cancelled'));
        if (this.pending.size >= this.maxPending) return Promise.reject(new Error('Too many pending Pi commands'));
        const id = `prota-${randomUUID()}`;
        return new Promise((resolve, reject) => {
            let timer;
            const finish = (callback, value) => {
                if (!this.pending.delete(id)) return;
                clearTimeout(timer);
                signal?.removeEventListener('abort', cancel);
                callback(value);
            };
            const cancel = () => finish(reject, signal.reason || new Error('Pi request cancelled'));
            this.pending.set(id, {
                resolve: value => finish(resolve, value),
                reject: error => finish(reject, error)
            });
            signal?.addEventListener('abort', cancel, { once: true });
            timer = setTimeout(() => finish(reject, new Error(`Pi command timed out: ${type}`)), timeoutMs);
            // Do not retransmit on timeout: Pi may already have accepted the command.
            this.send({ ...payload, id, type }, { shouldSend: () => this.pending.has(id) })
                .catch(error => finish(reject, error));
        });
    }

    respondToUI(id, response) {
        return this.send({ ...response, type: 'extension_ui_response', id });
    }

    fail(error) {
        if (this.closed) return;
        this.closed = true;
        this.buffer = Buffer.alloc(0);
        for (const pending of this.pending.values()) pending.reject(error);
        this.emit('disconnect', error);
    }
}
