// Opt-in composition only. Existing production index.ts remains unchanged.
// Trust assertion is supplied by the approved control plane, never JSON/JWT/UI.
import {createWorkspaceHandler} from '../../supabase/functions/nyra-api/lib/workspace.mjs';
import {createInspectionAuthorityHandler,createQuarantinedAssetRuntime} from '../../lib/publication/runtime/inspection.mjs';
import {parseContractJSON} from '../../lib/publication/contract.mjs';
const need=(v)=>{if(!v)throw Error('EDITORIAL_INTEGRATION_DENIED');};
export function composeEditorialPublication({db,env,quarantine,storage,codeSHA,assertTrustReady,enabled=false,fetcher=fetch,sourceFetcher=fetch,now=Date.now}){
 const workspace=createWorkspaceHandler({db,env,fetcher,sourceFetcher,now,allowOwnerEditing:enabled===true});
 const authority=createInspectionAuthorityHandler({db,env,now});
 const deny=(status=503)=>Response.json({error:'PUBLICATION_INTEGRATION_DISABLED',publishing:false},{status,headers:{'Cache-Control':'no-store'}});
 const trust=async()=>{need(typeof assertTrustReady==='function');need(await assertTrustReady()===true);};
 // Revalidate immediately at the SQL mutation, including idempotent retries.
 const guardedDB={...db,auth:db.auth,from:db.from.bind(db),rpc:async(name,args)=>{if(name==='nyra_publication_commit')await trust();return db.rpc(name,args);}};
 const guardedAuthority=createInspectionAuthorityHandler({db:guardedDB,env,now});
 return async request=>{
  const u=new URL(request.url),path=u.pathname.replace(/^.*\/nyra-api/,'');
  if(!path.startsWith('/publication/')){
   const r=await workspace(request);
   if(path==='/status'&&r.ok&&enabled===true){const b=await r.json();return Response.json({...b,publication_preparation:true,publishing:false},{status:r.status,headers:r.headers});}
   return r;
  }
  if(enabled!==true)return deny();
  // Exact established origin/Auth/owner/AAL2 gate BEFORE parsing image bytes.
  const status=new URL(request.url);status.pathname='/nyra-api/status';
  const auth=await workspace(new Request(status,{method:request.method==='OPTIONS'?'OPTIONS':'GET',headers:request.headers}));
  if(request.method==='OPTIONS'||!auth.ok)return auth;
  try{
   need(request.method==='POST'&&!u.search&&!u.hash);
   if(path==='/publication/asset'){
    const body=parseContractJSON(await request.text());need(Object.keys(body).sort().join(',')==='asset_id,work_id');
    const catalogURL=new URL(request.url);catalogURL.pathname='/publication/catalog';
    const catalog=await authority(new Request(catalogURL,{method:'POST',headers:request.headers,body:JSON.stringify({work_id:body.work_id})}));need(catalog.ok);
    const asset=(await catalog.json()).assets.find(a=>a.id===body.asset_id);need(asset&&typeof storage?.get==='function');
    const bytes=await storage.get(asset.cover.sha256);need(bytes instanceof Uint8Array&&await (await import('../../lib/publication/runtime/adapters.mjs')).byteHash(bytes)===asset.cover.sha256);
    const headers=new Headers(auth.headers);headers.set('Content-Type',asset.cover.mime_type);headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');return new Response(bytes,{headers});
   }
   if(path==='/publication/upload'){
    const reader=request.body?.getReader();need(reader);const chunks=[];let length=0;
    try{for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;need(length<=21*1024*1024);chunks.push(r.value);}}finally{await reader.cancel();}
    const body=new Uint8Array(length);let offset=0;for(const b of chunks){body.set(b,offset);offset+=b.length;}
    const form=await new Request(request.url,{method:'POST',headers:request.headers,body}).formData();
    need([...form.keys()].sort().join(',')==='file,metadata');const file=form.get('file'),raw=form.get('metadata');need(file instanceof Blob&&file.size>0&&file.size<=20*1024*1024&&typeof raw==='string'&&raw.length<=30000);
    const m=parseContractJSON(raw);need(Object.keys(m).sort().join(',')==='cover,rights_note,version,work_id');
    const headers=new Headers(request.headers);headers.set('Content-Type','application/json');headers.delete('Content-Length');
    const ownerRequest=new Request(request.url,{method:'POST',headers,body:JSON.stringify({cover:m.cover,rights_note:m.rights_note})});
    return createQuarantinedAssetRuntime({db,env,quarantine,storage,codeSHA,now}).initiate({request:ownerRequest,bytes:new Uint8Array(await file.arrayBuffer()),workId:m.work_id,version:m.version});
   }
   need(['/publication/identity','/publication/catalog','/publication/preview','/publication/authorize'].includes(path));
   if(path==='/publication/authorize')await trust();
   const url=new URL(request.url);url.pathname=path;
   return (path==='/publication/authorize'?guardedAuthority:authority)(new Request(url,{method:request.method,headers:request.headers,body:await request.text()}));
  }catch{return Response.json({error:'EDITORIAL_INTEGRATION_DENIED',publishing:false},{status:409,headers:auth.headers});}
 };
}
