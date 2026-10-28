import { EventEmitter } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { PiRpcTransport } from './rpc-transport.mjs';
import { piRuntime, piCliRelative } from '../../scripts/pi-paths.mjs';

function runtimeError(message, code) {
    return Object.assign(new Error(message), { code });
}

export class PiRuntimeManager extends EventEmitter {
    constructor({ configure, maxProcesses = 4, idleTimeoutMs = 5 * 60_000,
        closeTimeoutMs = 3000, cli = path.join(piRuntime, piCliRelative),
        node = process.execPath, spawnProcess = spawn, rpcOptions = {} } = {}) {
        super();
        if (typeof configure !== 'function') throw new Error('Pi runtime configure callback is required');
        this.configure = configure;
        this.maxProcesses = maxProcesses;
        this.idleTimeoutMs = idleTimeoutMs;
        this.closeTimeoutMs = closeTimeoutMs;
        this.cli = cli;
        this.node = node;
        this.spawnProcess = spawnProcess;
        this.rpcOptions = rpcOptions;
        this.entries = new Map();
        this.stopping = false;
        this.sweep = setInterval(() => this.collectIdle().catch(error => this.emit('diagnostic', error)),
            Math.max(10, Math.min(idleTimeoutMs, 30_000)));
        this.sweep.unref();
    }

    get(sessionId) {
        const runtime = this.entries.get(sessionId)?.runtime;
        return runtime && !runtime.rpc.closed ? runtime : null;
    }

    async ensure(sessionId) {
        if (this.stopping) throw new Error('Pi runtime manager is shutting down');
        let entry = this.entries.get(sessionId);
        if (entry) {
            if (entry.closing) throw new Error('Pi session is closing');
            const runtime = await entry.starting;
            runtime.lastUsedAt = Date.now();
            return runtime;
        }
        // Reserve before any await, so concurrent starts share both the cap and promise.
        if (this.entries.size >= this.maxProcesses) {
            const idle = [...this.entries.values()].find(item => item.runtime
                && !item.runtime.busy && !item.runtime.rpc.pending.size && !item.closing);
            if (!idle) throw runtimeError('Pi runtime capacity reached; retry when a task completes', 'PI_CAPACITY');
            // Keep the closing entry reserved until its process really exited.
            await this.dispose(idle.sessionId);
            return this.ensure(sessionId);
        }
        entry = { sessionId, runtime: null, starting: null, closing: false };
        this.entries.set(sessionId, entry);
        entry.starting = this.start(entry).catch(error => {
            if (this.entries.get(sessionId) === entry) this.entries.delete(sessionId);
            throw error;
        });
        return entry.starting;
    }

    async start(entry) {
        const config = await this.configure(entry.sessionId);
        if (entry.closing || this.stopping) throw new Error('Pi startup cancelled');
        if (!path.isAbsolute(config.cwd)) throw new Error('Pi requires an absolute workspace directory');
        const child = this.spawnProcess(this.node, [this.cli, '--mode', 'rpc', ...(config.args || [])], {
            cwd: config.cwd, env: config.env, stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true, detached: process.platform !== 'win32'
        });
        const closed = new Promise(resolve => child.once('close', resolve));
        const rpc = new PiRpcTransport(child, this.rpcOptions);
        const runtime = { sessionId: entry.sessionId, child, rpc, config, closed,
            busy: false, lastUsedAt: Date.now(), state: null };
        entry.runtime = runtime;
        rpc.on('event', event => {
            runtime.lastUsedAt = Date.now();
            this.emit('event', entry.sessionId, event);
        });
        rpc.on('disconnect', error => {
            this.emit('runtime_disconnected', entry.sessionId, error);
            if (!entry.closing) {
                // Malformed stdout can disconnect while the process is still alive.
                this.closeRuntime(runtime).finally(() => {
                    if (this.entries.get(entry.sessionId) === entry) this.entries.delete(entry.sessionId);
                });
            }
        });
        try {
            runtime.state = await rpc.request('get_state');
            return runtime;
        } catch (error) {
            await this.closeRuntime(runtime);
            throw error;
        }
    }

