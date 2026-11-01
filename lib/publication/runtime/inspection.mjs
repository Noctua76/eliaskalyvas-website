// Unmounted private Edge orchestration. No credential, listener, bucket or job is
// created. Owner and machine identity are independently verified server-side.
import {confirmedImageMatches} from '../../../supabase/functions/nyra-api/lib/presentation.mjs';
import {Buffer} from 'node:buffer';
import {createPublicationAuthorityHandler} from '../authority.mjs';
import {hashJSON,parseContractJSON} from '../contract.mjs';
import {byteHash} from './adapters.mjs';
import {requireDelivery as need} from './materialize.mjs';
export const INSPECTOR_VERSION='nyra.sharp.v1/0.34.5/libvips-8.17.3';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const rpc=async(db,name,args)=>{const r=await db.rpc(name,args);if(r.error)throw Error(r.error.message?.match(/(?:INSPECTION|PUB)_[A-Z_]+/)?.[0]||'INSPECTION_STORAGE');return r.data;};
const actor=a=>({p_owner:a.p_owner,p_session:a.p_session,p_expires:a.p_expires});
export function inspectionReport(packet){const {upload:u,rights:r,attempt:a}=packet;return {protocol:'nyra.inspection.v1',operation_id:u.id,attempt_id:a.id,challenge:a.challenge,owner_id:u.owner_id,rights_decision_id:r.id,sha256:u.asset_sha,byte_length:u.byte_length,cover_sha256:u.cover_sha,presentation_sha256:u.presentation_sha,inspector_version:u.inspector_version,code_sha:u.code_sha,job_id:a.job_id,passed:true};}
export function createQuarantinedAssetRuntime({db,env,quarantine,codeSHA,now=Date.now}){
 need(/^[a-f0-9]{40}$/.test(codeSHA),'INSPECTION_CONFIG');if(typeof globalThis.Buffer==='undefined')globalThis.Buffer=Buffer;
 return Object.freeze({async initiate({request,bytes,workId,version}){
  need(uuid(workId)&&Number.isInteger(version)&&version>=0,'INSPECTION_SELECTOR');
  let operation=null;
  const gated={...db,auth:db.auth,from:db.from.bind(db),rpc:async(name,args)=>{
   if(name!=='nyra_publication_asset')return db.rpc(name,args);
   // These arguments have just been finalized by the unchanged real owner gate.
   try{
    const digest=await byteHash(bytes);need(digest===args.p_cover.sha256,'ASSET_HASH_MISMATCH');
    const found=await db.from('nyra_work').select('id,owner_id,state').eq('id',workId).eq('owner_id',args.p_owner).single();
    need(!found.error&&found.data,'INSPECTION_WORK');const presentation=found.data.state?.drafts?.[version]?.presentation;need(presentation&&typeof presentation==='object','INSPECTION_PRESENTATION');need(confirmedImageMatches(presentation,args.p_cover),'INSPECTION_RIGHTS_RECONFIRMATION');
    operation=await rpc(db,'nyra_inspection_begin',{...actor(args),p_work:workId,p_version:version,p_presentation:presentation,p_presentation_sha:hashJSON(presentation),p_cover:args.p_cover,p_cover_sha:hashJSON(args.p_cover),p_length:bytes.length,p_note:args.p_note,p_code:codeSHA,p_inspector:INSPECTOR_VERSION});
    await quarantine.put(operation.upload.id,bytes);
    await rpc(db,'nyra_inspection_ready',{...actor(args),p_id:operation.upload.id});
    return {data:{inspection_id:operation.upload.id,status:'quarantined_private',asset_id:null,publishing:false},error:null};
   }catch(error){return {data:null,error};}
  }};
  const handler=createPublicationAuthorityHandler({db:gated,env,now});
  const url=new URL(request.url);url.pathname='/publication/assets';
  // Preserve the body/headers for the established exact fields/origin/JWT gate.
  return handler(new Request(url,{method:request.method,headers:request.headers,body:await request.text()}));
 }});
}
export function createInspectionAuthorityHandler({db,env,now=Date.now}){
 const gated={...db,auth:db.auth,from:db.from.bind(db),rpc:async(name,args)=>{
  const r=await db.rpc(name,args);if(r.error||name!=='nyra_publication_context')return r;
  try{return {data:{...r.data,assets:await rpc(db,'nyra_inspection_assets',actor(args))},error:null};}catch(error){return {data:null,error};}
 }};
 return createPublicationAuthorityHandler({db:gated,env,now});
}
export function createPrivateInspectionService({db,quarantine,accepted,verifier,codeSHA,leaseSeconds=60}){
 need(/^[a-f0-9]{40}$/.test(codeSHA)&&Number.isInteger(leaseSeconds)&&leaseSeconds>=1&&leaseSeconds<=120,'INSPECTION_CONFIG');
 const authenticate=async token=>{const c=await verifier.verify(token);verifier.assert(c);need(c.codeSHA===codeSHA&&[c.runId,c.runAttempt,c.checkRunId].every(x=>typeof x==='string'&&/^[1-9][0-9]*$/.test(x)),'INSPECTION_JOB');return {codeSHA:c.codeSHA,job:hashJSON({run:c.runId,attempt:c.runAttempt,check:c.checkRunId,code:c.codeSHA})};};
 function selectors(handle,identity){need(handle&&Object.keys(handle).sort().join(',')==='attempt_id,challenge,operation_id'&&[handle.operation_id,handle.attempt_id,handle.challenge].every(uuid),'INSPECTION_ATTEMPT');return {p_id:handle.operation_id,p_attempt:handle.attempt_id,p_challenge:handle.challenge,p_job:identity.job};}
 const context=(h,c)=>rpc(db,'nyra_inspection_context',selectors(h,c));
 const verifiedBytes=async p=>{const bytes=p.receipt?await accepted.get(p.upload.asset_sha):await quarantine.get(p.upload.id);need(bytes.length===p.upload.byte_length&&await byteHash(bytes)===p.upload.asset_sha,'INSPECTION_BYTES');need(hashJSON(p.rights.cover)===p.upload.cover_sha&&p.rights.id===p.upload.rights_id&&p.rights.owner_id===p.upload.owner_id,'INSPECTION_RIGHTS');return bytes;};
 return Object.freeze({
  async next(token){const c=await authenticate(token);return {operation_id:await rpc(db,'nyra_inspection_next',{p_code:c.codeSHA})};},
  async claim(token,id){const c=await authenticate(token);need(uuid(id),'INSPECTION_SELECTOR');const p=await rpc(db,'nyra_inspection_claim',{p_id:id,p_job:c.job,p_code:c.codeSHA,p_inspector:INSPECTOR_VERSION,p_lease:leaseSeconds});return {operation_id:p.upload.id,attempt_id:p.attempt.id,challenge:p.attempt.challenge};},
  async read(token,handle){const c=await authenticate(token),p=await context(handle,c);need(p.upload.state==='processing','INSPECTION_STATE');const bytes=await verifiedBytes(p);const {id,owner_id,rights_id,asset_sha,byte_length,cover_sha,presentation_sha,inspector_version,code_sha}=p.upload;
   return {upload:{id,owner_id,rights_id,asset_sha,byte_length,cover_sha,presentation_sha,inspector_version,code_sha},rights:{id:p.rights.id,cover:p.rights.cover,approved_at:p.rights.approved_at},attempt:{id:p.attempt.id,challenge:p.attempt.challenge,job_id:p.attempt.job_id},bytes};},
  async finish(token,handle,report){const c=await authenticate(token),p=await context(handle,c);need(hashJSON(report)===hashJSON(inspectionReport(p)),'INSPECTION_REPORT');const bytes=await verifiedBytes(p);
   await accepted.put(p.upload.asset_sha,bytes); // private only; no eligibility yet
   return rpc(db,'nyra_inspection_complete',{...selectors(handle,c),p_report:report});},
  async fail(token,handle){const c=await authenticate(token);return rpc(db,'nyra_inspection_fail',selectors(handle,c));},
  async cleanup(token,id){const c=await authenticate(token);need(uuid(id),'INSPECTION_SELECTOR');await rpc(db,'nyra_inspection_cleanup',{p_id:id,p_code:c.codeSHA,p_cleared:false});await quarantine.remove(id);return rpc(db,'nyra_inspection_cleanup',{p_id:id,p_code:c.codeSHA,p_cleared:true});}
 });
}
export function privateQuarantineStorage(db,{bucket}){
 need(typeof bucket==='string'&&bucket.length>0,'PRIVATE_BUCKET_REQUIRED');
 const check=async()=>{const r=await db.storage.getBucket(bucket);need(!r.error&&r.data?.id===bucket&&r.data.public===false,'PRIVATE_BUCKET_REQUIRED');const limit=Number(r.data.file_size_limit??r.data.fileSizeLimit);need(Number.isSafeInteger(limit)&&limit>0&&limit<=20971520,'QUARANTINE_BUCKET_LIMIT');};
 const key=id=>{need(uuid(id),'INSPECTION_SELECTOR');return 'operations/'+id;};
 const get=async id=>{await check();const r=await db.storage.from(bucket).download(key(id));need(!r.error,'INSPECTION_STORAGE');const bytes=new Uint8Array(await r.data.arrayBuffer());await byteHash(bytes);return bytes;};
 return Object.freeze({get,
  async put(id,bytes){const digest=await byteHash(bytes);await check();const r=await db.storage.from(bucket).upload(key(id),bytes,{upsert:false,contentType:'application/octet-stream',cacheControl:'0'});need(!r.error,'INSPECTION_STORAGE');const actual=await get(id);need(actual.length===bytes.length&&await byteHash(actual)===digest,'INSPECTION_BYTES');},
  async remove(id){await check();const r=await db.storage.from(bucket).remove([key(id)]);need(!r.error,'INSPECTION_STORAGE');const found=await db.storage.from(bucket).download(key(id));need(found.error&&(/not found/i.test(found.error.message)||String(found.error.statusCode)==='404'),'INSPECTION_CLEANUP');}
 });
}

