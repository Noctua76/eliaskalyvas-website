// Server-only application boundary. No HTTP route/listener, credentials or dispatch.
import {validatePublicationSet,hashJSON,parseContractJSON} from '../contract.mjs';
import {validateCandidateStart,requireDelivery} from './materialize.mjs';
export function createMachineRuntime({verifier,store,clock=()=>new Date().toISOString()}){
 return Object.freeze({
  async exportCurrent(input){
   requireDelivery(input&&Object.keys(input).length===1&&Object.hasOwn(input,'token'),'MACHINE_SELECTOR_FORBIDDEN');const {token}=input;
   const c=await verifier.verify(token);verifier.assert(c);
   // Must atomically consume jti, verify registered run/attempt/SHA, lease/fence,
   // current authorized generation and candidate state before returning anything.
   const selected=await store.consumeCurrentExport(c,clock());
   validateCandidateStart(selected.candidate,clock());
   const dataset=parseContractJSON(JSON.stringify(selected.candidate.dataset));validatePublicationSet(dataset,{now:clock()});
   requireDelivery(hashJSON(dataset.manifest)===selected.manifestSHA256,'EXPORT_MANIFEST_MISMATCH');
   return {dataset,capability:selected.capability};
  },
  async permit(input){
   requireDelivery(input&&Object.keys(input).length===1&&Object.hasOwn(input,'token'),'MACHINE_SELECTOR_FORBIDDEN');const {token}=input;
   const c=await verifier.verify(token);verifier.assert(c);
   const current=await store.consumeCurrentPermit(c,clock());validateCandidateStart(current.candidate,clock());
   requireDelivery(current.permit&&current.permit.code_sha===c.codeSHA&&current.permit.manifest_sha256===hashJSON(current.candidate.dataset.manifest)&&/^[a-f0-9]{64}$/.test(current.permit.artifact_sha256)&&current.permit.candidate_id===current.capability.candidate_id&&current.permit.attempt_id===current.capability.attempt_id&&current.permit.fence===current.capability.fence&&Date.parse(current.permit.expires_at)>Date.parse(clock()),'INVALID_DEPLOYMENT_PERMIT');
   return current.permit; // exact current candidate/attempt/fence, not a release selector
  }
 });
}
