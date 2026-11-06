import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { chromium } from 'playwright-core';
import { createApp } from '../src/server.ts';
import { loadPacks } from '../src/rules.ts';
import { loadEnv, readConfig } from '../src/config.ts';
import { RemoteProvider } from '../src/provider.ts';
const executablePath=process.env.CHROME_PATH||`${homedir()}/.cache/puppeteer/chrome/mac_arm-152.0.7977.75/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
if(!existsSync(executablePath))throw new Error('Set CHROME_PATH to a local Chrome/Chromium executable. No browser is downloaded.');
const packs=await loadPacks();const checks=[];const errors=[];
const stub={model:'stub/ui',async select(_pack,query){
 if(query==='delayed')await new Promise(r=>setTimeout(r,600));
 const behavior=query==='unknown'?'abstain':query==='ambiguous'?'clarify':query==='conditional'?'conditional':'answer';
 return {model:this.model,value:{behavior,item_interpreted:query==='unsafe'?'<img src=x onerror=alert(1)>':'test item',selections:behavior==='abstain'?[]:[{rule_id:behavior==='conditional'?'hc-plastic-006':'hc-paper-001',condition_index:null}],clarifying_question:behavior==='clarify'?'Is it coated?':null}};
}};
const temp=await mkdtemp(`${tmpdir()}/refcycle-ui-`);let app=createApp(packs,stub,`${temp}/requests.jsonl`);
const start=async()=>{await new Promise(r=>app.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${app.address().port}`;};
const stop=()=>new Promise((resolve,reject)=>app.close(e=>e?reject(e):resolve()));
const browser=await chromium.launch({executablePath,headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync']});
try {
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(await start());await page.locator('#jurisdiction option').nth(3).waitFor({state:'attached'});assert.equal(await page.locator('#jurisdiction option').count(),4);checks.push('three jurisdictions loaded from API');
 await page.selectOption('#jurisdiction','hawaii_county_hi');
 const submit=async(query)=>{await page.fill('#query',query);await page.click('#submit');await page.locator('#result').waitFor({state:'visible'});};
 await submit('cardboard');assert.equal(await page.locator('#result-heading').innerText(),'Recycling');assert.ok(await page.locator('#prep li').count());assert.ok(await page.locator('#sources a').count());assert.match(await page.locator('#rule-ids').innerText(),/hc-paper-001/);checks.push('answer shows stream, prep, explanation, evidence and links');
 await submit('unknown');assert.match(await page.locator('#result-heading').innerText(),/don’t know/);assert.equal(await page.locator('#prep-block').isVisible(),false);checks.push('explicit unknown state');
 await submit('ambiguous');assert.equal(await page.locator('#question').innerText(),'Is it coated?');checks.push('clarifying question and edit guidance');
 await submit('conditional');assert.equal(await page.locator('#conditions li').count(),4);assert.match(await page.locator('#explanation').innerText(),/Field observation dated/);checks.push('conditional branches and field provenance');
 await submit('unsafe');assert.equal(await page.locator('#result img').count(),0);assert.match(await page.locator('#item').innerText(),/<img/);checks.push('model text rendered safely');
 await page.fill('#query','delayed');await page.click('#submit');assert.equal(await page.locator('#submit').isDisabled(),true);await page.selectOption('#jurisdiction','seattle_wa');await page.waitForTimeout(800);assert.equal(await page.locator('#result').isVisible(),false);checks.push('loading and stale-result cancellation');
 await page.route('**/api/ask',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Test failure'})}));await page.fill('#query','an item');await page.click('#submit');await page.locator('#error').waitFor({state:'visible'});assert.equal(await page.locator('#submit').isDisabled(),false);await page.unroute('**/api/ask');checks.push('request error and retry state');
 await stop();
 if(process.env.UI_LIVE==='1'){
  await loadEnv();app=createApp(packs,new RemoteProvider(readConfig()));await page.goto(await start());await page.locator('#jurisdiction option').nth(3).waitFor({state:'attached'});await page.selectOption('#jurisdiction','austin_tx');await page.fill('#query','a clean corrugated cardboard shipping box');await page.click('#submit');await page.locator('#result').waitFor({state:'visible',timeout:150000});assert.equal(await page.locator('#result-heading').innerText(),'Recycling');checks.push('live browser → API → Anthropic → grounded result');
 }else{app=createApp(packs,stub,`${temp}/requests.jsonl`);await page.goto(await start());await page.selectOption('#jurisdiction','hawaii_county_hi');await submit('cardboard');}
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/ui-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'artifacts/ui-mobile.png',fullPage:true});checks.push('desktop/mobile layout without horizontal overflow');
 assert.deepEqual(errors,[]);checks.push('no browser JavaScript errors');
 await context.close();
}finally{await browser.close();if(app.listening)await stop();}
const report={timestamp:new Date().toISOString(),live:process.env.UI_LIVE==='1',checks};await writeFile('artifacts/ui-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
