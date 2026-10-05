import { ApiError, manageToken } from './validation.mjs';
async function data(result){const r=await result;if(r.error)throw new ApiError('STORAGE_UNAVAILABLE',503);return r.data;}
async function json(fetcher,url,options={}) {
 const r=await fetcher(url,{...options,signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new ApiError(r.status===401||r.status===403?'PROVIDER_AUTHORIZATION_FAILED':'PROVIDER_UNAVAILABLE',503);
 if(r.status===204)return null;return r.json();
}
export function calendarAdapter(env,fetcher=fetch) {
 let cached;
 async function token(mode) {
  if(cached?.mode===mode&&cached.expires>Date.now()+60000)return cached.value;
  const prefix=mode==='google'?'GOOGLE':'OUTLOOK';
  if(!env[prefix+'_CLIENT_ID']||!env[prefix+'_CLIENT_SECRET']||!env[prefix+'_REFRESH_TOKEN']||!env[prefix+'_CALENDAR_ID'])throw new ApiError('CALENDAR_NOT_CONFIGURED',503);
  const url=mode==='google'?'https://oauth2.googleapis.com/token':`https://login.microsoftonline.com/${encodeURIComponent(env.OUTLOOK_TENANT||'consumers')}/oauth2/v2.0/token`;
  const body=new URLSearchParams({client_id:env[prefix+'_CLIENT_ID'],client_secret:env[prefix+'_CLIENT_SECRET'],refresh_token:env[prefix+'_REFRESH_TOKEN'],grant_type:'refresh_token'});
  if(mode==='outlook')body.set('scope','offline_access https://graph.microsoft.com/Calendars.ReadWrite');
  const r=await json(fetcher,url,{method:'POST',body});
  // Rotating Microsoft refresh tokens must be persisted server-side before the old one expires.
  if(r.refresh_token&&r.refresh_token!==env[prefix+'_REFRESH_TOKEN']){
    if(!env.saveRefreshToken)throw new ApiError('CALENDAR_TOKEN_PERSISTENCE_REQUIRED',503);
    await env.saveRefreshToken(prefix,r.refresh_token);env[prefix+'_REFRESH_TOKEN']=r.refresh_token;
  }
  if(!r.access_token)throw new ApiError('PROVIDER_RESPONSE_INVALID',503);
  cached={mode,value:r.access_token,scope:r.scope,expires:Date.now()+(r.expires_in||300)*1000};return r.access_token;
 }
 async function request(mode,path,options={}) {return json(fetcher,path,{...options,headers:{Authorization:`Bearer ${await token(mode)}`,'Content-Type':'application/json',...(mode==='outlook'?{Prefer:'IdType="ImmutableId", outlook.timezone="UTC"'}:{}),...options.headers}});}
 function base(mode){return mode==='google'?`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events`:`https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(env.OUTLOOK_CALENDAR_ID)}/events`;}
 async function findOutlook(bookingId) {
  let url=base('outlook')+'?$select=id,transactionId&$top=1000',pages=0;
  while(url){if(++pages>20||!url.startsWith('https://graph.microsoft.com/'))throw new ApiError('CALENDAR_LOOKUP_FAILED',503);const r=await request('outlook',url);const found=r.value?.find(x=>x.transactionId===bookingId);if(found)return found.id;url=r['@odata.nextLink'];}
  return null;
 }
 return {
  async check(c) {
   if(c.calendar_mode!=='google')throw new ApiError('CALENDAR_NOT_CONFIGURED',503);
   await this.busy(c,new Date().toISOString(),new Date(Date.now()+86400000).toISOString());
   await request('google',base('google')+'?maxResults=1&fields=items(id)');
   // Read-only check: no events or invitations are created and no calendar data is returned.
   const scopes=(cached.scope||'').split(' ');
   if(!scopes.some(s=>['https://www.googleapis.com/auth/calendar','https://www.googleapis.com/auth/calendar.events','https://www.googleapis.com/auth/calendar.events.owned'].includes(s)))throw new ApiError('CALENDAR_WRITE_PERMISSION_REQUIRED',503);
   return {connected:true,provider:'google',busy_access:true,event_permission:true};
  },
  async busy(c,from,to) {
   if(c.calendar_mode==='manual'){if(!c.manual_acknowledged)throw new ApiError('CALENDAR_NOT_CONFIGURED',503);return [];}
   if(!['google','outlook'].includes(c.calendar_mode))throw new ApiError('CALENDAR_NOT_CONFIGURED',503);
   if(c.calendar_mode==='google') {
    const r=await request('google','https://www.googleapis.com/calendar/v3/freeBusy',{method:'POST',body:JSON.stringify({timeMin:from,timeMax:to,items:[{id:env.GOOGLE_CALENDAR_ID}]})});
    const entry=r.calendars?.[env.GOOGLE_CALENDAR_ID];if(!entry||entry.errors?.length)throw new ApiError('CALENDAR_BUSY_UNAVAILABLE',503);return entry.busy||[];
   }
   let url=`https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(env.OUTLOOK_CALENDAR_ID)}/calendarView?startDateTime=${encodeURIComponent(from)}&endDateTime=${encodeURIComponent(to)}&$select=start,end,showAs,isCancelled&$top=1000`;
   const intervals=[];let pages=0;
   while(url){if(++pages>20||!url.startsWith('https://graph.microsoft.com/'))throw new ApiError('CALENDAR_BUSY_UNAVAILABLE',503);const r=await request('outlook',url);for(const x of r.value||[])if(!x.isCancelled&&x.showAs!=='free')intervals.push({start:x.start.dateTime.replace(/Z$/,'')+'Z',end:x.end.dateTime.replace(/Z$/,'')+'Z'});url=r['@odata.nextLink'];}
   return intervals;
  },
  async sync(c,b) {
   const mode=c.calendar_mode;if(mode==='manual')return {id:null,status:'manual'};
   const stable=b.id.replaceAll('-','');const id=b.external_event_id||(mode==='google'?stable:null);
   const url=base(mode);
   if(b.status==='cancelled') {
    if(id){const r=await fetcher(url+'/'+encodeURIComponent(id),{method:'DELETE',headers:{Authorization:`Bearer ${await token(mode)}`},signal:AbortSignal.timeout(15000)});if(!r.ok&&r.status!==404&&r.status!==410)throw new ApiError('CALENDAR_CANCEL_FAILED',503);}
    // If Outlook's creation response was lost, transactionId lookup recovers the event first.
    else if(mode==='outlook'){const old=await findOutlook(b.id);if(old)await request(mode,url+'/'+encodeURIComponent(old),{method:'DELETE'});}
    return {id,status:'synced'};
   }
   const content=mode==='google'?{summary:'Conversation with '+b.attendee_name,description:b.topic,start:{dateTime:b.starts_at},end:{dateTime:b.ends_at},location:c.location}:{subject:'Conversation with '+b.attendee_name,body:{contentType:'text',content:b.topic},start:{dateTime:b.starts_at.replace(/Z$/,''),timeZone:'UTC'},end:{dateTime:b.ends_at.replace(/Z$/,''),timeZone:'UTC'},location:{displayName:c.location}};
   if(mode==='google') {
    const wantsMeet=c.location?.trim().toLowerCase()==='google meet';
    const conference={createRequest:{requestId:stable,conferenceSolutionKey:{type:'hangoutsMeet'}}};
    const result=(r)=>{
     if(!wantsMeet)return {id:r.id,status:'synced',meeting_url:null};
     const status=r.conferenceData?.createRequest?.status?.statusCode;
     if(status==='failure')throw new ApiError('CALENDAR_MEET_FAILED',503);
     const link=r.conferenceData?.entryPoints?.find(x=>x.entryPointType==='video')?.uri||r.hangoutLink;
     if(status==='pending'||!link)throw new ApiError('CALENDAR_MEET_PENDING',503);
     if(!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(link))throw new ApiError('CALENDAR_MEET_FAILED',503);
     return {id:r.id,status:'synced',meeting_url:link};
    };
    // Client-chosen stable event ID prevents duplicate events after ambiguous network failures.
    const existing=await fetcher(url+'/'+stable,{headers:{Authorization:`Bearer ${await token(mode)}`},signal:AbortSignal.timeout(15000)});
    if(existing.ok){const prior=await existing.json();const r=await request(mode,url+'/'+stable+'?conferenceDataVersion=1',{method:'PATCH',body:JSON.stringify({...content,...(wantsMeet&&!prior.conferenceData&&!prior.hangoutLink?{conferenceData:conference}:{})})});return result(r);}
    if(existing.status!==404&&existing.status!==410)throw new ApiError('CALENDAR_LOOKUP_FAILED',503);
    if(existing.status===410)throw new ApiError('CALENDAR_EVENT_DELETED',503);
    const r=await request(mode,url+'?conferenceDataVersion=1',{method:'POST',body:JSON.stringify({...content,id:stable,...(wantsMeet?{conferenceData:conference}:{})})});return result(r);
   }
   // transactionId is a stable client identifier for Outlook duplicate-create protection.
   let eventId=id;
   if(!eventId)eventId=await findOutlook(b.id);
   const r=await request(mode,eventId?url+'/'+encodeURIComponent(eventId):url,{method:eventId?'PATCH':'POST',body:JSON.stringify({...content,...(!eventId?{transactionId:b.id}:{})})});return {id:r.id,status:'synced'};
  }
 };
}
const icsText=value=>String(value).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function invitation(b,location) {
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Elias Kalyvas//Meetings//EN','METHOD:'+(b.status==='cancelled'?'CANCEL':'REQUEST'),'BEGIN:VEVENT',`UID:${b.id}@eliaskalyvas.gr`,`SEQUENCE:${b.revision}`,`DTSTAMP:${stamp(b.updated_at)}`,`DTSTART:${stamp(b.starts_at)}`,`DTEND:${stamp(b.ends_at)}`,'ORGANIZER:mailto:info@eliaskalyvas.gr',`ATTENDEE;RSVP=TRUE:mailto:${b.attendee_email}`,`SUMMARY:${icsText('Conversation with Elias Kalyvas')}`,`DESCRIPTION:${icsText(b.topic)}`,`LOCATION:${icsText(location)}`,'STATUS:'+(b.status==='cancelled'?'CANCELLED':'CONFIRMED'),'END:VEVENT','END:VCALENDAR'];
 if(b.meeting_url)lines.splice(lines.indexOf('END:VEVENT'),0,`URL:${icsText(b.meeting_url)}`);
 // Fold at UTF-8 byte boundaries to the RFC 5545 maximum, including continuation space.
 return lines.map(line=>{let out='',bytes=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(bytes+size>74){out+='\r\n ';bytes=1;}out+=char;bytes+=size;}return out;}).join('\r\n')+'\r\n';
}
const encoded=value=>btoa(String.fromCharCode(...new TextEncoder().encode(value)));
export async function deliverJobs({db,env,fetcher=fetch,calendar=calendarAdapter(env,fetcher)}) {
 if(!env.RESEND_API_KEY||!env.EMAIL_FROM)throw new ApiError('EMAIL_NOT_CONFIGURED',503);
 const jobs=await data(db.rpc('website_claim_jobs'));
 jobs.sort((a,b)=>(a.channel==='calendar'?-1:0)-(b.channel==='calendar'?-1:0));
 let sent=0,failed=0;
 for(const job of jobs) {
  const finish=patch=>data(db.from('notification_jobs').update({...patch,lease_until:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','processing').eq('attempts',job.attempts));
  try {
   const table=job.kind==='message'?'contact_messages':'meeting_bookings';
   const r=await data(db.from(table).select('*').eq('id',job.resource_id).single());
   if(job.kind==='booking'&&r.revision!==job.revision){await finish({status:'sent',last_error:'SUPERSEDED'});continue;}
   const settings=job.kind==='booking'?await data(db.from('meeting_settings').select('*').single()):null;
   if(job.channel==='calendar') {
    const result=await calendar.sync(settings,r);
    await data(db.from('meeting_bookings').update({external_event_id:result.id,sync_status:result.status,meeting_url:result.meeting_url||null}).eq('id',r.id).eq('revision',r.revision));
    await finish({status:'sent',provider_reference:result.id});sent++;continue;
   }
   // A provider timeout can be ambiguous. Never retry beyond Resend's 24-hour dedup window.
   if(job.first_attempt_at&&Date.now()-Date.parse(job.first_attempt_at)>23*3600000)throw new ApiError('DELIVERY_REVIEW_REQUIRED',503);
   const to=job.channel==='owner'?['info@eliaskalyvas.gr']:[r.attendee_email];
   const cc=job.channel==='owner'?['iliaskalivas@hotmail.com']:undefined;
   let subject,content,attachments;
   if(job.kind==='message'){subject=`Website message — ${r.intent}`;content=`Name: ${r.name}\nEmail: ${r.email}\nInterest: ${r.intent}\nReference: ${r.id}\n\n${r.message}`;}
   else {
    if(!['synced','manual'].includes(r.sync_status))throw new ApiError('CALENDAR_SYNC_PENDING',503);
    if(r.status==='confirmed'&&settings.calendar_mode==='google'&&settings.location?.trim().toLowerCase()==='google meet'&&!r.meeting_url)throw new ApiError('CALENDAR_MEET_PENDING',503);
    if(!env.BOOKING_TOKEN_SECRET||!env.PUBLIC_SITE_URL)throw new ApiError('BOOKING_NOT_CONFIGURED',503);
    const url=new URL(`${r.language==='el'?'gr':'en'}/book/`,env.PUBLIC_SITE_URL.endsWith('/')?env.PUBLIC_SITE_URL:env.PUBLIC_SITE_URL+'/');
    url.hash=new URLSearchParams({id:r.id,token:await manageToken(r.id,env.BOOKING_TOKEN_SECRET)}).toString();
    subject=`Meeting ${r.status==='cancelled'?'cancelled':r.revision>1?'rescheduled':'confirmed'} — Elias Kalyvas`;
    const local=new Intl.DateTimeFormat(r.language,{dateStyle:'full',timeStyle:'short',timeZone:r.attendee_timezone}).format(new Date(r.starts_at));
    content=`${r.attendee_name}\n${local} (${r.attendee_timezone})\n${settings.duration_minutes} minutes\n${settings.location}\nReference: ${r.id}\n\n${r.topic}\n\n${r.status==='confirmed'?'Manage your meeting: '+url.href:'This meeting has been cancelled.'}`;
    if(r.status==='confirmed'&&r.meeting_url)content+='\n\nJoin Google Meet: '+r.meeting_url;
    attachments=[{filename:'meeting.ics',content:encoded(invitation(r,r.meeting_url||settings.location))}];
   }
   await data(db.from('notification_jobs').update({first_attempt_at:job.first_attempt_at||new Date().toISOString(),recipient:to.join(',')+(cc?'; CC: '+cc.join(','): '')}).eq('id',job.id));
   const response=await json(fetcher,'https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`website/${job.id}`},body:JSON.stringify({from:env.EMAIL_FROM,to,cc,reply_to:job.kind==='message'?r.email:job.channel==='owner'?r.attendee_email:'info@eliaskalyvas.gr',subject,text:content,attachments})});
   if(!response?.id)throw new ApiError('PROVIDER_RESPONSE_INVALID',503);
   await finish({status:'sent',provider_reference:response.id,last_error:null});sent++;
  } catch(e) {
   const code=e instanceof ApiError?e.message:'PROVIDER_UNAVAILABLE';
   const delay=Math.min(360,5*2**Math.min(job.attempts,6));
   await finish({status:'failed',last_error:code,next_attempt_at:new Date(Date.now()+delay*60000).toISOString()});
   if(job.channel==='calendar')await data(db.from('meeting_bookings').update({sync_status:'failed'}).eq('id',job.resource_id).eq('revision',job.revision));
   failed++;
  }
 }
 return {sent,failed};
}
