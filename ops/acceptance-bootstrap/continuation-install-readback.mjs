// Read-only exact-host assessment of an independently observed systemd installation.
// Never installs/starts/enables systemd, never executes Docker or contacts a provider.
const need=(x,c)=>{if(!x)throw Error('CONTINUATION_INSTALL_'+c);};
const sha=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const timestamp=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(Date.parse(x)).toISOString()===x;
export function assessContinuationInstallation(proposal,observation,{now=Date.now}={}){
 need(exact(proposal,['schema','bootstrapId','hostProposalSHA256','hostIdentitySHA256','cleanupSHA256','deadline','calendar','service','timer','serviceSHA256','timerSHA256','status','installApproved','enforcementVerified','credentialValidityExtended','providerDeletionScheduled']),'PROPOSAL_FIELDS');
 need(proposal.schema==='nyra.acceptance.continuation.expiry-unit-proposal.v1'&&proposal.status==='OFFLINE_ONLY_NOT_INSTALLED'&&proposal.installApproved===false,'PROPOSAL_ORIGIN');
 need(timestamp(proposal.deadline)&&sha(proposal.hostIdentitySHA256)&&sha(proposal.hostProposalSHA256)&&sha(proposal.cleanupSHA256)&&sha(proposal.serviceSHA256)&&sha(proposal.timerSHA256),'PROPOSAL_PINS');
 need(exact(observation,['bootstrapId','hostIdentitySHA256','sourceSHA','sourceClean','cleanupSHA256','cleanupRootOwned','cleanupNotSymlink','manifestRootOwned','manifestNotSymlink','manifestPermissions','serviceSHA256','timerSHA256','serviceRootOwned','timerRootOwned','serviceNotSymlink','timerNotSymlink','timerEnabled','timerActive','timerPersistent','timerNextTrigger','timerUnit','expiryUnit','expiryCommand','privateArtifactsInventoryReviewed','providerIdentityAuthenticated','providerResourceId','hostMachineIdVerified','observedAt']),'OBSERVATION_FIELDS');
 need(timestamp(observation.observedAt)&&Date.parse(observation.observedAt)<=now()&&now()-Date.parse(observation.observedAt)<=60000,'FRESH_OBSERVATION');
 const expectedCommand=proposal.service.match(/^ExecStart=(.+)$/m)?.[1];
 const checks=Object.freeze({
  hostIdentity:observation.bootstrapId===proposal.bootstrapId&&observation.hostIdentitySHA256===proposal.hostIdentitySHA256&&observation.hostMachineIdVerified===true,
  provenance:sha(observation.sourceSHA)&&observation.sourceClean===true&&observation.providerIdentityAuthenticated===true&&typeof observation.providerResourceId==='string'&&/^[1-9][0-9]{0,19}$/.test(observation.providerResourceId)&&observation.providerResourceId!=='615221104',
  cleanup:observation.cleanupSHA256===proposal.cleanupSHA256&&observation.cleanupRootOwned===true&&observation.cleanupNotSymlink===true,
  manifest:observation.manifestRootOwned===true&&observation.manifestNotSymlink===true&&observation.manifestPermissions==='0600',
  exactUnits:observation.serviceSHA256===proposal.serviceSHA256&&observation.timerSHA256===proposal.timerSHA256&&observation.serviceRootOwned===true&&observation.timerRootOwned===true&&observation.serviceNotSymlink===true&&observation.timerNotSymlink===true,
  systemdEffective:observation.timerEnabled===true&&observation.timerActive===true&&observation.timerPersistent===true&&observation.timerNextTrigger===proposal.deadline&&observation.timerUnit==='nyra-continuation-expiry.timer'&&observation.expiryUnit==='nyra-continuation-expiry.service'&&observation.expiryCommand===expectedCommand,
  privateRetirementScope:observation.privateArtifactsInventoryReviewed===true,
  deadlineFuture:now()<Date.parse(proposal.deadline)
 });
 return Object.freeze({status:Object.values(checks).every(Boolean)?'HOST_EXPIRY_READBACK_VERIFIED':'NO_GO_HOST_EXPIRY',checks,authorization:false,ownerMFAValidated:false,fullRetirementValidated:false,providerDestructionScheduled:false,sourceSHA:observation.sourceSHA});
}
