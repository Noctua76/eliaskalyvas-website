import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {demoArticles} from '../src/signals/data.mjs';
import {getPublicArticles} from '../src/signals/adapter.mjs';
import {signalsEntryPaths} from '../src/signals/entries.mjs';
import {signalPath,routeFromPath,selectStories,filterArticles,navigationTopics,publicShareUrl} from '../src/signals/model.mjs';
import {signalsMetadata} from '../src/signals/metadata.mjs';
test('Signals production adapter exposes no drafts or illustrative publications',()=>{
 for(const lang of ['el','en']){assert.deepEqual(getPublicArticles({lang}),[]);const demo=getPublicArticles({lang,preview:true});assert.equal(demo.length,3);assert(demo.every(a=>a.status==='demo'&&a.publishedAt===null&&a.readingMinutes===null));}
});
test('Signals featured selection is independent of chronology and never duplicated in more',()=>{
 const demo=getPublicArticles({lang:'el',preview:true}).map((a,i)=>({...a,publishedAt:i?'2026-10-21':'2026-10-01'}));
 assert.notEqual(filterArticles(demo)[0].slug,demo[0].slug);
 const {featured,more}=selectStories(demo);assert.equal(featured.slug,demo[0].slug);assert(!more.some(a=>a.slug===featured.slug));
 assert.equal(selectStories(demo,'economy').featured.slug,demo[1].slug);
 assert.deepEqual(selectStories(demo,'politics'),{featured:null,more:[]});
 assert.deepEqual(navigationTopics(demo),['ai','economy','society','startups']);
});
test('Signals explicit routes cover all translations, direct entry and BASE_URL prefixes',async()=>{
 for(const base of ['/','/eliaskalyvas-website/'])for(const a of demoArticles){
  const path=signalPath(base,a.lang,a.slug,true);assert(path.includes('/signals-preview/')); assert.deepEqual(routeFromPath(path.split('?')[0],base),{lang:a.lang,slug:a.slug,preview:true});
  for(const [lang,slug] of Object.entries(a.translations))assert(demoArticles.some(t=>t.lang===lang&&t.slug===slug));
 }
 assert.equal(signalsEntryPaths.length,8);for(const p of signalsEntryPaths)await access(new URL('../'+p,import.meta.url));
 assert.equal(routeFromPath('/gr/admin/','/'),null);
 assert.equal(routeFromPath('/wrong/gr/signals/','/'),null);
});
test('Signals preview sharing is disabled even for a forged demo canonical',()=>{
 const a=demoArticles[0];assert.equal(publicShareUrl(a),null);assert.equal(publicShareUrl({...a,social:{...a.social,canonical:'https://example.test/article'}}),null);
 const published={...a,status:'published',publishedAt:'2026-10-01',social:{...a.social,canonical:'https://example.test/article/'}};
 assert.equal(publicShareUrl(published),'https://example.test/article/');assert.equal(publicShareUrl({...published,social:{canonical:'javascript:alert(1)'}}),null);
});
test('Signals public content has provenance, optional blocks and 3–5 relevant hashtags',()=>{
 for(const a of demoArticles){assert(a.hashtags.length>=3&&a.hashtags.length<=5);assert(a.image.url&&a.image.alt&&a.image.creator&&a.image.license&&a.image.caption);assert(!('research'in a||'tickets'in a||'cost'in a||'credentials'in a));}
 assert(demoArticles.some(a=>a.body.some(b=>b.type==='quote')));assert(demoArticles.some(a=>!a.body.some(b=>b.type==='quote')));
});
test('Signals demo entries are noindex and omitted from existing sitemap',async()=>{
 const sitemap=await readFile(new URL('../public/sitemap.xml',import.meta.url),'utf8');assert(!sitemap.includes('/signals/'));
 for(const article of demoArticles){const head=signalsMetadata({lang:article.lang,article});assert(head.includes('noindex,follow'));assert(!head.includes('rel="canonical"')&&!head.includes('og:image'));}
});
test('Signals approved metadata is emitted as escaped initial HTML for social crawlers',()=>{
 const a={...demoArticles[0],status:'published',publishedAt:'2026-10-01',social:{title:'Human < AI & "choices"',description:'An approved description',canonical:'https://example.test/gr/signals/story/',image:'https://example.test/cover.jpg'}};
 const head=signalsMetadata({lang:'el',article:a});assert(head.includes('index,follow'));assert(head.includes('og:title'));assert(head.includes('og:description'));assert(head.includes('og:image'));assert(head.includes('rel="canonical"'));assert(head.includes('&lt; AI &amp; &quot;choices&quot;'));assert(!head.includes('Human < AI'));
});
