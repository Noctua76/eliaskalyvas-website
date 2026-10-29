import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {deliveryFixture} from './fixtures/delivery.mjs';
import {uid} from './fixtures/publication-v1.1.mjs';
import {createMachineRuntime} from '../lib/publication/runtime/machine.mjs';
const migration=new URL('../supabase/migrations/20261029145714_nyra_protected_delivery_acceptance.sql',import.meta.url);
async function fixture(){const f=await deliveryFixture();await f.pg.exec(await readFile(migration,'utf8'));const id=uid(8100);await f.register(id);const current=await f.candidate(id);await f.machine('export');return {...f,id,current};}
const identity={p_run:'100',p_attempt:'1',p_check:'300',p_sha:'a'.repeat(40)};
const provenance=f=>({p_attempt:f.id,p_candidate:f.current.id,p_fence:f.current.context.fence,p_artifact:'700',p_zip:'1'.repeat(64),p_tar:'2'.repeat(64),p_inventory:'3'.repeat(64)});
const start=()=>({...identity,p_jti:'synthetic-start-jti',p_expires:new Date(Date.now()+240000).toISOString()});
test('prepared native-invoker migration binds provenance, permit and one-shot start transactionally',async()=>{const f=await fixture();try{
 await f.call('nyra_delivery_provenance',provenance(f));await f.call('nyra_delivery_provenance',provenance(f));assert.equal((await f.pg.query('select count(*)::integer n from nyra_delivery.artifacts')).rows[0].n,1);
 await f.machine('permit','synthetic-permit-jti');const result=await f.call('nyra_delivery_start',start());assert.equal(result.artifact_id,'700');assert.equal(result.permit.artifact_sha256,'3'.repeat(64));
 await assert.rejects(f.call('nyra_delivery_start',start()),/DEPLOYMENT_START_STALE/);assert.equal((await f.pg.query('select count(*)::integer n from nyra_delivery.starts')).rows[0].n,1);
 const context=await f.call('nyra_delivery_inspect',identity);assert.equal(context.started,true);assert.equal(context.provenance.github_artifact_id,'700');
 }finally{await f.pg.close();}});
test('failed provenance transaction rolls back artifact insertion and supports exact retry',async()=>{const f=await fixture();try{
 await assert.rejects(f.call('nyra_delivery_provenance',{...provenance(f),p_zip:'wrong'}));assert.equal((await f.pg.query('select count(*)::integer n from nyra_delivery.artifacts')).rows[0].n,0);
 await f.call('nyra_delivery_provenance',provenance(f));await assert.rejects(f.call('nyra_delivery_provenance',{...provenance(f),p_artifact:'701'}),/PROVENANCE_CONFLICT/);
 }finally{await f.pg.close();}});
test('new owner authorization between permit and start invalidates stale generation',async()=>{const f=await fixture();try{
 await f.call('nyra_delivery_provenance',provenance(f));await f.machine('permit','synthetic-permit-jti');
 const w=await f.work({language:'en'}),asset=await f.asset(),p=await f.prepare(w,asset.body.asset_id),a=await f.authorize(p);assert.equal(a.status,200);
 await assert.rejects(f.call('nyra_delivery_start',start()),/DEPLOYMENT_START_STALE/);assert.equal((await f.pg.query('select count(*)::integer n from nyra_delivery.starts')).rows[0].n,0);
 }finally{await f.pg.close();}});
test('dispatch timestamps are database-controlled, immutable and idempotently observed',async()=>{const f=await fixture();try{
 await f.call('nyra_delivery_provenance',provenance(f));await f.machine('permit','synthetic-permit-jti');await f.call('nyra_delivery_start',start());
 await f.call('nyra_delivery_dispatch',{p_attempt:f.id,p_operation:'begin',p_value:'800'});await assert.rejects(f.call('nyra_delivery_dispatch',{p_attempt:f.id,p_operation:'begin',p_value:'800'}));
 await f.call('nyra_delivery_dispatch',{p_attempt:f.id,p_operation:'ack',p_value:'pages-build-sha'});const one=await f.call('nyra_delivery_dispatch',{p_attempt:f.id,p_operation:'succeed'}),two=await f.call('nyra_delivery_dispatch',{p_attempt:f.id,p_operation:'succeed'});assert.equal(one.completedAt,two.completedAt);assert(one.requestedAt<=one.completedAt);assert.equal(one.artifactId,'700');
 await assert.rejects(f.pg.query("update nyra_delivery.dispatches set requested_at=clock_timestamp()"),/IMMUTABLE/);
 }finally{await f.pg.close();}});
test('all new RPCs retain SECURITY INVOKER and deny anon/authenticated execution',async()=>{const f=await fixture();try{
 const names=['nyra_delivery_inspect','nyra_delivery_provenance','nyra_delivery_start','nyra_delivery_dispatch','nyra_delivery_pending','nyra_delivery_nudge'];const r=await f.pg.query("select proname,prosecdef,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated from pg_proc where proname=any($1)",[names]);assert.equal(r.rows.length,6);assert(r.rows.every(x=>!x.prosecdef&&!x.anon&&!x.authenticated));
 await f.pg.exec('set role anon');await assert.rejects(f.call('nyra_delivery_inspect',identity),/permission denied/);await f.pg.exec('reset role');
 }finally{await f.pg.close();}});
test('actual JSON transport objects survive unchanged Phase 1 const-object validation',async()=>{const f=await fixture();try{
 const selected=await f.machine('export','synthetic-transport-jti'),cap={codeSHA:'a'.repeat(40)};const verifier={verify:async()=>cap,assert:x=>x};const runtime=createMachineRuntime({verifier,store:{consumeCurrentExport:async()=>selected}});const exported=await runtime.exportCurrent({token:'synthetic'});assert.deepEqual(exported.dataset,selected.candidate.dataset);
 }finally{await f.pg.close();}});
test('outbox trigger claims each actual owner generation once and records uncertainty durably',async()=>{const f=await fixture();try{const first=await f.call('nyra_delivery_nudge',{p_operation:'claim'});assert(first.id);assert.equal(await f.call('nyra_delivery_nudge',{p_operation:'claim'}),null);await f.call('nyra_delivery_nudge',{p_operation:'outcome',p_id:first.id,p_outcome:'unknown'});assert.equal(await f.call('nyra_delivery_nudge',{p_operation:'claim'}),null);await assert.rejects(f.pg.query("update nyra_delivery.nudges set source_generation=999"),/IMMUTABLE/);}finally{await f.pg.close();}});
