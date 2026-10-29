import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PreviewState } from '../portal/preview/state.js';
import { progressivePreviewEnabled } from '../server/preview/config.mjs';
test('rejects stale runs, out-of-order revisions, terminal events and navigation',()=>{
    const s=new PreviewState();s.start('one');s.revision=3;
    for(const event of [{runId:'two',revision:4},{runId:'one',revision:2},{runId:'one',revision:3},{runId:'one',revision:3.5}])assert.equal(s.accepts(event),false);
    assert.equal(s.accepts({runId:'one',revision:4}),true);s.detached=true;assert.equal(s.accepts({runId:'one',revision:4}),false);
    s.start('two');s.status='completed';assert.equal(s.accepts({runId:'two',revision:1}),false);
});
test('internal switch can be turned off while Agent stays running',async t=>{
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'prota-preview-switch-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
    await fs.writeFile(path.join(dir,'preview.json'),'{"progressivePreview":true}');assert.equal(progressivePreviewEnabled(dir),true);
    await fs.writeFile(path.join(dir,'preview.json'),'{"progressivePreview":false}');assert.equal(progressivePreviewEnabled(dir),false);
    await fs.writeFile(path.join(dir,'preview.json'),'{incomplete');assert.equal(progressivePreviewEnabled(dir),false);
});
test('a later board-only revision retains an unapplied layout update',async t=>{
    const {PreviewController}=await import('../portal/preview/controller.js');
    let dirty=true;const loads=[],refreshes=[];
    const editor={isDirty:()=>dirty,reloadFromDisk:async(discard,options)=>{loads.push(options);return true;},refreshBoards:async ids=>{refreshes.push(ids);return true;}};
    const scope={projectId:'demo',pageId:'canvas',version:'v1'};
    const shell={activeProjectId:'demo',activePageId:'canvas',activeVersion:'v1',mainIframe:{src:'http://localhost/src/pages/demo/canvas/v1/index.html',contentWindow:{protaCanvas:editor}}};
    const controller=new PreviewController(shell);controller.showStatus=()=>{};controller.state.start('run');controller.origin='demo/canvas/v1';controller.context=scope;
    t.after(()=>clearTimeout(controller.retry));
    controller.receive({runId:'run',revision:1,scope,snapshotUrl:'/__prota_preview/run/1/index.html',changes:{layout:true,boardIds:['new-board']}});
    await new Promise(r=>setTimeout(r,0));assert.equal(loads.length,0);
    controller.receive({runId:'run',revision:2,scope,snapshotUrl:'/__prota_preview/run/2/index.html',changes:{layout:false,javascript:true,boardIds:['other-board']}});
    await new Promise(r=>setTimeout(r,0));clearTimeout(controller.retry);
    dirty=false;await controller.drain();
    assert.equal(loads.length,1);assert.equal(loads[0].previewSync,true);assert.equal(loads[0].snapshotUrl,'/__prota_preview/run/2/index.html');
    assert.deepEqual(refreshes,[['new-board','other-board']]);assert.equal(controller.state.revision,2);
});
