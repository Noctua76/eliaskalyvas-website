// SYNTHETIC identity only; actual checked-out bytes and process/SQL isolation.
import {integrationAPI} from '../../test/fixtures/protected-integration.mjs';
import {addGovernanceEvidence} from '../../test/fixtures/protected-delivery.mjs';
import {reviewedDeliveryPolicy} from '../../lib/publication/runtime/delivery-policy.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
export function isolatedFixture(head,privilege){
 const f=integrationAPI(privilege),id=privilege==='build'?'400':'401',check=privilege==='build'?'700':'701';
 for(const p of Object.values(f.configuration.identities))p.callerSHA=head;
 f.policy=reviewedDeliveryPolicy(f.configuration,privilege);f.data['/branches/main'].commit.sha=head;
 const run=f.data['/actions/runs/100'],jobs=f.data['/actions/runs/100/attempts/1/jobs?per_page=100'],c=f.data['/check-runs/300'];
 delete f.data['/actions/runs/100'];delete f.data['/actions/runs/100/attempts/1/jobs?per_page=100'];delete f.data['/check-runs/300'];
 Object.assign(run,{id:Number(id),head_sha:head});Object.assign(jobs.jobs[0],{id:Number(check),run_id:Number(id),head_sha:head,check_run_url:'https://api.github.com/repos/'+f.policy.repository+'/check-runs/'+check});Object.assign(c,{id:Number(check),head_sha:head});
 f.data['/actions/runs/'+id]=run;f.data['/actions/runs/'+id+'/attempts/1/jobs?per_page=100']=jobs;f.data['/check-runs/'+check]=c;addGovernanceEvidence(f.data,f.policy);
 f.selector={runId:id,runAttempt:'1'};f.builder={privilege,codeSHA:head,workflowSHA:head,jobWorkflowSHA:f.policy.jobWorkflowSHA,runId:id,runAttempt:'1',checkRunId:check,governance:f.policy.governance,policySHA256:hashJSON(f.policy)};
 f.readPolicyState=()=>({policySHA256:hashJSON(f.policy),policyVersion:1,mode:'SINGLE_OWNER',ownerAuthorizationSHA:f.policy.governance.ownerAuthorizationSHA});return f;
}
