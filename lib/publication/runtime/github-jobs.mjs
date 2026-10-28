// Prepared metadata adapter only. getJSON is a server-controlled authenticated
// GitHub reader; no token, dispatch, workflow mutation or network call on import.
import {TrustError} from './oidc.mjs';
export function githubJobFacts({getJSON,repository,environment}){
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))throw new TrustError('TRUST_CONFIG');
 return async({runId,runAttempt,checkRunId})=>{
  for(const v of [runId,runAttempt,checkRunId])if(!/^[1-9][0-9]{0,19}$/.test(v))throw new TrustError('JWT_RUN');
  const root='https://api.github.com/repos/'+repository;
  const run=await getJSON(root+'/actions/runs/'+runId);
  const jobs=await getJSON(root+'/actions/runs/'+runId+'/attempts/'+runAttempt+'/jobs?per_page=100');
  if(jobs.total_count>100)throw new TrustError('JOB_LOOKUP_INCOMPLETE');
  const job=jobs.jobs?.find(j=>j.check_run_url==='https://api.github.com/repos/'+repository+'/check-runs/'+checkRunId);
  if(!job||String(run.run_attempt)!==runAttempt||job.status!=='in_progress'||run.status!=='in_progress')throw new TrustError('JWT_JOB_CORRELATION');
  return {runId:String(run.id),runAttempt:String(run.run_attempt),checkRunId,sha:run.head_sha,workflowSHA:run.head_sha,jobName:job.name,environment,status:job.status,repositoryId:String(run.repository.id),ownerId:String(run.repository.owner.id)};
 };
}
