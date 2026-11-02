import test from 'node:test';
import assert from 'node:assert/strict';
import {formatShareText, passwordShareUrl, prepareShareDraft} from '../portal/modules/sharing/copy.js';
const url = 'https://share.example.com/shares/page.html';
test('copy includes URL, actual expiry and password in a single message', () => {
    const text = formatShareText({url, expiresAt:Date.UTC(2026,10,22,8,30), password:'a4B9'});
    assert.equal(text.split('\n').length,3);
    assert.ok(text.startsWith(`链接：${url}#pwd=a4B9\n有效期：截至 `));
    assert.match(text,/2026/);
    assert.ok(text.endsWith('\n密码：a4B9'));
});
test('copy omits unset fields for permanent or password-free links', () => {
    assert.equal(formatShareText({url}),`链接：${url}`);
    assert.equal(formatShareText({url,expiresAt:null,password:'a4B9'}),`链接：${url}#pwd=a4B9\n密码：a4B9`);
    const open = formatShareText({url,expiresAt:Date.now()+86400000,password:''});
    assert.match(open,/有效期：/);assert.doesNotMatch(open,/密码：/);
});

test('embedded passwords preserve special characters and existing URL parameters', () => {
    const password = '中文 &+#=%?🔑';
    const link = passwordShareUrl(url + '?view=prd#tab=docs&pwd=old', password);
    const parsed = new URL(link);
    assert.equal(parsed.search, '?view=prd');
    assert.equal(new URLSearchParams(parsed.hash.slice(1)).get('pwd'), password);
    assert.equal(new URLSearchParams(parsed.hash.slice(1)).get('tab'), 'docs');
    assert.equal(passwordShareUrl(link, password), link);
    assert.equal(passwordShareUrl(url + '#section', ''), url + '#section');
});

test('page and folder drafts copy links with their passwords', () => {
    for (const folderId of [undefined, 'review']) {
        const draft = prepareShareDraft({domain:'share.example.com', projectId:'demo', pageId:'reader', version:'v1', folderId, access:{password:'a4B9'}});
        assert.ok(draft.text.startsWith(`链接：${draft.url}#pwd=a4B9\n`));
        assert.equal(new URL(draft.url).hash, '', 'published resource URL stays canonical');
    }
});

test('static drafts generate independent 256-bit credentials; only MCP line is inserted',()=>{
    const options={domain:'share.example.com',projectId:'demo',pageId:'reader',version:'v3',access:{expiresInDays:7,password:'a4B9'}};
    const a=prepareShareDraft(options,1000), b=prepareShareDraft(options,1000);
    assert.match(a.mcpToken,/^[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(a.mcpToken,'base64url').length,32);
    assert.notEqual(a.mcpToken,b.mcpToken);
    assert.equal(a.text.split('\n')[1],`MCP：${a.mcpUrl}`);
    assert.equal(a.text.split('\n').filter(line=>!line.startsWith('MCP：')).join('\n'),formatShareText({url:a.url,expiresAt:a.access.expiresAt,password:'a4B9'}));
    assert.equal(new URL(a.mcpUrl).pathname,'/mcp/'+a.mcpToken);
    assert.equal(a.access.password,'a4B9');
});
