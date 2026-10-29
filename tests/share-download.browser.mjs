import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { createShareHandler } from '../server/share_gateway.mjs';

const root = await mkdtemp(join(tmpdir(), 'prota-share-download-'));
let browser;
let server;
try {
    await mkdir(join(root, 'shares'));
    await writeFile(join(root, 'shares/folder.html'), '<!doctype html><title>Share download</title>');
    await writeFile(join(root, 'download.js'), await readFile(new URL('../portal/modules/sharing/download.js', import.meta.url)));
    const archive = execFileSync('python3', ['-c', 'import io,sys,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,"w"); z.writestr("docs/需求.md","# 分享附件"); z.close(); sys.stdout.buffer.write(b.getvalue())']);
    for (const name of ['reader.zip', 'other.zip']) await writeFile(join(root, 'shares', name), archive);
    const policy = { id: 'fixture', sessionKey: 'fixture-secret', expiresAt: null, passwordHash: null,
        entries: ['/shares/folder.html'], files: ['/shares/folder.html', '/download.js', '/shares/reader.zip', '/shares/other.zip'] };
    server = createServer(createShareHandler({ shares: [policy] }, root, { secureCookies: false }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(origin + '/shares/reader.zip')).status, 404);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(origin + '/shares/folder.html');
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    for (const [pageId, version] of [['reader', 'v1'], ['other', 'v2']]) {
        const pending = page.waitForEvent('download');
        await page.evaluate(async ({ pageId, version }) => {
            const { downloadPageArchive } = await import('/download.js');
            await downloadPageArchive({ isShareMode: true, activeProjectId: 'company', activePageId: pageId, activeVersion: version,
                shareConfig: { shareType: 'static', mode: 'folder', pages: [
                    { id: 'reader', version: 'v1', zipFilename: 'reader.zip' },
                    { id: 'other', version: 'v2', zipFilename: 'other.zip' }
                ] } });
        }, { pageId, version });
        const download = await pending;
        assert.equal(download.suggestedFilename(), `${pageId}.zip`);
        assert.equal(await download.failure(), null);
        assert.deepEqual(await readFile(await download.path()), archive);
    }
    assert.ok(requests.some(url => url.endsWith('/shares/other.zip')));
    assert.ok(requests.every(url => url.startsWith(origin) || url.startsWith('blob:')));
    console.log('Authenticated share: browser saved both selected page ZIPs with intact attachment bytes; no external API requests.');
} finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
}
