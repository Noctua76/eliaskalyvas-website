import {hashJSON} from '../../lib/publication/contract.mjs';
import {REQUIRED_CHECKS} from '../../lib/publication/runtime/governance.mjs';
import {policy as original,CLOCK} from './phase4b.mjs';
export const governance=(ownerId='456',mode='OWNER_WITH_REVIEWERS')=>({schema:'nyra.governance.v1',mode,policyVersion:1,ownerId,ownerAuthorizationSHA:'f'.repeat(40),reviewerIds:mode==='SINGLE_OWNER'?[]:['77']});
export const readState=p=>()=>({policySHA256:hashJSON(p),policyVersion:p.governance.policyVersion,mode:p.governance.mode,ownerAuthorizationSHA:p.governance.ownerAuthorizationSHA});
export const policy={...original,governance:governance(),environmentId:'700',ref:'refs/heads/main',workflowRef:'test/repo/.github/workflows/trusted.yml@refs/heads/main',jobWorkflowRef:'test/repo/.github/workflows/worker.yml@'+'b'.repeat(40),environment:'nyra-inspection',subject:'repo:test/repo:environment:nyra-inspection',audience:'urn:nyra:inspection',jobName:'inspection / trusted'};
export const now=()=>Date.parse(CLOCK);
export const registration=()=>({governance:structuredClone(policy.governance),policySHA256:hashJSON(policy),privilege:'inspection',runId:'100',runAttempt:'1',checkRunId:'300',jobId:'400',workflowId:'500',checkSuiteId:'600',codeSHA:'a'.repeat(40),workflowSHA:'c'.repeat(40),workflowPath:'.github/workflows/trusted.yml',event:'workflow_dispatch',expiresAt:new Date(now()+300000).toISOString(),...Object.fromEntries(['repository','repositoryId','ownerId','ref','environment','workflowRef','jobWorkflowRef','jobWorkflowSHA','jobName'].map(k=>[k,policy[k]]))});
export function apiFixture(){const r=registration(),root='https://api.github.com/repos/test/repo';
 const data={
  '/branches/main':{name:'main',protected:true,commit:{sha:r.codeSHA}},
  '/branches/main/protection':{enforce_admins:{enabled:true},allow_force_pushes:{enabled:false},allow_deletions:{enabled:false},required_conversation_resolution:{enabled:true},required_pull_request_reviews:{required_approving_review_count:1,dismiss_stale_reviews:true,require_last_push_approval:true,require_code_owner_reviews:false,bypass_pull_request_allowances:{users:[],teams:[],apps:[]}},required_status_checks:{strict:true,checks:REQUIRED_CHECKS.map(context=>({context,app_id:15368}))}},
  '/environments/nyra-inspection':{id:700,name:'nyra-inspection',can_admins_bypass:false,protection_rules:[{type:'required_reviewers',prevent_self_review:true,reviewers:[{type:'User',reviewer:{id:77}}]}],deployment_branch_policy:{protected_branches:false,custom_branch_policies:true}},
  '/environments/nyra-inspection/deployment-branch-policies?per_page=100':{total_count:1,branch_policies:[{name:'main',type:'branch'}]},
  '/actions/runs/100':{id:100,run_attempt:1,head_sha:r.codeSHA,head_branch:'main',path:r.workflowPath,workflow_id:500,event:'workflow_dispatch',status:'in_progress',check_suite_id:600,repository:{id:123,full_name:'test/repo',owner:{id:456}},head_repository:{id:123}},
  '/actions/runs/100/attempts/1/jobs?per_page=100':{total_count:1,jobs:[{id:400,check_run_url:root+'/check-runs/300',name:r.jobName,status:'in_progress',run_id:100,run_attempt:1,head_sha:r.codeSHA}]},
  '/check-runs/300':{id:300,status:'in_progress',head_sha:r.codeSHA,check_suite:{id:600},app:{id:15368}}
 };
 addGovernanceEvidence(data,policy);
 return {data,getJSON:async url=>{const value=data[url.slice(root.length)];if(!value)throw Error('API_UNAVAILABLE');return structuredClone(value);}};
}

export function addGovernanceEvidence(data,p){
 const root='https://api.github.com/repos/'+p.repository,head='d'.repeat(40),code=data['/branches/main'].commit.sha;
 data['']={id:Number(p.repositoryId),full_name:p.repository,owner:{id:Number(p.ownerId),type:'User'}};
 data['/collaborators?affiliation=all&per_page=100']=p.governance.reviewerIds.map(id=>({id:Number(id),type:'User',permissions:{admin:false,maintain:false,push:true,pull:true}}));
 data['/environments/'+p.environment+'/secrets?per_page=100']={total_count:0,secrets:[]};
 data['/commits/'+code+'/pulls?per_page=100']=[{number:17,merged_at:'2026-10-27T00:00:00Z',merge_commit_sha:code,base:{ref:'main',repo:{id:Number(p.repositoryId),full_name:p.repository}},head:{sha:head,repo:{id:Number(p.repositoryId)}}}];
 const checks=REQUIRED_CHECKS.map((name,i)=>({id:800+i,name,app:{id:15368},head_sha:head,status:'completed',conclusion:'success',check_suite:{id:901},details_url:'https://github.com/'+p.repository+'/actions/runs/900/job/'+(800+i)}));
 data['/commits/'+head+'/check-runs?filter=latest&per_page=100']={total_count:2,check_runs:checks};
 data['/actions/runs?event=pull_request&head_sha='+head+'&per_page=100']={total_count:1,workflow_runs:[{id:900,path:'.github/workflows/required-ci.yml'}]};
 data['/actions/runs/900']={id:900,run_attempt:1,path:'.github/workflows/required-ci.yml',event:'pull_request',head_sha:head,status:'completed',conclusion:'success',check_suite_id:901,repository:{id:Number(p.repositoryId)},pull_requests:[]};
 data['/actions/runs/900/attempts/1/jobs?per_page=100']={total_count:2,jobs:checks.map(c=>({id:c.id,name:c.name,status:'completed',conclusion:'success',head_sha:head,run_attempt:1,check_run_url:root+'/check-runs/'+c.id}))};
}
