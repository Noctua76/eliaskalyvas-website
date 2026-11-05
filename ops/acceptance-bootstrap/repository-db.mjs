// Fresh replacement-host DB only. No production connection or published port.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,chown,lstat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {privateFile} from './owner-source.mjs';
import {validateReplacementTarget} from './replacement-target.mjs';
import {cleanupReplacement} from './repository-launch.mjs';
import {loginsSQL,IMAGE} from './db-stage.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
const run=(args,input)=>execFileSync('docker',args,{encoding:'utf8',input,stdio:[input?'pipe':'ignore','pipe','pipe'],timeout:120000}).trim();
export function replacementDBCommands(target){validateReplacementTarget(target,{created:true});const label='com.noctua.nyra.acceptance='+hashJSON(target);return {network:['network','create','--internal','--label',label,'nyra-repository-db'],database:['run','-d','--name','nyra-repository-pg','--label',label,'--network','nyra-repository-db','--network-alias','db','--restart','no','--memory','1g','--security-opt','no-new-privileges:true','--env-file','/opt/nyra-5c/private/repository-db.env',IMAGE]};}
// Independent login lease: host lifetime never authorizes 14-day database credentials.
export function replacementRoleExpiry(target,{now=Date.now}={}){
 validateReplacementTarget(target,{created:true,now});
 const t=now();
 if(!Number.isFinite(t))throw Error('DB_ROLE_CLOCK');
 return new Date(target.schema==='nyra.acceptance.replacement.v2'
  ?Math.min(Date.parse(target.expiresAt),t+86400000)
  :Date.parse(target.expiresAt)).toISOString();
}
// Compute a NEW credential lease only for a fully identified, independent
// protected session. This is a time/scope guard, NOT Owner or OIDC authority.
// Actual issuance additionally requires live trusted authorization and PG readback.
export function replacementRenewalWindow(target,session,{now=Date.now}={}){
 validateReplacementTarget(target,{created:true,now});
 const stamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s)&&Number.isFinite(Date.parse(s));
 const fields=['schema','bootstrapId','providerResourceId','sessionId','startsAt','endsAt','authorization'];
 if(!session||typeof session!=='object'||Array.isArray(session)||
    Object.keys(session).sort().join(',')!==fields.sort().join(','))throw Error('DB_RENEWAL_FIELDS');
 if(session.schema!=='nyra.acceptance.pg-session.v1'||session.authorization!==false||
    session.bootstrapId!==target.bootstrapId||session.providerResourceId!==target.resourceId||
    typeof session.sessionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9-]{27,}$/.test(session.sessionId)||
    !stamp(session.startsAt)||!stamp(session.endsAt))throw Error('DB_RENEWAL_IDENTITY');
 const start=Date.parse(session.startsAt),end=Date.parse(session.endsAt),t=now();
 if(!Number.isFinite(t)||start<Date.parse(target.createdAt)||start>t||
    t>=end||start>=end||end-start>86400000||end>Date.parse(target.expiresAt))
    throw Error('DB_RENEWAL_WINDOW');
 return Object.freeze({sessionId:session.sessionId,bootstrapId:target.bootstrapId,
  startsAt:session.startsAt,endsAt:session.endsAt,
  roleValidUntil:new Date(Math.min(end,t+86400000,Date.parse(target.expiresAt))).toISOString(),
  authorized:false});
}
// Prepared-only replacement of existing scoped logins; caller MUST prove fresh
// Administration/Owner/AAL2 authorization independently before executing SQL.
export function replacementRenewalSQL(lease,passwords){
 if(!lease||lease.authorized!==false||typeof lease.roleValidUntil!=='string'||
  !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(lease.roleValidUntil)||
  !passwords||!['registrar','broker'].every(r=>/^[a-f0-9]{48}$/.test(passwords[r]))||
  Object.keys(passwords).sort().join(',')!=='broker,registrar')throw Error('DB_RENEWAL_SQL_SCOPE');
 const valid=lease.roleValidUntil;
 const lines=['BEGIN;','SET LOCAL TIME ZONE \'UTC\';'];
 for(const role of ['registrar','broker'])
  lines.push("ALTER ROLE nyra_accept_"+role+" PASSWORD '"+passwords[role]+"' VALID UNTIL '"+valid+"';");
 // Terminate any existing sessions using previously issued credentials.
 lines.push("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename IN ('nyra_accept_registrar','nyra_accept_broker') AND pid <> pg_backend_pid();");
 lines.push('COMMIT;');
 // Independent postgres 17 role-validity readback: no secrets in returned rows.
 lines.push("SELECT rolname, to_char(rolvaliduntil AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') FROM pg_authid WHERE rolname IN ('nyra_accept_registrar','nyra_accept_broker') ORDER BY rolname;");
 return lines.join('\n')+'\n';
}
async function main(){
 if(process.env.NYRA_REPOSITORY_DB!=='1'||process.getuid?.()!==0||process.argv[2]!=='--apply')throw Error('DISABLED');
 // Read the sealed SQL asset before any secret/network/container mutation.
 const schema=await readFile(new URL('../protected-delivery/schema.sql',import.meta.url),'utf8');
 const t=await privateFile(process.argv[3]);validateReplacementTarget(t,{created:true});
 const command=(f,a)=>execFileSync(f,a,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 if(command('hostname',[])!==t.hostname||command('systemctl',['is-active','nyra-repository-expiry.timer'])!=='active')throw Error('HOST_OR_TIMER');
 if(run(['ps','-aq'])!==''||run(['network','ls','--filter','name=^nyra-repository-db$','--format','{{.Name}}'])!=='')throw Error('NOT_FRESH');
 const passwords={registrar:randomBytes(24).toString('hex'),broker:randomBytes(24).toString('hex')};
 const secret=async(path,text,uid=0,gid=0)=>{const parent=await lstat(path.slice(0,path.lastIndexOf('/')));if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o007))throw Error('PRIVATE_DIRECTORY');await writeFile(path,text,{flag:'wx',mode:0o600});await chown(path,uid,gid);};
 try{
  await secret('/opt/nyra-5c/private/repository-db.env','POSTGRES_PASSWORD='+randomBytes(32).toString('hex')+'\nPOSTGRES_DB=postgres\n');
  for(const role of ['registrar','broker']){const u=command('getent',['passwd','nyra-'+role]).split(':');await secret('/var/lib/nyra-5c/'+role+'/pg.json',JSON.stringify({host:'db',database:'postgres',port:5432,user:'nyra_accept_'+role,password:passwords[role]}),Number(u[2]),Number(u[3]));}
  const args=replacementDBCommands(t);run(args.network);run(args.database);
  const net=JSON.parse(run(['network','inspect','nyra-repository-db']))[0],bridge='br-'+net.Id.slice(0,12);
  command('iptables',['-I','INPUT','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP']);command('iptables',['-I','DOCKER-USER','-i',bridge,'!','-o',bridge,'-j','DROP']);
  let ready=false;for(let n=0;n<60;n++){try{run(['exec','nyra-repository-pg','pg_isready','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,1000));}}if(!ready)throw Error('DB_NOT_READY');
  const psql=['exec','-i','nyra-repository-pg','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
  run(psql,schema);
  run(psql,loginsSQL(passwords.registrar,passwords.broker));
  // A 14-day host is NOT a 14-day login lease. New sessions require
  // separately reviewed database-role renewal after fresh owner/trust checks.
  const roleExpiresAt=replacementRoleExpiry(t);
  for(const role of ['registrar','broker'])run(psql,"alter role nyra_accept_"+role+" valid until '"+roleExpiresAt+"';");
  console.log(JSON.stringify({postgres17:true,internalNetwork:true,publicPorts:0,liveAcceptance:false}));
 }catch{cleanupReplacement(t,{apply:true});throw Error('REPLACEMENT_DB_CLOSED');}
}
if(process.argv[1]===new URL(import.meta.url).pathname)main().catch(()=>{console.error('NYRA_REPLACEMENT_DB_DENIED');process.exitCode=1;});
