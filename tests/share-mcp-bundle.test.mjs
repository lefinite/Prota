/** Exercise the actual dependency-free Vercel function after deleting its workspace. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

function pythonExecutable() {
    for (const command of [process.env.PYTHON, '/opt/homebrew/bin/python3', 'python3.14', 'python3']) {
        if (!command) continue;
        const check = spawnSync(command, ['-c', 'import hashlib; hashlib.scrypt'], {encoding:'utf8'});
        if (!check.error && check.status === 0) return command;
    }
    throw Error('Python 3 with hashlib.scrypt is required');
}
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

test('prebuilt Function runs without the workspace or npm dependencies and isolates two snapshots', async t=>{
    const base=await mkdtemp(join(tmpdir(),'prota-mcp-bundle-'));
    t.after(()=>rm(base,{recursive:true,force:true}));
    const tokens=[randomBytes(32).toString('base64url'),randomBytes(32).toString('base64url')];
    execFileSync(pythonExecutable(),['-c',`
import json,sys
from pathlib import Path
from server.deployer import VercelDeployer
from server.share_security import create_policy,save_policy
base=Path(sys.argv[1]); tokens=json.loads(sys.argv[2]); root=base/'workspace'
(root/'data').mkdir(parents=True)
(root/'data/settings.json').write_text('{}')
(root/'shares').mkdir()
files=[]
for index,(page,version) in enumerate([('reader','v1'),('library','v3')]):
    directory=root/f'src/pages/fixture/{page}/{version}'
    directory.mkdir(parents=True)
    (directory/'index.html').write_text(f'<meta charset="utf-8"><h1>{page} {version} 中文原型</h1><script src="app.js"></script>')
    (directory/'app.js').write_text('document.body.dataset.ready="yes";')
    (directory/'product-doc.md').write_text(f'# {page} {version} PRD\\n精确版本需求')
    payload={'projectId':'fixture','pageId':page,'version':version,'shareType':'static','prdPath':f'/src/pages/fixture/{page}/{version}/product-doc.md'}
    file=root/f'shares/{page}-{version}-static.html'
    file.write_text('<script>window.__READIFY_SHARE__ = '+json.dumps(payload)+';</script>')
    save_policy(root,file.name,create_policy({'expiresInDays':0,'password':'a4B9'},tokens[index]),'a4B9',tokens[index])
    files.append(file)
deployer=VercelDeployer(root)
output=base/'release'
deployer.prepare_gateway(output,deployer.prepare(output,files),files)
`,base,JSON.stringify(tokens)],{cwd:fileURLToPath(new URL('..',import.meta.url)),stdio:'pipe'});
    const functionRoot=join(base,'release/.vercel/output/functions/share.func');
    const manifest=JSON.parse(await readFile(join(functionRoot,'access.json')));
    for (const token of tokens) assert.ok(!JSON.stringify(manifest).includes(token));
    assert.ok((await stat(join(functionRoot,'share_mcp.bundle.mjs'))).size < 5 * 1024 * 1024);
    await rm(join(base,'workspace'),{recursive:true,force:true});
    const {createShareHandler}=await import(pathToFileURL(join(functionRoot,'handler.mjs')));
    let now=Date.now();
    const handler=createShareHandler(manifest,join(functionRoot,'content'),{secureCookies:false,now:()=>now});
    const server=createServer(handler);
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    t.after(()=>new Promise(done=>{server.closeAllConnections();server.close(done);}));
    const origin=`http://127.0.0.1:${server.address().port}`;
    const clients=[];
    t.after(async()=>{for(const client of clients) await client.close();});
    for (const [index,[page,version]] of [['reader','v1'],['library','v3']].entries()) {
        const client=new Client({name:'bundle-test',version:'1.0.0'},{versionNegotiation:{mode:{pin:'2026-07-28'}}});clients.push(client);
        const transport=new StreamableHTTPClientTransport(new URL(origin+'/mcp/'+tokens[index]));
        await client.connect(transport);
        assert.equal(client.getProtocolEra(),'modern');
        assert.equal((await client.listTools()).tools.length,6);
        const call=async(name,args={})=>client.callTool({name,arguments:args});
        const context=JSON.parse((await call('get_page_context',{pageId:page})).content[0].text);
        assert.equal(context.version,version);
        const entry=JSON.parse((await call('read_resource',{resourceId:context.entryResourceId})).content[0].text);
        assert.match(entry.text,new RegExp(page+' '+version+' 中文原型'));
        const other=await call('get_page_context',{pageId:index===0?'library':'reader'});
        assert.equal(other.isError,true);
        const outside=await call('read_resource',{resourceId:`library/v3/content/src/pages/fixture/library/v3/product-doc.md`});
        if (index===0) assert.equal(outside.isError,true);
        // Web-password cookies are unnecessary for MCP, but its capability grants no web access.
        assert.equal((await fetch(origin+`/shares/${page}-${version}-static.html`)).status,401);
        for (const path of ['/access.json','/.mcp/reader-v1-static.html/manifest.json','/mcp-context/reader-v1-static.html/manifest.json','/content/src/pages/fixture/reader/v1/index.html']) assert.equal((await fetch(origin+path)).status,404);
    }
    const policy=manifest.shares.find(p=>p.entries.includes('/shares/reader-v1-static.html'));
    policy.expiresAt=now; // Every request rechecks policy, independent of SDK/client initialization.
    await assert.rejects(()=>clients[0].callTool({name:'get_overview',arguments:{}}));
    assert.equal((await fetch(origin+'/mcp/'+tokens[0],{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})})).status,404);
    assert.equal((await clients[1].listTools()).tools.length,6);
    policy.expiresAt=null;delete policy.mcpTokenHash;
    await assert.rejects(()=>clients[0].callTool({name:'get_overview',arguments:{}}));
    assert.equal((await clients[1].listTools()).tools.length,6);
});
