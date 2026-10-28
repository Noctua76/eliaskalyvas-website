import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryFixture} from './fixtures/delivery.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
import {receiptFor} from './fixtures/phase4b.mjs';
import {validateLiveReceipt} from '../lib/publication/runtime/materialize.mjs';
import {uid} from './fixtures/publication-v1.1.mjs';
import {OWNER,SESSION} from './fixtures/publication-authority.mjs';
const A=uid(8000),B=uid(8001);
test('P4B private delivery schema RLS/invoker ACLs and immutable intent/candidate records',async()=>{
 const f=await deliveryFixture();try{
  const tables=(await f.pg.query("select relname,relrowsecurity from pg_class where relnamespace='nyra_delivery'::regnamespace and relkind='r'")).rows;assert.equal(tables.length,11);assert(tables.every(t=>t.relrowsecurity));
  const funcs=(await f.pg.query("select proname,prosecdef,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated from pg_proc where proname like 'nyra_delivery_%'")).rows;assert.equal(funcs.length,11);assert(funcs.every(f=>!f.prosecdef&&!f.anon&&!f.authenticated));
  await f.register(A);await f.candidate(A);await assert.rejects(f.pg.exec("update nyra_delivery.candidates set manifest_sha256=repeat('0',64)"),/PUB_IMMUTABLE/);
  await f.pg.exec('set role anon');await assert.rejects(f.pg.exec('select * from nyra_delivery.intents'),/permission denied/);await assert.rejects(f.pg.exec('select public.nyra_delivery_enqueue()'),/permission denied/);await f.pg.exec('reset role');
 }finally{await f.pg.close()}
});
test('P4B invoker bootstrap rechecks MFA session, owner and revocation',async()=>{
 const f=await deliveryFixture();try{
  const args={p_owner:OWNER,p_session:SESSION,p_expires:new Date(Date.now()+60000).toISOString(),p_baseline:f.baseline};
  await f.pg.exec("update auth.sessions set aal='aal1'");await assert.rejects(f.call('nyra_delivery_bootstrap',args),/PUB_SESSION_INVALID/);
  await f.pg.exec("update auth.sessions set aal='aal2'; delete from auth.sessions");await assert.rejects(f.call('nyra_delivery_bootstrap',args),/PUB_SESSION_INVALID/);
 }finally{await f.pg.close()}
});
test('P4B durable replay, wrong run/attempt/SHA, stale fence and permit consumption',async()=>{
 const f=await deliveryFixture();try{
  await f.register(A);const c=await f.candidate(A);
  await assert.rejects(f.call('nyra_delivery_materialized',{p_attempt:A,p_fence:c.context.fence-1,p_id:uid(8002),p_source:c.context.source_generation,p_candidate:c.candidate,p_sha:'0'.repeat(64),p_transition_sha:hashJSON(c.candidate.transition),p_intents:c.candidate.intentIds}),/DELIVERY_STALE/);
  for(const [run,attempt,check]of [['101','1','300'],['100','2','300'],['100','1','301']])await assert.rejects(f.machine('export','synthetic-wrong-001',run,attempt,check));
  const result=await f.machine('export');assert.equal(result.candidate.dataset.manifest.generation,2);
  await assert.rejects(f.machine('export'),/duplicate key/);await assert.rejects(f.machine('permit','synthetic-permit-missing'));await f.call('nyra_delivery_artifact',{p_attempt:A,p_fence:c.context.fence,p_candidate:c.id,p_id:uid(8990),p_digest:'b'.repeat(64),p_observation:{manifest_sha256:hashJSON(c.candidate.dataset.manifest),code_sha:'a'.repeat(40)}});const permit=await f.machine('permit','synthetic-permit-001');assert.equal(permit.permit.fence,c.context.fence);
  await assert.rejects(f.machine('permit','synthetic-permit-002'),/DELIVERY_ATTEMPT_STATE/);
  const now=new Date().toISOString(),receipt=receiptFor(c.candidate,{now,attempt:A});validateLiveReceipt(c.candidate,receipt,now);
  await f.call('nyra_delivery_receipt',{p_attempt:A,p_id:receipt.id,p_receipt:receipt,p_transition_sha:hashJSON(c.candidate.transition),p_evidence:{synthetic:true}});
  await f.call('nyra_delivery_receipt',{p_attempt:A,p_id:receipt.id,p_receipt:receipt,p_transition_sha:hashJSON(c.candidate.transition),p_evidence:{synthetic:true}});
  assert.equal((await f.pg.query('select count(*)::int n from nyra_delivery.receipts')).rows[0].n,1);assert.equal((await f.pg.query('select verified_candidate from nyra_delivery.control')).rows[0].verified_candidate,c.id);
  assert.equal((await f.pg.query('select count(*)::int n from nyra_delivery.completed_intents')).rows[0].n,1);assert.equal((await f.pg.query('select verified_live_manifest from nyra_publication_catalog')).rows[0].verified_live_manifest,null);

 }finally{await f.pg.close()}
});
test('P4B lease contention and interrupted/unknown outcomes block reuse until explicit non-delivery proof',async()=>{
 const f=await deliveryFixture();try{
  await f.register(A);await f.register(B,'101','1','301');await f.candidate(A);
  await assert.rejects(f.call('nyra_delivery_claim',{p_id:B}),/DELIVERY_LEASE_BUSY/);
  await f.pg.exec("update nyra_delivery.control set lease_until=clock_timestamp()-interval '1 second'");const expired=await f.call('nyra_delivery_claim',{p_id:B});assert.equal(expired.reconciliation_required,true);
  await assert.rejects(f.machine('export'),/DELIVERY_STALE/);
  await f.call('nyra_delivery_reconcile',{p_attempt:A,p_observation:uid(8100),p_kind:'unknown',p_evidence:{synthetic:true}});await assert.rejects(f.call('nyra_delivery_claim',{p_id:B}),/DELIVERY_RECONCILIATION_REQUIRED/);
  await f.call('nyra_delivery_reconcile',{p_attempt:A,p_observation:uid(8101),p_kind:'never_deployed',p_evidence:{synthetic:true}});const next=await f.call('nyra_delivery_claim',{p_id:B});assert.equal(next.fence,2);
 }finally{await f.pg.close()}
});
test('P4B newly authorized generation invalidates export; enqueue is idempotent',async()=>{
 const f=await deliveryFixture();try{
  await f.register(A);await f.candidate(A);assert.equal(await f.call('nyra_delivery_enqueue'),0);
  const w=await f.work({language:'en'}),asset=await f.asset(),p=await f.prepare(w,asset.body.asset_id);assert.equal((await f.authorize(p)).status,200);
  await assert.rejects(f.machine('export'),/DELIVERY_GENERATION/);
  const state=(await f.pg.query('select snapshot from nyra_publication_releases')).rows;assert.equal(state.length,2);
 }finally{await f.pg.close()}
});

