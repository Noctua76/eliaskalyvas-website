import test from 'node:test';
import assert from 'node:assert/strict';
import {repositoryTrustFixture} from './fixtures/repository-trust.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
import {signingKeySHA256} from '../lib/publication/runtime/repository-policy.mjs';
import {verifyRenewalApproval} from '../lib/publication/runtime/db-renewal-approval.mjs';
import {renewalHistory} from '../ops/acceptance-bootstrap/repository-db-renewal.mjs';
const binding=()=>({bootstrapId:'nyra-acceptance-native-bootstrap',hostname:'nyra-acceptance-native-bootstrap',
 providerResourceId:'615221105',targetSHA256:'1'.repeat(64),machineIdSHA256:'2'.repeat(64),sessionSHA256:'3'.repeat(64),
 sessionId:crypto.randomUUID(),startsAt:new Date(Date.now()-1000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString()});
// Synthetic signer and AAL2 adapter: cryptographic/contract tests only.
test('existing owner authority signs an exact DB session after fresh owner verification',async()=>{
 const f=await repositoryTrustFixture(),b=binding();
 const envelope=await f.source.renew({token:'UNIT_OWNER_AAL2',ownerDecisionId:f.decision.decisionId,binding:b});
 const args={envelope,binding:b,ownerPublicJWK:f.ownerPublicJWK,ownerKeyId:'unit-owner',
  expectedKeySHA256:signingKeySHA256(f.ownerPublicJWK),ownerDecisionId:f.decision.decisionId};
 assert.equal((await verifyRenewalApproval(args)).schema,'nyra.acceptance.db-renewal-approval.v1');
 for(const key of ['providerResourceId','bootstrapId','hostname','targetSHA256','machineIdSHA256','sessionSHA256','sessionId','endsAt']){
  const changed={...b,[key]:key.endsWith('SHA256')?'9'.repeat(64):key==='sessionId'?crypto.randomUUID():key==='providerResourceId'?'615221106':key==='endsAt'?new Date(Date.now()+7200000).toISOString():'nyra-acceptance-other-host'};
  await assert.rejects(verifyRenewalApproval({...args,binding:changed}));
 }
 await assert.rejects(verifyRenewalApproval({...args,now:()=>Date.now()+61000}),/FRESHNESS/);
 await assert.rejects(f.source.renew({token:'WRONG',ownerDecisionId:f.decision.decisionId,binding:b}));
 await assert.rejects(f.source.renew({token:'UNIT_OWNER_AAL2',ownerDecisionId:crypto.randomUUID(),binding:b}));
});
test('permanent replay history rejects A after A then B, and ambiguous SQL states require a new session',()=>{
 const target={bootstrapId:'nyra-acceptance-native-bootstrap'},a=crypto.randomUUID(),b=crypto.randomUUID();
 const state={schema:'nyra.acceptance.db-renewal-state.v1',bootstrapId:target.bootstrapId,targetSHA256:hashJSON(target),
  usedSessionIds:[a,b],sessionId:b,status:'db-updated'};
 for(const sessionId of [a,b])assert.throws(()=>renewalHistory(state,target,{sessionId}),/REPLAY/);
 assert.deepEqual(renewalHistory(state,target,{sessionId:crypto.randomUUID()}),[a,b]);
 assert.throws(()=>renewalHistory({...state,targetSHA256:'0'.repeat(64)},target,{sessionId:crypto.randomUUID()}),/STATE/);
 assert.throws(()=>renewalHistory({...state,usedSessionIds:undefined},target,{sessionId:crypto.randomUUID()}),/STATE/);
});
