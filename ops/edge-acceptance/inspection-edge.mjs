// Disposable native entry ONLY. No production mount or environment is configured.
import {createClient} from '@supabase/supabase-js';
import {Buffer} from 'node:buffer';
import {createFinalEditorialApplication} from '../../runtime/nyra-edge/application.mjs';
import {createOIDCVerifier} from '../../lib/publication/runtime/oidc.mjs';
import {privateAssetStorage} from '../../lib/publication/runtime/adapters.mjs';
import {privateQuarantineStorage,createQuarantinedAssetRuntime,createPrivateInspectionService,createInspectionMachineHandler,createInspectionAuthorityHandler} from '../../lib/publication/runtime/inspection.mjs';
if(typeof globalThis.Buffer==='undefined')globalThis.Buffer=Buffer;
const c=JSON.parse(Deno.env.get('NYRA_INSPECTION_TEST_CONFIG'));
if(c.nativeOnly!==true||c.url!=='http://driver:8080')throw Error('NATIVE_TEST_ONLY');
const db=createClient(c.url,c.service,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const quarantine=privateQuarantineStorage(db,{bucket:c.quarantine}),accepted=privateAssetStorage(db,{bucket:c.accepted});
const verifier=createOIDCVerifier({policy:c.policy,keySource:async()=>({keys:[c.publicJWK]}),jobFacts:async q=>c.jobs.find(x=>x.runId===q.runId&&x.runAttempt===q.runAttempt&&x.checkRunId===q.checkRunId)});
const service=createPrivateInspectionService({db,quarantine,accepted,verifier,codeSHA:c.codeSHA,leaseSeconds:10});
const owner=createQuarantinedAssetRuntime({db,env:{ALLOWED_ORIGINS:'http://127.0.0.1:55111'},quarantine,codeSHA:c.codeSHA});
const machine=createInspectionMachineHandler({service,enabled:true});
const authority=createInspectionAuthorityHandler({db,env:{ALLOWED_ORIGINS:'http://127.0.0.1:55111'}});
// This assertion exists ONLY in this isolated test entrypoint; it cannot prove
// live trust acceptance. Production composition requires the approved real gate.
const editorial=c.finalIntegration===true?createFinalEditorialApplication({db,env:{ALLOWED_ORIGINS:'http://127.0.0.1:55111',NYRA_PRIVATE_ASSET_BUCKET:c.accepted,NYRA_QUARANTINE_BUCKET:c.quarantine},codeSHA:c.codeSHA,assertTrustReady:async()=>true,enabled:true,fetcher:async()=>{throw Error('PAID_PROVIDER_FORBIDDEN');}}):null;
Deno.serve(async req=>{
 const url=new URL(req.url);
 if(url.pathname.startsWith('/inspection/'))return machine(req);
 if(editorial)return editorial(req);
 if(url.pathname.startsWith('/publication/'))return authority(req);
 if(url.pathname!=='/upload'||req.method!=='POST')return new Response('not found',{status:404});
 try{
  const encoded=req.headers.get('X-Inspection-Metadata');if(!encoded||encoded.length>16000)throw Error('metadata');const meta=JSON.parse(encoded);
  if(Object.keys(meta).sort().join(',')!=='cover,rights_note,version,work_id')throw Error('fields');
  const chunks=[];let n=0;const reader=req.body?.getReader();if(!reader)throw Error('body');while(true){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>20971520){await reader.cancel();return Response.json({error:'ASSET_SIZE'},{status:413});}chunks.push(r.value);}
  const bytes=new Uint8Array(n);let offset=0;for(const b of chunks){bytes.set(b,offset);offset+=b.length;}
  const headers=new Headers(req.headers);headers.delete('Content-Length');headers.delete('X-Inspection-Metadata');headers.set('Content-Type','application/json');
  return owner.initiate({request:new Request('http://127.0.0.1:55111/publication/assets',{method:'POST',headers,body:JSON.stringify({cover:meta.cover,rights_note:meta.rights_note})}),bytes,workId:meta.work_id,version:meta.version});
 }catch{return Response.json({error:'UPLOAD_REJECTED'},{status:409});}
});
