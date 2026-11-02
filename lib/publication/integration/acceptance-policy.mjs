// Policy validation only; no Node process/SQL/rebuild dependencies in Edge packages.
import {GITHUB_ISSUER,TrustError} from '../runtime/oidc.mjs';
import {REPOSITORY,ENVIRONMENT_IDS} from '../runtime/administration-evidence.mjs';
import {IMMUTABLE_REPOSITORY_PREFIX} from '../runtime/delivery-policy.mjs';
import {bindRepositoryTrust} from '../runtime/repository-policy.mjs';
import {validateGovernance} from '../runtime/governance.mjs';
const DISCOVERY_SUBJECT='urn:nyra:unapproved-subject-discovery';
const need=(v,c)=>{if(!v)throw new TrustError(c);};
export function acceptedProbePolicy(policy,privilege,{discovery=false}={}){
 const p=structuredClone(policy);need(['build','inspection','publication'].includes(privilege)&&p.purpose===(discovery?'identity-observation-only':'registered-provenance-acceptance'),'ACCEPTANCE_POLICY');
 need(p.issuer===GITHUB_ISSUER&&p.repository===REPOSITORY&&p.repositoryId==='1389733212'&&p.ownerId==='217035723'&&p.ref==='refs/heads/main'&&p.environment==='nyra-'+privilege&&p.environmentId===ENVIRONMENT_IDS[p.environment],'ACCEPTANCE_IDENTITY');
 need(discovery?p.subject===DISCOVERY_SUBJECT:typeof p.subject==='string'&&p.subject!==DISCOVERY_SUBJECT&&p.subject.startsWith(IMMUTABLE_REPOSITORY_PREFIX+':')&&!/[\s*]/.test(p.subject),'EXACT_OBSERVED_SUBJECT_REQUIRED');
 need(p.workflowRef===REPOSITORY+'/.github/workflows/nyra-live-trust-acceptance.yml@refs/heads/main'&&/^[a-f0-9]{40}$/.test(p.callerSHA)&&/^[a-f0-9]{40}$/.test(p.jobWorkflowSHA)&&p.jobWorkflowRef===REPOSITORY+'/.github/workflows/nyra-live-trust-probe.yml@'+p.jobWorkflowSHA&&typeof p.jobName==='string'&&p.jobName.length>0&&p.jobName.length<=200&&p.audience==='urn:nyra:acceptance:'+privilege&&JSON.stringify(p.events)==='["workflow_dispatch"]','ACCEPTANCE_WORKFLOW');
 return Object.freeze(p);
}
// Trusted host configuration only; NEVER an operational/publication policy.
// Discovery has a reserved non-authorizing subject; provenance must additionally
// verify independently reviewed signed discovery receipts before arming ingress.
export function reviewedAcceptancePolicies(configuration){
 const c=structuredClone(configuration),roles=['build','inspection','publication'];
 need(c.version==='nyra.repository.acceptance.v1'&&['discovery','provenance'].includes(c.acceptanceMode)&&c.acceptance===undefined,'ACCEPTANCE_CONFIGURATION');
 validateGovernance(c.governance,'217035723');need(c.governance.mode==='SINGLE_OWNER','ACCEPTANCE_GOVERNANCE');
 const context=bindRepositoryTrust(c.repositoryTrust,c);
 return Object.fromEntries(roles.map(role=>{
  const p=c.identities?.[role];need(p&&!Object.hasOwn(p,'governance')&&!Object.hasOwn(p,'repositoryTrust')&&p.role===role,'ACCEPTANCE_CONFIGURATION');
  need(p.jobWorkflowSHA==='cefd1a402dcffd0b00f05f7d7539ba381120641e'&&p.jobName==='acceptance / identity-'+role,'ACCEPTANCE_REUSABLE_PIN');
  acceptedProbePolicy(p,role,{discovery:c.acceptanceMode==='discovery'});
  need(c.acceptanceMode==='discovery'?p.purpose==='identity-observation-only'&&p.subject===DISCOVERY_SUBJECT&&p.codeSHA===p.callerSHA:p.purpose==='registered-provenance-acceptance','ACCEPTANCE_PURPOSE');
  return [role,Object.freeze({...p,governance:c.governance,repositoryTrust:context})];
 }));
}
