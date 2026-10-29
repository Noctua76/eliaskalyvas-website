// Test-only worker entry; application modules and schemas are unchanged inputs.
import {readFileSync} from 'node:fs';
const names=['shared','release','manifest','event','receipt','dataset'];
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
const files={};
for(const name of names){
 const relative='contracts/nyra-publication/v1.1/'+name+'.schema.json';
 const url=new URL('__SCHEMA_REL__'+name+'.schema.json',import.meta.url);
 files[name]={};
 for(const [kind,load]of Object.entries({denoRelative:()=>Deno.readFileSync(relative),denoURL:()=>Deno.readFileSync(url),nodeRelative:()=>readFileSync(relative),nodeURL:()=>readFileSync(url)})){
  try {const bytes=load();files[name][kind]={sha256:await hash(bytes),length:bytes.length};}catch(e){files[name][kind]={error:String(e)};}
 }
}
let core=null,coreError=null;
try{core=await import('./index.ts');}catch(e){coreError=String(e);}
const forbidden=()=>{throw Error('INVALID_MACHINE_AUTHORIZATION');};
let disabled,enabled;
if(core){const dependencies={db:{rpc:forbidden},verifier:{verify:forbidden,assert:forbidden},pagesVerifier:{verify:forbidden,assert:forbidden},storage:{},github:{},publicReader:{},repository:'test/native',baseSitemap:'',pathScopeAuthority:{},fetcher:forbidden};disabled=core.composePrivateDelivery({...dependencies,enabled:false}).handler;enabled=core.composePrivateDelivery({...dependencies,enabled:true}).handler;}
Deno.serve(req=>{
 const path=new URL(req.url).pathname;
 if(path.endsWith('/_diagnostic'))return Response.json({module:import.meta.url,cwd:Deno.cwd(),files,coreLoaded:!!core,coreError});
 if(!core)return Response.json({coreError},{status:500});
 return path.includes('/_enabled/')?enabled(req):disabled(req);
});
