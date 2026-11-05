// Trust boundary for a future host extension. No installation, no secret generation.
// A caller-supplied boolean is NEVER an owner approval.
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
const need=(x,k)=>{if(!x)throw Error('EXTENSION_AUTH_'+k);};
const digest=x=>createHash('sha256').update(x).digest('hex');
const utc=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(x)&&Number.isFinite(Date.parse(x));
const keys=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===k.slice().sort().join(',');
export function verifyExtensionAuthority({target,approval,publicKey,expectedKeySHA256,machineId,previousGenerationSHA256,now=Date.now}){
 need(target?.schema==='nyra.acceptance.replacement.v2'&&target.authorization===false,'TARGET');
 need(keys(approval,['schema','bootstrapId','providerResourceId','machineIdSHA256','oldDeadline','newDeadline','previousGenerationSHA256','decisionId','issuedAt','expiresAt','signature']),'FIELDS');
 need(approval.schema==='nyra.acceptance.host-extension-approval.v1','SCHEMA');
 need(typeof target.resourceId==='string'&&target.resourceId!=='615221104'&&target.resourceId===approval.providerResourceId&&approval.bootstrapId===target.bootstrapId,'HOST_ID');
 need(typeof machineId==='string'&&/^[a-f0-9]{32}$/.test(machineId)&&approval.machineIdSHA256===digest(machineId),'MACHINE');
 need(/^[a-f0-9]{64}$/.test(previousGenerationSHA256)&&approval.previousGenerationSHA256===previousGenerationSHA256,'OLD_GENERATION');
 need(utc(target.expiresAt)&&utc(approval.oldDeadline)&&utc(approval.newDeadline)&&approval.oldDeadline===target.expiresAt&&Date.parse(approval.newDeadline)-Date.parse(approval.oldDeadline)===7*86400000,'DEADLINE');
 const t=now();
 need(Number.isFinite(t)&&utc(approval.issuedAt)&&utc(approval.expiresAt)&&
  t>=Date.parse(approval.issuedAt)&&t<Date.parse(approval.expiresAt)&&
  Date.parse(approval.expiresAt)-Date.parse(approval.issuedAt)<=15*60000&&
  t<Date.parse(target.expiresAt),'FRESHNESS');
 need(typeof approval.decisionId==='string'&&/^[a-f0-9]{8}-[a-f0-9-]{27,}$/.test(approval.decisionId),'DECISION');
 need(/^[a-f0-9]{64}$/.test(expectedKeySHA256),'KEY_PIN');
 let key;
 try{key=createPublicKey(publicKey);}catch{throw Error('EXTENSION_AUTH_PUBLIC_KEY');}
 need(key.asymmetricKeyType==='ed25519'&&digest(key.export({format:'der',type:'spki'}))===expectedKeySHA256,'KEY_IDENTITY');
 const {signature,...message}=approval;
 need(typeof signature==='string'&&/^[A-Za-z0-9_-]{80,100}$/.test(signature),'SIGNATURE');
 let valid=false;
 try{valid=verifySignature(null,Buffer.from(JSON.stringify(message)),key,Buffer.from(signature,'base64url'));}
 catch{}
 need(valid,'SIGNATURE');
 return Object.freeze({status:'SIGNED_EXTENSION_AUTHORITY_VERIFIED_NOT_INSTALLED',decisionId:approval.decisionId,oldDeadline:approval.oldDeadline,newDeadline:approval.newDeadline,previousGenerationSHA256,executionAuthorized:false});
}
