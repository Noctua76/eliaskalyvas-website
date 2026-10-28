// Unmounted Supabase server adapters. The caller supplies an already server-only
// client; no environment variable, credential, listener or provider is created.
import {hashJSON,validateReceipt,isUTC} from '../contract.mjs';
import {validateLiveReceipt,requireDelivery} from './materialize.mjs';
const rpc=async(db,name,args)=>{const r=await db.rpc(name,args);if(r.error)throw Error('DELIVERY_STORAGE_UNAVAILABLE');return r.data};
export function supabaseMachineStore(db){
 const consume=(c,op)=>rpc(db,'nyra_delivery_machine',{p_run:c.runId,p_attempt:c.runAttempt,p_check:c.checkRunId,p_sha:c.codeSHA,p_jti:c.jti,p_expires:c.expiresAt,p_operation:op});
 return Object.freeze({consumeCurrentExport:c=>consume(c,'export'),consumeCurrentPermit:c=>consume(c,'permit')});
}
export function privateAssetStorage(db,{bucket}){
 requireDelivery(typeof bucket==='string'&&bucket.length>0,'PRIVATE_BUCKET_REQUIRED');
 const privateBucket=async()=>{const r=await db.storage.getBucket(bucket);requireDelivery(!r.error&&r.data?.id===bucket&&r.data.public===false,'PRIVATE_BUCKET_REQUIRED')};
 const key=hash=>{requireDelivery(/^[a-f0-9]{64}$/.test(hash),'ASSET_HASH');return 'sha256/'+hash};
 return Object.freeze({
  async put(hash,bytes){await privateBucket();const object=key(hash),storage=db.storage.from(bucket);const result=await storage.upload(object,bytes,{upsert:false,contentType:'application/octet-stream',cacheControl:'0'});
   // A duplicate is acceptable only after exact existing bytes are checked.
   if(result.error&&String(result.error.statusCode)!=='409')throw Error('ASSET_STORAGE_UNAVAILABLE');
   const found=await storage.download(object);if(found.error)throw Error('ASSET_STORAGE_UNAVAILABLE');
   const stored=new Uint8Array(await found.data.arrayBuffer());requireDelivery(await byteHash(stored)===hash&&stored.length===bytes.length,'STORED_ASSET_MISMATCH');return object;
  },
  async get(hash){await privateBucket();const r=await db.storage.from(bucket).download(key(hash));if(r.error)throw Error('ASSET_STORAGE_UNAVAILABLE');const bytes=new Uint8Array(await r.data.arrayBuffer());requireDelivery(await byteHash(bytes)===hash,'STORED_ASSET_MISMATCH');return bytes;}
 });
}
export async function byteHash(bytes){requireDelivery(bytes instanceof Uint8Array&&bytes.byteLength>0&&bytes.byteLength<=20*1024*1024,'ASSET_SIZE');const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}

