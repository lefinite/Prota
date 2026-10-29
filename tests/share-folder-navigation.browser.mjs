/** Full generated Vercel bundle, without uploading business data or using credentials. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const base = await mkdtemp(join(tmpdir(), 'prota-folder-browser-'));
let server, browser;
try {
    execFileSync('python3', ['-c', `
import sys
from pathlib import Path
from server.bridge import build_share_page_html
from server.deployer import VercelDeployer
from server.share_security import create_policy, save_policy
root = Path(sys.argv[1]) / 'workspace'
page = root / 'src/pages/fixture/reader/v1'
page.mkdir(parents=True)
(page / 'index.html').write_text('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="styles.css"><h1 id="fixture-demo">Protected prototype</h1><img src="/assets/fixture.svg">')
(page / 'styles.css').write_text('body{background:#f5f7fa;font-family:system-ui}h1{color:#2563eb}')
(root / 'assets').mkdir()
(root / 'assets/fixture.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="blue"/></svg>')
other = root / 'src/pages/fixture/library/v2'
other.mkdir(parents=True)
(other / 'index.html').write_text('<!doctype html><meta charset="utf-8"><h1 id="library-demo">Shared library</h1>')
(root / 'shares').mkdir()
share = root / 'shares/reader-v1-static.html'
share.write_text(build_share_page_html({'mode':'folder','folderName':'产品评审','folderId':'root','folders':[{'id':'nested','name':'阅读体验','parentId':'root','collapsed':True},{'id':'deeper','name':'子文件夹','parentId':'nested','collapsed':True},{'id':'leaf','name':'第三层','parentId':'deeper','collapsed':True}],'pages':[{'id':'reader','name':'阅读器','version':'v1','targetDevice':'web','parentId':'root','order':0},{'id':'library','name':'书架','version':'v2','targetDevice':'web','parentId':'leaf','order':1}],'enabled':True,'projectId':'fixture','pageId':'reader','pageName':'Fixture Reader','version':'v1','targetDevice':'web','shareType':'static','annotations':[],'zipFilename':'reader.zip'}))
(root / 'shares/reader.zip').write_bytes(b'fixture download')
save_policy(root, share.name, create_policy({'password':'a4B9','expiresInDays':7}))
deployer = VercelDeployer(root)
output = Path(sys.argv[1]) / 'release'
deployer.prepare_gateway(output, deployer.prepare(output, [share]), [share])
`, base], {cwd:fileURLToPath(new URL('..', import.meta.url)), stdio:'pipe'});
    const bundle = join(base, 'release/.vercel/output/functions/share.func');
    const {createShareHandler} = await import(pathToFileURL(join(bundle, 'handler.mjs')));
    const manifest = JSON.parse(await readFile(join(bundle, 'access.json')));
    server = createServer(createShareHandler(manifest, join(bundle,'content'), {secureCookies:false}));
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const origin=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const failures=[];
    const writes=[];
    page.on('request', request=>{if(!['GET','HEAD'].includes(request.method()) && request.url().includes('/api/')) writes.push(request.url());});
    page.on('pageerror', error=>failures.push(error.message));
    const response=await page.goto(origin+'/shares/reader-v1-static.html');
    assert.equal(response.status(),401);
    await page.getByLabel('访问密码').fill('a4B9');
    await page.screenshot({path:'/tmp/prota-share-password-gate.png'});
    await page.getByRole('button',{name:'查看分享'}).click();
    await page.frameLocator('#mainIframe').locator('#fixture-demo').waitFor({timeout:20000});
    assert.equal(await page.frameLocator('#mainIframe').locator('#fixture-demo').textContent(),'Protected prototype');
    assert.equal(await page.frameLocator('#mainIframe').locator('img').evaluate(node=>node.complete && node.naturalWidth>0),true);
    const directory = page.getByRole('navigation', {name:'已分享页面', exact:true});
    const toggle = page.getByRole('button', {name:'页面目录',exact:true});
    assert.equal(await directory.isVisible(), true, 'folder share directory starts expanded');
    assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    const initialFrame = await page.locator('#mainIframe').boundingBox();
    await toggle.click();
    assert.equal(await directory.isVisible(),false);
    await toggle.click();
    assert.equal(await directory.isVisible(), true);
    assert.deepEqual(await page.locator('#mainIframe').boundingBox(), initialFrame, 'floating directory must not resize the preview');
    assert.equal(await page.locator('#shareNavigationPanel').evaluate(el=>el.getBoundingClientRect().width <= 200),true);
    assert.equal(await page.locator('#shareNavigation h2, #shareNavigation p, .share-navigation__badge').count(),0);
    assert.equal(await page.locator('#pageSelectorTrigger').isDisabled(),true);
    assert.equal(await directory.getByRole('button').count(), 2);
    const groups = directory.locator('details');
    assert.equal(await groups.count(),3);
    assert.equal(await groups.evaluateAll(nodes=>nodes.every(node=>node.open)),true,'all folder levels start expanded even if collapsed in workspace');
    assert.equal(await directory.locator('details details details').count(),1);
    assert.equal(await directory.getByRole('button',{name:'书架',exact:true}).isVisible(),true);
    await directory.locator('summary').filter({hasText:'子文件夹'}).click();
    assert.equal(await directory.getByRole('button',{name:'书架',exact:true}).isVisible(),false);
    await page.evaluate(()=>window.shell.renderSidebar());
    assert.equal(await directory.locator('[data-share-folder="deeper"]').evaluate(el=>el.open),false,'manual folder collapse survives a render');
    await directory.locator('summary').filter({hasText:'子文件夹'}).click();
    assert.equal(await directory.getByRole('button',{name:'书架',exact:true}).isVisible(),true);

    const pin = page.locator('.share-navigation__pin');
    assert.equal(await pin.getAttribute('aria-pressed'),'false');
    assert.equal(await pin.locator('svg').count(),1);
    await pin.click();
    assert.equal(await pin.getAttribute('aria-pressed'),'true');
    await directory.getByRole('button',{name:'书架',exact:true}).click();
    await page.frameLocator('#mainIframe').locator('#library-demo').waitFor();
    assert.equal(await directory.isVisible(),true,'pinned directory stays open after navigation');
    assert.equal(await pin.getAttribute('aria-pressed'),'true','pin state survives tree rendering');
    await page.locator('.content-header').click({position:{x:400,y:30}});
    assert.equal(await directory.isVisible(),true,'outside clicks must not dismiss pinned directory');
    await page.getByRole('button',{name:'收起页面目录',exact:true}).click();
    assert.equal(await directory.isVisible(),false,'explicit close still works when pinned');
    await toggle.click();
    assert.equal(await pin.getAttribute('aria-pressed'),'true');
    await directory.getByRole('button',{name:'阅读器',exact:true}).click();
    await page.frameLocator('#mainIframe').locator('#fixture-demo').waitFor();
    assert.equal(await directory.isVisible(),true);
    await pin.click();
    assert.equal(await pin.getAttribute('aria-pressed'),'false');
    assert.equal(await directory.getByRole('button', {name:'阅读器',exact:true}).getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('#pageList button').count(), 0, 'editable workspace tree must not be rendered');
    assert.equal(await page.locator('#shareNavigation [draggable], #shareNavigation input, #shareNavigation [data-page-delete]').count(), 0);
    await directory.getByRole('button', {name:'书架',exact:true}).click();
    await page.frameLocator('#mainIframe').locator('#library-demo').waitFor();
    assert.equal(await directory.isVisible(),false,'selecting a page returns the space to the preview');
    assert.equal(await toggle.isVisible(),true);
    await toggle.click();
    assert.equal(await directory.getByRole('button', {name:'书架',exact:true}).getAttribute('aria-current'), 'page');
    await page.keyboard.press('Escape');
    assert.equal(await directory.isVisible(),false);
    assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
    await toggle.click();
    await page.getByRole('button',{name:'收起页面目录',exact:true}).click();
    assert.equal(await directory.isVisible(),false);
    await toggle.click();
    await page.locator('.content-header').click({position:{x:400,y:30}});
    assert.equal(await directory.isVisible(),false);
    assert.equal(await page.locator('#currentPageName').textContent(), '书架');
    const before = await page.locator('#mainIframe').getAttribute('src');
    await page.evaluate(async () => {
        await window.shell.switchPage('private', 'v1');
        await window.shell.switchPage('reader', 'v99');
        await window.shell.switchPage('reader', 'v1', {projectId:'private'});
        await window.shell.switchVersion('v99');
    });
    assert.equal(await page.locator('#mainIframe').getAttribute('src'), before);
    assert.equal((await page.request.get(origin+'/src/pages/fixture/private/v1/index.html')).status(),404);
    assert.equal((await page.request.post(origin+'/api/delete-page',{data:{pageId:'reader'}})).status(),405);
    assert.equal((await page.request.put(origin+'/src/pages/fixture/reader/v1/index.html',{data:'overwrite'})).status(),405);
    await page.screenshot({path:'/tmp/prota-folder-share-desktop-collapsed.png'});
    await toggle.click();
    await page.screenshot({path:'/tmp/prota-folder-share-desktop.png'});
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await directory.isVisible(),false);
    await toggle.click();
    assert.equal(await directory.isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
    await directory.getByRole('button',{name:'阅读器',exact:true}).click();
    await page.frameLocator('#mainIframe').locator('#fixture-demo').waitFor();
    assert.equal(await directory.isVisible(),false);
    await page.screenshot({path:'/tmp/prota-folder-share-mobile-collapsed.png'});
    await toggle.click();
    await page.screenshot({path:'/tmp/prota-folder-share-mobile.png'});
    assert.deepEqual(failures,[]);
    assert.deepEqual(writes,[], 'viewing and switching must not call write APIs');
    const stranger=await browser.newContext();
    assert.equal((await stranger.request.get(origin+'/src/pages/fixture/reader/v1/index.html')).status(),404);
    assert.equal((await stranger.request.get(origin+'/assets/fixture.svg')).status(),404);
    assert.equal((await stranger.request.get(origin+'/shares/reader.zip')).status(),404);
    await stranger.close();
    await page.evaluate(() => {
        const shell = window.shell;
        shell.shareConfig.pages = [];
        shell.shareConfig.folders = [];
        shell.applyShareModeFolderData();
        shell.renderSidebar();
    });
    assert.equal(await directory.getByRole('button').count(),0, 'empty folder shares must not fall back to workspace pages');
    assert.equal(await page.evaluate(()=>window.shell.projects.pages.length),0);
    console.log('Folder share: directory, nested pages, selection, desktop/mobile, navigation allowlist, no write requests, gateway read-only and unauthenticated resource denial passed');
} finally {
    await browser?.close();
    if (server) await new Promise(done=>server.close(done));
    await rm(base,{recursive:true,force:true});
}
