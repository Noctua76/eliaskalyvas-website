// Explicit operator-only READ-ONLY preflight. No workflow import, listener,
// credential persistence, signature, acceptance assertion, or dispatch.
// The existing administrationReader restricts URLs, HTTP methods and pagination.
import {pathToFileURL} from 'node:url';
import {administrationReader,REPOSITORY,ENVIRONMENT_IDS} from '../../lib/publication/runtime/administration-evidence.mjs';

const ROOT='https://api.github.com/repos/'+REPOSITORY;
const environmentNames=Object.keys(ENVIRONMENT_IDS);
export const checks=Object.freeze([
 ['repository',''],
 ['main_protection','/branches/main/protection'],
 ['collaborators','/collaborators?affiliation=all&per_page=100'],
 ['deploy_keys','/keys?per_page=100'],
 ['actions_defaults','/actions/permissions/workflow'],
 ...environmentNames.flatMap(e=>[
  [e,'/environments/'+e],
  [e+'_branch_policies','/environments/'+e+'/deployment-branch-policies?per_page=100'],
  [e+'_secret_metadata','/environments/'+e+'/secrets?per_page=100']
 ])
]);

function project(name,body){
 if(name==='repository')return {repositoryId:String(body.id),ownerId:String(body.owner?.id),defaultBranch:body.default_branch};
 if(name==='main_protection')return {requiredChecks:(body.required_status_checks?.checks||[]).map(x=>({context:x.context,appId:x.app_id})),enforceAdmins:body.enforce_admins?.enabled??null,restrictions:body.restrictions===null?'none':'present_or_unknown'};
 if(name==='collaborators')return {count:Array.isArray(body)?body.length:null,administratorCount:Array.isArray(body)?body.filter(x=>x.permissions?.admin===true).length:null};
 if(name==='deploy_keys')return {count:Array.isArray(body)?body.length:null,writableCount:Array.isArray(body)?body.filter(x=>x.read_only===false).length:null};
 if(name==='actions_defaults')return {defaultWorkflowPermissions:body.default_workflow_permissions,canApprovePullRequestReviews:body.can_approve_pull_request_reviews};
 if(Object.hasOwn(ENVIRONMENT_IDS,name))return {id:String(body.id),name:body.name,expectedId:ENVIRONMENT_IDS[name],idMatches:String(body.id)===ENVIRONMENT_IDS[name],protectionRuleCount:Array.isArray(body.protection_rules)?body.protection_rules.length:null,branchPolicy:body.deployment_branch_policy||null};
 if(name.endsWith('_branch_policies'))return {count:body.total_count??null,returned:Array.isArray(body.branch_policies)?body.branch_policies.length:null};
 if(name.endsWith('_secret_metadata'))return {count:body.total_count??null,returned:Array.isArray(body.secrets)?body.secrets.length:null};
 throw Error('UNEXPECTED_SECTION');
}
export async function adminPreflight({getJSON,now=Date.now}){
 if(typeof getJSON!=='function')throw Error('READ_ONLY_SOURCE_REQUIRED');
 const sections=[];
 for(const [name,path] of checks){
  try{
   const fact=project(name,await getJSON(ROOT+path));
   const valid=name==='repository'?fact.repositoryId==='1389733212'&&fact.ownerId==='217035723'&&fact.defaultBranch==='main'
    :Object.hasOwn(ENVIRONMENT_IDS,name)?fact.idMatches===true
    :!Object.values(fact).includes(null)&&!Object.values(fact).includes(undefined);
   sections.push({name,read:valid?'ok':'incomplete',facts:fact});
  }catch{
   // Never print exception text: it may include GitHub response metadata.
   sections.push({name,read:'unavailable'});
  }
 }
 return {schema:'nyra.admin.preflight.v1',repository:REPOSITORY,observedAt:new Date(now()).toISOString(),
  sections,allReadable:sections.every(x=>x.read==='ok'),authenticatedApplicationInventory:false,
  independentlySigned:false,ownerMFAVerified:false,liveAcceptance:false,publicationAuthorized:false};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{
  const token=process.env.NYRA_ADMIN_READ_TOKEN;
  if(!token)throw Error('MISSING_PRIVATE_TOKEN');
  const getJSON=administrationReader({tokenSource:async()=>token});
  const result=await adminPreflight({getJSON});
  console.log(JSON.stringify(result,null,2));
  if(!result.allReadable)process.exitCode=1;
 }catch{console.error('NYRA_ADMIN_PREFLIGHT_NOT_VERIFIED');process.exitCode=1;}
}
