// Actual acceptance binding, unmounted. Admin credentials, DB LOGIN and active
// policy state are injected by separately authorized isolated processes, not jobs.
import {createProtectedOIDCVerifier,postgresIdentityStore,registeredGithubJobFacts} from '../runtime/protected-identity.mjs';
import {createJobRegistrar} from '../runtime/job-registrar.mjs';
import {policyGuard,REQUIRED_CHECKS} from '../runtime/governance.mjs';
import {immutableNormalInventoryAuthority,postgresApprovedInventoryLoader} from './normal-provenance.mjs';
import {hashJSON} from '../contract.mjs';
import {TrustError} from '../runtime/oidc.mjs';
import {acceptedProbePolicy} from './acceptance-policy.mjs';
export {acceptedProbePolicy,reviewedAcceptancePolicies} from './acceptance-policy.mjs';
const need=(v,c)=>{if(!v)throw new TrustError(c);};
export function acceptanceRegistrar({policy,privilege,getJSON,registrarQuery,readPolicyState,assertAdministration,now}){
 need(typeof assertAdministration==='function','ADMIN_GATE_REQUIRED');const p=acceptedProbePolicy(policy,privilege),registrar=createJobRegistrar({policy:p,privilege,getJSON:ownerDispatchReader(getJSON,p),query:registrarQuery,readPolicyState,requiredChecks:REQUIRED_CHECKS,now});
 return Object.freeze({...registrar,async register(selector){await assertAdministration(p);return registrar.register(selector);}});
}
export function acceptanceBroker({policy,buildPolicy,privilege,getJSON,brokerQuery,readPolicyState,assertAdministration,keySource,now=Date.now}){
 need(typeof assertAdministration==='function','ADMIN_GATE_REQUIRED');const p=acceptedProbePolicy(policy,privilege);getJSON=ownerDispatchReader(getJSON,p);const guard=policyGuard(p,readPolicyState),store=postgresIdentityStore({query:brokerQuery}),issued=new WeakSet();
 const verifier=createProtectedOIDCVerifier({policy:p,privilege,getJSON,store,readPolicyState,keySource,requiredChecks:REQUIRED_CHECKS,now}),active=registeredGithubJobFacts({policy:p,privilege,getJSON,store,readPolicyState,requiredChecks:REQUIRED_CHECKS,now});
 return Object.freeze({async authorize(token){await assertAdministration(p);const c=await verifier.verify(token),r=await store.load(c);verifier.assert(c);need(r&&!r.revokedAt&&Date.parse(r.expiresAt)>now(),'REGISTRATION_INACTIVE');const grant=Object.freeze({...c,registration:Object.freeze(r)});issued.add(grant);return grant;},async revalidate(grant){await assertAdministration(p);need(issued.has(grant)&&Date.parse(grant.expiresAt)>now(),'UNVERIFIED_MACHINE');await active(grant);guard();return grant;},inventoryAuthority(configurationSHA256){need(privilege==='publication'&&(!p.repositoryTrust||configurationSHA256===p.repositoryTrust.configurationSHA256),'INVENTORY_CONSUMER');return immutableNormalInventoryAuthority({configurationSHA256,loadApprovedRecord:async(...args)=>{await assertAdministration(p);guard();const row=await postgresApprovedInventoryLoader({query:brokerQuery})(...args);guard();need(row?.record?.builder?.governance&&hashJSON(row.record.builder.governance)===hashJSON(p.governance),'INVENTORY_GOVERNANCE');if(p.repositoryTrust)need(buildPolicy?.repositoryTrust&&hashJSON(buildPolicy.repositoryTrust)===hashJSON(p.repositoryTrust)&&row.record.builder.policySHA256===hashJSON(buildPolicy),'INVENTORY_TRUST_POLICY');return row;}});}});
}

function ownerDispatchReader(getJSON,policy){return async url=>{const r=await getJSON(url);if(/\/actions\/runs\/[1-9][0-9]*$/.test(url)&&r.event==='workflow_dispatch')need(String(r.actor?.id)===policy.ownerId&&String(r.triggering_actor?.id)===policy.ownerId,'ACCEPTANCE_OWNER_DISPATCH');return r;};}
