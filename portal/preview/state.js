export class PreviewState {
    constructor() { this.status = 'idle'; this.runId = null; this.revision = 0; this.detached = false; }
    start(runId) { this.runId = runId; this.revision = 0; this.status = 'observing'; this.detached = false; }
    accepts(event) { return !this.detached && event.runId === this.runId && Number.isSafeInteger(event.revision) && event.revision > this.revision && !['completed', 'failed', 'idle'].includes(this.status); }
}
export const scopeKey = scope => `${scope?.projectId || ''}/${scope?.pageId || ''}/${scope?.version || ''}`;