// Optional private machine transport factory, default disabled and unmounted.
// Job authentication occurs independently on every service method invocation.
export function createInspectionMachineHandler({service,enabled=false}){return async request=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!enabled)return reply({error:'INSPECTION_DISABLED'},503);
 try{
  need(request.method==='POST'&&!request.headers.has('Origin'),'MACHINE_ONLY');
  const token=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];need(token,'MACHINE_TOKEN_REQUIRED');
  const chunks=[];let length=0;const reader=request.body?.getReader();need(reader,'INSPECTION_PAYLOAD');while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>65536){await reader.cancel();throw Error('INSPECTION_PAYLOAD');}chunks.push(r.value);}
  const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const body=parseContractJSON(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),op=new URL(request.url).pathname.split('/').pop();
  const keys=Object.keys(body).sort().join(',');let value;
  if(op==='next'){need(keys==='','INSPECTION_FIELDS');value=await service.next(token);}
  else if(op==='claim'||op==='cleanup'){need(keys==='operation_id','INSPECTION_FIELDS');value=await service[op](token,body.operation_id);}
  else if(op==='read'||op==='fail'){need(keys==='handle','INSPECTION_FIELDS');value=await service[op](token,body.handle);}
  else if(op==='finish'){need(keys==='handle,report','INSPECTION_FIELDS');value=await service.finish(token,body.handle,body.report);}
  else throw Error('INSPECTION_OPERATION');
  if(op==='read')value={...value,bytes:Buffer.from(value.bytes).toString('base64')};
  return reply(value??{ok:true});
 }catch{return reply({error:'INSPECTION_REJECTED'},409);}
};}
