// Owner-approved repository scope; does not attest a complete account inventory.
// This factory belongs to the independent control plane, never an API payload.
import {hashJSON} from '../contract.mjs';
import {verifyEvidence} from './acceptance-evidence.mjs';
import {readRepositoryAdministration,ENVIRONMENT_IDS} from './administration-evidence.mjs';
import {bindRepositoryTrust,signingKeySHA256} from './repository-policy.mjs';
import {TrustError} from './oidc.mjs';
export const REPOSITORY_OPERATIONS=Object.freeze(['identity','registration','editorial-authorize','inspection','delivery','inventory','outbox','reconciliation']);
const need=(v,c)=>{if(!v)throw new TrustError('REPOSITORY_TRUST_'+c);};
export function createRepositoryTrustGate({configuration,policies,getJSON,readOwnerRiskDecision,ownerRiskDecisionId,ownerDecisionPublicJWK,ownerDecisionKeyId,retire,now=Date.now}){
 configuration=structuredClone(configuration);policies=structuredClone(policies);ownerDecisionPublicJWK=structuredClone(ownerDecisionPublicJWK);
 const t=bindRepositoryTrust(configuration.repositoryTrust,configuration),digest=hashJSON(t),roles=['build','inspection','publication'];
 need(typeof getJSON==='function'&&typeof readOwnerRiskDecision==='function'&&typeof retire==='function'&&typeof ownerRiskDecisionId==='string'&&ownerRiskDecisionId.length>0&&ownerDecisionKeyId===t.ownerKey.id&&signingKeySHA256(ownerDecisionPublicJWK)===t.ownerKey.sha256,'SOURCE_REQUIRED');
 need(roles.every(r=>policies[r]?.environment==='nyra-'+r&&policies[r].environmentId===ENVIRONMENT_IDS['nyra-'+r]&&hashJSON(policies[r].repositoryTrust)===digest&&hashJSON(policies[r].governance)===hashJSON(configuration.governance)&&hashJSON(Object.fromEntries(Object.entries(policies[r]).filter(([k])=>!['repositoryTrust','governance'].includes(k))))===hashJSON(configuration.identities[r])),'POLICY_BINDING');
 let ownerKey;const key=async()=>ownerKey??=await crypto.subtle.importKey('jwk',ownerDecisionPublicJWK,'Ed25519',false,['verify']);
 const pins=new Set(roles.map(r=>hashJSON(policies[r])));let active=true,retirement;
 const assertActive=()=>need(active,'RETIRED');
 const stop=async()=>{active=false;retirement??=Promise.resolve().then(()=>retire({repositoryTrustSHA256:digest,policySHA256s:[...pins]}));await retirement;};
 return Object.freeze({assertActive,retire:stop,repositoryTrustSHA256:digest,async assert(policy,operation='identity'){
  assertActive();try{
   const policySHA256=hashJSON(policy);need(pins.has(policySHA256)&&REPOSITORY_OPERATIONS.includes(operation),'OPERATION');
   const e=await readRepositoryAdministration({getJSON,governance:configuration.governance,now});assertActive();
   need(e.record.mainSHA===t.sourceSHA&&e.record.protectionsSHA256===t.administrationSHA256&&e.record.environments.length===3&&e.record.environments.every(x=>ENVIRONMENT_IDS[x.environment]===x.environmentId),'ADMINISTRATION_CHANGED');
   const challenge=crypto.randomUUID();let d;
   try{d=await verifyEvidence(await readOwnerRiskDecision({decisionId:ownerRiskDecisionId,challenge,policySHA256,operation}),{publicKey:await key(),keyId:ownerDecisionKeyId});}catch{throw new TrustError('REPOSITORY_TRUST_OWNER_SOURCE_UNVERIFIED');}
   assertActive();
   need(d?.schema==='nyra.owner-repository-risk.receipt.v1'&&d.decisionId===ownerRiskDecisionId&&d.challenge===challenge&&d.repositoryTrustSHA256===digest&&d.policySHA256===policySHA256&&d.operation===operation&&d.repository===t.repository&&d.repositoryId===t.repositoryId&&d.ownerId===t.ownerId&&d.governanceMode==='SINGLE_OWNER'&&d.policyVersion===configuration.governance.policyVersion&&d.state==='active'&&d.supersededBy===null,'OWNER_BINDING');
   const a=d.ownerAuthorization,r=d.riskAcknowledgment;
   need(a?.contract==='existing-owner-mfa'&&a.verified===true&&a.ownerId===t.ownerId&&typeof a.evidenceId==='string'&&a.evidenceId.length>0&&r?.write===true&&r.merge===true&&r.workflow===true&&r.unknownExternalRights===true&&r.externalAdministrationMutation===true,'OWNER_AUTHORIZATION');
   const issued=Date.parse(d.issuedAt),end=Date.parse(d.expiresAt),time=now();need(Number.isFinite(issued)&&Number.isFinite(end)&&issued<=time&&time<end&&end-issued>0&&end-issued<=60000,'OWNER_FRESHNESS');
   need(time-Date.parse(e.record.observedAt)>=0&&time-Date.parse(e.record.observedAt)<60000,'ADMINISTRATION_STALE');assertActive();
   return true;
  }catch(error){try{await stop();}catch{throw new TrustError('REPOSITORY_TRUST_RETIREMENT_UNCONFIRMED');}throw error;}
 }});
}
