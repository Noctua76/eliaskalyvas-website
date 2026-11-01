// Real role bindings; never import test fixtures or generate an identity/key.
import {createJobRegistrar} from '../../lib/publication/runtime/job-registrar.mjs';
import {postgresIdentityStore,registeredGithubJobFacts} from '../../lib/publication/runtime/protected-identity.mjs';
import {registeredObservation} from '../../lib/publication/runtime/acceptance-collector.mjs';
import {acceptanceBroker} from '../../lib/publication/integration/live-acceptance.mjs';
import {confirmRepositoryRetirement,createProtectedInventoryRegistrar} from '../../lib/publication/integration/protected-composition.mjs';
import {observeGithubOIDC} from '../../lib/publication/runtime/oidc-observation.mjs';
import {REQUIRED_CHECKS,policyGuard} from '../../lib/publication/runtime/governance.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
import {verifyEvidence} from '../../lib/publication/runtime/acceptance-evidence.mjs';
const roles=['build','inspection','publication'];
export function liveRoleService({role,mode,policies,query,getJSON,readPolicyState,assertAdministration,keySource,signEvidence,evidencePublicKey,evidenceKeyId,privateQuery,now=Date.now}){
 if(!['registrar','broker'].includes(role)||!['discovery','provenance'].includes(mode)||!roles.every(r=>policies[r]?.role===r))throw Error('ROLE_BINDING');
 const grants=new Map(),store=postgresIdentityStore({query});
 const registrars=role==='registrar'?Object.fromEntries(roles.map(privilege=>[privilege,createJobRegistrar({policy:policies[privilege],privilege,getJSON,query,requiredChecks:REQUIRED_CHECKS,readPolicyState:()=>readPolicyState(privilege),now})])):{};
 const observers=role==='broker'&&mode==='discovery'?Object.fromEntries(roles.map(privilege=>[privilege,registeredObservation({policy:policies[privilege],privilege,getJSON,store,readPolicyState:()=>readPolicyState(privilege),assertAdministration,keySource,signEvidence,now})])):{};
 const brokers=role==='broker'&&mode==='provenance'?Object.fromEntries(roles.map(privilege=>[privilege,acceptanceBroker({policy:policies[privilege],privilege,getJSON,brokerQuery:query,readPolicyState:()=>readPolicyState(privilege),assertAdministration,keySource,now})])):{};
 return async(op,a)=>{
  if(op==='identity'){for(const privilege of roles)policyGuard(policies[privilege],()=>readPolicyState(privilege))();const row=(await query('select current_user as identity')).rows[0];if(row?.identity!=='nyra_accept_'+role)throw Error('ROLE_IDENTITY');return {role,identity:row.identity};}
  // Non-authorizing cleanup remains available after owner/session expiry.
  if(role==='registrar'&&op==='retire'){for(const r of Object.values(registrars))await r.retirePolicy();return {retired:true};}
  if(role==='broker'&&op==='retirement'){if(policies.build.repositoryTrust){grants.clear();return confirmRepositoryRetirement({policies,brokerQuery:query,signEvidence,challenge:a.challenge,repositoryTrustSHA256:a.repositoryTrustSHA256,now});}const hashes=roles.map(r=>hashJSON(policies[r]));const row=(await query('select count(*)::int as count from nyra_trust.jobs where policy_sha256=any($1::text[]) and revoked_at is null',[hashes])).rows[0];if(row?.count!==0)throw Error('RETIREMENT_INCOMPLETE');grants.clear();return signEvidence({schema:'nyra.acceptance.retirement.v1',activeRegistrations:0,policiesSHA256:hashJSON(policies),observedAt:new Date(now()).toISOString()});}
  if(role==='registrar'&&['register','revoke'].includes(op)){if(!roles.includes(a.privilege))throw Error('ROLE_SCOPE');await assertAdministration(policies[a.privilege]);return registrars[a.privilege][op](a.selector);}
  if(role==='registrar'&&op==='capture'&&mode==='provenance')return createProtectedInventoryRegistrar({registrarQuery:query,authorizeBuild:async()=>a.grant,rebuild:b=>privateQuery('rebuild',b),revalidateBuild:async grant=>{
   const receipt=await privateQuery('revalidate',{handle:a.handle}),p=await verifyEvidence(receipt,{publicKey:evidencePublicKey,keyId:evidenceKeyId});
   if(p.schema!=='nyra.ipc.revalidation.v1'||p.handle!==a.handle||p.grantDigest!==hashJSON(grant)||p.policySHA256!==grant.policySHA256||p.expiresAt<=now()||p.expiresAt>now()+5000)throw Error('BROKER_REVALIDATION');
  }}).capture(a.handle);
  if(role==='broker'&&op==='accept'){
   if(!roles.includes(a.privilege))throw Error('ROLE_SCOPE');if(mode==='discovery')return {signed:await observers[a.privilege](a.token)};
   const b=brokers[a.privilege],grant=await b.authorize(a.token),handle=crypto.randomUUID();grants.set(handle,{grant,privilege:a.privilege});
   // Re-verify the exact token for sanitized observation only. Its JTI was
   // consumed by the approved broker above; this never consumes/authorizes twice.
   const p={...policies[a.privilege],purpose:'identity-observation-only',codeSHA:policies[a.privilege].callerSHA};
   const facts=registeredGithubJobFacts({policy:policies[a.privilege],privilege:a.privilege,getJSON,store,readPolicyState:()=>readPolicyState(a.privilege),requiredChecks:REQUIRED_CHECKS,now});
   const signed=await observeGithubOIDC(a.token,{expected:p,jobFacts:facts,keySource,signEvidence,now,consumeObservation:async c=>{await b.revalidate(grant);return c.jti===grant.jti&&c.runId===grant.runId&&c.checkRunId===grant.checkRunId;}});
   return {signed,handle,grant};
  }
  if(role==='broker'&&op==='revalidate'){const v=grants.get(a.handle);if(!v)throw Error('UNKNOWN_GRANT');await brokers[v.privilege].revalidate(v.grant);return signEvidence({schema:'nyra.ipc.revalidation.v1',handle:a.handle,grantDigest:hashJSON(v.grant),policySHA256:v.grant.policySHA256,expiresAt:Math.min(now()+5000,Date.parse(v.grant.expiresAt))});}
  if(role==='broker'&&op==='consume'&&mode==='provenance'){const v=grants.get(a.handle);if(v?.privilege!=='publication')throw Error('PUBLICATION_CONSUMER');await brokers.publication.revalidate(v.grant);const scope=await brokers.publication.inventoryAuthority(a.configurationSHA256).forAttempt({codeSHA:v.grant.codeSHA});const inventory=(await query('select digest from nyra_trust.inventories where code_sha=$1 and configuration_sha256=$2',[scope.codeSHA,a.configurationSHA256])).rows[0];if(!inventory?.digest)throw Error('INVENTORY_MISSING');return signEvidence({schema:'nyra.provenance.acceptance.v1',inventoryDigest:inventory.digest,codeSHA:scope.codeSHA,configurationSHA256:a.configurationSHA256,runId:v.grant.runId,runAttempt:v.grant.runAttempt,checkRunId:v.grant.checkRunId,policySHA256:v.grant.policySHA256,publicationPerformed:false});}
  throw Error('ROLE_OPERATION_DENIED');
 };
}
