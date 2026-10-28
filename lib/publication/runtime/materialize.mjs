// Private delivery projection, not owner authorization and not a public loader.
import {randomUUID} from 'node:crypto';
import {canonicalize,hashJSON,approvalPayload,releaseReference,validateRelease,validatePublicationSet,validateTransition,validateReceipt,validateDeploymentTiming,isUTC} from '../contract.mjs';
export class DeliveryError extends Error{constructor(code){super(code);this.code=code;}}
export const requireDelivery=(ok,code)=>{if(!ok)throw new DeliveryError(code)};
const clone=v=>structuredClone(v);
// The trusted store supplies the baseline, full history and ALL queued intents.
// Request callers never select an intent, release, generation or restore target.
export function materializeQueued({baseline,history,intents,intentHistory=[],heldMappings=[],now,ids=randomUUID}){
 requireDelivery(isUTC(now)&&Array.isArray(history)&&Array.isArray(intents)&&Array.isArray(intentHistory),'DELIVERY_CONTEXT');
 validatePublicationSet(baseline,{now});
 // Only the trusted verified-live ledger is public history. Completed private
 // intents are separate evidence, including decisions whose payload NEVER lived.
 for(const r of history)validateRelease(r,{now});
 const past=clone(history),verified=new Map([...past,...baseline.releases].map(r=>[r.release.id,r]));
 const mapping=new Map(heldMappings.map(m=>[m.held,m.materialized]));
 for(const target of mapping.values())requireDelivery(verified.has(target),'UNVERIFIED_HISTORY_MAPPING');
 for(const r of verified.values())mapping.set(r.release.id,r.release.id);
 const proposals=new Map(),state=new Map(),selected=new Map();
 const sameVariant=(r,e)=>r&&r.variant_id===e.variant_id&&r.article_id===e.article_id&&r.locale===e.locale;
 const resolve=id=>proposals.get(id)||verified.get(mapping.get(id));
 const bound=(r,id)=>r&&(r.release.id===id||mapping.get(id)===r.release.id);
 function replay(intent,pending){
  const source=intent.release,event=intent.event;
  requireDelivery(intent.decision_id&&event&&intent.decision_authorization_id===event.authorization_id,'INTENT_PROVENANCE');
  requireDelivery(event.authorized_at===intent.publication_authorized_at&&intent.human_approved_at<=intent.publication_authorized_at&&intent.publication_authorized_at<=now,'INTENT_TIME');
  let previous=state.get(event.variant_id);
  if(!previous){
   const live=baseline.releases.find(r=>r.variant_id===event.variant_id);
   const last=[...verified.values()].filter(r=>r.variant_id===event.variant_id).sort((a,b)=>b.release.sequence-a.release.sequence)[0];
   previous={active:live||null,last:last||null};
  }
  const target=event.target_release_id===null?null:resolve(event.target_release_id);
  // Initial history is the complete private decision chain. Its first Publish
 // predates the current public baseline, so do not use that baseline as its target.
  if(!pending&&!state.has(event.variant_id)&&event.action==='publish')previous={active:null,last:null};
  if(event.action==='publish')requireDelivery(event.target_release_id===null&&!previous.active&&!previous.last,'INTENT_TARGET');
  else{
   const expected=event.action==='rollback'?previous.last:previous.active;
   requireDelivery(sameVariant(target,event)&&bound(expected,event.target_release_id),'INTENT_TARGET');
  }
  if(event.action==='withdraw'){
   requireDelivery(!source&&intent.target_snapshot?.release.id===event.target_release_id&&sameVariant(intent.target_snapshot,event)&&hashJSON(intent.target_snapshot)===intent.approved_payload_sha256,'WITHDRAWAL_TARGET');
   state.set(event.variant_id,{active:null,last:previous.last});
  }else{
   requireDelivery(['publish','replace','rollback'].includes(event.action)&&source&&sameVariant(source,event)&&source.authorization.action===event.action&&source.authorization.id===event.authorization_id&&hashJSON(approvalPayload(source))===intent.approved_payload_sha256&&source.authorization.approved_payload_sha256===intent.approved_payload_sha256,'APPROVED_PAYLOAD_MISMATCH');
   validateRelease(source,{now});
   requireDelivery(source.authorization.human_approved_at===intent.human_approved_at&&source.authorization.publication_authorized_at===intent.publication_authorized_at,'APPROVAL_TIME_CHANGED');
   if(event.action==='rollback'){
    const restore=resolve(event.restores_release_id);
    requireDelivery(sameVariant(restore,event)&&source.release.restores_release_id===event.restores_release_id&&source.content_revision.sha256===restore.content_revision.sha256&&source.presentation_revision.sha256===restore.presentation_revision.sha256,'INTENT_ROLLBACK_TARGET');
   }
   proposals.set(source.release.id,source);state.set(event.variant_id,{active:source,last:source});
  }
  if(pending)selected.set(event.variant_id,intent);
 }
 for(const intent of intentHistory)replay(intent,false);
 for(const intent of intents)replay(intent,true);
 let releases=clone(baseline.releases),withdrawn=clone(baseline.manifest.withdrawn_variants),events=[];
 for(const [variant,intent]of selected){
  const event=intent.event,source=state.get(variant).active,old=baseline.releases.find(r=>r.variant_id===variant);
  const prior=[...verified.values()].filter(r=>r.variant_id===variant).sort((a,b)=>b.release.sequence-a.release.sequence)[0];
  // Publish -> Withdraw before first live has no public event/tombstone/history.
  if(!source&&!old)continue;
  let action='withdraw',fresh=null,restore=null;
  if(source){
   const restored=event.action==='rollback'?verified.get(mapping.get(event.restores_release_id)):null;
   restore=restored&&source.content_revision.sha256===restored.content_revision.sha256&&source.presentation_revision.sha256===restored.presentation_revision.sha256?restored:null;
   action=!prior?'publish':restore?'rollback':'replace';
   // v1.1 cannot resurrect withdrawn public content by Replace or invent a
   // historical Rollback target. Such a request stays private and fails closed.
   requireDelivery(old||!prior||restore,'UNVERIFIED_ROLLBACK_TARGET');
   fresh=clone(source);fresh.authorization.id=ids();fresh.authorization.action=action;
   fresh.release={id:ids(),sequence:prior?prior.release.sequence+1:1,replaces_release_id:prior?.release.id||null,restores_release_id:restore?.release.id||null,release_issued_at:now,first_published_at:prior?.release.first_published_at||now,modified_at:now};
   requireDelivery(fresh.release.id!==source.release.id&&fresh.authorization.id!==source.authorization.id,'MATERIALIZATION_ID_REUSE');
   mapping.set(source.release.id,fresh.release.id);
  }
  const e={...clone(event),id:ids(),action,expected_generation:baseline.manifest.generation,expected_manifest_sha256:hashJSON(baseline.manifest),authorization_id:fresh?.authorization.id||ids(),target_release_id:action==='publish'?null:(old||prior).release.id};
  delete e.restores_release_id;delete e.new_release;delete e.approved_payload_sha256;
  if(fresh){e.new_release=releaseReference(fresh);e.approved_payload_sha256=fresh.authorization.approved_payload_sha256;}
  if(action==='rollback')e.restores_release_id=restore.release.id;
  if(action==='rollback')withdrawn=withdrawn.filter(w=>w.variant_id!==variant);
  if(action==='withdraw')withdrawn.push({article_id:event.article_id,variant_id:variant,locale:event.locale,event_id:e.id,withdrawn_at:e.authorized_at,target_release_id:old.release.id});
  releases=releases.filter(r=>r.variant_id!==variant);if(fresh)releases.push(fresh);events.push(e);
 }
 let current=clone(baseline),steps=[];
 if(events.length){
  current={manifest:{...clone(baseline.manifest),manifest_id:ids(),generation:baseline.manifest.generation+1,previous_manifest_sha256:hashJSON(baseline.manifest),issued_at:now,active_releases:releases.map(releaseReference),withdrawn_variants:withdrawn},releases};
  validateTransition(baseline,current,events,{now,history:past});
  steps=[{next:clone(current),events,history:clone(past)}];
 }
 // Only baseline releases were actually verified before this attempt. Fresh
 // final releases enter the next baseline ONLY after its verified receipt.
 for(const r of baseline.releases)if(!past.some(x=>x.release.id===r.release.id))past.push(clone(r));
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
