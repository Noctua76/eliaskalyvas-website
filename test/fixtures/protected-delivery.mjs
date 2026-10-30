import {policy as original,CLOCK} from './phase4b.mjs';
export const policy={...original,ref:'refs/heads/main',workflowRef:'test/repo/.github/workflows/trusted.yml@refs/heads/main',jobWorkflowRef:'test/repo/.github/workflows/worker.yml@'+'b'.repeat(40),environment:'nyra-inspection',subject:'repo:test/repo:environment:nyra-inspection',audience:'urn:nyra:inspection',jobName:'inspection / trusted'};
export const now=()=>Date.parse(CLOCK);
export const registration=()=>({privilege:'inspection',runId:'100',runAttempt:'1',checkRunId:'300',jobId:'400',workflowId:'500',checkSuiteId:'600',codeSHA:'a'.repeat(40),workflowSHA:'c'.repeat(40),workflowPath:'.github/workflows/trusted.yml',event:'workflow_dispatch',expiresAt:new Date(now()+300000).toISOString(),...Object.fromEntries(['repository','repositoryId','ownerId','ref','environment','workflowRef','jobWorkflowRef','jobWorkflowSHA','jobName'].map(k=>[k,policy[k]]))});
export function apiFixture(){const r=registration(),root='https://api.github.com/repos/test/repo';
 const data={
  '/branches/main':{name:'main',protected:true,commit:{sha:r.codeSHA}},
  '/branches/main/protection':{enforce_admins:{enabled:true},allow_force_pushes:{enabled:false},allow_deletions:{enabled:false},required_conversation_resolution:{enabled:true},required_pull_request_reviews:{required_approving_review_count:1,dismiss_stale_reviews:true,require_last_push_approval:true},required_status_checks:{strict:true,checks:[{context:'regression',app_id:15368}]}},
  '/environments/nyra-inspection':{name:'nyra-inspection',can_admins_bypass:false,protection_rules:[{type:'required_reviewers',prevent_self_review:true,reviewers:[{type:'User',reviewer:{id:77}}]}],deployment_branch_policy:{protected_branches:false,custom_branch_policies:true}},
  '/environments/nyra-inspection/deployment-branch-policies?per_page=100':{total_count:1,branch_policies:[{name:'main',type:'branch'}]},
  '/actions/runs/100':{id:100,run_attempt:1,head_sha:r.codeSHA,head_branch:'main',path:r.workflowPath,workflow_id:500,event:'workflow_dispatch',status:'in_progress',check_suite_id:600,repository:{id:123,full_name:'test/repo',owner:{id:456}},head_repository:{id:123}},
  '/actions/runs/100/attempts/1/jobs?per_page=100':{total_count:1,jobs:[{id:400,check_run_url:root+'/check-runs/300',name:r.jobName,status:'in_progress',run_id:100,run_attempt:1,head_sha:r.codeSHA}]},
  '/check-runs/300':{id:300,status:'in_progress',head_sha:r.codeSHA,check_suite:{id:600},app:{id:15368}}
 };
 return {data,getJSON:async url=>{const value=data[url.slice(root.length)];if(!value)throw Error('API_UNAVAILABLE');return structuredClone(value);}};
}
