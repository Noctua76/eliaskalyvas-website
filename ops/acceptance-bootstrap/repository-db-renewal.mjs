// Explicit root-only PostgreSQL renewal for a fresh, independently authorized
// acceptance session. Never invoked by an import, CI, an HTTP request or a job.
// The existing Owner Source signs an operation-bound, fresh challenge; the
// repository trust gate also re-reads current GitHub Administration protections.
import {execFileSync} from 'node:child_process';
import {readFile,open,rename,rm,lstat,chown,chmod,readdir,mkdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {dirname} from 'node:path';
import {verifyRenewalApproval} from '../../lib/publication/runtime/db-renewal-approval.mjs';
import {administrationReader} from '../../lib/publication/runtime/administration-evidence.mjs';
import {createRepositoryTrustGate} from '../../lib/publication/runtime/repository-trust.mjs';
import {reviewedAcceptancePolicies} from '../../lib/publication/integration/live-acceptance.mjs';
import {privateFile} from './owner-source.mjs';
import {ownerRequest} from './owner-request.mjs';
import {validateReplacementTarget} from './replacement-target.mjs';
import {replacementRenewalWindow,replacementRenewalSQL} from './repository-db.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
const need=(x,c)=>{if(!x)throw Error('NYRA_DB_RENEWAL_'+c);};
// Failure-only diagnostics: fixed enums, no error text, stack, payload or secrets.
const renewalFailureStages=new Set(['ENTRY','LOCK_OPEN','LOCK_CHECK','LOCK_OR_CHILD','PRIVATE_INPUTS','OWNER_KEY','MACHINE_BINDING','OWNER_CONFIGURATION','OWNER_TOKEN_INPUT','OWNER_RENEWAL_REQUEST','OWNER_APPROVAL_VERIFY','TRUST_GATE_SETUP','HOST_BOUNDARY','JOURNAL_HISTORY','RESOURCE_BOUNDARY','PRE_JOURNAL_TRUST','ROLE_IDENTITIES','ROLE_DIRECTORIES','JOURNAL_RESERVATION','CREDENTIAL_STAGING','PRECOMMIT_TRUST','PRECOMMIT_BOUNDARY','DATABASE_ROTATION','CREDENTIAL_INSTALLATION','CREDENTIAL_VERIFICATION','RENEWAL_COMPLETION']);
const renewalFailureCodes=new Set([
 ...['DISABLED','ROOT','TARGET_PIN','OWNER_KEY_ID','MACHINE_ID','SEALED_FILE','TOKEN_SIZE','OWNER_AAL2_TOKEN','TRUST_ADAPTER','HOST','ISOLATION','JOURNAL_PATH','STATE','REPLAY','RESOURCE_LABEL','PUBLIC_PORT','PG17','SCRAM_RULES','OWNER_ADMINISTRATION','ROLE_USER','ROLE_PARENT','ROLE_DIRECTORY','STAGED_FILE','ROLE_SCOPE','TRUST_RECHECK','PRECOMMIT_BOUNDARY','COMMAND_DENIED','SERVER_VALIDITY','CREDENTIAL_READBACK','NEW_PASSWORD_REJECTED','OLD_PASSWORD_SURVIVED','CROSS_ROLE_CREDENTIAL','GITHUB_CREDENTIAL','LOCK'].map(x=>'NYRA_DB_RENEWAL_'+x),
 ...['FIELDS','IDENTITY','WINDOW','KEY_PIN','BINDING','FRESHNESS'].map(x=>'DB_RENEWAL_APPROVAL_'+x),
 ...['SOURCE_REQUIRED','POLICY_BINDING','RETIRED','OPERATION','ADMINISTRATION_CHANGED','OWNER_SOURCE_UNVERIFIED','OWNER_BINDING','OWNER_AUTHORIZATION','OWNER_FRESHNESS','ADMINISTRATION_STALE','RETIREMENT_UNCONFIRMED'].map(x=>'REPOSITORY_TRUST_'+x),
 'PRIVATE_FILE','OWNER_REQUEST_DENIED','ADMIN_CREDENTIAL_REQUIRED','ADMIN_READ_SCOPE','ADMIN_READ_DENIED','ADMIN_READ_INCOMPLETE','ADMIN_READ_SIZE','ADMIN_READ_UNAVAILABLE','ADMIN_READ_STALE','ADMIN_SNAPSHOT_CHANGED','DB_RENEWAL_FIELDS','DB_RENEWAL_IDENTITY','DB_RENEWAL_WINDOW','UNCLASSIFIED']);
let renewalFailureStage='ENTRY';
export function sanitizedRenewalFailure(error){
 let code='',errno='';try{code=typeof error?.message==='string'?error.message:'';errno=error?.code;}catch{}
 const prefix='NYRA_DB_RENEWAL_FAILED_CLOSED_';if(code.startsWith(prefix))code=code.slice(prefix.length);
 if(!renewalFailureCodes.has(code))code=['ENOENT','EACCES','EPERM','ELOOP','ENOTDIR','EISDIR'].includes(errno)?'FILESYSTEM_ACCESS_FAILED':'UNCLASSIFIED';
 return {marker:'NYRA_DB_RENEWAL_DENIED',stage:renewalFailureStages.has(renewalFailureStage)?renewalFailureStage:'ENTRY',code,noAutomaticRetry:true};
}
const command=(program,args,input)=>{
 try{return execFileSync(program,args,{encoding:'utf8',input,timeout:30000,
  stdio:[input===undefined?'ignore':'pipe','pipe','pipe']}).trim();}
 catch(e){throw Error('NYRA_DB_RENEWAL_COMMAND_DENIED');}
};
const docker=(args,input)=>command('docker',args,input);
const uid=role=>{const v=command('getent',['passwd','nyra-'+role]).split(':');need(v.length>=4&&Number(v[2])>0,'ROLE_USER');return {uid:Number(v[2]),gid:Number(v[3])};};
async function sealed(path,allowedUid=0){
 const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const s=await f.stat();
  need(s.isFile()&&s.nlink===1&&s.uid===allowedUid&&(s.mode&0o077)===0&&s.size<65536,'SEALED_FILE');
  return JSON.parse(await f.readFile('utf8'));
 }finally{await f.close();}
}
export function renewalBinding(target,session,machineId){
 need(/^[a-f0-9]{32}$/.test(machineId),'MACHINE_ID');
 return {bootstrapId:target.bootstrapId,hostname:target.hostname,providerResourceId:target.resourceId,
  targetSHA256:hashJSON(target),machineIdSHA256:createHash('sha256').update(machineId).digest('hex'),
  sessionSHA256:hashJSON(session),sessionId:session.sessionId,
  startsAt:session.startsAt,endsAt:session.endsAt};
}
export function renewalHistory(state,target,session){
 if(state===null)return [];
 need(state.schema==='nyra.acceptance.db-renewal-state.v1'&&state.bootstrapId===target.bootstrapId&&
  state.targetSHA256===hashJSON(target)&&Array.isArray(state.usedSessionIds)&&state.usedSessionIds.length<1000&&
  new Set(state.usedSessionIds).size===state.usedSessionIds.length&&
  state.usedSessionIds.includes(state.sessionId)&&
  ['complete','pending','db-updated'].includes(state.status),'STATE');
 need(!state.usedSessionIds.includes(session.sessionId),'REPLAY');
 return [...state.usedSessionIds];
}
const syncDirectory=async path=>{const f=await open(path,'r');try{await f.sync();}finally{await f.close();}};
async function atomicSealed(path,value,owner={uid:0,gid:0}){
 const next=path+'.nyra-'+randomUUID(),bytes=typeof value==='string'?value:JSON.stringify(value);
 const f=await open(next,'wx',0o600);
 try{await f.writeFile(bytes);await f.sync();}
 finally{await f.close();}
 await chown(next,owner.uid,owner.gid);await chmod(next,0o600);
 const metadata=await open(next,'r');try{await metadata.sync();}finally{await metadata.close();}
 return next;
}
async function durableState(path,obj){
 const next=await atomicSealed(path, obj);
 await rename(next,path);
 const f=await open(path,'r');
 try{await f.sync();}finally{await f.close();}
 const dir=await open(dirname(path),'r');
 try{await dir.sync();}finally{await dir.close();}
}
async function auditRenewal(record){
 const dir='/var/lib/nyra-retirement';
 await mkdir(dir,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
 const st=await lstat(dir);
 need(st.isDirectory()&&!st.isSymbolicLink()&&st.uid===0&&(st.mode&0o077)===0,'AUDIT_DIRECTORY');
 const f=await open(dir+'/db-renewal-audit.jsonl',constants.O_WRONLY|constants.O_APPEND|constants.O_CREAT|constants.O_NOFOLLOW,0o600);
 try{
  const st=await f.stat();need(st.isFile()&&st.nlink===1&&st.uid===0&&(st.mode&0o077)===0,'AUDIT_FILE');
  await f.writeFile(JSON.stringify({schema:'nyra.acceptance.db-renewal-audit.v1',
   observedAt:new Date().toISOString(),...record})+'\n');await f.sync();
 }finally{await f.close();}
 await syncDirectory(dir);
}
export function assertRenewalHostBoundary({target,session,host,timerActive,networkInternal,roleContainers,serviceActive,now=Date.now}){
 validateReplacementTarget(target,{created:true,now});
 need(target.schema==='nyra.acceptance.replacement.v2'&&host===target.hostname,'HOST');
 need(timerActive===true&&networkInternal===true&&serviceActive===false&&roleContainers===0,'ISOLATION');
 return replacementRenewalWindow(target,session,{now});
}
export async function applyAuthorizedRenewal({target,session,assertTrust,paths,now=Date.now}){
 renewalFailureStage='HOST_BOUNDARY';
 need(typeof assertTrust==='function','TRUST_ADAPTER');
 need(process.getuid?.()===0,'ROOT');
 const lease=assertRenewalHostBoundary({target,session,host:command('hostname',[]),
  timerActive:command('systemctl',['show','nyra-repository-expiry.timer','--property=ActiveState','--value'])==='active',
  networkInternal:docker(['network','inspect','-f','{{.Internal}}','nyra-repository-db'])==='true',
  roleContainers:docker(['ps','-aq','--filter','name=^nyra-5c-live-']).split('\n').filter(Boolean).length,
  serviceActive:command('systemctl',['show','nyra-repository-runtime.service','--property=ActiveState','--value'])==='active',now});
 need(paths?.journal==='/opt/nyra-5c/private/renewal-state.json','JOURNAL_PATH');
 renewalFailureStage='JOURNAL_HISTORY';
 const state=await sealed(paths.journal).catch(e=>{
  if(e?.code==='ENOENT')return null;
  throw e;
 });
 const usedSessionIds=renewalHistory(state,target,session);
 renewalFailureStage='RESOURCE_BOUNDARY';
 const expectedLabel=hashJSON(target);
 need(docker(['inspect','-f','{{index .Config.Labels "com.noctua.nyra.acceptance"}}','nyra-repository-pg'])===expectedLabel&&
  docker(['network','inspect','-f','{{index .Labels "com.noctua.nyra.acceptance"}}','nyra-repository-db'])===expectedLabel,'RESOURCE_LABEL');
 const ports=JSON.parse(docker(['inspect','-f','{{json .HostConfig.PortBindings}}','nyra-repository-pg']));
 need(ports===null||Object.keys(ports).length===0,'PUBLIC_PORT');
 const sql=input=>docker(['exec','-i','nyra-repository-pg','psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-t','-A'],input);
 need(Number(sql('SHOW server_version_num;'))>=170000&&Number(sql('SHOW server_version_num;'))<180000,'PG17');
 const rules=sql("SELECT count(*) FROM pg_hba_file_rules WHERE type='host' AND auth_method='scram-sha-256' AND user_name && ARRAY['nyra_accept_registrar','nyra_accept_broker'];");
 need(Number(rules)>=4,'SCRAM_RULES');

 // Fresh trust check precedes credential generation or any mutation.
 renewalFailureStage='PRE_JOURNAL_TRUST';
 const trust=await assertTrust(lease);
 need(trust&&trust.verified===true&&/^[a-f0-9]{64}$/.test(trust.approvalSHA256)&&
  /^[a-f0-9]{64}$/.test(trust.repositoryTrustSHA256),'OWNER_ADMINISTRATION');
 renewalFailureStage='ROLE_IDENTITIES';
 const users=Object.fromEntries(['registrar','broker'].map(r=>[r,uid(r)]));
 const secrets={registrar:randomBytes(24).toString('hex'),broker:randomBytes(24).toString('hex')};
 const staged={},oldPasswords={},directories={};
 const audit=status=>auditRenewal({status,bootstrapId:target.bootstrapId,providerResourceId:target.resourceId,
  targetSHA256:hashJSON(target),sessionId:lease.sessionId,roleValidUntil:lease.roleValidUntil,
  approvalSHA256:trust.approvalSHA256,repositoryTrustSHA256:trust.repositoryTrustSHA256,
  ownerApproval:trust.ownerApproval??null});
 const rolePaths={registrar:'/var/lib/nyra-5c/registrar/pg.json',broker:'/var/lib/nyra-5c/broker/pg.json'};
 const pending={schema:'nyra.acceptance.db-renewal-state.v1',bootstrapId:target.bootstrapId,
  targetSHA256:hashJSON(target),usedSessionIds:[...usedSessionIds,lease.sessionId],
  approvalSHA256:trust.approvalSHA256,repositoryTrustSHA256:trust.repositoryTrustSHA256,
  sessionId:lease.sessionId,startsAt:lease.startsAt,endsAt:lease.endsAt,roleValidUntil:lease.roleValidUntil,status:'pending'};
 const auth=(role,password)=>{
  const cmd=['exec','-i','nyra-repository-pg','sh','-ec',
   'IFS= read -r pw; export PGPASSWORD="$pw"; exec psql -X -h 127.0.0.1 -p 5432 -U "$1" -d postgres -t -A -c "select current_user"',
   'nyra-auth','nyra_accept_'+role];
  try{return docker(cmd,password+'\n')==='nyra_accept_'+role;}
  catch{return false;}
 };
 let dbChanged=false,journalStarted=false;
 try{
  // Freeze role directories while root replaces secrets. Their root-owned
  // parent prevents renames; NOFOLLOW handles prevent symlink substitution.
  renewalFailureStage='ROLE_DIRECTORIES';
  const parent=await lstat('/var/lib/nyra-5c');
  need(parent.isDirectory()&&!parent.isSymbolicLink()&&parent.uid===0&&(parent.mode&0o022)===0,'ROLE_PARENT');
  for(const role of ['registrar','broker']){
   const d=await open(dirname(rolePaths[role]),constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
   const st=await d.stat();
   need(st.isDirectory()&&[0,users[role].uid].includes(st.uid)&&(st.mode&0o077)===0,'ROLE_DIRECTORY');
   directories[role]=d;
   await d.chown(0,0);await d.chmod(0o700);
  }
  // Record session consumption BEFORE staging. A kill at any later instruction
  // leaves launches blocked. Recovery requires a NEW independently approved
  // session and rotates both DB passwords again, including ambiguous commits.
  renewalFailureStage='JOURNAL_RESERVATION';
  await durableState(paths.journal,pending);journalStarted=true;
  await audit(state&&state.status!=='complete'?'RECOVERY_NEW_SESSION_RESERVED':'SESSION_RESERVED');
  renewalFailureStage='CREDENTIAL_STAGING';
  for(const role of ['registrar','broker']){
   for(const name of await readdir(dirname(rolePaths[role]))){
    if(!/^pg\.json\.nyra-[a-f0-9-]{36}$/.test(name))continue;
    const p=dirname(rolePaths[role])+'/'+name;
    const st=await lstat(p);
    need(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&[0,users[role].uid].includes(st.uid),'STAGED_FILE');
    await rm(p);
   }
  }
  // Stage both role-specific secrets under private owners before touching SQL.
  // Failure in either preparation path MUST remove the other staged secret.
  for(const role of ['registrar','broker']){
   const old=await sealed(rolePaths[role],users[role].uid);
   need(Object.keys(old).sort().join(',')==='database,host,password,port,user'&&
    /^[a-f0-9]{48}$/.test(old.password)&&old.user==='nyra_accept_'+role&&old.host==='db'&&old.port===5432&&old.database==='postgres','ROLE_SCOPE');
   oldPasswords[role]=old.password;
   staged[role]=await atomicSealed(rolePaths[role],{host:'db',database:'postgres',port:5432,user:'nyra_accept_'+role,password:secrets[role]},users[role]);
  }
  renewalFailureStage='PRECOMMIT_TRUST';
  need(hashJSON(await assertTrust(lease))===hashJSON(trust),'TRUST_RECHECK');
  // Revalidate isolation and the clock immediately before SQL mutation.
  renewalFailureStage='PRECOMMIT_BOUNDARY';
  need(command('systemctl',['show','nyra-repository-runtime.service','--property=ActiveState','--value'])==='inactive'&&
   docker(['ps','-aq','--filter','name=^nyra-5c-live-']).trim()===''&&now()<Date.parse(lease.roleValidUntil),'PRECOMMIT_BOUNDARY');
  const args=['exec','-i','nyra-repository-pg','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-t','-A'];
  renewalFailureStage='DATABASE_ROTATION';
  const response=docker(args,replacementRenewalSQL(lease,secrets));
  dbChanged=true;
  const actual=response.split('\n').map(x=>x.trim()).filter(x=>x.startsWith('nyra_accept_'));
  need(JSON.stringify(actual)===JSON.stringify(['nyra_accept_broker|'+lease.roleValidUntil,'nyra_accept_registrar|'+lease.roleValidUntil]),'SERVER_VALIDITY');
  await durableState(paths.journal,{...pending,status:'db-updated'});
  renewalFailureStage='CREDENTIAL_INSTALLATION';
  for(const role of ['registrar','broker']){
   await rename(staged[role],rolePaths[role]);delete staged[role];
   await syncDirectory(dirname(rolePaths[role]));
   const check=await sealed(rolePaths[role],users[role].uid);
   need(check.password===secrets[role]&&check.user==='nyra_accept_'+role,'CREDENTIAL_READBACK');
  }
  renewalFailureStage='CREDENTIAL_VERIFICATION';
  for(const role of ['registrar','broker']){
   need(auth(role,secrets[role]),'NEW_PASSWORD_REJECTED');
   need(!auth(role,oldPasswords[role]),'OLD_PASSWORD_SURVIVED');
  }
  need(!auth('registrar',secrets.broker)&&!auth('broker',secrets.registrar),'CROSS_ROLE_CREDENTIAL');
  renewalFailureStage='RENEWAL_COMPLETION';
  for(const [role,d] of Object.entries(directories)){
   await d.chown(users[role].uid,users[role].gid);await d.chmod(0o700);await d.sync();
  }
  await audit('CREDENTIALS_VERIFIED');
  await durableState(paths.journal,{...pending,status:'complete',completedAt:new Date(now()).toISOString(),
   newLoginVerified:true,oldLoginRejected:true});
  return Object.freeze({status:'POSTGRESQL_RENEWAL_COMMITTED',sessionId:lease.sessionId,
   roleValidUntil:lease.roleValidUntil,ownerAndAdministrationRechecked:true,
   newLoginVerified:true,oldLoginRejected:true,credentialsReturned:false});
 }catch(error){
  if(journalStarted||dbChanged){
   await durableState(paths.journal,{...pending,status:dbChanged?'db-updated':'pending'});
   await audit('FAILED_CLOSED');
  }
  const code=/^NYRA_DB_RENEWAL_[A-Z_]+$/.test(error?.message)?error.message:'UNCLASSIFIED';
  throw Error('NYRA_DB_RENEWAL_FAILED_CLOSED_'+code);
 }finally{
  try{for(const p of Object.values(staged))await rm(p,{force:true});}
  finally{for(const [role,d] of Object.entries(directories)){
   try{await d.chown(users[role].uid,users[role].gid);await d.chmod(0o700);await d.sync();}finally{await d.close();}
  }}
 }
}
export async function runHostRenewal(){
 need(process.getuid?.()===0&&process.env.NYRA_DB_RENEWAL==='1'&&process.argv.length===3&&process.argv[2]==='--renew-locked','DISABLED');
 renewalFailureStage='PRIVATE_INPUTS';
 const config=await privateFile('/opt/nyra-5c/private/launch.json');
 const target=await privateFile('/etc/nyra-acceptance/target.json');
 need(hashJSON(config.target)===hashJSON(target),'TARGET_PIN');
 const session=await privateFile('/opt/nyra-5c/private/renewal-session.json');
 renewalFailureStage='OWNER_KEY';
 const coordinator=uid('coordinator');
 const ownerKey=await sealed(config.ownerKeyFile,coordinator.uid);
 need(ownerKey.keyId===config.configuration.repositoryTrust.ownerKey.id,'OWNER_KEY_ID');
 renewalFailureStage='MACHINE_BINDING';
 const machineId=(await readFile('/etc/machine-id','utf8')).trim();
 const binding=renewalBinding(target,session,machineId);
 renewalFailureStage='OWNER_CONFIGURATION';
 const ownerConfig=await sealed('/var/lib/nyra-5c/owner/source.json',uid('owner').uid);
 renewalFailureStage='OWNER_TOKEN_INPUT';
 let token='';for await(const chunk of process.stdin){token+=chunk.toString();need(token.length<20000,'TOKEN_SIZE');}
 token=token.trim();need(token.length>30&&!/\s/.test(token),'OWNER_AAL2_TOKEN');
 renewalFailureStage='OWNER_RENEWAL_REQUEST';
 const envelope=await ownerRequest({socket:ownerConfig.socket,operation:'renew',input:{
  token,ownerDecisionId:config.ownerDecisionId,binding}});
 token='';
 const verify=()=>verifyRenewalApproval({envelope,binding,ownerPublicJWK:ownerKey.publicKey,
  ownerKeyId:ownerKey.keyId,expectedKeySHA256:config.configuration.repositoryTrust.ownerKey.sha256,
  ownerDecisionId:config.ownerDecisionId});
 renewalFailureStage='OWNER_APPROVAL_VERIFY';
 await verify();
 renewalFailureStage='TRUST_GATE_SETUP';
 const policies=reviewedAcceptancePolicies(config.configuration);
 const getJSON=administrationReader({tokenSource:async()=>{
  const cred=await sealed(config.githubReadCredential,coordinator.uid);
  need(cred.bootstrapId===target.bootstrapId&&Date.parse(cred.expiresAt)>Date.now()&&
   Date.parse(cred.issuedAt)>=Date.parse(target.createdAt),'GITHUB_CREDENTIAL');
  return cred.token;
 }});
 const close=()=>{try{command('systemctl',['stop','nyra-repository-runtime.service']);}catch{}};
 const gate=createRepositoryTrustGate({configuration:config.configuration,policies,getJSON,
  readOwnerRiskDecision:input=>ownerRequest({socket:config.ownerReceiptSocket,operation:'receipt',input}),
  ownerRiskDecisionId:config.ownerDecisionId,ownerDecisionPublicJWK:ownerKey.publicKey,
  ownerDecisionKeyId:ownerKey.keyId,retire:async()=>close()});
 return applyAuthorizedRenewal({target,session,assertTrust:async()=>{
  await gate.assert(policies.build,'db-renewal');
  await verify();
  return {verified:true,approvalSHA256:hashJSON(envelope),repositoryTrustSHA256:gate.repositoryTrustSHA256,ownerApproval:envelope};
 },paths:{journal:'/opt/nyra-5c/private/renewal-state.json'}});
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 if(process.argv[2]==='--renew'&&process.argv.length===3&&process.getuid?.()===0&&process.env.NYRA_DB_RENEWAL==='1'){
  try{
   renewalFailureStage='LOCK_OPEN';
   const lock='/opt/nyra-5c/private/renewal.lock';
   const f=await open(lock,constants.O_RDWR|constants.O_CREAT|constants.O_NOFOLLOW,0o600);
   try{
    renewalFailureStage='LOCK_CHECK';
    const st=await f.stat();need(st.isFile()&&st.nlink===1&&st.uid===0&&(st.mode&0o077)===0,'LOCK');
    renewalFailureStage='LOCK_OR_CHILD';
    execFileSync('flock',['--exclusive','--nonblock','/proc/self/fd/3',process.execPath,process.argv[1],'--renew-locked'],
     {stdio:['inherit','inherit','inherit',f.fd]});
   }finally{await f.close();}
  }catch(error){console.error(JSON.stringify(sanitizedRenewalFailure(error)));process.exitCode=1;}
 }else runHostRenewal().then(r=>console.log(JSON.stringify(r)))
  .catch(error=>{console.error(JSON.stringify(sanitizedRenewalFailure(error)));process.exitCode=1;});
}
