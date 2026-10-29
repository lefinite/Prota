import assert from 'node:assert/strict';
import test from 'node:test';
import { pageArchiveRequest, downloadPageArchive } from '../portal/modules/sharing/download.js';
const host = { activeProjectId: 'company', activePageId: 'reader', activeVersion: 'v1', isShareMode: true,
    shareConfig: { shareType: 'static', mode: 'folder', pages: [
        { id: 'reader', version: 'v1', zipFilename: 'reader.zip' },
        { id: 'other', version: 'v2', zipFilename: 'other.zip' }
    ] } };

test('folder downloads follow the selected page and selected version', () => {
    assert.equal(pageArchiveRequest(host).url, '/shares/reader.zip');
    assert.equal(pageArchiveRequest({ ...host, activePageId: 'other', activeVersion: 'v2' }).url, '/shares/other.zip');
    assert.throws(() => pageArchiveRequest({ ...host, activeVersion: 'v3' }), /重新分享/);
    assert.equal(pageArchiveRequest({ ...host, shareConfig: { shareType: 'static', zipFilename: 'single.zip' } }).url, '/shares/single.zip');
});

test('legacy static shares fail explicitly; local and public shares use the current origin API', () => {
    assert.throws(() => pageArchiveRequest({ ...host, shareConfig: { shareType: 'static' } }), /重新分享/);
    for (const shareType of ['local', 'public']) {
        assert.equal(pageArchiveRequest({ ...host, shareConfig: { shareType } }).url,
            '/api/agent/page/download-zip?projectId=company&pageId=reader&version=v1');
    }
});

test('missing downloads and HTML auth/fallback responses never become fake ZIP files', async () => {
    const original = globalThis.fetch;
    try {
        globalThis.fetch = async () => new Response('missing', { status: 404 });
        await assert.rejects(downloadPageArchive(host), /下载失败/);
        globalThis.fetch = async () => new Response('<html>login required</html>');
        await assert.rejects(downloadPageArchive(host), /下载包无效/);
    } finally { globalThis.fetch = original; }
});
