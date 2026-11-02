// Explicit NEW integration policy version. Does not relax/translate v1 policies.
// Accepted configuration is a reviewed control-plane file, never workflow input.
import {GITHUB_ISSUER,TrustError} from '../runtime/oidc.mjs';
import {IMMUTABLE_REPOSITORY_PREFIX} from '../runtime/delivery-policy.mjs';
import {bindRepositoryTrust} from '../runtime/repository-policy.mjs';
import {validateGovernance} from '../runtime/governance.mjs';
const need=(v,c)=>{if(!v)throw new TrustError(c);};
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
export function reviewedIntegrationPolicy(configuration,privilege){
 const c=structuredClone(configuration),p=c?.identities?.[privilege];
 need(c?.version==='nyra.protected.integration.v1'&&['build','inspection','publication'].includes(privilege)&&p,'INTEGRATION_POLICY');
 need(!Object.hasOwn(p,'governance')&&!Object.hasOwn(p,'repositoryTrust'),'GOVERNANCE_SOURCE');validateGovernance(c.governance,p.ownerId);
 // Each trigger context must have independent genuine acceptance. No flags or
 // guessed policy record is installed by this implementation or its tests.
 need(c.acceptance?.genuineProtectedOIDC===true&&sha(c.acceptance.evidenceSHA)&&JSON.stringify(c.acceptance.acceptedEvents)==='["push","workflow_dispatch"]','INTEGRATION_REAL_ACCEPTANCE_REQUIRED');
 need(p.issuer===GITHUB_ISSUER&&p.repository==='Noctua76/eliaskalyvas-website'&&p.repositoryId==='1389733212'&&p.ownerId==='217035723'&&p.ref==='refs/heads/main','INTEGRATION_REPOSITORY');
 need(p.environment==='nyra-'+privilege&&/^[1-9][0-9]*$/.test(p.environmentId)&&typeof p.subject==='string'&&p.subject.startsWith(IMMUTABLE_REPOSITORY_PREFIX+':')&&p.subject.length>IMMUTABLE_REPOSITORY_PREFIX.length+1&&!/[\s*]/.test(p.subject),'INTEGRATION_SUBJECT');
 const name=privilege==='publication'?'pages-delivery':'nyra-'+privilege,job={build:'build-inventory / trusted-build',inspection:'inspection / trusted-inspection',publication:'delivery / protected'}[privilege];
 need(sha(p.callerSHA)&&sha(p.jobWorkflowSHA)&&p.workflowRef===p.repository+'/.github/workflows/pages-orchestrator.yml@refs/heads/main'&&p.jobWorkflowRef===p.repository+'/.github/workflows/'+name+'.yml@'+p.jobWorkflowSHA&&p.jobName===job,'INTEGRATION_WORKFLOW_PIN');
 need(p.audience==='urn:nyra:'+privilege&&JSON.stringify(p.events)==='["push","workflow_dispatch"]','INTEGRATION_PRIVILEGE');
 if(c.repositoryTrust!==undefined)p.repositoryTrust=bindRepositoryTrust(c.repositoryTrust,c);
 p.governance=Object.freeze({...c.governance,reviewerIds:Object.freeze([...c.governance.reviewerIds])});return Object.freeze(p);
}
