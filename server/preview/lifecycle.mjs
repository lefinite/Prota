import { PreviewObserver, previewScope } from './observer.mjs';
import { progressivePreviewEnabled } from './config.mjs';

// Called only from preview/event infrastructure, never from Agent prompts/tools.
export function ensureRunPreview(session, { configDirectory, getWorkspaceRoot, workspaceLocked, emit, runId = session.runState?.runId, descriptor = session.runState?.descriptor, announce = false }) {
    if (!runId || !progressivePreviewEnabled(configDirectory)) return null;
    if (session.previewObserver?.runId === runId && !session.previewObserver.stopped) return session.previewObserver;
    const scope = previewScope(session.context, descriptor || {});
    if (!scope) return null;
    session.previewObserver?.stop();
    const workspaceRoot = getWorkspaceRoot();
    const observer = new PreviewObserver({
        workspaceRoot, configDirectory, runId, scope,
        isCurrent: () => {
            if (!progressivePreviewEnabled(configDirectory)) {
                emit('preview_disabled', { runId });
                return false;
            }
            try { return !workspaceLocked() && getWorkspaceRoot() === workspaceRoot; }
            catch { return false; }
        },
        publish: revision => emit('preview_revision', revision),
        log: error => console.debug('[preview]', error.message)
    });
    session.previewObserver = observer.start();
    if (announce) emit('preview_observing', { runId, context: session.context, progressivePreview: true });
    return observer;
}

export function previewRunMetadata(session) {
    const observer = session.previewObserver;
    return {
        progressivePreview: Boolean(observer && !observer.stopped && observer.runId === session.runState?.runId),
        previewRevision: observer && !observer.stopped ? observer.latestRevision || null : null
    };
}
