// Test-only worker entry. Probe bytes independently before importing the guarded
// staged factory. A diagnostic listener is not evidence that the factory booted.
import {readFileSync} from 'node:fs';
const names=['shared','release','manifest','event','receipt','dataset'];
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
const files={};
for(const name of names){
 const relative='contracts/nyra-publication/v1.1/'+name+'.schema.json';
 const url=new URL('__SCHEMA_REL__'+name+'.schema.json',import.meta.url);
 files[name]={url:String(url)};
 for(const [kind,load]of Object.entries({denoRelative:()=>Deno.readFileSync(relative),denoURL:()=>Deno.readFileSync(url),nodeRelative:()=>readFileSync(relative),nodeURL:()=>readFileSync(url)})){
  try{const bytes=load();files[name][kind]={sha256:await hash(bytes),length:bytes.length};}catch(e){files[name][kind]={error:String(e)};}
 }
}
let core=null,coreError=null,schemaCount=0;
try{core=await import('./index.ts');schemaCount=Object.keys((await import('./lib/publication/contract.mjs')).schemas).length;}catch(e){coreError=String(e);core=null;}
let dbCalls=0,verifierCalls=0;
const forbiddenDB=()=>{dbCalls++;throw Error('NATIVE_PRIVATE_DATA_ACCESS_FORBIDDEN');};
const rejectToken=()=>{verifierCalls++;throw Error('INVALID_MACHINE_AUTHORIZATION');};
let disabled,enabled;
if(core){
 const deps={db:{rpc:forbiddenDB},verifier:{verify:rejectToken,assert:rejectToken},pagesVerifier:{verify:rejectToken,assert:rejectToken},storage:{},github:{},publicReader:{},repository:'test/native',baseSitemap:'',pathScopeAuthority:{},fetcher:forbiddenDB};
 disabled=core.composePrivateDelivery({...deps,enabled:false}).handler;
 enabled=core.composePrivateDelivery({...deps,enabled:true}).handler;
}
Deno.serve(async req=>{
 const path=new URL(req.url).pathname;
 if(path.endsWith('/_diagnostic'))return Response.json({module:import.meta.url,cwd:Deno.cwd(),files,coreLoaded:!!core,schemaCount,coreError});
 if(!core)return Response.json({coreError},{status:500});
 const response=await(path.includes('/_enabled/')?enabled(req):disabled(req));
 const headers=new Headers(response.headers);headers.set('X-Native-Private-Calls',String(dbCalls));headers.set('X-Native-Verifier-Calls',String(verifierCalls));
 return new Response(response.body,{status:response.status,headers});
});
