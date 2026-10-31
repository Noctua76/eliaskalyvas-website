// Factory unit tests; no real credentials, GitHub jobs or publication acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {composeFinalDelivery} from '../runtime/nyra-edge/final-delivery.mjs';
import {integrationConfiguration} from './fixtures/final-integration.mjs';
import {integrationAPI} from './fixtures/protected-integration.mjs';
import {readState} from './fixtures/protected-delivery.mjs';
const request=path=>new Request('https://unit.invalid/'+path,{method:'POST',headers:{Authorization:'Bearer UNIT_ONLY'},body:'{}'});
function setup({enabled=false,allow=false}={}){
 const publicationPolicy=integrationAPI('publication').policy,inspectionPolicy=integrationAPI('inspection').policy;let calls=0;
 const service=composeFinalDelivery({db:{rpc:async()=>{calls++;throw Error('MUST_NOT_REACH_DB');}},configuration:integrationConfiguration(),publicationPolicy,inspectionPolicy,inspectionVerifier:{verify:async()=>{calls++;throw Error('UNIT_DENIED');},assert:()=>{}},dispatchWorkflow:async()=>{calls++;},getJSON:async()=>{calls++;throw Error('UNIT_DENIED');},keySource:async()=>{throw Error('UNIT_DENIED');},store:{load:async()=>null,consume:async()=>false},pagesAudience:"UNIT_PAGES_AUDIENCE",readPolicyState:role=>readState(role==='publication'?publicationPolicy:inspectionPolicy)(),assertAdministration:async()=>allow,pathScopeAuthority:{forAttempt:async()=>{}},storage:{},quarantine:{},enabled});
 return {service,calls:()=>calls};
}
test('Final machine routes, nudge and recovery remain disabled and do not acquire credentials on import/default construction',async()=>{
 const f=setup();assert.equal((await f.service.delivery(request('delivery/export'))).status,503);assert.equal((await f.service.inspection(request('inspection/claim'))).status,503);await assert.rejects(f.service.nudgeOnce(),/DISABLED/);await assert.rejects(f.service.reconcilePending(),/DISABLED/);assert.equal(f.calls(),0);
});
test('An incomplete live trust gate blocks every active privileged operation before broker/SQL/dispatch',async()=>{
 const f=setup({enabled:true});assert.equal((await f.service.delivery(request('delivery/export'))).status,409);assert.equal((await f.service.inspection(request('inspection/claim'))).status,409);await assert.rejects(f.service.nudgeOnce(),/DISABLED/);await assert.rejects(f.service.reconcilePending(),/DISABLED/);assert.equal(f.calls(),0);
});
