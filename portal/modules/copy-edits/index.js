const prefix = '/api/copy-edits/v2';
export async function editRequest(path, payload) {
    const response = await fetch(prefix + path, payload === undefined ? {} : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok && !result.status) throw Error(result.error || '人工修改服务暂不可用');
    return result;
}
export function editScope(shell) {
    return { projectId: shell.activeProjectId, pageId: shell.activePageId, version: shell.activeVersion };
}
export async function verifyPreview(shell, record) {
    const scope = record.request;
    if (Object.entries(editScope(shell)).some(([key, value]) => scope[key] !== value)) return record;
    const selector = scope.element.selector;
    let targets;
    try { targets = shell.mainIframe.contentDocument.querySelectorAll(selector); } catch { targets = []; }
    const text = targets.length === 1 ? targets[0].textContent : null;
    return editRequest(`/${record.editId}/verify`, { ...editScope(shell), selector,
        matched: targets.length === 1 && text === scope.element.nextText, text });
}
