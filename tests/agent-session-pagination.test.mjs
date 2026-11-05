import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../portal/shell.js', import.meta.url), 'utf8');
const methods = source.slice(source.indexOf('    loadAgentSessions({'), source.indexOf('    scheduleIdleTask('));
const prototype = vm.runInNewContext(`new (class {${methods}})()`, { console: { warn() {} } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fixture(count = 175) {
    const sessions = Array.from({ length: count }, (_, i) => ({ id: `session-${i}`, title: `会话 ${i}`, status: 'running' }));
    const calls = [];
    const shell = Object.assign(Object.create(prototype), {
        agentSessionsList: [], agentSessionPageSize: 30, agentSessionSearch: '',
        agentSessionNextCursor: null, agentSessionHasMore: false,
        _agentSessionListRequestId: 0, agentSessionListLoading: false,
        getCachedAgentSessionList() { return this.cache || []; },
        cacheAgentSessionList(list) { this.cache = list; },
        syncCanvasAgentStatus() {}, scheduleAgentSessionPrewarm() {},
        renderAgentSessionList() { this.renderedLoading = this.agentSessionListLoading; },
        agentApi: { async listSessions(options) {
            calls.push(options);
            const start = Number(options.cursor || 0);
            const filtered = options.query ? sessions.filter(s => s.title.includes(options.query)) : sessions;
            const page = filtered.slice(start, start + Math.min(options.limit, 100));
            const next = start + page.length;
            return { sessions: page, hasMore: next < filtered.length, nextCursor: next < filtered.length ? String(next) : null };
        } }
    });
    return { shell, sessions, calls };
}

test('refresh preserves multiple loaded pages beyond the server response cap', async () => {
    const { shell, sessions, calls } = fixture();
    await shell.loadAgentSessions();
    for (let i = 0; i < 3; i++) await shell.loadMoreAgentSessions();
    assert.equal(shell.agentSessionsList.length, 120);
    sessions[100].status = 'succeeded';
    calls.length = 0;
    await shell.loadAgentSessions();
    assert.equal(shell.agentSessionsList.length, 120);
    assert.equal(shell.agentSessionsList[100].status, 'succeeded');
    assert.equal(calls.length, 2, 'refresh follows the server cursor past its 100-item cap');
    assert.equal(shell.agentSessionNextCursor, '120');
    await shell.loadMoreAgentSessions();
    assert.equal(shell.agentSessionsList.length, 150);
    await shell.loadMoreAgentSessions();
    assert.equal(shell.agentSessionsList.length, 175);
    assert.equal(new Set(shell.agentSessionsList.map(s => s.id)).size, 175);
    assert.equal(shell.agentSessionHasMore, false);
});

test('rapid load-more clicks and an overlapping refresh cannot drop appended sessions', async () => {
    const { shell, calls } = fixture();
    await shell.loadAgentSessions();
    const gate = deferred();
    const original = shell.agentApi.listSessions;
    shell.agentApi.listSessions = async options => {
        if (options.cursor === '30') await gate.promise;
        return original(options);
    };
    const append = shell.loadMoreAgentSessions();
    assert.equal(shell.renderedLoading, true, 'the load-more button immediately enters loading state');
    const duplicate = shell.loadMoreAgentSessions();
    const refresh = shell.loadAgentSessions();
    gate.resolve();
    await Promise.all([append, duplicate, refresh]);
    assert.equal(shell.agentSessionsList.length, 60);
    assert.equal(calls.filter(call => call.cursor === '30').length, 1);
    assert.equal(shell.agentSessionNextCursor, '60');
});

test('refresh and append failures keep the expanded list and cursor for retry', async () => {
    const { shell } = fixture();
    await shell.loadAgentSessions();
    await shell.loadMoreAgentSessions();
    await shell.loadMoreAgentSessions();
    const ids = shell.agentSessionsList.map(s => s.id);
    const cursor = shell.agentSessionNextCursor;
    const original = shell.agentApi.listSessions;
    shell.agentApi.listSessions = async () => { throw new Error('offline'); };
    await shell.loadAgentSessions();
    await shell.loadMoreAgentSessions();
    assert.deepEqual(shell.agentSessionsList.map(s => s.id), ids);
    assert.equal(shell.agentSessionNextCursor, cursor);
    assert.equal(shell.agentSessionHasMore, true);
    assert.equal(shell.agentSessionListLoading, false);
    shell.agentApi.listSessions = original;
    await shell.loadMoreAgentSessions();
    assert.equal(shell.agentSessionsList.length, 120);
});

test('search supersedes older responses and starts its own first page', async () => {
    const { shell } = fixture();
    await shell.loadAgentSessions();
    await shell.loadMoreAgentSessions();
    const gate = deferred();
    const original = shell.agentApi.listSessions;
    shell.agentApi.listSessions = async options => {
        if (!options.query) await gate.promise;
        return original(options);
    };
    const refresh = shell.loadAgentSessions();
    shell.agentSessionSearch = '会话 17';
    await shell.loadAgentSessions();
    const filtered = shell.agentSessionsList.map(s => s.id);
    assert.ok(filtered.length > 0 && filtered.length < 30);
    assert.ok(shell.agentSessionsList.every(s => s.title.includes('会话 17')));
    gate.resolve();
    await refresh;
    assert.deepEqual(shell.agentSessionsList.map(s => s.id), filtered);
    shell.agentSessionSearch = '';
    await shell.loadAgentSessions();
    assert.equal(shell.agentSessionsList.length, 30, 'changing search resets the range');
});
