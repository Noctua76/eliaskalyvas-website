// Fail-closed installed +7d approval verification for the canonical expiry.
// A valid signature alone is NOT enough: both the durable receipt and the
// actual systemd extension timer must agree on the original/new generation.
import {createHash} from 'node:crypto';
import {readFile,lstat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {verifyExtensionAuthority} from './continuation-extension-authority.mjs';
import {validateReplacementTarget} from './replacement-target.mjs';
const need=(v,k)=>{if(!v)throw Error('NYRA_EXTENSION_EFFECTIVE_'+k);};
const sha=s=>createHash('sha256').update(s).digest('hex');
const filename='/etc/systemd/system/nyra-repository-expiry-extension.timer';
async function readOwned(path,mode){
 const st=await lstat(path);
 need(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.uid===0&&(st.mode&0o777)===mode&&st.size<65536,'ROOT_FILE');
 return readFile(path,'utf8');
}
export async function verifyInstalledExtension({target,receipt,machineId,oldTimer,newTimer,trustedOwnerKeySHA256, trustedOwnerKeyId,now=Date.now}){
 need(receipt?.schema==='nyra.acceptance.extension-installed.v1'&&receipt.status==='committed'&&
  receipt.bootstrapId===target.bootstrapId&&receipt.providerResourceId===target.resourceId,'RECEIPT');
 need(typeof machineId==='string'&&/^[a-f0-9]{32}$/.test(machineId),'MACHINE');
 need(/^[a-f0-9]{64}$/.test(trustedOwnerKeySHA256)&&receipt.expectedKeySHA256===trustedOwnerKeySHA256&&
  typeof trustedOwnerKeyId==='string'&&receipt.ownerKeyId===trustedOwnerKeyId,'TRUSTED_OWNER_PIN');
 need(typeof oldTimer==='string'&&typeof newTimer==='string'&&
  sha(oldTimer)===receipt.oldTimerSHA256&&sha(newTimer)===receipt.newTimerSHA256,'GENERATIONS');
 const signedRecord=receipt.envelope?.record;
 need(signedRecord?.decisionId===receipt.decisionId&&signedRecord?.newDeadline===receipt.newDeadline&&
  signedRecord?.oldDeadline===target.expiresAt,'DECISION_BINDING');
 const approvedAt=Date.parse(signedRecord.issuedAt)+1000;
 need(Number.isFinite(approvedAt)&&approvedAt<Date.parse(signedRecord.expiresAt),'APPROVAL_UTC');
 const verified=await verifyExtensionAuthority({
  target,envelope:receipt.envelope,ownerPublicJWK:receipt.ownerPublicJWK,
  ownerKeyId:receipt.ownerKeyId,expectedKeySHA256:receipt.expectedKeySHA256,
  machineId,previousGenerationSHA256:receipt.oldTimerSHA256,now:()=>approvedAt
 });
 need(verified.decisionId===receipt.decisionId&&verified.newDeadline===receipt.newDeadline,'SIGNATURE');
 const committed=Date.parse(receipt.committedAt);
 need(Number.isFinite(committed)&&committed>=Date.parse(signedRecord.issuedAt)&&
  committed<Date.parse(signedRecord.expiresAt)&&committed<Date.parse(target.expiresAt),'COMMIT_TIME');
 need(Number.isFinite(now())&&now()>=Date.parse(target.createdAt),'CLOCK');
 return Object.freeze({effectiveDeadline:receipt.newDeadline,decisionId:receipt.decisionId,
  shouldDefer:now()<Date.parse(receipt.newDeadline),verified:true});
}
export async function shouldDeferHostRetirement(){
 need(process.getuid?.()===0,'ROOT');
 const target=JSON.parse(await readOwned('/etc/nyra-acceptance/target.json',0o600));
 validateReplacementTarget(target,{created:true,allowExpired:true});
 const receipt=JSON.parse(await readOwned('/etc/nyra-acceptance/extension-installed.json',0o600));
 const config=JSON.parse(await readOwned('/opt/nyra-5c/private/launch.json',0o600));
 need(config?.target?.bootstrapId===target.bootstrapId&&config.target.resourceId===target.resourceId,'TRUSTED_CONFIG');
 const trustedOwnerKeySHA256=config?.configuration?.repositoryTrust?.ownerKey?.sha256;
 const trustedOwnerKeyId=config?.configuration?.repositoryTrust?.ownerKey?.id;
 const machineId=(await readFile('/etc/machine-id','utf8')).trim();
 const original=await readOwned('/etc/systemd/system/nyra-repository-expiry.timer',0o644);
 const extended=await readOwned(filename,0o644);
 const state=await verifyInstalledExtension({target,receipt,machineId,oldTimer:original,newTimer:extended,trustedOwnerKeySHA256,trustedOwnerKeyId});
 need(state.shouldDefer,'NEW_DEADLINE_REACHED');
 const active=execFileSync('systemctl',['show','nyra-repository-expiry-extension.timer','--property=ActiveState','--value'],{encoding:'utf8'}).trim();
 need(active==='active','TIMER_NOT_ACTIVE');
 const enabled=execFileSync('systemctl',['is-enabled','nyra-repository-expiry-extension.timer'],{encoding:'utf8'}).trim();
 need(enabled==='enabled','TIMER_NOT_ENABLED');
 const next=execFileSync('systemctl',['show','nyra-repository-expiry-extension.timer','--property=NextElapseUSecRealtime','--value'],{encoding:'utf8'}).trim();
 const expected=state.effectiveDeadline.slice(0,19).replace('T',' ')+' UTC';
 need(next.endsWith(expected),'EFFECTIVE_SYSTEMD_DEADLINE');
 return true;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 if(process.argv.length===3&&process.argv[2]==='--defer'){
  shouldDeferHostRetirement().then(()=>{console.log('NYRA_VERIFIED_EXTENSION_NOT_YET_DUE');})
   .catch(()=>{process.exitCode=1;});
 }else{process.exitCode=1;}
}
