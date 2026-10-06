import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture} from './fixture.mjs';
import {createHandler} from '../supabase/functions/website-api/lib/api.mjs';
import {ApiError,manageToken} from '../supabase/functions/website-api/lib/validation.mjs';
const {pg,db,users}=await fixture();await pg.exec(await readFile(new URL('../supabase/migrations/20261006192643_delete_contact_message.sql',import.meta.url),'utf8'));const sent=[],used=new Set();let emailFails=false,calendarFails=false,meetPending=false;
const env={ALLOWED_ORIGINS:'https://website.test',TURNSTILE_HOSTNAMES:'website.test',TURNSTILE_SECRET_KEY:'test-only',RATE_LIMIT_SALT:'test-only',TRUSTED_IP_HEADER:'x-forwarded-for',PUBLIC_RATE_LIMIT:'100',RESEND_API_KEY:'test-only',EMAIL_FROM:'Website <test@example.invalid>',WORKER_SECRET:'test-only',BOOKING_TOKEN_SECRET:'test-only-secret-32-characters-long',PUBLIC_SITE_URL:'https://website.test/site/'};
const fetcher=async(url,options)=>{if(url.includes('siteverify')){const p=JSON.parse(options.body),valid=p.response.startsWith('valid:')&&!used.has(p.response);used.add(p.response);return Response.json({success:valid,hostname:'website.test',action:p.response.split(':')[1]});}if(url==='https://api.resend.com/emails'){if(emailFails)return new Response('Failure',{status:503});sent.push({body:JSON.parse(options.body),headers:options.headers});return Response.json({id:'test-provider-id'});}throw new Error('Unexpected external URL');};
const calendar={check:async()=>({connected:true}),busy:async()=>{if(calendarFails)throw new Error('Authorization revoked');return [];},sync:async()=>{if(meetPending)throw new ApiError('CALENDAR_MEET_PENDING',503);return {id:'test-event-id',status:'synced',meeting_url:'https://meet.google.com/abc-defg-hij'};}};
const handler=createHandler({db,env,fetcher,calendar});
const call=(path,p,headers={})=>handler(new Request('https://edge.test/website-api'+path,{method:p===undefined?'GET':'POST',headers:{Origin:'https://website.test','Content-Type':'application/json','x-forwarded-for':'203.0.113.10',...headers},body:p===undefined?undefined:JSON.stringify(p)}));
const anti=action=>({turnstileToken:'valid:'+action+':'+crypto.randomUUID(),company:''});
const payload=()=>({name:'Test Visitor',email:'visitor@example.invalid',message:'Test only <script>alert(1)</script>',interest:'Website',language:'en',key:crypto.randomUUID(),...anti('contact')});
test('public API blocks origin, malformed fields, missing intent, forged recipients, captcha replay and oversized payload',async()=>{
 const p=payload();assert.equal((await call('/messages',p,{Origin:'https://evil.test'})).status,403);
 assert.equal((await call('/messages',{...p,name:'   '})).status,400);assert.equal((await call('/messages',{...p,interest:''})).status,400);assert.equal((await call('/messages',{...p,email:'bad'})).status,400);
 assert.equal((await call('/messages',{...p,...anti('contact'),company:'bot'})).status,400);
 assert.equal((await call('/messages',{...p,turnstileToken:'invalid'})).status,400);
 assert.equal((await call('/messages',{...p,extra:'x'.repeat(17000)})).status,413);
 assert.equal((await call('/messages',{...p,to:'evil@example.invalid',cc:'evil@example.invalid'})).status,202);
 assert.equal((await call('/messages',p)).status,400); // replayed captcha
 assert.equal((await pg.query('select * from contact_messages')).rows.length,1);
});
test('fresh-token retry creates one durable record/job and email routing is fixed server-side',async()=>{
 const p=payload();const a=await (await call('/messages',p)).json();const b=await (await call('/messages',{...p,...anti('contact')})).json();assert.equal(a.id,b.id);
 assert.equal((await call('/messages',{...p,message:'changed',...anti('contact')})).status,409);
 const total=(await pg.query('select * from contact_messages')).rows.length;assert.equal(total,2);
 for(let i=0;i<2;i++)assert.equal((await call('/worker',{}, {'x-worker-secret':env.WORKER_SECRET})).status,200);
 assert.equal(sent.length,2);for(const mail of sent){assert.deepEqual(mail.body.to,['info@eliaskalyvas.gr']);assert.deepEqual(mail.body.cc,['iliaskalivas@hotmail.com']);assert.equal(mail.body.reply_to,'visitor@example.invalid');assert.equal(mail.body.from,env.EMAIL_FROM);assert(mail.headers['Idempotency-Key']);}
});
test('provider failure retains accepted message and creates a visible retryable job',async()=>{
 emailFails=true;const p=payload();assert.equal((await call('/messages',p)).status,202);const worker=await (await call('/worker',{}, {'x-worker-secret':env.WORKER_SECRET})).json();assert.equal(worker.failed,1);
 const job=(await pg.query("select * from notification_jobs where status='failed'")).rows[0];assert.equal(job.last_error,'PROVIDER_UNAVAILABLE');assert.equal(job.attempts,1);assert.equal((await pg.query('select * from contact_messages')).rows.length,3);
 emailFails=false;await pg.query("update notification_jobs set next_attempt_at=now() where id=$1",[job.id]);await call('/worker',{}, {'x-worker-secret':env.WORKER_SECRET});assert.equal(sent.length,3);
});
test('persistent source rate limit prevents writes',async()=>{
 const limited=createHandler({db,env:{...env,PUBLIC_RATE_LIMIT:'1'},fetcher,calendar});
 const run=p=>limited(new Request('https://edge.test/website-api/messages',{method:'POST',headers:{Origin:'https://website.test','Content-Type':'application/json','x-forwarded-for':'203.0.113.222'},body:JSON.stringify(p)}));
 assert.equal((await run(payload())).status,202);const before=(await pg.query('select * from contact_messages')).rows.length;assert.equal((await run(payload())).status,429);assert.equal((await pg.query('select * from contact_messages')).rows.length,before);
});
let booking;
test('bookings disabled until configured; current slots only; duplicate retry safe',async()=>{
 const tomorrow=(await pg.query("select ((now() at time zone 'Europe/Athens')::date+2)::text d")).rows[0].d;
 let a=await (await call(`/slots?from=${tomorrow}&to=${tomorrow}`)).json();assert.equal(a.enabled,false);
 await pg.exec("update meeting_settings set enabled=true,calendar_mode='google',location='Google Meet',notice_hours=1;insert into meeting_hours(weekday,starts,ends) select generate_series(0,6),'09:00','12:00'");
 a=await (await call(`/slots?from=${tomorrow}&to=${tomorrow}`)).json();assert(a.enabled&&a.slots.length);
 assert(a.slots.every(s=>Object.keys(s).sort().join(',')==='ends_at,starts_at'));
 const p={name:'Test Attendee',email:'attendee@example.invalid',topic:'Test meeting',timezone:'Europe/Athens',language:'el',key:crypto.randomUUID(),starts_at:a.slots[0].starts_at,...anti('booking')};
 const first=await call('/bookings',p);assert.equal(first.status,202);booking={...p,...await first.json()};
 const retry=await (await call('/bookings',{...p,...anti('booking')})).json();assert.equal(retry.id,booking.id);
 assert.equal((await call('/bookings',{...p,key:crypto.randomUUID(),...anti('booking')})).status,409);
 assert.equal((await call('/bookings',{...p,key:crypto.randomUUID(),starts_at:new Date(Date.parse(p.starts_at)+60000).toISOString(),...anti('booking')})).status,409);
});
test('booking emails wait for Meet and include the stored link in email and ICS after retry',async()=>{
 await pg.exec("update meeting_settings set calendar_mode='google',location='Google Meet'");
 meetPending=true;const before=sent.length;for(let i=0;i<2;i++)await call('/worker',{}, {'x-worker-secret':env.WORKER_SECRET});
 assert(!sent.slice(before).some(m=>m.body.subject.startsWith('Meeting confirmed')));
 assert.equal((await pg.query('select sync_status from meeting_bookings where id=$1',[booking.id])).rows[0].sync_status,'failed');
 meetPending=false;await pg.exec("update notification_jobs set next_attempt_at=now() where status='failed'");
 await call('/worker',{}, {'x-worker-secret':env.WORKER_SECRET});
 const row=(await pg.query('select meeting_url,sync_status from meeting_bookings where id=$1',[booking.id])).rows[0];assert.equal(row.meeting_url,'https://meet.google.com/abc-defg-hij');assert.equal(row.sync_status,'synced');
 const emails=sent.slice(before).filter(m=>m.body.subject.startsWith('Meeting confirmed'));assert.equal(emails.length,2);
 for(const mail of emails){assert(mail.body.text.includes('Join Google Meet: '+row.meeting_url));const ics=Buffer.from(mail.body.attachments[0].content,'base64').toString();assert(ics.includes('URL:'+row.meeting_url));assert(ics.includes('LOCATION:'+row.meeting_url));}
 assert.deepEqual(emails.find(m=>m.body.cc).body.cc,['iliaskalivas@hotmail.com']);assert.deepEqual(emails.find(m=>!m.body.cc).body.to,['attendee@example.invalid']);
});
test('calendar outage fails closed for slots, and GET/link scanning never cancels meetings',async()=>{
 calendarFails=true;const date=booking.starts_at.slice(0,10);assert.equal((await call(`/slots?from=${date}&to=${date}`)).status,503);calendarFails=false;
 assert.equal((await call('/manage')).status,404);assert.equal((await call('/manage',{id:booking.id,token:'invalid',action:'cancel',...anti('manage')})).status,403);
 const token=await manageToken(booking.id,env.BOOKING_TOKEN_SECRET);const info=await (await call('/manage',{id:booking.id,token,action:'details',...anti('manage')})).json();assert.equal(info.status,'confirmed');assert(!('attendee_name'in info));
 assert.equal((await call('/manage',{id:booking.id,token,action:'cancel',...anti('manage')})).status,200);assert.equal((await call('/manage',{id:booking.id,token,action:'cancel',...anti('manage')})).status,200);
});
test('admin identity is allowlisted and records require verified AAL2; worker requires separate secret',async()=>{
 assert.equal((await call('/admin/data')).status,401);assert.equal((await call('/worker',{})).status,401);
 const id=crypto.randomUUID();await pg.query('insert into auth.users values($1)',[id]);await pg.query('insert into website_owners values($1)',[id]);
 const token=aal=>'header.'+btoa(JSON.stringify({sub:id,aal}))+'.verified-by-mock-auth';const a=token('aal1'),b=token('aal2');users.set(a,{id});users.set(b,{id});
 assert.equal((await call('/admin/calendar-check')).status,401);assert.equal((await call('/admin/calendar-check',undefined,{Authorization:'Bearer '+a})).status,403);assert.deepEqual(await (await call('/admin/calendar-check',undefined,{Authorization:'Bearer '+b})).json(),{connected:true});
 assert.equal((await call('/admin/identity',undefined,{Authorization:'Bearer '+a})).status,200);assert.equal((await call('/admin/data',undefined,{Authorization:'Bearer '+a})).status,403);assert.equal((await call('/admin/data',undefined,{Authorization:'Bearer '+b})).status,200);
 const forged='header.'+btoa(JSON.stringify({sub:id,aal:'aal2'}))+'.forged';assert.equal((await call('/admin/data',undefined,{Authorization:'Bearer '+forged})).status,401);
 const outsider=crypto.randomUUID(),other='header.'+btoa(JSON.stringify({sub:outsider,aal:'aal2'}))+'.other';users.set(other,{id:outsider});assert.equal((await call('/admin/data',undefined,{Authorization:'Bearer '+other})).status,403);
});
// Model visible name/email autofill while taking the decoy's name from the real form.
async function autofilledForm(sourcePath,honeypotValue='') {
 const source=await readFile(new URL(sourcePath,import.meta.url),'utf8');
 const decoy=source.match(/<input name="(x_[a-f0-9]+)" tabIndex=\{-1\} autoComplete="new-password" aria-hidden="true" defaultValue=""\s*\/>/);
 assert(decoy,'The offscreen decoy must have neutral semantics and autofill-resistant attributes');
 assert(!source.includes('name="company"'));
 assert(source.includes('company:')&&new RegExp("company:\\s*(?:f|data)\\.get\\('"+decoy[1]+"'\\)").test(source),'Submit must forward the real decoy value, not discard it');
 const form=new FormData();form.set('name','Browser Autofill Visitor');form.set('email','autofilled@example.invalid');form.set(decoy[1],honeypotValue);
 return {name:form.get('name'),email:form.get('email'),company:form.get(decoy[1])};
}
test('booking accepts autofilled visible name/email with the real form honeypot empty',async()=>{
 const visible=await autofilledForm('../src/operations/Booking.jsx');
 const date=(await pg.query("select ((now() at time zone 'Europe/Athens')::date+3)::text d")).rows[0].d;
 const slots=await (await call(`/slots?from=${date}&to=${date}`)).json();assert(slots.enabled&&slots.slots.length);
 const response=await call('/bookings',{topic:'Autofill regression only',timezone:'Europe/Athens',language:'en',key:crypto.randomUUID(),starts_at:slots.slots[0].starts_at,...anti('booking'),...visible});
 assert.equal(response.status,202);const result=await response.json();
 const row=(await pg.query('select attendee_name,attendee_email from meeting_bookings where id=$1',[result.id])).rows[0];
 assert.deepEqual(row,{attendee_name:visible.name,attendee_email:visible.email});
});
test('contact accepts autofilled visible fields with the real form honeypot empty',async()=>{
 const visible=await autofilledForm('../src/ContactSection.jsx');
 const response=await call('/messages',{...payload(),...visible});assert.equal(response.status,202);const result=await response.json();
 const row=(await pg.query('select name,email from contact_messages where id=$1',[result.id])).rows[0];
 assert.deepEqual(row,{name:visible.name,email:visible.email});
});
test('non-empty honeypots still reject both forms and empty honeypots still require Turnstile',async()=>{
 const before=(await pg.query('select (select count(*) from meeting_bookings) bookings,(select count(*) from contact_messages) messages,(select count(*) from notification_jobs) jobs')).rows[0];
 const date=(await pg.query("select ((now() at time zone 'Europe/Athens')::date+4)::text d")).rows[0].d;
 const slots=await (await call(`/slots?from=${date}&to=${date}`)).json();
 const bookingPayload={topic:'Spam regression only',timezone:'Europe/Athens',language:'en',key:crypto.randomUUID(),starts_at:slots.slots[0].starts_at,...anti('booking'),...await autofilledForm('../src/operations/Booking.jsx','bot-filled')};
 const contactPayload={...payload(),...await autofilledForm('../src/ContactSection.jsx','bot-filled')};
 for(const [path,p] of [['/bookings',bookingPayload],['/messages',contactPayload]]){
  const response=await call(path,p);assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:'SPAM_REJECTED'});
  const unverified=await call(path,{...p,company:'',turnstileToken:'invalid'});assert.equal(unverified.status,400);assert.deepEqual(await unverified.json(),{error:'VERIFICATION_FAILED'});
 }
 assert.deepEqual((await pg.query('select (select count(*) from meeting_bookings) bookings,(select count(*) from contact_messages) messages,(select count(*) from notification_jobs) jobs')).rows[0],before);
});

