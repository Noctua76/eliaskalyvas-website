// Dependency composition only, no listener/credential/route/production import.
// Registrar and broker factories belong to separate OS processes/SQL sessions.
import {reviewedIntegrationPolicy} from './policy.mjs';
import {reviewedDeliveryPolicy,REQUIRED_CHECKS} from '../runtime/delivery-policy.mjs';
import {createProtectedOIDCVerifier,postgresIdentityStore,registeredGithubJobFacts} from '../runtime/protected-identity.mjs';
import {createJobRegistrar} from '../runtime/job-registrar.mjs';
import {policyGuard} from '../runtime/governance.mjs';
import {hashJSON} from '../contract.mjs';
import {requireDelivery as need} from '../runtime/materialize.mjs';
import {immutableNormalInventoryAuthority,postgresApprovedInventoryLoader} from './normal-provenance.mjs';
export function composeJobRegistrar({configuration,privilege,getJSON,registrarQuery,readPolicyState,now=Date.now}){
 const policy=configuration?.version==='nyra.protected.integration.v1'?reviewedIntegrationPolicy(configuration,privilege):reviewedDeliveryPolicy(configuration,privilege);
 return createJobRegistrar({policy,privilege,getJSON,query:registrarQuery,requiredChecks:REQUIRED_CHECKS,readPolicyState,now});
}
export function composeIdentityBroker({configuration,privilege,getJSON,brokerQuery,keySource,readPolicyState,now=Date.now}){
 const policy=(configuration?.version==='nyra.protected.integration.v1'?reviewedIntegrationPolicy(configuration,privilege):reviewedDeliveryPolicy(configuration,privilege)),guard=policyGuard(policy,readPolicyState),store=postgresIdentityStore({query:brokerQuery});
 const verifier=createProtectedOIDCVerifier({policy,privilege,getJSON,store,keySource,requiredChecks:REQUIRED_CHECKS,readPolicyState,now});
 const active=registeredGithubJobFacts({policy,privilege,getJSON,store,requiredChecks:REQUIRED_CHECKS,readPolicyState,now}),issued=new WeakSet();
 return Object.freeze({verifier,async authorize(token){
  const c=await verifier.verify(token),r=await store.load(c);verifier.assert(c);
  need(r&&!r.revokedAt&&Date.parse(r.expiresAt)>now(),'REGISTRATION_INACTIVE');
  const grant=Object.freeze({...c,registration:Object.freeze(r)});issued.add(grant);return grant;
 },async revalidate(grant){
  need(issued.has(grant)&&Date.parse(grant.expiresAt)>now(),'UNVERIFIED_MACHINE');
  await active(grant);return grant;
 },inventoryAuthority(configurationSHA256){
  need(privilege==='publication','INVENTORY_CONSUMER');
  return immutableNormalInventoryAuthority({configurationSHA256,loadApprovedRecord:async(...args)=>{guard();const row=await postgresApprovedInventoryLoader({query:brokerQuery})(...args);guard();need(row?.record?.builder?.governance&&hashJSON(row.record.builder.governance)===hashJSON(policy.governance),'INVENTORY_GOVERNANCE');return row;}});
 }});
}
// authorizeBuild is authenticated broker IPC, never HTTP request JSON. rebuild
// executes the exact reviewed checkout in an isolated no-credential process.
// Its production adapter is intentionally not provisioned or mounted here.
export function createProtectedInventoryRegistrar({authorizeBuild,revalidateBuild,registrarQuery,rebuild}){
 need(typeof rebuild==='function'&&typeof authorizeBuild==='function'&&typeof revalidateBuild==='function','ISOLATED_BUILDER_REQUIRED');
 return Object.freeze({async capture(token){
  const c=await authorizeBuild(token),r=c?.registration;
  need(c?.privilege==='build'&&r?.privilege==='build'&&r.codeSHA===c.codeSHA&&r.policySHA256===c.policySHA256&&c.governanceMode===r.governance?.mode&&c.policyVersion===r.governance?.policyVersion&&c.policySHA256&&typeof revalidateBuild==='function','INVENTORY_IDENTITY');
  const builder=Object.fromEntries(['privilege','codeSHA','workflowSHA','jobWorkflowSHA','runId','runAttempt','checkRunId','governance','policySHA256'].map(k=>[k,r[k]]));
  const result=await rebuild({codeSHA:r.codeSHA,builder});
  // No uploaded inventory is accepted. Preserve the independent build's bytes
  // and promote assurance only behind broker authorization + atomic SQL gate.
  need(result.record.builder.assurance==='unprotected_ci'&&hashJSON(result.record)===result.digest&&result.record.inventory.codeSHA===r.codeSHA&&Object.entries(builder).every(([k,v])=>hashJSON(result.record.builder[k])===hashJSON(v)),'INVENTORY_REBUILD');
  const record=structuredClone(result.record);record.builder.assurance='protected_oidc';const digest=hashJSON(record);
  await immutableNormalInventoryAuthority({configurationSHA256:record.inventory.configurationSHA256,loadApprovedRecord:async()=>({record,digest})}).forAttempt({codeSHA:r.codeSHA});
  await revalidateBuild(c);
  const rows=await registrarQuery(`with active as (select * from nyra_trust.jobs where run_id=$1 and run_attempt=$2 and check_run_id=$3 and revoked_at is null and expires_at>clock_timestamp() and policy_sha256=$4 and registration->>'privilege'='build' and registration->>'codeSHA'=$5 and $9::timestamptz>clock_timestamp() for share)
   insert into nyra_trust.inventories(code_sha,configuration_sha256,digest,record)
   select $5,$6,$7,$8::jsonb from active returning digest`,[r.runId,r.runAttempt,r.checkRunId,c.policySHA256,r.codeSHA,record.inventory.configurationSHA256,digest,JSON.stringify(record),c.expiresAt]);
  need(rows.rows.length===1,'INVENTORY_REGISTRATION_INACTIVE');return Object.freeze({digest,codeSHA:r.codeSHA,configurationSHA256:record.inventory.configurationSHA256});
 }});
}
