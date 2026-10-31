// NYRA Phase 5C temporary PostgreSQL 17 stage: no production, no public DB port.
// Host-only --apply; automatic 12-hour resource expiry before any credentials.
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,lstat,chown,chmod,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {assessHost,readHostFacts} from './host-preflight.mjs';
export const IMAGE='supabase/postgres@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00';
export const DB='nyra-5c-pg17',NET='nyra-5c-db-private';
export const LABEL='com.noctua.nyra.acceptance.db=pr20-fra1-temporary';
const ROOT='/opt/nyra-5c/private',MARKER=ROOT+'/pg17-expiry.json';
const timer='/etc/systemd/system/nyra-5c-db-expiry.timer',service='/etc/systemd/system/nyra-5c-db-expiry.service';
const roles=['registrar','broker'];
const CLEANUP_EXEC='/usr/local/sbin/nyra-5c-db-cleanup';
const need=(v,c)=>{if(!v)throw Error('NYRA_PG_'+c);};
const cmd=(file,args,extra={})=>execFileSync(file,args,{encoding:'utf8',timeout:120000,stdio:['ignore','pipe','pipe'],...extra}).trim();
export function stageCommands(){
 return {network:['network','create','--internal','--driver','bridge','--label',LABEL,NET],
  db:['run','-d','--name',DB,'--network',NET,'--network-alias','db','--restart','no',
   '--label',LABEL,'--security-opt','no-new-privileges:true','--env-file',ROOT+'/db.env',IMAGE]};
}
export function loginsSQL(a,b){
 need([a,b].every(v=>/^[a-f0-9]{48}$/.test(v)),'PASSWORD');
 return ['begin;',
  "create role nyra_accept_registrar login inherit password '"+a+"' in role nyra_trust_registrar;",
  "create role nyra_accept_broker login inherit password '"+b+"' in role nyra_trust_broker;",
  'grant connect on database postgres to nyra_accept_registrar,nyra_accept_broker;',
  'commit;'].join('\n')+'\n';
}
export function expiryUnitContents(iso){
 const d=new Date(iso);need(Number.isFinite(d.getTime()),'EXPIRY');
 return {service:['[Unit]','Description=NYRA Phase 5C private DB cleanup','After=docker.service',
  '[Service]','Type=oneshot','ExecStart='+CLEANUP_EXEC,''].join('\n'),
  timer:['[Unit]','Description=NYRA Phase 5C 12-hour DB expiry','[Timer]',
  'OnCalendar='+d.toISOString().slice(0,19).replace('T',' ')+' UTC',
  'Persistent=true','Unit=nyra-5c-db-expiry.service',
  '[Install]','WantedBy=timers.target',''].join('\n')};
}
export function cleanupScript(){
 return [
 '#!/bin/sh','set -eu',
 "containers=$(docker ps --all --filter 'name=^nyra-5c-pg17$' --format '{{.Names}}')",
 'test -z "$containers" || test "$containers" = nyra-5c-pg17',
 'if test -n "$containers"; then',
 '  test "$(docker inspect -f '+String.fromCharCode(39)+'{{index .Config.Labels "com.noctua.nyra.acceptance.db"}}'+String.fromCharCode(39)+' nyra-5c-pg17)" = pr20-fra1-temporary',
 '  docker rm -f nyra-5c-pg17 >/dev/null',
 'fi',
 "containers=$(docker ps --all --filter 'name=^nyra-5c-pg17$' --format '{{.Names}}')",
 'test -z "$containers"',
 "networks=$(docker network ls --filter 'name=^nyra-5c-db-private$' --format '{{.Name}}')",
 'test -z "$networks" || test "$networks" = nyra-5c-db-private',
 'if test -n "$networks"; then',
 '  test "$(docker network inspect -f '+String.fromCharCode(39)+'{{index .Labels "com.noctua.nyra.acceptance.db"}}'+String.fromCharCode(39)+' nyra-5c-db-private)" = pr20-fra1-temporary',
 '  docker network rm nyra-5c-db-private >/dev/null',
 'fi',
 "networks=$(docker network ls --filter 'name=^nyra-5c-db-private$' --format '{{.Name}}')",
 'test -z "$networks"',
 'rm -f /opt/nyra-5c/private/db.env /opt/nyra-5c/private/pg17-expiry.json',
 'rm -f /var/lib/nyra-5c/registrar/pg.json /var/lib/nyra-5c/broker/pg.json',
 ''
 ].join('\n');
}
async function secret(path,value,uid=0,gid=0){
 const parent=await lstat(dirname(path));
 need(parent.isDirectory()&&!parent.isSymbolicLink()&&(parent.mode&0o007)===0,'SECRET_DIR');
 await writeFile(path,value,{flag:'wx',mode:0o600});
 await chown(path,uid,gid);await chmod(path,0o600);
}
export function resourceExists(kind,name,command=cmd){
 need((kind==='network'&&name===NET)||(kind==='container'&&name===DB),'RESOURCE_SCOPE');
 const value=command('docker',kind==='network'?['network','ls','--filter','name=^'+name+'$','--format','{{.Name}}']:['ps','--all','--filter','name=^'+name+'$','--format','{{.Names}}']);
 need(value===''||value===name,'RESOURCE_SCOPE');return value===name;
}
const exists=resourceExists;
function verifyLabel(kind,name){
 const f=kind==='network'?'{{index .Labels "com.noctua.nyra.acceptance.db"}}':'{{index .Config.Labels "com.noctua.nyra.acceptance.db"}}';
 need(cmd('docker',kind==='network'?['network','inspect','-f',f,name]:['inspect','-f',f,name])==='pr20-fra1-temporary','LABEL_MISMATCH');
}
async function cleanup(){
 need(process.getuid?.()===0,'ROOT');
 if(exists('container',DB)){verifyLabel('container',DB);cmd('docker',['rm','-f',DB]);}
 if(exists('network',NET)){verifyLabel('network',NET);cmd('docker',['network','rm',NET]);}
 need(!exists('container',DB)&&!exists('network',NET),'CLEANUP_REMAINS');
 for(const f of [ROOT+'/db.env',MARKER,...roles.map(r=>'/var/lib/nyra-5c/'+r+'/pg.json')])await rm(f,{force:true});
 return {cleaned:true,dropletDestroyed:false,githubCredentialsTouched:false};
}
function verify(){
 need(exists('container',DB)&&exists('network',NET),'NOT_PRESENT');
 verifyLabel('container',DB);verifyLabel('network',NET);
 need(cmd('docker',['network','inspect','-f','{{.Internal}}',NET])==='true','NOT_INTERNAL');
 const ports=cmd('docker',['inspect','-f','{{json .HostConfig.PortBindings}}',DB]);
 need(['{}','null'].includes(ports),'PORT_EXPOSED');
 need(cmd('docker',['inspect','-f','{{.State.Running}}',DB])==='true','NOT_RUNNING');
 const query="select current_setting('server_version_num')::integer between 170000 and 179999"+
  " and has_table_privilege('nyra_accept_registrar','nyra_trust.jobs','INSERT')"+
  " and not has_table_privilege('nyra_accept_broker','nyra_trust.jobs','INSERT')"+
  " and has_table_privilege('nyra_accept_broker','nyra_trust.used_tokens','INSERT')"+
  " and not has_table_privilege('nyra_accept_registrar','nyra_trust.used_tokens','INSERT')"+
  " and not has_table_privilege('nyra_accept_broker','nyra_trust.inventories','INSERT');";
 need(cmd('docker',['exec',DB,'psql','-U','postgres','-d','postgres','-t','-A','-c',query])==='t','ROLE_GRANTS');
 return {postgres17:true,internalNetwork:true,publishedPorts:0,separateDbLogins:true,
  registrarBrokerProcessesConnected:false,realAcceptance:false,authorization:false};
}
async function apply(){
 need(process.getuid?.()===0&&cmd('hostname',[])==='nyra-5c-acceptance','HOST');
 const target=JSON.parse(await readFile(new URL('./host-target.json',import.meta.url)));
 need(assessHost(target,readHostFacts()).prerequisitesPassed,'PREREQUISITES');
 const lock=JSON.parse(await readFile(new URL('../native-acceptance/images.lock.json',import.meta.url)));
 need(lock.db?.image===IMAGE,'IMAGE_PIN');
 const dir=await lstat(ROOT);need(dir.isDirectory()&&dir.uid===0&&(dir.mode&0o077)===0,'PRIVATE_ROOT');
 need(!exists('container',DB)&&!exists('network',NET),'EXISTS');
 const expiry=new Date(Date.now()+12*3600000).toISOString(),unit=expiryUnitContents(expiry);
 // Install an independent root-only cleanup script; subsequent Git checkouts
 // cannot silently disable the reboot-resilient DB expiry mechanism.
 await writeFile(CLEANUP_EXEC,cleanupScript(),{flag:'wx',mode:0o700});
 await chmod(CLEANUP_EXEC,0o700);
 // Permanent reboot-resilient timer is installed BEFORE creating any DB secret.
 await writeFile(service,unit.service,{flag:'wx',mode:0o644});
 await writeFile(timer,unit.timer,{flag:'wx',mode:0o644});
 cmd('systemctl',['daemon-reload']);
 cmd('systemctl',['enable','--now','nyra-5c-db-expiry.timer']);
 need(cmd('systemctl',['is-active','nyra-5c-db-expiry.timer'])==='active','TIMER');
 await secret(MARKER,JSON.stringify({expiry,label:LABEL})+'\n');
 const passwords=Object.fromEntries(roles.map(r=>[r,randomBytes(24).toString('hex')]));
 try{
  await secret(ROOT+'/db.env','POSTGRES_PASSWORD='+randomBytes(24).toString('hex')+'\nPOSTGRES_DB=postgres\n');
  for(const role of roles){
   const parts=cmd('getent',['passwd','nyra-'+role]).split(':');
   await secret('/var/lib/nyra-5c/'+role+'/pg.json',JSON.stringify({host:'db',database:'postgres',port:5432,
    user:'nyra_accept_'+role,password:passwords[role]})+'\n',Number(parts[2]),Number(parts[3]));
  }
  cmd('docker',['pull',IMAGE],{timeout:300000});
  const args=stageCommands();
  cmd('docker',args.network);cmd('docker',args.db);
  let ready=false;
  for(let i=0;i<60;i++){try{cmd('docker',['exec',DB,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}
   catch{await new Promise(r=>setTimeout(r,1000));}}
  need(ready,'PG_READY_TIMEOUT');
  const schema=await readFile(new URL('../protected-delivery/schema.sql',import.meta.url),'utf8');
  const psql=['exec','-i',DB,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
  cmd('docker',psql,{input:schema,stdio:['pipe','pipe','pipe']});
  cmd('docker',psql,{input:loginsSQL(passwords.registrar,passwords.broker),stdio:['pipe','pipe','pipe']});
  return {...verify(),expiresAt:expiry};
 }catch(e){try{await cleanup();}catch{}
  throw Error('NYRA_PG_SETUP_FAILED '+String(e.message).replace(/[a-f0-9]{48}/g,'[redacted]').slice(0,140));}
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{
  const a=process.argv[2];need(['--dry-run','--apply','--verify','--cleanup'].includes(a),'MODE');
  const result=a==='--dry-run'?{image:IMAGE,internalOnly:true,noPublicPort:true,
   expiryHours:12,authorization:false}:a==='--apply'?await apply():a==='--verify'?verify():await cleanup();
  console.log(JSON.stringify(result,null,2));
 }catch(e){console.error(String(e.message).replace(/[a-f0-9]{48}/g,'[redacted]').slice(0,240));process.exitCode=1;}
}
