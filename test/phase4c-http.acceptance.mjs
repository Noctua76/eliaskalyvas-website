// Explicit read-only live smoke. Never loaded by npm test/build.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const run=promisify(execFile),origin='https://eliaskalyvas.gr',root=new URL('../',import.meta.url);
const slugs=['who-decides-when-ai-suggests','which-problems-deserve-funding','what-should-remain-human'];
const paths=['/',...['gr','en'].flatMap(l=>['','book/','admin/','privacy/','terms/','signals/','signals/?preview=1','signals-preview/'].map(p=>`/${l}/${p}`)),...['gr','en'].flatMap(l=>['signals','signals-preview'].flatMap(ns=>slugs.map(s=>`/${l}/${ns}/${s}/`))),...['gr','en'].flatMap(l=>['signals','signals-preview'].map(ns=>`/${l}/${ns}/absent-nyra-acceptance/`))];
async function get(path){const {stdout}=await run('curl',['-sSL','--max-time','45','-w','\n%{http_code}',origin+path],{encoding:'buffer',maxBuffer:4e6});const at=stdout.lastIndexOf(10);return {path,status:Number(stdout.subarray(at+1).toString()),body:stdout.subarray(0,at)};}
const cache=new Map(),scripts=new Set(),seen=new Set();for(let i=0;i<paths.length;i+=4)for(const r of await Promise.all(paths.slice(i,i+4).map(get)))cache.set(r.path,r);
for(const {path,status,body}of cache.values()){
 const missing=path.includes('absent-nyra');assert.equal(status,missing?404:200,path);const d=new JSDOM(body.toString()).window.document;
 assert(!/PRIVATE_EXCERPT_CANARY|SYNTHETIC_PHASE3_PUBLIC_TEST|synthetic-token-001|nyra_delivery_receipt|loadPrivateRuntime/.test(body.toString()),path);
 for(const s of d.querySelectorAll('script[src]'))scripts.add(s.getAttribute('src'));
 if(path.includes('/signals')){assert(d.querySelector('meta[name=robots]')?.content.includes('noindex'),path);assert.equal(d.querySelectorAll('script[type="application/ld+json"]').length,0,path);if(!missing){assert.deepEqual(JSON.parse(d.querySelector('#signals-public-data').textContent),[],path);assert.equal(!!d.querySelector('.signals-preview-note'),path.includes('/signals-preview/'),path);if(path.includes('?preview=1'))assert.deepEqual(body,cache.get(path.split('?')[0]).body,path);}}
 if(['/gr/','/en/'].includes(path)){const ld=new JSDOM(await readFile(new URL(path.slice(1)+'index.html',root),'utf8')).window.document;for(const sel of ['title','meta[name=description]','link[rel=canonical]','meta[property="og:title"]'])assert.equal(d.querySelector(sel)?.outerHTML,ld.querySelector(sel)?.outerHTML,path+' '+sel);}
}
for(const path of ['/sitemap.xml','/robots.txt','/favicon.ico','/favicon-16x16.png','/favicon-32x32.png']){const {status,body}=await get(path);assert.equal(status,200);assert.deepEqual(body,await readFile(new URL('public'+path,root)),path);}
while(scripts.size){const src=scripts.values().next().value;scripts.delete(src);if(seen.has(src))continue;seen.add(src);const {status,body}=await get(src);assert.equal(status,200,src);const text=body.toString();assert(!/PRIVATE_EXCERPT_CANARY|SYNTHETIC_PHASE3_PUBLIC_TEST|synthetic-token-001|nyra_delivery_receipt|loadPrivateRuntime|service_role/.test(text),src);for(const m of text.matchAll(/["'](\.?\.?\/[^"'\n]+\.js)["']/g)){const p=new URL(m[1],origin+src).pathname;if(!seen.has(p))scripts.add(p);}}
console.log(JSON.stringify({result:'PASS',productionRoutes:cache.size,clientBundles:seen.size,byteIdenticalStaticAssets:5}));
