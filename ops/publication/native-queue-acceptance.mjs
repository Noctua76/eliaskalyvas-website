// Narrow native PostgreSQL SQL harness only; NO Auth/OIDC/provenance acceptance.
// Parent-column fixtures isolate the additive queue functions. Full editorial
// schema + owner-gate behavior is covered separately by local integration tests.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export async function acceptNativeInspectionQueue(query){
 await query('begin');try{
  await query(`create schema nyra_inspection;grant usage on schema nyra_inspection to service_role;
   create table nyra_inspection.uploads(id uuid primary key default gen_random_uuid(),code_sha text not null,cleared boolean default false,expires_at timestamptz default clock_timestamp()+interval '5 minutes',state text default 'ready',current_attempt uuid,created_at timestamptz default clock_timestamp());
   create table nyra_inspection.attempts(id uuid primary key,lease_until timestamptz);`);
  const sql=await readFile(new URL('../../supabase/migrations/20261031221433_nyra_final_inspection_queue.sql',import.meta.url),'utf8');await query(sql.replace(/^begin;\s*/,'').replace(/commit;\s*$/,''));
  const code='a'.repeat(40),wrong='b'.repeat(40),u=(await query('insert into nyra_inspection.uploads(code_sha) values($1) returning id',[code])).rows[0].id;
  assert.equal((await query('select nyra_inspection_next($1) id',[wrong])).rows[0].id,null);assert.equal((await query('select nyra_inspection_next($1) id',[code])).rows[0].id,u);
  const call=async(op,id=null,outcome=null)=>(await query('select nyra_inspection_nudge($1,$2,$3,$4) value',[op,code,id,outcome])).rows[0].value;
  assert.equal((await call('claim')).id,u);assert.equal((await call('outcome',u,'unknown')).outcome,'unknown');assert.equal(await call('claim'),null);
  const permission=(await query("select has_function_privilege('anon','public.nyra_inspection_next(text)','execute') a,has_function_privilege('authenticated','public.nyra_inspection_nudge(text,text,uuid,text)','execute') b")).rows[0];assert.equal(permission.a,false);assert.equal(permission.b,false);
  await query("update nyra_inspection.uploads set expires_at=clock_timestamp()-interval '1 second' where id=$1",[u]);assert.equal((await query('select nyra_inspection_next($1) id',[code])).rows[0].id,null);
  return {nativePostgres:true,serverSelection:true,unknownNotRedispatched:true,expiredDenied:true,clientRPCDenied:true,fullOwnerOIDCAcceptance:false};
 }finally{await query('rollback');}
}
