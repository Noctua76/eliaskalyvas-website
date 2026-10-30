// Actual acceptance binding, unmounted. Admin credentials, DB LOGIN and active
// policy state are injected by separately authorized isolated processes, not jobs.
import {createProtectedOIDCVerifier,postgresIdentityStore,registeredGithubJobFacts} from '../runtime/protected-identity.mjs';
import {createJobRegistrar} from '../runtime/job-registrar.mjs';
import {policyGuard,REQUIRED_CHECKS} from '../runtime/governance.mjs';
import {GITHUB_ISSUER,TrustError} from '../runtime/oidc.mjs';
import {DISCOVERY_SUBJECT} from '../runtime/acceptance-collector.mjs';
import {REPOSITORY,ENVIRONMENT_IDS} from '../runtime/administration-evidence.mjs';
import {IMMUTABLE_REPOSITORY_PREFIX} from '../runtime/delivery-policy.mjs';
import {immutableNormalInventoryAuthority,postgresApprovedInventoryLoader} from './normal-provenance.mjs';
import {hashJSON} from '../contract.mjs';
const need=(v,c)=>{if(!v)throw new TrustError(c);};
export function acceptedProbePolicy(policy,privilege){
 const p=structuredClone(policy);need(['build','inspection','publication'].includes(privilege)&&p.purpose==='registered-provenance-acceptance','ACCEPTANCE_POLICY');
 need(p.issuer===GITHUB_ISSUER&&p.repository===REPOSITORY&&p.repositoryId==='1389733212'&&p.ownerId==='217035723'&&p.ref==='refs/heads/main'&&p.environment==='nyra-'+privilege&&p.environmentId===ENVIRONMENT_IDS[p.environment],'ACCEPTANCE_IDENTITY');
 need(typeof p.subject==='string'&&p.subject!==DISCOVERY_SUBJECT&&p.subject.startsWith(IMMUTABLE_REPOSITORY_PREFIX+':')&&!/[\s*]/.test(p.subject),'EXACT_OBSERVED_SUBJECT_REQUIRED');
 need(p.workflowRef===REPOSITORY+'/.github/workflows/nyra-live-trust-acceptance.yml@refs/heads/main'&&/^[a-f0-9]{40}$/.test(p.callerSHA)&&/^[a-f0-9]{40}$/.test(p.jobWorkflowSHA)&&p.jobWorkflowRef===REPOSITORY+'/.github/workflows/nyra-live-trust-probe.yml@'+p.jobWorkflowSHA&&typeof p.jobName==='string'&&p.jobName.length>0&&p.jobName.length<=200&&p.audience==='urn:nyra:acceptance:'+privilege&&JSON.stringify(p.events)==='["workflow_dispatch"]','ACCEPTANCE_WORKFLOW');
 return Object.freeze(p);
}
export function acceptanceRegistrar({policy,privilege,getJSON,registrarQuery,readPolicyState,now}){
 return createJobRegistrar({policy:acceptedProbePolicy(policy,privilege),privilege,getJSON,query:registrarQuery,readPolicyState,requiredChecks:REQUIRED_CHECKS,now});
}
export function acceptanceBroker({policy,privilege,getJSON,brokerQuery,readPolicyState,keySource,now=Date.now}){
 const p=acceptedProbePolicy(policy,privilege),guard=policyGuard(p,readPolicyState),store=postgresIdentityStore({query:brokerQuery}),issued=new WeakSet();
 const verifier=createProtectedOIDCVerifier({policy:p,privilege,getJSON,store,readPolicyState,keySource,requiredChecks:REQUIRED_CHECKS,now}),active=registeredGithubJobFacts({policy:p,privilege,getJSON,store,readPolicyState,requiredChecks:REQUIRED_CHECKS,now});
 return Object.freeze({async authorize(token){const c=await verifier.verify(token),r=await store.load(c);verifier.assert(c);need(r&&!r.revokedAt&&Date.parse(r.expiresAt)>now(),'REGISTRATION_INACTIVE');const grant=Object.freeze({...c,registration:Object.freeze(r)});issued.add(grant);return grant;},async revalidate(grant){need(issued.has(grant)&&Date.parse(grant.expiresAt)>now(),'UNVERIFIED_MACHINE');await active(grant);guard();return grant;},inventoryAuthority(configurationSHA256){need(privilege==='publication','INVENTORY_CONSUMER');return immutableNormalInventoryAuthority({configurationSHA256,loadApprovedRecord:async(...args)=>{guard();const row=await postgresApprovedInventoryLoader({query:brokerQuery})(...args);guard();need(row?.record?.builder?.governance&&hashJSON(row.record.builder.governance)===hashJSON(p.governance),'INVENTORY_GOVERNANCE');return row;}});}});
}
