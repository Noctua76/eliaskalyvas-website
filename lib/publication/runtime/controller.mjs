import {randomUUID} from 'node:crypto';
import {materializeQueued,requireDelivery} from './materialize.mjs';
// Private worker only, not an endpoint. The store determines complete scope.
export function createDeliveryController({store,clock=()=>new Date().toISOString(),ids=randomUUID}){
 return Object.freeze({async prepare(attemptId){
  const context=await store.claim(attemptId);requireDelivery(!context.reconciliation_required,'RECONCILIATION_REQUIRED');
  if(context.existing)return context.existing;
  const candidate=materializeQueued({...context,now:clock(),ids});
  await store.save({attemptId,fence:context.fence,sourceGeneration:context.source_generation,id:ids(),candidate});return candidate;
 }});
}
