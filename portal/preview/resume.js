import { PreviewController } from './controller.js';

// Session history and SSE status are snapshots of an existing run, not new runs.
export function resumePreview(shell, payload, runId = payload.runState?.runId) {
    if (shell.isShareMode || !payload.progressivePreview || !runId || shell._previewSuppressedRunId === runId) return null;
    const state = payload.runState || shell.agentRunState;
    if (!state?.active || state.runId !== runId) return null;
    const context = payload.context || shell.agentSessionContext || {};
    if (context.projectId && context.projectId !== shell.activeProjectId) return null;
    if (context.pageId && context.pageId !== '__global__' && (context.pageId !== shell.activePageId || context.version !== shell.activeVersion)) return null;
    let controller = shell.previewController;
    if (controller?.state.runId !== runId) {
        controller?.navigate();
        controller = shell.previewController = new PreviewController(shell);
        controller.start({ runId, payload: { context } });
    }
    if (controller.state.detached) return null;
    if (payload.previewRevision) controller.receive(payload.previewRevision);
    return controller;
}
