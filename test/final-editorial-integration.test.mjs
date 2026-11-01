// LOCAL FIXTURES ONLY. No GitHub OIDC, Owner identity, provider or live evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {authorityFixture,OWNER,SESSION} from './fixtures/publication-authority.mjs';
import {composeEditorialPublication} from '../runtime/nyra-edge/editorial.mjs';
import {ownerEditedWork} from '../supabase/functions/nyra-api/lib/owner-edit.mjs';
import {createPrivateInspectionService} from '../lib/publication/runtime/inspection.mjs';
import {runPrivateAssetInspection} from '../lib/publication/runtime/node-inspection.mjs';
import {byteHash} from '../lib/publication/runtime/adapters.mjs';
const CODE='a'.repeat(40),origin='https://eliaskalyvas.gr';
async function setup(){
 const f=await authorityFixture();for(const file of ['20261028142242_nyra_private_delivery_runtime.sql','20261029145714_nyra_protected_delivery_acceptance.sql','20261029194516_nyra_private_asset_inspection.sql','20261031221433_nyra_final_inspection_queue.sql'])await f.pg.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 const objects=new Map(),assets=new Map(),quarantine={put:async(id,b)=>objects.set(id,b),get:async id=>objects.get(id),remove:async id=>objects.delete(id)},accepted={put:async(id,b)=>assets.set(id,b),get:async id=>assets.get(id)};
 let ready=true,calls=0;const args={db:f.db,env:{ALLOWED_ORIGINS:origin},quarantine,storage:accepted,codeSHA:CODE,enabled:true,assertTrustReady:async()=>{calls++;return ready;},fetcher:async()=>{throw Error('NO_PROVIDER');}};
 const handler=composeEditorialPublication(args),send=async(path,body,{token=f.good,headers={},method='POST'}={})=>{const r=await handler(new Request(origin+'/functions/v1/nyra-api'+path,{method,headers:{Origin:origin,Authorization:'Bearer '+token,...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...headers},...(method==='GET'?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}));return {status:r.status,body:await r.json()};};
 const verifier={verify:async t=>{assert.equal(t,'UNIT_MACHINE');return {codeSHA:CODE,runId:'100',runAttempt:'1',checkRunId:'300'};},assert:()=>{}};
 const machine=createPrivateInspectionService({db:f.db,quarantine,accepted,verifier,codeSHA:CODE});
 async function image(w){
  const bytes=new Uint8Array(await sharp({create:{width:1280,height:720,channels:3,background:'#123456'}}).png().toBuffer()),sha=await byteHash(bytes),cover={...structuredClone(f.cover),kind:'final_cover',template_id:null,sha256:sha,mime_type:'image/png',width:1280,height:720,url:'https://eliaskalyvas.gr/assets/signals/'+sha+'.png'};
  const current=(await send('/work/'+w.id,undefined,{method:'GET'})).body.state.drafts[0].presentation;
  const staged=await send('/work/'+w.id+'/presentation',{version:0,expected_revision:current.revision,presentation:{...current,cover:{image_url:cover.url,source_url:cover.attribution.source_url,creator:cover.attribution.creator,license_name:cover.attribution.license_name,license_url:cover.attribution.license_url||'',alt:cover.alt,caption:cover.caption,rights_basis:cover.attribution.rights_basis,rights_confirmed:false}}});assert.equal(staged.status,200,JSON.stringify(staged.body));
  const saved=staged.body.state.drafts[0].presentation;
  const confirmed=await send('/work/'+w.id+'/presentation',{version:0,expected_revision:saved.revision,confirm_rights:true,presentation:{...saved,cover:{...saved.cover,rights_confirmed:true}}});assert.equal(confirmed.status,200,JSON.stringify(confirmed.body));assert.equal(confirmed.body.state.drafts[0].presentation.cover.rights_confirmed,true);
  const form=new FormData();form.set('file',new Blob([bytes],{type:'image/png'}),'owned.png');form.set('metadata',JSON.stringify({work_id:w.id,version:0,cover,rights_note:'UNIT ONLY owner-owned image rights review'}));return {form,cover,bytes};
 }
 return {...f,handler,args,send,image,machine,objects,setReady:v=>{ready=v},gateCalls:()=>calls};
}
test('Opt-in router is off by default; live entrypoint and public plan stay inactive',async()=>{
 const f=await setup();try{const h=composeEditorialPublication({...f.args,enabled:false});assert.equal((await h(new Request(origin+'/nyra-api/publication/authorize',{method:'POST',body:'{}'}))).status,503);const source=await readFile(new URL('../supabase/functions/nyra-api/index.ts',import.meta.url),'utf8');assert(!source.includes('composeEditorialPublication'));assert.equal(JSON.parse(await readFile(new URL('../ops/protected-delivery/live-acceptance-plan.json',import.meta.url))).approved,false);}finally{await f.pg.close();}
});
test('Persisted work -> private upload -> actual Sharp -> exact preview -> owner action; trust/stale/replay gates remain enforced',async()=>{
 const f=await setup();try{
  const w=await f.work(),{form}=await f.image(w);
  assert.equal((await f.send('/publication/upload',form,{token:f.token({aal:'aal1'})})).status,403);assert.equal(f.objects.size,0);
  const upload=await f.send('/publication/upload',form);assert.equal(upload.status,200,JSON.stringify(upload.body));assert.equal(upload.body.asset_id,null);
  assert.equal((await f.send('/publication/catalog',{work_id:w.id})).body.assets.length,0);
  await runPrivateAssetInspection({service:f.machine,tokenSource:async()=> 'UNIT_MACHINE',operationId:upload.body.inspection_id});
  const catalog=await f.send('/publication/catalog',{work_id:w.id});assert.equal(catalog.body.assets.length,1);
  const privateImage=await f.handler(new Request(origin+'/nyra-api/publication/asset',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+f.good,'Content-Type':'application/json'},body:JSON.stringify({work_id:w.id,asset_id:catalog.body.assets[0].id})}));assert.equal(privateImage.status,200);assert.equal(privateImage.headers.get('Cache-Control'),'no-store');assert.equal(await byteHash(new Uint8Array(await privateImage.arrayBuffer())),catalog.body.assets[0].cover.sha256);
  const input=f.input(w,catalog.body.assets[0].id),p=await f.send('/publication/preview',input);assert.equal(p.status,200,JSON.stringify(p.body));assert.equal(p.body.release.content.title,w.state.drafts[0].article.title);
  assert(!JSON.stringify(catalog.body).includes('PRIVATE_TICKET_CANARY'));assert(!JSON.stringify(p.body.release).includes('PRIVATE_EXCERPT_CANARY'));
  const request_id=crypto.randomUUID();f.setReady(false);assert.equal((await f.send('/publication/authorize',{preview_id:p.body.preview_id,request_id})).status,409);
  assert.equal((await f.pg.query('select count(*)::int n from nyra_publication_decisions')).rows[0].n,0);
  f.setReady(true);const a=await f.send('/publication/authorize',{preview_id:p.body.preview_id,request_id});assert.equal(a.status,200,JSON.stringify(a.body));assert.equal(a.body.status,'authorized_held');assert.equal(a.body.delivered,false);
  assert.deepEqual((await f.send('/publication/authorize',{preview_id:p.body.preview_id,request_id})).body,a.body);assert(f.gateCalls()>=3);
  // A different language is still a different draft/inspection/approval.
  const en=await f.work({language:'en'});assert.equal((await f.send('/publication/catalog',{work_id:en.id})).body.history.length,0);
  assert.equal((await f.send('/publication/preview',{...input,work_id:en.id})).status,409);
  const latest=await f.work(),img=await f.image(latest);const q=await f.send('/publication/upload',img.form);await runPrivateAssetInspection({service:f.machine,tokenSource:async()=> 'UNIT_MACHINE',operationId:q.body.inspection_id});
  const pp=await f.send('/publication/preview',{...f.input(latest,catalog.body.assets[0].id),metadata:{...f.input(latest,catalog.body.assets[0].id).metadata,slug:'new-version'}});
  assert.equal(pp.status,200,JSON.stringify(pp.body));await f.mutate(latest.id,row=>row.state.drafts[0].article.title='Changed after preview');
  assert.notEqual((await f.send('/publication/authorize',{preview_id:pp.body.preview_id,request_id:crypto.randomUUID()})).status,200);
 }finally{await f.pg.close();}
});
test('Owner edit forks immutable persisted content, invalidates review/rights, rejects stale or unverified citations; no provider call',async()=>{
 const f=await setup();try{const w=await f.work(),d=w.state.drafts[0],input={version:0,expected_run_id:d.run.id,expected_presentation_revision:d.presentation.revision,content:{title:'Owner edited title',summary:d.article.summary,paragraphs:d.article.paragraphs}};
  const before=structuredClone(w),fork=ownerEditedWork(w,input);assert.deepEqual(w,before);assert.equal(fork.state.stage,'review');assert.equal(fork.state.drafts[0].automatic_review,null);assert.equal(fork.state.drafts[0].presentation.cover.rights_confirmed,false);
  assert.throws(()=>ownerEditedWork(w,{...input,expected_run_id:crypto.randomUUID()}),/STALE_EDITORIAL_VERSION/);
  assert.throws(()=>ownerEditedWork(w,{...input,content:{...input.content,paragraphs:[{text:'x',source_urls:['https://unapproved.invalid/'],evidence_ids:[]}]}}));
  const saved=await f.send('/work/'+w.id+'/edit',input);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.notEqual(saved.body.id,w.id);assert.equal(saved.body.state.drafts[0].article.title,'Owner edited title');
  assert.equal((await f.send('/publication/catalog',{work_id:w.id},{token:f.token({owner:crypto.randomUUID()})})).status,403);
  assert.equal((await f.send('/publication/catalog',{work_id:w.id})).status,200);const baseline={manifest:(await f.pg.query('select snapshot from nyra_publication_manifests where generation=1')).rows[0].snapshot,releases:[]};const boot=await f.db.rpc('nyra_delivery_bootstrap',{p_owner:OWNER,p_session:SESSION,p_expires:new Date(Date.now()+3600000).toISOString(),p_baseline:baseline});assert.equal(boot.error,null);await f.pg.query('update nyra_delivery.control set blocked=true where singleton');const status=await f.send('/publication/catalog',{work_id:w.id});assert.equal(status.body.delivery.blocked,true);assert.deepEqual(status.body.delivery.receipts,[]);assert.deepEqual(status.body.delivery.verified_restore_release_ids,[]);
  await f.pg.query('delete from auth.sessions where id=$1',[SESSION]);assert.notEqual((await f.send('/publication/catalog',{work_id:w.id})).status,200);
 }finally{await f.pg.close();}
});

