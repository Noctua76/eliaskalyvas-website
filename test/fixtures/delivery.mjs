import {readFile} from 'node:fs/promises';
import {authorityFixture,OWNER,SESSION} from './publication-authority.mjs';
import {materializeQueued} from '../../lib/publication/runtime/materialize.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
export const DELIVERY_MIGRATION='20261028142242_nyra_private_delivery_runtime.sql';
export async function deliveryFixture(options={}){
 const f=await authorityFixture(options);await f.pg.exec(await readFile(new URL('../../supabase/migrations/'+DELIVERY_MIGRATION,import.meta.url),'utf8'));
 const w=await f.work(),asset=await f.asset(),preview=await f.prepare(w,asset.body.asset_id),authorized=await f.authorize(preview);
 if(authorized.status!==200)throw Error('fixture authorization failed '+JSON.stringify(authorized));
 const baseline={manifest:(await f.pg.query('select snapshot from nyra_publication_manifests where generation=1')).rows[0].snapshot,releases:[]};
 const helpers=deliveryCalls(f);
 await helpers.call('nyra_delivery_bootstrap',{p_owner:OWNER,p_session:SESSION,p_expires:new Date(Date.now()+3600000).toISOString(),p_baseline:baseline});
 return {...f,...helpers,baseline};
}
export function deliveryCalls(f){
 const call=async(name,args={})=>{
  const e=Object.entries(args),values=e.map(([k,v])=>k==='p_intents'?'{'+v.join(',')+'}':typeof v==='object'&&v!==null?JSON.stringify(v):v);
  return (await f.pg.query('select '+name+'('+e.map(([k],i)=>k+'=>$'+(i+1)).join(',')+') value',values)).rows[0]?.value;
 };

 async function register(id,run='100',attempt='1',check='300'){return call('nyra_delivery_register',{p_id:id,p_run:run,p_attempt:attempt,p_check:check,p_sha:'a'.repeat(40)})}
 async function candidate(id){const ctx=await call('nyra_delivery_claim',{p_id:id,p_seconds:300});const candidate=materializeQueued({...ctx,now:new Date().toISOString()}),candidateId=crypto.randomUUID();await call('nyra_delivery_materialized',{p_attempt:id,p_fence:ctx.fence,p_id:candidateId,p_source:ctx.source_generation,p_candidate:candidate,p_sha:hashJSON(candidate.dataset.manifest),p_intents:candidate.intentIds});return {candidate,id:candidateId,context:ctx};}
 const machine=(operation,jti='synthetic-replay-001',run='100',attempt='1',check='300')=>call('nyra_delivery_machine',{p_run:run,p_attempt:attempt,p_check:check,p_sha:'a'.repeat(40),p_jti:jti,p_expires:new Date(Date.now()+240000).toISOString(),p_operation:operation});
 return {call,register,candidate,machine};
}
