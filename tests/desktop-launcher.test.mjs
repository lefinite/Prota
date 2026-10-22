import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fingerprint, dependenciesReady, selectPythonAsset } from '../scripts/desktop-launcher.mjs';

test('ready dependency check respects product changes and installed versions', t => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'prota-launcher-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const write=(file,value)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,typeof value==='string'?value:JSON.stringify(value));};
    write('package.json',{});write('scripts/install-vercel-cli.mjs','');write('tools/vercel-runtime/package.json',{});
    write('package-lock.json',{packages:{'node_modules/@codeany/open-agent-sdk':{version:'1.0.0'},'node_modules/playwright':{version:'1.0.0'}}});
    for(const name of ['@codeany/open-agent-sdk','playwright'])write('node_modules/'+name+'/package.json',{version:'1.0.0'});
    write('node_modules/.prota-vercel/node_modules/vercel/package.json',{name:'vercel',version:'99.0.0',bin:{vercel:'cli.js'}});write('node_modules/.prota-vercel/node_modules/vercel/cli.js','');
    const previous=fingerprint(root);assert.equal(dependenciesReady(root,previous),true);
    write('package.json',{changed:true});assert.equal(dependenciesReady(root,previous),false);
    write('node_modules/playwright/package.json',{version:'0.1.0'});assert.equal(dependenciesReady(root),false);
});

test('standalone Python selection matches machine architecture and GIL build',()=>{
    const arm={name:'cpython-3.13.9+20261001-aarch64-apple-darwin-install_only_stripped.tar.gz'};
    const intel={name:'cpython-3.13.9+20261001-x86_64-apple-darwin-install_only_stripped.tar.gz'};
    const release={assets:[{name:'cpython-3.13.9+20261001-aarch64-apple-darwin-freethreaded-install_only_stripped.tar.gz'},arm,intel]};
    assert.equal(selectPythonAsset(release,'arm64'),arm);assert.equal(selectPythonAsset(release,'x64'),intel);
});
