/** Full generated Vercel bundle, without uploading business data or using credentials. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const base = await mkdtemp(join(tmpdir(), 'prota-publish-browser-'));
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
(root / 'shares').mkdir()
share = root / 'shares/reader-v1-static.html'
share.write_text(build_share_page_html({'enabled':True,'projectId':'fixture','pageId':'reader','pageName':'Fixture Reader','version':'v1','targetDevice':'web','shareType':'static','annotations':[],'zipFilename':'reader.zip'}))
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
    page.on('pageerror', error=>failures.push(error.message));
    const response=await page.goto(origin+'/shares/reader-v1-static.html');
    assert.equal(response.status(),401);
    await page.getByLabel('访问密码').fill('a4B9');
    await page.screenshot({path:'/tmp/prota-share-password-gate.png'});
    await page.getByRole('button',{name:'查看分享'}).click();
    await page.frameLocator('#mainIframe').locator('#fixture-demo').waitFor({timeout:20000});
    assert.equal(await page.frameLocator('#mainIframe').locator('#fixture-demo').textContent(),'Protected prototype');
    assert.equal(await page.frameLocator('#mainIframe').locator('img').evaluate(node=>node.complete && node.naturalWidth>0),true);
    assert.equal((await page.request.get(origin+'/shares/reader.zip')).status(),200);
    await page.screenshot({path:'/tmp/prota-share-protected-preview.png'});
    assert.deepEqual(failures,[]);
    const stranger=await browser.newContext();
    assert.equal((await stranger.request.get(origin+'/src/pages/fixture/reader/v1/index.html')).status(),404);
    assert.equal((await stranger.request.get(origin+'/assets/fixture.svg')).status(),404);
    assert.equal((await stranger.request.get(origin+'/shares/reader.zip')).status(),404);
    await stranger.close();
    console.log('Published bundle: password → shared Portal → prototype iframe, CSS, asset and ZIP access; unauthenticated resource denial passed');
} finally {
    await browser?.close();
    if (server) await new Promise(done=>server.close(done));
    await rm(base,{recursive:true,force:true});
}
