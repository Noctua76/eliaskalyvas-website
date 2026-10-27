// Optional native-browser acceptance, not an npm-test prerequisite or CI workflow change.
// node test/signals-browser.acceptance.mjs /absolute/playwright-core/index.mjs /absolute/chromium-binary
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
 }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.argv[3],args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader'],headless:true});let count=0;
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
   const missing=await page.goto(origin+`/${lang}/signals/not-an-approved-route/`);assert.equal(missing.status(),404);
   assert.deepEqual(errors,[]);await page.close();count++;
  }
  await context.close();
 }
 console.log(JSON.stringify({browser:await browser.version(),cases:count,result:'PASS',screenshots},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(out,{recursive:true,force:true});await f.close();}
