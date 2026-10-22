import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../portal/index.html',import.meta.url),'utf8');
const start=html.indexOf('<section id="vercelConnectionSummary"');
const summary=html.slice(start,html.indexOf('</section>',start)+10);
const browser=await chromium.launch({headless:true});
try {
    const page=await browser.newPage({viewport:{width:1000,height:800}});
    let state={state:'idle'};let agentRequests=0;
    page.on('request',request=>{if(request.url().includes('/api/agent'))agentRequests++;});
    await page.route('**/api/vercel/*',route=>{
        if(route.request().url().endsWith('/connect'))state={id:'fixture-connect',state:'authorizing',step:1,message:'请在浏览器中登录并授权 Vercel',authorizationUrl:'https://vercel.com/oauth/device?user_code=TEST'};
        if(route.request().url().endsWith('/cancel'))state={id:'fixture-connect',state:'cancelled',message:'已取消连接'};
        const data=route.request().url().endsWith('/connection')?{authState:'authorized',publishState:state.state==='ready'?'ready':'unconfigured',account:'sample-account',domain:state.state==='ready'?'assigned.vercel.app':''}:state;
        return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto('http://127.0.0.1:8080/api/product/health');
    await page.setContent('<link rel="stylesheet" href="/portal/modules/settings/settings.css"><div class="unified-settings"><form id="shareSettingsForm"><input type="radio" name="shareSetup" value="vercel" checked><input id="domain">'+summary+'</form></div>');
    await page.evaluate(async()=>{
        const {VercelConnection}=await import('/portal/modules/settings/vercel.js');
        window.loads=0;window.saved=0;
        const shell={vercelAutoConfigBtn:document.querySelector('#vercelAutoConfigBtn'),staticDomainInput:document.querySelector('#domain'),shareSettingsForm:document.querySelector('form'),settings:{staticDomain:''},unifiedSettings:{guardModels:()=>false,dirtyPanels:()=>[],markSaved:()=>window.saved++},loadSettings:async()=>window.loads++};
        window.connection=new VercelConnection(shell);
        document.querySelector('#vercelAutoConfigBtn').onclick=()=>window.connection.start();
    });
    await page.click('#vercelAutoConfigBtn');
    await page.locator('[data-vc-authorize]').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-vc-authorize]').getAttribute('href'),'https://vercel.com/oauth/device?user_code=TEST');
    assert.equal(await page.locator('#vercelAutoConfigBtn').isDisabled(),true);
    await page.screenshot({path:'/tmp/prota-vercel-browser-authorization.png'});
    await page.click('[data-vc-cancel]');await page.locator('[data-vc-retry]').waitFor({state:'visible'});
    assert.match(await page.locator('[data-vc-message]').textContent(),/取消/);
    state={id:'fixture-ready',state:'ready',step:4,message:'已连接，可以直接分享。',domain:'assigned.vercel.app'};
    await page.evaluate(()=>window.connection.poll());
    assert.equal(await page.evaluate(()=>window.loads),1);assert.equal(await page.evaluate(()=>window.saved),1);
    assert.equal(await page.locator('#vercelAutoConfigBtn').isEnabled(),true);
    state={id:'dns-job',state:'dns_required',message:'请添加记录',domain:'share.example.com',verification:[{type:'TXT',value:'<img src=x onerror=alert(1)>'}],dns:{recommendedCNAME:[{value:'target.example.com'}]}};
    await page.evaluate(()=>window.connection.poll());
    assert.match(await page.locator('[data-vc-dns]').textContent(),/target.example.com/);assert.equal(await page.locator('[data-vc-dns] img').count(),0);
    assert.equal(agentRequests,0);
    console.log('Vercel UI: browser authorization, cancellation, ready state, DNS rendering and no Agent dependency passed');
}finally{await browser.close();}
