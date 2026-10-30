// Control-plane process only: authenticated GitHub reads + registrar-role SQL.
// The caller supplies selectors, never job facts, subjects or approval records.
import {TrustError} from './oidc.mjs';
import {hashJSON} from '../contract.mjs';
import {policyGuard} from './governance.mjs';
import {validateJobRegistration,registeredGithubJobFacts} from './protected-identity.mjs';
const need=(ok,code)=>{if(!ok)throw new TrustError(code);};
export function createJobRegistrar({policy,privilege,getJSON,query,requiredChecks,readPolicyState,now=Date.now}){
 const p=structuredClone(policy),guard=policyGuard(p,readPolicyState),root='https://api.github.com/repos/'+p.repository;
 return Object.freeze({async register(selector){
  need(selector&&Object.keys(selector).sort().join(',')==='runAttempt,runId','REGISTRAR_FIELDS');const {runId,runAttempt}=selector;guard();
  need([runId,runAttempt].every(v=>typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v)),'REGISTRAR_SELECTOR');
  const run=await getJSON(root+'/actions/runs/'+runId);
  // A dispatch caller is pinned independently of its run/head claim. Require
  // the API's actual caller commit and referenced reusable-workflow evidence.
  need(run.head_sha===p.callerSHA,'CALLER_PIN');
  const refs=run.referenced_workflows;
  need(Array.isArray(refs)&&refs.filter(w=>w.path===p.jobWorkflowRef&&w.sha===p.jobWorkflowSHA).length===1,'REUSABLE_PIN');
  const response=await getJSON(root+'/actions/runs/'+runId+'/attempts/'+runAttempt+'/jobs?per_page=100');
  need(response.total_count<=100&&response.total_count===response.jobs?.length,'JOB_LOOKUP_INCOMPLETE');
  const matches=response.jobs.filter(j=>j.name===p.jobName&&j.status==='in_progress');
  need(matches.length===1,'REGISTRAR_JOB');const job=matches[0];
  const checkRunId=job.check_run_url?.slice((root+'/check-runs/').length);
  need(job.check_run_url===root+'/check-runs/'+checkRunId,'REGISTRAR_CHECK');
  const r=validateJobRegistration({governance:structuredClone(p.governance),policySHA256:hashJSON(p),privilege,runId,runAttempt,jobId:String(job.id),checkRunId,workflowId:String(run.workflow_id),checkSuiteId:String(run.check_suite_id),codeSHA:run.head_sha,workflowSHA:p.callerSHA,workflowPath:run.path,event:run.event,expiresAt:new Date(now()+300000).toISOString(),...Object.fromEntries(['repository','repositoryId','ownerId','ref','environment','workflowRef','jobWorkflowRef','jobWorkflowSHA','jobName'].map(k=>[k,p[k]]))},p);
  // Reuse all approved live protection, exact job/check/app/retry checks before
  // writing anything. API errors and missing admin access propagate closed.
  await registeredGithubJobFacts({policy:p,privilege,getJSON,store:{load:async()=>r},requiredChecks,readPolicyState,now})({runId,runAttempt,checkRunId});
  guard();await query('insert into nyra_trust.jobs(run_id,run_attempt,check_run_id,registration,policy_sha256,expires_at) values($1,$2,$3,$4,$5,$6)',[runId,runAttempt,checkRunId,JSON.stringify(r),hashJSON(p),r.expiresAt]);
  return Object.freeze({runId,runAttempt,checkRunId});
 },async retirePolicy(){
  // Control-plane only; revoke before publishing the next active policy state.
  await query('update nyra_trust.jobs set revoked_at=clock_timestamp() where policy_sha256=$1 and revoked_at is null',[hashJSON(p)]);
 },async revoke({runId,runAttempt,checkRunId}){
  need([runId,runAttempt,checkRunId].every(v=>typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v)),'REGISTRAR_SELECTOR');
  await query('update nyra_trust.jobs set revoked_at=clock_timestamp() where run_id=$1 and run_attempt=$2 and check_run_id=$3 and revoked_at is null',[runId,runAttempt,checkRunId]);
 }});
}
