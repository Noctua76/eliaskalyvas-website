import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonicalize,hashJSON,parseContractJSON,validateRelease,validateManifest,validatePublicationSet,validateEvent,validateTransition,validateDeploymentTiming,activeTranslationRelations,mapNyraContent,mapStructuredContent,releaseReference,schemas,ContractError,isPublicHTTPS} from '../lib/publication/contract.mjs';
import {NOW,ISSUED,uid,internalDraft,sealFixture,releaseFixture,manifestFixture,dataset,replacement,eventFixture,nextSet} from './fixtures/publication-v1.1.mjs';
const ctx={now:NOW};
const rejects=(fn,code)=>assert.throws(fn,e=>e instanceof ContractError&&(!code||e.code===code));
const linked=()=>{const el=releaseFixture(),en=releaseFixture({locale:'en',offset:20});for(const [r,t]of [[el,en],[en,el]]){r.translation_group_id=uid(90);r.approved_translation_relations=[{article_id:t.article_id,variant_id:t.variant_id,locale:t.locale}];sealFixture(r);}return [el,en];};

test('formal draft-2020 schemas are closed, versioned and resolve locally',()=>{
 for(const [name,s]of Object.entries(schemas)){assert.equal(s.$schema,'https://json-schema.org/draft/2020-12/schema');assert(s.$id.endsWith(name+'.schema.json'));}
});
test('valid GR-only publication and independently approved EN publication',()=>{
 for(const r of [releaseFixture(),releaseFixture({locale:'en',offset:20})]){const before=canonicalize(r);assert.equal(validateRelease(r,ctx),r);validatePublicationSet(dataset([r]),ctx);assert.equal(canonicalize(r),before);}
});
test('reciprocal approved translations and GR-only dormant relation after EN withdrawal',()=>{
 const rs=linked();validatePublicationSet(dataset(rs),ctx);assert.equal(activeTranslationRelations(rs[0],rs).length,1);
 const prev=dataset(rs),event=eventFixture('withdraw',prev,{target:rs[1]});const next=nextSet(prev,[rs[0]],[event]);validateTransition(prev,next,[event],ctx);assert.deepEqual(activeTranslationRelations(rs[0],next.releases),[]);
 assert(!JSON.stringify(next).includes(rs[1].content.title));
});
for(const [label,change] of [
 ['unknown version',r=>r.schema_version='nyra.publication.v999'],['missing field',r=>delete r.presentation],['wrong type',r=>r.release.sequence='1'],
 ['forged published status',r=>r.status='published'],['foreign canonical',r=>r.canonical_url='https://foreign.org/gr/signals/synthetic-gr/'],
 ['wrong language canonical',r=>r.canonical_url=r.canonical_url.replace('/gr/','/en/')],['slug mismatch',r=>r.slug='other'],
 ['query canonical',r=>r.canonical_url+='?preview=1'],['invalid slug',r=>r.slug='Bad_Slug'],
 ['content hash mismatch',r=>r.content.title+='changed'],['presentation hash mismatch',r=>r.presentation.share_text+='changed'],
 ['approval hash mismatch',r=>r.authorization.approved_payload_sha256='b'.repeat(64)],['missing asset',r=>delete r.presentation.cover],
 ['rights not confirmed',r=>r.presentation.cover.attribution.rights_confirmed=false],['placeholder asset',r=>r.presentation.cover.url='https://eliaskalyvas.gr/assets/signals/placeholder.svg'],
 ['external asset',r=>r.presentation.cover.url='https://external.org/cover.webp'],['unsupported block',r=>r.content.blocks[0].type='script'],
 ['unknown source reference',r=>r.content.blocks[0].source_ids=['s999']],['duplicate source ID',r=>r.content.sources.push({...r.content.sources[0],url:'https://www.un.org/'})],
 ['source without title',r=>r.content.sources[0].title=''],['private nested research',r=>r.content.research={ticket:'private'}],
 ['private evidence IDs',r=>r.content.blocks[0].evidence_ids=['internal']],['private draft revision',r=>r.unpublished_revision={text:'private'}],
 ['human Nyra identity',r=>r.identity.editorial_voice_type='Person'],['invented author',r=>r.identity.author={name:'Nyra',type:'Person'}],
 ['self translation',r=>{r.translation_group_id=uid(90);r.approved_translation_relations=[{article_id:r.article_id,variant_id:r.variant_id,locale:r.locale}]}],
 ['translation without group',r=>r.approved_translation_relations=[{article_id:uid(22),variant_id:uid(23),locale:'en'}]],
 ['source credentials',r=>r.content.sources[0].url='https://user:secret@www.oecd.org/'],
])test('rejects '+label,()=>{const r=releaseFixture();change(r);rejects(()=>validateRelease(r,ctx));});
for(const date of ['2026-02-30T10:10:00.000Z','2026-10-27','2026-10-27T10:10:00+00:00','2026-13-01T10:10:00.000Z','2026-10-28T10:10:00.000Z'])test('rejects invalid/future date '+date,()=>{const r=releaseFixture();r.release.release_issued_at=date;rejects(()=>validateRelease(r,ctx));});
test('date and revision semantics are enforced even with correct hashes',()=>{
 const mutations=[r=>r.authorization.human_approved_at='2026-10-27T10:05:00.000Z',r=>r.release.modified_at='2026-10-27T10:09:00.000Z',r=>r.release.first_published_at='2026-10-27T10:11:00.000Z',r=>r.release.sequence=2];
 for(const change of mutations){const r=releaseFixture();change(r);sealFixture(r);rejects(()=>validateRelease(r,ctx));}
});
test('approved owned editorial template is valid; inconsistent template metadata is rejected',()=>{
 const r=releaseFixture();r.presentation.cover.kind='editorial_template';r.presentation.cover.template_id=uid(300);sealFixture(r);validateRelease(r,ctx);
 r.presentation.cover.attribution.rights_basis='licensed';sealFixture(r);rejects(()=>validateRelease(r,ctx),'INVALID_TEMPLATE');
});
test('deterministic canonical JSON and UTF-8 hashing preserve approved strings and order',()=>{
 assert.equal(canonicalize({z:1,a:{b:true,a:'Ελλάδα'}}),'{"a":{"a":"Ελλάδα","b":true},"z":1}');
 assert.equal(hashJSON({a:1,b:2}),hashJSON({b:2,a:1}));assert.notEqual(hashJSON(['a','b']),hashJSON(['b','a']));
 assert.equal(hashJSON({a:1}),createHash('sha256').update('{"a":1}').digest('hex'));
 assert.notEqual(hashJSON('é'),hashJSON('e\u0301'));assert.equal(canonicalize('a\n"\\'),'"a\\n\\"\\\\"');
 for(const v of [NaN,Infinity,-0,1.1,9007199254740992,undefined,()=>{},new Date(),{x:undefined},[,,], '\ud800'])rejects(()=>canonicalize(v));
 const cycle={};cycle.self=cycle;rejects(()=>canonicalize(cycle),'CYCLIC_VALUE');
 const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){throw Error('must not execute')}});rejects(()=>canonicalize(getter));
});
test('wire parsing rejects duplicate keys, malformed JSON, excessive depth and invalid unicode',()=>{
 assert.equal(canonicalize(parseContractJSON('{"z":1,"a":[true,null,"x"]}')),'{"a":[true,null,"x"],"z":1}');
 for(const s of ['{"x":1,"x":2}','{"x":1,"\\u0078":2}','{"a":{"x":1,"x":2}}','[1,]','{"x":1,}','true false','[','{"a":}','"\\ud800"','['.repeat(42)+'0'+']'.repeat(42)])rejects(()=>parseContractJSON(s));
});
test('validation does not coerce, remove, normalize or repair input',()=>{
 const r=releaseFixture();r.presentation.cover.width='1200';const before=JSON.stringify(r);rejects(()=>validateRelease(r,ctx));assert.equal(JSON.stringify(r),before);
});
test('legacy mapping preserves every paragraph and citation, removes private canaries',()=>{
 const draft=internalDraft(),before=structuredClone(draft),content=mapNyraContent(draft);
 assert.deepEqual(content.blocks.map(b=>b.text),draft.article.paragraphs.map(p=>p.text));assert.deepEqual(content.blocks[0].source_ids,['s1']);assert.deepEqual(draft,before);
 const json=JSON.stringify(content);for(const token of ['PRIVATE_','private-evidence','sk-proj-','ticket','evidence_ids','source_records','editor_note','unpublished_revision','owner_id'])assert(!json.includes(token),token);
 const r=releaseFixture();r.content=content;sealFixture(r);validateRelease(r,ctx);assert(!JSON.stringify(r).includes('PRIVATE_'));
});
test('private fields at any public nesting level and recognizable secret text are rejected',()=>{
 for(const [field,value]of [['draft',{text:'private'}],['research_ticket','private'],['api_key','secret'],['internal_evidence_excerpt','private'],['unpublished_version',2]])for(const target of ['root','block','source','cover']){
 const r=releaseFixture(),obj=target==='root'?r:target==='block'?r.content.blocks[0]:target==='source'?r.content.sources[0]:r.presentation.cover;obj[field]=value;rejects(()=>validateRelease(r,ctx));}
 for(const secret of ['sk-proj-'+'x'.repeat(24),'Bearer '+'x'.repeat(24),'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature']){const r=releaseFixture();r.content.blocks[0].text=secret;sealFixture(r);rejects(()=>validateRelease(r,ctx),'SECRET_MATERIAL');}
});
test('structured mapping preserves headings, quotations, lists and multi-source citations',()=>{
 const draft=internalDraft();draft.sources.push({url:'https://www.un.org/',title:'Second synthetic source'});
 const ref={source_urls:['https://www.oecd.org/','https://www.un.org/'],evidence_ids:['private-evidence-1']};
 const input={title:'Structured fixture',summary:'Approved structure fixture',sources:draft.sources,source_records:draft.research.source_records,blocks:[{type:'heading',level:2,text:'Exact heading'},{type:'paragraph',text:'Exact paragraph',...ref},{type:'quote',text:'Exact quotation',attribution:'Approved attribution',...ref},{type:'list',ordered:false,items:[{text:'Exact list item',...ref}]}]};
 const content=mapStructuredContent(input);assert.deepEqual(content.blocks.map(b=>b.type),['heading','paragraph','quote','list']);assert.deepEqual(content.blocks[1].source_ids,['s1','s2']);assert.equal(content.blocks[2].attribution,'Approved attribution');assert.equal(content.blocks[3].items[0].text,'Exact list item');
 const r=releaseFixture();r.content=content;sealFixture(r);validateRelease(r,ctx);
});
test('mapping refuses unknown blocks, unsupported fields and invalid evidence/source relationships',()=>{
 for(const mutate of [d=>d.article.body=[],d=>d.article.paragraphs[0].type='quote',d=>d.article.paragraphs[0].evidence_ids=['unknown'],d=>d.article.paragraphs[0].source_urls=['https://www.un.org/']]){const d=internalDraft();mutate(d);rejects(()=>mapNyraContent(d));}
 rejects(()=>mapStructuredContent({title:'x',summary:'x',sources:internalDraft().sources,blocks:[{type:'video',text:'lost'}]}),'UNSUPPORTED_CONTENT_BLOCK');
});
test('manifest rejects duplicate, stale, foreign, forged, missing and withdrawn conflicts',()=>{
 const r=releaseFixture();for(const mutate of [m=>m.active_releases.push({...m.active_releases[0]}),m=>m.active_releases[0].canonical_url='https://foreign.org/gr/signals/x/',m=>m.active_releases[0].status='published',m=>m.generation=2,m=>m.withdrawn_variants=[{article_id:r.article_id,variant_id:r.variant_id,locale:r.locale,event_id:uid(700),withdrawn_at:ISSUED,target_release_id:r.release.id}]]){const m=manifestFixture([r]);mutate(m);rejects(()=>validateManifest(m,ctx));}
 const s=dataset([r]);s.manifest.active_releases[0].release_sha256='b'.repeat(64);rejects(()=>validatePublicationSet(s,ctx),'RELEASE_REFERENCE_MISMATCH');
 rejects(()=>validatePublicationSet({...dataset([r]),releases:[]},ctx),'RELEASE_SET_MISMATCH');validatePublicationSet(dataset([]),ctx);
});
test('translation mismatch, nonreciprocal relations and unpublished related links fail closed',()=>{
 for(const mutate of [rs=>rs[1].approved_translation_relations=[],rs=>rs[1].translation_group_id=uid(91),rs=>rs[0].approved_translation_relations[0].article_id=uid(92)]){const rs=linked();mutate(rs);rs.forEach(sealFixture);rejects(()=>validatePublicationSet(dataset(rs),ctx));}
 const r=releaseFixture();r.presentation.related_article_ids=[uid(999)];sealFixture(r);rejects(()=>validatePublicationSet(dataset([r]),ctx),'UNRELEASED_RELATED_ARTICLE');
});
test('explicit publish/replace/withdraw/rollback events and monotonic immutable generations',()=>{
 const empty=dataset([]),r1=releaseFixture(),publish=eventFixture('publish',empty,{fresh:r1,target:null}),first=nextSet(empty,[r1],[publish]);
 validateEvent(publish,ctx);validateTransition(empty,first,[publish],ctx);
 const r2=replacement(r1),replace=eventFixture('replace',first,{fresh:r2}),second=nextSet(first,[r2],[replace]);validateTransition(first,second,[replace],ctx);
 const withdraw=eventFixture('withdraw',second),removed=nextSet(second,[],[withdraw]);validateTransition(second,removed,[withdraw],ctx);
 const restored=replacement(r2,{rollback:r1,n:200});restored.authorization.human_approved_at='2026-10-27T10:45:00.000Z';restored.authorization.publication_authorized_at='2026-10-27T10:46:00.000Z';restored.release.release_issued_at=restored.release.modified_at='2026-10-27T10:50:00.000Z';sealFixture(restored);
 const rollback=eventFixture('rollback',removed,{fresh:restored,target:r2,restore:r1}),back=nextSet(removed,[restored],[rollback]);validateTransition(removed,back,[rollback],{...ctx,history:[r1,r2]});
 assert.equal(restored.release.first_published_at,r1.release.first_published_at);assert.notEqual(restored.release.id,r1.release.id);
});
test('transition rejects unauthorized removal, stale events, changed immutable records and fake rollback',()=>{
 const r=releaseFixture(),prev=dataset([r]),remove=nextSet(prev,[],[]);rejects(()=>validateTransition(prev,remove,[],ctx),'UNAUTHORIZED_MANIFEST_CHANGE');
 const fresh=replacement(r),e=eventFixture('replace',prev,{fresh}),next=nextSet(prev,[fresh],[e]);e.expected_generation=999;rejects(()=>validateTransition(prev,next,[e],ctx),'STALE_EVENT');
 const changed=structuredClone(r);changed.content.title+='mutation';sealFixture(changed);const changedSet=nextSet(prev,[changed],[]);rejects(()=>validateTransition(prev,changedSet,[],ctx),'IMMUTABLE_RELEASE_CHANGED');
 const fake=replacement(r,{rollback:r,n:200});fake.content.title+='forged';fake.content_revision.id=uid(299);sealFixture(fake);const rollback=eventFixture('rollback',prev,{fresh:fake,restore:r});rejects(()=>validateTransition(prev,nextSet(prev,[fake],[rollback]),[rollback],ctx),'ROLLBACK_PAYLOAD_MISMATCH');
});
test('withdrawal is a separate strict contract; cannot smuggle a release payload',()=>{
 const prev=dataset([releaseFixture()]),e=eventFixture('withdraw',prev);validateEvent(e,ctx);e.new_release=releaseReference(prev.releases[0]);rejects(()=>validateEvent(e,ctx));
});
test('deployment timing is separate from historical record validation and never changes dates',()=>{
 const r=releaseFixture(),before=canonicalize(r);validateRelease(r,ctx);
 assert.equal(validateDeploymentTiming([r],{now:'2026-10-27T10:25:00.000Z',phase:'start'}),true);
 rejects(()=>validateDeploymentTiming([r],{now:'2026-10-27T10:25:00.001Z',phase:'start'}),'DEPLOYMENT_WINDOW_EXPIRED');
 assert.equal(validateDeploymentTiming([r],{now:'2026-10-27T10:40:00.000Z',phase:'verify'}),true);
 rejects(()=>validateDeploymentTiming([r],{now:'2026-10-27T10:40:00.001Z',phase:'verify'}),'DEPLOYMENT_WINDOW_EXPIRED');assert.equal(canonicalize(r),before);
});
test('HTTPS checks reject credentials, IPs, local hosts and noncanonical encodings',()=>{
 for(const u of ['http://www.oecd.org/','https://127.0.0.1/','https://[::1]/','https://2130706433/','https://localhost/','https://x.internal/','https://x.home.arpa/','https://user:pass@www.oecd.org/','https://www.oecd.org/#secret','https://WWW.OECD.ORG/'])assert.equal(isPublicHTTPS(u),false,u);
 assert.equal(isPublicHTTPS('https://www.oecd.org/'),true);
});
test('Phase 1 runtime has no provider execution or production integration',async()=>{
 const source=await readFile(new URL('../lib/publication/contract.mjs',import.meta.url),'utf8');assert(!/\bfetch\s*\(|openai\.com|process\.env|createClient\s*\(/.test(source));
 const adapter=await readFile(new URL('../src/signals/adapter.mjs',import.meta.url),'utf8');assert(!/from\s+['"].*publication/.test(adapter));assert(adapter.includes('preview?demoArticles.filter'));
});

test('dataset wrapper rejects accidentally attached private records',()=>{
 rejects(()=>validatePublicationSet({...dataset([releaseFixture()]),research_ticket:'private'},ctx),'INVALID_PUBLICATION_SET');
});
test('strict event/manifest versions, types and required fields are rejected',()=>{
 for(const mutate of [m=>m.schema_version='nyra.publication.manifest.v1',m=>delete m.audience,m=>m.generation='1']){const m=manifestFixture();mutate(m);rejects(()=>validateManifest(m,ctx));}
 const prev=dataset([releaseFixture()]);for(const mutate of [e=>e.schema_version='unknown',e=>delete e.actor_id,e=>e.action='published',e=>e.expected_generation='1']){const e=eventFixture('withdraw',prev);mutate(e);rejects(()=>validateEvent(e,ctx));}
});
test('EN can be added and replaced independently while the exact GR release survives unchanged',()=>{
 const el=releaseFixture(),en=releaseFixture({locale:'en',offset:20}),prev=dataset([el]);
 const publish=eventFixture('publish',prev,{fresh:en,target:null}),both=nextSet(prev,[el,en],[publish]);validateTransition(prev,both,[publish],ctx);
 const updated=replacement(en,{n:300}),replace=eventFixture('replace',both,{fresh:updated,target:en}),next=nextSet(both,[el,updated],[replace]);validateTransition(both,next,[replace],ctx);assert.equal(hashJSON(next.releases[0]),hashJSON(el));
});
test('stable language/article IDs, revision IDs and withdrawal audit records cannot be reassigned',()=>{
 const r=releaseFixture(),prev=dataset([r]),fresh=replacement(r);fresh.locale='en';fresh.slug='synthetic-en';fresh.canonical_url='https://eliaskalyvas.gr/en/signals/synthetic-en/';sealFixture(fresh);
 const e=eventFixture('replace',prev,{fresh});rejects(()=>validateTransition(prev,nextSet(prev,[fresh],[e]),[e],ctx),'STABLE_IDENTITY_CHANGED');
 const withdrawal=eventFixture('withdraw',prev),next=nextSet(prev,[],[withdrawal]);next.manifest.withdrawn_variants.push({...next.manifest.withdrawn_variants[0],article_id:uid(999),variant_id:uid(998)});rejects(()=>validateTransition(prev,next,[withdrawal],ctx),'UNAUTHORIZED_WITHDRAWAL_RECORD');
});
test('duplicate approved list items are preserved without deduplication',()=>{
 const text={text:'Repeated approved item',source_urls:['https://www.oecd.org/'],evidence_ids:[]};
 const content=mapStructuredContent({title:'Exact duplicate items',summary:'Lossless fixture',sources:internalDraft().sources,blocks:[{type:'list',ordered:false,items:[text,{...text}]}]});
 assert.equal(content.blocks[0].items.length,2);const r=releaseFixture();r.content=content;sealFixture(r);validateRelease(r,ctx);
});
test('verified-live receipt has its own schema, exact manifest binding and timing gate',async()=>{
 const {validateReceipt}=await import('../lib/publication/contract.mjs');const r=releaseFixture(),manifest=manifestFixture([r]);manifest.issued_at=ISSUED;
 const receipt={schema_version:'nyra.publication.receipt.v1.1',id:uid(800),attempt_id:uid(801),manifest_id:manifest.manifest_id,generation:manifest.generation,manifest_sha256:hashJSON(manifest),code_sha:'a'.repeat(40),github_run_id:'12345',github_run_attempt:1,github_deployment_id:'67890',status:'released_verified',deployment_requested_at:'2026-10-27T10:11:00.000Z',deployment_completed_at:'2026-10-27T10:12:00.000Z',verified_live_at:'2026-10-27T10:13:00.000Z',observed_manifest_sha256:hashJSON(manifest)};
 validateReceipt(receipt,{manifest,now:NOW,newReleases:[r]});
 for(const change of [x=>x.observed_manifest_sha256='b'.repeat(64),x=>x.verified_live_at=null,x=>x.status='release_failed',x=>x.manifest_id=uid(999),x=>x.verified_live_at='2026-10-27T10:41:00.000Z']){const x=structuredClone(receipt);change(x);rejects(()=>validateReceipt(x,{manifest,now:NOW,newReleases:[r]}));}
 const unknown={...receipt,status:'delivery_unknown',deployment_completed_at:null,github_deployment_id:null,verified_live_at:null,observed_manifest_sha256:null};validateReceipt(unknown,{manifest,now:NOW});
});
