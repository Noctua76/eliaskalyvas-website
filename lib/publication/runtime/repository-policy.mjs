// Explicit trusted configuration, never inferred from a caller or collaborator.
import {hashJSON} from '../contract.mjs';
import {TrustError} from './oidc.mjs';
export const REPOSITORY_TRUST_MODEL='nyra.repository-scoped-operation-bound.v1';
export const EXTERNAL_UNKNOWN_RIGHTS=Object.freeze(['unlisted-github-apps','unlisted-oauth-apps','unlisted-personal-tokens','unobserved-administration-mutations']);
const need=(v,c)=>{if(!v)throw new TrustError('REPOSITORY_TRUST_'+c);};
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function signingKeySHA256(jwk){
 need(jwk?.kty==='OKP'&&jwk.crv==='Ed25519'&&typeof jwk.x==='string'&&/^[A-Za-z0-9_-]{43}$/.test(jwk.x)&&!Object.hasOwn(jwk,'d'),'PUBLIC_KEY');
 return hashJSON({kty:jwk.kty,crv:jwk.crv,x:jwk.x});
}
export function validateRepositoryTrust(t){
 need(t?.model===REPOSITORY_TRUST_MODEL&&t.repository==='Noctua76/eliaskalyvas-website'&&t.repositoryId==='1389733212'&&t.ownerId==='217035723','MODEL');
 need(Number.isSafeInteger(t.version)&&t.version>0&&/^[a-f0-9]{40}$/.test(t.sourceSHA)&&[t.configurationSHA256,t.identitiesSHA256,t.governanceSHA256,t.administrationSHA256].every(hex),'PINS');
 need([t.ownerKey,t.retirementKey].every(k=>typeof k?.id==='string'&&k.id.length>0&&k.id.length<=120&&hex(k.sha256))&&t.ownerKey.id!==t.retirementKey.id&&t.ownerKey.sha256!==t.retirementKey.sha256,'KEY_PINS');
 need(t.inventoryComplete===false&&t.exclusiveTechnicalOwnerControl==='NOT_PROVEN'&&Array.isArray(t.unknownExternalRights)&&t.unknownExternalRights.length===EXTERNAL_UNKNOWN_RIGHTS.length&&new Set(t.unknownExternalRights).size===EXTERNAL_UNKNOWN_RIGHTS.length&&EXTERNAL_UNKNOWN_RIGHTS.every(x=>t.unknownExternalRights.includes(x)),'UNKNOWN_RIGHTS');
 need(Array.isArray(t.knownAuthorities)&&t.knownAuthorities.length<1000&&new Set(t.knownAuthorities.map(x=>x.kind+':'+x.id)).size===t.knownAuthorities.length,'AUTHORITIES');
 for(const a of t.knownAuthorities){
  need(['github-app','oauth-app','personal-access-token'].includes(a.kind)&&typeof a.id==='string'&&a.id.length>0&&['included','excluded','unknown'].includes(a.repositoryAccess)&&hex(a.sourceSHA256)&&Number.isFinite(Date.parse(a.observedAt)),'AUTHORITY_SOURCE');
  need(a.permissions&&['contents','workflows','pull_requests','administration','actions','checks','deployments','environments'].every(k=>Object.hasOwn(a.permissions,k))&&Object.values(a.permissions).every(v=>['read','write','none','unknown'].includes(v)),'AUTHORITY_PERMISSIONS');
 }
 need(!['acceptedForTrust','productionAuthorized','override','ownerReceipt','token','secret'].some(k=>Object.hasOwn(t,k)),'INJECTED_APPROVAL');
 return structuredClone(t);
}
export function bindRepositoryTrust(t,c){
 t=validateRepositoryTrust(t);
 need(t.sourceSHA===c.identities.build.callerSHA&&Object.values(c.identities).every(p=>p.callerSHA===t.sourceSHA)&&t.identitiesSHA256===hashJSON(c.identities)&&t.governanceSHA256===hashJSON(c.governance)&&c.governance.mode==='SINGLE_OWNER','CONFIGURATION_CHANGED');
 return Object.freeze(t);
}