test('Server-selected image queue preserves unknown dispatch outcomes and denies client RPCs',async()=>{
 const {createOutboxTrigger}=await import('../lib/publication/integration/outbox.mjs');const f=await setup();try{
  const w=await f.work(),{form}=await f.image(w),upload=await f.send('/publication/upload',form);assert.equal(upload.status,200);
  assert.equal((await f.machine.next('UNIT_MACHINE')).operation_id,upload.body.inspection_id);
  let dispatches=0;const trigger=createOutboxTrigger({db:f.db,rpcName:'nyra_inspection_nudge',claimArgs:{p_code:CODE},dispatchWorkflow:async()=>{dispatches++;throw Error('UNKNOWN_REMOTE_OUTCOME');}});
  assert.equal((await trigger.runOnce()).status,'unknown');assert.equal((await trigger.runOnce()).status,'idle');assert.equal(dispatches,1);
  assert.equal((await f.pg.query('select outcome from nyra_inspection.dispatches')).rows[0].outcome,'unknown');
  await runPrivateAssetInspection({service:f.machine,tokenSource:async()=> 'UNIT_MACHINE',operationId:upload.body.inspection_id});assert.equal((await f.machine.next('UNIT_MACHINE')).operation_id,null);
  const permission=(await f.pg.query("select has_function_privilege('anon','public.nyra_inspection_next(text)','execute') a,has_function_privilege('authenticated','public.nyra_inspection_nudge(text,text,uuid,text)','execute') b")).rows[0];assert.equal(permission.a,false);assert.equal(permission.b,false);
  const relation=(await f.pg.query("select relrowsecurity,relforcerowsecurity from pg_class where oid='nyra_inspection.dispatches'::regclass")).rows[0];assert(relation.relrowsecurity&&relation.relforcerowsecurity);
 }finally{await f.pg.close();}
});
test('GR/EN decisions, replacement, withdrawal and historical rollback remain independent through the integrated owner API',async()=>{
 const f=await setup();try{
  const prepare=async(w,opts={})=>{const {form}=await f.image(w),u=await f.send('/publication/upload',form);await runPrivateAssetInspection({service:f.machine,tokenSource:async()=> 'UNIT_MACHINE',operationId:u.body.inspection_id});const c=await f.send('/publication/catalog',{work_id:w.id});const input=f.input(w,c.body.assets[0].id,opts);const p=await f.send('/publication/preview',input);assert.equal(p.status,200,JSON.stringify(p.body));return {p,c};};
  const authorize=async p=>{const r=await f.send('/publication/authorize',{preview_id:p.body.preview_id,request_id:crypto.randomUUID()});assert.equal(r.status,200,JSON.stringify(r.body));return r;};
  const gr=await f.work(),first=await prepare(gr);await authorize(first.p);const grRelease=first.p.body.release;
  const en=await f.work({language:'en'}),english=await prepare(en);await authorize(english.p);
  const replaced=await prepare(gr,{action:'replace',article_id:grRelease.article_id});await authorize(replaced.p);
  let c=(await f.send('/publication/catalog',{work_id:gr.id})).body;assert.equal(c.desired_manifest.active_releases.length,2);
  const withdraw=await f.send('/publication/preview',f.input(gr,c.assets[0].id,{action:'withdraw',article_id:grRelease.article_id}));assert.equal(withdraw.status,200,JSON.stringify(withdraw.body));await authorize(withdraw);
  c=(await f.send('/publication/catalog',{work_id:gr.id})).body;assert.equal(c.desired_manifest.active_releases.length,1);assert.equal(c.desired_manifest.active_releases[0].locale,'en');
  const rollback=await f.send('/publication/preview',f.input(gr,c.assets[0].id,{action:'rollback',article_id:grRelease.article_id,restore_release_id:grRelease.release.id}));assert.equal(rollback.status,200,JSON.stringify(rollback.body));await authorize(rollback);
  c=(await f.send('/publication/catalog',{work_id:gr.id})).body;assert.equal(c.desired_manifest.active_releases.length,2);assert.equal(c.verified_live_manifest,null);
 }finally{await f.pg.close();}
});

