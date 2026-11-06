// Explicit root-only PostgreSQL renewal for a fresh, independently authorized
// acceptance session. Never invoked by an import, CI, an HTTP request or a job.
// The existing Owner Source signs an operation-bound, fresh challenge; the
// repository trust gate also re-reads current GitHub Administration protections.
import {execFileSync} from 'node:child_process';
import {readFile,open,writeFile,rename,rm,lstat,chown,chmod} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {readRepositoryAdministration,administrationReader} from '../../lib/publication/runtime/administration-evidence.mjs';
import {createRepositoryTrustGate} from '../../lib/publication/runtime/repository-trust.mjs';
import {reviewedAcceptancePolicies} from '../../lib/publication/integration/live-acceptance.mjs';
import {privateFile} from './owner-source.mjs';
import {ownerRequest} from './owner-request.mjs';
import {validateReplacementTarget} from './replacement-target.mjs';
import {replacementRenewalWindow,replacementRenewalSQL} from './repository-db.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
const need=(x,c)=>{if(!x)throw Error('NYRA_DB_RENEWAL_'+c);};
const command=(program,args,input)=>{
 try{return execFileSync(program,args,{encoding:'utf8',input,timeout:30000,
  stdio:[input===undefined?'ignore':'pipe','pipe','pipe']}).trim();}
 catch(e){throw Error('NYRA_DB_RENEWAL_COMMAND_DENIED');}
};
const docker=(args,input)=>command('docker',args,input);
const uid=role=>{const v=command('getent',['passwd','nyra-'+role]).split(':');need(v.length>=4&&Number(v[2])>0,'ROLE_USER');return {uid:Number(v[2]),gid:Number(v[3])};};
async function sealed(path,allowedUid=0){
 const s=await lstat(path);
 need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===allowedUid&&(s.mode&0o077)===0&&s.size<65536,'SEALED_FILE');
 return JSON.parse(await readFile(path,'utf8'));
}
async function atomicSealed(path,value,owner={uid:0,gid:0}){
 const next=path+'.nyra-'+randomUUID(),bytes=typeof value==='string'?value:JSON.stringify(value);
 const f=await open(next,'wx',0o600);
 try{await f.writeFile(bytes);await f.sync();}
 finally{await f.close();}
 await chown(next,owner.uid,owner.gid);await chmod(next,0o600);
 return next;
}
async function durableState(path,obj){
 const next=await atomicSealed(path, obj);
 await rename(next,path);
 const f=await open(path,'r');
 try{await f.sync();}finally{await f.close();}
}
export function assertRenewalHostBoundary({target,session,host,timerActive,networkInternal,roleContainers,serviceActive,now=Date.now}){
 validateReplacementTarget(target,{created:true,now});
 need(target.schema==='nyra.acceptance.replacement.v2'&&host===target.hostname,'HOST');
 need(timerActive===true&&networkInternal===true&&serviceActive===false&&roleContainers===0,'ISOLATION');
 return replacementRenewalWindow(target,session,{now});
}
export async function applyAuthorizedRenewal({target,session,assertTrust,paths,now=Date.now}){
 need(typeof assertTrust==='function','TRUST_ADAPTER');
 need(process.getuid?.()===0,'ROOT');
 const lease=assertRenewalHostBoundary({target,session,host:command('hostname',[]),
  timerActive:command('systemctl',['is-active','nyra-repository-expiry.timer'])==='active',
  networkInternal:docker(['network','inspect','-f','{{.Internal}}','nyra-repository-db'])==='true',
  roleContainers:docker(['ps','-aq','--filter','name=^nyra-5c-live-']).split('\n').filter(Boolean).length,
  serviceActive:command('systemctl',['is-active','nyra-repository-runtime.service'])==='active',now});
 need(paths?.journal==='/opt/nyra-5c/private/renewal-state.json','JOURNAL_PATH');
 const state=await sealed(paths.journal).catch(e=>{
  if(e?.code==='ENOENT')return null;
  if(String(e?.message??'').includes('ENOENT'))return null;
  throw e;
 });
 need(state===null||state.schema==='nyra.acceptance.db-renewal-state.v1'&&
  state.bootstrapId===target.bootstrapId&&state.sessionId!==lease.sessionId&&
  ['complete','pending','db-updated'].includes(state.status),'REPLAY_OR_STATE');
 // Fresh trust check precedes credential generation or any mutation.
 need(await assertTrust(lease)===true,'OWNER_ADMINISTRATION');
 const users=Object.fromEntries(['registrar','broker'].map(r=>[r,uid(r)]));
 const secrets={registrar:randomBytes(24).toString('hex'),broker:randomBytes(24).toString('hex')};
 const staged={};
 const rolePaths={registrar:'/var/lib/nyra-5c/registrar/pg.json',broker:'/var/lib/nyra-5c/broker/pg.json'};
 for(const role of ['registrar','broker']){
  const old=await sealed(rolePaths[role],users[role].uid);
  need(old.user==='nyra_accept_'+role&&old.host==='db'&&old.port===5432&&old.database==='postgres','ROLE_SCOPE');
  staged[role]=await atomicSealed(rolePaths[role],{...old,password:secrets[role]},users[role]);
 }
 const pending={schema:'nyra.acceptance.db-renewal-state.v1',bootstrapId:target.bootstrapId,
  sessionId:lease.sessionId,startsAt:lease.startsAt,endsAt:lease.endsAt,roleValidUntil:lease.roleValidUntil,status:'pending'};
 let dbChanged=false;
 try{
  await durableState(paths.journal,pending);
  // Recheck Owner and Administration immediately before committing SQL.
  need(await assertTrust(lease)===true,'TRUST_RECHECK');
  const args=['exec','-i','nyra-repository-pg','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-t','-A'];
  const sql=replacementRenewalSQL(lease,secrets);
  const response=docker(args,sql);
  dbChanged=true;
  const actual=response.split('\n').map(x=>x.trim()).filter(x=>x.startsWith('nyra_accept_'));
  need(JSON.stringify(actual)===JSON.stringify(['nyra_accept_broker|'+lease.roleValidUntil,'nyra_accept_registrar|'+lease.roleValidUntil]),'SERVER_VALIDITY');
  await durableState(paths.journal,{...pending,status:'db-updated'});
  for(const role of ['registrar','broker']){
   await rename(staged[role],rolePaths[role]);delete staged[role];
   const check=await sealed(rolePaths[role],users[role].uid);
   need(check.password===secrets[role]&&check.user==='nyra_accept_'+role,'CREDENTIAL_READBACK');
  }
  // A matching committed lease is required before the next launcher starts.
  await durableState(paths.journal,{...pending,status:'complete'});
  return Object.freeze({status:'POSTGRESQL_RENEWAL_COMMITTED',sessionId:lease.sessionId,
   roleValidUntil:lease.roleValidUntil,ownerAndAdministrationRechecked:true,credentialsReturned:false});
 }catch{
  await durableState(paths.journal,{...pending,status:dbChanged?'db-updated':'pending'});
  throw Error('NYRA_DB_RENEWAL_FAILED_CLOSED');
 }finally{
  for(const p of Object.values(staged))await rm(p,{force:true});
 }
}
export async function runHostRenewal(){
 need(process.getuid?.()===0&&process.env.NYRA_DB_RENEWAL==='1'&&process.argv.length===3&&process.argv[2]==='--renew','DISABLED');
 const config=await privateFile('/opt/nyra-5c/private/launch.json');
 const target=await privateFile('/etc/nyra-acceptance/target.json');
 need(hashJSON(config.target)===hashJSON(target),'TARGET_PIN');
 const session=await privateFile('/opt/nyra-5c/private/renewal-session.json');
 const coordinator=uid('coordinator');
 const ownerKey=await sealed(config.ownerKeyFile,coordinator.uid);
 need(ownerKey.keyId===config.configuration.repositoryTrust.ownerKey.id,'OWNER_KEY_ID');
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
  return true;
 },paths:{journal:'/opt/nyra-5c/private/renewal-state.json'}});
}
if(process.argv[1]===new URL(import.meta.url).pathname)runHostRenewal().then(r=>{
 console.log(JSON.stringify(r));
}).catch(()=>{console.error('NYRA_DB_RENEWAL_DENIED');process.exitCode=1;});
