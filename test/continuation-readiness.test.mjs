import test from 'node:test';
import assert from 'node:assert/strict';
import {validateContinuationWindow,preProvisionGate} from '../ops/acceptance-bootstrap/continuation-readiness.mjs';
const start='2026-11-06T09:00:00.000Z',day=86400000;
const proposal=()=>({schema:'nyra.acceptance.continuation.window.v1',bootstrapId:'nyra-acceptance-20261106-02',createdAt:start,expiresAt:new Date(Date.parse(start)+14*day).toISOString(),resourceId:null,authorization:false});
const flags=()=>Object.fromEntries(['approvedSourceProfile','bootstrapOfflineTest','cleanSourceAndBuild','expiryRebootTest','extensionMigrationTest','retirementExactScopeTest','githubAppKeyRotationPlan','newHostTrustEvidencePlan','providerCostReview','ownerCreationApproval'].map(k=>[k,false]));
test('14-day window and 3-day goal, review at day 10, no authority',()=>{const r=validateContinuationWindow(proposal(),{now:()=>Date.parse(start)-1});assert.equal(r.goalReviewAt,'2026-11-09T09:00:00.000Z');assert.equal(r.extensionDecisionAt,'2026-11-16T09:00:00.000Z');assert.equal(r.providerCreationApproved,false);});
test('reject old host, modified window, backdated start and authorization',()=>{for(const mut of [x=>x.bootstrapId='nyra-acceptance-20261102-01',x=>x.resourceId='615221104',x=>x.authorization=true,x=>x.expiresAt=new Date(Date.parse(start)+3*day).toISOString(),x=>x.expiresAt=new Date(Date.parse(start)+21*day).toISOString(),x=>x.extra=true]){const p=proposal();mut(p);assert.throws(()=>validateContinuationWindow(p,{now:()=>Date.parse(start)-1}),/CONTINUATION_/);}assert.throws(()=>validateContinuationWindow(proposal(),{now:()=>Date.parse(start)+1}),/CONTINUATION_/);});
test('pre-provision fails closed until all gates reviewed',()=>{const r=preProvisionGate(flags());assert.equal(r.missing.length,9);assert.equal(r.status,'NO_GO_PRE_PROVISION');assert.equal(r.authorization,false);assert.throws(()=>preProvisionGate({...flags(),extra:true}),/CONTINUATION_GATE_FIELDS/);});
test('even completed checklist does not authorize resource creation',()=>{const g=Object.fromEntries(Object.keys(flags()).map(k=>[k,true]));const r=preProvisionGate(g);assert.equal(r.status,'READY_FOR_SEPARATE_LIVE_REVIEW');assert.equal(r.providerCreationApproved,false);assert.equal(r.historical3fReusableAsLiveAuthorization,false);});

test('optional extension failure does not block initial 14-day review or authorize creation',()=>{
 const gates=Object.fromEntries(Object.keys(flags()).map(k=>[k,true]));gates.extensionMigrationTest=false;
 const r=preProvisionGate(gates);
 assert.equal(r.status,'READY_FOR_SEPARATE_LIVE_REVIEW');assert.deepEqual(r.missing,[]);
 assert.equal(r.optionalExtensionReady,false);assert.equal(r.providerCreationApproved,false);
 gates.expiryRebootTest=false;
 assert.equal(preProvisionGate(gates).status,'NO_GO_PRE_PROVISION');
});
