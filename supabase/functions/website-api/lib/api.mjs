import { ApiError, messagePayload, bookingPayload, uuid, text, instant, hash, manageToken } from './validation.mjs';
import { calendarAdapter, deliverJobs } from './providers.mjs';

const errors = ['IDEMPOTENCY_CONFLICT','SLOT_UNAVAILABLE','MEETING_STARTED','CANCELLED','NOT_FOUND','INVALID_TIMEZONE','INCOMPLETE_CONFIGURATION','NOT_RETRYABLE'];
export async function checked(result) {
  const { data, error } = await result;
  if (error) { const code = errors.find(x => error.message?.includes(x)); throw new ApiError(code || 'STORAGE_UNAVAILABLE', code === 'NOT_FOUND' ? 404 : code ? 409 : 503); }
  return data;
}
async function body(req) {
  if (!req.headers.get('content-type')?.includes('application/json')) throw new ApiError('JSON_REQUIRED',415);
  const reader = req.body?.getReader(); if (!reader) throw new ApiError('INVALID_FIELDS');
  let size=0; const parts=[];
  while (true) { const {done,value}=await reader.read(); if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw new ApiError('PAYLOAD_TOO_LARGE',413);}parts.push(value); }
  try { const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(parts.flatMap(p=>[...p]))));if(!data||Array.isArray(data)||typeof data!=='object')throw 0;return data; } catch {throw new ApiError('INVALID_JSON');}
}
export function createHandler({ db, env, fetcher=fetch, calendar=calendarAdapter(env,fetcher), runJobs=deliverJobs }) {
  const allowed = (env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  async function owner(req,requireMfa=true) {
    const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if(!token)throw new ApiError('UNAUTHORIZED',401);
    const {data,error}=await db.auth.getUser(token);if(error||!data?.user)throw new ApiError('UNAUTHORIZED',401);
    const record=await checked(db.from('website_owners').select('user_id').eq('user_id',data.user.id).maybeSingle());
    if(!record)throw new ApiError('FORBIDDEN',403);
    // getUser has verified this exact JWT with Supabase Auth before reading its claims.
    let claims;try { claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); }catch{throw new ApiError('UNAUTHORIZED',401);}
    if(requireMfa&&claims.aal!=='aal2')throw new ApiError('MFA_REQUIRED',403);
    return {id:data.user.id,mfa:claims.aal==='aal2'};
  }
  async function rate(req,scope,limit) {
    if(!env.RATE_LIMIT_SALT)throw new ApiError('NOT_CONFIGURED',503);
    // Trust only the gateway-injected address header configured for the deployment.
    if(!env.TRUSTED_IP_HEADER)throw new ApiError('SOURCE_NOT_CONFIGURED',503);
    const chain=req.headers.get(env.TRUSTED_IP_HEADER)?.split(',').map(x=>x.trim()).filter(Boolean)||[];
    const ip=chain.at(Number(env.TRUSTED_IP_POSITION||-1));
    if(!ip)throw new ApiError('SOURCE_UNAVAILABLE',503);
    const ok=await checked(db.rpc('website_rate_check',{p_bucket:await hash(env.RATE_LIMIT_SALT+':'+scope+':'+ip),p_limit:limit}));
    if(!ok)throw new ApiError('RATE_LIMITED',429);
  }
  async function antiSpam(req,p,action) {
    if(p.company)throw new ApiError('SPAM_REJECTED');
    if(!env.TURNSTILE_SECRET_KEY||!env.TURNSTILE_HOSTNAMES)throw new ApiError('NOT_CONFIGURED',503);
    await rate(req,action,Number(env.PUBLIC_RATE_LIMIT)||5);
    const token=text(p.turnstileToken,2048);
    const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new ApiError('VERIFICATION_UNAVAILABLE',503);
    const result=await response.json();
    if(!result.success||result.action!==action||!env.TURNSTILE_HOSTNAMES.split(',').map(x=>x.trim()).includes(result.hostname))throw new ApiError('VERIFICATION_FAILED');
  }
  async function availability(from,to) {
    if(!/^\d{4}-\d\d-\d\d$/.test(from||'')||!/^\d{4}-\d\d-\d\d$/.test(to||'')||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||Date.parse(to)<Date.parse(from)||Date.parse(to)-Date.parse(from)>90*86400000)throw new ApiError('INVALID_DATES');
    const config=await checked(db.from('meeting_settings').select('*').single());
    if(!config.enabled)return {enabled:false,slots:[]};
    if(config.calendar_mode==='unconfigured'||!config.location|| (config.calendar_mode==='manual'&&!config.manual_acknowledged))return {enabled:false,slots:[]};
    const slots=await checked(db.rpc('website_slots',{p_from:from,p_to:to}));
    const busy=await calendar.busy(config,from+'T00:00:00Z',new Date(Date.parse(to)+2*86400000).toISOString());
    return {enabled:true,timezone:config.timezone,duration:config.duration_minutes,location:config.location,slots:slots.filter(s=>!busy.some(b=>Date.parse(s.starts_at)<Date.parse(b.end)+config.buffer_minutes*60000&&Date.parse(s.ends_at)+config.buffer_minutes*60000>Date.parse(b.start)))};
  }
  return async req => {
    const origin=req.headers.get('origin');
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Referrer-Policy':'no-referrer'};
    if(origin&&allowed.includes(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='Content-Type,Authorization';headers['Access-Control-Allow-Methods']='GET,POST,OPTIONS';}
    const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    try {
      if(origin&&!allowed.includes(origin))throw new ApiError('ORIGIN_REJECTED',403);
      if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
      const url=new URL(req.url);const path=url.pathname.replace(/^.*\/website-api/,'').replace(/\/$/,'');
      if(path==='/worker'&&req.method==='POST') {
        if(!env.WORKER_SECRET||!req.headers.get('x-worker-secret')||await hash(req.headers.get('x-worker-secret'))!==await hash(env.WORKER_SECRET))throw new ApiError('UNAUTHORIZED',401);
        return reply(await runJobs({db,env,fetcher,calendar}));
      }
      if(path==='/messages'&&req.method==='POST') {
        const b=await body(req);const p=messagePayload(b);await antiSpam(req,b,'contact');
        if(!env.RESEND_API_KEY||!env.EMAIL_FROM)throw new ApiError('NOT_CONFIGURED',503);
        p.hash=await hash(JSON.stringify(p));return reply(await checked(db.rpc('website_submit_message',{p})),202);
      }
      if(path==='/slots'&&req.method==='GET'){await rate(req,'slots',Number(env.SLOTS_RATE_LIMIT)||60);return reply(await availability(url.searchParams.get('from'),url.searchParams.get('to')));}
      if(path==='/bookings'&&req.method==='POST') {
        const b=await body(req);const p=bookingPayload(b);await antiSpam(req,b,'booking');
        if(!env.BOOKING_TOKEN_SECRET||env.BOOKING_TOKEN_SECRET.length<32||!env.RESEND_API_KEY||!env.EMAIL_FROM||!env.PUBLIC_SITE_URL)throw new ApiError('NOT_CONFIGURED',503);
        // Retry of an accepted booking bypasses slot checking but still verifies the payload/captcha.
        const existing=await checked(db.from('meeting_bookings').select('id,payload_hash').eq('idempotency_key',p.key).maybeSingle());
        p.hash=await hash(JSON.stringify(p));
        if(existing){if(existing.payload_hash!==p.hash)throw new ApiError('IDEMPOTENCY_CONFLICT',409);return reply({id:existing.id,accepted:true},202);}
        const date=p.starts_at.slice(0,10);const a=await availability(new Date(Date.parse(date)-86400000).toISOString().slice(0,10),new Date(Date.parse(date)+86400000).toISOString().slice(0,10));
        if(!a.enabled||!a.slots.some(s=>Date.parse(s.starts_at)===Date.parse(p.starts_at)))throw new ApiError('SLOT_UNAVAILABLE',409);
        p.id=crypto.randomUUID();p.token_hash=await hash(await manageToken(p.id,env.BOOKING_TOKEN_SECRET));
        return reply(await checked(db.rpc('website_create_booking',{p})),202);
      }
      if(path==='/manage'&&req.method==='POST') {
        const b=await body(req);const id=uuid(b.id);if(!['details','cancel','reschedule'].includes(b.action))throw new ApiError('INVALID_ACTION');
        await antiSpam(req,b,'manage');
        const token=await checked(db.from('booking_tokens').select('token_hash,expires_at').eq('booking_id',id).maybeSingle());
        if(!token||Date.parse(token.expires_at)<Date.now()||await hash(text(b.token,128))!==token.token_hash)throw new ApiError('INVALID_TOKEN',403);
        if(b.action==='details'){const r=await checked(db.from('meeting_bookings').select('id,starts_at,ends_at,status,attendee_timezone').eq('id',id).single());return reply(r);}
        if(b.action==='reschedule') { b.starts_at=instant(b.starts_at);const current=await checked(db.from('meeting_bookings').select('starts_at,status').eq('id',id).single());if(current.status==='confirmed'&&Date.parse(current.starts_at)===Date.parse(b.starts_at))return reply({id,accepted:true});const date=new Date(b.starts_at).toISOString().slice(0,10);const a=await availability(new Date(Date.parse(date)-86400000).toISOString().slice(0,10),new Date(Date.parse(date)+86400000).toISOString().slice(0,10));if(!a.slots.some(s=>Date.parse(s.starts_at)===Date.parse(b.starts_at)))throw new ApiError('SLOT_UNAVAILABLE',409); }
        return reply(await checked(db.rpc('website_change_booking',{p_id:id,p_action:b.action,p_start:b.starts_at||null,p_actor:null})));
      }
      if(path.startsWith('/admin/')) {
        const actor=await owner(req,path!=='/admin/identity');
        if(path==='/admin/identity'&&req.method==='GET')return reply(actor);
        if(path==='/admin/calendar-check'&&req.method==='GET') {
          const config=await checked(db.from('meeting_settings').select('*').single());
          return reply(await calendar.check(config));
        }
        if(path==='/admin/data'&&req.method==='GET') {
          const results=await Promise.all(['contact_messages','meeting_bookings','notification_jobs','website_audit'].map(t=>checked(db.from(t).select('*').order('created_at',{ascending:false}).limit(250))));
          return reply(Object.fromEntries(['messages','meetings','jobs','audit'].map((t,i)=>[t,results[i]])));
        }
        if(path==='/admin/settings'&&req.method==='GET') {
          const [settings,hours,blocks]=await Promise.all([checked(db.from('meeting_settings').select('*').single()),checked(db.from('meeting_hours').select('weekday,starts,ends').order('weekday')),checked(db.from('meeting_blocks').select('starts_at,ends_at').order('starts_at'))]);return reply({settings,hours,blocks});
        }
        if(req.method!=='POST')throw new ApiError('NOT_FOUND',404);
        const b=await body(req);
        if(path==='/admin/message'){if(!['new','read','replied','archived'].includes(b.status))throw new ApiError('INVALID_FIELDS');await checked(db.rpc('website_message_status',{p_id:uuid(b.id),p_status:b.status,p_actor:actor.id}));return reply({accepted:true});}
        if(path==='/admin/meeting') {
          if(!['cancel','reschedule'].includes(b.action))throw new ApiError('INVALID_ACTION');
          if(b.action==='reschedule'){b.starts_at=instant(b.starts_at);const current=await checked(db.from('meeting_bookings').select('starts_at,status').eq('id',uuid(b.id)).single());if(current.status==='confirmed'&&Date.parse(current.starts_at)===Date.parse(b.starts_at))return reply({id:b.id,accepted:true});const d=new Date(b.starts_at);const date=d.toISOString().slice(0,10);const a=await availability(new Date(Date.parse(date)-86400000).toISOString().slice(0,10),new Date(Date.parse(date)+86400000).toISOString().slice(0,10));if(!a.slots.some(s=>Date.parse(s.starts_at)===d.getTime()))throw new ApiError('SLOT_UNAVAILABLE',409);}
          return reply(await checked(db.rpc('website_change_booking',{p_id:uuid(b.id),p_action:b.action,p_start:b.starts_at||null,p_actor:actor.id})));
        }
        if(path==='/admin/retry'){await checked(db.rpc('website_retry_job',{p_id:uuid(b.id),p_actor:actor.id}));return reply({accepted:true});}
        if(path==='/admin/settings') {
          if(!b.settings||!Array.isArray(b.hours)||!Array.isArray(b.blocks)||b.hours.length>28||b.blocks.length>120)throw new ApiError('INVALID_FIELDS');
          if(b.settings.enabled)await calendar.busy(b.settings,new Date().toISOString(),new Date(Date.now()+86400000).toISOString());
          await checked(db.rpc('website_save_settings',{p:b.settings,p_hours:b.hours,p_blocks:b.blocks,p_actor:actor.id}));return reply({accepted:true});
        }
      }
      throw new ApiError('NOT_FOUND',404);
    } catch(e) {return reply({error:e instanceof ApiError?e.message:'SERVICE_UNAVAILABLE'},e instanceof ApiError?e.status:503);}
  };
}
