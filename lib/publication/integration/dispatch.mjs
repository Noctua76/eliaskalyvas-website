// Prepared server-side Pages broker. No default credentials, activation or retry.
// Short-lived job credential is used only after exact OIDC + permit authorization.
import {requireDelivery as need} from '../runtime/materialize.mjs';
export function supabaseDispatchJournal(db){
 const call=async(id,op,value=null)=>{const r=await db.rpc('nyra_delivery_dispatch',{p_attempt:id,p_operation:op,p_value:value});need(!r.error,'DISPATCH_JOURNAL_UNAVAILABLE');return r.data;};
 return Object.freeze({read:id=>call(id,'read'),begin:(id,deployment)=>call(id,'begin',deployment),ack:(id,pages)=>call(id,'ack',pages),observeStatus:(id,status)=>call(id,status==='succeed'?'succeed':'read')});
}
export function createPagesDispatcher({repository,journal,pagesVerifier,fetcher=fetch}){
 need(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository),'GITHUB_REPOSITORY');const root='https://api.github.com/repos/'+repository;
 return Object.freeze({async dispatch({attempt,start,pagesOIDC,githubToken}){
  const p=await pagesVerifier.verify(pagesOIDC);pagesVerifier.assert(p);need(p.runId===attempt.runId&&p.runAttempt===attempt.runAttempt&&p.checkRunId===attempt.checkRunId&&p.codeSHA===attempt.codeSHA,'PAGES_IDENTITY');
  need(typeof githubToken==='string'&&githubToken.length>0&&start.permit.attempt_id===attempt.id&&start.permit.code_sha===attempt.codeSHA,'PAGES_CREDENTIAL');
  const post=async(path,data)=>{const r=await fetcher(root+path,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+githubToken,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2026-03-10'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});need(r.ok,'PAGES_DISPATCH_UNKNOWN');return r.json();};
  // Separate numeric deployment record is operational provenance, not a second
  // website deployment. v1.1's numeric identity never receives the Pages SHA ID.
  const d=await post('/deployments',{ref:attempt.codeSHA,auto_merge:false,required_contexts:[],environment:'github-pages',production_environment:true,payload:{nyra_attempt_id:attempt.id,github_run_id:attempt.runId,github_run_attempt:attempt.runAttempt,check_run_id:attempt.checkRunId,artifact_id:start.artifact_id}});
  need(/^[1-9][0-9]*$/.test(String(d.id)),'DEPLOYMENT_ID');await journal.begin(attempt.id,String(d.id));
  // A lost response leaves an immutable uncertain dispatch. NEVER repeat POST.
  const deployed=await post('/pages/deployments',{artifact_id:Number(start.artifact_id),environment:'github-pages',pages_build_version:attempt.codeSHA,oidc_token:pagesOIDC});need(typeof deployed.id==='string','PAGES_RESPONSE');await journal.ack(attempt.id,deployed.id);
  return {status:'delivery_pending',attempt_id:attempt.id};
 }});
}
