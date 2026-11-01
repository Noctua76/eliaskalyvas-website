// PRIVATE HTTPS ingress adapter. A reverse proxy may route ONLY the exact
// readiness/acceptance paths to this process after external host approval.
// This module does not start a listener, provision secrets, or authorize jobs.
import {createServer} from 'node:http';
import {lstat,chmod} from 'node:fs/promises';
import {dirname} from 'node:path';
const ROLES=Object.freeze(['build','inspection','publication']);
const ROOT='https://nyra-5c.eliaskalyvas.gr';
const READY=/^\/ready\/(build|inspection|publication)\/([1-9][0-9]{0,19})\/([1-9][0-9]{0,19})$/;
const ACCEPT=/^\/acceptance\/(build|inspection|publication)$/;
function json(body,status=200){
 return new Response(JSON.stringify(body),{status,headers:{
 'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
 }});
}
export function createIngressHandler({watcher,acceptors,enabled=false,origin=ROOT}){
 if(new URL(origin).origin!==origin||!origin.startsWith('https://'))throw Error('INGRESS_ORIGIN');
 if(typeof watcher?.isReady!=='function'||!ROLES.every(r=>typeof acceptors?.[r]==='function'))
  throw Error('INGRESS_BINDINGS_REQUIRED');
 return async request=>{
  if(!enabled)return new Response(null,{status:503});
  try{
   const url=new URL(request.url),method=request.method;
   if(url.origin!==origin||url.search||url.hash)return new Response(null,{status:404});
   const ready=url.pathname.match(READY);
   if(method==='GET'&&ready){
    const isReady=await watcher.isReady({role:ready[1],runId:ready[2],runAttempt:ready[3]});
    return json({ready:isReady===true,authorization:false});
   }
   const accepted=url.pathname.match(ACCEPT);
   if(method!=='POST'||!accepted)return new Response(null,{status:404});
   const token=request.headers.get('authorization');
   if(!token?.startsWith('Bearer ')||token.length>20007||!request.body)
    return new Response(null,{status:403});
   const raw=await request.text();
   if(raw!=='{}')return new Response(null,{status:403});
   // Only trusted, role-bound broker/observation acceptors verify OIDC,
   // revalidate policy and persist signed sanitized evidence.
   const result=await acceptors[accepted[1]](token.slice(7));
   if(result?.accepted!==true||!(/^[a-f0-9]{64}$/).test(result.digest)||
      typeof result.keyId!=='string'||!result.keyId||result.keyId.length>120)
    throw Error('EVIDENCE_DENIED');
   return json({accepted:true,digest:result.digest,keyId:result.keyId});
  }catch{return new Response(null,{status:403});}
 };
}
export async function startUnixIngress({handler,socketPath,groupId,enable=false,origin=ROOT}){
 if(new URL(origin).origin!==origin||!origin.startsWith('https://'))throw Error('INGRESS_ORIGIN');
 if(!enable||typeof handler!=='function'||typeof socketPath!=='string'||
   !socketPath.startsWith('/run/nyra-5c/')||!Number.isInteger(groupId)||
   process.getuid?.()===0)throw Error('INGRESS_DISABLED');
 const dir=await lstat(dirname(socketPath));
 if(!dir.isDirectory()||(dir.mode&0o007)||dir.uid!==process.getuid())
  throw Error('INGRESS_PRIVATE_DIRECTORY');
 const server=createServer(async(req,res)=>{
  // No request/header/body logging, no URL-based upstream/proxy capability.
  let bytes=Buffer.alloc(0);
  try{
   if((req.headers['content-length']&&Number(req.headers['content-length'])>2)||
     req.headers['transfer-encoding'])throw Error('INGRESS_BODY');
   for await(const b of req){
    if(bytes.length+b.length>2)throw Error('INGRESS_BODY');
    bytes=Buffer.concat([bytes,b]);
   }
   const input=new Request(origin+(req.url||'/'),{method:req.method,
    headers:{authorization:req.headers.authorization||''},
    ...(req.method==='POST'?{body:bytes}:{})});
   const out=await handler(input);
   res.writeHead(out.status,{
    'Cache-Control':'no-store','Content-Type':'application/json',
    'X-Content-Type-Options':'nosniff'
   });
   res.end(out.status===200?await out.text():'');
  }catch{res.writeHead(403,{'Cache-Control':'no-store'});res.end();}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 await new Promise((ok,no)=>{server.once('error',no);server.listen(socketPath,ok);});
 try{
  const {chown}=await import('node:fs/promises');
  await chown(socketPath,process.getuid(),groupId);await chmod(socketPath,0o660);
 }catch(e){server.close();throw e;}
 return server;
}
