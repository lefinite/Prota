import assert from 'node:assert/strict';
import test from 'node:test';
import { sessionIndicator, groupSessionsByPage } from '../portal/agent/session-list.js';

test('session indicators reflect live runs and terminal/background states', () => {
    assert.deepEqual(sessionIndicator({ status: 'running' }), { state: 'running', label: '运行中' });
    assert.equal(sessionIndicator({ status: 'succeeded' }).state, 'completed');
    assert.equal(sessionIndicator({ status: 'failed' }).state, 'failed');
    assert.equal(sessionIndicator({ status: 'waiting_approval' }).state, 'waiting');
    assert.equal(sessionIndicator({ status: 'waiting_user_answer' }).state, 'waiting');
    assert.equal(sessionIndicator({ status: 'interrupted' }).state, 'stopped');
    assert.equal(sessionIndicator({ status: 'ready' }), null);
    assert.equal(sessionIndicator({ status: 'running' }, { status: 'succeeded' }).state, 'completed');
    assert.equal(sessionIndicator({ status: 'running' }, { status: 'ready' }).state, 'running');
});

test('all dots clear after viewing their status while the running spinner remains', () => {
    const session = { status: 'succeeded', runId: 'run-1', finishedAt: '2026-11-05T01:00:00Z' };
    const receipt = { runId: 'run-1', seenAt: Date.parse('2026-11-05T01:01:00Z') };
    assert.equal(sessionIndicator(session, null, receipt), null);
    assert.equal(sessionIndicator({ ...session, runId: 'run-2' }, null, receipt).state, 'completed');
    assert.equal(sessionIndicator({ ...session, status: 'running' }, null, receipt).state, 'running');
    assert.equal(sessionIndicator({ ...session, status: 'failed' }, null, { ...receipt, status: 'failed' }), null);
    assert.equal(sessionIndicator({ ...session, status: 'interrupted' }, null, { ...receipt, status: 'interrupted' }), null);
    const legacy = { status: 'succeeded', updatedAt: '2026-11-05T01:00:00Z' };
    assert.equal(sessionIndicator(legacy, null, receipt), null);
    assert.equal(sessionIndicator({ ...legacy, updatedAt: '2026-11-05T02:00:00Z' }, null, receipt).state, 'completed');
    assert.equal(sessionIndicator({ status: 'running' }, { status: 'succeeded', runId: 'run-1' }, receipt), null);
    const waiting = { ...receipt, status: 'waiting_approval' };
    assert.equal(sessionIndicator({ ...session, status: 'waiting_approval' }, null, waiting), null);
    assert.equal(sessionIndicator({ ...session, status: 'failed' }, null, waiting).state, 'failed', 'a different status is unread even within the same run');
});

test('the first-use baseline suppresses old dots across all pages, but allows new updates', () => {
    const baseline = Date.parse('2026-11-05T01:00:00Z');
    for (const status of ['succeeded', 'failed', 'interrupted', 'cancelled', 'waiting_approval', 'waiting_user_answer']) {
        assert.equal(sessionIndicator({ status, updatedAt: '2026-11-05T00:00:00Z' }, null, null, baseline), null, status);
        assert.ok(sessionIndicator({ status, updatedAt: '2026-11-05T02:00:00Z' }, null, null, baseline), status);
    }
    assert.equal(sessionIndicator({ status: 'running', updatedAt: '2026-11-05T00:00:00Z' }, null, null, baseline).state, 'running');
});

test('page groups combine versions, separate projects and order by recent activity', () => {
    const projects = [{ id: 'a', name: '项目 A', pages: [{ id: 'reader', name: '阅读器' }] }];
    const items = [
        { id: 'old', projectId: 'a', pageId: 'reader', version: 'v1', updatedAt: '2026-11-01' },
        { id: 'other', projectId: 'b', pageId: 'reader', updatedAt: '2026-11-03' },
        { id: 'new', projectId: 'a', pageId: 'reader', version: 'v2', updatedAt: '2026-11-05' },
        { id: 'global', sessionScope: 'global', pageId: '__global__', updatedAt: '2026-11-02' }
    ];
    const groups = groupSessionsByPage(items, projects);
    assert.deepEqual(groups.map(([label, sessions]) => [label, sessions.map(s => s.id)]), [
        ['项目 A / 阅读器', ['new', 'old']], ['b / reader', ['other']], ['未关联页面', ['global']]
    ]);
    assert.equal(items[0].id, 'old', 'source list is unchanged');
});
