// Inactive FRA1 root lifecycle manager. Explicit --run + operator-controlled
// private plan required. It never reads GitHub/owner credentials or dispatches.
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,lstat,chown,chmod,rm,mkdtemp,mkdir,rmdir,open} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {privatePort} from './private-port.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
import {privateFile} from './owner-source.mjs';
export const ROOT='/opt/nyra-5c/bootstrap',STAGE='/opt/nyra-5c/live-runtime';
export const IMAGE='library/node@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94',LABEL='com.noctua.nyra.acceptance.live=pr20-fra1';
const cmd=(f,a,o={})=>execFileSync(f,a,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,...o}).trim();
const need=(v,c)=>{if(!v)throw Error('FRA1_LAUNCH_'+c);};
export function liveRoleArgs(role,uid,gid){
 need(['registrar','broker'].includes(role)&&Number.isInteger(uid)&&uid>0&&Number.isInteger(gid)&&gid>0,'ROLE');
 const args=['run','--rm','-i','--name','nyra-5c-live-'+role,'--label',LABEL,'--network','nyra-5c-db-private','--read-only','--user',uid+':'+gid,'--cap-drop','ALL','--security-opt','no-new-privileges:true','--pids-limit','64','--memory','384m','--cpus','1','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=32m','--mount','type=bind,src='+STAGE+',dst=/app,readonly'];
 for(const f of ['runtime.json','ipc.json',...(role==='broker'?['evidence-key.json']:[])])args.push('--mount','type=bind,src=/var/lib/nyra-5c/'+role+'/'+f+',dst=/run/role/'+f+',readonly');
 args.push('--mount','type=bind,src=/var/lib/nyra-5c/'+role+'/policy,dst=/run/role/policy,readonly');
 return [...args,'-e','NYRA_5C_LIVE_ROLE=1',IMAGE,'node','/app/ops/acceptance-bootstrap/live-role-worker.mjs'];
}
export function scopedFRA1Cleanup(command=cmd){
 const removed=[];for(const name of ['nyra-5c-live-registrar','nyra-5c-live-broker','nyra-5c-live-builder']){
  let label;try{label=command('docker',['inspect','-f','{{index .Config.Labels "com.noctua.nyra.acceptance.live"}}',name]);}catch{continue;}
  need(label==='pr20-fra1','CLEANUP_SCOPE');command('docker',['rm','-f',name]);removed.push(name);
 }return removed;
}
export function cleanupUnits(endsAt){
 const t=new Date(endsAt);need(Number.isFinite(t.getTime()),'DEADLINE');
 return {service:'[Unit]\nDescription=NYRA FRA1 live acceptance stop\n[Service]\nType=oneshot\nExecStart=/usr/bin/node '+STAGE+'/ops/acceptance-bootstrap/fra1-launch.mjs --cleanup\n',timer:'[Unit]\nDescription=NYRA FRA1 acceptance deadline\n[Timer]\nOnCalendar='+t.toISOString().slice(0,19).replace('T',' ')+' UTC\nPersistent=true\nUnit=nyra-5c-live-expiry.service\n[Install]\nWantedBy=timers.target\n'};
}
async function removeGenerated(){for(const role of ['registrar','broker'])for(const f of ['runtime.json','ipc.json','policy/state.json'])await rm('/var/lib/nyra-5c/'+role+'/'+f,{force:true});for(const role of ['registrar','broker'])await rmdir('/var/lib/nyra-5c/'+role+'/policy').catch(e=>{if(e.code!=='ENOENT')throw e;});await rm('/var/lib/nyra-5c/coordinator/role-ipc.json',{force:true});}
async function buildOffline(c,a){
 need(a.codeSHA===c.callerSHA&&a.builder?.codeSHA===c.callerSHA&&a.builder.privilege==='build','BUILD_PIN');
 need(cmd('git',['-C',ROOT,'rev-parse','HEAD'])===c.callerSHA&&cmd('git',['-C',ROOT,'status','--porcelain','--untracked-files=all'])==='','CLEAN_CHECKOUT');
 const paths=cmd('git',['-C',ROOT,'ls-files','-z']).split('\0').filter(Boolean),manifest={};for(const p of paths)manifest[p]=createHash('sha256').update(await readFile(join(ROOT,p))).digest('hex');
 const dir=await mkdtemp(join(tmpdir(),'nyra-real-rebuild-'));await chown(dir,c.coordinator.uid,c.coordinator.gid);await chmod(dir,0o700);
 try{
  const config=join(dir,'build.json');await writeFile(config,JSON.stringify({...a,sourceManifest:manifest}),{mode:0o600});await chown(config,c.coordinator.uid,c.coordinator.gid);
  const args=['run','--rm','--name','nyra-5c-live-builder','--label',LABEL,'--network','none','--user',c.coordinator.uid+':'+c.coordinator.gid,'--cap-drop','ALL','--security-opt','no-new-privileges:true','--read-only','--pids-limit','128','--memory','2g','--tmpfs','/tmp:rw,nosuid,nodev,size=512m','--mount','type=bind,src='+ROOT+',dst=/work,readonly','--mount','type=bind,src='+dir+',dst=/evidence','-w','/work','-e','GITHUB_PAGES_BASE=/'];
  // Public build configuration only; no caller-selected environment variable.
  const allowed=['VITE_OPERATIONS_API_URL','VITE_ADMIN_API_URL','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','VITE_TURNSTILE_SITE_KEY','VITE_MY_MENTOR_WEBSITE_URL'];
  for(const [k,v]of Object.entries(c.publicBuildEnvironment||{})){need(allowed.includes(k)&&typeof v==='string'&&!/sb_secret_|service_role|sk-proj-|PRIVATE KEY|Bearer /.test(v),'BUILD_ENV');args.push('-e',k+'='+v);}
  args.push(IMAGE,'node','--input-type=module','-e',"import {readFile,writeFile} from 'node:fs/promises';import {rebuildCleanNormal} from './lib/publication/integration/clean-rebuild.mjs';const c=JSON.parse(await readFile('/evidence/build.json'));await writeFile('/evidence/normal.json',JSON.stringify(await rebuildCleanNormal(c)),{flag:'wx',mode:0o600});");
  cmd('docker',args,{timeout:180000});need(cmd('git',['-C',ROOT,'rev-parse','HEAD'])===c.callerSHA&&cmd('git',['-C',ROOT,'status','--porcelain','--untracked-files=all'])==='','SOURCE_CHANGED');
  return JSON.parse(await readFile(join(dir,'normal.json'),'utf8'));
 }finally{await rm(dir,{recursive:true,force:true});}
}
async function launch(){
 need(process.env.NYRA_5C_FRA1_LAUNCH==='1'&&process.getuid?.()===0&&cmd('hostname',[])==='nyra-5c-acceptance','DISABLED');
 const c=await privateFile('/opt/nyra-5c/private/live-launch.json');const end=Date.parse(c.windowEndsAt);
 need(end>Date.now()&&end-Date.now()<=43200000,'WINDOW');const dbExpiry=await privateFile('/opt/nyra-5c/private/pg17-expiry.json');need(end<=Date.parse(dbExpiry.expiry),'DB_EXPIRY');need(cmd('systemctl',['is-active','nyra-5c-live-expiry.timer'])==='active','CLEANUP_TIMER');
 need(cmd('docker',['network','inspect','-f','{{.Internal}}','nyra-5c-db-private'])==='true','NETWORK');
 const network=JSON.parse(cmd('docker',['network','inspect','nyra-5c-db-private']))[0],bridge='br-'+network.Id.slice(0,12);
 cmd('iptables',['-C','INPUT','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP']);cmd('iptables',['-C','DOCKER-USER','-i',bridge,'!','-o',bridge,'-j','DROP']);need(cmd('git',['-C',ROOT,'rev-parse','HEAD'])===c.callerSHA,'CHECKOUT');need(cmd('git',['-C',ROOT,'status','--porcelain','--untracked-files=all'])==='','CLEAN_CHECKOUT');
 const units=cleanupUnits(c.windowEndsAt);for(const [kind,text]of Object.entries(units))need(await readFile('/etc/systemd/system/nyra-5c-live-expiry.'+kind,'utf8')===text,'TIMER_PIN');
 const files=JSON.parse(await readFile(STAGE+'/runtime-files.json','utf8'));for(const f of files)need(!f.includes('..')&&!f.startsWith('/')&&createHash('sha256').update(await readFile(STAGE+'/'+f)).digest('hex')===createHash('sha256').update(await readFile(ROOT+'/'+f)).digest('hex'),'STAGE_PIN');
 const users=Object.fromEntries(['registrar','broker','coordinator'].map(role=>{const u=cmd('getent',['passwd','nyra-'+role]).split(':');need(Number(u[2])>0&&u[6]==='/usr/sbin/nologin','OS_ROLE');return [role,{uid:Number(u[2]),gid:Number(u[3])}];}));c.coordinator=users.coordinator;
 const cc=JSON.parse(await readFile('/var/lib/nyra-5c/coordinator/live.json','utf8'));need(hashJSON(cc.policies)===hashJSON(c.policies)&&cc.callerSHA===c.callerSHA&&cc.windowEndsAt===c.windowEndsAt&&cc.mode===c.mode&&cc.evidenceKeyId===c.evidenceKeyId,'COORDINATOR_CONFIG');
 const groupIds=cmd('id',['-G','nyra-coordinator']).split(/\s+/).map(Number),expectedGroups=[users.coordinator.gid,c.ingressGroupId,c.receiptGroupId];need(expectedGroups.every(Number.isInteger)&&groupIds.every(g=>expectedGroups.includes(g))&&expectedGroups.every(g=>groupIds.includes(g)),'COORDINATOR_GROUPS');
 const lock=await open('/opt/nyra-5c/private/live.lock','wx',0o600);await lock.writeFile(String(process.pid));await lock.close();
 const children=[],keys={registrar:randomBytes(32).toString('hex'),broker:randomBytes(32).toString('hex'),builder:randomBytes(32).toString('hex')};
 const save=async(p,v,user)=>{await writeFile(p,JSON.stringify(v),{flag:'wx',mode:0o600});await chown(p,user.uid,user.gid);};let coordinator,timer;
 try{
  for(const role of ['registrar','broker']){
   const dir='/var/lib/nyra-5c/'+role,meta=await lstat(dir+'/pg.json');need(meta.uid===users[role].uid&&(meta.mode&0o077)===0&&!meta.isSymbolicLink(),'ROLE_SECRET');
   const db=JSON.parse(await readFile(dir+'/pg.json','utf8'));
   const state=c.policyStates;need(state&&['build','inspection','publication'].every(r=>state[r]?.mode==='SINGLE_OWNER'&&state[r].policyVersion===c.policies[r].governance.policyVersion&&state[r].policySHA256===hashJSON(c.policies[r])&&state[r].ownerAuthorizationSHA===c.policies[r].governance.ownerAuthorizationSHA),'POLICY_STATE');
   await mkdir(dir+'/policy',{mode:0o700});await chown(dir+'/policy',users[role].uid,users[role].gid);await save(dir+'/policy/state.json',state,users[role]);
   await save(dir+'/runtime.json',{role,mode:c.mode,policies:c.policies,db,evidencePublicKey:c.evidencePublicKey,evidenceKeyId:c.evidenceKeyId},users[role]);await save(dir+'/ipc.json',{hex:keys[role]},users[role]);
   children.push(spawn('docker',liveRoleArgs(role,users[role].uid,users[role].gid),{stdio:['pipe','pipe','ignore']}));
  }
  await save('/var/lib/nyra-5c/coordinator/role-ipc.json',keys,users.coordinator);
  coordinator=spawn('setpriv',['--reuid='+users.coordinator.uid,'--regid='+users.coordinator.gid,'--init-groups','--no-new-privs',process.execPath,STAGE+'/ops/acceptance-bootstrap/fra1-runtime.mjs'],{env:{PATH:process.env.PATH,NYRA_5C_FRA1_RUNTIME:'1'},stdio:['ignore','pipe','ignore',children[0].stdin,children[0].stdout,children[1].stdin,children[1].stdout,'pipe','pipe']});
  // Dedicated inherited FD pair. Root accepts ONLY a fixed isolated build op.
  const builder=privatePort({role:'registrar',key:Buffer.from(keys.builder,'hex'),side:'worker',input:coordinator.stdio[8],output:coordinator.stdio[7],onCall:(op,a)=>{need(op==='build','ROOT_OPERATION');return buildOffline(c,a);},timeout:180000});
  coordinator.stdout.on('data',b=>{if(String(b).trim()==='NYRA_FRA1_PRIVATE_WATCHER_ARMED_NO_DISPATCH')console.log('NYRA_FRA1_PRIVATE_WATCHER_ARMED_NO_DISPATCH');});
  await new Promise((resolve,reject)=>{timer=setTimeout(()=>{coordinator.kill('SIGTERM');reject(Error('WINDOW_EXPIRED'));},end-Date.now());for(const child of children){child.on('error',reject);child.on('exit',()=>{if(coordinator.exitCode===null){coordinator.kill('SIGTERM');reject(Error('ROLE_EXIT'));}});}coordinator.on('error',reject);coordinator.on('exit',code=>code===0?resolve():reject(Error('COORDINATOR_EXIT')));process.once('SIGTERM',()=>coordinator.kill('SIGTERM'));process.once('SIGINT',()=>coordinator.kill('SIGTERM'));});builder.close();
 }finally{clearTimeout(timer);if(coordinator?.exitCode===null){coordinator.kill('SIGTERM');await new Promise(resolve=>{const t=setTimeout(()=>{coordinator.kill('SIGKILL');resolve();},5000);coordinator.once('exit',()=>{clearTimeout(t);resolve();});});}for(const child of children)child.stdin.end();scopedFRA1Cleanup();await removeGenerated();await rm('/opt/nyra-5c/private/live.lock',{force:true});}
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{
 if(process.argv[2]==='--run')await launch();else if(process.argv[2]==='--cleanup'){need(process.getuid?.()===0&&cmd('hostname',[])==='nyra-5c-acceptance','HOST');scopedFRA1Cleanup();await removeGenerated();await rm('/opt/nyra-5c/private/live.lock',{force:true});}else throw Error('MODE');
}catch{console.error('NYRA_FRA1_LIFECYCLE_CLOSED');process.exitCode=1;}}
