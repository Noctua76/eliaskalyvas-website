// Independent read-only credential lives in this server process only. Never
// expose this factory/token provider to a workflow, artifact or public handler.
import {TrustError} from './oidc.mjs';
import {verifyLiveProtections} from './protected-identity.mjs';
import {REQUIRED_CHECKS,validateGovernance} from './governance.mjs';
import {hashJSON,parseContractJSON} from '../contract.mjs';
export const REPOSITORY='Noctua76/eliaskalyvas-website';
export const ENVIRONMENT_IDS=Object.freeze({'nyra-build':'25832629700','nyra-inspection':'25833532642','nyra-publication':'25833663698'});
const root='https://api.github.com/repos/'+REPOSITORY;
const need=(v,c)=>{if(!v)throw new TrustError(c);};
const routes=[/^$/, /^\/branches\/main(?:\/protection)?$/, /^\/collaborators\?affiliation=all&per_page=100$/, /^\/keys\?per_page=100$/, /^\/actions\/permissions\/workflow$/, /^\/environments\/nyra-(?:build|inspection|publication)(?:\/deployment-branch-policies|\/secrets)?(?:\?per_page=100)?$/, /^\/commits\/[a-f0-9]{40}\/(?:pulls\?per_page=100|check-runs\?filter=latest&per_page=100)$/, /^\/actions\/runs\?event=pull_request&head_sha=[a-f0-9]{40}&per_page=100$/, /^\/actions\/runs\/[1-9][0-9]*(?:\/attempts\/[1-9][0-9]*\/jobs\?per_page=100)?$/, /^\/check-runs\/[1-9][0-9]*$/];
export function administrationReader({tokenSource,fetcher=fetch}){
 need(typeof tokenSource==='function','ADMIN_CREDENTIAL_REQUIRED');
 return async url=>{
  need(typeof url==='string'&&url.startsWith(root)&&routes.some(r=>r.test(url.slice(root.length))),'ADMIN_READ_SCOPE');
  try{
   const token=await tokenSource();need(typeof token==='string'&&token.length>0,'ADMIN_CREDENTIAL_REQUIRED');
   const response=await fetcher(url,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(10000)});
   need(response.ok,'ADMIN_READ_DENIED');need(!response.headers.get('link')?.includes('rel="next"'),'ADMIN_READ_INCOMPLETE');
   const text=await response.text();need(text.length<=2000000,'ADMIN_READ_SIZE');return parseContractJSON(text);
  }catch(e){if(e instanceof TrustError)throw e;throw new TrustError('ADMIN_READ_UNAVAILABLE');}
 };
}
// Installations of a *single* GitHub App (/user/installations) are not a complete
// personal-account App inventory. A separately authenticated owner inventory
// source must attest completeness + repository coverage; no screenshot fallback.
export function assessApplications(inventory,{now=Date.now(),maxAge=300000}={}){
 need(inventory?.complete===true&&inventory.repository===REPOSITORY&&inventory.repositoryId==='1389733212'&&inventory.ownerId==='217035723'&&Number.isFinite(Date.parse(inventory.observedAt))&&Date.parse(inventory.observedAt)<=now&&now-Date.parse(inventory.observedAt)<maxAge,'APP_INVENTORY_INCOMPLETE');
 need(Array.isArray(inventory.installations)&&new Set(inventory.installations.map(x=>x.installationId)).size===inventory.installations.length,'APP_INVENTORY_INCOMPLETE');
 const apps=inventory.installations.map(a=>{
  need(/^[1-9][0-9]*$/.test(a.appId)&&/^[1-9][0-9]*$/.test(a.installationId)&&a.repositoryIds?.includes('1389733212')&&a.permissions&&['contents','workflows','pull_requests','administration','actions','checks','deployments','environments'].every(k=>Object.hasOwn(a.permissions,k))&&Object.values(a.permissions).every(v=>['read','write','none'].includes(v)),'APP_PERMISSION_UNKNOWN');
  // These are capability/risk assessments, not a claim that a merge was tested.
  return {appId:a.appId,installationId:a.installationId,permissions:a.permissions,canPotentiallyMerge:a.permissions.contents==='write',canPotentiallyAlterWorkflows:a.permissions.contents==='write'&&a.permissions.workflows==='write'};
 });
 return {apps,exclusiveTechnicalOwnerControl:apps.some(a=>Object.values(a.permissions).includes('write'))?false:'NOT VERIFIED',requiresExplicitOwnerRiskDecision:apps.some(a=>Object.values(a.permissions).includes('write'))};
}
export async function readAdministrationEvidence({getJSON,governance,readApplicationInventory,now=Date.now}){
 validateGovernance(governance,'217035723');need(governance.mode==='SINGLE_OWNER','ACCEPTANCE_GOVERNANCE');
 const environments=[];
 for(const [environment,environmentId] of Object.entries(ENVIRONMENT_IDS)){
  const policy={repository:REPOSITORY,repositoryId:'1389733212',ownerId:'217035723',environment,environmentId,governance};
  const live=await verifyLiveProtections({getJSON,repository:REPOSITORY,environment,requiredChecks:REQUIRED_CHECKS,policy});environments.push({environment,environmentId,...live});
 }
 need(new Set(environments.map(e=>e.mainSHA)).size===1,'ADMIN_SNAPSHOT_CHANGED');
 const keys=await getJSON(root+'/keys?per_page=100'),actions=await getJSON(root+'/actions/permissions/workflow');
 need(Array.isArray(keys)&&keys.length===0,'DEPLOY_KEY_WRITE_RISK');
 need(actions.default_workflow_permissions==='read'&&actions.can_approve_pull_request_reviews===false,'ACTIONS_PERMISSION_RISK');
 need(typeof readApplicationInventory==='function','APP_INVENTORY_SOURCE_REQUIRED');
 const applications=assessApplications(await readApplicationInventory(),{now:now()});
 const record={schema:'nyra.administration.observation.v1',observedAt:new Date(now()).toISOString(),repository:REPOSITORY,mainSHA:environments[0].mainSHA,environments,applications,authorization:false};
 return {record,digest:hashJSON(record)};
}
