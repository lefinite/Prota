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
