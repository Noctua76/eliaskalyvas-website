// Host-side disposable, private role-login smoke probes. No policy activation.
import {execFileSync} from 'node:child_process';
import {readFile,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {DB,NET,IMAGE as PG_IMAGE} from './db-stage.mjs';
const roles=Object.freeze(['registrar','broker']);
const NODE_IMAGE='library/node@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94';
const root=resolve(new URL('../..',import.meta.url).pathname);
const cmd=(exe,args,extra={})=>execFileSync(exe,args,{encoding:'utf8',timeout:120000,
 stdio:['ignore','pipe','pipe'],...extra}).trim();
const need=(ok,code)=>{if(!ok)throw Error('ROLE_PROBE_'+code);};
export function roleCommand(role,uid,gid){
 need(roles.includes(role)&&Number.isSafeInteger(uid)&&uid>0&&Number.isSafeInteger(gid)&&gid>0,'ARGS');
 return ['run','--rm','--name','nyra-5c-probe-'+role,
 '--network',NET,'--read-only','--user',uid+':'+gid,'--security-opt','no-new-privileges:true',
 '--cap-drop','ALL','--pids-limit','64','--memory','256m','--cpus','0.5',
 '--tmpfs','/tmp:rw,nosuid,nodev,size=16m',
 '--mount','type=bind,src=/var/lib/nyra-5c/'+role+'/pg.json,dst=/run/role/pg.json,readonly',
 '--mount','type=bind,src='+root+'/ops/acceptance-bootstrap/role-db-check.mjs,dst=/app/role-db-check.mjs,readonly',
 '--mount','type=bind,src='+root+'/ops/native-acceptance/node_modules,dst=/app/node_modules,readonly',
 NODE_IMAGE,'node','/app/role-db-check.mjs',role];
}
export function probePlan(){
 return {schema:'nyra.acceptance.role-probe.v1',roles:[...roles],nodeImage:NODE_IMAGE,
  dbImage:PG_IMAGE,network:NET,publicPorts:0,operation:'role-authentication-only',
  containersPermanent:0,authorization:false};
}
async function probe(){
 need(process.getuid?.()===0,'ROOT');
 need(cmd('hostname',[])==='nyra-5c-acceptance','HOST');
 need(cmd('docker',['network','inspect','-f','{{.Internal}}',NET])==='true','PRIVATE_NETWORK');
 need(cmd('docker',['inspect','-f','{{.State.Running}}',DB])==='true','DB_INACTIVE');
 need(['{}','null'].includes(cmd('docker',['inspect','-f','{{json .HostConfig.PortBindings}}',DB])),'DB_PUBLIC');
 need(cmd('systemctl',['is-active','nyra-5c-db-expiry.timer'])==='active','EXPIRY');
 const lock=JSON.parse(await readFile(root+'/ops/native-acceptance/package-lock.json','utf8'));
 need(lock.packages?.['node_modules/pg']?.version==='8.16.3','PG_DRIVER_LOCK');
 const driver=await lstat(root+'/ops/native-acceptance/node_modules/pg/lib/index.js');
 need(driver.isFile()&&!driver.isSymbolicLink(),'DRIVER_UNAVAILABLE');
 const script=await lstat(root+'/ops/acceptance-bootstrap/role-db-check.mjs');
 need(script.isFile()&&!script.isSymbolicLink(),'SCRIPT_UNAVAILABLE');
 // Pull before execution: isolated containers have no internet egress.
 cmd('docker',['pull',NODE_IMAGE],{timeout:300000});
 const results=[];
 for(const role of roles){
  const user=cmd('getent',['passwd','nyra-'+role]).split(':');
  need(user.length>=7&&user[6]==='/usr/sbin/nologin','ROLE_USER');
  const uid=Number(user[2]),gid=Number(user[3]);
  const privateFile=await lstat('/var/lib/nyra-5c/'+role+'/pg.json');
  need(privateFile.isFile()&&!privateFile.isSymbolicLink()&&
   privateFile.uid===uid&&privateFile.gid===gid&&(privateFile.mode&0o077)===0,'ROLE_FILE');
  results.push(JSON.parse(cmd('docker',roleCommand(role,uid,gid),{timeout:60000})));
 }
 return {schema:'nyra.acceptance.role-probe.v1',loginIsolationPassed:true,
  results,publicPorts:0,brokerRegistrarRuntimeConnected:false,
  credentialsExposed:false,authorization:false,realAcceptance:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{
  const mode=process.argv[2];need(['--dry-run','--run'].includes(mode),'MODE');
  const result=mode==='--dry-run'?probePlan():await probe();
  console.log(JSON.stringify(result,null,2));
 }catch(e){console.error(String(e.message).replace(/[a-f0-9]{48}/g,'[redacted]').slice(0,180));process.exitCode=1;}
}
