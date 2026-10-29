// Explicit native browser acceptance. No owner login, form submission or AI calls.
// node test/phase4c-browser.acceptance.mjs <playwright-core/index.mjs> <chromium> <normal-dist>
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const [pw,binary,out]=process.argv.slice(2),{chromium}=await import(pathToFileURL(pw));
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname,file=resolve(out,'.'+path+(path.endsWith('/')?'index.html':''));assert(file.startsWith(resolve(out)+sep));const bytes=await readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(bytes);}catch{res.statusCode=404;res.setHeader('Content-Type','text/html');res.end(await readFile(resolve(out,'404.html')));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:binary,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--disable-gpu'],env:{...process.env,LD_LIBRARY_PATH:resolve(binary,'..'),FONTCONFIG_PATH:resolve(binary,'../fonts')}});
const slugs=['who-decides-when-ai-suggests','which-problems-deserve-funding','what-should-remain-human'];let noJS=0,js=0,production=0;
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({javaScriptEnabled:false,viewport});
  for(const lang of ['gr','en']){const page=await context.newPage();
   for(const slug of ['',...slugs]){const r=await page.goto(origin+`/${lang}/signals-preview/${slug?slug+'/':''}`);assert.equal(r.status(),200);assert.equal(await page.locator('.signals-preview-note').count(),1);assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,follow');assert.equal(await page.locator('link[rel=canonical],script[type="application/ld+json"]').count(),0);if(slug)assert.equal(await page.locator('.signals-prose').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));noJS++;}
   await page.goto(origin+`/${lang}/signals/?preview=1`);assert.equal(await page.locator('.signals-preview-note').count(),0);assert.equal(await page.locator('.signals-waiting').count(),1);assert(page.url().endsWith('?preview=1'));noJS++;
   for(const ns of ['signals','signals-preview']){const r=await page.goto(origin+`/${lang}/${ns}/absent-native-test/`);assert.equal(r.status(),404);noJS++;}await page.close();
  }await context.close();
  const enabled=await browser.newContext({viewport});
  for(const lang of ['gr','en']){const page=await enabled.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   for(const tail of ['',slugs[0]+'/']){await page.goto(origin+`/${lang}/signals/${tail}?preview=1`);await page.waitForURL('**/signals-preview/**');await page.waitForSelector('.signals-preview-note');assert(!page.url().includes('?preview'));js++;}
   const title=await page.locator('h1').textContent();await page.reload();assert.equal(await page.locator('h1').textContent(),title);await page.waitForSelector('.legal-links button');const reject=page.getByRole('button',{name:lang==='gr'?'Απόρριψη μη απαραίτητων':'Reject non-essential',exact:true});if(await reject.count())await reject.click();await page.locator('.legal-links button').click();await page.getByRole('button',{name:lang==='gr'?'Κλείσιμο':'Close',exact:true}).click();await page.locator('.signals-back').click();await page.waitForSelector('.signals-featured');await page.locator('.signals-read').click();await page.waitForSelector('.signals-prose');assert.deepEqual(errors,[]);js++;
   await page.close();
  }await enabled.close();
 }
 console.log(JSON.stringify({browser:await browser.version(),target:'isolated normal build',nativeNoJSCases:noJS,nativeJSCases:js,result:'PASS'}));
 // Optional production check requires a browser with an appropriate trusted CA
 // store. Never set ignoreHTTPSErrors or bypass a certificate warning.
 if(process.argv[5]==='--production'){
 const prod=await browser.newContext({proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined,viewport:{width:1440,height:1000}});
 for(const lang of ['gr','en']){const page=await prod.newPage();
  for(const route of ['','book/','admin/','privacy/','terms/','signals/','signals-preview/']){const r=await page.goto(`https://eliaskalyvas.gr/${lang}/${route}`,{timeout:45000});assert.equal(r.status(),200);await page.locator('h1').waitFor();if(route==='book/'){await page.locator('.ops-booking-grid').waitFor({timeout:20000});assert.equal(await page.locator('.ops-error').count(),0);}if(route==='admin/')assert.equal(await page.locator('form').count(),1);production++;}
  await page.close();
 }await prod.close();}
 console.log(JSON.stringify({browser:await browser.version(),nativeNoJSCases:noJS,nativeJSCases:js,productionRoutes:production,result:'PASS'}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
