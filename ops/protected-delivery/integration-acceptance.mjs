import {readState} from '../../test/fixtures/protected-delivery.mjs';
// Same B2 SQL integration assertions for PGlite and isolated native PG17.
import assert from 'node:assert/strict';
import {createJobRegistrar} from '../../lib/publication/runtime/job-registrar.mjs';
import {composeIdentityBroker,createProtectedInventoryRegistrar} from '../../lib/publication/integration/protected-composition.mjs';
import {integrationAPI,claims} from '../../test/fixtures/protected-integration.mjs';
import {signedOIDC} from '../../test/fixtures/phase4b.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
import {REQUIRED_CHECKS,reviewedDeliveryPolicy} from '../../lib/publication/runtime/delivery-policy.mjs';
export async function acceptProtectedIntegration({registrarQuery,brokerQuery,otherBrokerQuery=brokerQuery}){
 const f=integrationAPI(),clock=()=>Date.now(),signed=await signedOIDC();
 // Distinct identity from the approved 5C-A store acceptance in the same DB.
 for(const key of Object.keys(f.data)){if(key.includes('/100')){f.data[key.replace('/100','/200')]=f.data[key];delete f.data[key];}}
 f.data['/actions/runs/200'].id=200;f.data['/actions/runs/200/attempts/1/jobs?per_page=100'].jobs[0].run_id=200;
 const r=createJobRegistrar({policy:f.policy,readPolicyState:f.readPolicyState,privilege:'build',getJSON:f.getJSON,query:registrarQuery,requiredChecks:REQUIRED_CHECKS,now:clock});
 await r.register({runId:'200',runAttempt:'1'});
 await assert.rejects(r.register({runId:'200',runAttempt:'1'}));
 const broker=query=>composeIdentityBroker({configuration:f.configuration,readPolicyState:f.readPolicyState,privilege:'build',getJSON:f.getJSON,brokerQuery:query,keySource:async()=>({keys:[signed.jwk]}),now:clock}),a=broker(brokerQuery),b=broker(otherBrokerQuery);
 const token=()=>signed.sign({...claims(f.policy),run_id:'200',jti:crypto.randomUUID(),iat:Math.floor(clock()/1000),nbf:Math.floor(clock()/1000),exp:Math.floor(clock()/1000)+300});
 const replay=await token(),race=await Promise.allSettled([a.authorize(replay),b.authorize(replay)]);assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
 const grant=await a.authorize(await token()),record={schema_version:'nyra.normal.provenance.v1',inventory:{schema_version:'nyra.public.paths.v1',codeSHA:grant.codeSHA,configurationSHA256:'1'.repeat(64),paths:['index.html']},builder:{...Object.fromEntries(['privilege','codeSHA','workflowSHA','jobWorkflowSHA','runId','runAttempt','checkRunId','governance','policySHA256'].map(k=>[k,grant.registration[k]])),assurance:'unprotected_ci'},files:[{path:'index.html',sha256:'2'.repeat(64),bytes:10}]};
 const capture=createProtectedInventoryRegistrar({authorizeBuild:async value=>{assert.equal(value,grant);return grant;},revalidateBuild:a.revalidate,registrarQuery,rebuild:async()=>({record,digest:hashJSON(record)})});
 const approved=await capture.capture(grant);assert.equal(approved.codeSHA,grant.codeSHA);
 const pub=composeIdentityBroker({configuration:f.configuration,readPolicyState:readState(reviewedDeliveryPolicy(f.configuration,'publication')),privilege:'publication',getJSON:f.getJSON,brokerQuery,keySource:async()=>({keys:[signed.jwk]}),now:clock});
 assert.equal((await pub.inventoryAuthority(record.inventory.configurationSHA256).forAttempt({codeSHA:grant.codeSHA})).codeSHA,grant.codeSHA);
 await assert.rejects(capture.capture(grant)); // immutable duplicate
 await assert.rejects(brokerQuery('insert into nyra_trust.inventories select * from nyra_trust.inventories'));
 await r.revoke({runId:'200',runAttempt:'1',checkRunId:'300'});
 await assert.rejects(a.authorize(await token()),/INACTIVE/);await assert.rejects(capture.capture(grant),/INACTIVE/);
 // Explicit policy retirement revokes still-active registrations as well.
 f.data['/actions/runs/200'].run_attempt=2;
 f.data['/actions/runs/200/attempts/2/jobs?per_page=100']=structuredClone(f.data['/actions/runs/200/attempts/1/jobs?per_page=100']);
 f.data['/actions/runs/200/attempts/2/jobs?per_page=100'].jobs[0].run_attempt=2;
 await r.register({runId:'200',runAttempt:'2'});await r.retirePolicy();
 assert((await brokerQuery("select revoked_at from nyra_trust.jobs where run_id='200' and run_attempt='2'")).rows[0].revoked_at);
 return {governancePolicyRetirement:true,registeredFromAPI:true,concurrentReplayWinners:1,protectedInventoryRegisteredAndConsumed:true,brokerCannotRegister:true,revokedCaptureDenied:true,syntheticIdentityOnly:true};
}
