// P4-B01 native browser/HTTP/no-JS acceptance; no production connections.
// node test/phase4b-browser.acceptance.mjs /absolute/playwright-core/index.mjs /absolute/chromium-binary
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {readFile,rm,mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {staticFixture} from './fixtures/signals-publication.mjs';
import {buildSyntheticPublication} from '../lib/signals/static-build.mjs';
const {chromium}=await import(pathToFileURL(process.argv[2]));
const f=await staticFixture(),out=await buildSyntheticPublication(f.options(f.pair()));
const screenshots=await mkdtemp(join(tmpdir(),'signals-layout-'));
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(out,'.'+path+(path.endsWith('/')?'index.html':''));
  if(!file.startsWith(out+sep))throw Error('outside');const bytes=await readFile(file);
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(bytes);
 }catch{res.statusCode=404;res.setHeader('Content-Type','text/html');res.end(await readFile(join(out,'404.html')));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.argv[3],args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--disable-gpu'],headless:true});let count=0;
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();if(url.href===f.gr.presentation.cover.url)return route.fulfill({body:f.bytes,contentType:'image/png'});return route.abort();});
  for(const lang of ['gr','en']){
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
   const r=lang==='gr'?f.gr:f.en,url=origin+`/${lang}/signals/${r.slug}/`;
   const response=await page.goto(url);assert.equal(response.status(),200);await page.waitForSelector('.signals-prose p');await page.waitForSelector('.legal-links button');
   const reject=page.getByRole('button',{name:lang==='gr'?'Απόρριψη μη απαραίτητων':'Reject non-essential',exact:true});if(await reject.count())await reject.click();
   assert.equal(await page.locator('h1').textContent(),r.content.title);assert.equal(await page.locator('.signals-prose p').first().evaluate(e=>e.childNodes[0].textContent),r.content.blocks[0].text);
   assert.equal(await page.locator('.signals-prose p').first().locator('a').count(),2);assert.equal(await page.locator('h1').count(),1);
   const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,text:e.textContent.slice(0,80)}))}));
   await page.screenshot({path:join(screenshots,`${lang}-${viewport.width}-before.png`),fullPage:true});
   assert(overflow.scroll<=overflow.width,JSON.stringify({viewport,lang,overflow,screenshots}));
   await page.screenshot({path:join(screenshots,`${lang}-${viewport.width}-article.png`),fullPage:true});
   await page.reload();await page.waitForSelector('.legal-links button');assert.equal(await page.locator('h1').textContent(),r.content.title);
   await page.locator('.signals-back').click();await page.waitForSelector('.signals-featured');assert.equal(await page.locator('h1').textContent(),'Signals.');
   await page.screenshot({path:join(screenshots,`${lang}-${viewport.width}-listing.png`),fullPage:true});
   await page.locator('.signals-read').click();await page.waitForSelector('.signals-prose');assert.equal(await page.locator('h1').textContent(),r.content.title);
   const other=lang==='gr'?'en':'el';await page.locator(`.signals-languages a[lang=${other}]`).click();await page.waitForSelector('.signals-prose');assert.equal(await page.locator('h1').textContent(),(lang==='gr'?f.en:f.gr).content.title);
   await page.goto(origin+`/${lang}/signals/who-decides-when-ai-suggests/?preview=1`);await page.waitForSelector('.signals-preview-note');assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,follow');assert.equal(await page.locator('.signals-citation').count(),1);assert(!await page.locator('#root').textContent().then(s=>s.includes('SYNTHETIC_PHASE3_PUBLIC_TEST')));
   await page.goto(origin+`/${lang}/signals/?preview=1`);await page.waitForSelector('.signals-preview-note');assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,follow');assert.equal(await page.locator('script[type="application/ld+json"]').count(),0);assert(!await page.locator('#root').textContent().then(s=>s.includes('SYNTHETIC_PHASE3_PUBLIC_TEST')));
   await page.goto(origin+`/${lang}/signals-preview/`);await page.waitForSelector('.signals-preview-note');assert.equal(await page.locator('[data-signal]').count(),3);
   await page.locator('.signals-read').click();await page.waitForSelector('.signals-prose');assert(page.url().includes('/signals-preview/'));const previewTitle=await page.locator('h1').textContent();await page.reload();await page.waitForSelector('.signals-prose');assert.equal(await page.locator('h1').textContent(),previewTitle);
   await page.locator(`.signals-languages a[lang=${other}]`).click();await page.waitForSelector('.signals-prose');assert(page.url().includes('/signals-preview/'));assert.equal(await page.locator('link[rel=canonical],script[type="application/ld+json"]').count(),0);
   await page.screenshot({path:join(screenshots,`${lang}-${viewport.width}-preview.png`),fullPage:true});
   const missingPreview=await page.goto(origin+`/${lang}/signals-preview/not-a-demo/`);assert.equal(missingPreview.status(),404);assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,follow');
   const missing=await page.goto(origin+`/${lang}/signals/not-an-approved-route/`);assert.equal(missing.status(),404);
   assert.deepEqual(errors,[]);await page.close();count++;
  }
  await context.close();
 }
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:1440,height:1000},deviceScaleFactor:1});
 for(const lang of ['gr','en']){const page=await noJS.newPage();
  let response=await page.goto(origin+`/${lang}/signals/?preview=1`);assert.equal(response.status(),200);assert.equal(await page.locator('.signals-preview-note').count(),0);assert.equal(await page.locator('h1').textContent(),'Signals.');assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'index,follow');assert(page.url().endsWith('?preview=1'));
  response=await page.goto(origin+`/${lang}/signals-preview/who-decides-when-ai-suggests/`);assert.equal(response.status(),200);assert.equal(await page.locator('.signals-preview-note').count(),1);assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,follow');assert.equal(await page.locator('link[rel=canonical],script[type="application/ld+json"]').count(),0);await page.close();
 }await noJS.close();
 console.log(JSON.stringify({noJSCases:4,browser:await browser.version(),cases:count,result:'PASS',screenshots},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(out,{recursive:true,force:true});await f.close();}
