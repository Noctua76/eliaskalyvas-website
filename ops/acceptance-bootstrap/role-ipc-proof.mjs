// Short-lived host coordinator proof of real role process / authenticated IPC.
// This does NOT register GitHub jobs, start HTTP, use OIDC, or authorize owner.
import {execFileSync,spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,chown,chmod,lstat,rm} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {authenticatedFrames} from '../../lib/publication/runtime/acceptance-ipc.mjs';
import {NET,DB} from './db-stage.mjs';
const ROOT='/opt/nyra-5c/bootstrap',ROLES=['registrar','broker'];
const IMAGE='library/node@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94';
const LABEL='com.noctua.nyra.acceptance.ipc=pr20-private-smoke';
const need=(v,c)=>{if(!v)throw Error('NYRA_IPC_'+c);};
const command=(f,args,options={})=>execFileSync(f,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000,...options}).trim();
export function roleIPCArgs(role,uid,gid,keyPath){
 need(ROLES.includes(role)&&Number.isSafeInteger(uid)&&uid>0&&
  Number.isSafeInteger(gid)&&gid>0&&
  typeof keyPath==='string'&&
  /^\/var\/lib\/nyra-5c\/(registrar|broker)\/\.ipc-proof-[a-f0-9]{16}$/.test(keyPath)&&
  keyPath.startsWith('/var/lib/nyra-5c/'+role+'/'),'ARGS');
 return ['run','--rm','-i','--name','nyra-5c-ipc-'+role,
  '--label',LABEL,'--network',NET,'--read-only','--user',uid+':'+gid,
  '--cap-drop','ALL','--security-opt','no-new-privileges:true',
  '--pids-limit','64','--memory','256m','--cpus','0.5',
  '--tmpfs','/tmp:rw,nosuid,nodev,size=16m',
  '--mount','type=bind,src='+ROOT+'/ops/acceptance-bootstrap/role-ipc-worker.mjs,dst=/app/ops/acceptance-bootstrap/role-ipc-worker.mjs,readonly',
  '--mount','type=bind,src='+ROOT+'/lib/publication,dst=/app/lib/publication,readonly',
  '--mount','type=bind,src='+ROOT+'/ops/native-acceptance/node_modules,dst=/app/node_modules,readonly',
  '--mount','type=bind,src=/var/lib/nyra-5c/'+role+'/pg.json,dst=/run/role/pg.json,readonly',
  '--mount','type=bind,src='+keyPath+',dst=/run/role/ipc.key,readonly',
  '-e','NYRA_5C_ROLE_IPC_PROOF=1',IMAGE,'node',
  '/app/ops/acceptance-bootstrap/role-ipc-worker.mjs',role];
}
function stopScoped(role){
 const name='nyra-5c-ipc-'+role;
 try{
  const v=command('docker',['inspect','-f',
   '{{index .Config.Labels "com.noctua.nyra.acceptance.ipc"}}',name]);
  if(v==='pr20-private-smoke')command('docker',['rm','-f',name]);
 }catch{/* never stop a container not carrying our exact label */}
}
async function invokeRole(role){
 const user=command('getent',['passwd','nyra-'+role]).split(':');
 need(user.length>=7&&user[6]==='/usr/sbin/nologin','IDENTITY');
 const uid=Number(user[2]),gid=Number(user[3]);
 const privateConfig=await lstat('/var/lib/nyra-5c/'+role+'/pg.json');
 need(privateConfig.isFile()&&!privateConfig.isSymbolicLink()&&
   privateConfig.uid===uid&&privateConfig.gid===gid&&
   (privateConfig.mode&0o077)===0,'ROLE_SECRET');
 const key=randomBytes(32);
 const keyPath='/var/lib/nyra-5c/'+role+'/.ipc-proof-'+randomBytes(8).toString('hex');
 await writeFile(keyPath,key,{flag:'wx',mode:0o600});
 let child;
 try{
  await chown(keyPath,uid,gid);await chmod(keyPath,0o600);
  const request=authenticatedFrames({key,role,direction:'request'});
  const response=authenticatedFrames({key,role,direction:'response'});
  child=spawn('docker',roleIPCArgs(role,uid,gid,keyPath),{stdio:['pipe','pipe','ignore']});
  const result=await new Promise((resolve,reject)=>{
   let finished=false,outputLines=0;
   const done=(err,val)=>{if(finished)return;finished=true;clearTimeout(timer);
    err?reject(err):resolve(val);};
   const timer=setTimeout(()=>done(Error('NYRA_IPC_TIMEOUT')),20000);
   createInterface({input:child.stdout,crlfDelay:Infinity}).on('line',line=>{
    try{
     need(++outputLines===1&&Buffer.byteLength(line)<4096,'OUTPUT');
     const body=response.decode(JSON.parse(line));
     need(body?.ok===true&&body.result?.role===role&&
      body.result.dbAuthenticated===true&&body.result.roleGrantsVerified===true&&
      body.result.recordsWritten===0,'RESPONSE');
     done(null,body.result);
    }catch{done(Error('NYRA_IPC_RESPONSE_DENIED'));}
   });
   child.on('error',()=>done(Error('NYRA_IPC_DOCKER_START')));
   child.on('close',code=>{if(code!==0)done(Error('NYRA_IPC_WORKER_EXIT'));else if(!finished)done(Error('NYRA_IPC_NO_RESPONSE'));});
   child.stdin.end(JSON.stringify(request.encode({op:'identity'}))+'\n');
  });
  return {...result,authenticatedIPC:true};
 }finally{
  if(child&&!child.killed)child.kill();
  stopScoped(role);
  await rm(keyPath,{force:true});
 }
}
async function run(){
 need(process.getuid?.()===0&&command('hostname',[])==='nyra-5c-acceptance','HOST');
 need(command('docker',['network','inspect','-f','{{.Internal}}',NET])==='true','NETWORK');
 need(command('docker',['inspect','-f','{{.State.Running}}',DB])==='true','DB');
 need(command('systemctl',['is-active','nyra-5c-db-expiry.timer'])==='active','EXPIRY');
 const lock=JSON.parse(await readFile(ROOT+'/ops/native-acceptance/package-lock.json','utf8'));
 need(lock.packages?.['node_modules/pg']?.version==='8.16.3','DRIVER_PIN');
 need((await lstat(ROOT+'/ops/native-acceptance/node_modules/pg/lib/index.js')).isFile(),'DRIVER');
 command('docker',['pull',IMAGE],{timeout:300000});
 const results=[];
 for(const role of ROLES)results.push(await invokeRole(role));
 return {schema:'nyra.acceptance.role-ipc-proof.v1',results,
  distinctOSProcesses:true,authenticatedRoleBoundIPC:true,publicPorts:0,
  githubCredentialsUsed:false,realJobsRegistered:0,
  persistentServicesStarted:false,ownerAuthorization:false,realAcceptance:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{
  const mode=process.argv[2];need(['--dry-run','--run'].includes(mode),'MODE');
  const out=mode==='--dry-run'?{schema:'nyra.acceptance.role-ipc-proof.v1',
   roles:ROLES,privateNetwork:NET,temporaryProcessPerRole:true,
   authenticatedIPC:true,publicPorts:0,ownerAuthorization:false}:
   await run();
  console.log(JSON.stringify(out,null,2));
 }catch(e){console.error(String(e.message).slice(0,140));process.exitCode=1;}
}
