import test from 'node:test';
import assert from 'node:assert/strict';
import {createOIDCVerifier,githubKeySource} from '../lib/publication/runtime/oidc.mjs';
import {materializeQueued,validateCandidateStart,validateLiveReceipt} from '../lib/publication/runtime/materialize.mjs';
import {createMachineRuntime} from '../lib/publication/runtime/machine.mjs';
import {observationVerifier,receiptRecorder,privateAssetStorage,byteHash} from '../lib/publication/runtime/adapters.mjs';
import {canonicalize,hashJSON,validatePublicationSet,approvalPayload} from '../lib/publication/contract.mjs';
import {queuedFixture,receiptFor,signedOIDC,policy,CLOCK} from './fixtures/phase4b.mjs';
import {replacement,eventFixture,uid} from './fixtures/publication-v1.1.mjs';
const signed=await signedOIDC();
const verifier=(facts=signed.facts)=>createOIDCVerifier({policy,keySource:async()=>({keys:[signed.jwk]}),jobFacts:async()=>facts,now:()=>Date.parse(CLOCK)});
test('P4B real RSA signature, exact trust and verifier capability',async()=>{
 const v=verifier(),token=await signed.sign(),cap=await v.verify(token);assert.equal(cap.runId,'100');assert.equal(v.assert(cap),cap);assert.throws(()=>v.assert({...cap}),/UNVERIFIED_MACHINE/);
 const parts=token.split('.');parts[1]=Buffer.from(JSON.stringify({...signed.claims,repository_id:'999'})).toString('base64url');await assert.rejects(v.verify(parts.join('.')),/JWT_SIGNATURE/);
});
for(const [claim,value]of Object.entries({iss:'https://wrong.example',aud:'other',sub:'wrong-subject',repository_id:'999',repository_owner_id:'999',repository:'wrong/repo',ref:'refs/heads/evil',ref_type:'tag',environment:'wrong',workflow_ref:'wrong',workflow_sha:'b'.repeat(40),job_workflow_ref:'wrong',job_workflow_sha:'c'.repeat(40),event_name:'pull_request',runner_environment:'self-hosted',run_id:'101',run_attempt:'2',check_run_id:'301',sha:'b'.repeat(40),iat:Math.floor(Date.parse(CLOCK)/1000)+1,nbf:Math.floor(Date.parse(CLOCK)/1000)+1,exp:Math.floor(Date.parse(CLOCK)/1000),jti:''}))test('P4B OIDC rejects wrong '+claim,async()=>assert.rejects(verifier().verify(await signed.sign({[claim]:value}))));
for(const [key,value]of Object.entries({alg:'none',kid:'unknown',typ:'other',jku:'https://evil.example/jwks',crit:['x']}))test('P4B rejects JWT header '+key,async()=>assert.rejects(verifier().verify(await signed.sign({}, {[key]:value}))));
test('P4B missing job context, completed job, wrong name and JWKS unavailable fail closed',async()=>{
 for(const f of [null,{...signed.facts,status:'completed'},{...signed.facts,jobName:'other'}])await assert.rejects(verifier(f).verify(await signed.sign()));
 const source=githubKeySource({fetcher:async()=>{throw Error('offline')}});await assert.rejects(source());
 const v=createOIDCVerifier({policy,keySource:source,jobFacts:async()=>signed.facts,now:()=>Date.parse(CLOCK)});await assert.rejects(v.verify(await signed.sign()),/OIDC_UNAVAILABLE/);
});
test('P4B materializes fresh immutable candidates without altering held proposals or approval',()=>{
 const f=queuedFixture(),before=canonicalize(f),a=materializeQueued(f),b=materializeQueued({...f,now:'2026-10-27T12:01:00.000Z'});
 assert.equal(canonicalize(f),before);assert.notEqual(a.dataset.releases[0].release.id,b.dataset.releases[0].release.id);assert.notEqual(a.dataset.releases[0].authorization.id,b.dataset.releases[0].authorization.id);
 assert.equal(a.dataset.releases[0].authorization.approved_payload_sha256,f.intents[0].approved_payload_sha256);assert.equal(a.dataset.releases[0].authorization.human_approved_at,f.intents[0].human_approved_at);
 validatePublicationSet(a.dataset,{now:CLOCK});validateCandidateStart(a,CLOCK);validateLiveReceipt(a,receiptFor(a),CLOCK);
});
test('P4B F01 derives timing across complete chain; unknown/late delivery cannot claim normal success',()=>{
 const a=materializeQueued(queuedFixture());const late=receiptFor(a);late.verified_live_at='2026-10-27T12:31:00.000Z';assert.throws(()=>validateLiveReceipt(a,late,late.verified_live_at),/DEPLOYMENT_WINDOW_EXPIRED/);
 assert.throws(()=>validateLiveReceipt({...a,transition:{previous:a.transition.previous,steps:[]}},receiptFor(a),CLOCK));
 assert.throws(()=>validateCandidateStart(a,'2026-10-27T12:16:00.000Z'),/DEPLOYMENT_WINDOW_EXPIRED/);
});
test('P4B replacement, withdrawal and explicit historical rollback keep v1.1 lineage',()=>{
 const first=queuedFixture(),a=materializeQueued(first),old=first.intents[0].release;
 const held=replacement(old),e=eventFixture('replace',a.dataset,{fresh:held,target:old});
 const intent={...first.intents[0],decision_id:uid(7001),decision_authorization_id:e.authorization_id,release:held,event:e,approved_payload_sha256:held.authorization.approved_payload_sha256,human_approved_at:held.authorization.human_approved_at,publication_authorized_at:held.authorization.publication_authorized_at};
 const b=materializeQueued({baseline:a.dataset,history:a.history,heldMappings:a.mappings,intents:[intent],now:'2026-10-27T12:01:00.000Z'});
 assert.equal(b.dataset.releases[0].release.first_published_at,a.dataset.releases[0].release.first_published_at);assert.equal(b.dataset.releases[0].release.sequence,2);
 const w=eventFixture('withdraw',b.dataset,{target:held,n:9000});const wi={...intent,decision_id:uid(7002),decision_authorization_id:w.authorization_id,event:w,release:null,target_snapshot:held,approved_payload_sha256:hashJSON(held),publication_authorized_at:w.authorized_at};
 const c=materializeQueued({baseline:b.dataset,history:b.history,heldMappings:b.mappings,intents:[wi],now:'2026-10-27T12:02:00.000Z'});assert.equal(c.dataset.releases.length,0);
 const restored=replacement(held,{rollback:old,n:10000}),re=eventFixture('rollback',c.dataset,{fresh:restored,target:held,restore:old,n:10001});const ri={...intent,decision_id:uid(7003),decision_authorization_id:re.authorization_id,event:re,release:restored,approved_payload_sha256:restored.authorization.approved_payload_sha256,human_approved_at:restored.authorization.human_approved_at,publication_authorized_at:restored.authorization.publication_authorized_at};
 const d=materializeQueued({baseline:c.dataset,history:c.history,heldMappings:c.mappings,intents:[ri],now:'2026-10-27T12:03:00.000Z'});assert.equal(d.dataset.releases[0].release.sequence,3);assert.equal(d.dataset.releases[0].release.restores_release_id,a.dataset.releases[0].release.id);
});
test('P4B source tampering and arbitrary machine dataset selectors fail closed',async()=>{
 const f=queuedFixture();f.intents[0].release.content.title='tampered';assert.throws(()=>materializeQueued(f),/APPROVED_PAYLOAD_MISMATCH/);
 const machine=createMachineRuntime({verifier:verifier(),store:{}});for(const k of ['release','generation','rollback','candidate'])await assert.rejects(machine.exportCurrent({token:'x',[k]:'caller-selected'}),/MACHINE_SELECTOR_FORBIDDEN/);
});
test('P4B machine selects only current storage dataset and propagates replay denial',async()=>{
 const candidate=materializeQueued(queuedFixture()),seen=new Set();const machine=createMachineRuntime({verifier:verifier(),clock:()=>CLOCK,store:{consumeCurrentExport:async c=>{if(seen.has(c.jti))throw Error('REPLAY');seen.add(c.jti);return {candidate,manifestSHA256:hashJSON(candidate.dataset.manifest),capability:{}}}}});
 const token=await signed.sign();assert.equal(canonicalize((await machine.exportCurrent({token})).dataset),canonicalize(candidate.dataset));await assert.rejects(machine.exportCurrent({token}),/REPLAY/);
});
test('P4B unknown observations cannot prove non-delivery and forged proof cannot advance live',async()=>{
 const candidate=materializeQueued(queuedFixture()),attempt={id:uid(7100),runId:'100',runAttempt:'1',codeSHA:'a'.repeat(40)},c={...candidate,id:uid(7200)};
 const facts={runId:'100',runAttempt:'1',codeSHA:attempt.codeSHA,candidateId:c.id,kind:'never_deployed',runTerminal:true,noDeploymentCreated:false,noDeploymentInProgress:true,publicManifestUnchanged:true};
 await assert.rejects(observationVerifier({observe:async()=>facts}).verify(attempt,c),/UNPROVEN_NON_DELIVERY/);
 const observer=observationVerifier({observe:async()=>({...facts,kind:'verified_live',deploymentSucceeded:true,deploymentId:'200',observedManifestSHA256:hashJSON(c.dataset.manifest),allCanonicalRoutesChecked:true,deploymentRequestedAt:CLOCK,deploymentCompletedAt:CLOCK,observedAt:CLOCK})}),proof=await observer.verify(attempt,c);let writes=0;
 const recorder=receiptRecorder({observer,clock:()=>CLOCK,store:{recordVerified:async()=>{writes++}}});await assert.rejects(recorder.record({attempt,candidate:c,receipt:receiptFor(c),proof:{...proof}}),/UNVERIFIED_OBSERVER/);await assert.rejects(recorder.record({attempt,candidate:c,receipt:{...receiptFor(c),deployment_requested_at:'2026-10-27T11:59:00.000Z'},proof}),/RECEIPT_OBSERVATION/);await recorder.record({attempt,candidate:c,receipt:receiptFor(c),proof});assert.equal(writes,1);
});
test('P4B controlled asset store checks actual stored bytes, refuses invalid hashes and never overwrites',async()=>{
 const bytes=new Uint8Array([1,2,3]),hash=await byteHash(bytes),calls=[];let stored=bytes;
 const storage=privateAssetStorage({storage:{getBucket:async()=>({data:{id:'synthetic-private',public:false}}),from:b=>({upload:async(k,v,o)=>{calls.push({b,k,o});return {data:{}}},download:async()=>({data:new Blob([stored])})})}},{bucket:'synthetic-private'});
 assert.equal(await storage.put(hash,bytes),'sha256/'+hash);assert.equal(calls[0].o.upsert,false);stored=new Uint8Array([9]);await assert.rejects(storage.get(hash),/STORED_ASSET_MISMATCH/);await assert.rejects(storage.get('../private'),/ASSET_HASH/);
});
test('P4B independent EN and ordinary rebuild retain GR bytes and do not retimestamp historic releases',async()=>{
 const {releaseFixture}=await import('./fixtures/publication-v1.1.mjs');
 const f=queuedFixture(),a=materializeQueued(f),en=releaseFixture({locale:'en',offset:1000}),event=eventFixture('publish',a.dataset,{fresh:en,n:20000});
 const intent={decision_id:uid(20001),decision_authorization_id:event.authorization_id,approved_payload_sha256:en.authorization.approved_payload_sha256,human_approved_at:en.authorization.human_approved_at,publication_authorized_at:en.authorization.publication_authorized_at,event,release:en,target_snapshot:null};
 const b=materializeQueued({baseline:a.dataset,history:a.history,heldMappings:a.mappings,intents:[intent],now:'2026-10-27T13:00:00.000Z'});assert.equal(canonicalize(a.dataset.releases[0]),canonicalize(b.dataset.releases[0]));validateLiveReceipt(b,receiptFor(b,{now:'2026-10-27T13:00:00.000Z'}),'2026-10-27T13:00:00.000Z');
 const rebuild=materializeQueued({baseline:b.dataset,history:b.history,heldMappings:b.mappings,intents:[],now:'2026-10-27T15:00:00.000Z'});assert.equal(canonicalize(rebuild.dataset),canonicalize(b.dataset));assert.equal(rebuild.transition.steps.length,0);validateCandidateStart(rebuild,'2026-10-27T15:00:00.000Z');validateLiveReceipt(rebuild,receiptFor(rebuild,{now:'2026-10-27T15:00:00.000Z'}),'2026-10-27T15:00:00.000Z');
});
test('P4B controller rematerializes only full store queue and idempotently reuses stored candidate',async()=>{
 const {createDeliveryController}=await import('../lib/publication/runtime/controller.mjs');const f=queuedFixture();let writes=0,context={...f,fence:3,source_generation:2};
 const controller=createDeliveryController({store:{claim:async()=>context,save:async x=>{writes++;assert.deepEqual(x.candidate.intentIds,f.intents.map(i=>i.decision_id))}},clock:()=>CLOCK});
 const c=await controller.prepare(uid(22000));assert.equal(writes,1);context={existing:c};assert.equal(await controller.prepare(uid(22000)),c);assert.equal(writes,1);context={reconciliation_required:true};await assert.rejects(controller.prepare(uid(22000)),/RECONCILIATION_REQUIRED/);
});
test('P4B GitHub job adapter correlates exact check run and refuses incomplete or rerun metadata',async()=>{
 const {githubJobFacts}=await import('../lib/publication/runtime/github-jobs.mjs');const urls=[];let attempt=1,count=1;
 const reader=githubJobFacts({repository:policy.repository,environment:policy.environment,getJSON:async url=>{urls.push(url);return url.includes('/jobs?')?{total_count:count,jobs:[{check_run_url:'https://api.github.com/repos/test/repo/check-runs/300',status:'in_progress',name:policy.jobName}]}:{id:100,run_attempt:attempt,status:'in_progress',head_sha:'a'.repeat(40),repository:{id:123,owner:{id:456}}}}});
 const r=await reader({runId:'100',runAttempt:'1',checkRunId:'300'});assert.equal(r.repositoryId,'123');assert.equal(r.ownerId,'456');assert(urls.every(u=>u.startsWith('https://api.github.com/repos/test/repo/actions/runs/100')));
 attempt=2;await assert.rejects(reader({runId:'100',runAttempt:'1',checkRunId:'300'}),/JWT_JOB_CORRELATION/);attempt=1;count=101;await assert.rejects(reader({runId:'100',runAttempt:'1',checkRunId:'300'}),/JOB_LOOKUP_INCOMPLETE/);
});
test('P4B artifact permit input binds actual complete file bytes and rejects forged seal/path traversal',async()=>{
 const {artifactSealer,artifactRecorder}=await import('../lib/publication/runtime/artifact.mjs');const sealer=artifactSealer();const files=new Map([['gr/signals/index.html',new Uint8Array([1,2,3])]]),binding={candidateId:uid(28000),attemptId:uid(28001),fence:1,manifestSHA256:'a'.repeat(64),codeSHA:'b'.repeat(40)};
 const first=sealer.seal(files,binding);files.set('gr/signals/index.html',new Uint8Array([4]));assert.notEqual(sealer.seal(files,binding).artifactSHA256,first.artifactSHA256);assert.throws(()=>sealer.seal(new Map([['../private',new Uint8Array([1])]]),binding),/BUILD_FILE/);
 let saved=0;const recorder=artifactRecorder({sealer,store:{recordArtifact:async()=>{saved++}}});await assert.rejects(recorder.record({...first}),/UNVERIFIED_BUILD_ARTIFACT/);await recorder.record(first);assert.equal(saved,1);
});
test('P4B deployment permit is bound to current dataset, artifact, attempt, fence and expiry',async()=>{
 const candidate=materializeQueued(queuedFixture()),capability={candidate_id:uid(29000),attempt_id:uid(29001),fence:4};
 const permit={...capability,code_sha:'a'.repeat(40),manifest_sha256:hashJSON(candidate.dataset.manifest),artifact_sha256:'b'.repeat(64),expires_at:'2026-10-27T12:01:00.000Z'};
 const machine=createMachineRuntime({verifier:verifier(),clock:()=>CLOCK,store:{consumeCurrentPermit:async()=>({candidate,capability,permit})}});const token=await signed.sign();assert.equal(await machine.permit({token}),permit);permit.code_sha='b'.repeat(40);await assert.rejects(machine.permit({token}),/INVALID_DEPLOYMENT_PERMIT/);
 const f=queuedFixture();assert.throws(()=>materializeQueued({...f,ids:()=>f.intents[0].release.release.id}),/MATERIALIZATION_ID_REUSE/);
});

