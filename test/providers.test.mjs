import test from 'node:test';import assert from 'node:assert/strict';
import {calendarAdapter,invitation} from '../supabase/functions/website-api/lib/providers.mjs';
const booking={id:crypto.randomUUID(),attendee_name:'Test Visitor',attendee_email:'visitor@example.invalid',topic:'Test, topic; text\nNot a header\nΈνα μεγάλο μήνυμα '.repeat(12),starts_at:'2026-11-09T10:00:00.000Z',ends_at:'2026-11-09T10:30:00.000Z',updated_at:'2026-10-04T00:00:00.000Z',revision:1,status:'confirmed'};
const googleEnv={GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_REFRESH_TOKEN:'test',GOOGLE_CALENDAR_ID:'owner-calendar'};
test('Google busy lookup fails closed and stable event ID recovers an ambiguous create',async()=>{
 const events=new Map(),calls=[];let failBusy=false;
 const fetcher=async(url,o={})=>{calls.push({url,o});if(url.includes('/token'))return Response.json({access_token:'test-token',expires_in:3600});if(url.includes('freeBusy'))return Response.json({calendars:{'owner-calendar':failBusy?{errors:[{reason:'notFound'}]}:{busy:[{start:booking.starts_at,end:booking.ends_at}]}}});const id=booking.id.replaceAll('-','');if(o.method==='POST'){events.set(id,JSON.parse(o.body));return Response.json({id});}if(o.method==='PATCH'){events.set(id,JSON.parse(o.body));return Response.json({id});}if(o.method==='DELETE'){events.delete(id);return new Response(null,{status:204});}return events.has(id)?Response.json({id}):new Response(null,{status:404});};
 const adapter=calendarAdapter(googleEnv,fetcher),c={calendar_mode:'google'};
 assert.equal((await adapter.busy(c,booking.starts_at,booking.ends_at)).length,1);failBusy=true;await assert.rejects(adapter.busy(c,booking.starts_at,booking.ends_at),/CALENDAR_BUSY_UNAVAILABLE/);
 const first=await adapter.sync(c,booking);const repeat=await adapter.sync(c,{...booking,revision:2});assert.equal(first.id,repeat.id);assert.equal(calls.filter(x=>x.o.method==='POST'&&x.url.endsWith('/events')).length,1);assert.equal(events.size,1);
 await adapter.sync(c,{...booking,status:'cancelled'});assert.equal(events.size,0);
});
test('Microsoft rotating refresh token is saved server-side; transactionId lookup recovers one event',async()=>{
 const saved=[],calls=[];let created=null;
 const env={OUTLOOK_CLIENT_ID:'test',OUTLOOK_CLIENT_SECRET:'test',OUTLOOK_REFRESH_TOKEN:'original',OUTLOOK_CALENDAR_ID:'calendar',saveRefreshToken:async(p,t)=>saved.push([p,t])};
 const fetcher=async(url,o={})=>{calls.push({url,o});if(url.includes('/token'))return Response.json({access_token:'token',refresh_token:'rotated',expires_in:3600});if(url.includes('calendarView'))return Response.json({value:[{start:{dateTime:'2026-11-09T10:00:00'},end:{dateTime:'2026-11-09T11:00:00'},showAs:'busy'},{start:{dateTime:'2026-11-09T12:00:00'},end:{dateTime:'2026-11-09T13:00:00'},showAs:'free'}]});if(url.includes('$select=id,transactionId'))return Response.json({value:created?[{id:created,transactionId:booking.id}]:[]});if(o.method==='POST'){created='immutable-event';assert.equal(JSON.parse(o.body).transactionId,booking.id);return Response.json({id:created});}if(o.method==='PATCH')return Response.json({id:created});if(o.method==='DELETE'){created=null;return new Response(null,{status:204});}throw new Error('Unexpected request');};
 const adapter=calendarAdapter(env,fetcher),c={calendar_mode:'outlook'};const busy=await adapter.busy(c,booking.starts_at,booking.ends_at);assert.equal(busy.length,1);assert(busy[0].start.endsWith('Z'));assert.deepEqual(saved,[['OUTLOOK','rotated']]);
 const a=await adapter.sync(c,booking),b=await adapter.sync(c,booking);assert.equal(a.id,b.id);assert.equal(calls.filter(x=>x.o.method==='POST'&&x.url.endsWith('/events')).length,1);
 await adapter.sync(c,{...booking,status:'cancelled'});assert.equal(created,null);
});
test('missing or revoked calendar authorization cannot expose bookable slots',async()=>{
 await assert.rejects(calendarAdapter({},async()=>{throw new Error('Should not fetch');}).busy({calendar_mode:'google'},booking.starts_at,booking.ends_at),/CALENDAR_NOT_CONFIGURED/);
 await assert.rejects(calendarAdapter(googleEnv,async()=>new Response(null,{status:401})).busy({calendar_mode:'google'},booking.starts_at,booking.ends_at),/PROVIDER_AUTHORIZATION_FAILED/);
 await assert.rejects(calendarAdapter({OUTLOOK_CLIENT_ID:'x',OUTLOOK_CLIENT_SECRET:'x',OUTLOOK_REFRESH_TOKEN:'x',OUTLOOK_CALENDAR_ID:'x'},async()=>Response.json({access_token:'x',refresh_token:'rotated'})).busy({calendar_mode:'outlook'},booking.starts_at,booking.ends_at),/CALENDAR_TOKEN_PERSISTENCE_REQUIRED/);
});
test('ICS maintains stable UID/sequence, cancellation method, UTF-8 folding and escaped user text',()=>{
 const a=invitation(booking,'Owner-defined location'),b=invitation({...booking,status:'cancelled',revision:2},'Owner-defined location');assert(a.includes(`UID:${booking.id}@eliaskalyvas.gr`));assert(b.includes(`UID:${booking.id}@eliaskalyvas.gr`));assert(a.includes('METHOD:REQUEST'));assert(b.includes('METHOD:CANCEL'));assert(b.includes('SEQUENCE:2'));assert(a.includes('Test\\, topic\\; text\\n'));assert(a.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75));
});
