// No listener is mounted. The separately authorized isolated collector uses
// independently registered facts and broker-role replay storage, never registrar
// DB privileges. Discovery policy is deliberately unusable as a real JWT subject.
import {TrustError} from './oidc.mjs';
import {registeredGithubJobFacts} from './protected-identity.mjs';
import {observeGithubOIDC} from './oidc-observation.mjs';
import {policyGuard,REQUIRED_CHECKS} from './governance.mjs';
import {hashJSON} from '../contract.mjs';
export const DISCOVERY_SUBJECT='urn:nyra:unapproved-subject-discovery';
export function registeredObservation({policy,privilege,getJSON,store,readPolicyState,keySource,signEvidence,now=Date.now}){
 if(policy.subject!==DISCOVERY_SUBJECT||policy.purpose!=='identity-observation-only')throw Error('OBSERVATION_POLICY');
 const guard=policyGuard(policy,readPolicyState),registeredFacts=registeredGithubJobFacts({policy,privilege,getJSON,store,readPolicyState,requiredChecks:REQUIRED_CHECKS,now});
 const jobFacts=async selector=>{const facts=await registeredFacts(selector);const run=await getJSON('https://api.github.com/repos/'+policy.repository+'/actions/runs/'+selector.runId);if(String(run.actor?.id)!==policy.ownerId||String(run.triggering_actor?.id)!==policy.ownerId)throw new TrustError('ACCEPTANCE_OWNER_DISPATCH');return facts;};
 return async token=>{guard();const receipt=await observeGithubOIDC(token,{expected:policy,jobFacts,keySource,signEvidence,now,consumeObservation:c=>store.consume({...c,privilege,policySHA256:hashJSON(policy)})});guard();return receipt;};
}
// acceptToken + persistEvidence are private trusted dependencies. They may be
// wired to observation OR independently approved exact-subject acceptance, never
// selected by a workflow field. This transport cannot select policy or dispatch.
export function acceptanceHandler({privilege,acceptToken,persistEvidence,enabled=false}){
 if(!['build','inspection','publication'].includes(privilege))throw Error('ACCEPTANCE_ROLE');
 return async req=>{
  if(!enabled)return new Response(null,{status:503});
  try{
   const u=new URL(req.url);if(req.method!=='POST'||u.pathname!=='/acceptance/'+privilege||u.search)throw Error('OPERATION');
   const reader=req.body?.getReader();if(!reader)throw Error('BODY');let text='';
   try{for(;;){const {done,value}=await reader.read();if(done)break;if(text.length+value.length>2)throw Error('BODY');text+=new TextDecoder().decode(value);}}finally{await reader.cancel();}
   const auth=req.headers.get('authorization');if(text!=='{}'||!auth?.startsWith('Bearer ')||auth.length>20007)throw Error('AUTH');
   const receipt=await acceptToken(auth.slice(7));await persistEvidence(receipt);
   return Response.json({accepted:true,digest:receipt.digest,keyId:receipt.keyId});
  }catch{return new Response(null,{status:403});}
 };
}
