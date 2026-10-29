// Independent server-side observation. No runner success JSON is accepted.
import {parse,parseFragment} from 'parse5';
import {canonicalize,hashJSON,validatePublicationSet,validateDeploymentTiming,isUTC} from '../contract.mjs';
import {requireDelivery as need} from '../runtime/materialize.mjs';
import {sha256} from './archive.mjs';
import {publicationMetadata,publicationSitemap} from '../../signals/seo.mjs';
import {publicViews} from '../../../src/signals/public-view.mjs';
import {signalsEntryPaths} from '../../../src/signals/entries.mjs';
export const WITNESS_PATH='.well-known/nyra-release.json';
const pathScopes=new WeakMap();
const safePath=p=>typeof p==='string'&&p.length>0&&!p.startsWith('/')&&!p.split('/').some(s=>!s||s==='.'||s==='..')&&!/[\\\x00-\x1f?#]/.test(p);
// The loader is a private, server-controlled dependency reading an independently
// approved NORMAL build inventory, never the submitted publication artifact or
// runner/browser JSON. Configuration pinning is supplied by the trusted host.
export function createPublicPathScopeAuthority({configurationSHA256,loadApprovedInventory}){
 need(/^[a-f0-9]{64}$/.test(configurationSHA256)&&typeof loadApprovedInventory==='function','PUBLIC_INVENTORY_CONFIG');
 return Object.freeze({async forAttempt(attempt){
  need(/^[a-f0-9]{40}$/.test(attempt?.codeSHA),'PUBLIC_INVENTORY_CODE');
  const v=structuredClone(await loadApprovedInventory(attempt.codeSHA));
  need(v&&Object.keys(v).sort().join(',')==='codeSHA,configurationSHA256,paths,schema_version'&&v.schema_version==='nyra.public.paths.v1'&&v.codeSHA===attempt.codeSHA&&v.configurationSHA256===configurationSHA256&&Array.isArray(v.paths)&&v.paths.length>0&&v.paths.every(safePath)&&new Set(v.paths).size===v.paths.length,'PUBLIC_INVENTORY_BINDING');
  // A no-publication baseline must never authorize a previous real article or
  // a publication witness as a static file, even if an inventory is misprepared.
  need(v.paths.every(p=>p!==WITNESS_PATH&&(!/^(gr|en)\/signals\//.test(p)||signalsEntryPaths.includes(p))),'PUBLIC_INVENTORY_PUBLICATION_PATH');
  const proof=Object.freeze({codeSHA:v.codeSHA,configurationSHA256});pathScopes.set(proof,new Set(v.paths));return proof;
 }});
}
function validatePublicPathScope(files,{attempt,candidate,pathScope}){
 need(pathScopes.has(pathScope)&&pathScope.codeSHA===attempt.codeSHA,'PUBLIC_PATH_INVENTORY_REQUIRED');
 const permitted=new Set(pathScopes.get(pathScope));permitted.add(WITNESS_PATH);
 for(const r of candidate.dataset.releases){permitted.add(new URL(r.canonical_url).pathname.slice(1)+'index.html');permitted.add(new URL(r.presentation.cover.url).pathname.slice(1));}
 for(const path of files.keys())need(permitted.has(path),'UNAPPROVED_PUBLIC_PATH');
 need(files.size===permitted.size&&[...permitted].every(p=>files.has(p)),'INCOMPLETE_PUBLIC_INVENTORY');
}
const attrs=n=>Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value]));
const nodes=n=>[n,...(n.childNodes||[]).flatMap(nodes)];
const tags=(n,tag)=>nodes(n).filter(x=>x.tagName===tag);
const cls=(n,c)=>nodes(n).filter(x=>(attrs(x).class||'').split(' ').includes(c));
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
const same=(a,b,code)=>need(canonicalize(a)===canonicalize(b),code);
const one=(list,code)=>{need(list.length===1,code);return list[0];};
const documentFor=bytes=>parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
export const publicWitness=(attempt,candidate)=>({schema_version:'nyra.delivery.witness.v1',candidate_id:candidate.id,attempt_id:attempt.id,fence:attempt.fence,code_sha:attempt.codeSHA,github_run_id:attempt.runId,github_run_attempt:attempt.runAttempt,manifest_id:candidate.dataset.manifest.manifest_id,generation:candidate.dataset.manifest.generation,manifest_sha256:hashJSON(candidate.dataset.manifest)});
function metadata(doc,locale,release,dataset){
 const expected=parseFragment(publicationMetadata({locale,release,dataset}));
 for(const tag of ['title','meta','link','script'])for(const e of tags(expected,tag)){
  const a=attrs(e),match=tags(doc,tag).filter(n=>{const b=attrs(n);return tag==='title'||tag==='meta'?(a.name?b.name===a.name:a.property?b.property===a.property:tag==='title'):tag==='script'?b.type===a.type:b.rel===a.rel&&(a.hreflang?b.hreflang===a.hreflang:!b.hreflang);});
  const actual=one(match,'LIVE_METADATA_COUNT');same(attrs(actual),a,'LIVE_METADATA');same(text(actual),text(e),'LIVE_METADATA_TEXT');
 }
 const expectedLinks=tags(expected,'link').map(attrs),actualLinks=tags(doc,'link').map(attrs).filter(a=>a.rel==='canonical'||a.hreflang);
 same(actualLinks,expectedLinks,'LIVE_LANGUAGE_LINKS');
 need(tags(doc,'script').filter(n=>attrs(n).type==='application/ld+json').length===tags(expected,'script').length,'LIVE_SCHEMA_COUNT');
}
function citations(node,ids,sources){
 const links=cls(node,'signals-citation');same(links.map(n=>({href:attrs(n).href,label:attrs(n)['aria-label'],text:text(n)})),ids.map(id=>({href:'#source-'+id,label:id+': '+sources.find(s=>s.id===id).title,text:' ['+id+']'})),'LIVE_CITATIONS');
}
export function validateArticleHTML(bytes,release,dataset){
 const doc=documentFor(bytes);need(attrs(one(tags(doc,'html'),'LIVE_DOCUMENT')).lang===release.locale,'LIVE_LANGUAGE');
 same(text(one(tags(doc,'h1'),'LIVE_TITLE')),release.content.title,'LIVE_TITLE');
 same(text(one(cls(doc,'signals-deck'),'LIVE_SUMMARY')),release.content.summary,'LIVE_SUMMARY');
 same(text(one(cls(doc,'signals-disclosure'),'LIVE_DISCLOSURE')),release.identity.disclosure,'LIVE_DISCLOSURE');
 const prose=one(cls(doc,'signals-prose'),'LIVE_BODY'),blocks=(prose.childNodes||[]).filter(n=>n.tagName);need(blocks.length===release.content.blocks.length,'LIVE_BLOCK_COUNT');
 const baseText=n=>(n.childNodes||[]).filter(c=>c.tagName!=='a'&&c.tagName!=='cite').map(text).join('');
 release.content.blocks.forEach((b,i)=>{const n=blocks[i];
  if(b.type==='list'){need(n.tagName===(b.ordered?'ol':'ul'),'LIVE_LIST_TYPE');const items=(n.childNodes||[]).filter(x=>x.tagName);need(items.length===b.items.length,'LIVE_LIST_COUNT');b.items.forEach((item,j)=>{need(items[j].tagName==='li','LIVE_LIST_ITEM');same(baseText(items[j]),item.text,'LIVE_TEXT');citations(items[j],item.source_ids,release.content.sources);});}
  else {need(n.tagName===(b.type==='paragraph'?'p':b.type==='quote'?'blockquote':'h'+b.level),'LIVE_BLOCK_TYPE');same(baseText(n),b.text,'LIVE_TEXT');citations(n,b.source_ids||[],release.content.sources);if(b.type==='quote')same(tags(n,'cite').map(text),b.attribution?[b.attribution]:[],'LIVE_QUOTE_ATTRIBUTION');}
 });
 const refs=cls(doc,'signals-sources');same(refs.flatMap(n=>tags(n,'li')).map(n=>({id:attrs(n).id,links:tags(n,'a').map(a=>({href:attrs(a).href,text:text(a),target:attrs(a).target,rel:attrs(a).rel}))})),release.content.sources.map(s=>({id:'source-'+s.id,links:[{href:s.url,text:s.id+': '+s.title+' ↗',target:'_blank',rel:'noopener noreferrer'}]})),'LIVE_PUBLIC_SOURCES');
 const cover=one(cls(doc,'signals-media-hero'),'LIVE_COVER'),image=attrs(one(tags(cover,'img'),'LIVE_COVER'));
 for(const [key,value]of Object.entries({src:release.presentation.cover.url,alt:release.presentation.cover.alt,width:String(release.presentation.cover.width),height:String(release.presentation.cover.height)}))need(image[key]===value,'LIVE_COVER');
 const credit=one(cls(doc,'signals-image-credit'),'LIVE_CREDIT');need(text(credit).includes(release.presentation.cover.caption)&&text(credit).includes(release.presentation.cover.attribution.license_name),'LIVE_CREDIT');
 same(tags(doc,'time').map(n=>attrs(n).datetime),[release.release.first_published_at],'LIVE_DATES');
 same(JSON.parse(text(one(tags(doc,'script').filter(n=>attrs(n).id==='signals-public-data'),'LIVE_EMBEDDED'))),publicViews(dataset).filter(r=>r.lang===release.locale),'LIVE_EMBEDDED');
 metadata(doc,release.locale,release,dataset);return true;
}
export function validatePublicFiles(files,{attempt,candidate,baseSitemap,now,pathScope}){
 validatePublicationSet(candidate.dataset,{now});same(JSON.parse(new TextDecoder().decode(files.get(WITNESS_PATH))),publicWitness(attempt,candidate),'WITNESS_BINDING');
 const expectedXML=publicationSitemap(baseSitemap,candidate.dataset);need(new TextDecoder().decode(files.get('sitemap.xml'))===expectedXML,'LIVE_SITEMAP');
 for(const [path,bytes]of files){need(!/^(?:test|supabase|contracts|runtime|lib)\/|(?:^|\/)\.env|\.map$/.test(path),'PRIVATE_ARTIFACT_PATH');if(/\.(html|js|json|xml|txt)$/.test(path))need(!/PRIVATE_EXCERPT_CANARY|synthetic-token-001|(?:sb_secret_|sk-proj-)[A-Za-z0-9_-]+|"(?:service_role_key|research_ticket|internal_prompt|private_evidence)"\s*:/.test(new TextDecoder().decode(bytes)),'PRIVATE_ARTIFACT_CONTENT');}
 validatePublicPathScope(files,{attempt,candidate,pathScope});
 for(const r of candidate.dataset.releases){const path=new URL(r.canonical_url).pathname.slice(1)+'index.html';need(files.has(path),'MISSING_PUBLIC_ROUTE');validateArticleHTML(files.get(path),r,candidate.dataset);const c=r.presentation.cover;need(sha256(files.get(new URL(c.url).pathname.slice(1))||[])===c.sha256,'LIVE_IMAGE_HASH');}
 for(const locale of ['el','en']){const path=(locale==='el'?'gr':'en')+'/signals/index.html';need(files.has(path),'MISSING_PUBLIC_LISTING');const doc=documentFor(files.get(path));metadata(doc,locale,null,candidate.dataset);const cards=[...cls(doc,'signals-featured'),...cls(doc,'signals-card')];same(cards.map(c=>attrs(c)['data-signal']).sort(),candidate.dataset.releases.filter(r=>r.locale===locale).map(r=>r.slug).sort(),'LIVE_LISTING');}
 return true;
}
export function independentObserver({github,publicReader,provenance,baseSitemap,pathScopeAuthority,clock=()=>new Date().toISOString()}){
 return async(attempt,candidate)=>{
  const common={runId:attempt.runId,runAttempt:attempt.runAttempt,codeSHA:attempt.codeSHA,candidateId:candidate.id};
  try{
   const deployment=await github.deploymentFor(attempt);if(!deployment){
    // Terminal job + authoritative absence of a consumed start means this
    // broker never issued a Pages POST. Expiry or failure alone is insufficient.
    if(attempt.started===false&&typeof github.runTerminal==='function'&&await github.runTerminal(attempt)){
     const prior=candidate.transition.previous,witness=await publicReader.read(WITNESS_PATH,attempt);
     let unchanged=witness.status===200&&JSON.parse(new TextDecoder().decode(witness.bytes)).manifest_sha256===hashJSON(prior.manifest);
     if(prior.releases.length===0&&witness.status===404){unchanged=true;for(const locale of ['el','en']){const listing=await publicReader.read((locale==='el'?'gr':'en')+'/signals/',attempt);need(listing.status===200,'BASELINE_UNVERIFIED');metadata(documentFor(listing.bytes),locale,null,prior);}}
     need(unchanged,'BASELINE_UNVERIFIED');for(const r of prior.releases){const response=await publicReader.read(new URL(r.canonical_url).pathname.slice(1),attempt);need(response.status===200,'BASELINE_UNVERIFIED');validateArticleHTML(response.bytes,r,prior);}
     const retained=new Set(prior.releases.map(r=>r.canonical_url));for(const r of candidate.dataset.releases)if(!retained.has(r.canonical_url))need((await publicReader.read(new URL(r.canonical_url).pathname.slice(1),attempt)).status===404,'BASELINE_CHANGED');
     return {...common,kind:'never_deployed',runTerminal:true,noDeploymentCreated:true,noDeploymentInProgress:true,publicManifestUnchanged:true};
    }
    return {...common,kind:'unknown'};
   }
   need(deployment.runId===attempt.runId&&deployment.runAttempt===attempt.runAttempt&&deployment.codeSHA===attempt.codeSHA&&deployment.artifactId===candidate.provenance.artifactId,'DEPLOYMENT_CORRELATION');
   if(deployment.status!=='succeed')return {...common,kind:'unknown'};
   need([deployment.requestedAt,deployment.completedAt].every(isUTC)&&deployment.requestedAt<=deployment.completedAt&&deployment.completedAt<=clock(),'DEPLOYMENT_TIME');
   provenance.assert(candidate.provenance);const expected=provenance.files(candidate.provenance),observed=new Map();
   // Verify every sealed public file, including HTML, client chunks and image bytes.
   for(const [path,bytes]of expected){const r=await publicReader.read(path,attempt);need(r.status===200&&sha256(r.bytes)===sha256(bytes),'LIVE_BYTE_MISMATCH');observed.set(path,r.bytes);}
   const pathScope=await pathScopeAuthority.forAttempt(attempt);
   validatePublicFiles(observed,{attempt,candidate,baseSitemap,pathScope,now:clock()});
   const active=new Set(candidate.dataset.releases.map(r=>r.canonical_url));
   for(const old of candidate.transition.previous.releases)if(!active.has(old.canonical_url)){const p=new URL(old.canonical_url).pathname.slice(1);const r=await publicReader.read(p,attempt);need(r.status===404,'WITHDRAWN_ROUTE_STILL_PUBLIC');}
   for(const lang of ['gr','en']){const r=await publicReader.read(`${lang}/signals/nyra-absent-${attempt.id}/`,attempt);need(r.status===404,'MISSING_ROUTE_NOT_404');}
   const now=clock(),known=new Set(candidate.transition.previous.releases.map(r=>r.release.id));let kind='verified_live';
   try{const fresh=candidate.dataset.releases.filter(r=>!known.has(r.release.id));validateDeploymentTiming(fresh,{now:deployment.requestedAt,phase:'start'});validateDeploymentTiming(fresh,{now,phase:'verify'});}catch{kind='observed_late_live';}
   return {...common,kind,deploymentSucceeded:true,deploymentId:deployment.id,deploymentRequestedAt:deployment.requestedAt,deploymentCompletedAt:deployment.completedAt,observedAt:now,observedManifestSHA256:hashJSON(candidate.dataset.manifest),allCanonicalRoutesChecked:true};
  }catch{return {...common,kind:'unknown'};}
 };
}
export function publicHTTPReader({origin='https://eliaskalyvas.gr',fetcher=fetch,maxBytes=128*1024*1024}={}){
 need(origin==='https://eliaskalyvas.gr','PUBLIC_ORIGIN');return Object.freeze({async read(path,attempt){need(typeof path==='string'&&!path.startsWith('/')&&!path.includes('..')&&!/[\\?#]/.test(path),'PUBLIC_PATH');const url=new URL('/'+path,origin);url.searchParams.set('nyra-observation',attempt.id);
  const r=await fetcher(url,{redirect:'error',cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});const data=new Uint8Array(await r.arrayBuffer());need(data.length<=maxBytes,'PUBLIC_RESPONSE_SIZE');return {status:r.status,bytes:data};
 }});
}
