import {composePrivateDelivery} from './factory.ts';
import {createPrivateAssetRuntime} from './lib/publication/runtime/assets.mjs';
let calls=0;const forbidden=()=>{calls++;throw Error('PRIVATE_ACCESS_FORBIDDEN');};
const deps={db:{rpc:forbidden},verifier:{verify:forbidden,assert:forbidden},pagesVerifier:{verify:forbidden,assert:forbidden},storage:{},github:{},publicReader:{},repository:'test/native',baseSitemap:'',pathScopeAuthority:{},fetcher:forbidden};
const disabled=composePrivateDelivery({...deps,enabled:false}).handler;
Deno.serve(async req=>{
 if(new URL(req.url).pathname.endsWith('/missing-inspector')){
  try{await createPrivateAssetRuntime({db:{},env:{},storage:{}}).uploadAndReview({request:req,bytes:new Uint8Array()});return Response.json({unexpected:true});}
  catch(error){return Response.json({error:error.message,calls});}
 }
 const r=await disabled(req);return new Response(r.body,{status:r.status,headers:{...Object.fromEntries(r.headers),'X-Private-Calls':String(calls)}});
});
