import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PreviewObserver, previewScope } from '../server/preview/observer.mjs';
import { previewConfig } from '../server/preview/config.mjs';
const wait = async predicate => { for (let i = 0; i < 120; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 25)); } throw Error('Preview timed out'); };
test('new directory discovery, incomplete writes, duplicate events, polling compensation, workspace switch', async t => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'prota-observer-')));
    const events = []; let current = true;
    const observer = new PreviewObserver({ workspaceRoot: root, configDirectory: root, runId: 'run-test', scope: { projectId: 'demo' }, publish: e => events.push(e), isCurrent: () => current, config: { ...previewConfig, stableMs: 30, scanMs: 50, refreshMs: 50, retentionMs: 100 } }).start();
    t.after(async () => { observer.stop(); await fs.rm(root, { recursive: true, force: true }); await fs.rm(observer.cacheRoot, { recursive: true, force: true }); });
    const dir = path.join(root, 'src/pages/demo/new/v1'); await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), '<h1>Hello</h1><script src="app.js"></script>');
    await new Promise(r => setTimeout(r, 120)); assert.equal(events.length, 0);
    await fs.writeFile(path.join(dir, 'app.js'), 'window.x=1;');
    await wait(() => events.length === 1);
    assert.equal(events[0].scope.pageId, 'new');
    observer.trigger(); observer.trigger(); await new Promise(r => setTimeout(r, 130)); assert.equal(events.length, 1);
    await fs.writeFile(path.join(dir, 'app.js'), 'const x=;'); await new Promise(r => setTimeout(r, 160)); assert.equal(events.length, 1);
    await fs.writeFile(path.join(dir, 'app.js'), 'window.x=2;'); await wait(() => events.length === 2);
    assert.equal(events[1].changes.javascript, true); assert.equal(events[1].revision, 2);
    // Remove native watchers: a missing event still gets repaired by the scan.
    for (const watcher of observer.watchers.values()) watcher.close(); observer.watchers.clear();
    await fs.writeFile(path.join(dir, 'index.html'), '<h1>Polling works</h1>'); await wait(() => events.length === 3);
    current = false; await wait(() => observer.stopped);
    await fs.writeFile(path.join(dir, 'index.html'), '<h1>Wrong workspace</h1>'); await new Promise(r => setTimeout(r, 100)); assert.equal(events.length, 3);
});
test('prototype scopes exclude PRDs and support page iteration without prompt changes', () => {
    const c = { projectId: 'demo', pageId: 'reader', version: 'v2' };
    assert.equal(previewScope(c, { kind: 'skill', skillId: 'generate-business-prd' }), null);
    assert.equal(previewScope({ ...c, projectId: '../escape' }), null);
    assert.equal(previewScope(c, { commandId: 'iterate' }).version, null);
    assert.equal(previewScope(c, { skillId: 'create-new-page' }).pageId, null);
    assert.equal(previewConfig.enabled, process.env.PROTA_PROGRESSIVE_PREVIEW === '1');
});
test('creation scopes ignore existing pages and discover only newly added versions', async t => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'prota-new-scope-')));
    const old = path.join(root, 'src/pages/demo/existing/v1'); await fs.mkdir(old, { recursive: true }); await fs.writeFile(path.join(old, 'index.html'), '<h1>Existing</h1>');
    const events=[];
    const observer = new PreviewObserver({workspaceRoot:root,configDirectory:root,runId:'scope-run',scope:previewScope({projectId:'demo'},{kind:'skill',skillId:'create-new-page'}),publish:e=>events.push(e),config:{...previewConfig,stableMs:20,scanMs:30,refreshMs:30,retentionMs:100}}).start();
    t.after(async()=>{observer.stop();await fs.rm(root,{recursive:true,force:true});await fs.rm(observer.cacheRoot,{recursive:true,force:true});});
    await new Promise(r=>setTimeout(r,100));assert.equal(events.length,0);
    const dir=path.join(root,'src/pages/demo/new/v1');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'index.html'),'<h1>New</h1>');await wait(()=>events.length===1);assert.equal(events[0].scope.pageId,'new');
});

test('overlapping runs keep independent immutable revisions and stop independently', async t => {
    const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'prota-overlap-'))),dir=path.join(root,'src/pages/demo/page/v1');
    await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'index.html'),'<h1>Shared source</h1>');
    const events=[[],[]], observers=['one','two'].map((runId,i)=>new PreviewObserver({workspaceRoot:root,configDirectory:root,runId,scope:{projectId:'demo',pageId:'page',version:'v1'},publish:e=>events[i].push(e),config:{...previewConfig,stableMs:20,scanMs:30,refreshMs:30,retentionMs:100}}).start());
    t.after(async()=>{observers.forEach(o=>o.stop());await fs.rm(root,{recursive:true,force:true});await fs.rm(observers[0].cacheRoot,{recursive:true,force:true});});
    await wait(()=>events.every(e=>e.length===1));assert.notEqual(events[0][0].snapshotUrl,events[1][0].snapshotUrl);
    observers[0].stop();await fs.writeFile(path.join(dir,'index.html'),'<h1>Next</h1>');await wait(()=>events[1].length===2);assert.equal(events[0].length,1);
    await fs.rename(dir,dir+'-removed');await new Promise(r=>setTimeout(r,100));assert.equal(events[1].length,2);
});
