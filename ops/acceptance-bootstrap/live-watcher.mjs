// Phase 5C: private coordinator-side registration watcher. NO listener,
// dispatch permission, bearer input, policy selection, or Github job auth.
// A separate owner-approved live policy controls each exact role/job.
const need=(v,c)=>{if(!v)throw Error('WATCHER_'+c);};
const DECIMAL=/^[1-9][0-9]{0,19}$/;
const HEX40=/^[a-f0-9]{40}$/;
const roles=Object.freeze(['build','inspection','publication']);
const workflow='.github/workflows/nyra-live-trust-acceptance.yml';
const repo='Noctua76/eliaskalyvas-website';
const api='https://api.github.com/repos/'+repo;
const listURL=api+'/actions/workflows/nyra-live-trust-acceptance.yml/runs?event=workflow_dispatch&branch=main&per_page=100';
const jobURL=(id,attempt)=>api+'/actions/runs/'+id+'/attempts/'+attempt+'/jobs?per_page=100';
const runURL=id=>api+'/actions/runs/'+id;
function valid(run,head,owner,window){
 need(DECIMAL.test(String(run?.id))&&DECIMAL.test(String(run?.run_attempt)),'RUN_ID');
 need(run.path===workflow&&run.event==='workflow_dispatch'&&run.head_branch==='main'&&
  run.head_sha===head&&run.repository?.full_name===repo&&
  run.repository.id===1389733212&&String(run.repository.owner?.id)===owner&&
  run.head_repository?.id===run.repository.id,'RUN_SOURCE');
 need(String(run.actor?.id)===owner&&String(run.triggering_actor?.id)===owner,'OWNER_DISPATCH');
 const time=Date.parse(run.created_at);
 need(Number.isFinite(time)&&time>=window.start&&time<window.end,'RUN_WINDOW');
}
export function createLiveWatcher({
 getJSON,registrars,policies,assertAdministration,callerSHA,
 ownerId='217035723',windowStartsAt,windowEndsAt,now=Date.now
}){
 need(typeof getJSON==='function'&&typeof assertAdministration==='function'&&HEX40.test(callerSHA),'CONFIG');
 const start=Date.parse(windowStartsAt),end=Date.parse(windowEndsAt);
 need(Number.isFinite(start)&&Number.isFinite(end)&&start<end&&end-start<=86400000,'WINDOW');
 need(roles.every(role=>registrars?.[role]?.register&&registrars[role].revoke&&
  typeof policies?.[role]?.jobName==='string'&&policies[role].jobName.length>0&&
  policies[role].repository===repo&&policies[role].ownerId===ownerId&&
  policies[role].callerSHA===callerSHA),'ROLE_PINS');
 const seen=new Set(),registered=new Map();
 let armed=false,chosen=null,closed=false,failed=false;
 const live=()=>need(!closed&&!failed&&now()>=start&&now()<end,'INACTIVE');
 const administration=async()=>{for(const role of roles)await assertAdministration(policies[role]);};
 const list=async()=>{const response=await getJSON(listURL);
  need(Number.isSafeInteger(response?.total_count)&&response.total_count<100&&
   response.total_count===response.workflow_runs?.length,'INCOMPLETE');
  return response.workflow_runs;};
 const retire=async()=>{closed=true;const errors=[];
  for(const [key,row] of [...registered]){
   try{await registrars[row.role].revoke(row.selector);registered.delete(key);}
   catch{errors.push(row.role);}
  }
  need(errors.length===0,'RETIRE');
 };
 return Object.freeze({
  async arm(){
   need(!armed,'ALREADY_ARMED');live();await administration();
   const existing=await list();
   for(const r of existing)if(DECIMAL.test(String(r.id)))seen.add(String(r.id));
   armed=true;
   return Object.freeze({armed:true,baselineRunCount:seen.size,authorization:false,dispatchesPerformed:0});
  },
  async scan(){
   try{
    live();need(armed,'NOT_ARMED');await administration();
    const discovered=(await list()).filter(r=>!seen.has(String(r.id)));
    need(discovered.length<=1,'MULTIPLE_DISPATCHES');
    if(discovered.length){
     const candidate=discovered[0],exact=await getJSON(runURL(candidate.id));
     valid(exact,callerSHA,ownerId,{start,end});
     need(['queued','in_progress','waiting'].includes(exact.status)&&
       exact.conclusion===null,'RUN_NOT_ACTIVE');
     need(chosen===null||chosen===String(exact.id),'SECOND_RUN');
     chosen=String(exact.id);seen.add(chosen);
    }
    if(!chosen)return {observed:false,registered:[],authorization:false};
    const run=await getJSON(runURL(chosen));
    valid(run,callerSHA,ownerId,{start,end});
    if(run.status==='completed'){
     const previouslyRegistered=[...registered.keys()];
     failed=true;await retire();
     return {observed:true,completed:true,retired:true,registered:previouslyRegistered,
      authorization:false};
    }
    need(DECIMAL.test(String(run.run_attempt))&&run.status==='in_progress','RUN_STATE');
    const response=await getJSON(jobURL(chosen,run.run_attempt));
    need(Number.isSafeInteger(response?.total_count)&&response.total_count<100&&
      response.total_count===response.jobs?.length,'JOBS_INCOMPLETE');
    for(const role of roles){
     const hits=response.jobs.filter(j=>j.name===policies[role].jobName);
     need(hits.length<=1,'AMBIGUOUS_JOB');
     const job=hits[0],key=role+':'+chosen+':'+run.run_attempt;
     if(!job||job.status!=='in_progress'||registered.has(key))continue;
     need(String(job.run_id)===chosen&&String(job.run_attempt)===String(run.run_attempt)&&
       job.head_sha===callerSHA&&DECIMAL.test(String(job.id)),'JOB_SOURCE');
     // createJobRegistrar independently re-reads branch, job/check, Auth,
     // GitHub administration and current policy before its SQL INSERT.
     const selector={runId:chosen,runAttempt:String(run.run_attempt)};
     const result=await registrars[role].register(selector);
     need(result?.runId===chosen&&result.runAttempt===selector.runAttempt&&
       DECIMAL.test(result.checkRunId),'REGISTRATION');
     registered.set(key,{role,selector:{...selector,checkRunId:result.checkRunId}});
    }
    return {observed:true,completed:false,registered:[...registered.keys()],authorization:false};
   }catch(e){
    // Never leave an accepting watcher armed after partial registration,
    // failed administration, or any ambiguous GitHub observation.
    failed=true;
    try{await retire();}catch{/* retain unrevoked rows for explicit retry */}
    throw e;
   }
  },
  async isReady({role,runId,runAttempt}){
   if(!armed||closed||failed||now()<start||now()>=end||
      !roles.includes(role)||!DECIMAL.test(runId)||!DECIMAL.test(runAttempt)||
      runId!==chosen||!registered.has(role+':'+runId+':'+runAttempt))return false;
   try{
    await administration();
    const run=await getJSON(runURL(runId));
    valid(run,callerSHA,ownerId,{start,end});
    if(run.status!=='in_progress'||String(run.run_attempt)!==runAttempt)return false;
    const jobs=await getJSON(jobURL(runId,runAttempt));
    need(Number.isSafeInteger(jobs.total_count)&&jobs.total_count<100&&
      jobs.total_count===jobs.jobs?.length,'JOBS_INCOMPLETE');
    const saved=registered.get(role+':'+runId+':'+runAttempt);
    return jobs.jobs.filter(j=>j.name===policies[role].jobName&&
      j.status==='in_progress'&&String(j.run_id)===runId&&
      String(j.run_attempt)===runAttempt&&j.head_sha===callerSHA&&
      j.check_run_url===api+'/check-runs/'+saved.selector.checkRunId).length===1;
   }catch{return false;}
  },
  retire,
  state(){return Object.freeze({armed,closed,failed,chosen,registered:[...registered.keys()],authorization:false});}
 });
}
