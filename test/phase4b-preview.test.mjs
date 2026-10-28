import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {JSDOM} from 'jsdom';
import {build} from 'vite';
import {staticFixture} from './fixtures/signals-publication.mjs';
import {buildSyntheticPublication} from '../lib/signals/static-build.mjs';
import {signalsPreviewEntryPaths,signalsEntryPaths} from '../src/signals/entries.mjs';
import {routeFromPath,signalPath} from '../src/signals/model.mjs';
import {demoArticles} from '../src/signals/data.mjs';
let f,normal,published;
const page=async(root,path)=>new JSDOM(await readFile(join(root,path),'utf8')).window.document;
before(async()=>{f=await staticFixture();published=await buildSyntheticPublication(f.options(f.pair()));normal=await mkdtemp(join(tmpdir(),'nyra-phase4b-normal-'));const {default:config}=await import('../vite.config.js');await build({...config,configFile:false,build:{...config.build,outDir:normal,emptyOutDir:true},logLevel:'error'});});
after(async()=>{await rm(normal,{recursive:true,force:true});await rm(published,{recursive:true,force:true});await f?.close()});
test('P4-B01 eight static preview paths have initial noindex, correct demo body and no public article metadata',async()=>{
 assert.equal(signalsPreviewEntryPaths.length,8);assert.equal(signalsEntryPaths.length,8);
 for(const root of [normal,published])for(const path of signalsPreviewEntryPaths){
  const d=await page(root,path);assert.equal(d.querySelector('meta[name=robots]').content,'noindex,follow');assert(d.querySelector('.signals-preview-note'));assert.equal(d.querySelectorAll('link[rel=canonical],link[hreflang],meta[property^="og:"],script[type="application/ld+json"]').length,0);assert.deepEqual(JSON.parse(d.querySelector('#signals-public-data').textContent),[]);
  for(const a of d.querySelectorAll('main a[href*="/signals"]'))assert(a.getAttribute('href').includes('/signals-preview/'));
 }
});
test('P4-B01 no previews in sitemap or approved listing initial HTML; normal build remains unpublished',async()=>{
 for(const root of [normal,published])assert(!(await readFile(join(root,'sitemap.xml'),'utf8')).includes('signals-preview'));
 assert.equal(await readFile(join(normal,'sitemap.xml'),'utf8'),await readFile(new URL('../public/sitemap.xml',import.meta.url),'utf8'));
 for(const lang of ['gr','en']){
  const d=await page(published,`${lang}/signals/index.html`);assert.equal(d.querySelector('meta[name=robots]').content,'index,follow');assert(!d.querySelector('.signals-preview-note'));
  for(const a of demoArticles)assert(!d.querySelector('#root').textContent.includes(a.title));
  const n=await page(normal,`${lang}/signals/index.html`);assert.equal(n.querySelector('meta[name=robots]').content,'noindex,follow');assert.equal(n.querySelectorAll('[data-signal]').length,0);assert(!n.querySelector('.signals-preview-note'));
 }
});
test('P4-B01 preview links and static aliases normalize GR/EN and configured base correctly',async()=>{
 for(const lang of ['el','en'])for(const base of ['/','/eliaskalyvas-website/']){
  const route=signalPath(base,lang,'who-decides-when-ai-suggests',true);assert(!route.includes('?'));assert.deepEqual(routeFromPath(route,base),{lang,slug:'who-decides-when-ai-suggests',preview:true});assert.deepEqual(routeFromPath(route+'index.html',base),{lang,slug:'who-decides-when-ai-suggests',preview:true});
 }

});

test('P4B normal browser bundles exclude the private runtime and synthetic editorial records',async()=>{
 for(const name of await readdir(join(normal,'assets'))){if(!name.endsWith('.js'))continue;const text=await readFile(join(normal,'assets',name),'utf8');for(const privateMarker of ['nyra_delivery_machine','MACHINE_SELECTOR_FORBIDDEN','UNVERIFIED_BUILD_ARTIFACT','PRIVATE_REPORT_CANARY','synthetic-token-001'])assert(!text.includes(privateMarker),name+': '+privateMarker)}
});
