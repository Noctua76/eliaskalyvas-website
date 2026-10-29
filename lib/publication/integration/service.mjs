// Private composition root; no env reads, listener, dispatch or production mount.
import {randomUUID} from 'node:crypto';
import {hashJSON,validateReceipt} from '../contract.mjs';
import {requireDelivery as need} from '../runtime/materialize.mjs';
import {createDeliveryController} from '../runtime/controller.mjs';
import {createMachineRuntime} from '../runtime/machine.mjs';
import {supabaseMachineStore,supabaseDeliveryStore,supabaseBuildAssetSource,observationVerifier,receiptRecorder} from '../runtime/adapters.mjs';
import {sha256} from './archive.mjs';
const rpc=async(db,name,args)=>{const r=await db.rpc(name,args);need(!r.error,'DELIVERY_STORAGE_UNAVAILABLE');return r.data;};
const identityArgs=c=>({p_run:c.runId,p_attempt:c.runAttempt,p_check:c.checkRunId,p_sha:c.codeSHA});
function stableId(c){const h=sha256(new TextEncoder().encode([c.runId,c.runAttempt,c.checkRunId,c.codeSHA].join(':')));return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
export function createPrivateDeliveryService({db,verifier,storage,provenance,observe,dispatcher=null,clock=()=>new Date().toISOString()}){
 const store=supabaseDeliveryStore(db,{clock}),controller=createDeliveryController({store,clock}),machine=createMachineRuntime({verifier,store:supabaseMachineStore(db),clock}),rights=supabaseBuildAssetSource(db);
 const observer=observationVerifier({observe,clock}),recorder=receiptRecorder({observer,store,clock});
 const authenticate=async token=>{const c=await verifier.verify(token);verifier.assert(c);return c;};
 function normalize(row){const a=row.attempt;return {attempt:{id:a.id,runId:a.run_id,runAttempt:a.run_attempt,checkRunId:a.check_run_id,codeSHA:a.code_sha,fence:a.fence,state:a.state,started:row.started},candidate:{...row.candidate,id:row.candidate_id,manifestSHA256:row.manifest_sha256,storedProvenance:row.provenance},row};}
 async function context(c){return normalize(await rpc(db,'nyra_delivery_inspect',identityArgs(c)));}
 async function observeContext({attempt,candidate,row}){
   if(attempt.state==='timing_exception')return {status:'timing_exception',requires_operator:true};
   if(row.receipt){need(row.receipt.status==='released_verified','RECEIPT_STATUS');return {status:row.receipt.status,receipt_id:row.receipt.id};}
   // Re-download/verify provenance independently; no runner-provided receipt.
   try{const proof=await provenance.verify(attempt,candidate);provenance.assert(proof);const p=row.provenance;need(p&&p.github_artifact_id===proof.artifactId&&p.zip_sha256===proof.zipSHA256&&p.tar_sha256===proof.tarSHA256&&p.inventory_sha256===proof.artifactSHA256,'STORED_PROVENANCE_MISMATCH');candidate.provenance=proof;}catch{candidate.provenance=null;}
   const facts=await observer.verify(attempt,candidate);
   if(facts.kind==='unknown'||facts.kind==='never_deployed'){await store.reconcile({attempt,proof:facts,id:randomUUID()});return {status:facts.kind};}
   const m=candidate.dataset.manifest,receipt={schema_version:'nyra.publication.receipt.v1.1',id:randomUUID(),attempt_id:attempt.id,manifest_id:m.manifest_id,generation:m.generation,manifest_sha256:hashJSON(m),code_sha:attempt.codeSHA,github_run_id:attempt.runId,github_run_attempt:Number(attempt.runAttempt),github_deployment_id:facts.deploymentId,status:facts.kind==='verified_live'?'released_verified':'timing_exception',deployment_requested_at:facts.deploymentRequestedAt,deployment_completed_at:facts.deploymentCompletedAt,verified_live_at:facts.observedAt,observed_manifest_sha256:facts.observedManifestSHA256};
   validateReceipt(receipt,{manifest:m,now:clock(),...(receipt.status==='released_verified'?{transition:candidate.transition}:{})});await recorder.record({attempt,candidate,receipt,proof:facts});return {status:receipt.status,receipt_id:receipt.id};
 }
 return Object.freeze({
  async export(token){const c=await authenticate(token),id=stableId(c);await rpc(db,'nyra_delivery_register',{p_id:id,...identityArgs(c)});await controller.prepare(id);
   const selected=await machine.exportCurrent({token}),right=await rights.rightsFor(selected.capability),assets=[];const seen=new Set();
   for(const r of selected.dataset.releases){const cover=r.presentation.cover,path=new URL(cover.url).pathname.slice(1);if(seen.has(path))continue;seen.add(path);assets.push({path,base64:Buffer.from(await storage.get(cover.sha256)).toString('base64')});}
   return {version:'nyra.delivery.export.v1',dataset:selected.dataset,capability:selected.capability,identity:{codeSHA:c.codeSHA,runId:c.runId,runAttempt:c.runAttempt},rightsDecisions:right,assets};
  },
  async permit(token){const c=await authenticate(token),{attempt,candidate}=await context(c),proof=await provenance.verify(attempt,candidate);provenance.assert(proof);
   await rpc(db,'nyra_delivery_provenance',{p_attempt:attempt.id,p_candidate:candidate.id,p_fence:attempt.fence,p_artifact:proof.artifactId,p_zip:proof.zipSHA256,p_tar:proof.tarSHA256,p_inventory:proof.artifactSHA256});
   return machine.permit({token});
  },
  async start(token){const c=await authenticate(token);return rpc(db,'nyra_delivery_start',{...identityArgs(c),p_jti:c.jti,p_expires:c.expiresAt});},
  async deploy(token,{pagesOIDC,githubToken}){need(dispatcher,'PAGES_DISPATCH_DISABLED');const c=await authenticate(token),{attempt}=await context(c);const start=await rpc(db,'nyra_delivery_start',{...identityArgs(c),p_jti:c.jti,p_expires:c.expiresAt});return dispatcher.dispatch({attempt,start,pagesOIDC,githubToken});},
  async observe(token){const c=await authenticate(token);return observeContext(await context(c));},
  // Internal operator worker only: selection comes from the locked server ledger.
  // No job token, browser selector, dispatch or listener is needed to reconcile.
  async reconcilePending(){const row=await rpc(db,'nyra_delivery_pending',{});return row?observeContext(normalize(row)):{status:'idle'};}
 });
}
// Default-disabled factory, deliberately outside supabase/functions.
export function createPrivateDeliveryHandler({service,enabled=false}){return async request=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!enabled)return new Response('{"error":"PUBLICATION_DISABLED"}',{status:503,headers});
 try{need(request.method==='POST'&&!request.headers.has('Origin'),'MACHINE_ONLY');const token=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];need(token,'MACHINE_TOKEN_REQUIRED');const body=await request.text();need(body==='{}','MACHINE_SELECTOR_FORBIDDEN');const op=new URL(request.url).pathname.split('/').pop();need(['export','permit','start','deploy','observe'].includes(op),'UNKNOWN_OPERATION');const extra=op==='deploy'?{pagesOIDC:request.headers.get('X-Pages-OIDC'),githubToken:request.headers.get('X-GitHub-Token')}:undefined;return new Response(JSON.stringify(await service[op](token,extra)),{headers});}
 catch{return new Response('{"error":"DELIVERY_REJECTED"}',{status:409,headers});}
};}