test('message deletion requires verified owner AAL2, accepts only id and preserves meetings',async()=>{
 const target=await (await call('/messages',payload())).json();
 const owner=crypto.randomUUID(),outsider=crypto.randomUUID();
 await pg.query('insert into auth.users values($1),($2)',[owner,outsider]);
 await pg.query('insert into website_owners values($1)',[owner]);
 const token=(id,aal)=>'header.'+btoa(JSON.stringify({sub:id,aal}))+'.deletion-test';
 const ownerAAL1=token(owner,'aal1'),ownerAAL2=token(owner,'aal2'),other=token(outsider,'aal2');
 for(const t of [ownerAAL1,ownerAAL2])users.set(t,{id:owner});users.set(other,{id:outsider});
 const headers={Authorization:'Bearer '+ownerAAL2};
 const beforeMeetings=(await pg.query('select * from meeting_bookings order by id')).rows;
 const beforeBookingJobs=(await pg.query("select * from notification_jobs where kind='booking' order by id")).rows;
 const beforeOtherMessages=(await pg.query('select * from contact_messages where id<>$1 order by id',[target.id])).rows;
 const beforeAudit=(await pg.query('select * from website_audit order by id')).rows;
 for(const [h,status] of [[{},401],[{Authorization:'Bearer '+ownerAAL1},403],[{Authorization:'Bearer '+other},403],[{Authorization:'Bearer '+token(owner,'aal2')+'.forged'},401]])assert.equal((await call('/admin/message-delete',{id:target.id},h)).status,status);
 for(const p of [{id:'bad'},{},{id:target.id,actor:outsider},{id:target.id,status:'archived'}])assert.equal((await call('/admin/message-delete',p,headers)).status,400);
 assert.equal((await call('/admin/message-delete',undefined,headers)).status,404);
 assert.equal((await pg.query('select * from contact_messages where id=$1',[target.id])).rows.length,1);
 // Archiving remains non-destructive.
 assert.equal((await call('/admin/message',{id:target.id,status:'archived'},headers)).status,200);
 assert.equal((await pg.query('select status from contact_messages where id=$1',[target.id])).rows[0].status,'archived');
 const response=await call('/admin/message-delete',{id:target.id},headers);assert.equal(response.status,200);assert.deepEqual(await response.json(),{accepted:true});
 const data=await (await call('/admin/data',undefined,headers)).json();
 assert(!data.messages.some(m=>m.id===target.id));assert(!data.jobs.some(j=>j.resource_id===target.id&&j.kind==='message'));
 const audit=data.audit.find(a=>a.action==='message_deleted'&&a.resource_id===target.id);assert(audit);assert.equal(audit.actor_id,owner);assert.deepEqual(Object.keys(audit).sort(),['action','actor_id','created_at','id','resource_id']);
 assert.deepEqual((await pg.query('select * from meeting_bookings order by id')).rows,beforeMeetings);
 assert.deepEqual((await pg.query("select * from notification_jobs where kind='booking' order by id")).rows,beforeBookingJobs);
 assert.deepEqual((await pg.query('select * from contact_messages order by id')).rows,beforeOtherMessages);
 for(const a of beforeAudit)assert(data.audit.some(x=>x.id===a.id));
 const repeated=await call('/admin/message-delete',{id:target.id},headers);assert.equal(repeated.status,404);assert.deepEqual(await repeated.json(),{error:'NOT_FOUND'});
 assert.equal((await pg.query("select * from website_audit where action='message_deleted' and resource_id=$1",[target.id])).rows.length,1);
});
test.after(()=>pg.close());
