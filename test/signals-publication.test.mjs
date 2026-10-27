import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,rm,mkdtemp,mkdir,symlink,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {build,createServer} from 'vite';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {hydrateRoot} from 'react-dom/client';
import {staticFixture} from './fixtures/signals-publication.mjs';
import {sealFixture,dataset,uid,NOW} from './fixtures/publication-v1.1.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
import {prepareSyntheticPublication,buildSyntheticPublication} from '../lib/signals/static-build.mjs';
import {publicationMetadata,publicationSitemap} from '../lib/signals/seo.mjs';
import {publicViews} from '../src/signals/public-view.mjs';
let f,outputs=[],grOut,enOut,pairOut,withdrawnOut,normalOut,render,App,server;
const html=(dir,path)=>readFile(join(dir,path),'utf8');
const dom=s=>new JSDOM(s);
const page=r=>`${r.locale==='el'?'gr':'en'}/signals/${r.slug}/index.html`;
before(async()=>{
 f=await staticFixture();
 grOut=await buildSyntheticPublication(f.options([f.gr]));outputs.push(grOut);
 enOut=await buildSyntheticPublication(f.options([f.en]));outputs.push(enOut);
 const pair=f.pair(),related=structuredClone(f.gr);
 related.article_id=uid(301);related.variant_id=uid(302);related.slug='phase3-related';related.canonical_url='https://eliaskalyvas.gr/gr/signals/phase3-related/';related.release.id=uid(306);related.authorization.id=uid(305);sealFixture(related);
 pair[0].presentation.related_article_ids=[related.article_id];sealFixture(pair[0]);
 pairOut=await buildSyntheticPublication(f.options([...pair,related]));outputs.push(pairOut);
 const withdrawn=f.options([f.pair()[0]]);withdrawn.dataset.manifest.withdrawn_variants=[{article_id:f.en.article_id,variant_id:f.en.variant_id,locale:'en',event_id:uid(400),withdrawn_at:'2026-10-27T10:40:00.000Z',target_release_id:f.en.release.id}];
 withdrawnOut=await buildSyntheticPublication(withdrawn);outputs.push(withdrawnOut);
 const {default:normal}=await import('../vite.config.js');normalOut=await mkdtemp(join(tmpdir(),'signals-normal-'));outputs.push(normalOut);
 await build({...normal,configFile:false,build:{...normal.build,outDir:normalOut,emptyOutDir:true},logLevel:'error'});
 server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 ({renderSignals:render}=await server.ssrLoadModule('/src/signals/entry-server.jsx'));({default:App}=await server.ssrLoadModule('/src/signals/SignalsApp.jsx'));
});
after(async()=>{await server?.close();for(const p of outputs)await rm(p,{recursive:true,force:true});await f?.close();});
test('Phase3 initial article HTML contains exact complete ordered blocks, citations, image, identity and dates',async()=>{
 const d=dom(await html(grOut,page(f.gr))).window.document,root=d.querySelector('#root');
 assert.equal(root.querySelector('h1').textContent,f.gr.content.title);assert(root.textContent.includes(f.gr.content.summary));
 const blocks=[...root.querySelector('.signals-prose').children];assert.deepEqual(blocks.map(b=>b.tagName),['P','H2','BLOCKQUOTE','UL','P']);
 assert(blocks[0].textContent.startsWith(f.gr.content.blocks[0].text));assert.equal(blocks[0].querySelectorAll('a').length,2);assert.equal(blocks[2].querySelectorAll('a').length,2);assert.equal(blocks[3].firstChild.querySelectorAll('a').length,2);assert.equal(blocks[3].children.length,3);
 assert.equal(blocks[0].querySelectorAll('a')[1].textContent,' [s2]');assert.equal(root.querySelector('#source-s2 a').href,'https://www.unesco.org/');
 assert(root.textContent.includes(f.gr.identity.disclosure));assert.equal(root.querySelector('time').dateTime,f.gr.release.first_published_at);assert.equal(root.querySelector('.signals-media-hero img').alt,f.gr.presentation.cover.alt);assert(root.textContent.includes(f.gr.presentation.cover.attribution.license_name));
});
test('Phase3 GR-only and EN-only generate no absent-language article route or inferred translation',async()=>{
 for(const [out,r,absent]of [[grOut,f.gr,f.en],[enOut,f.en,f.gr]]){
  await html(out,page(r));await assert.rejects(html(out,page(absent)),/ENOENT/);
  const d=dom(await html(out,page(r))).window.document;assert.equal(d.documentElement.lang,r.locale);
  assert.equal(d.querySelectorAll('link[hreflang]').length,1);assert.equal(d.querySelector('link[rel=canonical]').href,r.canonical_url);
  assert(!d.querySelector('.signals-languages').innerHTML.includes(`href="/${absent.locale==='el'?'gr':'en'}/signals/${r.slug}`));
  const listing=dom(await html(out,`${r.locale==='el'?'gr':'en'}/signals/index.html`)).window.document;assert(listing.querySelector('#root').textContent.includes(r.content.title));assert.equal(listing.querySelector('meta[name=robots]').content,'index,follow');
 }
});
test('Phase3 reciprocal active translations exclusively govern hreflang and language links',async()=>{
 const pair=f.pair();for(const r of pair){const d=dom(await html(pairOut,page(r))).window.document;assert.equal(d.querySelectorAll('link[hreflang]').length,2);for(const other of pair)assert.equal(d.querySelector(`link[hreflang=${other.locale}]`).href,other.canonical_url);}
 const only=dataset([pair[0]]),head=publicationMetadata({locale:'el',release:pair[0],dataset:only});assert(!head.includes('hreflang="en"'));
 const sitemap=publicationSitemap('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',only);assert(!sitemap.includes(pair[1].canonical_url));
});
test('Phase3 metadata/schema matches visible approved values without human-author invention',async()=>{
 const d=dom(await html(grOut,page(f.gr))).window.document,json=JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent);
 assert.equal(d.title,f.gr.presentation.seo_title);assert.equal(d.querySelector('meta[name=description]').content,f.gr.presentation.seo_description);assert.equal(d.querySelector('meta[property="og:title"]').content,f.gr.presentation.social_title);assert.equal(d.querySelector('meta[name="twitter:image"]').content,f.gr.presentation.cover.url);assert.equal(json.headline,d.querySelector('h1').textContent);assert.equal(json.dateModified,f.gr.release.modified_at);assert.equal(json.editor['@id'],f.gr.identity.human_editor_id);assert.equal(json.publisher.name,'Elias Kalyvas');assert(!('author' in json));assert.equal(json.about.description,'AI editorial voice of Signals');assert.equal(json.creditText,f.gr.identity.disclosure);
});
test('Phase3 sitemap includes only active exact canonicals and actual modified times, with XML escaping',async()=>{
 const xml=await html(pairOut,'sitemap.xml'),d=new JSDOM(xml,{contentType:'text/xml'}).window.document;
 assert.equal(d.querySelectorAll('parsererror').length,0);const urls=[...d.querySelectorAll('loc')].map(e=>e.textContent);assert.equal(new Set(urls).size,urls.length);assert(urls.includes(f.gr.canonical_url)&&urls.includes(f.en.canonical_url));assert(!xml.includes('preview=')&&!xml.includes('who-decides-when-ai-suggests'));assert.equal(d.querySelector('lastmod').textContent,f.gr.release.modified_at);
 const base='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://eliaskalyvas.gr/?a=1&amp;b=2</loc></url></urlset>';assert(publicationSitemap(base,dataset([f.gr])).includes('?a=1&amp;b=2'));
});
test('Phase3 HTML, JSON-LD and embedded state escape script and attribute injection without changing text',()=>{
 const r=structuredClone(f.gr);r.content.title='Exact </script><script>globalThis.PWNED=true</script> & "title"';r.content.blocks[0].text='<img src=x onerror="alert(1)">';r.presentation.seo_title='"/><script>alert(1)</script>';sealFixture(r);
 const head=publicationMetadata({locale:'el',release:r,dataset:dataset([r])}),d=dom('<html><head>'+head+'</head></html>').window.document;
 assert.equal(d.querySelectorAll('script').length,1);assert.equal(JSON.parse(d.querySelector('script').textContent).headline,r.content.title);assert(!head.includes('<script>globalThis'));
 const markup=render({lang:'el',slug:r.slug,publicArticles:publicViews(dataset([r]))});assert(markup.includes('&lt;img'));assert(!markup.includes('<img src=x'));
});
test('Phase3 normal build has crawlable waiting HTML, noindex demos and no synthetic/private markers',async()=>{
 for(const locale of ['gr','en']){const d=dom(await html(normalOut,`${locale}/signals/index.html`)).window.document;assert.equal(d.querySelector('h1').textContent,'Signals.');assert(d.querySelector('.signals-waiting'));assert.equal(d.querySelector('meta[name=robots]').content,'noindex,follow');assert.deepEqual(JSON.parse(d.querySelector('#signals-public-data').textContent),[]);}
 assert.equal(await html(normalOut,'sitemap.xml'),await readFile('public/sitemap.xml','utf8'));
 for(const path of ['gr/signals/who-decides-when-ai-suggests/index.html','en/signals/which-problems-deserve-funding/index.html'])assert.equal(dom(await html(normalOut,path)).window.document.querySelector('meta[name=robots]').content,'noindex,follow');
 const walk=async p=>{for(const e of await readdir(p,{withFileTypes:true})){const file=join(p,e.name);if(e.isDirectory())await walk(file);else if(/\.(html|js|json|xml)$/.test(e.name)){const text=await readFile(file,'utf8');for(const marker of ['SYNTHETIC_PHASE3_PUBLIC_TEST','PRIVATE_EXCERPT_CANARY','PRIVATE_RESEARCH_TICKET','sk-proj-','authorized_held','RIGHTS_DECISIONS_REQUIRED'])assert(!text.includes(marker),file+': '+marker);}}};await walk(normalOut);
});
test('Phase3 actual bytes are packaged unchanged and template requires exact separately recorded rights decision',async()=>{
 assert.deepEqual(await readFile(join(grOut,f.assetPath)),f.bytes);
 const r=structuredClone(f.gr);r.presentation.cover.kind='editorial_template';r.presentation.cover.template_id=uid(876);sealFixture(r);await prepareSyntheticPublication(f.options([r]));
 const options=f.options([r]);options.rightsDecisions[0].template_id=uid(877);await assert.rejects(prepareSyntheticPublication(options),/RIGHTS_DECISION_REQUIRED/);
});
for(const kind of ['missing','hash','dimensions','mime','rights','rights-date','alt','private-field','unapproved-reference','unknown-version','corrupt-image','symlink'])test('Phase3 fails closed for '+kind,async()=>{
 const r=structuredClone(f.gr),options=f.options([r]);let temp;
 if(kind==='missing'){options.assetRoot=await mkdtemp(join(tmpdir(),'signals-missing-'));temp=options.assetRoot;}
 if(kind==='hash'||kind==='mime'){
  temp=await mkdtemp(join(tmpdir(),'signals-byte-mismatch-'));options.assetRoot=temp;await mkdir(join(temp,'assets/signals'),{recursive:true});
  if(kind==='mime'){r.presentation.cover.mime_type='image/jpeg';r.presentation.cover.url=r.presentation.cover.url.replace('.png','.jpg');}
  await writeFile(join(temp,new URL(r.presentation.cover.url).pathname),kind==='hash'?Buffer.concat([f.bytes,Buffer.from('changed')]):f.bytes);
 }
 if(kind==='dimensions')r.presentation.cover.width++;
 if(kind==='rights')options.rightsDecisions=[];
 if(kind==='rights-date')options.rightsDecisions[0].approved_at='2027-01-01T00:00:00.000Z';
 if(kind==='alt')r.presentation.cover.alt=' ';
 if(kind==='private-field')r.research={ticket:'PRIVATE_RESEARCH_TICKET'};
 if(kind==='unapproved-reference')r.content.blocks[0].source_ids.push('private-evidence');
 if(kind==='unknown-version')r.schema_version='nyra.publication.v9';
 if(kind==='corrupt-image'||kind==='symlink'){
  temp=await mkdtemp(join(tmpdir(),'signals-bad-'));options.assetRoot=temp;await mkdir(join(temp,'assets/signals'),{recursive:true});
  if(kind==='corrupt-image'){const bytes=Buffer.from('not a decoded PNG image');const {createHash}=await import('node:crypto');r.presentation.cover.sha256=createHash('sha256').update(bytes).digest('hex');r.presentation.cover.url='https://eliaskalyvas.gr/assets/signals/'+r.presentation.cover.sha256+'.png';await writeFile(join(temp,new URL(r.presentation.cover.url).pathname),bytes);}
  else await symlink(join(f.root,f.assetPath),join(temp,f.assetPath));
 }
 sealFixture(r);options.dataset=dataset([r]);if(!['rights','rights-date'].includes(kind))options.rightsDecisions=[f.rights(r.presentation.cover)];
 try{await assert.rejects(prepareSyntheticPublication(options),kind==='hash'?/ASSET_HASH_MISMATCH/:kind==='mime'?/ASSET_TYPE_MISMATCH/:undefined);}finally{if(temp)await rm(temp,{recursive:true,force:true});}
});
test('Phase3 hydrated article preserves original H1 node and exact article DOM with no recoverable errors',async()=>{
 const markup=await html(grOut,page(f.gr)),browser=new JSDOM(markup,{url:'https://eliaskalyvas.gr/gr/signals/'+f.gr.slug+'/'}),saved={};
 for(const k of ['window','document','navigator','HTMLElement']){saved[k]=Object.getOwnPropertyDescriptor(globalThis,k);Object.defineProperty(globalThis,k,{configurable:true,value:browser.window[k]});}
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;let hydrated;
 try{
  const root=document.getElementById('root'),heading=root.querySelector('h1'),article=root.querySelector('.signals-article'),before=article.outerHTML,errors=[];
  await act(async()=>{hydrated=hydrateRoot(root,React.createElement(App,{lang:'el',slug:f.gr.slug,base:'/',publicArticles:JSON.parse(document.querySelector('#signals-public-data').textContent)}),{onRecoverableError:e=>errors.push(e)});});
  assert.deepEqual(errors,[]);assert.equal(root.querySelector('h1'),heading);assert.equal(article.outerHTML,before);assert.equal(root.querySelectorAll('h1').length,1);
 }finally{await act(async()=>hydrated?.unmount());browser.window.close();for(const k of Object.keys(saved)){if(saved[k])Object.defineProperty(globalThis,k,saved[k]);else delete globalThis[k];}delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});

test('Phase3 withdrawn counterparts have no route, alternate, listing card or sitemap entry',async()=>{
 await assert.rejects(html(withdrawnOut,page(f.en)),/ENOENT/);const d=dom(await html(withdrawnOut,page(f.gr))).window.document;
 assert(!d.querySelector('link[hreflang=en]'));assert(!(await html(withdrawnOut,'sitemap.xml')).includes(f.en.canonical_url));
 const en=dom(await html(withdrawnOut,'en/signals/index.html')).window.document;assert(en.querySelector('.signals-waiting'));assert.equal(en.querySelector('meta[name=robots]').content,'noindex,follow');
});
test('Phase3 related navigation uses only explicitly approved active same-language identities',async()=>{
 const d=dom(await html(pairOut,page(f.gr))).window.document;assert.equal(d.querySelector('.signals-related h3 a').getAttribute('href'),'/gr/signals/phase3-related/');
 const bad=f.pair();bad[0].presentation.related_article_ids=[bad[1].article_id];sealFixture(bad[0]);await assert.rejects(prepareSyntheticPublication(f.options(bad)));
});
test('Phase3 rejects duplicate canonicals and never treats reserved demo routes as approved articles',async()=>{
 const r=structuredClone(f.gr);r.slug='who-decides-when-ai-suggests';r.canonical_url='https://eliaskalyvas.gr/gr/signals/'+r.slug+'/';sealFixture(r);await assert.rejects(prepareSyntheticPublication(f.options([r])),/RESERVED_DEMO_ROUTE/);
 await assert.rejects(prepareSyntheticPublication(f.options([f.gr,f.gr])));
});
test('Phase3 decodes approved JPEG and WebP bytes and rejects embedded private metadata',async()=>{
 const {default:sharp}=await import('sharp'),{createHash}=await import('node:crypto');
 for(const format of ['jpeg','webp','exif']){
  const r=structuredClone(f.gr),temp=await mkdtemp(join(tmpdir(),'signals-formats-'));
  try{
   let img=sharp(f.bytes);if(format==='exif')img=img.withExif({IFD0:{Copyright:'Synthetic metadata'}});
   const bytes=await img[format==='exif'?'jpeg':format]().toBuffer(),sha=createHash('sha256').update(bytes).digest('hex');
   const type=format==='webp'?'webp':'jpeg',ext=type==='jpeg'?'jpg':'webp';Object.assign(r.presentation.cover,{sha256:sha,mime_type:'image/'+type,url:'https://eliaskalyvas.gr/assets/signals/'+sha+'.'+ext});sealFixture(r);
   await mkdir(join(temp,'assets/signals'),{recursive:true});await writeFile(join(temp,new URL(r.presentation.cover.url).pathname),bytes);
   const options={...f.options([r]),assetRoot:temp};if(format==='exif')await assert.rejects(prepareSyntheticPublication(options),/ASSET_PRIVATE_METADATA/);else await prepareSyntheticPublication(options);
  }finally{await rm(temp,{recursive:true,force:true});}
 }
});
