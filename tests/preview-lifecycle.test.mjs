import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ensureRunPreview, previewRunMetadata } from '../server/preview/lifecycle.mjs';
const wait = async f => { for(let i=0;i<150;i++){if(f())return;await new Promise(r=>setTimeout(r,20));}throw Error('Preview timed out'); };

test('enabling during an existing run attaches a passive observer and exposes reconnect state', async t => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'prota-preview-resume-')));
    const page=path.join(root,'src/pages/demo/canvas/v1');await fs.mkdir(page,{recursive:true});await fs.writeFile(path.join(page,'index.html'),'<h1>Canvas</h1>');
    await fs.writeFile(path.join(root,'preview.json'),'{"progressivePreview":false}');
    const session={context:{projectId:'demo',pageId:'canvas',version:'v1'},runState:{active:true,runId:'running',descriptor:{kind:'message'}}};
    const original=JSON.stringify(session),events=[];
    const options={configDirectory:root,getWorkspaceRoot:()=>root,workspaceLocked:()=>false,emit:(type,payload)=>events.push({type,payload}),announce:true};
    let observer;
    t.after(async()=>{observer?.stop();await fs.rm(root,{recursive:true,force:true});if(observer)await fs.rm(observer.cacheRoot,{recursive:true,force:true});});
    assert.equal(ensureRunPreview(session,options),null);assert.equal(JSON.stringify(session),original);
    await fs.writeFile(path.join(root,'preview.json'),'{"progressivePreview":true}');
    observer=ensureRunPreview(session,options);assert.ok(observer);assert.equal(ensureRunPreview(session,options),observer);
    assert.equal(events.filter(e=>e.type==='preview_observing').length,1);
    await wait(()=>events.some(e=>e.type==='preview_revision'));
    const metadata=previewRunMetadata(session);assert.equal(metadata.progressivePreview,true);assert.equal(metadata.previewRevision.runId,'running');assert.equal(metadata.previewRevision.revision,1);
    assert.equal(session.runState.active,true);assert.deepEqual(session.context,JSON.parse(original).context);
    await fs.writeFile(path.join(root,'preview.json'),'{"progressivePreview":false}');await observer.scan();assert.equal(observer.stopped,true);assert.ok(events.some(e=>e.type==='preview_disabled'));assert.equal(session.runState.active,true);
});