// F01: private decisions are replayed fully, public history advances only to
// the final approved state relative to the actual verified-live baseline.
const intentFor=(release,event,n,target_snapshot=null)=>({decision_id:uid(n),decision_authorization_id:event.authorization_id,approved_payload_sha256:release?.authorization.approved_payload_sha256||hashJSON(target_snapshot),human_approved_at:release?.authorization.human_approved_at||event.authorized_at,publication_authorized_at:event.authorized_at,event,release,target_snapshot});
function pendingLifecycle(){
 const f=queuedFixture(),first=f.intents[0].release;
 const newer=replacement(first,{n:31000});newer.content.title='ONLY_FINAL_APPROVED_TITLE';
 // The exact final content is itself approved, not an automatic draft update.
 newer.content_revision.sha256=hashJSON(newer.content);newer.authorization.approved_payload_sha256=hashJSON(approvalPayload(newer));
 const replace=intentFor(newer,eventFixture('replace',f.baseline,{fresh:newer,target:first,n:31100}),31200);
 const withdraw=intentFor(null,eventFixture('withdraw',f.baseline,{target:first,n:31300}),31400,first);
 const restored=replacement(first,{rollback:first,n:31500});
 const rollback=intentFor(restored,eventFixture('rollback',f.baseline,{fresh:restored,target:first,restore:first,n:31600}),31700);
 return {f,first,newer,replace,withdraw,rollback};
}
test('F01 Publish then Withdraw before first live leaves no public release, tombstone or history',()=>{
 const {f,withdraw}=pendingLifecycle(),input={...f,intents:[...f.intents,withdraw]},before=canonicalize(input),c=materializeQueued(input);
 assert.equal(canonicalize(input),before);assert.deepEqual(c.dataset,f.baseline);assert.deepEqual(c.history,[]);assert.deepEqual(c.transition.steps,[]);assert.deepEqual(c.intentIds,input.intents.map(i=>i.decision_id));assert.equal(c.mappings.length,0);validateLiveReceipt(c,receiptFor(c),CLOCK);
});
test('F01 Publish then Replace before first live publishes only final approval with a fresh first date',()=>{
 const {f,first,newer,replace}=pendingLifecycle(),c=materializeQueued({...f,intents:[...f.intents,replace]});
 const r=c.dataset.releases[0];assert.equal(r.content.title,newer.content.title);assert.equal(r.authorization.approved_payload_sha256,replace.approved_payload_sha256);assert.equal(r.authorization.human_approved_at,replace.human_approved_at);assert.equal(r.authorization.action,'publish');assert.equal(r.release.first_published_at,CLOCK);assert.equal(r.release.sequence,1);assert.equal(r.release.replaces_release_id,null);assert.notEqual(r.release.first_published_at,first.release.first_published_at);assert.deepEqual(c.history,[]);assert.equal(c.transition.steps.length,1);assert.equal(c.dataset.manifest.generation,f.baseline.manifest.generation+1);assert(!c.mappings.some(m=>m.held===first.release.id));validateLiveReceipt(c,receiptFor(c),CLOCK);
});
test('F01 Publish Withdraw Rollback before first live is first publication, never historical rollback',()=>{
 const {f,first,withdraw,rollback}=pendingLifecycle(),c=materializeQueued({...f,intents:[...f.intents,withdraw,rollback]});
 const r=c.dataset.releases[0];assert.equal(r.authorization.action,'publish');assert.equal(r.content_revision.sha256,first.content_revision.sha256);assert.equal(r.release.restores_release_id,null);assert.equal(r.release.first_published_at,CLOCK);assert.equal(r.release.sequence,1);assert.deepEqual(c.history,[]);assert.equal(c.intentIds.length,3);assert.equal(c.transition.steps[0].events[0].action,'publish');validateLiveReceipt(c,receiptFor(c),CLOCK);
});
test('F01 completed never-live decisions remain private evidence for a later first-publication rollback',()=>{
 const {f,first,withdraw,rollback}=pendingLifecycle(),completed=[...f.intents,withdraw],a=materializeQueued({...f,intents:completed});
 const now='2026-10-27T13:00:00.000Z',b=materializeQueued({baseline:a.dataset,history:a.history,heldMappings:a.mappings,intentHistory:completed,intents:[rollback],now});
 assert.equal(b.dataset.releases[0].release.first_published_at,now);assert.equal(b.dataset.releases[0].release.restores_release_id,null);assert.equal(b.dataset.releases[0].content_revision.sha256,first.content_revision.sha256);assert.deepEqual(b.history,[]);validateLiveReceipt(b,receiptFor(b,{now}),now);
});
for(const operation of ['replace','withdraw','rollback'])test('F01 pending GR '+operation+' cannot alter live EN or fabricate GR history',async()=>{
 const {releaseFixture}=await import('./fixtures/publication-v1.1.mjs'),{f,replace,withdraw,rollback}=pendingLifecycle();
 const en=releaseFixture({locale:'en',offset:33000}),enEvent=eventFixture('publish',f.baseline,{fresh:en,n:33100});
 const live=materializeQueued({...f,intents:[intentFor(en,enEvent,33200)]});
 const intents=operation==='replace'?[...f.intents,replace]:operation==='withdraw'?[...f.intents,withdraw]:[...f.intents,withdraw,rollback];
 const now='2026-10-27T13:00:00.000Z',c=materializeQueued({baseline:live.dataset,history:live.history,heldMappings:live.mappings,intents,now});
 assert.equal(canonicalize(c.dataset.releases.find(r=>r.locale==='en')),canonicalize(live.dataset.releases[0]));assert(c.history.every(r=>r.locale==='en'));
 const gr=c.dataset.releases.find(r=>r.locale==='el');if(gr)assert.equal(gr.release.first_published_at,now);else assert(!c.dataset.manifest.withdrawn_variants.length);validateLiveReceipt(c,receiptFor(c,{now}),now);
});
test('F01 multiple pending replacements of a verified release advance public sequence only once',()=>{
 const {f,first}=pendingLifecycle(),live=materializeQueued(f),b=replacement(first,{n:34000}),c=replacement(b,{n:34100});
 const intents=[intentFor(b,eventFixture('replace',f.baseline,{fresh:b,target:first,n:34200}),34300),intentFor(c,eventFixture('replace',f.baseline,{fresh:c,target:b,n:34400}),34500)];
 const now='2026-10-27T13:00:00.000Z',result=materializeQueued({baseline:live.dataset,history:live.history,heldMappings:live.mappings,intents,now});
 assert.equal(result.dataset.releases[0].release.sequence,2);assert.equal(result.dataset.releases[0].release.first_published_at,live.dataset.releases[0].release.first_published_at);assert.deepEqual(result.history,[live.dataset.releases[0]]);assert(!result.mappings.some(m=>m.held===b.release.id));validateLiveReceipt(result,receiptFor(result,{now}),now);
});
test('F01 corrupted superseded approval is rejected before net public projection',()=>{
 const {f,replace}=pendingLifecycle();f.intents[0].release.content.title='unapproved superseded data';assert.throws(()=>materializeQueued({...f,intents:[...f.intents,replace]}),/APPROVED_PAYLOAD_MISMATCH/);
});
test('F02 candidate adapter validates evidence before persisting authoritative transition digest',async()=>{
 const {supabaseDeliveryStore}=await import('../lib/publication/runtime/adapters.mjs');const c=materializeQueued(queuedFixture()),calls=[];
 const store=supabaseDeliveryStore({rpc:async(name,args)=>{calls.push({name,args});return {data:null}}},{clock:()=>CLOCK});
 await store.save({attemptId:uid(35000),fence:1,sourceGeneration:2,id:uid(35001),candidate:c});assert.equal(calls[0].args.p_transition_sha,hashJSON(c.transition));
 const bad=structuredClone(c);bad.transition.steps=[];await assert.rejects(store.save({attemptId:uid(35000),fence:1,sourceGeneration:2,id:uid(35001),candidate:bad}));assert.equal(calls.length,1);
});
test('F01 withdrawn verified lineage cannot invent a historical rollback target from never-live content',()=>{
 const {f,first,newer,replace}=pendingLifecycle(),live=materializeQueued(f);
 const withdraw=intentFor(null,eventFixture('withdraw',f.baseline,{target:newer,n:36000}),36100,newer);
 const hidden=materializeQueued({baseline:live.dataset,history:live.history,heldMappings:live.mappings,intents:[replace,withdraw],now:'2026-10-27T13:00:00.000Z'});
 const rollback=replacement(newer,{rollback:newer,n:36200}),r=intentFor(rollback,eventFixture('rollback',f.baseline,{fresh:rollback,target:newer,restore:newer,n:36300}),36400);
 assert.throws(()=>materializeQueued({baseline:hidden.dataset,history:hidden.history,heldMappings:hidden.mappings,intentHistory:[...f.intents,replace,withdraw],intents:[r],now:'2026-10-27T14:00:00.000Z'}),/UNVERIFIED_ROLLBACK_TARGET/);
 // A real verified target remains restorable, including across the same withdrawal.
 const real=replacement(newer,{rollback:first,n:36500}),ri=intentFor(real,eventFixture('rollback',f.baseline,{fresh:real,target:newer,restore:first,n:36600}),36700);
 const restored=materializeQueued({baseline:hidden.dataset,history:hidden.history,heldMappings:hidden.mappings,intentHistory:[...f.intents,replace,withdraw],intents:[ri],now:'2026-10-27T14:00:00.000Z'});
 assert.equal(restored.dataset.releases[0].release.restores_release_id,live.dataset.releases[0].release.id);assert.equal(restored.dataset.releases[0].release.first_published_at,live.dataset.releases[0].release.first_published_at);validateLiveReceipt(restored,receiptFor(restored,{now:'2026-10-27T14:00:00.000Z'}),'2026-10-27T14:00:00.000Z');
});
