export function knownSecrets(env = process.env) {
    let configured = [];
    try { configured = JSON.parse(env.PROTA_PI_REDACT_VALUES || '[]'); } catch {}
    return [...new Set([env.PROTA_PI_API_KEY, ...(Array.isArray(configured) ? configured : [])])]
        .filter(value => typeof value === 'string' && value.length).sort((a, b) => b.length - a.length);
}

export function redactText(text, secrets = [], partial = false) {
    let result = text;
    for (const secret of secrets) result = result.split(secret).join('[REDACTED]');
    if (partial) {
        let held = 0;
        for (const secret of secrets) for (let length = 1; length < secret.length && length <= result.length; length++) {
            if (result.endsWith(secret.slice(0, length))) held = Math.max(held, length);
        }
        if (held) result = result.slice(0, -held);
    }
    return result;
}

export function redactSecrets(value, secrets = []) {
    if (!secrets.length) return value;
    if (typeof value === 'string') return redactText(value, secrets);
    if (Array.isArray(value)) return value.map(item => redactSecrets(item, secrets));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
        key === 'data' && value.type === 'image' ? item : redactSecrets(item, secrets)]));
}

// Hold a possible credential prefix until the next delta, so credentials split
// across RPC records never appear as concatenated assistant_delta output.
export class SecretStream {
    constructor(secrets = []) { this.secrets = secrets; this.pending = ''; }
    push(delta) {
        const text = this.pending + delta;
        const redacted = redactText(text, this.secrets);
        const safe = redactText(redacted, this.secrets, true);
        this.pending = redacted.slice(safe.length);
        return safe;
    }
    finish() { const text = this.pending; this.pending = ''; return redactText(text, this.secrets); }
}
