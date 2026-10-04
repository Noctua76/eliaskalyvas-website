-- Standalone personal-website project only. Never run against Aegis Link.
create table public.website_owners (user_id uuid primary key references auth.users(id));
create or replace function public.website_owner() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(select 1 from website_owners where user_id=auth.uid());
$$;
create table public.contact_messages (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 email text not null check(length(email) between 3 and 254), message text not null check(length(trim(message)) between 1 and 6000),
 intent text not null check(intent in ('Website','AI solution','Business system','Consulting','Idea')),
 language text not null check(language in ('en','el')), status text not null default 'new' check(status in ('new','read','replied','archived')),
 idempotency_key uuid unique not null, payload_hash text not null, created_at timestamptz not null default now()
);
create table public.meeting_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 timezone text not null default 'Europe/Athens', duration_minutes int not null default 30 check(duration_minutes between 15 and 120),
 buffer_minutes int not null default 15 check(buffer_minutes between 0 and 120), notice_hours int not null default 24 check(notice_hours between 1 and 720),
 horizon_days int not null default 30 check(horizon_days between 1 and 90), location text not null default '',
 calendar_mode text not null default 'unconfigured' check(calendar_mode in ('unconfigured','google','outlook','manual')),
 manual_acknowledged boolean not null default false, updated_at timestamptz not null default now()
);
insert into meeting_settings(id) values(true);
create table public.meeting_hours (
 id bigint generated always as identity primary key, weekday int not null check(weekday between 0 and 6),
 starts time not null, ends time not null, check(starts<ends), unique(weekday,starts,ends)
);
create table public.meeting_blocks (id uuid primary key default gen_random_uuid(), starts_at timestamptz not null, ends_at timestamptz not null, check(starts_at<ends_at));
create table public.meeting_bookings (
 id uuid primary key default gen_random_uuid(), attendee_name text not null check(length(trim(attendee_name)) between 1 and 120),
 attendee_email text not null check(length(attendee_email) between 3 and 254), topic text not null check(length(trim(topic)) between 1 and 2000),
 starts_at timestamptz not null, ends_at timestamptz not null, reserved_range tstzrange not null,
 attendee_timezone text not null, language text not null check(language in ('en','el')),
 status text not null default 'confirmed' check(status in ('confirmed','cancelled')),
 idempotency_key uuid not null unique, payload_hash text not null, revision int not null default 1,
 external_event_id text, sync_status text not null default 'pending' check(sync_status in ('pending','synced','failed','manual')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(starts_at<ends_at),
 constraint no_overlapping_meetings exclude using gist (reserved_range with &&) where(status='confirmed')
);
create table public.booking_tokens (booking_id uuid primary key references meeting_bookings(id), token_hash text not null unique, expires_at timestamptz not null);
create table public.notification_jobs (
 id uuid primary key default gen_random_uuid(), resource_id uuid not null, kind text not null check(kind in ('message','booking')),
 revision int not null default 1, channel text not null check(channel in ('owner','attendee','calendar')),
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts int not null default 0, provider_reference text, last_error text, next_attempt_at timestamptz not null default now(),
 lease_until timestamptz, recipient text, first_attempt_at timestamptz, updated_at timestamptz not null default now(), created_at timestamptz not null default now(), unique(resource_id,revision,channel)
);
create table public.website_audit (id bigint generated always as identity primary key, actor_id uuid, action text not null, resource_id text, created_at timestamptz not null default now());
create table public.website_rate_limits (bucket text primary key, hits int not null, expires_at timestamptz not null);

-- No anonymous direct writes or sensitive reads. Owner access needs AAL2.
do $$ declare t text; begin foreach t in array array['website_owners','contact_messages','meeting_settings','meeting_hours','meeting_blocks','meeting_bookings','booking_tokens','notification_jobs','website_audit','website_rate_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 if t not in ('website_owners','booking_tokens','website_rate_limits') then
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy owner_read on public.%I for select to authenticated using (public.website_owner())',t);
 end if;
 end loop; end $$;

create function public.website_slots(p_from date,p_to date) returns table(starts_at timestamptz,ends_at timestamptz) language sql stable security definer set search_path=public,pg_temp as $$
 with c as (select * from meeting_settings where enabled and (calendar_mode in ('google','outlook') or (calendar_mode='manual' and manual_acknowledged)) and location<>''),
 days as (select generate_series(p_from::timestamp,p_to::timestamp,'1 day')::date d),
 candidates as (select s, s+make_interval(mins=>c.duration_minutes) e, c.buffer_minutes b from c,days
 join meeting_hours h on h.weekday=extract(dow from days.d)::int,
 lateral generate_series((days.d+h.starts) at time zone c.timezone,
 ((days.d+h.ends) at time zone c.timezone)-make_interval(mins=>c.duration_minutes),make_interval(mins=>c.duration_minutes+c.buffer_minutes)) s
 where s>=now()+make_interval(hours=>c.notice_hours) and s<now()+make_interval(days=>c.horizon_days))
 select distinct s,e from candidates where not exists(select 1 from meeting_bookings m where m.status='confirmed' and m.reserved_range && tstzrange(s,e+make_interval(mins=>b),'[)'))
 and not exists(select 1 from meeting_blocks b1 where tstzrange(b1.starts_at,b1.ends_at,'[)') && tstzrange(s,e+make_interval(mins=>b),'[)')) order by s;
$$;
create function public.website_submit_message(p jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
 declare r contact_messages; begin
 perform pg_advisory_xact_lock(hashtextextended(p->>'key',0));
 select * into r from contact_messages where idempotency_key=(p->>'key')::uuid;
 if found then if r.payload_hash<>p->>'hash' then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return jsonb_build_object('id',r.id,'accepted',true); end if;
 insert into contact_messages(name,email,message,intent,language,idempotency_key,payload_hash)
 values(p->>'name',p->>'email',p->>'message',p->>'interest',p->>'language',(p->>'key')::uuid,p->>'hash') returning * into r;
 insert into notification_jobs(resource_id,kind,channel) values(r.id,'message','owner');
 return jsonb_build_object('id',r.id,'accepted',true);
 end $$;
create function public.website_create_booking(p jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
 declare r meeting_bookings; c meeting_settings; e timestamptz; begin
 perform pg_advisory_xact_lock(70707);
 select * into r from meeting_bookings where idempotency_key=(p->>'key')::uuid;
 if found then if r.payload_hash<>p->>'hash' then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return jsonb_build_object('id',r.id,'accepted',true); end if;
 select * into c from meeting_settings;
 select ends_at into e from website_slots(((p->>'starts_at')::timestamptz at time zone c.timezone)::date,((p->>'starts_at')::timestamptz at time zone c.timezone)::date) where starts_at=(p->>'starts_at')::timestamptz;
 if e is null then raise exception 'SLOT_UNAVAILABLE'; end if;
 insert into meeting_bookings(id,attendee_name,attendee_email,topic,starts_at,ends_at,reserved_range,attendee_timezone,language,idempotency_key,payload_hash,sync_status)
 values((p->>'id')::uuid,p->>'name',p->>'email',p->>'topic',(p->>'starts_at')::timestamptz,e,tstzrange((p->>'starts_at')::timestamptz,e+make_interval(mins=>c.buffer_minutes),'[)'),p->>'timezone',p->>'language',(p->>'key')::uuid,p->>'hash',case when c.calendar_mode='manual' then 'manual' else 'pending' end) returning * into r;
 insert into booking_tokens values(r.id,p->>'token_hash',e+interval '1 day');
 insert into notification_jobs(resource_id,kind,channel) values(r.id,'booking','owner'),(r.id,'booking','attendee'),(r.id,'booking','calendar');
 return jsonb_build_object('id',r.id,'accepted',true);
 end $$;
create function public.website_change_booking(p_id uuid,p_action text,p_start timestamptz,p_actor uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
 declare r meeting_bookings; c meeting_settings; e timestamptz; begin
 perform pg_advisory_xact_lock(70707);
 select * into r from meeting_bookings where id=p_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if p_action='cancel' and r.status='cancelled' then return jsonb_build_object('id',r.id,'accepted',true); end if;
 if r.starts_at<=now() then raise exception 'MEETING_STARTED'; end if;
 if p_action='reschedule' then
 if r.status<>'confirmed' then raise exception 'CANCELLED'; end if;
 if r.starts_at=p_start then return jsonb_build_object('id',r.id,'accepted',true); end if;
 select * into c from meeting_settings;
 -- Temporarily release this booking in the transaction; rollback restores it on conflict.
 update meeting_bookings set status='cancelled' where id=p_id;
 select ends_at into e from website_slots((p_start at time zone c.timezone)::date,(p_start at time zone c.timezone)::date) where starts_at=p_start;
 if e is null then raise exception 'SLOT_UNAVAILABLE'; end if;
 update meeting_bookings set status='confirmed',starts_at=p_start,ends_at=e,reserved_range=tstzrange(p_start,e+make_interval(mins=>c.buffer_minutes),'[)'),revision=revision+1,updated_at=now(),sync_status=case when c.calendar_mode='manual' then 'manual' else 'pending' end where id=p_id returning * into r;
 update booking_tokens set expires_at=e+interval '1 day' where booking_id=p_id;
 elsif p_action='cancel' then
 update meeting_bookings set status='cancelled',revision=revision+1,updated_at=now(),sync_status=case when sync_status='manual' then 'manual' else 'pending' end where id=p_id returning * into r;
 else raise exception 'INVALID_ACTION'; end if;
 insert into notification_jobs(resource_id,kind,channel,revision) values(r.id,'booking','owner',r.revision),(r.id,'booking','attendee',r.revision),(r.id,'booking','calendar',r.revision);
 insert into website_audit(actor_id,action,resource_id) values(p_actor,'meeting_'||p_action,r.id::text);
 return jsonb_build_object('id',r.id,'accepted',true);
 end $$;
create function public.website_rate_check(p_bucket text,p_limit int) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
 declare n int; begin
 insert into website_rate_limits(bucket,hits,expires_at) values(p_bucket,1,now()+interval '10 minutes') on conflict(bucket) do update
 set hits=case when website_rate_limits.expires_at<now() then 1 else website_rate_limits.hits+1 end,
 expires_at=case when website_rate_limits.expires_at<now() then now()+interval '10 minutes' else website_rate_limits.expires_at end returning hits into n;
 delete from website_rate_limits where expires_at<now()-interval '1 hour';
 return n<=p_limit; end $$;
create function public.website_save_settings(p jsonb,p_hours jsonb,p_blocks jsonb,p_actor uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 begin perform pg_advisory_xact_lock(70707);
 if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'INVALID_TIMEZONE'; end if;
 if (p->>'enabled')::boolean and (length(trim(coalesce(p->>'location','')))=0 or jsonb_array_length(p_hours)=0 or p->>'calendar_mode'='unconfigured' or (p->>'calendar_mode'='manual' and not coalesce((p->>'manual_acknowledged')::boolean,false))) then raise exception 'INCOMPLETE_CONFIGURATION'; end if;
 update meeting_settings set enabled=(p->>'enabled')::boolean,timezone=p->>'timezone',duration_minutes=(p->>'duration_minutes')::int,buffer_minutes=(p->>'buffer_minutes')::int,notice_hours=(p->>'notice_hours')::int,horizon_days=(p->>'horizon_days')::int,location=p->>'location',calendar_mode=p->>'calendar_mode',manual_acknowledged=(p->>'manual_acknowledged')::boolean,updated_at=now();
 delete from meeting_hours; insert into meeting_hours(weekday,starts,ends) select weekday,starts,ends from jsonb_to_recordset(p_hours) as x(weekday int,starts time,ends time);
 delete from meeting_blocks; insert into meeting_blocks(starts_at,ends_at) select starts_at,ends_at from jsonb_to_recordset(p_blocks) as x(starts_at timestamptz,ends_at timestamptz);
 insert into website_audit(actor_id,action,resource_id) values(p_actor,'availability_update','settings');
 end $$;
create function public.website_claim_jobs() returns setof notification_jobs language plpgsql security definer set search_path=public,pg_temp as $$
 declare resource uuid; begin
 -- Claim a whole resource together so two workers cannot split its calendar/email jobs.
 perform pg_advisory_xact_lock(70709);
 select j.resource_id into resource from notification_jobs j where
 (j.status in ('pending','failed') or (j.status='processing' and j.lease_until<now()))
 and j.next_attempt_at<=now() and j.attempts<8
 and not exists(select 1 from notification_jobs active where active.resource_id=j.resource_id and active.status='processing' and active.lease_until>now())
 order by j.created_at limit 1;
 return query update notification_jobs set status='processing',attempts=attempts+1,lease_until=now()+interval '3 minutes' where resource_id=resource
 and (status in ('pending','failed') or (status='processing' and lease_until<now())) and next_attempt_at<=now() and attempts<8 returning *;
 end $$;
create function public.website_message_status(p_id uuid,p_status text,p_actor uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 begin update contact_messages set status=p_status where id=p_id; if not found then raise exception 'NOT_FOUND'; end if;
 insert into website_audit(actor_id,action,resource_id) values(p_actor,'message_'||p_status,p_id::text); end $$;
create function public.website_retry_job(p_id uuid,p_actor uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 begin update notification_jobs set status='pending',attempts=0,next_attempt_at=now(),lease_until=null where id=p_id and status='failed' and coalesce(last_error,'')<>'DELIVERY_REVIEW_REQUIRED';
 if not found then raise exception 'NOT_RETRYABLE'; end if;
 insert into website_audit(actor_id,action,resource_id) values(p_actor,'notification_retry',p_id::text); end $$;
-- API functions are exclusively callable by the server. Table policies alone do not secure RPCs.
do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'website_%' and p.proname<>'website_owner' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop; end $$;
