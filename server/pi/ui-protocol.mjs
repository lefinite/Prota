const prefix = 'prota-ui:v1:';
export function encodeInteraction(value) {
    if (!['approval', 'question'].includes(value.kind) || !value.runId) throw new Error('Invalid Prota interaction');
    return prefix + Buffer.from(JSON.stringify(value)).toString('base64url');
}
export function decodeInteraction(title = '') {
    if (!title.startsWith(prefix)) return null;
    try {
        const value = JSON.parse(Buffer.from(title.slice(prefix.length), 'base64url').toString('utf8'));
        if (!['approval', 'question'].includes(value.kind) || !value.runId) throw new Error('Invalid interaction');
        return value;
    } catch { throw new Error('Invalid Prota Pi interaction protocol'); }
}
