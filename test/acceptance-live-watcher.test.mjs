import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveWatcher} from '../ops/acceptance-bootstrap/live-watcher.mjs';

const root='https://api.github.com/repos/Noctua76/eliaskalyvas-website';
const list=root+'/actions/workflows/nyra-live-trust-acceptance.yml/runs?event=workflow_dispatch&branch=main&per_page=100';
const sha='a'.repeat(40),start=Date.parse('2026-10-31T09:00:00Z'),end=start+3600000;
const roles=['build','inspection','publication'];
const run=()=>({id:101,run_attempt:1,path:'.github/workflows/nyra-live-trust-acceptance.yml',event:'workflow_dispatch',
 head_branch:'main',head_sha:sha,repository:{id:1389733212,full_name:'Noctua76/eliaskalyvas-website',owner:{id:217035723}},
 head_repository:{id:1389733212},actor:{id:217035723},triggering_actor:{id:217035723},
 created_at:new Date(start+60000).toISOString(),status:'in_progress',conclusion:null});
const jobs=()=>({total_count:3,jobs:roles.map((role,i)=>({id:401+i,run_id:101,run_attempt:1,head_sha:sha,name:'exact-'+role,status:'in_progress',check_run_url:root+'/check-runs/'+(500+i)}))});
function fixture(){
 let runs=[],theRun=run(),theJobs=jobs(),authority=true,failingRole=null,failRevoke=null;const calls=[],revoked=[];
 const getJSON=async url=>{
  if(url===list)return {total_count:runs.length,workflow_runs:runs};
  if(url===root+'/actions/runs/101')return theRun;
  if(url===root+'/actions/runs/101/attempts/1/jobs?per_page=100')return theJobs;
  throw Error('UNAPPROVED_GITHUB_ROUTE');
 };
 const registrars=Object.fromEntries(roles.map(role=>[role,{
  register:async selector=>{if(failingRole===role)throw Error('REGISTER_FAILURE');calls.push({role,selector});return {...selector,checkRunId:String(500+roles.indexOf(role))};},
  revoke:async selector=>{if(failRevoke===role)throw Error('REVOKE_FAILURE');revoked.push({role,selector});}
 }]));
 const policies=Object.fromEntries(roles.map(role=>[role,{
  jobName:'exact-'+role,repository:'Noctua76/eliaskalyvas-website',ownerId:'217035723',callerSHA:sha
 }]));
 const watcher=createLiveWatcher({getJSON,registrars,policies,assertAdministration:async()=>{
  if(!authority)throw Error('OWNER_GATE');
 },callerSHA:sha,windowStartsAt:new Date(start).toISOString(),
 windowEndsAt:new Date(end).toISOString(),now:()=>start+180000});
 return {watcher,calls,revoked,dispatch:()=>{runs=[run()]},deny:()=>{authority=false},
 alter:(f)=>{theRun={...theRun,...f}},job:(f)=>{theJobs={...theJobs,...f}},
 duplicate:()=>{runs=[run(),{...run(),id:102}]},
  failRegister:role=>{failingRole=role},failRevoke:role=>{failRevoke=role}
 };
}
test('Before owner dispatch, the watcher cannot register or invent a job',async()=>{
 const f=fixture();await f.watcher.arm();const v=await f.watcher.scan();
 assert.equal(v.observed,false);assert.deepEqual(f.calls,[]);assert.equal(f.watcher.state().authorization,false);
});
test('Independent workflow observation registers only exact active jobs, then readiness rechecks GitHub',async()=>{
 const f=fixture();await f.watcher.arm();f.dispatch();await f.watcher.scan();
 assert.equal(f.calls.length,3);assert.equal(await f.watcher.isReady({role:'build',runId:'101',runAttempt:'1'}),true);
 await f.watcher.scan();assert.equal(f.calls.length,3);
 f.deny();assert.equal(await f.watcher.isReady({role:'build',runId:'101',runAttempt:'1'}),false);
 await f.watcher.retire();assert.equal(f.revoked.length,3);
 assert.equal(await f.watcher.isReady({role:'build',runId:'101',runAttempt:'1'}),false);
});
test('Different owner, SHA or multiple dispatches fail closed',async()=>{
 for(const patch of [{actor:{id:2}},{head_sha:'b'.repeat(40)},{repository:{id:1}}]){
  const f=fixture();await f.watcher.arm();f.dispatch();f.alter(patch);
  await assert.rejects(f.watcher.scan(),/WATCHER_/);assert.equal(f.calls.length,0);
 }
 const f=fixture();await f.watcher.arm();f.duplicate();
 await assert.rejects(f.watcher.scan(),/WATCHER_MULTIPLE_DISPATCHES/);
});
test('Watcher does not accept pre-existing runs as new owner dispatch',async()=>{
 const f=fixture();f.dispatch();await f.watcher.arm();
 assert.equal((await f.watcher.scan()).observed,false);
 assert.equal(f.calls.length,0);
});

test('Completed GitHub run retires registered rows immediately and disables readiness',async()=>{
 const f=fixture();await f.watcher.arm();f.dispatch();await f.watcher.scan();
 f.alter({status:'completed',conclusion:'success'});
 const r=await f.watcher.scan();
 assert.equal(r.retired,true);assert.equal(r.completed,true);
 assert.equal(f.revoked.length,3);
 assert.deepEqual(f.watcher.state().registered,[]);
 assert.equal(await f.watcher.isReady({role:'build',runId:'101',runAttempt:'1'}),false);
});
test('Partial registrar failure rolls back already registered jobs and fails closed',async()=>{
 const f=fixture();await f.watcher.arm();f.dispatch();f.failRegister('inspection');
 await assert.rejects(f.watcher.scan(),/REGISTER_FAILURE/);
 assert.equal(f.calls.length,1);
 assert.equal(f.revoked.length,1);
 assert.deepEqual(f.watcher.state().registered,[]);
 assert.equal(await f.watcher.isReady({role:'build',runId:'101',runAttempt:'1'}),false);
});
test('Revocation errors preserve exact pending rows and still deny readiness',async()=>{
 const f=fixture();await f.watcher.arm();f.dispatch();await f.watcher.scan();
 f.failRevoke('broker');
 await assert.rejects(f.watcher.retire(),/WATCHER_RETIRE/);
 assert.equal(f.watcher.state().registered.length,1);
 assert.equal(await f.watcher.isReady({role:'broker',runId:'101',runAttempt:'1'}),false);
 f.failRevoke(null);await f.watcher.retire();
 assert.deepEqual(f.watcher.state().registered,[]);
});
test('Readiness refuses substituted check run, run attempt or workflow job',async()=>{
 const f=fixture();await f.watcher.arm();f.dispatch();await f.watcher.scan();
 assert.equal(await f.watcher.isReady({role:'build',runId:'101',runAttempt:'1'}),true);
 const altered=jobs();
 altered.jobs[0].check_run_url=root+'/check-runs/999';
 f.job({jobs:altered.jobs});
 assert.equal(await f.watcher.isReady({role:'build',runId:'101',runAttempt:'1'}),false);
 f.job({jobs:jobs().jobs});
 assert.equal(await f.watcher.isReady({role:'build',runId:'101',runAttempt:'1'}),true);
 f.job({jobs:jobs().jobs.map((x,i)=>i===0?{...x,run_attempt:2}:x)});
 assert.equal(await f.watcher.isReady({role:'build',runId:'101',runAttempt:'1'}),false);
});
