import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSnapshot, readPage, pruneCache } from '../server/preview/snapshot.mjs';
import { previewConfig } from '../server/preview/config.mjs';

export async function fixture(t) {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'prota-preview-test-')));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const pageRoot = path.join(root, 'page'), cacheRoot = path.join(root, 'cache');
    await fs.mkdir(pageRoot);
    const write = (name, data) => fs.writeFile(path.join(pageRoot, name), data);
    await write('index.html', '<html><head><link rel="stylesheet" href="styles.css"></head><body><h1>One</h1><script src="app.js"></script></body></html>');
    await write('styles.css', 'body{color:red}'); await write('app.js', 'window.count = 1;');
    return { root, pageRoot, cacheRoot, write, runId: 'run-test', revision: 1 };
}
test('immutable revisions, SHA dedup and unchanged business file hashes', async t => {
    const f = await fixture(t), original = await readPage(f.pageRoot);
    const first = await createSnapshot(f);
    assert.equal((await readPage(f.pageRoot)).hash, original.hash);
    assert.equal(await createSnapshot({ ...f, previous: first, revision: 2 }), null);
    await f.write('styles.css', 'body{color:blue}');
    const second = await createSnapshot({ ...f, previous: first, revision: 2 });
    assert.deepEqual([...second.changed], ['styles.css']);
    assert.equal(await fs.readFile(path.join(f.cacheRoot, f.runId, '1/styles.css'), 'utf8'), 'body{color:red}');
    assert.equal(await fs.readFile(path.join(f.cacheRoot, f.runId, '2/styles.css'), 'utf8'), 'body{color:blue}');
});
test('capacity limits and sensitive files / symlinks', async t => {
    const f = await fixture(t);
    await f.write('.env', 'secret'); await f.write('credentials.json', 'secret');
    const snapshot = await createSnapshot(f);
    assert.equal(snapshot.files.has('.env'), false); assert.equal(snapshot.files.has('credentials.json'), false);
    await assert.rejects(createSnapshot({ ...f, config: { ...previewConfig, maxBytes: 10 } }), /capacity/);
    await fs.symlink(path.join(f.root, 'outside'), path.join(f.pageRoot, 'leak.js'));
    await assert.rejects(createSnapshot(f), /Symlink/);
});
test('cache expiry and aggregate size cap', async t => {
    const f = await fixture(t); await createSnapshot(f);
    await pruneCache(f.cacheRoot, { ...previewConfig, cacheBytes: 1 });
    await assert.rejects(fs.stat(path.join(f.cacheRoot, f.runId, '1')));
});
test('shared asset changes target dependent canvas boards only', async () => {
    const {revisionEvent}=await import('../server/preview/events.mjs');
    const files=new Map(Object.entries({'index.html':'<h1>Canvas</h1>','boards/a/index.html':'<link href="styles.css" rel="stylesheet">','boards/a/styles.css':'body{background:url(../../assets/a.png)}','boards/b/index.html':'<h1>B</h1>','assets/a.png':'changed'}).map(([name,data])=>[name,Buffer.from(data)]));
    const event=revisionEvent('run',{}, {files,changed:new Set(['assets/a.png']),revision:2});
    assert.deepEqual(event.changes.boardIds,['a']);
});
