// LOCAL SYNTHETIC evidence only. Cryptography is real; owner/GitHub facts are fixtures.
import {integrationConfiguration} from './final-integration.mjs';
import {integrationAPI} from './protected-integration.mjs';
import {readState} from './protected-delivery.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
import {readRepositoryAdministration,ENVIRONMENT_IDS} from '../../lib/publication/runtime/administration-evidence.mjs';
import {REPOSITORY_TRUST_MODEL,EXTERNAL_UNKNOWN_RIGHTS,signingKeySHA256} from '../../lib/publication/runtime/repository-policy.mjs';
import {reviewedIntegrationPolicy} from '../../lib/publication/integration/policy.mjs';
import {createOwnerRiskSource,signedDecisionJournal} from '../../lib/publication/runtime/owner-risk-source.mjs';
import {evidenceSigner} from '../../lib/publication/runtime/acceptance-evidence.mjs';
import {createRepositoryTrustGate} from '../../lib/publication/runtime/repository-trust.mjs';
export async function repositoryTrustFixture({retire=async()=>{},clock=Date.now,normalConfigurationSHA256='1'.repeat(64)}={}){
 const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),retirementKeys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),ownerPublicJWK=await crypto.subtle.exportKey('jwk',keys.publicKey),retirementPublicJWK=await crypto.subtle.exportKey('jwk',retirementKeys.publicKey);
 const api=integrationAPI(),configuration=integrationConfiguration(),roles=['build','inspection','publication'];
 for(const [name,id]of Object.entries(ENVIRONMENT_IDS)){
  api.data['/environments/'+name]={...structuredClone(api.data['/environments/nyra-build']),id:Number(id),name};
  api.data['/environments/'+name+'/deployment-branch-policies?per_page=100']=structuredClone(api.data['/environments/nyra-build/deployment-branch-policies?per_page=100']);
  api.data['/environments/'+name+'/secrets?per_page=100']={total_count:0,secrets:[]};configuration.identities[name.slice(5)].environmentId=id;
 }
 api.data['/keys?per_page=100']=[];api.data['/actions/permissions/workflow']={default_workflow_permissions:'read',can_approve_pull_request_reviews:false};
 const administration=await readRepositoryAdministration({getJSON:api.getJSON,governance:configuration.governance,now:clock});
 configuration.repositoryTrust={model:REPOSITORY_TRUST_MODEL,repository:'Noctua76/eliaskalyvas-website',repositoryId:'1389733212',ownerId:'217035723',version:1,ownerKey:{id:'unit-owner',sha256:signingKeySHA256(ownerPublicJWK)},retirementKey:{id:'unit-retirement',sha256:signingKeySHA256(retirementPublicJWK)},sourceSHA:'a'.repeat(40),configurationSHA256:normalConfigurationSHA256,identitiesSHA256:hashJSON(configuration.identities),governanceSHA256:hashJSON(configuration.governance),administrationSHA256:administration.record.protectionsSHA256,inventoryComplete:false,exclusiveTechnicalOwnerControl:'NOT_PROVEN',unknownExternalRights:[...EXTERNAL_UNKNOWN_RIGHTS],knownAuthorities:[{id:'synthetic-development-app',kind:'github-app',repositoryAccess:'unknown',sourceSHA256:'2'.repeat(64),observedAt:new Date(clock()).toISOString(),permissions:Object.fromEntries(['contents','workflows','pull_requests','administration','actions','checks','deployments','environments'].map(k=>[k,'unknown']))}]};
 const policies=Object.fromEntries(roles.map(role=>[role,reviewedIntegrationPolicy(configuration,role)]));
 const sign=evidenceSigner({privateKey:keys.privateKey,publicKeyId:'unit-owner'}),rows=[],ownerAuthUserId='00000000-0000-4000-8000-000000000900';let ownerActive=true;
 const journal=signedDecisionJournal({records:{read:async()=>structuredClone(rows),append:async row=>rows.push(row)},signRecord:sign,publicKey:keys.publicKey,keyId:'unit-owner'});
 const policy={repository:configuration.repositoryTrust.repository,repositoryId:'1389733212',ownerId:'217035723',governanceMode:'SINGLE_OWNER',policyVersion:configuration.governance.policyVersion,ownerAuthUserId,repositoryTrust:configuration.repositoryTrust,allowedPolicySHA256s:Object.values(policies).map(hashJSON),windowEndsAt:new Date(clock()+3600000).toISOString()};
 const source=createOwnerRiskSource({policy,journal,signReceipt:sign,now:clock,authenticateOwner:async token=>{if(token!=='UNIT_OWNER_AAL2'||!ownerActive)throw Error('OWNER_DENIED');return {contract:'existing-owner-mfa',ownerId:'217035723',authUserId:ownerAuthUserId,sessionDigest:'3'.repeat(64),expiresAt:clock()+3600000};}});
 const authorization={token:'UNIT_OWNER_AAL2',repositoryTrustSHA256:hashJSON(configuration.repositoryTrust),policyVersion:policy.policyVersion,riskAcknowledgment:{write:true,merge:true,workflow:true,unknownExternalRights:true,externalAdministrationMutation:true}};
 const decision=await source.authorize(authorization);
 const args={configuration,policies,getJSON:api.getJSON,readOwnerRiskDecision:source.receipt,ownerRiskDecisionId:decision.decisionId,ownerDecisionPublicJWK:ownerPublicJWK,ownerDecisionKeyId:'unit-owner',retire,now:clock};
 const states=Object.fromEntries(roles.map(r=>[r,readState(policies[r])()]));
 return {...api,configuration,policies,administration,keys,retirementKeys,ownerPublicJWK,retirementPublicJWK,sign,journal,rows,source,decision,authorization,args,states,gate:createRepositoryTrustGate(args),revokeOwner:()=>ownerActive=false};
}
