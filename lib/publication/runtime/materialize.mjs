// Private delivery projection, not owner authorization and not a public loader.
import {randomUUID} from 'node:crypto';
import {canonicalize,hashJSON,approvalPayload,releaseReference,validatePublicationSet,validateTransition,validateReceipt,validateDeploymentTiming,isUTC} from '../contract.mjs';
export class DeliveryError extends Error{constructor(code){super(code);this.code=code;}}
export const requireDelivery=(ok,code)=>{if(!ok)throw new DeliveryError(code)};
const clone=v=>structuredClone(v);
// The trusted store supplies the baseline, full history and ALL queued intents.
// Request callers never select an intent, release, generation or restore target.
export function materializeQueued({baseline,history,intents,heldMappings=[],now,ids=randomUUID}){
 requireDelivery(isUTC(now)&&Array.isArray(history)&&Array.isArray(intents),'DELIVERY_CONTEXT');
 let current=clone(baseline),past=clone(history),steps=[],mapping=new Map(heldMappings.map(m=>[m.held,m.materialized]));validatePublicationSet(current,{now});
 for(const r of [...past,...current.releases])mapping.set(r.release.id,r.release.id);
 for(let i=0;i<intents.length;i++){
  const intent=intents[i],source=intent.release,event=intent.event;
  requireDelivery(intent.decision_id&&event&&intent.decision_authorization_id===event.authorization_id,'INTENT_PROVENANCE');
  requireDelivery(event.authorized_at===intent.publication_authorized_at&&intent.human_approved_at<=intent.publication_authorized_at,'INTENT_TIME');
  const issued=new Date(Date.parse(now)-(intents.length-i-1)).toISOString();
  requireDelivery(issued>=intent.publication_authorized_at,'MATERIALIZATION_CLOCK');
  const old=current.releases.find(r=>r.variant_id===event.variant_id);
  // Persisted intent pointers may refer to a held proposal. The registry maps
  // that proposal to its actual immutable materialization, never to caller data.
  const target=event.target_release_id===null?null:mapping.get(event.target_release_id);
  requireDelivery(event.action==='publish'||target,'UNMAPPED_INTENT_TARGET');
  let fresh=null;
  if(event.action!=='withdraw'){
   requireDelivery(source&&source.authorization.id===event.authorization_id&&hashJSON(approvalPayload(source))===intent.approved_payload_sha256&&source.authorization.approved_payload_sha256===intent.approved_payload_sha256,'APPROVED_PAYLOAD_MISMATCH');
   requireDelivery(source.authorization.human_approved_at===intent.human_approved_at&&source.authorization.publication_authorized_at===intent.publication_authorized_at,'APPROVAL_TIME_CHANGED');
   fresh=clone(source);
   // New candidate IDs, never overwrite/reuse the held proposal or an aborted
   // candidate. Human approval times and approved payload stay unchanged.
   fresh.authorization.id=ids();
   const prior=old||past.filter(r=>r.variant_id===source.variant_id).sort((a,b)=>b.release.sequence-a.release.sequence)[0];
   const restore=event.action==='rollback'?mapping.get(event.restores_release_id):null;
   requireDelivery(event.action!=='rollback'||restore,'UNMAPPED_ROLLBACK');
   fresh.release={id:ids(),sequence:event.action==='publish'?1:(prior?.release.sequence||0)+1,replaces_release_id:event.action==='publish'?null:target,restores_release_id:restore||null,release_issued_at:issued,first_published_at:prior?.release.first_published_at||issued,modified_at:issued};
   requireDelivery(fresh.release.id!==source.release.id&&fresh.authorization.id!==source.authorization.id,'MATERIALIZATION_ID_REUSE');
   mapping.set(source.release.id,fresh.release.id);
  }else requireDelivery(!source&&old&&old.release.id===target&&intent.target_snapshot?.release.id===event.target_release_id&&hashJSON(intent.target_snapshot)===intent.approved_payload_sha256,'WITHDRAWAL_TARGET');
  const e={...clone(event),id:ids(),expected_generation:current.manifest.generation,expected_manifest_sha256:hashJSON(current.manifest),authorization_id:fresh?.authorization.id||ids(),target_release_id:target};
  if(fresh)e.new_release=releaseReference(fresh);
  if(event.action==='rollback')e.restores_release_id=fresh.release.restores_release_id;
  let withdrawn=current.manifest.withdrawn_variants.filter(w=>event.action!=='rollback'||w.variant_id!==event.variant_id);
  if(event.action==='withdraw')withdrawn.push({article_id:event.article_id,variant_id:event.variant_id,locale:event.locale,event_id:e.id,withdrawn_at:e.authorized_at,target_release_id:target});
  const releases=current.releases.filter(r=>r.variant_id!==event.variant_id);if(fresh)releases.push(fresh);
  const next={manifest:{...clone(current.manifest),manifest_id:ids(),generation:current.manifest.generation+1,previous_manifest_sha256:hashJSON(current.manifest),issued_at:issued,active_releases:releases.map(releaseReference),withdrawn_variants:withdrawn},releases};
  validateTransition(current,next,[e],{now,history:past});
  steps.push({next:clone(next),events:[e],history:clone(past)});
  for(const r of current.releases)if(!past.some(x=>x.release.id===r.release.id))past.push(clone(r));
  current=next;
 }
 return {dataset:current,transition:{previous:clone(baseline),steps},history:past,mappings:[...mapping].map(([held,materialized])=>({held,materialized})),intentIds:intents.map(i=>i.decision_id)};
}
export function validateCandidateStart(candidate,now){
 // This uses the same full transition evidence as F01, not caller newReleases.
 const previous=candidate.transition.previous;let cursor=previous;
 for(const step of candidate.transition.steps){validateTransition(cursor,step.next,step.events,{now,history:step.history});cursor=step.next;}
 requireDelivery(canonicalize(cursor)===canonicalize(candidate.dataset),'CANDIDATE_TRANSITION');
 const known=new Set(previous.releases.map(r=>r.release.id));
 validateDeploymentTiming(candidate.dataset.releases.filter(r=>!known.has(r.release.id)),{now,phase:'start'});return candidate;
}
export function validateLiveReceipt(candidate,receipt,now){
 validateReceipt(receipt,{manifest:candidate.dataset.manifest,now,transition:candidate.transition});
 return receipt;
}