test('Private inspection HTTP client processes only server-selected bytes and preserves a lost completion response',async()=>{
 const {createInspectionMachineHandler}=await import('../lib/publication/runtime/inspection.mjs'),{privateInspectionClient,runPendingInspections}=await import('../lib/publication/integration/inspection-client.mjs');
 for(const loseResponse of [false,true]){const f=await setup();try{
  const w=await f.work(),{form}=await f.image(w),upload=await f.send('/publication/upload',form);assert.equal(upload.status,200);
  const handler=createInspectionMachineHandler({service:f.machine,enabled:true}),requests=[],service=privateInspectionClient({endpoint:'https://private.invalid/inspection',tokenSource:async()=> 'UNIT_MACHINE',fetcher:async(url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer UNIT_MACHINE');requests.push(new URL(url).pathname);const r=await handler(new Request(url,options));if(loseResponse&&String(url).endsWith('/finish')&&r.ok)throw Error('LOST_COMPLETION_RESPONSE');return r;}});
  if(loseResponse)await assert.rejects(runPendingInspections({service}),/LOST_COMPLETION_RESPONSE/);else assert.deepEqual(await runPendingInspections({service}),{status:'idle',inspected:1});
  assert.equal((await f.pg.query('select count(*)::int n from nyra_inspection.receipts')).rows[0].n,1);assert(!requests.some(p=>p.endsWith('/fail')));assert.equal((await f.machine.next('UNIT_MACHINE')).operation_id,null);
 }finally{await f.pg.close();}}
});

test('NYRA-PR22-01: a fully inspected image cannot donate rights to different bytes; explicit confirmation of persisted new identity permits inspection',async()=>{
 const f=await setup();try{
  const w=await f.work(),first=await f.image(w),initial=await f.send('/publication/upload',first.form);assert.equal(initial.status,200);
  await runPrivateAssetInspection({service:f.machine,tokenSource:async()=> 'UNIT_MACHINE',operationId:initial.body.inspection_id});
  const immutable=(await f.pg.query('select * from nyra_inspection.receipts where upload_id=$1',[initial.body.inspection_id])).rows[0];assert(immutable);
  const prior=(await f.send('/work/'+w.id,undefined,{method:'GET'})).body.state.drafts[0].presentation;assert.equal(prior.cover.rights_confirmed,true);
  const bytes=new Uint8Array(await sharp({create:{width:1280,height:720,channels:3,background:'#abcdef'}}).png().toBuffer()),sha=await byteHash(bytes);
  const cover={...first.cover,sha256:sha,url:'https://eliaskalyvas.gr/assets/signals/'+sha+'.png',alt:'Different new image',caption:'New license attribution',attribution:{...first.cover.attribution,source_url:'https://example.com/new-image',creator:'New photographer',license_name:'New explicit image license',rights_basis:'licensed'}};
  const candidate={...prior,cover:{image_url:cover.url,source_url:cover.attribution.source_url,creator:cover.attribution.creator,license_name:cover.attribution.license_name,license_url:cover.attribution.license_url||'',alt:cover.alt,caption:cover.caption,rights_basis:cover.attribution.rights_basis,rights_confirmed:true}};
  // Even a forged same-mutation confirmation intent must be cleared server-side.
  const changed=await f.send('/work/'+w.id+'/presentation',{version:0,expected_revision:prior.revision,confirm_rights:true,presentation:candidate});assert.equal(changed.status,200);
  const staged=changed.body.state.drafts[0].presentation;assert.equal(staged.cover.rights_confirmed,false);assert.equal(staged.cover.image_url,cover.url);assert.equal(staged.cover.rights_basis,'licensed');
  const form=()=>{const v=new FormData();v.set('file',new Blob([bytes],{type:'image/png'}),'new.png');v.set('metadata',JSON.stringify({work_id:w.id,version:0,cover,rights_note:'Explicit UNIT ONLY new image license review'}));return v;};
  const before=f.objects.size;assert.notEqual((await f.send('/publication/upload',form())).status,200);assert.equal(f.objects.size,before);assert.equal((await f.pg.query('select count(*)::int n from nyra_inspection.rights')).rows[0].n,1);
  const confirmed={...staged,cover:{...staged.cover,rights_confirmed:true}};
  assert.equal((await f.send('/work/'+w.id+'/presentation',{version:0,expected_revision:staged.revision,presentation:confirmed})).body.error,'IMAGE_RIGHTS_RECONFIRMATION_REQUIRED');
  assert.notEqual((await f.send('/work/'+w.id+'/presentation',{version:0,expected_revision:staged.revision,confirm_rights:true,presentation:confirmed},{token:f.token({aal:'aal1'})})).status,200);
  assert.equal((await f.send('/work/'+w.id+'/presentation',{version:0,expected_revision:prior.revision,confirm_rights:true,presentation:confirmed})).body.error,'STALE_PRESENTATION');
  const accepted=await f.send('/work/'+w.id+'/presentation',{version:0,expected_revision:staged.revision,confirm_rights:true,presentation:confirmed});assert.equal(accepted.status,200);assert.equal(accepted.body.state.drafts[0].presentation.cover.rights_confirmed,true);
  // Upload cannot substitute a different rights basis after confirmation either.
  const wrong=form(),meta=JSON.parse(wrong.get('metadata'));meta.cover.attribution.rights_basis='owned';wrong.set('metadata',JSON.stringify(meta));assert.notEqual((await f.send('/publication/upload',wrong)).status,200);
  const upload=await f.send('/publication/upload',form());assert.equal(upload.status,200,JSON.stringify(upload.body));await runPrivateAssetInspection({service:f.machine,tokenSource:async()=> 'UNIT_MACHINE',operationId:upload.body.inspection_id});
  assert.equal((await f.pg.query('select count(*)::int n from nyra_inspection.receipts')).rows[0].n,2);assert.deepEqual((await f.pg.query('select * from nyra_inspection.receipts where upload_id=$1',[initial.body.inspection_id])).rows[0],immutable);
 }finally{await f.pg.close();}
});
