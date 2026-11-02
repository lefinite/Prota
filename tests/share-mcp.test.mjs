import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createShareHandler } from '../server/share_gateway.mjs';
import { serveMcp } from '../server/share_mcp.mjs';
const hash = data => createHash('sha256').update(data).digest('hex');

async function fixture(t, mcpHandler = serveMcp) {
    const root = await mkdtemp(join(tmpdir(), 'prota-mcp-'));
    const content = join(root, 'content');
    const privateRoot = join(root,'mcp-context');
    await mkdir(content); await mkdir(join(privateRoot, 'a'), {recursive:true});
    const token = randomBytes(32).toString('base64url');
    const html = '<h1>中文原型 v1</h1>\n<script>let action="推断";</script>\n';
    const long = '中文📘'.repeat(20000) + '\n第二行\n第三行';
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
    const files = {entry:['index.html',html,'text/html',true],prd:['prd.md',long,'text/markdown',true],image:['actual.png',image,'image/png',false],huge:['huge.png',Buffer.alloc(2*1024*1024+1),'image/png',false]};
    const resources = {};
    for (const [rid,[path,data,mime,text]] of Object.entries(files)) {
        const buffer = Buffer.from(data);
        await writeFile(join(content,path),buffer);
        resources[rid] = {pageId:'reader',source:'content',relativePath:path,sha256:hash(buffer),size:buffer.length,mimeType:mime,text,kind:path.split('.').at(-1)};
    }
    const manifest = {project:{id:'fixture',name:'测试'},shareType:'page',snapshotId:'sha256:frozen',generatedAt:'2026-10-29',missing:[],externalDependencies:[],folders:[],resources,
        pages:[{pageId:'reader',name:'阅读器',version:'v1',targetDevice:'web',resourceIds:Object.keys(files),documents:[{resourceId:'prd'}],entryResourceId:'entry',
            nodes:[{id:'instance-1',boardId:'b_home',boardVersionId:'v2',boardRevisionId:'br_old'}],edges:[{id:'e1',from:'instance-1',to:'instance-2'}],
            boards:[{instanceId:'instance-1',boardId:'b_home',boardVersionId:'v2',boardRevisionId:'br_old',resourceIds:['entry']}],
            annotations:[{text:'批注'}],visualAvailable:false,visualMissingReason:'No captured screenshot.'}]};
    await writeFile(join(privateRoot,'a/manifest.json'),JSON.stringify(manifest));
    let now = 1000;
    const policy = {id:'one',mcpTokenHash:hash(token),mcpSnapshot:'a',expiresAt:100000,entries:[],files:[]};
    const handler = createShareHandler({shares:[policy]}, content, {now:()=>now,secureCookies:false,mcpHandler});
    const server = createServer(handler);
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const url = new URL(origin + '/mcp/' + token);
    const clients = [];
    t.after(async()=>{for (const client of clients) await client.close(); server.closeAllConnections(); await new Promise(done=>server.close(done)); await rm(root,{recursive:true,force:true});});
    const connect = async (modern = false) => {
        const client = new Client({name:'official-test',version:'1.0.0'},modern ? {versionNegotiation:{mode:{pin:'2026-07-28'}}} : {});
        clients.push(client);
        await client.connect(new StreamableHTTPClientTransport(url));
        return client;
    };
    const request = (path,body,headers={}) => fetch(origin+path,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',...headers},body:JSON.stringify(body)});
    const call = async (client,name,args={}) => client.callTool({name,arguments:args});
    return {connect,call,request,url,policy,content,root,origin,token,setTime:value=>{now=value;}};
}
const parsed = result => {assert.ok(!result.isError,JSON.stringify(result));return JSON.parse(result.content[0].text);};

test('official SDK negotiates and discovers six tools; contexts and UTF-8 pagination are real', async t=>{
    const f = await fixture(t), client = await f.connect();
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(t=>t.name).sort(), ['get_overview','get_page_context','get_visual','list_pages','list_resources','read_resource'].sort());
    assert.equal(parsed(await f.call(client,'get_overview')).versionLocked,true);
    assert.equal(parsed(await f.call(client,'list_pages',{limit:1})).items[0].version,'v1');
    const page = parsed(await f.call(client,'get_page_context',{pageId:'reader'}));
    assert.equal(page.nodes[0].id,'instance-1');assert.equal(page.boards[0].boardId,'b_home');assert.equal(page.edges[0].id,'e1');
    assert.equal(parsed(await f.call(client,'list_resources',{limit:1})).nextCursor,'1');
    const entry = parsed(await f.call(client,'read_resource',{resourceId:'entry',startLine:1,maxLines:1}));
    assert.match(entry.text,/中文原型/);assert.equal(entry.nextLine,2);
    let startLine=1,startColumn=0,output='';
    for(let n=0;n<20;n++) {
        const part = parsed(await f.call(client,'read_resource',{resourceId:'prd',startLine,startColumn,maxLines:2}));
        output+=part.text;
        if (part.eof) break;
        startLine=part.nextLine;startColumn=part.nextColumn;
    }
    assert.equal(output, '中文📘'.repeat(20000)+'\n第二行\n第三行');
    assert.equal(parsed(await f.call(client,'get_visual',{pageId:'reader'})).visualAvailable,false);
    const image = await f.call(client,'get_visual',{pageId:'reader',visualId:'image'});
    assert.equal(image.content[1].type,'image');assert.ok(Buffer.from(image.content[1].data,'base64').length>50);
});

