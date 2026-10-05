import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {messagePayload,bookingPayload,hash,manageToken} from '../supabase/functions/website-api/lib/validation.mjs';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.jwt() returns jsonb language sql as $$ select coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb $$; create function auth.uid() returns uuid language sql as $$ select (auth.jwt()->>'sub')::uuid $$; grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.jwt(),auth.uid() to authenticated;`);
await db.exec(await readFile(new URL('../supabase/migrations/202610040001_website_operations.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261004195605_protect_owner_lookup.sql',import.meta.url),'utf8'));
const settingsMigration=await readFile(new URL('../supabase/migrations/20261005082721_fix_website_save_settings_safeupdate.sql',import.meta.url),'utf8');
const beforeSettingsDefinition=(await db.query("select prosrc,proacl from pg_proc where oid='public.website_save_settings(jsonb,jsonb,jsonb,uuid)'::regprocedure")).rows[0];
await db.exec(settingsMigration);
const rpc=async(name,p)=> (await db.query(`select ${name}($1::jsonb) result`,[JSON.stringify(p)])).rows[0].result;
const query=async(sql,params=[])=> (await db.query(sql,params)).rows;
const today=(await query(`select (now() at time zone 'Europe/Athens')::date::text d`))[0].d;
const tomorrow=(await query(`select ((now() at time zone 'Europe/Athens')::date+2)::text d`))[0].d;
const end=(await query(`select ((now() at time zone 'Europe/Athens')::date+89)::text d`))[0].d;
const message={name:'Test Visitor',email:'visitor@example.invalid',message:'A test message',interest:'Website',language:'en',key:crypto.randomUUID(),hash:'test-message'};
const booking=start=>({id:crypto.randomUUID(),name:'Test Visitor',email:'visitor@example.invalid',topic:'Test only',starts_at:start,timezone:'Europe/Athens',language:'en',key:crypto.randomUUID(),hash:'booking-test',token_hash:crypto.randomUUID()});
test('server validation rejects blanks, missing intent, invalid email and oversized fields',()=>{
 for(const p of [{...message,name:' '},{...message,email:'x'},{...message,interest:''},{...message,interest:'Other'},{...message,message:'x'.repeat(6001)},{...message,language:'xx'}])assert.throws(()=>messagePayload(p));
 assert.equal(messagePayload(message).name,message.name);assert.throws(()=>bookingPayload({...booking(new Date().toISOString()),timezone:'Invalid/Zone'}));
});
test('disabled bookings expose no slots; configured availability respects notice, horizon and DST',async()=>{
 assert.equal((await query('select * from website_slots($1,$2)',[today,end])).length,0);
 await db.exec(`update meeting_settings set enabled=true,calendar_mode='manual',manual_acknowledged=true,location='Owner-configured meeting method',notice_hours=1,horizon_days=90;insert into meeting_hours(weekday,starts,ends) select generate_series(0,6),'09:00','12:00';`);
 const rows=await query('select * from website_slots($1,$2)',[today,end]);assert(rows.length>20);
 assert(rows.every(s=>Date.parse(s.starts_at)>=Date.now()+59*60000));assert(rows.every(s=>Date.parse(s.ends_at)-Date.parse(s.starts_at)===30*60000));
 const dst=await query(`select (d+'09:00'::time) at time zone 'Europe/Athens' starts_at from (values ('2026-10-24'::date),('2026-10-26'::date)) dates(d)`);
 const a=dst.find(s=>new Date(s.starts_at).toISOString().startsWith('2026-10-24'));const b=dst.find(s=>new Date(s.starts_at).toISOString().startsWith('2026-10-26'));assert(a&&b);assert.equal(new Date(a.starts_at).toISOString().slice(11,16),'06:00');assert.equal(new Date(b.starts_at).toISOString().slice(11,16),'07:00');
});
test('messages and notification outbox are atomic and retries are idempotent',async()=>{
 const [a,b]=await Promise.all([rpc('website_submit_message',message),rpc('website_submit_message',message)]);assert.equal(a.id,b.id);
 assert.equal((await query('select * from contact_messages')).length,1);assert.equal((await query('select * from notification_jobs')).length,1);
 await assert.rejects(rpc('website_submit_message',{...message,hash:'different'}),/IDEMPOTENCY_CONFLICT/);
 await assert.rejects(rpc('website_submit_message',{...message,key:crypto.randomUUID(),interest:'forged'}));assert.equal((await query('select * from contact_messages')).length,1);
});
let booked;
test('concurrent slot requests allow exactly one; DB exclusion protects buffer and forged times',async()=>{
 const slots=await query('select * from website_slots($1,$1)',[tomorrow]);const a=booking(slots[0].starts_at),b=booking(slots[0].starts_at);
 const results=await Promise.allSettled([rpc('website_create_booking',a),rpc('website_create_booking',b)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);booked={...a,...results.find(x=>x.status==='fulfilled').value};
 const replay=await rpc('website_create_booking',a);assert.equal(replay.id,booked.id);
 await assert.rejects(rpc('website_create_booking',booking(new Date(Date.parse(slots[0].starts_at)+60000).toISOString())),/SLOT_UNAVAILABLE/);
 await assert.rejects(db.query(`insert into meeting_bookings(attendee_name,attendee_email,topic,starts_at,ends_at,reserved_range,attendee_timezone,language,idempotency_key,payload_hash) values('X','x@x.test','X',$1::timestamptz+interval '31 minutes',$1::timestamptz+interval '61 minutes',tstzrange($1::timestamptz+interval '31 minutes',$1::timestamptz+interval '61 minutes','[)'),'UTC','en',gen_random_uuid(),'x')`,[slots[0].starts_at]),/no_overlapping_meetings/);
 const blocked=slots[1];await db.query('insert into meeting_blocks(starts_at,ends_at) values($1,$2)',[blocked.starts_at,blocked.ends_at]);await assert.rejects(rpc('website_create_booking',booking(blocked.starts_at)),/SLOT_UNAVAILABLE/);
});
test('reschedule replaces one reservation; repeated cancel has no duplicate notifications',async()=>{
 const slots=await query('select * from website_slots($1,$1)',[tomorrow]);const next=slots.at(-1).starts_at;
 await query("select website_change_booking($1,'reschedule',$2,null)",[booked.id,next]);let count=(await query('select * from notification_jobs where resource_id=$1',[booked.id])).length;
 await query("select website_change_booking($1,'reschedule',$2,null)",[booked.id,next]);assert.equal((await query('select * from notification_jobs where resource_id=$1',[booked.id])).length,count);
 await query("select website_change_booking($1,'cancel',null,null)",[booked.id]);count=(await query('select * from notification_jobs where resource_id=$1',[booked.id])).length;await query("select website_change_booking($1,'cancel',null,null)",[booked.id]);assert.equal((await query('select * from notification_jobs where resource_id=$1',[booked.id])).length,count);
});
test('owner configuration is explicit and rate limiting is persistent',async()=>{
 const settings=(await query('select * from meeting_settings'))[0];
 await assert.rejects(db.query('select website_save_settings($1,$2,$3,null)',[JSON.stringify({...settings,manual_acknowledged:false}),'[]','[]']),/INCOMPLETE_CONFIGURATION/);
 assert.equal((await query("select website_rate_check('test',2) ok"))[0].ok,true);assert.equal((await query("select website_rate_check('test',2) ok"))[0].ok,true);assert.equal((await query("select website_rate_check('test',2) ok"))[0].ok,false);
});
test('anonymous and authenticated nonowners cannot access sensitive tables or execute server RPCs; owner needs MFA',async()=>{
 await db.exec('set role anon');await assert.rejects(db.query('select * from contact_messages'),/permission denied/);await assert.rejects(db.query("select website_submit_message('{}')"),/permission denied/);await db.exec('reset role');
 const owner=crypto.randomUUID(),other=crypto.randomUUID();await query('insert into auth.users values($1),($2)',[owner,other]);await query('insert into website_owners values($1)',[owner]);
 for(const [id,aal,count] of [[other,'aal2',0],[owner,'aal1',0],[owner,'aal2',1]]){
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,aal})]);await db.exec('set role authenticated');assert.equal((await query('select * from contact_messages')).length,count);await assert.rejects(db.query('select * from booking_tokens'),/permission denied/);await assert.rejects(db.query("select website_submit_message('{}')"),/permission denied/);await db.exec('reset role');
 }
});
test('management tokens are deterministic high-entropy server HMACs and hashed for storage',async()=>{
 const secret='x'.repeat(48),a=await manageToken(booked.id,secret),b=await manageToken(booked.id,secret);assert.equal(a,b);assert.equal(a.length,64);assert.notEqual(await hash(a),a);assert.notEqual(a,await manageToken(crypto.randomUUID(),secret));
});
test('settings migration changes only the three approved predicates and preserves access',async()=>{
 const after=(await query("select prosrc,proacl from pg_proc where oid='public.website_save_settings(jsonb,jsonb,jsonb,uuid)'::regprocedure"))[0];
 assert.equal(after.prosrc,beforeSettingsDefinition.prosrc.replace('updated_at=now();','updated_at=now() where id = true;').replace('delete from meeting_hours;','delete from meeting_hours where id is not null;').replace('delete from meeting_blocks;','delete from meeting_blocks where id is not null;'));
 assert.deepEqual(after.proacl,beforeSettingsDefinition.proacl);
});
test('settings save updates the singleton and replaces hours/blocks without changing bookings or outbox',async()=>{
 await db.exec('begin');
 try {
  const beforeBookings=await query('select * from meeting_bookings order by id');
  const beforeJobs=await query('select * from notification_jobs order by id');
  const current=(await query('select * from meeting_settings'))[0];
  const hours=[{weekday:1,starts:'19:00:00',ends:'20:00:00'},{weekday:4,starts:'18:00:00',ends:'19:00:00'}];
  const blocks=[{starts_at:'2027-01-10T10:00:00Z',ends_at:'2027-01-10T11:00:00Z'}];
  const save=(settings,h,b)=>query('select website_save_settings($1::jsonb,$2::jsonb,$3::jsonb,null)',[JSON.stringify(settings),JSON.stringify(h),JSON.stringify(b)]);
  await save({...current,enabled:false,location:'Google Meet',calendar_mode:'google'},hours,blocks);
  let rows=await query('select * from meeting_settings');assert.equal(rows.length,1);assert.equal(rows[0].id,true);assert.equal(rows[0].enabled,false);assert.equal(rows[0].location,'Google Meet');assert.equal(rows[0].calendar_mode,'google');
  for(const key of ['timezone','duration_minutes','buffer_minutes','notice_hours','horizon_days'])assert.equal(rows[0][key],current[key]);
  assert.deepEqual(await query('select weekday,starts,ends from meeting_hours order by weekday'),hours);
  assert.deepEqual((await query('select starts_at,ends_at from meeting_blocks')).map(b=>({starts_at:new Date(b.starts_at).toISOString(),ends_at:new Date(b.ends_at).toISOString()})),[{starts_at:'2027-01-10T10:00:00.000Z',ends_at:'2027-01-10T11:00:00.000Z'}]);
  await save({...rows[0],enabled:true},[hours[1]],[]);
  assert.equal((await query('select enabled from meeting_settings'))[0].enabled,true);
  assert.deepEqual(await query('select weekday,starts,ends from meeting_hours'),[hours[1]]);
  assert.deepEqual(await query('select * from meeting_blocks'),[]);
  assert.deepEqual(await query('select * from meeting_bookings order by id'),beforeBookings);
  assert.deepEqual(await query('select * from notification_jobs order by id'),beforeJobs);
 } finally {await db.exec('rollback');}
});
test.after(()=>db.close());
