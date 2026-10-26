import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 let records=Array.from({length:36},(_,i)=>({id:`share-${i}.html`,name:i===0?'阅读器 · 产品评审':`阅读方案 ${i+1}`,projectId:i%2?'team':'readify',projectName:i%2?'设计协作':'悦读',scope:'page',version:'v1',shareType:'static',status:'active',url:`https://sample.vercel.app/shares/share-${i}.html`,updatedAt:`2026-10-${String(23-Math.floor(i/3)).padStart(2,'0')}T09:00:00Z`,note:''}));
 let failRead=false,failWrite=false,holdRead=false,holdWrite=false,releaseRead,releaseWrite;
 await page.route(/\/api\/shares(?:\/manage)?$/,async route=>{
  const body=route.request().postDataJSON();
  const held=body?holdWrite:holdRead;
  if(held) await new Promise(resolve=>{if(body) releaseWrite=resolve;else releaseRead=resolve;});
  if(body?failWrite:failRead) return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:body?'部署失败，请重试':'读取失败，请重试'})}).catch(()=>{});
  if(body?.action==='copy') return route.fulfill({contentType:'application/json',body:JSON.stringify({share:{url:records.find(item=>item.id===body.ids[0]).url}})});
  if(body?.action==='revoke') for(const item of records) if(body.ids.includes(item.id)) item.status='revoked';
  if(body?.action==='annotate') records.find(item=>item.id===body.ids[0]).note=body.note;
  await route.fulfill({contentType:'application/json',body:JSON.stringify({items:records})}).catch(()=>{});
 });
 await page.goto(`${process.env.PROTA_TEST_ORIGIN || 'http://127.0.0.1:8080'}/api/product/health`);
 await page.setContent('<link rel="stylesheet" href="/portal/shell.css"><button id="shareManagerBtn">分享管理</button>');
 await page.evaluate(async()=>{const {ShareManager}=await import('/portal/modules/sharing/manager.js');window.copyAllowed=true;window.manager=new ShareManager({copyTextToClipboard:async text=>{window.copiedText=text;return window.copyAllowed;}});});
 const q=selector=>page.locator(selector);
 const open=async()=>{await page.click('#shareManagerBtn');await q('.sm-dialog').waitFor();await page.waitForFunction(()=>!window.manager.busy);};
 const menu=()=>q('.sm-action-popover:popover-open');
 await open();
 const initial=await q('.sm-dialog').boundingBox();
 assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-search')),true);
 await q('[data-copy="share-0.html"]').click();
 await page.waitForFunction(()=>window.copiedText);
 assert.match(await page.evaluate(()=>window.copiedText),/链接：https:\/\/sample.vercel.app/);
 await page.evaluate(()=>window.copyAllowed=false);
 await q('[data-copy="share-0.html"]').click();await page.getByText('复制失败，请重试。',{exact:true}).waitFor();
 assert.equal(await q('[data-copy="share-0.html"]').isEnabled(),true);
 await page.evaluate(()=>window.copyAllowed=true);
 await q('.sm-global-menu summary').click();
 const downloading=page.waitForEvent('download');await menu().getByRole('menuitem',{name:'导出清单'}).click();
 assert.equal((await downloading).suggestedFilename(),'分享清单.csv');
 // Opening the last row menu must not clip at the bottom of the scroll viewport.
 await q('tbody tr').last().locator('summary').click();
 await menu().waitFor();
 const bounds=await menu().boundingBox();assert(bounds.y>=0 && bounds.y+bounds.height<=850);
 await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'撤回分享');
 await page.keyboard.press('Escape');assert.equal(await menu().count(),0);assert.equal(await q('.sm-dialog').isVisible(),true);
 assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SUMMARY');
 // Detail navigation preserves list position and never focuses the editable note on entry.
 const scroll=await q('.sm-table-wrap').evaluate(node=>node.scrollTop);
 await q('tbody tr').last().locator('.sm-name').click();
 assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-back')),true);
 assert.deepEqual(await q('.sm-dialog').boundingBox(),initial);
 await page.keyboard.press('Escape');assert.equal(await q('.sm-list-view').isVisible(),true);
 assert(Math.abs(await q('.sm-table-wrap').evaluate(node=>node.scrollTop)-scroll)<2);
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.detail),'share-35.html');
 // Keyboard batch selection keeps focus. Changing the filter cannot retain hidden selections.
 await q('.sm-global-menu summary').click();await menu().getByRole('menuitem',{name:'批量管理'}).click();
 await q('[data-select="share-35.html"]').focus();await page.keyboard.press('Space');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.select),'share-35.html');
 await q('[data-search]').fill('产品评审');
 assert.match(await q('[data-selected-count]').textContent(),/0/);
 await q('[data-select="share-0.html"]').focus();await page.keyboard.press('Space');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.select),'share-0.html');
 await q('[data-revoke-selected]').click();await page.keyboard.press('Escape');
 assert.equal(await q('.sm-list-view').isVisible(),true);assert.equal(await q('[data-select="share-0.html"]').isChecked(),true);
 await page.keyboard.press('Escape');assert.equal(await q('.sm-batch').isVisible(),false);
 // Dirty note protection supports staying, saving, discarding and closing.
 await q('.sm-name').click();await q('#smNote').fill('未保存草稿');await page.keyboard.press('Escape');
 await q('.sm-unsaved').waitFor();assert.equal(await q('.sm-dialog').isVisible(),true);
 await page.keyboard.press('Escape');assert.equal(await q('#smNote').inputValue(),'未保存草稿');
 await q('[data-back]').click();await q('[data-save-leave]').click();
 await page.waitForFunction(()=>!window.manager.busy);assert.equal(records[0].note,'未保存草稿');
 assert.equal(await q('.sm-list-view').isVisible(),true);
 await q('.sm-name').click();assert.equal(await q('[data-note-save]').isDisabled(),true);
 await q('#smNote').fill('放弃的草稿');await q('[data-close]').click();await q('[data-discard]').click();
 await q('.sm-dialog').waitFor({state:'hidden'});await open();
 await q('.sm-name').click();assert.equal(await q('#smNote').inputValue(),'未保存草稿');
 await q('[data-back]').click();
 // Live filter reset is complete and Escape dismisses the filter before dismissing the dialog.
 await q('[data-filter-toggle]').click();await q('[data-project]').selectOption('readify');
 await page.keyboard.press('Escape');assert.equal(await q('.sm-filter').isVisible(),false);assert.equal(await q('.sm-dialog').isVisible(),true);
 await q('[data-search]').fill('不存在');await q('[data-reset-all]').click();assert.equal(await q('tbody tr').count(),36);
 // The list remains in place while a request runs; failed mutations preserve the confirmation for retry.
 await q('tbody tr').first().locator('summary').click();await menu().getByRole('menuitem',{name:'撤回分享'}).click();
 holdWrite=true;failWrite=true;await q('[data-confirm]').click();
 await page.waitForFunction(()=>window.manager.busy==='write');await page.keyboard.press('Escape');
 assert.equal(await q('.sm-confirm').isVisible(),true);assert.equal(await q('[data-close]').isDisabled(),true);
 assert.deepEqual(await q('.sm-dialog').boundingBox(),initial);
 holdWrite=false;releaseWrite();await page.getByText('部署失败，请重试',{exact:true}).waitFor();
 assert.equal(await q('[data-confirm]').isEnabled(),true);assert.equal(records[0].status,'active');
 assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-confirm')),true);
 failWrite=false;await q('[data-confirm]').click();await page.waitForFunction(()=>!window.manager.busy);
 assert.equal(records[0].status,'revoked');assert.equal(await q('.sm-list-view').isVisible(),true);
 // A read failure exposes a retry, and a slow read can be dismissed without blocking the dialog.
 failRead=true;await q('.sm-global-menu summary').click();await menu().getByRole('menuitem',{name:'刷新列表'}).click();
 await q('[data-retry]').waitFor();failRead=false;await q('[data-retry]').click();await page.waitForFunction(()=>!window.manager.busy);
 assert.equal(await q('[data-retry]').isVisible(),false);
 holdRead=true;await q('.sm-global-menu summary').click();await menu().getByRole('menuitem',{name:'刷新列表'}).click();
 await page.waitForFunction(()=>window.manager.busy==='read');assert.equal(await q('[data-close]').isEnabled(),true);
 await q('[data-close]').click();await q('.sm-dialog').waitFor({state:'hidden'});
 holdRead=false;releaseRead();await open();assert.equal(await q('tbody tr').count(),36);
 // A long title and action menu remain operable in a short mobile viewport.
 await page.setViewportSize({width:390,height:520});
 await q('tbody tr').first().locator('summary').click();await menu().waitFor();
 const mobileMenu=await menu().boundingBox();assert(mobileMenu.x>=0 && mobileMenu.x+mobileMenu.width<=390 && mobileMenu.y+mobileMenu.height<=520);
 await page.keyboard.press('Escape');
 const dialog=await q('.sm-dialog').boundingBox();assert(dialog.x>=0 && dialog.y>=0 && dialog.y+dialog.height<=520);
 assert.equal(await q('.sm-dialog').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
 await page.screenshot({path:'/tmp/prota-share-manager-interactions-mobile.png'});
 await page.setViewportSize({width:1280,height:850});await page.screenshot({path:'/tmp/prota-share-manager-interactions-desktop.png'});
 console.log('Interaction regressions passed: menu bounds and keyboard, stable dialog, scroll/focus restoration, scoped selection, dirty-note guard, mutation retry, cancellable loading, read retry and short mobile viewport.');
} finally {await browser.close();}
