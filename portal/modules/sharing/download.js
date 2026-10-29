export function pageArchiveRequest(host) {
    const { activeProjectId: projectId, activePageId: pageId, activeVersion: version } = host;
    if (!projectId || !pageId || !version) throw new Error('无法获取当前页面或版本信息');
    if (host.isShareMode && host.shareConfig?.shareType === 'static') {
        const config = host.shareConfig;
        const page = config.mode === 'folder'
            ? config.pages?.find(page => (page.id || page.pageId) === pageId && page.version === version)
            : config;
        const filename = page?.zipFilename;
        if (!filename || !/^[A-Za-z0-9_-]+\.zip$/.test(filename)) {
            throw new Error('此分享未包含下载包，请联系分享者重新分享');
        }
        return { url: `/shares/${filename}`, filename };
    }
    const query = new URLSearchParams({ projectId, pageId, version });
    return { url: `/api/agent/page/download-zip?${query}`, filename: `${pageId}_${version}_prd.zip` };
}

export async function downloadPageArchive(host) {
    const { url, filename } = pageArchiveRequest(host);
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('下载失败，分享可能已过期或下载包缺失，请联系分享者重新分享');
    const blob = await response.blob();
    // A login page or hosting fallback can return HTTP 200 without a ZIP.
    const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (signature[0] !== 0x50 || signature[1] !== 0x4b
        || !((signature[2] === 3 && signature[3] === 4) || (signature[2] === 5 && signature[3] === 6))) {
        throw new Error('下载包无效，请联系分享者重新分享');
    }
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    try { link.click(); } finally {
        link.remove();
        // Give the browser time to start consuming the download before release.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    }
}
