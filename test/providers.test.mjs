import test from 'node:test';import assert from 'node:assert/strict';
import {calendarAdapter,invitation} from '../supabase/functions/website-api/lib/providers.mjs';
const booking={id:crypto.randomUUID(),attendee_name:'Test Visitor',attendee_email:'visitor@example.invalid',topic:'Test, topic; text\nNot a header\nΈνα μεγάλο μήνυμα '.repeat(12),starts_at:'2026-11-09T10:00:00.000Z',ends_at:'2026-11-09T10:30:00.000Z',updated_at:'2026-10-04T00:00:00.000Z',revision:1,status:'confirmed'};
const googleEnv={GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_REFRESH_TOKEN:'test',GOOGLE_CALENDAR_ID:'owner-calendar'};
test('Google busy lookup fails closed and stable event ID recovers an ambiguous create',async()=>{
 const events=new Map(),calls=[];let failBusy=false;
 const fetcher=async(url,o={})=>{calls.push({url,o});if(url.includes('/token'))return Response.json({access_token:'test-token',expires_in:3600});if(url.includes('freeBusy'))return Response.json({calendars:{'owner-calendar':failBusy?{errors:[{reason:'notFound'}]}:{busy:[{start:booking.starts_at,end:booking.ends_at}]}}});const id=booking.id.replaceAll('-','');if(o.method==='POST'){events.set(id,JSON.parse(o.body));return Response.json({id});}if(o.method==='PATCH'){events.set(id,JSON.parse(o.body));return Response.json({id});}if(o.method==='DELETE'){events.delete(id);return new Response(null,{status:204});}return events.has(id)?Response.json({id}):new Response(null,{status:404});};
 const adapter=calendarAdapter(googleEnv,fetcher),c={calendar_mode:'google'};
 assert.equal((await adapter.busy(c,booking.starts_at,booking.ends_at)).length,1);failBusy=true;await assert.rejects(adapter.busy(c,booking.starts_at,booking.ends_at),/CALENDAR_BUSY_UNAVAILABLE/);
 const first=await adapter.sync(c,booking);const repeat=await adapter.sync(c,{...booking,revision:2});assert.equal(first.id,repeat.id);assert.equal(calls.filter(x=>x.o.method==='POST'&&new URL(x.url).pathname.endsWith('/events')).length,1);assert.equal(events.size,1);
 await adapter.sync(c,{...booking,status:'cancelled'});assert.equal(events.size,0);
});
test('Microsoft rotating refresh token is saved server-side; transactionId lookup recovers one event',async()=>{
 const saved=[],calls=[];let created=null;
 const env={OUTLOOK_CLIENT_ID:'test',OUTLOOK_CLIENT_SECRET:'test',OUTLOOK_REFRESH_TOKEN:'original',OUTLOOK_CALENDAR_ID:'calendar',saveRefreshToken:async(p,t)=>saved.push([p,t])};
 const fetcher=async(url,o={})=>{calls.push({url,o});if(url.includes('/token'))return Response.json({access_token:'token',refresh_token:'rotated',expires_in:3600});if(url.includes('calendarView'))return Response.json({value:[{start:{dateTime:'2026-11-09T10:00:00'},end:{dateTime:'2026-11-09T11:00:00'},showAs:'busy'},{start:{dateTime:'2026-11-09T12:00:00'},end:{dateTime:'2026-11-09T13:00:00'},showAs:'free'}]});if(url.includes('$select=id,transactionId'))return Response.json({value:created?[{id:created,transactionId:booking.id}]:[]});if(o.method==='POST'){created='immutable-event';assert.equal(JSON.parse(o.body).transactionId,booking.id);return Response.json({id:created});}if(o.method==='PATCH')return Response.json({id:created});if(o.method==='DELETE'){created=null;return new Response(null,{status:204});}throw new Error('Unexpected request');};
 const adapter=calendarAdapter(env,fetcher),c={calendar_mode:'outlook'};const busy=await adapter.busy(c,booking.starts_at,booking.ends_at);assert.equal(busy.length,1);assert(busy[0].start.endsWith('Z'));assert.deepEqual(saved,[['OUTLOOK','rotated']]);
 const a=await adapter.sync(c,booking),b=await adapter.sync(c,booking);assert.equal(a.id,b.id);assert.equal(calls.filter(x=>x.o.method==='POST'&&new URL(x.url).pathname.endsWith('/events')).length,1);
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

test('Google Meet creation waits for readiness, recovers without duplicate conferences, and preserves link on reschedule',async()=>{
 const stable=booking.id.replaceAll('-',''),calls=[];let event=null,ready=false;
 const link='https://meet.google.com/abc-defg-hij';
 const response=()=>({...event,id:stable,conferenceData:{...event.conferenceData,createRequest:{...event.conferenceData.createRequest,status:{statusCode:ready?'success':'pending'}},...(ready?{entryPoints:[{entryPointType:'video',uri:link}]}:{})}});
 const fetcher=async(url,o={})=>{calls.push({url,o});if(url.includes('/token'))return Response.json({access_token:'test-token',expires_in:3600});if(o.method==='POST'){event=JSON.parse(o.body);return Response.json(response());}if(o.method==='PATCH'){event={...event,...JSON.parse(o.body)};return Response.json(response());}if(o.method==='DELETE'){event=null;return new Response(null,{status:204});}return event?Response.json(response()):new Response(null,{status:404});};
 const adapter=calendarAdapter(googleEnv,fetcher),c={calendar_mode:'google',location:'Google Meet'};
 await assert.rejects(adapter.sync(c,booking),/CALENDAR_MEET_PENDING/);
 assert.equal(event.conferenceData.createRequest.requestId,stable);
 assert.equal(event.conferenceData.createRequest.conferenceSolutionKey.type,'hangoutsMeet');
 ready=true;const recovered=await adapter.sync(c,booking);assert.equal(recovered.meeting_url,link);
 const moved=await adapter.sync(c,{...booking,revision:2,starts_at:'2026-11-10T10:00:00Z'});assert.equal(moved.meeting_url,link);
 assert.equal(calls.filter(x=>x.o.method==='POST'&&new URL(x.url).pathname.endsWith('/events')).length,1);
 const patches=calls.filter(x=>x.o.method==='PATCH');assert(patches.every(x=>new URL(x.url).searchParams.get('conferenceDataVersion')==='1'));assert(patches.every(x=>!JSON.parse(x.o.body).conferenceData));
 const ics=invitation({...booking,meeting_url:link},link);assert(ics.includes('URL:'+link));assert(ics.includes('LOCATION:'+link));
 await adapter.sync(c,{...booking,status:'cancelled'});assert.equal(event,null);
});

test('failed or unexpected Meet conference links are never accepted as synced',async()=>{
 for(const conferenceData of [{createRequest:{status:{statusCode:'failure'}}},{entryPoints:[{entryPointType:'video',uri:'https://evil.invalid/meet'}]}]){
  const fetcher=async(url,o={})=>url.includes('/token')?Response.json({access_token:'test-token'}):o.method==='POST'?Response.json({id:booking.id.replaceAll('-',''),conferenceData}):new Response(null,{status:404});
  await assert.rejects(calendarAdapter(googleEnv,fetcher).sync({calendar_mode:'google',location:'Google Meet'},booking),/CALENDAR_MEET_FAILED/);
 }
});

test('connection check verifies authorization without creating events or returning personal calendar details',async()=>{
 const calls=[];
 const fetcher=async(url,o={})=>{calls.push({url,o});if(url.includes('/token'))return Response.json({access_token:'private-token',scope:'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy'});if(url.includes('freeBusy'))return Response.json({calendars:{'owner-calendar':{busy:[{start:booking.starts_at,end:booking.ends_at}]}}});return Response.json({items:[{id:'private-event-id'}]});};
 const result=await calendarAdapter(googleEnv,fetcher).check({calendar_mode:'google'});
 assert.deepEqual(result,{connected:true,provider:'google',busy_access:true,event_permission:true});
 assert(!JSON.stringify(result).includes('private'));assert(!calls.some(x=>new URL(x.url).pathname.endsWith('/events')&&x.o.method==='POST'));
 const readOnly=async(url,o)=>url.includes('/token')?Response.json({access_token:'private-token',scope:'https://www.googleapis.com/auth/calendar.events.readonly'}):fetcher(url,o);
 await assert.rejects(calendarAdapter(googleEnv,readOnly).check({calendar_mode:'google'}),/CALENDAR_WRITE_PERMISSION_REQUIRED/);
});

test('Google OAuth failures report safe actionable identifiers and discard sensitive error descriptions',async()=>{
 const codes={invalid_grant:'GOOGLE_REFRESH_TOKEN_REJECTED',invalid_client:'GOOGLE_CLIENT_CREDENTIALS_REJECTED',unauthorized_client:'GOOGLE_CLIENT_NOT_AUTHORIZED',invalid_request:'GOOGLE_OAUTH_REQUEST_INVALID',unknown:'GOOGLE_TOKEN_REQUEST_FAILED'};
 for(const [error,code] of Object.entries(codes)){
  const fetcher=async()=>Response.json({error,error_description:'private-client-secret-and-token'},{status:400});
  await assert.rejects(calendarAdapter(googleEnv,fetcher).check({calendar_mode:'google'}),e=>e.message===code&&!e.message.includes('private'));
 }
});
