import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {deflateRawSync} from 'node:zlib';
import {staticFixture} from './fixtures/signals-publication.mjs';
import {NOW,uid,eventFixture,nextSet} from './fixtures/publication-v1.1.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
import {artifactSealer} from '../lib/publication/runtime/artifact.mjs';
import {createPagesTar,readPagesTar,readGitHubArtifactZip,sha256,artifactProvenanceVerifier} from '../lib/publication/integration/archive.mjs';
import {createExportReceiver} from '../lib/publication/integration/transport.mjs';
import {buildAuthenticatedArtifact,createNormalBuildInventory} from '../lib/publication/integration/build.mjs';
import {validatePublicFiles,validateArticleHTML,independentObserver,publicHTTPReader,WITNESS_PATH,createPublicPathScopeAuthority,publicWitness} from '../lib/publication/integration/observer.mjs';
import {createPrivateDeliveryHandler} from '../lib/publication/integration/service.mjs';
import {githubHTTP,githubDeliveryReader} from '../lib/publication/integration/github.mjs';
import {publicationSitemap} from '../lib/signals/seo.mjs';
const identity={codeSHA:'a'.repeat(40),runId:'100',runAttempt:'1'},capability={candidate_id:uid(9001),attempt_id:uid(9002),fence:1};
let f,bundle,receiver,proof,built,baseSitemap,candidate,attempt,normalInventory,pathScopeAuthority,pathScope;
const endpoint='https://private.example/functions/v1/nyra-delivery/delivery';
function client(value=bundle,options={}){return createExportReceiver({endpoint,audience:'urn:nyra:test',identity,clock:()=>NOW,tokenSource:async()=> 'signed.synthetic.oidc',fetcher:async()=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}),...options});}
before(async()=>{
 f=await staticFixture();const dataset=f.options(f.pair()).dataset;
 bundle={version:'nyra.delivery.export.v1',dataset,capability,identity,rightsDecisions:dataset.releases.map(r=>f.rights(r.presentation.cover)),assets:[{path:f.assetPath,base64:Buffer.from(f.bytes).toString('base64')}]};
 normalInventory=await createNormalBuildInventory({codeSHA:identity.codeSHA});pathScopeAuthority=createPublicPathScopeAuthority({configurationSHA256:normalInventory.configurationSHA256,loadApprovedInventory:async()=>normalInventory});pathScope=await pathScopeAuthority.forAttempt(identity);
 receiver=client();proof=await receiver.acquire();built=await buildAuthenticatedArtifact({receiver,proof,clock:()=>NOW});
 baseSitemap=await readFile(new URL('../public/sitemap.xml',import.meta.url),'utf8');attempt={id:capability.attempt_id,fence:1,...identity,checkRunId:'300'};
 candidate={id:capability.candidate_id,dataset,manifestSHA256:hashJSON(dataset.manifest),transition:{previous:dataset,steps:[]}};
});after(async()=>f?.close());
const cloneFiles=()=>new Map([...built.files].map(([p,b])=>[p,new Uint8Array(b)]));
function mutate(path,fn){const files=cloneFiles();files.set(path,new TextEncoder().encode(fn(new TextDecoder().decode(files.get(path)))));return files;}
const validate=files=>validatePublicFiles(files,{attempt,candidate,baseSitemap,pathScope,now:NOW});
const articlePath=()=>new URL(bundle.dataset.releases[0].canonical_url).pathname.slice(1)+'index.html';
test('authenticated acquisition + actual Sharp + static HTML + deterministic tar form one isolated pipeline',()=>{assert(validate(built.files));assert.deepEqual(readPagesTar(built.tar),built.files);assert.deepEqual(createPagesTar(built.files),built.tar);});
test('schema-valid caller JSON and copied capability do not mint a trusted build proof',async()=>{await assert.rejects(buildAuthenticatedArtifact({receiver,proof:{...proof},clock:()=>NOW}),/UNAUTHENTICATED_EXPORT/);});
for(const [name,change,code]of [
 ['wrong code',v=>v.identity.codeSHA='b'.repeat(40),'EXPORT_IDENTITY'],
 ['unknown export version',v=>v.version='nyra.delivery.export.v2','EXPORT_IDENTITY'],
 ['private export field',v=>v.research_ticket='private','EXPORT_FIELDS'],
 ['missing image',v=>v.assets=[],'EXPORT_ASSET_SCOPE'],
 ['extra image',v=>v.assets.push({path:'outside.png',base64:'eA=='}),'EXPORT_ASSET_SCOPE'],
 ['forged fence',v=>v.capability.fence=0,'EXPORT_CAPABILITY']
])test('export rejects '+name,async()=>{const v=structuredClone(bundle);change(v);await assert.rejects(client(v).acquire(),new RegExp(code));});
test('OIDC transport sends token only to fixed HTTPS endpoint and forbids redirects',async()=>{let request;const r=client(bundle,{fetcher:async(url,options)=>{request={url,options};return new Response(JSON.stringify(bundle));}});await r.acquire();assert.equal(request.url,endpoint+'/export');assert.equal(request.options.redirect,'error');assert.equal(request.options.body,'{}');assert.equal(request.options.headers.Authorization,'Bearer signed.synthetic.oidc');assert.throws(()=>client(bundle,{endpoint:'http://private.example/delivery'}),/EXPORT_ENDPOINT/);});
for(const [name,fn,code]of [
 ['approved text',s=>s.replace('Exact synthetic paragraph.','Changed approved paragraph.'),'LIVE_TEXT'],
 ['second citation',s=>s.replace('href="#source-s2"','href="#source-s1"'),'LIVE_CITATIONS'],
 ['public source URL',s=>s.replace('href="https://www.unesco.org/"','href="https://example.com/"'),'LIVE_PUBLIC_SOURCES'],
 ['SEO title',s=>s.replace('Synthetic SEO title','Wrong SEO title'),'LIVE_METADATA'],
 ['alternate language',s=>s.replace('hreflang="en"','hreflang="fr"'),'LIVE_METADATA_COUNT'],
 ['AI disclosure',s=>s.replace('class="signals-disclosure"','class="missing-disclosure"'),'LIVE_DISCLOSURE'],
 ['summary',s=>s.replace('class="signals-deck"','class="missing-summary"'),'LIVE_SUMMARY'],
 ['JSON-LD duplicate',s=>s.replace('</head>','<script type="application/ld+json">{}</script></head>'),'LIVE_METADATA_COUNT']
])test('public artifact rejects changed '+name,()=>{assert.throws(()=>validate(mutate(articlePath(),fn)),new RegExp(code));});
test('immutable witness binds exact attempt, code, candidate and active generation',()=>{const files=cloneFiles(),v=JSON.parse(new TextDecoder().decode(files.get(WITNESS_PATH)));v.attempt_id=uid(9999);files.set(WITNESS_PATH,new TextEncoder().encode(JSON.stringify(v)));assert.throws(()=>validate(files),/WITNESS_BINDING/);});
test('modified image bytes fail even with a rights flag',()=>{const files=cloneFiles();files.set(f.assetPath,new Uint8Array([1,2,3]));assert.throws(()=>validate(files),/LIVE_IMAGE_HASH/);});
test('private paths and accidental secret-shaped content fail public sealing',()=>{for(const [path,bytes]of [['test/private.json','{}'],['assets/leak.json','{"research_ticket":"private"}']]){const files=cloneFiles();files.set(path,new TextEncoder().encode(bytes));assert.throws(()=>validate(files),/PRIVATE_ARTIFACT/);}});
test('archive traversal, checksum damage, non-regular types and duplicate paths fail closed',()=>{assert.throws(()=>createPagesTar(new Map([['../private',new Uint8Array([1])]])),/TAR_PATH/);const bad=Buffer.from(built.tar);bad[0]^=1;assert.throws(()=>readPagesTar(bad),/TAR_CHECKSUM/);const one=createPagesTar(new Map([['a',new Uint8Array([1])]]));assert.throws(()=>readPagesTar(Buffer.concat([one.subarray(0,-1024),one])),/TAR_ENTRY/);});
function zip(tar){const crc=b=>{let c=0xffffffff;for(const n of b){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};const packed=deflateRawSync(tar),name=Buffer.from('artifact.tar'),h=Buffer.alloc(30),c=Buffer.alloc(46),e=Buffer.alloc(22);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt32LE(crc(tar),14);h.writeUInt32LE(packed.length,18);h.writeUInt32LE(tar.length,22);h.writeUInt16LE(name.length,26);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(crc(tar),16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(tar.length,24);c.writeUInt16LE(name.length,28);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(1,8);e.writeUInt16LE(1,10);e.writeUInt32LE(c.length+name.length,12);e.writeUInt32LE(h.length+name.length+packed.length,16);return Buffer.concat([h,name,packed,c,name,e]);}
async function provenance(archive=zip(built.tar),patch={}){const github={artifactFor:async()=>({artifact:{id:700,name:'github-pages',expired:false,digest:'sha256:'+sha256(archive),workflow_run:{id:100,head_sha:identity.codeSHA},...patch},archive})};const verifier=artifactProvenanceVerifier({github,validateFiles:async(files,ctx)=>validatePublicFiles(files,{...ctx,baseSitemap,pathScope:await pathScopeAuthority.forAttempt(ctx.attempt),now:NOW})});return {verifier,proof:await verifier.verify(attempt,candidate)};}
test('GitHub ZIP digest, actual tar digest and inventory seal remain separate and bound',async()=>{const {verifier,proof:p}=await provenance();assert.notEqual(p.zipSHA256,p.tarSHA256);assert.equal(p.artifactSHA256,built.seal.artifactSHA256);verifier.assert(p);assert.throws(()=>verifier.assert({...p}),/UNVERIFIED_ARTIFACT/);});
test('wrong GitHub archive digest and foreign run are rejected',async()=>{await assert.rejects(provenance(undefined,{digest:'sha256:'+'0'.repeat(64)}),/ARTIFACT_ZIP_DIGEST/);await assert.rejects(provenance(undefined,{workflow_run:{id:101,head_sha:identity.codeSHA}}),/ARTIFACT_RUN/);});
test('ZIP corruption and extra archive entries fail closed',()=>{const z=zip(built.tar);z[60]^=1;assert.throws(()=>readGitHubArtifactZip(z));const extra=zip(built.tar);extra.writeUInt16LE(2,extra.length-12);assert.throws(()=>readGitHubArtifactZip(extra),/ZIP_ENTRIES/);});
async function observation({change,dep={},previous=candidate.dataset,clock=NOW}={}){const {verifier,proof:p}=await provenance(),c={...candidate,transition:{previous,steps:[]},provenance:p};const files=cloneFiles();if(change)change(files);const github={deploymentFor:async()=>({runId:'100',runAttempt:'1',codeSHA:identity.codeSHA,artifactId:'700',id:'800',requestedAt:'2026-10-27T11:59:00.000Z',completedAt:NOW,status:'succeed',...dep})};const publicReader={read:async path=>{const b=files.get(path.endsWith('/')?path+'index.html':path);return {status:b?200:404,bytes:b||new Uint8Array()};}};return independentObserver({github,publicReader,provenance:verifier,baseSitemap,pathScopeAuthority,clock:()=>clock})(attempt,c);}
test('independent live observer verifies every actual file and does not infer from workflow success',async()=>{assert.equal((await observation()).kind,'verified_live');assert.equal((await observation({change:files=>files.set(articlePath(),new TextEncoder().encode('wrong HTML'))})).kind,'unknown');});
test('old CDN witness, wrong deployment and incomplete delivery remain unknown',async()=>{assert.equal((await observation({change:files=>files.delete(WITNESS_PATH)})).kind,'unknown');assert.equal((await observation({dep:{runAttempt:'2'}})).kind,'unknown');assert.equal((await observation({dep:{status:'failed'}})).kind,'unknown');});
test('new releases outside 15/30-minute windows are explicitly observed late, retained rebuilds remain valid',async()=>{const empty={manifest:candidate.dataset.manifest,releases:[]};assert.equal((await observation({previous:empty})).kind,'observed_late_live');assert.equal((await observation({clock:'2026-10-29T12:00:00.000Z'})).kind,'verified_live');});
test('withdrawn routes must actually disappear',async()=>{const old=structuredClone(candidate.dataset.releases[0]);old.canonical_url='https://eliaskalyvas.gr/gr/signals/removed-release/';const previous={...candidate.dataset,releases:[old]};const {verifier,proof:p}=await provenance();const c={...candidate,transition:{previous,steps:[]},provenance:p};const observe=independentObserver({github:{deploymentFor:async()=>({runId:'100',runAttempt:'1',codeSHA:identity.codeSHA,artifactId:'700',id:'800',requestedAt:NOW,completedAt:NOW,status:'succeed'})},publicReader:{read:async path=>({status:200,bytes:built.files.get(path)||built.files.get(path+'index.html')||new Uint8Array()})},provenance:verifier,baseSitemap,pathScopeAuthority,clock:()=>NOW});assert.equal((await observe(attempt,c)).kind,'unknown');});
test('public observation has fixed origin, no redirects and cache bypass',async()=>{let request;const reader=publicHTTPReader({fetcher:async(url,options)=>{request={url:String(url),options};return new Response('ok');}});await reader.read('gr/signals/',attempt);assert(request.url.startsWith('https://eliaskalyvas.gr/gr/signals/?'));assert.equal(request.options.redirect,'error');assert.equal(request.options.cache,'no-store');await assert.rejects(reader.read('../private',attempt),/PUBLIC_PATH/);});
test('runtime handler is disabled by default and refuses browser origin and release selectors',async()=>{let calls=0;const service={export:async()=>{calls++;return {};}};const request=(options={})=>new Request(endpoint+'/export',{method:'POST',headers:{Authorization:'Bearer signed.synthetic.oidc'},body:'{}',...options});assert.equal((await createPrivateDeliveryHandler({service})(request())).status,503);const h=createPrivateDeliveryHandler({service,enabled:true});assert.equal((await h(request({headers:{Authorization:'Bearer signed.synthetic.oidc',Origin:'https://eliaskalyvas.gr'}}))).status,409);assert.equal((await h(request({body:'{"release":"forged"}'}))).status,409);assert.equal(calls,0);assert.equal((await h(request())).status,200);});
test('GitHub artifact reader refuses multiple artifacts, never selects newest by assumption',async()=>{const reader=githubDeliveryReader({repository:'test/repo',getJSON:async url=>url.includes('/artifacts?')?{total_count:2,artifacts:[{name:'github-pages'},{name:'github-pages'}]}:{run_attempt:1,head_sha:identity.codeSHA,repository:{full_name:'test/repo'}},downloadArtifact:async()=>{},deploymentJournal:{read:async()=>null}});await assert.rejects(reader.artifactFor(attempt),/ARTIFACT_AMBIGUOUS/);assert.equal(await reader.deploymentFor(attempt),null);});
test('download redirects never forward Authorization to blob storage',async()=>{const requests=[];const http=githubHTTP({tokenSource:async()=>'private-token',fetcher:async(url,options)=>{requests.push({url:String(url),options});return requests.length===1?new Response(null,{status:302,headers:{location:'https://test.blob.core.windows.net/artifact'}}):new Response('zip');}});await http.downloadArtifact('https://api.github.com/repos/test/repo/actions/artifacts/700/zip');assert.equal(requests[0].options.headers.Authorization,'Bearer private-token');assert.equal(requests[1].options.headers,undefined);});
test('terminal never-started rebuild requires independent unchanged public baseline before retry',async()=>{const c={...candidate,transition:{previous:candidate.dataset,steps:[]}},reader={read:async path=>({status:200,bytes:built.files.get(path)||built.files.get(path+'index.html')})},observe=independentObserver({github:{deploymentFor:async()=>null,runTerminal:async()=>true},publicReader:reader,provenance:{},baseSitemap,pathScopeAuthority,clock:()=>NOW});assert.equal((await observe({...attempt,started:false},c)).kind,'never_deployed');assert.equal((await observe({...attempt,started:true},c)).kind,'unknown');});
test('trusted GR-only and independently approved EN-only builds never infer a translation',async()=>{for(const r of [f.gr,f.en]){const dataset=f.options([r]).dataset,value={...bundle,dataset,rightsDecisions:[f.rights(r.presentation.cover)]},c=client(value),p=await c.acquire(),result=await buildAuthenticatedArtifact({receiver:c,proof:p,clock:()=>NOW});const own=r.locale==='el'?'gr':'en',other=own==='gr'?'en':'gr';assert(result.files.has(`${own}/signals/${r.slug}/index.html`));assert(!result.files.has(`${other}/signals/${r.slug}/index.html`));const otherHTML=new TextDecoder().decode(result.files.get(`${other}/signals/index.html`));assert(otherHTML.includes('noindex,follow'));assert(!otherHTML.includes(r.content.title));}});

for(const path of ['gr/signals/not-approved/index.html','en/signals/not-approved/index.html','assets/unexpected-public.js','gr/privacy/unexpected.txt'])test('F01 rejects additional public path '+path,()=>{const files=cloneFiles();files.set(path,new TextEncoder().encode('ordinary non-secret content'));assert.throws(()=>validate(files),/UNAPPROVED_PUBLIC_PATH/);});
test('F01 withdrawal cannot retain the removed article inside the artifact',()=>{
 const event=eventFixture('withdraw',candidate.dataset),next=nextSet(candidate.dataset,[candidate.dataset.releases[1]],[event]),withdrawn={...candidate,dataset:next};
 const files=cloneFiles();files.set(WITNESS_PATH,new TextEncoder().encode(JSON.stringify(publicWitness(attempt,withdrawn))));
 const {manifest,releases}=next;assert.equal(manifest.withdrawn_variants[0].target_release_id,candidate.dataset.releases[0].release.id);assert.equal(releases.length,1);
 // Correct witness/sitemap and approved remaining translation do not authorize
 // the old GR HTML. Rejection occurs before stale-page semantics are inspected.
 // Use the same approved sitemap implementation, not a forged malformed XML.
 files.set('sitemap.xml',new TextEncoder().encode(publicationSitemap(baseSitemap,next)));
 assert.throws(()=>validatePublicFiles(files,{attempt,candidate:withdrawn,baseSitemap,pathScope,now:NOW}),/UNAPPROVED_PUBLIC_PATH/);
});
test('F01 preserves every independently built website path, including all GR/EN feature entries',()=>{
 for(const path of normalInventory.paths)assert(built.files.has(path),path);
 for(const lang of ['gr','en'])for(const path of ['index.html','book/index.html','admin/index.html','privacy/index.html','terms/index.html','signals/index.html','signals-preview/index.html','signals-preview/who-decides-when-ai-suggests/index.html'])assert(normalInventory.paths.includes(`${lang}/${path}`));
 assert(normalInventory.paths.includes('404.html'));assert(normalInventory.paths.includes('favicon.ico'));assert(validate(built.files));
});
for(const evidence of [undefined,{},'uploaded-inventory'])test('F01 refuses absent or caller-created path evidence '+String(evidence),()=>{assert.throws(()=>validatePublicFiles(built.files,{attempt,candidate,baseSitemap,pathScope:evidence,now:NOW}),/PUBLIC_PATH_INVENTORY_REQUIRED/);});
test('F01 a copied capability or a different code SHA cannot authorize paths',()=>{for(const options of [{pathScope:{...pathScope}},{attempt:{...attempt,codeSHA:'b'.repeat(40)}}]){const files=cloneFiles();files.set(WITNESS_PATH,new TextEncoder().encode(JSON.stringify(publicWitness(options.attempt||attempt,candidate))));assert.throws(()=>validatePublicFiles(files,{attempt,candidate,baseSitemap,pathScope,now:NOW,...options}),/PUBLIC_PATH_INVENTORY_REQUIRED/);}});
test('F01 independent inventory is bound to the approved configuration and code',async()=>{for(const patch of [{codeSHA:'b'.repeat(40)},{configurationSHA256:'0'.repeat(64)}]){const authority=createPublicPathScopeAuthority({configurationSHA256:normalInventory.configurationSHA256,loadApprovedInventory:async()=>({...normalInventory,...patch})});await assert.rejects(authority.forAttempt(attempt),/PUBLIC_INVENTORY_BINDING/);}});
test('F01 a misprepared normal inventory cannot grandfather real article paths',async()=>{for(const path of [articlePath(),WITNESS_PATH]){const authority=createPublicPathScopeAuthority({configurationSHA256:normalInventory.configurationSHA256,loadApprovedInventory:async()=>({...normalInventory,paths:[...normalInventory.paths,path]})});await assert.rejects(authority.forAttempt(attempt),/PUBLIC_INVENTORY_PUBLICATION_PATH/);}});
test('F01 missing legitimate website assets fail the closed inventory comparison',()=>{const files=cloneFiles();files.delete('favicon.ico');assert.throws(()=>validate(files),/INCOMPLETE_PUBLIC_INVENTORY/);});
test('F01 a correctly rebuilt withdrawal retains EN and all static website assets',async()=>{
 const event=eventFixture('withdraw',candidate.dataset),next=nextSet(candidate.dataset,[candidate.dataset.releases[1]],[event]),value={...bundle,dataset:next,rightsDecisions:[f.rights(next.releases[0].presentation.cover)]};
 const c=client(value),p=await c.acquire(),result=await buildAuthenticatedArtifact({receiver:c,proof:p,clock:()=>NOW});assert(!result.files.has(articlePath()));assert(result.files.has(new URL(next.releases[0].canonical_url).pathname.slice(1)+'index.html'));
 assert(validatePublicFiles(result.files,{attempt,candidate:{...candidate,dataset:next},baseSitemap,pathScope,now:NOW}));
});
test('F01 an ordinary empty-publication rebuild preserves the complete normal website inventory',async()=>{
 const value={...bundle,dataset:f.options([]).dataset,assets:[],rightsDecisions:[]},c=client(value),p=await c.acquire(),result=await buildAuthenticatedArtifact({receiver:c,proof:p,clock:()=>NOW});
 assert.deepEqual([...result.files.keys()].sort(),[...normalInventory.paths,WITNESS_PATH].sort());assert(validatePublicFiles(result.files,{attempt,candidate:{...candidate,dataset:value.dataset},baseSitemap,pathScope,now:NOW}));
});

const smallTar=()=>createPagesTar(new Map([['a.txt',new Uint8Array([65])]]));
function checksum(tar){tar.fill(32,148,156);const sum=tar.subarray(0,512).reduce((n,b)=>n+b,0);tar.write(sum.toString(8).padStart(6,'0')+'\0 ',148,8);return tar;}
for(const [name,change]of [
 ['nonzero file padding',t=>{t[513]=88;}],
 ['unused username bytes',t=>{t[265]=88;checksum(t);}],
 ['unused header trailer',t=>{t[500]=88;checksum(t);}],
 ['hidden filename suffix',t=>{t[20]=88;checksum(t);}],
 ['noncanonical file mode',t=>{t.write('0000777\0',100,8);checksum(t);}],
 ['noncanonical mtime',t=>{t.write('00000000001\0',136,12);checksum(t);}],
 ['alternate regular-file type',t=>{t[156]=0;checksum(t);}],
 ['alternate checksum representation',t=>{t[148]=32;}]
])test('F02 rejects '+name+' despite valid apparent file content',()=>{const tar=Buffer.from(smallTar());change(tar);assert.throws(()=>readPagesTar(tar),/TAR_NON_CANONICAL/);});
test('F02 rejects nonzero end padding, extra zero blocks and reordered entries',()=>{
 const dirty=smallTar();dirty[dirty.length-1]=1;assert.throws(()=>readPagesTar(dirty),/TAR_END/);
 assert.throws(()=>readPagesTar(Buffer.concat([smallTar(),Buffer.alloc(512)])),/TAR_NON_CANONICAL/);
 const ordered=createPagesTar(new Map([['a',new Uint8Array([1])],['b',new Uint8Array([2])]])),reordered=Buffer.concat([ordered.subarray(1024,2048),ordered.subarray(0,1024),ordered.subarray(2048)]);
 assert.throws(()=>readPagesTar(reordered),/TAR_NON_CANONICAL/);
});
test('F02 rejects PAX metadata and nonregular TAR entries with recomputed checksums',()=>{for(const type of ['x','L','2']){const tar=smallTar();tar[156]=type.charCodeAt(0);checksum(tar);assert.throws(()=>readPagesTar(tar),/TAR_ENTRY/);}});
test('F02 deterministic TAR accepts empty and block-boundary files byte-for-byte',()=>{for(const length of [0,511,512,513]){const files=new Map([['empty',new Uint8Array()],['file',new Uint8Array(length).fill(65)]]),tar=createPagesTar(files);assert.deepEqual(readPagesTar(tar),files);assert.deepEqual(createPagesTar(readPagesTar(tar)),tar);}});
test('F02 trusted GitHub digest and ZIP CRC cannot legitimize hidden TAR padding',async()=>{
 const tar=smallTar();tar[513]=88;const archive=zip(tar);let validated=false;
 const verifier=artifactProvenanceVerifier({github:{artifactFor:async()=>({artifact:{id:700,name:'github-pages',expired:false,digest:'sha256:'+sha256(archive),workflow_run:{id:100,head_sha:identity.codeSHA}},archive})},validateFiles:()=>{validated=true;}});
 await assert.rejects(verifier.verify(attempt,candidate),/TAR_NON_CANONICAL/);assert.equal(validated,false);
});
