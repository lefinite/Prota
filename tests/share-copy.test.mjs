import test from 'node:test';
import assert from 'node:assert/strict';
import {formatShareText} from '../portal/modules/sharing/copy.js';
const url = 'https://share.example.com/shares/page.html';
test('copy includes URL, actual expiry and password in a single message', () => {
    const text = formatShareText({url, expiresAt:Date.UTC(2026,10,22,8,30), password:'a4B9'});
    assert.equal(text.split('\n').length,3);
    assert.ok(text.startsWith(`链接：${url}\n有效期：截至 `));
    assert.match(text,/2026/);
    assert.ok(text.endsWith('\n密码：a4B9'));
});
test('copy omits unset fields for permanent or password-free links', () => {
    assert.equal(formatShareText({url}),`链接：${url}`);
    assert.equal(formatShareText({url,expiresAt:null,password:'a4B9'}),`链接：${url}\n密码：a4B9`);
    const open = formatShareText({url,expiresAt:Date.now()+86400000,password:''});
    assert.match(open,/有效期：/);assert.doesNotMatch(open,/密码：/);
});
