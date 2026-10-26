import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser = await chromium.launch({headless:true});
try {
    const context = await browser.newContext({permissions:['clipboard-read','clipboard-write']});
    const page = await context.newPage({viewport:{width:1200,height:900}});
    const requests = [];
    const pending = [];
    for (const kind of ['page','folder']) await page.route(`**/api/share-${kind}`, async route => {
        const request=route.request().postDataJSON(); requests.push(request);
        await new Promise(resolve=>pending.push(resolve));
        return route.fulfill({contentType:'application/json',body:JSON.stringify({url:`https://share.example.com/shares/${kind==='page'?'reader-v1-static':'fixture-folder-folder-static'}.html`,pageCount:1,access:{expiresAt:request.access.expiresAt ?? null,passwordRequired:!!request.access.password}})});
    });
    await page.goto('http://localhost:8080/portal/index.html');
    await page.waitForFunction(()=>window.shell);
    await page.evaluate(()=>{
        const shell=window.shell;
        shell.ensureShareSetup=async()=>true;shell.settings.staticDomain='share.example.com';
        shell.activeProjectId='fixture';shell.activePageId='reader';shell.activeVersion='v1';
        shell.getPageRecord=()=>({id:'reader',name:'Fixture Reader'});
        shell.getProjectRecord=()=>({folders:[{id:'folder',name:'Fixture Folder'}],pages:[{id:'reader',parentId:'folder'}]});
        shell.getPreferredPrdPathForShare=()=>'';
        window.opened=0;window.open=()=>{window.opened++;};
        window.copyCount=0;const copy=shell.copyTextToClipboard.bind(shell);
        shell.copyTextToClipboard=async text=>{window.copyCount++;return copy(text);};
        window.operation=shell.createSharePage('static');
    });
    await page.getByLabel('设置访问密码').check();
    const generated=await page.locator('#sharePassword').inputValue();
    assert.match(generated,/^[2-9A-HJ-NP-Z]{4}$/);
    await page.getByRole('button',{name:'创建分享链接'}).click();
    await page.waitForFunction(()=>window.copyCount===1);
    // The server has not completed publishing: the real clipboard must already be ready.
    const message=await page.evaluate(()=>navigator.clipboard.readText());
    assert.ok(message.startsWith('链接：https://share.example.com/shares/reader-v1-static.html\n有效期：截至 '));
    assert.ok(message.endsWith(`\n密码：${generated}`));
    assert.equal(await page.evaluate(()=>window.opened),0);
    while (!pending.length) await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(requests[0].access.password,generated);assert.equal(requests[0].access.expiresInDays,30);
    assert.ok(requests[0].access.expiresAt>Date.now());
    pending.shift()();await page.evaluate(()=>window.operation);
    assert.equal(await page.evaluate(()=>window.copyCount),1,'success must not overwrite the clipboard again');
    // A second share uses the same link and the manually changed password, before publishing.
    await page.evaluate(()=>{window.operation=window.shell.createSharePage('static');});
    await page.getByLabel('设置访问密码').check();await page.locator('#sharePassword').fill('new4');
    await page.getByRole('button',{name:'创建分享链接'}).click();
    await page.waitForFunction(()=>window.copyCount===2);
    const changed=await page.evaluate(()=>navigator.clipboard.readText());
    assert.ok(changed.startsWith('链接：https://share.example.com/shares/reader-v1-static.html\n'));
    assert.ok(changed.endsWith('\n密码：new4'));
    while (!pending.length) await new Promise(resolve=>setTimeout(resolve,10));
    pending.shift()();await page.evaluate(()=>window.operation);
    await page.evaluate(()=>{window.operation=window.shell.createShareFolder('folder','static');});
    await page.getByRole('radio',{name:'永久有效',exact:true}).check();
    await page.getByRole('button',{name:'创建分享链接'}).click();
    await page.waitForFunction(()=>window.copyCount===3);
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'链接：https://share.example.com/shares/fixture-folder-folder-static.html');
    while (!pending.length) await new Promise(resolve=>setTimeout(resolve,10));
    pending.shift()();await page.evaluate(()=>window.operation);
    console.log('Share creation: generated password, manual replacement, unchanged URL, real clipboard before publishing, no repeat copy, and folder copy passed');
} finally {await browser.close();}
