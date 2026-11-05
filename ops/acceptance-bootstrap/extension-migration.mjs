// Branch-only operational choreography for a future +7d extension.
// Requires independently bound owner/AAL2 and GitHub Administration callbacks.
// NOT a host executable until the sealed trust adapters and native systemd
// recovery journal are installed and independently accepted.
import {createHash} from 'node:crypto';
import {renderCanonicalExpiryTimer} from './offline-bootstrap.mjs';
import {verifyExtensionAuthority} from './continuation-extension-authority.mjs';
const need=(v,c)=>{if(!v)throw Error('EXTENSION_MIGRATION_'+c);};
const sha=s=>createHash('sha256').update(s).digest('hex');
const utcCalendar=s=>s.slice(0,19).replace('T',' ')+' UTC';
export async function migrateExtensionGeneration({
 target,envelope,ownerPublicJWK,ownerKeyId,expectedKeySHA256,machineId,
 assertFreshOwnerMFA,assertFreshAdministration,readCurrent,replaySeen,
 stageCandidate,readCandidate,activate,readEffective,commitReceipt,rollback,
 now=Date.now
}){
 const hooks=[assertFreshOwnerMFA,assertFreshAdministration,readCurrent,replaySeen,
  stageCandidate,readCandidate,activate,readEffective,commitReceipt,rollback];
 need(hooks.every(f=>typeof f==='function'),'TRUSTED_ADAPTERS');
 const before=await readCurrent();
 need(before?.enabled===true&&before.active===true&&
  before.service==='nyra-repository-expiry.service'&&before.deadline===target.expiresAt&&
  /^[a-f0-9]{64}$/.test(before.generationSHA256),'CURRENT_TIMER');
 const signed=await verifyExtensionAuthority({
  target,envelope,ownerPublicJWK,ownerKeyId,expectedKeySHA256,machineId,
  previousGenerationSHA256:before.generationSHA256,now
 });
 need(await replaySeen(signed.decisionId)===false,'REPLAY');
 need(await assertFreshOwnerMFA(signed.decisionId,target)===true,'OWNER_AAL2');
 need(await assertFreshAdministration(target)===true,'ADMINISTRATION');
 need(now()<Date.parse(before.deadline),'OLD_DEADLINE_PASSED');
 const candidate=renderCanonicalExpiryTimer(utcCalendar(signed.newDeadline));
 const candidateSHA256=sha(candidate);
 let staged=false,activated=false;
 try{
  // Staging and independent readback MUST keep old timer enabled and active.
  await stageCandidate({candidate,candidateSHA256,decisionId:signed.decisionId});
  staged=true;
  const stagedInfo=await readCandidate();
  need(stagedInfo?.sha256===candidateSHA256&&stagedInfo.enabled===true&&
   stagedInfo.active===true&&stagedInfo.deadline===signed.newDeadline&&
   stagedInfo.unit==='nyra-repository-expiry.service'&&
   stagedInfo.originalStillArmed===true,'CANDIDATE_READBACK');
  need(now()<Date.parse(before.deadline),'STAGING_PAST_DEADLINE');
  await activate({decisionId:signed.decisionId,candidateSHA256,oldSHA256:before.generationSHA256,
   retainOldUntilVerified:true});
  activated=true;
  const after=await readEffective();
  need(after?.enabled===true&&after.active===true&&
   after.deadline===signed.newDeadline&&after.sha256===candidateSHA256&&
   after.unit==='nyra-repository-expiry.service','ACTIVE_READBACK');
  // Journal must be durable; after this operation the caller may retire
  // old generation only through a separately verified cleanup step.
  need(await commitReceipt({decisionId:signed.decisionId,oldDeadline:signed.oldDeadline,
   newDeadline:signed.newDeadline,oldSHA256:before.generationSHA256,
   newSHA256:candidateSHA256,replayProtection:true})===true,'DURABLE_COMMIT');
  return Object.freeze({status:'NEW_GENERATION_READBACK_AND_RECEIPT_COMMITTED',
   decisionId:signed.decisionId,newDeadline:signed.newDeadline,
   originalTimerRetirementAuthorized:false,credentialsExtended:false});
 }catch(error){
  // Never mask a recovery failure as successful extension.
  let restored=false;
  try{
   await rollback({oldGeneration:before,staged,activated,decisionId:signed.decisionId});
   const check=await readCurrent();
   restored=check?.enabled===true&&check.active===true&&
    check.deadline===before.deadline&&check.generationSHA256===before.generationSHA256;
  }catch{}
  if(!restored)throw Error('EXTENSION_MIGRATION_ROLLBACK_UNVERIFIED');
  throw error;
 }
}
