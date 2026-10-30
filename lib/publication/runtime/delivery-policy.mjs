// No production policy is shipped. Full subjects are reviewed observations, not
// suffixes constructed from an Environment name or a runner's JWT payload.
import {GITHUB_ISSUER,TrustError} from './oidc.mjs';
export const IMMUTABLE_REPOSITORY_PREFIX='repo:Noctua76@217035723/eliaskalyvas-website@1389733212';
export {REQUIRED_CHECKS} from './governance.mjs';
import {validateGovernance} from './governance.mjs';
const need=(ok,code)=>{if(!ok)throw new TrustError(code);};
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export function reviewedDeliveryPolicy(configuration,privilege){
 const c=structuredClone(configuration),p=c?.identities?.[privilege];
 need(['build','inspection','publication'].includes(privilege)&&c?.version==='nyra.protected.configuration.v1','DELIVERY_CONFIG');
 need(!Object.hasOwn(p||{},'governance'),'GOVERNANCE_SOURCE');
 validateGovernance(c.governance,p?.ownerId);
 need(/^[1-9][0-9]{0,19}$/.test(p?.environmentId),'ENV_ID_REQUIRED');
 need(c.acceptance?.genuineProtectedOIDC===true&&sha(c.acceptance.evidenceSHA),'REAL_OIDC_REQUIRED');
 need(p&&p.issuer===GITHUB_ISSUER&&p.repository==='Noctua76/eliaskalyvas-website'&&p.repositoryId==='1389733212'&&p.ownerId==='217035723'&&p.ref==='refs/heads/main','DELIVERY_REPOSITORY');
 need(p.environment==='nyra-'+privilege&&p.subject.startsWith(IMMUTABLE_REPOSITORY_PREFIX+':')&&p.subject.length>IMMUTABLE_REPOSITORY_PREFIX.length+1&&!/[\s*]/.test(p.subject),'IMMUTABLE_SUBJECT_REQUIRED');
 need(sha(p.callerSHA)&&sha(p.jobWorkflowSHA)&&p.workflowRef===p.repository+'/.github/workflows/nyra-protected-caller.yml@refs/heads/main'&&p.jobWorkflowRef===p.repository+'/.github/workflows/nyra-'+privilege+'.yml@'+p.jobWorkflowSHA,'DELIVERY_WORKFLOW_PIN');
 need(p.audience==='urn:nyra:'+privilege&&p.jobName===privilege+' / trusted-'+privilege&&JSON.stringify(p.events)==='["workflow_dispatch"]','DELIVERY_PRIVILEGE');
 p.governance=Object.freeze({...c.governance,reviewerIds:Object.freeze([...c.governance.reviewerIds])});
 return Object.freeze(p);
}
