// NYRA future-host schedule and pre-provision readiness. Offline and non-authorizing.
const DAY=86400000;
const need=(v,c)=>{if(!v)throw Error('CONTINUATION_'+c);};
const timestamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(Date.parse(s)).toISOString()===s;
const shape=(o,keys)=>o&&!Array.isArray(o)&&typeof o==='object'&&Object.keys(o).sort().join('|')===keys.slice().sort().join('|');
export const CONTINUATION=Object.freeze({sourceBaseline:'29a73458d4cd941e5ed514db56dc2c553d041bda',historicalCapture:'b230ef7e092ff661aa2e8fdfc307ef3db5dbdad28c88a051b9aab1474ff5788e',historicalDropletId:'615221104',hostDays:14,executionGoalDays:3,extensionDecisionDay:10,optionalExtensionDays:7});
export function validateContinuationWindow(target,{now=Date.now}={}){
 need(shape(target,['schema','bootstrapId','createdAt','expiresAt','resourceId','authorization']),'TARGET_FIELDS');
 need(target.schema==='nyra.acceptance.continuation.window.v1','TARGET_SCHEMA');
 need(typeof target.bootstrapId==='string'&&/^nyra-acceptance-[a-z0-9-]{6,80}$/.test(target.bootstrapId)&&target.bootstrapId!=='nyra-acceptance-20261102-01','NEW_BOOTSTRAP');
 need(target.resourceId===null&&target.authorization===false,'PRECREATE_ONLY');
 need(timestamp(target.createdAt)&&timestamp(target.expiresAt),'UTC_TIMESTAMP');
 const start=Date.parse(target.createdAt),end=Date.parse(target.expiresAt);
 need(start>=now()&&end-start===CONTINUATION.hostDays*DAY,'EXACT_14_DAYS');
 return Object.freeze({status:'SCHEDULE_PROPOSAL_ONLY',authorization:false,providerCreationApproved:false,proposedStart:target.createdAt,proposedEnd:target.expiresAt,goalReviewAt:new Date(start+3*DAY).toISOString(),extensionDecisionAt:new Date(start+10*DAY).toISOString()});
}
export function preProvisionGate(gates){
 const keys=['approvedSourceProfile','bootstrapOfflineTest','cleanSourceAndBuild','expiryRebootTest','extensionMigrationTest','retirementExactScopeTest','githubAppKeyRotationPlan','newHostTrustEvidencePlan','providerCostReview','ownerCreationApproval'];
 need(shape(gates,keys),'GATE_FIELDS');
 need(keys.every(k=>typeof gates[k]==='boolean'),'GATE_TYPES');
 const missing=keys.filter(k=>k!=='extensionMigrationTest'&&gates[k]!==true);
 return Object.freeze({optionalExtensionReady:gates.extensionMigrationTest,status:missing.length?'NO_GO_PRE_PROVISION':'READY_FOR_SEPARATE_LIVE_REVIEW',missing,authorization:false,providerCreationApproved:false,historical3fReusableAsLiveAuthorization:false});
}