test('invalid/expired/replaced credentials and cross-share IDs fail without leaking capabilities', async t=>{
    const f=await fixture(t), client=await f.connect();
    for (const resourceId of ['../access.json','https://example.com','.env','other/prd','__proto__']) assert.equal((await f.call(client,'read_resource',{resourceId})).isError,true);
    assert.equal((await f.call(client,'get_page_context',{pageId:'other'})).isError,true);
    assert.equal((await f.call(client,'get_visual',{pageId:'other',visualId:'image'})).isError,true);
    assert.equal((await f.call(client,'get_visual',{pageId:'reader',visualId:'huge'})).isError,true);
    assert.equal((await f.call(client,'get_visual',{pageId:'reader',boardId:'b_home',visualId:'image'})).isError,true);
    assert.equal((await f.request('/mcp/'+randomBytes(32).toString('base64url'),{jsonrpc:'2.0',id:1,method:'tools/list'})).status,404);
    for(const path of ['/access.json','/.mcp/a/manifest.json','/mcp-context/a/manifest.json','/index.html']) assert.equal((await fetch(f.origin+path)).status,404);
    f.setTime(100000);
    const expired=await f.request(f.url.pathname,{jsonrpc:'2.0',id:1,method:'tools/list'});
    assert.equal(expired.status,404);assert.ok(!(await expired.text()).includes(f.token));
    f.setTime(1000);f.policy.mcpTokenHash=hash('replacement');
    assert.equal((await f.request(f.url.pathname,{jsonrpc:'2.0',id:1,method:'tools/list'})).status,404);
});

test('origin, methods, body limits, version headers and resource integrity are enforced',async t=>{
    const f=await fixture(t), client=await f.connect();
    const body={jsonrpc:'2.0',id:2,method:'tools/list'};
    assert.equal((await f.request(f.url.pathname,body,{origin:'https://evil.example'})).status,403);
    assert.equal((await fetch(f.url)).status,405);
    assert.equal((await f.request(f.url.pathname,body,{'content-type':'text/plain'})).status,415);
    assert.equal((await f.request(f.url.pathname,{padding:'x'.repeat(262144)})).status,413);
    assert.equal((await f.request(f.url.pathname,body,{'mcp-protocol-version':'1900-01-01'})).status,400);
    await writeFile(join(f.content,'index.html'),'tampered');
    assert.equal((await f.call(client,'read_resource',{resourceId:'entry'})).isError,true);
    await rm(join(f.content,'prd.md')); await symlink(join(f.root,'mcp-context/a/manifest.json'),join(f.content,'prd.md'));
    assert.equal((await f.call(client,'read_resource',{resourceId:'prd'})).isError,true);
    const response=await f.request(f.url.pathname,body,{'mcp-protocol-version':'2025-11-25'});
    assert.equal(response.status,200);
    assert.match(response.headers.get('cache-control'),/no-store/);
    assert.equal(response.headers.get('vercel-cdn-cache-control'),'no-store');
    assert.ok(!(await response.text()).includes(f.token));
});


test('2026-07-28 discovery and standard HTTP header validation use the official handler',async t=>{
    const f=await fixture(t),client=await f.connect(true);
    assert.equal(client.getProtocolEra(),'modern');
    assert.equal(parsed(await f.call(client,'get_overview')).versionLocked,true);
    assert.equal((await f.call(client,'get_visual',{pageId:'reader',visualId:'image'})).content[1].type,'image');
    const snapshotPath=join(f.root,'mcp-context/a/manifest.json');
    const snapshot=JSON.parse(await readFile(snapshotPath));
    snapshot.pages[0].boards.push({...snapshot.pages[0].boards[0],instanceId:'second-instance',boardVersionId:'v3',resourceIds:['image']});
    await writeFile(snapshotPath,JSON.stringify(snapshot));
    assert.equal(parsed(await f.call(client,'get_visual',{pageId:'reader',boardId:'b_home'})).instances.length,2);
    assert.equal((await f.call(client,'get_visual',{pageId:'reader',boardId:'second-instance',visualId:'image'})).content[1].type,'image');
    const body={jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'get_overview',arguments:{},_meta:{
        'io.modelcontextprotocol/protocolVersion':'2026-07-28',
        'io.modelcontextprotocol/clientInfo':{name:'header-test',version:'1.0.0'},
        'io.modelcontextprotocol/clientCapabilities':{}}}};
    const headers={'mcp-protocol-version':'2026-07-28','mcp-method':'tools/call','mcp-name':'get_overview'};
    assert.equal((await f.request(f.url.pathname,body,headers)).status,200);
    assert.equal((await f.request(f.url.pathname,body,{'mcp-protocol-version':'2026-07-28'})).status,400);
    assert.equal((await f.request(f.url.pathname,body,{...headers,'mcp-name':'read_resource'})).status,400);
    assert.equal((await f.request(f.url.pathname,body,{...headers,'mcp-method':'tools/list'})).status,400);
});

test('per-instance request rate and concurrent work are bounded',async t=>{
    let entered=0,ready,release;
    const allEntered=new Promise(done=>{ready=done;});
    const gate=new Promise(done=>{release=done;});
    const f=await fixture(t,async(req,res)=>{if(++entered===4)ready();await gate;res.end('{}');});
    const body={jsonrpc:'2.0',id:1,method:'tools/list'};
    const running=Array.from({length:4},()=>f.request(f.url.pathname,body));
    await allEntered;
    const blocked=await f.request(f.url.pathname,body);
    assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'60');
    release();await Promise.all(running);
    for(let n=0;n<116;n++) await f.request(f.url.pathname,body);
    assert.equal((await f.request(f.url.pathname,body)).status,429);
});
