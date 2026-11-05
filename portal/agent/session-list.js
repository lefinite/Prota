const STATES = {
    running: ['running', '运行中'],
    waiting_approval: ['waiting', '等待批准'],
    waiting_user_answer: ['waiting', '等待回复'],
    succeeded: ['completed', '已完成'],
    completed: ['completed', '已完成'],
    failed: ['failed', '运行失败'],
    interrupted: ['stopped', '已中断'],
    cancelled: ['stopped', '已取消']
};

function sessionStatus(session, currentRun) {
    return currentRun?.status && !['ready', 'disconnected'].includes(currentRun.status)
        ? currentRun.status : session.status;
}

function statusTime(session, currentRun) {
    return currentRun?.finishedAt || session.finishedAt || currentRun?.lastActivityAt || session.updatedAt || session.createdAt;
}

export function isSessionStatusRead(session, currentRun, receipt) {
    if (!receipt) return false;
    const status = sessionStatus(session, currentRun);
    // Receipts from the previous release only acknowledged successful completion.
    if (receipt.status ? receipt.status !== status : !['succeeded', 'completed'].includes(status)) return false;
    const runId = currentRun?.runId || session.runId;
    if (runId && receipt.runId) return runId === receipt.runId;
    const changedAt = statusTime(session, currentRun);
    return !changedAt || new Date(changedAt).getTime() <= receipt.seenAt;
}

export function sessionIndicator(session, currentRun = null, receipt = null, baselineAt = 0) {
    const indicator = STATES[sessionStatus(session, currentRun)];
    if (indicator && indicator[0] !== 'running') {
        const changedAt = statusTime(session, currentRun);
        if (baselineAt && (!changedAt || new Date(changedAt).getTime() <= baselineAt)) return null;
        if (isSessionStatusRead(session, currentRun, receipt)) return null;
    }
    return indicator ? { state: indicator[0], label: indicator[1] } : null;
}

export function sessionPageGroupKey(session) {
    return session.sessionScope === 'global' || !session.pageId || session.pageId === '__global__'
        ? 'global' : JSON.stringify([session.projectId, session.pageId]);
}

export function groupSessionsByPage(items, projects) {
    const groups = new Map();
    const sorted = [...items].sort((a, b) =>
        new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    for (const session of sorted) {
        const global = session.sessionScope === 'global' || !session.pageId || session.pageId === '__global__';
        const key = sessionPageGroupKey(session);
        if (!groups.has(key)) {
            const project = projects.find(project => project.id === session.projectId);
            const page = project?.pages?.find(page => page.id === session.pageId);
            const label = global ? '未关联页面' : `${project?.name || session.projectId || '项目'} / ${page?.name || session.pageId}`;
            groups.set(key, [label, []]);
        }
        groups.get(key)[1].push(session);
    }
    return [...groups.values()];
}
