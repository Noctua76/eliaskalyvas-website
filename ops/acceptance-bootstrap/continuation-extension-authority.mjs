// Non-installing owner authorization gate for an eventual host +7d migration.
// Reuses existing NYRA Ed25519 signed-evidence envelope and pinned owner JWK.
import {createHash} from 'node:crypto';
import {verifyEvidence} from '../../lib/publication/runtime/acceptance-evidence.mjs';
import {signingKeySHA256} from '../../lib/publication/runtime/repository-policy.mjs';
import {validateReplacementTarget} from './replacement-target.mjs';
const need=(x,k)=>{if(!x)throw Error('EXTENSION_AUTH_'+k);};
const digest=x=>createHash('sha256').update(x).digest('hex');
const utc=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(x)&&Number.isFinite(Date.parse(x));
const keys=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===k.slice().sort().join(',');
export async function verifyExtensionAuthority({target,envelope,ownerPublicJWK,ownerKeyId,expectedKeySHA256,machineId,previousGenerationSHA256,now=Date.now}){
 need(target?.schema==='nyra.acceptance.replacement.v2'&&target.authorization===false,'TARGET');
 validateReplacementTarget(target,{created:true,now});
 need(/^[a-f0-9]{64}$/.test(expectedKeySHA256)&&signingKeySHA256(ownerPublicJWK)===expectedKeySHA256,'KEY_PIN');
 let key;
 try{key=await crypto.subtle.importKey('jwk',ownerPublicJWK,'Ed25519',false,['verify']);}
 catch{throw Error('EXTENSION_AUTH_PUBLIC_KEY');}
 let approval;
 try{approval=await verifyEvidence(envelope,{publicKey:key,keyId:ownerKeyId});}
 catch{throw Error('EXTENSION_AUTH_SIGNATURE');}
 need(keys(approval,['schema','repository','governanceMode','ownerId','bootstrapId','providerResourceId','machineIdSHA256','oldDeadline','newDeadline','previousGenerationSHA256','decisionId','issuedAt','expiresAt']),'FIELDS');
 need(approval.schema==='nyra.acceptance.host-extension-approval.v1'&&approval.repository==='Noctua76/eliaskalyvas-website'&&
  approval.governanceMode==='SINGLE_OWNER'&&approval.ownerId==='217035723','SCHEMA');
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
 return Object.freeze({status:'SIGNED_EXTENSION_AUTHORITY_VERIFIED_NOT_INSTALLED',decisionId:approval.decisionId,oldDeadline:approval.oldDeadline,newDeadline:approval.newDeadline,previousGenerationSHA256,executionAuthorized:false});
}
