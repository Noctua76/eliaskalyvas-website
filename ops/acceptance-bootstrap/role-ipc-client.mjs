// Dependency-free short-lived coordinator receive boundary. A signed response
// alone is insufficient: require exactly one response AND successful worker exit.
import {createInterface} from 'node:readline';
export function receiveRoleIPC({child,role,request,response,timeout=20000}){
 return new Promise((resolve,reject)=>{
  let finished=false,outputLines=0,verified=null;
  const lines=createInterface({input:child.stdout,crlfDelay:Infinity});
  const done=(error)=>{if(finished)return;finished=true;clearTimeout(timer);lines.close();
   if(error){if(child.exitCode===null&&child.signalCode===null&&!child.killed)child.kill();reject(error);}
   else resolve(verified);};
  const timer=setTimeout(()=>done(Error('NYRA_IPC_TIMEOUT')),timeout);
  lines.on('line',line=>{
   try{
    if(++outputLines!==1||Buffer.byteLength(line)>=4096)throw Error('OUTPUT');
    const body=response.decode(JSON.parse(line));
    if(body?.ok!==true||body.result?.role!==role||body.result.dbAuthenticated!==true||
     body.result.roleGrantsVerified!==true||body.result.recordsWritten!==0)throw Error('RESPONSE');
    verified=body.result;
   }catch{done(Error('NYRA_IPC_RESPONSE_DENIED'));}
  });
  child.on('error',()=>done(Error('NYRA_IPC_DOCKER_START')));
  child.stdin.on('error',()=>done(Error('NYRA_IPC_WORKER_INPUT')));
  child.on('close',code=>{if(code!==0)done(Error('NYRA_IPC_WORKER_EXIT'));
   else if(!verified||outputLines!==1)done(Error('NYRA_IPC_NO_RESPONSE'));
   else done();});
  child.stdin.end(JSON.stringify(request.encode({op:'identity'}))+'\n');
 });
}
