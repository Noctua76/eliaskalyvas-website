// Explicit fresh-host launcher; no provider API, dispatch, owner endpoint or
// inventory fallback. The old FRA1 launcher is never invoked.
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,chown,lstat,rm,open} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {privateFile} from './owner-source.mjs';
import {validateReplacementTarget} from './replacement-target.mjs';
import {cleanupByDigest} from './cleanup.mjs';
import {privatePort} from './private-port.mjs';
import {buildOffline,IMAGE,ROOT,STAGE} from './fra1-launch.mjs';
import {reviewedAcceptancePolicies} from '../../lib/publication/integration/live-acceptance.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
const run=(f,a)=>execFileSync(f,a,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}).trim();
const need=(v,c)=>{if(!v)throw Error('REPLACEMENT_LAUNCH_'+c);};
export function replacementRoleArgs(role,uid,gid,{target,policyGroupID}){
 validateReplacementTarget(target,{created:true});need(['registrar','broker'].includes(role)&&uid>0&&gid>0&&Number.isInteger(policyGroupID)&&policyGroupID>0,'ROLE');
 const digest=hashJSON(target),own='/var/lib/nyra-5c/'+role;
 const args=['run','--rm','-i','--name','nyra-5c-live-'+role,'--label','com.noctua.nyra.acceptance='+digest,'--network','nyra-repository-db','--read-only','--user',uid+':'+gid,'--group-add',String(policyGroupID),'--cap-drop','ALL','--security-opt','no-new-privileges:true','--pids-limit','64','--memory','384m','--cpus','1','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=32m','--mount','type=bind,src='+STAGE+',dst=/app,readonly'];
 for(const name of ['runtime.json','ipc.json',...(role==='broker'?['evidence-key.json']:[])])args.push('--mount','type=bind,src='+own+'/'+name+',dst=/run/role/'+name+',readonly');
 args.push('--mount','type=bind,src=/var/lib/nyra-5c/policy,dst=/run/role/policy,readonly','-e','NYRA_5C_LIVE_ROLE=1',IMAGE,'node','/app/ops/acceptance-bootstrap/live-role-worker.mjs');return args;
}
export function cleanupReplacement(target,{execute,apply=false}={}){
 validateReplacementTarget(target,{created:true,allowExpired:true});return cleanupByDigest(hashJSON(target),{execute,apply});
}
async function launch(path){
 need(process.getuid?.()===0&&process.env.NYRA_REPOSITORY_LAUNCH==='1','DISABLED');
 const c=await privateFile(path);need(c.githubReadCredential==='/var/lib/nyra-5c/coordinator/admin-read.json'&&c.ownerKeyFile==='/var/lib/nyra-5c/coordinator/owner-public.json'&&c.evidenceKeyFile==='/var/lib/nyra-5c/coordinator/evidence-public.json'&&c.evidenceDirectory==='/var/lib/nyra-5c/coordinator/evidence','PRIVATE_PATHS');validateReplacementTarget(c.target,{created:true});need(run('hostname',[])===c.target.hostname,'HOST');
 need(run('systemctl',['is-active','nyra-repository-expiry.timer'])==='active','TIMER');
 need(run('docker',['network','inspect','-f','{{.Internal}}','nyra-repository-db'])==='true','NETWORK');
 // Private roles can reach only their internal DB network, never the host.
 const net=JSON.parse(run('docker',['network','inspect','nyra-repository-db']))[0],bridge='br-'+net.Id.slice(0,12);
 run('iptables',['-C','INPUT','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP']);run('iptables',['-C','DOCKER-USER','-i',bridge,'!','-o',bridge,'-j','DROP']);
 const policies=reviewedAcceptancePolicies(c.configuration),caller=c.configuration.repositoryTrust.sourceSHA;
 need(run('git',['-C',ROOT,'rev-parse','HEAD'])===caller&&run('git',['-C',ROOT,'status','--porcelain','--untracked-files=all'])==='','MAIN_SOURCE_PIN');
 const staged=JSON.parse(await readFile(STAGE+'/runtime-files.json'));for(const f of staged)need(!f.includes('..')&&!f.startsWith('/')&&hashJSON(await readFile(STAGE+'/'+f,'utf8'))===hashJSON(await readFile(ROOT+'/'+f,'utf8')),'STAGE_PIN');
 const users=Object.fromEntries(['coordinator','registrar','broker'].map(role=>{const u=run('getent',['passwd','nyra-'+role]).split(':');need(Number(u[2])>0&&u[6]==='/usr/sbin/nologin','USER');return [role,{uid:Number(u[2]),gid:Number(u[3])}];}));
 const policyGroupID=Number(run('getent',['group','nyra-policy']).split(':')[2]);
 const state=c.policyStates;need(state&&['build','inspection','publication'].every(r=>state[r]?.policySHA256===hashJSON(policies[r])&&state[r].mode==='SINGLE_OWNER'&&state[r].policyVersion===policies[r].governance.policyVersion&&state[r].ownerAuthorizationSHA===policies[r].governance.ownerAuthorizationSHA),'STATE_PIN');
 const keys={registrar:randomBytes(32).toString('hex'),broker:randomBytes(32).toString('hex'),builder:randomBytes(32).toString('hex')},children=[];let coordinator,timer,builder;
 const save=async(p,value,owner,mode=0o600,gid=owner.gid)=>{await writeFile(p,JSON.stringify(value),{flag:'wx',mode});await chown(p,owner.uid,gid);};
 const lock=await open('/opt/nyra-5c/private/repository.lock','wx',0o600);await lock.close();
 try{
  await save('/var/lib/nyra-5c/policy/state.json',state,users.coordinator,0o640,policyGroupID);
  for(const role of ['registrar','broker']){
   const db=await readFile('/var/lib/nyra-5c/'+role+'/pg.json','utf8'),st=await lstat('/var/lib/nyra-5c/'+role+'/pg.json');need(st.uid===users[role].uid&&(st.mode&0o077)===0&&!st.isSymbolicLink(),'ROLE_CREDENTIAL');
   await save('/var/lib/nyra-5c/'+role+'/runtime.json',{role,mode:c.configuration.acceptanceMode,policies,db:JSON.parse(db),evidencePublicKey:c.evidencePublicJWK,evidenceKeyId:c.evidenceKeyId,policyOwnerUID:users.coordinator.uid,policyGroupID},users[role]);
   await save('/var/lib/nyra-5c/'+role+'/ipc.json',{hex:keys[role]},users[role]);
   children.push(spawn('docker',replacementRoleArgs(role,users[role].uid,users[role].gid,{target:c.target,policyGroupID}),{stdio:['pipe','pipe','ignore']}));
  }
  await save('/var/lib/nyra-5c/coordinator/role-ipc.json',keys,users.coordinator);
  const cc={...c,callerSHA:caller,origin:c.target.origin,windowStartsAt:c.target.createdAt,windowEndsAt:c.target.expiresAt,roleIPCFile:'/var/lib/nyra-5c/coordinator/role-ipc.json',policyStateFile:'/var/lib/nyra-5c/policy/state.json'};
  await save('/var/lib/nyra-5c/coordinator/repository.json',cc,users.coordinator);
  coordinator=spawn('setpriv',['--reuid='+users.coordinator.uid,'--regid='+users.coordinator.gid,'--init-groups','--no-new-privs',process.execPath,STAGE+'/ops/acceptance-bootstrap/repository-runtime.mjs','/var/lib/nyra-5c/coordinator/repository.json'],{env:{PATH:process.env.PATH,NYRA_REPOSITORY_ACCEPTANCE:'1'},stdio:['ignore','ignore','ignore',children[0].stdin,children[0].stdout,children[1].stdin,children[1].stdout,'pipe','pipe']});
  builder=privatePort({role:'registrar',key:Buffer.from(keys.builder,'hex'),side:'worker',input:coordinator.stdio[8],output:coordinator.stdio[7],onCall:(op,a)=>{need(op==='build','ROOT_OPERATION');return buildOffline({...c,callerSHA:caller,coordinator:users.coordinator,resourceLabel:'com.noctua.nyra.acceptance='+hashJSON(c.target)},a);},timeout:180000});
  await new Promise((ok,no)=>{timer=setTimeout(()=>{coordinator.kill('SIGTERM');no(Error('EXPIRED'));},Date.parse(c.target.expiresAt)-Date.now());for(const child of children){child.once('error',no);child.once('exit',()=>{if(coordinator.exitCode===null){coordinator.kill('SIGTERM');no(Error('ROLE_EXIT'));}});}coordinator.once('error',no);coordinator.once('exit',code=>code===0?ok():no(Error('COORDINATOR_EXIT')));process.once('SIGTERM',()=>coordinator.kill('SIGTERM'));process.once('SIGINT',()=>coordinator.kill('SIGTERM'));});
 }finally{
  clearTimeout(timer);if(coordinator?.exitCode===null){coordinator.kill('SIGTERM');await new Promise(ok=>{const t=setTimeout(()=>{coordinator.kill('SIGKILL');ok();},5000);coordinator.once('exit',()=>{clearTimeout(t);ok();});});}builder?.close();for(const child of children)child.stdin.end();
  // On a failed/expired run preserve the private DB/evidence for retirement
  // verification until the independent hard deadline. Stop exact role/builder
  // containers only; the host cleanup timer owns complete scoped DB teardown.
  for(const name of ['nyra-5c-live-registrar','nyra-5c-live-broker','nyra-5c-live-builder']){const ids=run('docker',['ps','-aq','--filter','name=^'+name+'$','--filter','label=com.noctua.nyra.acceptance='+hashJSON(c.target)]);if(ids){run('docker',['rm','-f',name]);need(run('docker',['ps','-aq','--filter','name=^'+name+'$'])==='','CLEANUP_REMAINS');}}
  for(const role of ['registrar','broker'])for(const f of ['runtime.json','ipc.json'])await rm('/var/lib/nyra-5c/'+role+'/'+f,{force:true});
  for(const p of ['/var/lib/nyra-5c/coordinator/role-ipc.json','/var/lib/nyra-5c/coordinator/repository.json','/opt/nyra-5c/private/repository.lock'])await rm(p,{force:true});
 }
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{if(process.argv[2]==='--run')await launch(process.argv[3]);else if(process.argv[2]==='--cleanup'){need(process.getuid?.()===0,'ROOT');const t=await privateFile(process.argv[3]);need(run('hostname',[])===t.hostname,'HOST');console.log(JSON.stringify(cleanupReplacement(t,{apply:true})));}else throw Error('MODE');}catch{console.error('NYRA_REPLACEMENT_LAUNCH_CLOSED');process.exitCode=1;}}
