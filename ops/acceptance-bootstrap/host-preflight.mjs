// Read-only, host-specific prerequisite evidence. NEVER authorizes a credential,
// starts a listener, dispatches Actions, or claims real trust acceptance.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';

const ROLES=Object.freeze(['coordinator','registrar','broker','owner']);
const GiB=1024**3;
const need=(ok,code)=>{if(!ok)throw Error('HOST_PREFLIGHT_'+code);};

export function assessHost(target,observed){
 need(target?.schema==='nyra.acceptance.host-target.v1' &&
  target.hostname==='nyra-5c-acceptance' &&
  target.origin==='https://nyra-5c.eliaskalyvas.gr' &&
  target.ipv4==='201.79.94.104' &&
  target.provider==='DigitalOcean' && target.region==='fra1' &&
  target.authorization===false,'TARGET');
 const checks={
  hostname: observed.hostname===target.hostname,
  publicAddress: observed.publicAddresses?.includes(target.ipv4)===true,
  dns: observed.dnsAddresses?.length>0 && observed.dnsAddresses.every(ip=>ip===target.ipv4),
  httpsCertificate: observed.https==='404:0',
  cpu: observed.cpuCount>=4,
  memory: observed.memoryBytes>=7.25*GiB,
  freeDisk: observed.freeBytes>=20*GiB,
  docker: observed.docker==='active',
  caddy: observed.caddy==='active',
  firewall: observed.firewall?.includes('Status: active') &&
    observed.firewall.includes('Default: deny (incoming)') &&
    ['22','80','443'].every(port=>new RegExp('(?:^|\\n)'+port+'/tcp\\s+ALLOW IN').test(observed.firewall)),
  noRunningContainers: observed.containers==='',
  roles: ROLES.every(role=>observed.roles?.[role]?.shell==='/usr/sbin/nologin' &&
   observed.roles[role].directoryOwner==='nyra-'+role && observed.roles[role].directoryMode==='700'),
  privateDirectory: observed.privateDirectory==='root:700'
 };
 const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
 return Object.freeze({
  schema:'nyra.acceptance.host-preflight.v1',
  host:target.hostname,origin:target.origin,
  prerequisiteChecks:checks,
  failed,
  prerequisitesPassed:failed.length===0,
  // Both remain false: independent GitHub/App evidence, egress restrictions,
  // owner AAL2 receipt, orchestration, and cleanup timer are still required.
  readyForCredentials:false,
  authorization:false,
  realAcceptance:false,
  dispatchesPerformed:0
 });
}

export function readHostFacts({execute=(file,args)=>execFileSync(file,args,{
 encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']
}).trim()}={}){
 const run=(file,...args)=>execute(file,args);
 const parsed=(s)=>s.trim().split(/\s+/).filter(Boolean);
 const passwd=(role)=>run('getent','passwd','nyra-'+role).split(':');
 const roles=Object.fromEntries(ROLES.map(role=>{
  const pw=passwd(role);
  const attrs=run('stat','-c','%U:%a','/var/lib/nyra-5c/'+role).split(':');
  return [role,{shell:pw[6],directoryOwner:attrs[0],directoryMode:attrs[1]}];
 }));
 return {
  hostname:run('hostname'),
  publicAddresses:parsed(run('ip','-4','-o','addr','show','scope','global').match(/inet\s+[0-9.]+\/[0-9]+/g)?.map(x=>x.split(/[ /]/)[1]).join(' ')??''),
  dnsAddresses:[...new Set((run('getent','ahostsv4','nyra-5c.eliaskalyvas.gr').match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)??[]))],
  https:run('curl','-sS','--max-time','20','--proto','=https',
   '-o','/dev/null','-w','%{http_code}:%{ssl_verify_result}',
   'https://nyra-5c.eliaskalyvas.gr/'),
  cpuCount:Number(run('nproc')),
  memoryBytes:Number((run('awk','/MemTotal:/ { print $2 }','/proc/meminfo')))*1024,
  freeBytes:Number(run('df','-B1','--output=avail','/opt/nyra-5c').split(/\s+/).at(-1)),
  docker:run('systemctl','is-active','docker'),
  caddy:run('systemctl','is-active','caddy'),
  firewall:run('ufw','status','verbose'),
  containers:run('docker','ps','-q'),
  roles,privateDirectory:run('stat','-c','%U:%a','/opt/nyra-5c/private')
 };
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{
  need(process.getuid?.()===0,'ROOT');
  const target=JSON.parse(await readFile(new URL('./host-target.json',import.meta.url),'utf8'));
  const result=assessHost(target,readHostFacts());
  console.log(JSON.stringify(result,null,2));
  if(!result.prerequisitesPassed)process.exitCode=1;
 }catch(e){console.error('HOST_PREFLIGHT_UNAVAILABLE: '+String(e.message).replace(/[\r\n]/g,' '));process.exitCode=1;}
}