// No live verifier is enabled. A future independently authenticated observer
// supplies facts. WeakSet provenance prevents a runner/browser object from
// claiming that GitHub and the actual public manifest were checked.
export function observationVerifier({observe,clock=()=>new Date().toISOString()}){
 const known=new WeakSet();
 return Object.freeze({
  async verify(attempt,candidate){const facts=await observe(attempt,candidate);requireDelivery(facts&&facts.runId===attempt.runId&&facts.runAttempt===attempt.runAttempt&&facts.codeSHA===attempt.codeSHA&&facts.candidateId===candidate.id,'OBSERVATION_CORRELATION');
   requireDelivery(['unknown','never_deployed','verified_live','observed_late_live'].includes(facts.kind),'OBSERVATION_STATUS');
   if(facts.kind==='never_deployed')requireDelivery(facts.runTerminal===true&&facts.noDeploymentCreated===true&&facts.noDeploymentInProgress===true&&facts.publicManifestUnchanged===true,'UNPROVEN_NON_DELIVERY');
   if(['verified_live','observed_late_live'].includes(facts.kind))requireDelivery(facts.deploymentSucceeded===true&&facts.deploymentId&&facts.observedManifestSHA256===hashJSON(candidate.dataset.manifest)&&facts.allCanonicalRoutesChecked===true,'UNVERIFIED_LIVE');
   if(['verified_live','observed_late_live'].includes(facts.kind))requireDelivery([facts.deploymentRequestedAt,facts.deploymentCompletedAt,facts.observedAt].every(isUTC)&&facts.deploymentRequestedAt<=facts.deploymentCompletedAt&&facts.deploymentCompletedAt<=facts.observedAt&&facts.observedAt<=clock(),'OBSERVATION_TIME');
   const proof=Object.freeze(structuredClone(facts));known.add(proof);return proof;
  },
  assert(proof){requireDelivery(known.has(proof),'UNVERIFIED_OBSERVER');return proof;}
 });
}
export function receiptRecorder({observer,store,clock=()=>new Date().toISOString()}){
 return Object.freeze({async record({attempt,candidate,receipt,proof}){
  observer.assert(proof);requireDelivery(receipt.attempt_id===attempt.id&&receipt.code_sha===attempt.codeSHA&&receipt.github_run_id===attempt.runId&&String(receipt.github_run_attempt)===attempt.runAttempt,'RECEIPT_ATTEMPT');
  requireDelivery(receipt.github_deployment_id===proof.deploymentId&&receipt.observed_manifest_sha256===proof.observedManifestSHA256&&receipt.deployment_requested_at===proof.deploymentRequestedAt&&receipt.deployment_completed_at===proof.deploymentCompletedAt&&receipt.verified_live_at===proof.observedAt,'RECEIPT_OBSERVATION');
  if(proof.kind==='verified_live'){requireDelivery(receipt.status==='released_verified','RECEIPT_STATUS');validateLiveReceipt(candidate,receipt,clock());return store.recordVerified({attempt,candidate,receipt,proof,transitionSHA256:hashJSON(candidate.transition)})}
  requireDelivery(proof.kind==='observed_late_live'&&receipt.status==='timing_exception','RECEIPT_STATUS');validateReceipt(receipt,{manifest:candidate.dataset.manifest,now:clock()});return store.recordTimingException({attempt,candidate,receipt,proof});
 }});
}

export function supabaseDeliveryStore(db){
 return Object.freeze({
  claim:id=>rpc(db,'nyra_delivery_claim',{p_id:id}),
  save:({attemptId,fence,sourceGeneration,id,candidate})=>rpc(db,'nyra_delivery_materialized',{p_attempt:attemptId,p_fence:fence,p_id:id,p_source:sourceGeneration,p_candidate:candidate,p_sha:hashJSON(candidate.dataset.manifest),p_intents:candidate.intentIds}),
  recordVerified:({attempt,receipt,proof,transitionSHA256})=>rpc(db,'nyra_delivery_receipt',{p_attempt:attempt.id,p_id:receipt.id,p_receipt:receipt,p_transition_sha:transitionSHA256,p_evidence:proof}),
  recordTimingException:({attempt,receipt,proof})=>rpc(db,'nyra_delivery_reconcile',{p_attempt:attempt.id,p_observation:receipt.id,p_kind:'observed_late_live',p_evidence:{receipt,proof}}),
  reconcile:({attempt,proof,id})=>rpc(db,'nyra_delivery_reconcile',{p_attempt:attempt.id,p_observation:id,p_kind:proof.kind,p_evidence:proof})
 });
}

export function supabaseBuildAssetSource(db){
 return Object.freeze({rightsFor:capability=>rpc(db,'nyra_delivery_assets',{p_attempt:capability.attempt_id,p_fence:capability.fence,p_candidate:capability.candidate_id})});
}
export function supabaseArtifactStore(db){return Object.freeze({recordArtifact:p=>rpc(db,'nyra_delivery_artifact',{p_attempt:p.attemptId,p_fence:p.fence,p_candidate:p.candidateId,p_id:crypto.randomUUID(),p_digest:p.artifactSHA256,p_observation:{manifest_sha256:p.manifestSHA256,code_sha:p.codeSHA,source:'trusted-build-byte-seal'}})})}
