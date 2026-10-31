// Inactive host-only composition. No listener, token source, dispatch, keys or
// DB credentials are created on import. All authority comes from separately
// provisioned AND independently authenticated control-plane dependencies.
import {createHash,webcrypto} from 'node:crypto';
import {canonicalize} from '../../lib/publication/canonical-json.mjs';
import {createLiveWatcher} from './live-watcher.mjs';
import {createIngressHandler} from './live-ingress.mjs';

const ROLES=Object.freeze(['build','inspection','publication']);
const CLAIMS=new Set(['iss','aud','sub','repository','repository_id',
 'repository_owner','repository_owner_id','ref','ref_type','environment',
 'workflow_ref','workflow_sha','job_workflow_ref','job_workflow_sha',
 'run_id','run_attempt','check_run_id','sha','iat','nbf','exp']);
const FIELDS=['authorization','claims','issuerKeyId','observedAt','planSHA256',
 'purpose','schema','tokenSHA256'].sort().join(',');
const need=(v,c)=>{if(!v)throw Error('NYRA_COMPOSITION_'+c);};
const decimal=x=>typeof x==='string'&&/^[1-9][0-9]{0,19}$/.test(x);
const hex64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);

export async function verifyPinnedObservation(envelope,{publicKey,keyId,policy,now=Date.now}){
 need(publicKey?.type==='public'&&publicKey.algorithm?.name==='Ed25519'&&
  typeof keyId==='string'&&keyId.length>0&&keyId.length<=120,'KEY_PIN');
 need(envelope?.keyId===keyId&&hex64(envelope?.digest)&&
  typeof envelope?.signature==='string'&&envelope.signature.length<=200,
  'ENVELOPE');
 const r=envelope.record;
 need(r&&Object.keys(r).sort().join(',')===FIELDS&&
  r.schema==='nyra.github.identity.observation.v1'&&
  r.purpose==='identity-observation-only'&&r.authorization===false&&
  hex64(r.tokenSHA256)&&hex64(r.planSHA256)&&
  typeof r.issuerKeyId==='string'&&r.issuerKeyId.length>0&&
  typeof r.observedAt==='string','RECORD');
 const t=Date.parse(r.observedAt);
 need(Number.isFinite(t)&&t<=now()+10000&&now()-t<=60000,'STALE');
 const c=r.claims;
 need(c&&typeof c==='object'&&!Array.isArray(c)&&
  Object.keys(c).every(k=>CLAIMS.has(k)),'CLAIMS');
 need(c.iss==='https://token.actions.githubusercontent.com'&&
  c.repository==='Noctua76/eliaskalyvas-website'&&
  c.repository_id==='1389733212'&&
  c.repository_owner_id==='217035723'&&
  c.environment===policy.environment&&c.sha===policy.callerSHA&&
  c.ref==='refs/heads/main'&&decimal(c.run_id)&&decimal(c.run_attempt)&&
  decimal(c.check_run_id)&&
  Number.isSafeInteger(c.exp)&&c.exp*1000>now(),'JOB_CONTEXT');
 let digest;
 try{digest=createHash('sha256').update(canonicalize(r),'utf8').digest('hex');}
 catch{throw Error('NYRA_COMPOSITION_RECORD_CANONICAL');}
 need(digest===envelope.digest,'DIGEST');
 const signature=Buffer.from(envelope.signature,'base64url');
 need(signature.length===64&&
  await webcrypto.subtle.verify('Ed25519',publicKey,signature,
   new TextEncoder().encode(digest)),'SIGNATURE');
 return Object.freeze({role:policy.role,runId:c.run_id,runAttempt:c.run_attempt,
  checkRunId:c.check_run_id,digest,keyId});
}

export function composeTrustAcceptance({
 getJSON,registrars,policies,assertAdministration,assertOwnerDecision,
 brokerAcceptors,persistSignedEvidence,evidencePublicKey,evidenceKeyId,
 callerSHA,windowStartsAt,windowEndsAt,enabled=false,now=Date.now
}){
 need(typeof assertAdministration==='function'&&
  typeof assertOwnerDecision==='function'&&
  typeof persistSignedEvidence==='function'&&
  ROLES.every(role=>typeof brokerAcceptors?.[role]==='function'&&
   policies?.[role]?.role===role&&
   policies[role].environment==='nyra-'+role),'PRIVATE_PORTS');
 need(evidencePublicKey?.type==='public'&&
  evidencePublicKey.algorithm?.name==='Ed25519'&&
  typeof evidenceKeyId==='string'&&evidenceKeyId.length>0,'PINNED_EVIDENCE_KEY');
 // Every administrative decision must be revalidated per role and per request.
 // No owner auth can originate from the bearer, request JSON or workflow input.
 const gate=async policy=>{
  need(await assertAdministration(policy)===true,'ADMIN_GATE');
  need(await assertOwnerDecision(policy)===true,'OWNER_GATE');
 };
 const watcher=createLiveWatcher({getJSON,registrars,policies,
  assertAdministration:gate,callerSHA,windowStartsAt,windowEndsAt,now});
 const acceptedReceipts=new Set();
 const acceptors=Object.fromEntries(ROLES.map(role=>[role,async token=>{
  need(enabled===true,'DISABLED');
  const policy=policies[role];
  await gate(policy);
  // This delegate MUST be a privately authenticated broker IPC operation.
  // It verifies GitHub JWT signature, exact job and replay in broker-role DB.
  // A mere {accepted:true} is never sufficient evidence.
  const signed=await brokerAcceptors[role](token);
  const observed=await verifyPinnedObservation(signed,{
   publicKey:evidencePublicKey,keyId:evidenceKeyId,policy,now
  });
  need(await watcher.isReady({role,runId:observed.runId,
   runAttempt:observed.runAttempt,checkRunId:observed.checkRunId})===true,'JOB_NOT_READY');
  await gate(policy);
  // Broker PostgreSQL still owns the durable JWT replay guard. This local
  // digest set also prevents repeated acceptance in the same coordinator.
  need(!acceptedReceipts.has(observed.digest),'REPLAY');
  // Only an already verified sanitized receipt reaches the private collector.
  need(await persistSignedEvidence({role,envelope:signed,coordinates:observed})===true,
   'PERSISTENCE');
  acceptedReceipts.add(observed.digest);
  await gate(policy);
  return {accepted:true,digest:observed.digest,keyId:observed.keyId};
 }]));
 return Object.freeze({
  watcher,
  ingress:createIngressHandler({watcher,acceptors,enabled}),
  activeIngress:enabled===true,
  // A handler is NOT a network listener. Host Caddy must remain review-only
  // until separate owner authorization and external acceptance readiness.
  listenerStarted:false,dispatchesPerformed:0
 });
}
