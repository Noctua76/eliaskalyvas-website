// Prepared private automation only. No schedule, credential or dispatch on import.
import {requireDelivery as need} from '../runtime/materialize.mjs';
export function createOutboxTrigger({db,dispatchWorkflow}){return Object.freeze({async runOnce(){
 const claim=await db.rpc('nyra_delivery_nudge',{p_operation:'claim'});need(!claim.error,'OUTBOX_STORAGE');if(!claim.data)return {status:'idle'};
 // Durable claim precedes the network request. An uncertain response is NOT
 // retried blindly; a duplicate workflow must never imply duplicate publication.
 let outcome='unknown';try{await dispatchWorkflow();outcome='accepted';}catch{}
 const recorded=await db.rpc('nyra_delivery_nudge',{p_operation:'outcome',p_id:claim.data.id,p_outcome:outcome});need(!recorded.error,'OUTBOX_OUTCOME_UNKNOWN');return {status:outcome};
 }});}
export function githubWorkflowNudge({repository,workflow,tokenSource,fetcher=fetch}){
 need(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)&&/^[A-Za-z0-9_-]+\.yml$/.test(workflow),'WORKFLOW_CONFIG');return async()=>{
  const r=await fetcher('https://api.github.com/repos/'+repository+'/actions/workflows/'+workflow+'/dispatches',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+await tokenSource(),'Content-Type':'application/json',Accept:'application/vnd.github+json'},body:JSON.stringify({ref:'main'}),signal:AbortSignal.timeout(15000)});need(r.status===204,'WORKFLOW_DISPATCH_UNKNOWN');
 };
}
