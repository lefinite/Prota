/** Shared by page creation, folder creation and the share manager. */
export function passwordShareUrl(url, password) {
    if (!password) return url;
    const link = new URL(url);
    const fragment = new URLSearchParams(link.hash.slice(1));
    fragment.set('pwd', password);
    link.hash = fragment.toString();
    return link.href;
}

export function formatShareText({ url, mcpUrl, expiresAt, password }) {
    const lines = [`链接：${passwordShareUrl(url, password)}`];
    if (mcpUrl) lines.push(`MCP：${mcpUrl}`);
    if (expiresAt) {
        const date = new Date(expiresAt);
        if (!Number.isNaN(date.getTime())) {
            const deadline = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).format(date);
            lines.push(`有效期：截至 ${deadline}`);
        }
    }
    if (password) lines.push(`密码：${password}`);
    return lines.join('\n');
}

/** The URL and expiry are fixed before publishing so the submit click can copy immediately. */
export function prepareShareDraft({ domain, projectId, pageId, version, folderId, access }, now = Date.now()) {
    const slug = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'page';
    const filename = folderId ? `${slug(projectId)}-${slug(folderId)}-folder-static.html` : `${slug(pageId)}-${version}-static.html`;
    if (!domain) throw Error('请先配置分享地址。');
    const url = new URL(`/shares/${filename}`, `https://${domain}`).href;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const mcpToken = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const mcpUrl = new URL(`/mcp/${mcpToken}`, url).href;
    const policy = { ...access, ...(access.expiresInDays ? { expiresAt: now + access.expiresInDays * 86400000 } : {}) };
    return { url, mcpToken, mcpUrl, access: policy, text: formatShareText({ url, mcpUrl, expiresAt: policy.expiresAt, password: policy.password }) };
}
