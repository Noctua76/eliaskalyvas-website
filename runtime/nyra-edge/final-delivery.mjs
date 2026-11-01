// Full private machine composition, unmounted/default-disabled. Build inventory
// must come from the independently authenticated broker/registrar, not a job.
import {reviewedIntegrationPolicy} from '../../lib/publication/integration/policy.mjs';
import {createProtectedOIDCVerifier} from '../../lib/publication/runtime/protected-identity.mjs';
import {createOutboxTrigger} from '../../lib/publication/integration/outbox.mjs';
import {composePrivateDelivery,protectedVerifiers} from './integration.mjs';
import {createPrivateInspectionService,createInspectionMachineHandler} from '../../lib/publication/runtime/inspection.mjs';
export function composeFinalDelivery({db,configuration,dispatchWorkflow,
 getJSON,keySource,store,requiredChecks,readPolicyState,assertAdministration,assertTrustActive,
 pathScopeAuthority,storage,quarantine,github,publicReader,baseSitemap,
 pagesAudience,enabled=false,fetcher=fetch,now=Date.now}){
 const need=v=>{if(!v)throw Error('FINAL_DELIVERY_DISABLED');};
 need(typeof assertAdministration==='function'&&typeof pathScopeAuthority?.forAttempt==='function');
 const publicationPolicy=reviewedIntegrationPolicy(configuration,'publication'),inspectionPolicy=reviewedIntegrationPolicy(configuration,'inspection');
 const inspectionVerifier=createProtectedOIDCVerifier({policy:inspectionPolicy,privilege:'inspection',store,getJSON,requiredChecks,keySource,readPolicyState:()=>readPolicyState('inspection'),now});
 if(configuration.repositoryTrust)need(typeof assertTrustActive==='function');
 const active=()=>{if(configuration.repositoryTrust)assertTrustActive();};
 const admin=async(policy,operation)=>{need(await assertAdministration(policy,operation)===true);};
 const identities=protectedVerifiers({policy:publicationPolicy,pagesAudience,getJSON,keySource,store,requiredChecks,readPolicyState:()=>readPolicyState('publication'),now});
 // Preserve the verifier's opaque identity provenance while re-reading live
 // administrative protections and signed owner-risk authorization every time.
 const wrap=(verifier,policy=publicationPolicy)=>({async verify(token){active();await admin(policy,policy===inspectionPolicy?'inspection':'delivery');const c=await verifier.verify(token);active();return c;},assert(c){active();return verifier.assert(c);}});
 const delivery=composePrivateDelivery({db,...identities,verifier:wrap(identities.verifier),pagesVerifier:wrap(identities.pagesVerifier),storage,github,publicReader,repository:publicationPolicy.repository,baseSitemap,pathScopeAuthority,fetcher,enabled});
 const inspection=createPrivateInspectionService({db,quarantine,accepted:storage,verifier:wrap(inspectionVerifier,inspectionPolicy),codeSHA:inspectionPolicy.callerSHA});
 const inspectionHandler=createInspectionMachineHandler({service:inspection,enabled});
 const inspectionTrigger=typeof dispatchWorkflow==='function'?createOutboxTrigger({db,rpcName:'nyra_inspection_nudge',claimArgs:{p_code:inspectionPolicy.callerSHA},dispatchWorkflow:async()=>{need(enabled===true);await admin(inspectionPolicy,'outbox');return dispatchWorkflow();}}):null;
 const trigger=typeof dispatchWorkflow==='function'?createOutboxTrigger({db,dispatchWorkflow:async()=>{need(enabled===true);await admin(publicationPolicy,'outbox');return dispatchWorkflow();}}):null;
 return {nudgeInspectionOnce:async()=>{need(enabled===true&&inspectionTrigger);await admin(inspectionPolicy,'outbox');return inspectionTrigger.runOnce();},nudgeOnce:async()=>{need(enabled===true&&trigger);await admin(publicationPolicy,'outbox');return trigger.runOnce();},delivery:delivery.handler,inspection:inspectionHandler,reconcilePending:async()=>{need(enabled===true);await admin(publicationPolicy,'reconciliation');return delivery.service.reconcilePending();}};
}
