import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scryptSync } from 'node:crypto';
import { createShareHandler } from '../server/share_gateway.mjs';

async function fixture(t) {
    const root = await mkdtemp(join(tmpdir(), 'prota-gateway-'));
    await mkdir(join(root, 'shares'));
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'shares/a-static.html'), 'private share contents');
    await writeFile(join(root, 'a-static.html'), 'private share contents');
    await writeFile(join(root, 'src/index.html'), 'private prototype');
    await writeFile(join(root, 'src/document.md'), 'private document');
    await writeFile(join(root, 'src/bundle.zip'), 'private download');
    const salt = 'a'.repeat(32);
    let clock = 100000000;
    const policy = { id:'abc', sessionKey:'secret key', salt, passwordHash:scryptSync('test password', Buffer.from(salt, 'hex'), 32).toString('hex'), expiresAt:clock + 86400000, entries:['/shares/a-static.html', '/a-static.html'], files:['/shares/a-static.html', '/a-static.html', '/src/index.html', '/src/document.md', '/src/bundle.zip'] };
    const manifest = { shares:[policy] };
    const server = createServer(createShareHandler(manifest, root, {now:() => clock, secureCookies:false}));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(root, {recursive:true, force:true}); });
    const url = `http://127.0.0.1:${server.address().port}`;
    const request = (path, options) => fetch(url + path, {redirect:'manual', ...options});
    const unlock = async () => {
        const response = await request('/shares/a-static.html', {method:'POST', body:new URLSearchParams({password:'test password'}), headers:{origin:url}});
        assert.equal(response.status, 303);
        return response.headers.get('set-cookie').split(';')[0];
    };
    return {replace: next => { server.removeAllListeners('request'); server.on('request', createShareHandler({shares:[next]}, root, {now:()=>clock,secureCookies:false})); }, policy, manifest, request, unlock, setClock:value => {clock = value;}, root};
}

test('password protects both link aliases, prototype, documents and downloads', async t => {
    const {request, unlock} = await fixture(t);
    for (const path of ['/shares/a-static.html', '/a-static.html']) {
        const response = await request(path);
        assert.equal(response.status, 401);
        assert.doesNotMatch(await response.text(), /private share contents/);
    }
    for (const path of ['/src/index.html', '/src/document.md', '/src/bundle.zip', '/access.json', '/handler.mjs', '/content/src/index.html']) assert.equal((await request(path)).status, 404, path);
    assert.equal((await request('/shares/a-static.html', {method:'POST', body:'password=wrong'})).status, 401);
    const cookie = await unlock();
    for (const path of ['/a-static.html', '/src/index.html', '/src/', '/src/document.md', '/src/bundle.zip']) {
        const response = await request(path, {headers:{cookie}});
        assert.equal(response.status, 200, path);
        assert.match(response.headers.get('cache-control'), /no-store/);
        assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
    }
    const head = await request('/src/index.html', {method:'HEAD', headers:{cookie}});
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
});

test('expiry blocks an already authenticated session and both aliases', async t => {
    const {request, unlock, policy, setClock} = await fixture(t);
    const cookie = await unlock();
    setClock(policy.expiresAt);
    for (const path of policy.entries) assert.equal((await request(path, {headers:{cookie}})).status, 410);
    for (const path of ['/src/index.html', '/src/document.md', '/src/bundle.zip']) assert.equal((await request(path, {headers:{cookie}})).status, 404);
});

test('password-free links require visiting the share and still enforce expiry', async t => {
    const {request, policy} = await fixture(t);
    policy.passwordHash = null;
    assert.equal((await request('/src/index.html')).status, 404);
    const page = await request('/a-static.html');
    assert.equal(page.status, 200);
    const cookie = page.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
    assert.equal((await request('/src/index.html', {headers:{cookie:cookie.split(';')[0]}})).status, 200);
});

test('forged cookies, cross-origin posts and encoded traversal fail closed', async t => {
    const {request} = await fixture(t);
    for (const cookie of ['prota_share_abc=9999999999999.fake', 'prota_share_abc=9999999999999.' + 'a'.repeat(64)]) assert.equal((await request('/src/index.html', {headers:{cookie}})).status, 404);
    assert.equal((await request('/shares/a-static.html', {method:'POST', body:'password=test+password', headers:{origin:'https://other.example'}})).status, 403);
    assert.equal((await request('/%2e%2e%2faccess.json')).status, 404);
    assert.equal((await request('/shares/a-static.html?password=test%20password')).status, 401);
    assert.equal((await request('/src/index.html', {method:'POST', body:'password=test+password'})).status, 405);
});

test('sessions cannot access another share or survive a policy replacement', async t => {
    const {request, unlock, policy, manifest, root} = await fixture(t);
    const cookie = await unlock();
    await writeFile(join(root, 'src/other.html'), 'another share');
    // Handler indexes allowed files once; another file is never implicitly authorized.
    assert.equal((await request('/src/other.html', {headers:{cookie}})).status, 404);
    policy.sessionKey = 'replacement signing key';
    assert.equal((await request('/a-static.html', {headers:{cookie}})).status, 401);
    assert.equal((await request('/src/index.html', {headers:{cookie}})).status, 404);
});

test('repeated password errors are throttled', async t => {
    const {request} = await fixture(t);
    for (let i = 0; i < 5; i++) assert.equal((await request('/a-static.html', {method:'POST', body:'password=bad'})).status, 401);
    const response = await request('/a-static.html', {method:'POST', body:'password=bad'});
    assert.equal(response.status, 429); assert.ok(Number(response.headers.get('retry-after')) > 0);
});


test('republishing the same URLs accepts only the new password and invalidates old sessions', async t => {
    const {request, unlock, policy, replace} = await fixture(t);
    const oldCookie = await unlock();
    const salt = 'b'.repeat(32);
    replace({...policy, id:'replacement',sessionKey:'new deployment secret',salt,
        passwordHash:scryptSync('new4', Buffer.from(salt,'hex'),32).toString('hex')});
    assert.equal((await request('/a-static.html',{headers:{cookie:oldCookie}})).status,401);
    assert.equal((await request('/src/index.html',{headers:{cookie:oldCookie}})).status,404);
    for (const path of ['/a-static.html','/shares/a-static.html']) {
        assert.equal((await request(path,{method:'POST',body:'password=test+password'})).status,401);
        const verified = await request(path,{method:'POST',body:'password=new4'});
        assert.equal(verified.status,303);
        const cookie = verified.headers.get('set-cookie').split(';')[0];
        assert.equal((await request(path,{headers:{cookie}})).status,200);
        assert.equal((await request('/src/index.html',{headers:{cookie}})).status,200);
    }
});