    async prompt(sessionId, { message, images, timeoutMs = 20 * 60_000, signal, onEvent } = {}) {
        const runtime = await this.ensure(sessionId);
        if (runtime.busy) throw runtimeError('Pi session already has an active task', 'PI_BUSY');
        if (signal?.aborted) throw signal.reason || runtimeError('Pi task cancelled', 'PI_ABORTED');
        runtime.busy = true;
        let timer;
        let accepted = false;
        let settled = null;
        let lastAssistant = null;
        let resolveRun;
        let rejectRun;
        const result = new Promise((resolve, reject) => { resolveRun = resolve; rejectRun = reject; });
        // Attach before writing prompt: a fast runtime can settle before its response.
        const complete = () => {
            if (!accepted || !settled) return;
            if (settled.aborted) rejectRun(runtimeError('Pi task was aborted', 'PI_ABORTED'));
            else if (lastAssistant?.stopReason === 'error' || lastAssistant?.stopReason === 'aborted') {
                rejectRun(runtimeError(lastAssistant.errorMessage || 'Pi provider request failed', 'PI_PROVIDER_ERROR'));
            } else resolveRun({ ...settled, message: lastAssistant });
        };
        const event = record => {
            try { onEvent?.(record); }
            catch (error) { rejectRun(error); return; }
            if (record.type === 'message_end' && record.message?.role === 'assistant') lastAssistant = record.message;
            if (record.type === 'agent_settled') { settled = record; complete(); }
        };
        const disconnect = error => rejectRun(runtimeError(error.message, 'PI_DISCONNECTED'));
        const cancel = () => {
            this.abort(sessionId).then(() => rejectRun(runtimeError('Pi task was aborted', 'PI_ABORTED')),
                error => rejectRun(error));
        };
        runtime.rpc.on('event', event);
        runtime.rpc.on('disconnect', disconnect);
        signal?.addEventListener('abort', cancel, { once: true });
        timer = setTimeout(() => {
            rejectRun(runtimeError('Pi task timed out', 'PI_TIMEOUT'));
            this.dispose(sessionId).catch(error => this.emit('diagnostic', error));
        }, timeoutMs);
        // Consume the result rejection immediately while command acceptance is pending.
        result.catch(() => {});
        try {
            const response = await Promise.race([
                runtime.rpc.request('prompt', { message, ...(images?.length ? { images } : {}) }),
                // Lifecycle/protocol failure can arrive before the acceptance
                // reply (for example an unsupported native command dialog).
                // Propagate it immediately and close the uncertain process.
                result.then(() => undefined)
            ]);
            accepted = true;
            if (response?.disposition === 'handled') return { handled: true, aborted: false };
            complete();
            return await result;
        } catch (error) {
            // An acceptance timeout is ambiguous. Stop this instance rather than
            // resending a prompt that may already be modifying workspace files.
            await this.dispose(sessionId);
            throw error;
        } finally {
            clearTimeout(timer);
            runtime.rpc.off('event', event);
            runtime.rpc.off('disconnect', disconnect);
            signal?.removeEventListener('abort', cancel);
            runtime.busy = false;
            runtime.lastUsedAt = Date.now();
        }
    }

    async abort(sessionId) {
        const runtime = this.get(sessionId);
        if (!runtime?.busy) return;
        await runtime.rpc.request('abort');
    }

    async setModel(sessionId, provider, modelId) {
        const runtime = await this.ensure(sessionId);
        if (runtime.busy) throw runtimeError('Cannot switch models during a Pi task', 'PI_BUSY');
        const result = await runtime.rpc.request('set_model', { provider, modelId });
        runtime.state = await runtime.rpc.request('get_state');
        return result;
    }

    async restart(sessionId) {
        if (this.get(sessionId)?.busy) throw runtimeError('Cannot restart an active Pi task', 'PI_BUSY');
        await this.dispose(sessionId);
        return this.ensure(sessionId);
    }

    async closeRuntime(runtime) {
        if (runtime.closing) return runtime.closing;
        runtime.closing = (async () => {
            runtime.child.stdin.end();
            const force = setTimeout(() => {
                if (process.platform === 'win32') {
                    spawnSync('taskkill.exe', ['/PID', String(runtime.child.pid), '/T', '/F'], { windowsHide: true });
                } else {
                    try { process.kill(-runtime.child.pid, 'SIGKILL'); }
                    catch { runtime.child.kill('SIGKILL'); }
                }
            }, this.closeTimeoutMs);
            await runtime.closed;
            clearTimeout(force);
        })();
        return runtime.closing;
    }

    async dispose(sessionId) {
        const entry = this.entries.get(sessionId);
        if (!entry) return;
        entry.closing = true;
        const runtime = await entry.starting.catch(() => null);
        if (runtime) await this.closeRuntime(runtime);
        if (this.entries.get(sessionId) === entry) this.entries.delete(sessionId);
    }

    async collectIdle() {
        for (const [id, entry] of this.entries) {
            const runtime = entry.runtime;
            if (runtime && !runtime.busy && !runtime.rpc.pending.size
                && Date.now() - runtime.lastUsedAt >= this.idleTimeoutMs) await this.dispose(id);
        }
    }

    async disposeAll() {
        this.stopping = true;
        clearInterval(this.sweep);
        await Promise.all([...this.entries.keys()].map(id => this.dispose(id)));
    }
}
