// Owner-authorized future host extension. Explicit root-only --extend command.
// Never runs during import, CI, installation or background timer activation.
// The original 14-day timer stays ARMED; its service independently verifies
// the signed committed receipt and candidate before deferring early retirement.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {open,readFile,lstat,writeFile,rename,rm} from 'node:fs/promises';
import {migrateExtensionGeneration} from './extension-migration.mjs';
import {verifyExtensionAuthority} from './continuation-extension-authority.mjs';
import {verifyInstalledExtension} from './extension-effective.mjs';
import {reviewedAcceptancePolicies} from '../../lib/publication/integration/live-acceptance.mjs';
import {createRepositoryTrustGate} from '../../lib/publication/runtime/repository-trust.mjs';
import {administrationReader} from '../../lib/publication/runtime/administration-evidence.mjs';
import {signingKeySHA256} from '../../lib/publication/runtime/repository-policy.mjs';
import {privateFile} from './owner-source.mjs';
import {ownerRequest} from './owner-request.mjs';
import {validateReplacementTarget} from './replacement-target.mjs';
const need=(v,k)=>{if(!v)throw Error('NYRA_EXTENSION_HOST_'+k);};
const sha=s=>createHash('sha256').update(s).digest('hex');
const oldUnit='nyra-repository-expiry.timer';
const nextUnit='nyra-repository-expiry-extension.timer';
const base='/etc/systemd/system/';
const journal='/etc/nyra-acceptance/extension-installed.json';
const sys=(args)=>execFileSync('systemctl',args,{encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']}).trim();
const enabled=name=>sys(['is-enabled',name])==='enabled';
const active=name=>sys(['show',name,'--property=ActiveState','--value'])==='active';
const prop=(name,key)=>sys(['show',name,'--property='+key,'--value']);
const expected=s=>s.slice(0,19).replace('T',' ')+' UTC';
const utcOf=unit=>{const value=prop(unit,'NextElapseUSecRealtime');need(value.endsWith(' UTC'),'CALENDAR');return value.slice(-23);};
const readRoot=async(p,mode)=>{
 const s=await lstat(p);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===0&&(s.mode&0o777)===mode&&s.size<100000,'ROOT_FILE');
 return readFile(p,'utf8');
};
const readOther=async(p,uid)=>{
 const s=await lstat(p);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===uid&&(s.mode&0o077)===0&&s.size<100000,'SEALED_SOURCE');
 return JSON.parse(await readFile(p,'utf8'));
};
const getUid=role=>{const v=execFileSync('getent',['passwd',role],{encoding:'utf8'}).trim().split(':');need(v.length>=4&&Number(v[2])>0,'UID');return Number(v[2]);};
export function createSystemdExtensionAdapters({target,envelope,ownerPublicJWK,ownerKeyId,expectedKeySHA256,machineId}){
 const fresh=()=>Date.now()<Date.parse(target.expiresAt);
 const readCurrent=async()=>{
  const timer=await readRoot(base+oldUnit,0o644);
  return {enabled:enabled(oldUnit),active:active(oldUnit),
   service:prop(oldUnit,'Unit'),
   deadline:utcOf(oldUnit)===expected(target.expiresAt)?target.expiresAt:'MISMATCH',
   generationSHA256:sha(timer)};
 };
 const readCandidate=async()=>{
  const timer=await readRoot(base+nextUnit,0o644);
  const next=await lstat(base+nextUnit);
  const deadline=envelope.record.newDeadline;
  return {sha256:sha(timer),enabled:enabled(nextUnit),active:active(nextUnit),
   deadline:utcOf(nextUnit)===expected(deadline)?deadline:'MISMATCH',
   unit:prop(nextUnit,'Unit'),originalStillArmed:enabled(oldUnit)&&active(oldUnit)};
 };
 return {
  readCurrent,
  replaySeen:async()=>{try{await lstat(journal);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}},
  stageCandidate:async({candidate,candidateSHA256})=>{
   need(fresh()&&sha(candidate)===candidateSHA256,'CANDIDATE');
   need(!await (async()=>{try{await lstat(base+nextUnit);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}})(),'ALREADY_STAGED');
   const handle=await open(base+nextUnit,'wx',0o644);
   try{await handle.writeFile(candidate);await handle.sync();}finally{await handle.close();}
   execFileSync('systemd-analyze',['verify',base+nextUnit,base+'nyra-repository-expiry.service'],{encoding:'utf8',timeout:20000});
   sys(['daemon-reload']);sys(['enable','--now',nextUnit]);
  },
  readCandidate,
  activate:async()=>{
   need(fresh()&&enabled(oldUnit)&&active(oldUnit)&&enabled(nextUnit)&&active(nextUnit),'OLD_DEADLINE_ARMED');
  },
  readEffective:async()=>readCandidate(),
  commitReceipt:async({decisionId,oldDeadline,newDeadline,oldSHA256,newSHA256,replayProtection})=>{
   need(fresh()&&replayProtection===true&&!await (async()=>{try{await lstat(journal);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}})(),'REPLAY');
   const receipt={schema:'nyra.acceptance.extension-installed.v1',status:'committed',
    bootstrapId:target.bootstrapId,providerResourceId:target.resourceId,
    envelope,ownerPublicJWK,ownerKeyId,expectedKeySHA256,
    decisionId,oldDeadline,newDeadline,oldTimerSHA256:oldSHA256,
    newTimerSHA256:newSHA256,committedAt:new Date().toISOString()};
   const original=await readRoot(base+oldUnit,0o644);
   const candidate=await readRoot(base+nextUnit,0o644);
   await verifyInstalledExtension({target,receipt,machineId,oldTimer:original,newTimer:candidate,trustedOwnerKeySHA256:expectedKeySHA256,trustedOwnerKeyId:ownerKeyId});
   need(enabled(oldUnit)&&active(oldUnit)&&enabled(nextUnit)&&active(nextUnit),'DURABLE_ARM');
   const temp=journal+'.new';
   const f=await open(temp,'wx',0o600);
   try{await f.writeFile(JSON.stringify(receipt));await f.sync();}finally{await f.close();}
   await rename(temp,journal);
   const directory=await open('/etc/nyra-acceptance','r');
   try{await directory.sync();}finally{await directory.close();}
   return true;
  },
  rollback:async()=>{
   try{sys(['disable','--now',nextUnit]);}catch{}
   try{await rm(base+nextUnit,{force:true});}catch{}
   sys(['daemon-reload']);
   need(enabled(oldUnit)&&active(oldUnit),'ORIGINAL_TIMER_RECOVERY');
  }
 };
}
export async function runHostExtension(){
 need(process.getuid?.()===0&&process.env.NYRA_EXTENSION_INSTALL==='1'&&
  process.argv.length===3&&process.argv[2]==='--extend','DISABLED');
 const target=await privateFile('/etc/nyra-acceptance/target.json');
 validateReplacementTarget(target,{created:true});
 need(execFileSync('hostname',{encoding:'utf8'}).trim()===target.hostname,'HOSTNAME');
 const config=await privateFile('/opt/nyra-5c/private/launch.json');
 need(JSON.stringify(config.target)===JSON.stringify(target),'CONFIG_TARGET');
 const coordinator=getUid('nyra-coordinator');
 const key=await readOther(config.ownerKeyFile,coordinator);
 need(key.keyId===config.configuration.repositoryTrust.ownerKey.id&&
  signingKeySHA256(key.publicKey)===config.configuration.repositoryTrust.ownerKey.sha256,'KEY_PIN');
 const machineId=(await readFile('/etc/machine-id','utf8')).trim();
 need(/^[a-f0-9]{32}$/.test(machineId),'MACHINE_ID');
 // On a NEW approval, obtain the Owner's fresh AAL2 bearer from stdin ONLY.
 // The private Owner Source validates it server-side and signs the exact host
 // identity, original generation, +7 days and a fresh decision ID.
 const approvalPath='/opt/nyra-5c/private/extension-approval.json';
 let envelope;
 try{envelope=JSON.parse(await readRoot(approvalPath,0o600));}
 catch(e){
  if(e?.code!=='ENOENT')throw e;
  const ownerConfig=await readOther('/var/lib/nyra-5c/owner/source.json',getUid('nyra-owner'));
  need(typeof ownerConfig.socket==='string'&&ownerConfig.policy?.repositoryTrust,'OWNER_SOURCE');
  let token='';
  for await(const chunk of process.stdin){token+=chunk.toString();need(token.length<20000,'TOKEN_SIZE');}
  token=token.trim();need(token.length>30&&!/\s/.test(token),'OWNER_AAL2_TOKEN');
  const original=await readRoot(base+oldUnit,0o644);
  const newDeadline=new Date(Date.parse(target.expiresAt)+604800000).toISOString().replace('.000Z','Z');
  envelope=await ownerRequest({socket:ownerConfig.socket,operation:'extend',input:{
   token,ownerDecisionId:config.ownerDecisionId,bootstrapId:target.bootstrapId,
   providerResourceId:target.resourceId,machineIdSHA256:sha(machineId),
   oldDeadline:target.expiresAt,newDeadline,previousGenerationSHA256:sha(original)
  }});
  token='';
  await verifyExtensionAuthority({target,envelope,ownerPublicJWK:key.publicKey,
   ownerKeyId:key.keyId,expectedKeySHA256:config.configuration.repositoryTrust.ownerKey.sha256,
   machineId,previousGenerationSHA256:sha(original)});
  const f=await open(approvalPath,'wx',0o600);
  try{await f.writeFile(JSON.stringify(envelope));await f.sync();}finally{await f.close();}
 }

 const policies=reviewedAcceptancePolicies(config.configuration);
 const getJSON=administrationReader({tokenSource:async()=>{
  const c=await readOther(config.githubReadCredential,coordinator);
  need(c.bootstrapId===target.bootstrapId&&Date.parse(c.expiresAt)>Date.now()&&
   Date.parse(c.issuedAt)>=Date.parse(target.createdAt),'ADMIN_CREDENTIAL');
  return c.token;
 }});
 const gate=createRepositoryTrustGate({configuration:config.configuration,policies,getJSON,
  readOwnerRiskDecision:x=>ownerRequest({socket:config.ownerReceiptSocket,operation:'receipt',input:x}),
  ownerRiskDecisionId:config.ownerDecisionId,ownerDecisionPublicJWK:key.publicKey,
  ownerDecisionKeyId:key.keyId,retire:async()=>{try{sys(['stop','nyra-repository-runtime.service']);}catch{}}});
 const verify=async()=>{await gate.assert(policies.build,'host-extension');return true;};
 return migrateExtensionGeneration({target,envelope,ownerPublicJWK:key.publicKey,
  ownerKeyId:key.keyId,expectedKeySHA256:config.configuration.repositoryTrust.ownerKey.sha256,
  machineId,assertFreshOwnerMFA:verify,assertFreshAdministration:verify,
  ...createSystemdExtensionAdapters({target,envelope,ownerPublicJWK:key.publicKey,
   ownerKeyId:key.keyId,expectedKeySHA256:config.configuration.repositoryTrust.ownerKey.sha256,machineId})});
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 runHostExtension().then(r=>console.log(JSON.stringify(r)))
  .catch(()=>{console.error('NYRA_EXTENSION_HOST_DENIED');process.exitCode=1;});
}
