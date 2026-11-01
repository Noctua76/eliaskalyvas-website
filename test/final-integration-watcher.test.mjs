import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntegrationWatcher} from '../lib/publication/integration/watcher.mjs';
import {reviewedIntegrationPolicy} from '../lib/publication/integration/policy.mjs';
import {integrationConfiguration} from './fixtures/final-integration.mjs';
function setup(){const configuration=integrationConfiguration(),roles=['build','inspection','publication'],p=reviewedIntegrationPolicy(configuration,'build'),registered=[],revoked=[],retired=[];let done=false,allowed=true,patch={};const run=()=>({id:100,path:'.github/workflows/pages-orchestrator.yml',head_sha:p.callerSHA,head_branch:'main',repository:{id:1389733212,full_name:p.repository,owner:{id:217035723}},head_repository:{id:1389733212},event:'push',run_attempt:1,status:done?'completed':'in_progress',conclusion:done?'success':null,...patch});
 const getJSON=async url=>url.includes('/workflows/')?{total_count:done?0:1,workflow_runs:done?[]:[run()]}:url.includes('/jobs?')?{total_count:3,jobs:roles.map(role=>({name:reviewedIntegrationPolicy(configuration,role).jobName,status:'in_progress'}))}:run();
 const registrars=Object.fromEntries(roles.map(role=>[role,{register:async x=>{registered.push(role);return {...x,checkRunId:String(300+roles.indexOf(role))};},revoke:async x=>revoked.push(x),retirePolicy:async()=>retired.push(role)}]));
 return {watcher:createIntegrationWatcher({configuration,registrars,getJSON,assertAdministration:async()=>allowed}),registered,revoked,retired,finish:()=>done=true,deny:()=>allowed=false,patch:x=>patch=x};}
test('Operational watcher independently registers current active roles once and revokes completed runs, without dispatch',async()=>{const f=setup();assert.deepEqual(await f.watcher.scan(),{registered:3,dispatchesPerformed:0});await f.watcher.scan();assert.equal(f.registered.length,3);f.finish();assert.equal((await f.watcher.scan()).registered,0);assert.equal(f.revoked.length,3);await f.watcher.close();assert.equal(f.retired.length,3);});
test('Wrong head, retry, repository or lost trust retires every policy and cannot leave an accepting watcher',async()=>{
 for(const patch of [{head_sha:'b'.repeat(40)},{run_attempt:2},{repository:{id:1}},{head_repository:{id:1}}]){const f=setup();f.patch(patch);await assert.rejects(f.watcher.scan(),/WATCHER_RUN/);assert.equal(f.registered.length,0);assert.equal(f.retired.length,3);}
 const f=setup();await f.watcher.scan();f.deny();await assert.rejects(f.watcher.scan(),/ADMINISTRATION/);assert.equal(f.retired.length,3);await assert.rejects(f.watcher.scan(),/CLOSED/);
});
