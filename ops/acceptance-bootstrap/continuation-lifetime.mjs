// Proposed lifecycle contract for the NEXT acceptance host. Pure/offline;
// never a replacement for host-bound authorization, install or expiry enforcement.
import {createHash} from 'node:crypto';
const DAY=86400000;
const need=(v,c)=>{if(!v)throw Error('LIFETIME_'+c);};
const iso=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(Date.parse(s)).toISOString()===s;
const keys=(o,ks)=>o&&!Array.isArray(o)&&typeof o==='object'&&Object.keys(o).sort().join('|')===ks.slice().sort().join('|');
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const DAYS=Object.freeze({host:14,decision:10,extension:7,goal:3});
export function proposeLifetime({bootstrapId,createdAt,now=Date.now}){
 need(typeof bootstrapId==='string'&&/^nyra-acceptance-[a-z0-9-]{6,80}$/.test(bootstrapId)&&bootstrapId!=='nyra-acceptance-20261102-01','NEW_HOST');
 need(iso(createdAt)&&Date.parse(createdAt)>=now(),'START');
 const start=Date.parse(createdAt);
 const outcome={schema:'nyra.acceptance.continuation.lifetime.v1',bootstrapId,createdAt,
  expiresAt:new Date(start+14*DAY).toISOString(),
  extensionDecisionAt:new Date(start+10*DAY).toISOString(),
  executionGoalAt:new Date(start+3*DAY).toISOString(),authorization:false};
 return Object.freeze({...outcome,proposalSHA256:digest(outcome)});
}
export function validateSession({lifetime,sessionStart,sessionEnd,now=Date.now}){
 need(lifetime?.schema==='nyra.acceptance.continuation.lifetime.v1'&&lifetime.authorization===false,'PROPOSAL');
 const {proposalSHA256,...source}=lifetime;
 need(proposalSHA256===digest(source)&&iso(lifetime.createdAt)&&iso(lifetime.expiresAt)
  &&Date.parse(lifetime.expiresAt)-Date.parse(lifetime.createdAt)===14*DAY,'HOST_WINDOW');
 need(iso(sessionStart)&&iso(sessionEnd),'SESSION_TIME');
 const a=Date.parse(sessionStart),b=Date.parse(sessionEnd),t=now();
 need(a>=Date.parse(lifetime.createdAt)&&a<=t&&t<b&&b<=Date.parse(lifetime.expiresAt)&&b-a<=DAY,'SESSION_WINDOW');
 return Object.freeze({status:'TIME_BOUND_ONLY',sessionEndsAt:sessionEnd,authorization:false,ownerMFAValidated:false,oidcValidated:false});
}
export function proposeExtension({lifetime,decisionAt,ownerApproved=false}){
 need(lifetime?.schema==='nyra.acceptance.continuation.lifetime.v1'&&lifetime.authorization===false,'HOST');
 const {proposalSHA256,...source}=lifetime;
 need(proposalSHA256===digest(source)&&iso(lifetime.createdAt)&&iso(lifetime.expiresAt)
  &&Date.parse(lifetime.expiresAt)-Date.parse(lifetime.createdAt)===14*DAY,'HOST_PIN');
 need(iso(decisionAt)&&Date.parse(decisionAt)>=Date.parse(lifetime.extensionDecisionAt)&&
  Date.parse(decisionAt)<Date.parse(lifetime.expiresAt)-DAY,'DECISION_WINDOW');
 need(ownerApproved===true,'SEPARATE_OWNER_DECISION_REQUIRED');
 const next={schema:'nyra.acceptance.continuation.extension.proposal.v1',
  bootstrapId:lifetime.bootstrapId,oldExpiresAt:lifetime.expiresAt,
  proposedExpiresAt:new Date(Date.parse(lifetime.expiresAt)+7*DAY).toISOString(),
  previousProposalSHA256:proposalSHA256,authorization:false,executionApproved:false};
 return Object.freeze({...next,proposalSHA256:digest(next)});
}
