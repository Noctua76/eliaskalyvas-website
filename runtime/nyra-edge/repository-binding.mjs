// Real dependency binding only. No client request can select the trust model,
// pins, admin credential, owner source, policy state or retirement identity.
import {signingKeySHA256} from '../../lib/publication/runtime/repository-policy.mjs';
import {administrationReader} from '../../lib/publication/runtime/administration-evidence.mjs';
import {createRepositoryTrustGate} from '../../lib/publication/runtime/repository-trust.mjs';
import {reviewedAcceptancePolicies} from '../../lib/publication/integration/live-acceptance.mjs';
import {reviewedIntegrationPolicy} from '../../lib/publication/integration/policy.mjs';
import {verifyEvidence} from '../../lib/publication/runtime/acceptance-evidence.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
import {policyGuard} from '../../lib/publication/runtime/governance.mjs';
export function bindRepositoryControlPlane({configuration,adminTokenSource,readOwnerRiskDecision,ownerRiskDecisionId,ownerDecisionPublicJWK,ownerDecisionKeyId,readPolicyState,invalidatePolicyState,retireRegistrations,retirementPublicJWK,retirementKeyId,fetcher=fetch,now=Date.now}){
 configuration=structuredClone(configuration);ownerDecisionPublicJWK=structuredClone(ownerDecisionPublicJWK);retirementPublicJWK=structuredClone(retirementPublicJWK);
 const roles=['build','inspection','publication'],acceptance=configuration.version==='nyra.repository.acceptance.v1',policies=acceptance?reviewedAcceptancePolicies(configuration):Object.fromEntries(roles.map(r=>[r,reviewedIntegrationPolicy(configuration,r)]));
 if(!configuration.repositoryTrust||typeof readPolicyState!=='function'||typeof invalidatePolicyState!=='function'||typeof retireRegistrations!=='function'||retirementKeyId!==configuration.repositoryTrust.retirementKey.id||signingKeySHA256(retirementPublicJWK)!==configuration.repositoryTrust.retirementKey.sha256||retirementKeyId===ownerDecisionKeyId)throw Error('REPOSITORY_BINDING_REQUIRED');
 let retirementKey;const key=async()=>retirementKey??=await crypto.subtle.importKey('jwk',retirementPublicJWK,'Ed25519',false,['verify']);
 const getJSON=administrationReader({tokenSource:adminTokenSource,fetcher});
 const gate=createRepositoryTrustGate({configuration,policies,getJSON,readOwnerRiskDecision:async input=>{const e=await readOwnerRiskDecision(input);let shared=false;try{await verifyEvidence({...e,keyId:retirementKeyId},{publicKey:await key(),keyId:retirementKeyId});shared=true;}catch{}if(shared)throw Error('REPOSITORY_SIGNER_SEPARATION');return e;},ownerRiskDecisionId,ownerDecisionPublicJWK,ownerDecisionKeyId,now,retire:async pins=>{
  // Existing separate registrar/broker IPC: verify its pinned signed proof,
  // not an unverified {retired:true} response. Local gate is already closed.
  const changed=invalidatePolicyState(pins.policySHA256s);if(changed?.then||roles.some(r=>pins.policySHA256s.includes(readPolicyState(r)?.policySHA256)))throw Error('REPOSITORY_POLICY_STATE_NOT_RETIRED');
  const challenge=crypto.randomUUID();
  const r=await verifyEvidence(await retireRegistrations({...pins,challenge}),{publicKey:await key(),keyId:retirementKeyId});
  const time=Date.parse(r.observedAt);if(r.schema!=='nyra.repository.retirement.v1'||r.challenge!==challenge||r.repositoryTrustSHA256!==pins.repositoryTrustSHA256||r.activeRegistrations!==0||r.policiesSHA256!==hashJSON(policies)||!Number.isFinite(time)||time>now()||now()-time>=60000)throw Error('REPOSITORY_RETIREMENT_UNVERIFIED');
 }});
 const state=role=>{gate.assertActive();if(!roles.includes(role))throw Error('REPOSITORY_ROLE');return readPolicyState(role);};
 const assertOperation=async(role,operation)=>{
  if(!roles.includes(role))throw Error('REPOSITORY_ROLE');const p=policies[role],guard=policyGuard(p,()=>state(role));
  try{guard();await gate.assert(p,operation);guard();return true;}catch(e){await gate.retire();throw e;}
 };
 return Object.freeze({getJSON,policies,readPolicyState:state,assertTrustActive:gate.assertActive,
  assertOperation,assertAdministration:(p,operation='identity')=>{const role=roles.find(r=>hashJSON(policies[r])===hashJSON(p));if(!role)return gate.retire().then(()=>{throw Error('REPOSITORY_POLICY');});return assertOperation(role,operation);},
  assertTrustReady:()=>{if(acceptance)throw Error('ACCEPTANCE_CANNOT_AUTHORIZE_PUBLICATION');return assertOperation('publication','editorial-authorize');},retire:gate.retire});
}
