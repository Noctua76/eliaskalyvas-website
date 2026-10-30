// Read-only decisions over authoritative private DB packets. No automatic
// rewriting of immutable code_sha, rights, presentation, attempts or receipts.
import {hashJSON} from '../contract.mjs';
import {inspectionReport} from './inspection.mjs';
import {requireDelivery as need} from './materialize.mjs';
export function reconcileInspection(packet,{activeCodeSHA,now=Date.now()}){
 need(/^[a-f0-9]{40}$/.test(activeCodeSHA)&&Number.isFinite(now),'RECONCILIATION_CONFIG');
 const u=packet?.upload,a=packet?.attempt,r=packet?.receipt;
 need(u&&/^[a-f0-9]{40}$/.test(u.code_sha),'RECONCILIATION_PACKET');
 const result=(action,reason)=>Object.freeze({operationId:u.id,codeSHA:u.code_sha,action,reason,publishing:false});
 if(r){
  need(u.state==='accepted'&&a?.state==='accepted'&&r.upload_id===u.id&&r.attempt_id===a.id&&a.upload_id===u.id&&u.current_attempt===a.id&&hashJSON(r.report)===hashJSON(inspectionReport(packet)),'RECONCILIATION_RECEIPT');
  return result('retain_receipt','immutable_accepted');
 }
 need(u.state!=='accepted','RECONCILIATION_MISSING_RECEIPT');
 if(u.cleared)return result('closed','quarantine_cleared');
 need(Number.isFinite(Date.parse(u.expires_at)),'RECONCILIATION_EXPIRY');
 if(u.state==='failed'||Date.parse(u.expires_at)<=now)return result('cleanup','terminal_or_expired');
 if(u.state==='processing'){
  need(a&&a.id===u.current_attempt&&a.upload_id===u.id&&a.state==='processing'&&Number.isFinite(Date.parse(a.lease_until)),'RECONCILIATION_ATTEMPT');
  if(Date.parse(a.lease_until)>now)return result('wait','unknown_or_interrupted_live_lease');
 }
 if(u.code_sha!==activeCodeSHA)return result('owner_reinitiate','code_rollover_requires_fresh_owner_gate');
 if(u.state==='preparing')return result('wait','upload_not_ready');
 need(['ready','processing'].includes(u.state),'RECONCILIATION_STATE');
 return result('claim_fresh_attempt','server_revalidates_owner_presentation_and_lease');
}
// Separate operator process, not a machine endpoint. loadPacket is a private
// authoritative reader. Existing RPC rechecks expiry/session/receipt state in
// PostgreSQL; old-code cleanup does not need an old-code OIDC credential.
export function createInspectionReconciler({loadPacket,db,quarantine,activeCodeSHA,now=Date.now}){
 return Object.freeze({async reconcile(operationId){
  need(typeof operationId==='string'&&/^[a-f0-9-]{36}$/.test(operationId),'RECONCILIATION_SELECTOR');
  const packet=await loadPacket(operationId);need(packet?.upload?.id===operationId,'RECONCILIATION_PACKET');
  const decision=reconcileInspection(packet,{activeCodeSHA,now:now()});
  if(decision.action!=='cleanup')return decision;
  const call=async cleared=>{const r=await db.rpc('nyra_inspection_cleanup',{p_id:operationId,p_code:packet.upload.code_sha,p_cleared:cleared});need(!r.error,'RECONCILIATION_CLEANUP');};
  await call(false);await quarantine.remove(operationId);await call(true);return {...decision,action:'closed'};
 }});
}
