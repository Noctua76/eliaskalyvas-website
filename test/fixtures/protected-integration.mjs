// SYNTHETIC subjects only. These are not observed GitHub JWT claims.
import {IMMUTABLE_REPOSITORY_PREFIX,REQUIRED_CHECKS} from '../../lib/publication/runtime/delivery-policy.mjs';
import {apiFixture,now} from './protected-delivery.mjs';
import {GITHUB_ISSUER} from '../../lib/publication/runtime/oidc.mjs';
export {now};
export const configuration=()=>({version:'nyra.protected.configuration.v1',acceptance:{genuineProtectedOIDC:true,evidenceSHA:'e'.repeat(40)},brokerOrigin:'https://broker.invalid/',identities:Object.fromEntries(['build','inspection','publication'].map(privilege=>[privilege,{issuer:GITHUB_ISSUER,repository:'Noctua76/eliaskalyvas-website',repositoryId:'1389733212',ownerId:'217035723',ref:'refs/heads/main',environment:'nyra-'+privilege,subject:IMMUTABLE_REPOSITORY_PREFIX+':synthetic:'+privilege,audience:'urn:nyra:'+privilege,callerSHA:'a'.repeat(40),workflowRef:'Noctua76/eliaskalyvas-website/.github/workflows/nyra-protected-caller.yml@refs/heads/main',jobWorkflowRef:'Noctua76/eliaskalyvas-website/.github/workflows/nyra-'+privilege+'.yml@'+'b'.repeat(40),jobWorkflowSHA:'b'.repeat(40),jobName:privilege+' / trusted-'+privilege,events:['workflow_dispatch']}]))});
export function integrationAPI(privilege='build'){
 const c=configuration(),p=c.identities[privilege],data=apiFixture().data,root='https://api.github.com/repos/'+p.repository;
 const old='/environments/nyra-inspection',next='/environments/'+p.environment;
 const env=data[old],branches=data[old+'/deployment-branch-policies?per_page=100'];delete data[old];delete data[old+'/deployment-branch-policies?per_page=100'];
 data[next]={...env,name:p.environment};data[next+'/deployment-branch-policies?per_page=100']=branches;
 data['/branches/main/protection'].required_status_checks.checks=REQUIRED_CHECKS.map(context=>({context,app_id:15368}));
 Object.assign(data['/actions/runs/100'],{path:'.github/workflows/nyra-protected-caller.yml',repository:{id:1389733212,full_name:p.repository,owner:{id:217035723}},head_repository:{id:1389733212},referenced_workflows:[{path:p.jobWorkflowRef,sha:p.jobWorkflowSHA}]});
 Object.assign(data['/actions/runs/100/attempts/1/jobs?per_page=100'].jobs[0],{name:p.jobName,check_run_url:root+'/check-runs/300'});
 return {configuration:c,policy:p,data,getJSON:async url=>{if(!url.startsWith(root+'/'))throw Error('API_ORIGIN');const value=data[url.slice(root.length)];if(!value)throw Error('API_UNAVAILABLE');return structuredClone(value);}};
}
export const claims=p=>({aud:p.audience,sub:p.subject,repository:p.repository,repository_id:p.repositoryId,repository_owner_id:p.ownerId,ref:p.ref,environment:p.environment,workflow_ref:p.workflowRef,workflow_sha:p.callerSHA,job_workflow_ref:p.jobWorkflowRef,job_workflow_sha:p.jobWorkflowSHA});
