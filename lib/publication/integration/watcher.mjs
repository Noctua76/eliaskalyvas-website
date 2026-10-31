// Operational registration watcher, separate from the manual 5C discovery
// watcher. No listener/dispatch/owner approval; all facts re-read by registrar.
import {reviewedIntegrationPolicy} from './policy.mjs';
export function createIntegrationWatcher({configuration,registrars,getJSON,assertAdministration}){
 const roles=['build','inspection','publication'],policies=Object.fromEntries(roles.map(r=>[r,reviewedIntegrationPolicy(configuration,r)])),known=new Map();let closed=false,retired=false;
 const need=(v,c)=>{if(!v)throw Error('INTEGRATION_WATCHER_'+c);};
 const root='https://api.github.com/repos/Noctua76/eliaskalyvas-website',url=root+'/actions/workflows/pages-orchestrator.yml/runs?branch=main&status=in_progress&per_page=100';
 need(roles.every(r=>typeof registrars?.[r]?.register==='function'&&typeof registrars[r].revoke==='function'&&typeof registrars[r].retirePolicy==='function'),'REGISTRARS');
 const close=async()=>{if(retired)return;closed=true;const results=await Promise.allSettled(roles.map(r=>registrars[r].retirePolicy()));need(results.every(r=>r.status==='fulfilled'),'RETIREMENT');known.clear();retired=true;};
 return Object.freeze({close,async scan(){
  need(!closed,'CLOSED');try{for(const role of roles)need(await assertAdministration(policies[role])===true,'ADMINISTRATION');
   const list=await getJSON(url);need(Number.isSafeInteger(list.total_count)&&list.total_count<=100&&list.total_count===list.workflow_runs?.length,'INCOMPLETE');
   const active=new Set();
   for(const candidate of list.workflow_runs){
    const run=await getJSON(root+'/actions/runs/'+candidate.id),id=String(run.id);need(/^[1-9][0-9]*$/.test(id)&&id===String(candidate.id)&&run.path==='.github/workflows/pages-orchestrator.yml'&&run.head_sha===policies.build.callerSHA&&run.head_branch==='main'&&run.repository?.id===1389733212&&String(run.repository.owner?.id)==='217035723'&&run.head_repository?.id===1389733212&&run.repository.full_name===policies.build.repository&&policies.build.events.includes(run.event)&&run.run_attempt===1,'RUN');if(run.status==='completed')continue;need(run.status==='in_progress'&&run.conclusion===null,'RUN');active.add(id);
    const jobs=await getJSON(root+'/actions/runs/'+id+'/attempts/1/jobs?per_page=100');need(Number.isSafeInteger(jobs.total_count)&&jobs.total_count<=100&&jobs.total_count===jobs.jobs?.length,'JOBS');
    for(const role of roles){const hits=jobs.jobs.filter(j=>j.name===policies[role].jobName&&j.status==='in_progress');need(hits.length<=1,'AMBIGUOUS_JOB');const key=id+':'+role;if(!hits.length||known.has(key))continue;
     const result=await registrars[role].register({runId:id,runAttempt:'1'});need(result?.runId===id&&result.runAttempt==='1'&&/^[1-9][0-9]*$/.test(result.checkRunId),'REGISTRATION');known.set(key,{role,...result});}
   }
   for(const [key,row]of known)if(!active.has(row.runId)){const run=await getJSON(root+'/actions/runs/'+row.runId);need(run.status==='completed','UNKNOWN_RUN');await registrars[row.role].revoke({runId:row.runId,runAttempt:row.runAttempt,checkRunId:row.checkRunId});known.delete(key);}
   return {registered:known.size,dispatchesPerformed:0};
  }catch(e){try{await close();}catch{throw Error('INTEGRATION_WATCHER_RETIREMENT_UNKNOWN');}throw e;}
 }});
}