const permitCandidate=async(f,id,c,{run='100',check='300',jti='receipt-tests'}={})=>{
 await f.machine('export',jti+'-export',run,'1',check);await f.call('nyra_delivery_artifact',{p_attempt:id,p_fence:c.context.fence,p_candidate:c.id,p_id:crypto.randomUUID(),p_digest:'b'.repeat(64),p_observation:{manifest_sha256:hashJSON(c.candidate.dataset.manifest),code_sha:'a'.repeat(40)}});await f.machine('permit',jti+'-permit',run,'1',check);
};
const recordCandidate=async(f,id,c,{run='100'}={})=>{
 const now=new Date().toISOString(),receipt=receiptFor(c.candidate,{now,attempt:id});receipt.id=crypto.randomUUID();receipt.github_run_id=run;validateLiveReceipt(c.candidate,receipt,now);
 await f.call('nyra_delivery_receipt',{p_attempt:id,p_id:receipt.id,p_receipt:receipt,p_transition_sha:hashJSON(c.candidate.transition),p_evidence:{synthetic:true}});return receipt;
};
const ownerAction=async(f,action,restore=null)=>{
 const work=(await f.pg.query('select * from nyra_work order by created_at limit 1')).rows[0],asset=(await f.pg.query('select id from nyra_publication_assets limit 1')).rows[0].id,article=(await f.pg.query('select article_id from nyra_publication_articles limit 1')).rows[0].article_id;
 const p=await f.prepare(work,asset,{action,article_id:article,restore_release_id:restore});assert.equal(p.status,200,JSON.stringify(p.body));const result=await f.authorize(p);assert.equal(result.status,200,JSON.stringify(result.body));return p;
};
test('F01 SQL completion preserves never-delivered owner decisions without adding public history',async()=>{
 const f=await deliveryFixture();try{
  const held=(await f.pg.query('select snapshot from nyra_publication_releases')).rows[0].snapshot;
  await ownerAction(f,'withdraw');await f.register(A);const c=await f.candidate(A);assert.deepEqual(c.candidate.dataset,f.baseline);assert.deepEqual(c.candidate.history,[]);assert.equal(c.candidate.intentIds.length,2);
  await permitCandidate(f,A,c);await recordCandidate(f,A,c);
  assert.equal((await f.pg.query('select count(*)::int n from nyra_publication_decisions')).rows[0].n,2);assert.equal((await f.pg.query('select count(*)::int n from nyra_delivery.completed_intents')).rows[0].n,2);
  const control=(await f.pg.query('select * from nyra_delivery.control')).rows[0];assert.deepEqual(control.history,[]);assert.deepEqual(control.mappings,[]);assert.equal(control.baseline.releases.length,0);
  await ownerAction(f,'rollback',held.release.id);await f.register(B,'101','1','301');const next=await f.candidate(B);
  assert.equal(next.context.intentHistory.length,2);assert.equal(next.candidate.dataset.releases[0].authorization.action,'publish');assert.equal(next.candidate.dataset.releases[0].release.sequence,1);assert.notEqual(next.candidate.dataset.releases[0].release.first_published_at,held.release.first_published_at);assert.deepEqual(next.candidate.history,[]);
  await permitCandidate(f,B,next,{run:'101',check:'301',jti:'next-receipt'});await recordCandidate(f,B,next,{run:'101'});assert.equal((await f.pg.query('select count(*)::int n from nyra_publication_decisions')).rows[0].n,3);
 }finally{await f.pg.close()}
});
test('F02 receipt rejects wrong digest and digest of another persisted candidate before any live advancement',async()=>{
 const f=await deliveryFixture();try{
  await f.register(A);const prior=await f.candidate(A);
  await f.call('nyra_delivery_reconcile',{p_attempt:A,p_observation:crypto.randomUUID(),p_kind:'never_deployed',p_evidence:{synthetic:true}});
  await f.register(B,'101','1','301');const c=await f.candidate(B);await permitCandidate(f,B,c,{run:'101',check:'301'});
  const now=new Date().toISOString(),receipt=receiptFor(c.candidate,{now,attempt:B});receipt.github_run_id='101';
  const stored=(await f.pg.query('select transition_sha256,candidate from nyra_delivery.candidates where id=$1',[c.id])).rows[0];assert.equal(stored.transition_sha256,hashJSON(stored.candidate.transition));
  const other=(await f.pg.query('select transition_sha256 from nyra_delivery.candidates where id=$1',[prior.id])).rows[0].transition_sha256;assert.notEqual(other,stored.transition_sha256);
  for(const digest of ['0'.repeat(64),other,null])await assert.rejects(f.call('nyra_delivery_receipt',{p_attempt:B,p_id:receipt.id,p_receipt:receipt,p_transition_sha:digest,p_evidence:{synthetic:true}}),/DELIVERY_TRANSITION_BINDING/);
  assert.equal((await f.pg.query('select count(*)::int n from nyra_delivery.receipts')).rows[0].n,0);assert.equal((await f.pg.query('select verified_candidate from nyra_delivery.control')).rows[0].verified_candidate,null);
  await f.call('nyra_delivery_receipt',{p_attempt:B,p_id:receipt.id,p_receipt:receipt,p_transition_sha:stored.transition_sha256,p_evidence:{synthetic:true}});
  await f.call('nyra_delivery_receipt',{p_attempt:B,p_id:receipt.id,p_receipt:receipt,p_transition_sha:stored.transition_sha256,p_evidence:{synthetic:true}});
  await assert.rejects(f.call('nyra_delivery_receipt',{p_attempt:B,p_id:receipt.id,p_receipt:receipt,p_transition_sha:other,p_evidence:{synthetic:true}}),/DELIVERY_TRANSITION_BINDING/);
  assert.equal((await f.pg.query('select count(*)::int n from nyra_delivery.receipts')).rows[0].n,1);assert.equal((await f.pg.query('select count(*)::int n from nyra_delivery.observations where kind=$1',['verified_live'])).rows[0].n,1);
 }finally{await f.pg.close()}
});
test('F02 correct receipt identity with different valid transition evidence fails at the trusted store boundary',async()=>{
 const f=await deliveryFixture();try{
  const {supabaseDeliveryStore,observationVerifier,receiptRecorder}=await import('../lib/publication/runtime/adapters.mjs');const {releaseFixture}=await import('./fixtures/publication-v1.1.mjs');
  await f.register(A);const c=await f.candidate(A);await permitCandidate(f,A,c);
  const candidate={...structuredClone(c.candidate),id:c.id},now=new Date().toISOString(),receipt=receiptFor(candidate,{now,attempt:A}),attempt={id:A,runId:'100',runAttempt:'1',codeSHA:'a'.repeat(40)};
  // Both evidence chains validate structurally, but only the persisted one was
  // selected by the trusted materializer. A foreign history entry changes its digest.
  candidate.transition.steps[0].history.push(releaseFixture({locale:'en',offset:50000}));validateLiveReceipt(candidate,receipt,now);
  const observer=observationVerifier({observe:async()=>({runId:'100',runAttempt:'1',codeSHA:attempt.codeSHA,candidateId:c.id,kind:'verified_live',deploymentSucceeded:true,deploymentId:receipt.github_deployment_id,observedManifestSHA256:receipt.manifest_sha256,allCanonicalRoutesChecked:true,deploymentRequestedAt:now,deploymentCompletedAt:now,observedAt:now})});
  const proof=await observer.verify(attempt,candidate);let storageError;
  const store=supabaseDeliveryStore({rpc:async(name,args)=>{try{return {data:await f.call(name,args)}}catch(error){storageError=error;return {error}}}});
  const recorder=receiptRecorder({observer,store});await assert.rejects(recorder.record({attempt,candidate,receipt,proof}),/DELIVERY_STORAGE_UNAVAILABLE/);assert.match(storageError.message,/DELIVERY_TRANSITION_BINDING/);
  assert.equal((await f.pg.query('select count(*)::int n from nyra_delivery.receipts')).rows[0].n,0);
  await recorder.record({attempt,candidate:{...c.candidate,id:c.id},receipt,proof});await recorder.record({attempt,candidate:{...c.candidate,id:c.id},receipt,proof});assert.equal((await f.pg.query('select count(*)::int n from nyra_delivery.receipts')).rows[0].n,1);
 }finally{await f.pg.close()}
});
