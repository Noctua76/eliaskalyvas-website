// Independent read-only credential lives in this server process only. Never
// expose this factory/token provider to a workflow, artifact or public handler.
import {TrustError} from './oidc.mjs';
import {verifyLiveProtections} from './protected-identity.mjs';
import {REQUIRED_CHECKS,validateGovernance} from './governance.mjs';
import {hashJSON,parseContractJSON} from '../contract.mjs';
import {verifyEvidence} from './acceptance-evidence.mjs';
export const REPOSITORY='Noctua76/eliaskalyvas-website';
export const ENVIRONMENT_IDS=Object.freeze({'nyra-build':'25832629700','nyra-inspection':'25833532642','nyra-publication':'25833663698'});
const root='https://api.github.com/repos/'+REPOSITORY;
const need=(v,c)=>{if(!v)throw new TrustError(c);};
const routes=[/^$/, /^\/branches\/main(?:\/protection)?$/, /^\/collaborators\?affiliation=all&per_page=100$/, /^\/keys\?per_page=100$/, /^\/actions\/permissions\/workflow$/, /^\/environments\/nyra-(?:build|inspection|publication)(?:\/deployment-branch-policies|\/secrets)?(?:\?per_page=100)?$/, /^\/commits\/[a-f0-9]{40}\/(?:pulls\?per_page=100|check-runs\?filter=latest&per_page=100)$/, /^\/actions\/runs\?event=pull_request&head_sha=[a-f0-9]{40}&per_page=100$/, /^\/actions\/workflows\/pages-orchestrator\.yml\/runs\?branch=main&status=in_progress&per_page=100$/, /^\/actions\/workflows\/nyra-live-trust-acceptance\.yml\/runs\?event=workflow_dispatch&branch=main&per_page=100$/, /^\/actions\/runs\/[1-9][0-9]*(?:\/attempts\/[1-9][0-9]*\/jobs\?per_page=100)?$/, /^\/check-runs\/[1-9][0-9]*$/];
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
 if(inventory.integrationEvidence){
  const e=inventory.integrationEvidence;need(/^[a-f0-9]{64}$/.test(e.digest)&&Array.isArray(e.integrations),'APP_PERMISSION_UNKNOWN');
  // Include excluded and OAuth/PAT scope evidence in the owner-risk digest.
  apps.push({kind:'authenticated-integration-audit',inventorySHA256:e.digest,integrations:e.integrations,permissions:Object.fromEntries(['contents','workflows','pull_requests','administration','actions','checks','deployments','environments'].map(k=>[k,e.integrations.some(x=>x.repositoryIncluded&&x.permissions[k]==='write')?'write':'none']))});
 }
 return {apps,exclusiveTechnicalOwnerControl:apps.some(a=>Object.values(a.permissions).includes('write'))?false:'NOT VERIFIED',requiresExplicitOwnerRiskDecision:apps.some(a=>Object.values(a.permissions).includes('write'))};
}
export async function readRepositoryAdministration({getJSON,governance,now=Date.now}){
 const started=now(),facts=new Map(),read=getJSON;
 getJSON=async url=>{const v=await read(url);if(url===root||url.endsWith('/protection')||url.includes('/environments/')||url.includes('/collaborators?')||url.includes('/keys?')||url.endsWith('/actions/permissions/workflow')){let safe=v;if(url===root)safe={id:v.id,full_name:v.full_name,owner:{id:v.owner?.id,type:v.owner?.type},default_branch:v.default_branch,permissions:v.permissions,visibility:v.visibility};else if(url.includes('/collaborators?'))safe=Array.isArray(v)?v.map(x=>({id:x.id,type:x.type,permissions:x.permissions,role_name:x.role_name})).sort((a,b)=>a.id-b.id):v;else if(url.includes('/secrets?'))safe={total_count:v.total_count,secrets:[]};else if(/\/environments\/nyra-[a-z]+$/.test(url))safe={id:v.id,name:v.name,protection_rules:v.protection_rules,can_admins_bypass:v.can_admins_bypass,deployment_branch_policy:v.deployment_branch_policy};safe=JSON.parse(JSON.stringify(safe));need(!facts.has(url)||hashJSON(facts.get(url))===hashJSON(safe),'ADMIN_SNAPSHOT_CHANGED');facts.set(url,safe);}return v;};
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
 const record={schema:'nyra.repository.administration.v1',repository:REPOSITORY,mainSHA:environments[0].mainSHA,environments,authorization:false,observedAt:new Date(started).toISOString(),protectionsSHA256:hashJSON([...facts].sort(([a],[b])=>a.localeCompare(b,'en')))};
 need(now()-started>=0&&now()-started<60000,'ADMIN_READ_STALE');
 return {record,digest:hashJSON(record)};
}
export async function readAdministrationEvidence({getJSON,governance,readApplicationInventory,now=Date.now}){
 const base=await readRepositoryAdministration({getJSON,governance,now});
 need(typeof readApplicationInventory==='function','APP_INVENTORY_SOURCE_REQUIRED');
 const applications=assessApplications(await readApplicationInventory(),{now:now()});
 const {protectionsSHA256,...r}=base.record;const record={...r,schema:'nyra.administration.observation.v1',applications};return {record,digest:hashJSON(record)};
}
// Only the independently provisioned owner/MFA control plane may sign these
// live decision receipts. Its public key is pinned in trusted host configuration,
// never supplied by a job/caller. No authorization endpoint or new owner gate is
// installed here. A missing source/key keeps real authorization NOT VERIFIED.
export function administrationGate({readEvidence,acceptedApplicationsSHA256,ownerRiskDecisionId,readOwnerRiskDecision,ownerDecisionPublicKey,ownerDecisionKeyId,now=Date.now}){
 need(typeof readEvidence==='function'&&/^[a-f0-9]{64}$/.test(acceptedApplicationsSHA256),'ADMIN_GATE_CONFIG');
 need(typeof readOwnerRiskDecision==='function'&&typeof ownerRiskDecisionId==='string'&&ownerRiskDecisionId.length>0&&ownerDecisionPublicKey?.type==='public'&&ownerDecisionPublicKey.algorithm?.name==='Ed25519'&&typeof ownerDecisionKeyId==='string'&&ownerDecisionKeyId.length>0,'OWNER_RISK_SOURCE_REQUIRED');
 return async policy=>{
  validateGovernance(policy.governance,policy.ownerId);
  need(policy.repositoryTrust===undefined&&policy.repository===REPOSITORY&&policy.repositoryId==='1389733212'&&policy.ownerId==='217035723'&&policy.governance.mode==='SINGLE_OWNER','OWNER_RISK_POLICY');
  const row=await readEvidence(),r=row?.record;
  need(r?.schema==='nyra.administration.observation.v1'&&hashJSON(r)===row.digest&&r.mainSHA===policy.callerSHA&&now()-Date.parse(r.observedAt)>=0&&now()-Date.parse(r.observedAt)<60000&&hashJSON(r.applications?.apps)===acceptedApplicationsSHA256,'ADMIN_GATE_CHANGED');
  need(r.environments.length===3&&r.environments.every(e=>ENVIRONMENT_IDS[e.environment]===e.environmentId&&e.mainSHA===policy.callerSHA&&e.governanceMode===policy.governance.mode&&e.policyVersion===policy.governance.policyVersion),'ADMIN_GATE_CHANGED');
  const challenge=crypto.randomUUID();let d;
  try{
   const envelope=await readOwnerRiskDecision({decisionId:ownerRiskDecisionId,challenge});
   d=await verifyEvidence(envelope,{publicKey:ownerDecisionPublicKey,keyId:ownerDecisionKeyId});
  }catch{throw new TrustError('OWNER_RISK_SOURCE_UNVERIFIED');}
  // Signature authenticates the trusted source's attestation of the established
  // owner/MFA contract, not a caller's approval declaration. Re-read each time:
  // retired/superseded decisions and replayed receipts cannot authorize access.
  need(d?.schema==='nyra.owner-risk-decision.receipt.v1'&&d.challenge===challenge&&d.decisionId===ownerRiskDecisionId&&d.state==='active'&&d.supersededBy===null&&d.repository===REPOSITORY&&d.repositoryId===policy.repositoryId&&d.ownerId===policy.ownerId&&d.governanceMode===policy.governance.mode&&d.policyVersion===policy.governance.policyVersion&&d.applicationsSHA256===acceptedApplicationsSHA256,'OWNER_RISK_DECISION');
  need(d.riskAcknowledgment?.write===true&&d.riskAcknowledgment?.merge===true&&d.riskAcknowledgment?.workflow===true&&d.ownerAuthorization?.contract==='existing-owner-mfa'&&d.ownerAuthorization?.verified===true&&d.ownerAuthorization?.ownerId===policy.ownerId&&typeof d.ownerAuthorization?.evidenceId==='string'&&d.ownerAuthorization.evidenceId.length>0,'OWNER_RISK_AUTHORIZATION');
  const issued=Date.parse(d.issuedAt),expires=Date.parse(d.expiresAt),t=now();
  need(Number.isFinite(issued)&&Number.isFinite(expires)&&issued<=t&&t<expires&&expires-issued>0&&expires-issued<=60000,'OWNER_RISK_FRESHNESS');
  return r;
 };
}
