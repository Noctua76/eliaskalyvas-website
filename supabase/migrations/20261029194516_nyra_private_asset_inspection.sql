begin;
-- Additive, isolated proposal only. Historical migrations/Contract v1.1 unchanged.
create schema nyra_inspection;
revoke all on schema nyra_inspection from public,anon,authenticated;
grant usage on schema nyra_inspection to service_role;
create table nyra_inspection.rights(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),session_id uuid not null,
 cover jsonb not null,note text not null check(length(note) between 10 and 2000),approved_at timestamptz not null default clock_timestamp()
);
create table nyra_inspection.uploads(
 id uuid primary key default gen_random_uuid(),rights_id uuid not null unique references nyra_inspection.rights(id),
 owner_id uuid not null,session_id uuid not null,owner_expires timestamptz not null,expires_at timestamptz not null,
 work_id uuid not null references public.nyra_work(id),version integer not null check(version>=0),presentation jsonb not null,
 presentation_sha text not null check(presentation_sha~'^[a-f0-9]{64}$'),cover_sha text not null check(cover_sha~'^[a-f0-9]{64}$'),
 asset_sha text not null check(asset_sha~'^[a-f0-9]{64}$'),byte_length bigint not null check(byte_length between 1 and 20971520),
 code_sha text not null check(code_sha~'^[a-f0-9]{40}$'),inspector_version text not null check(length(inspector_version) between 1 and 100),
 state text not null default 'preparing' check(state in('preparing','ready','processing','accepted','failed')),current_attempt uuid,cleared boolean not null default false,
 created_at timestamptz not null default clock_timestamp()
);
create table nyra_inspection.attempts(
 id uuid primary key default gen_random_uuid(),upload_id uuid not null references nyra_inspection.uploads(id),
 job_id text not null check(job_id~'^[a-f0-9]{64}$'),challenge uuid not null default gen_random_uuid(),
 lease_until timestamptz not null,state text not null default 'processing' check(state in('processing','expired','failed','accepted')),
 created_at timestamptz not null default clock_timestamp()
);
create table nyra_inspection.receipts(
 upload_id uuid primary key references nyra_inspection.uploads(id),attempt_id uuid not null unique references nyra_inspection.attempts(id),
 asset_id uuid not null unique references public.nyra_publication_assets(id),report jsonb not null,accepted_at timestamptz not null default clock_timestamp()
);
create function public.nyra_inspection_immutable() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' or tg_table_name in('rights','receipts') then raise exception 'INSPECTION_IMMUTABLE'; end if;
 if tg_table_name='uploads' and (to_jsonb(new)-array['state','current_attempt','cleared']) is distinct from (to_jsonb(old)-array['state','current_attempt','cleared']) then raise exception 'INSPECTION_IMMUTABLE'; end if;
 if tg_table_name='attempts' and (to_jsonb(new)-'state') is distinct from (to_jsonb(old)-'state') then raise exception 'INSPECTION_IMMUTABLE'; end if;
 return new;
end $$;
do $$ declare t text;begin
 foreach t in array array['rights','uploads','attempts','receipts'] loop
  execute format('alter table nyra_inspection.%I enable row level security',t);
  execute format('alter table nyra_inspection.%I force row level security',t);
  execute format('revoke all on nyra_inspection.%I from public,anon,authenticated',t);
  execute format('grant select,insert on nyra_inspection.%I to service_role',t);
  execute format('create trigger immutable before update or delete on nyra_inspection.%I for each row execute function public.nyra_inspection_immutable()',t);
 end loop;
end $$;
grant update(state,current_attempt,cleared) on nyra_inspection.uploads to service_role;
grant update(state) on nyra_inspection.attempts to service_role;
create function nyra_inspection.packet(p_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
 select jsonb_build_object('upload',to_jsonb(u)-'presentation','rights',to_jsonb(r),'attempt',to_jsonb(a),'receipt',to_jsonb(rec))
 from nyra_inspection.uploads u join nyra_inspection.rights r on r.id=u.rights_id
 left join nyra_inspection.attempts a on a.id=u.current_attempt left join nyra_inspection.receipts rec on rec.upload_id=u.id where u.id=p_id
$$;
create function nyra_inspection.require_live(p_id uuid) returns void language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
declare u nyra_inspection.uploads; w public.nyra_work;
begin
 select * into strict u from nyra_inspection.uploads where id=p_id for update;
 perform public.nyra_publication_actor(u.owner_id,u.session_id,u.owner_expires);
 if u.state<>'accepted' then
  if u.expires_at<=clock_timestamp() or u.state='failed' or u.cleared then raise exception 'INSPECTION_EXPIRED'; end if;
  select * into strict w from public.nyra_work where id=u.work_id and owner_id=u.owner_id for update;
  if jsonb_array_length(w.state->'drafts')-1<>u.version or w.state->'drafts'->u.version->'presentation' is distinct from u.presentation then raise exception 'INSPECTION_STALE_PRESENTATION'; end if;
 end if;
end $$;
create function public.nyra_inspection_begin(p_owner uuid,p_session uuid,p_expires timestamptz,p_work uuid,p_version integer,p_presentation jsonb,p_presentation_sha text,p_cover jsonb,p_cover_sha text,p_length bigint,p_note text,p_code text,p_inspector text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
declare w public.nyra_work; r uuid; u uuid;
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,91));
 if (select count(*) from nyra_inspection.uploads where owner_id=p_owner and not cleared)>=4 then raise exception 'INSPECTION_QUOTA'; end if;
 select * into strict w from public.nyra_work where id=p_work and owner_id=p_owner for update;
 if w.kind<>'article' or p_version<>jsonb_array_length(w.state->'drafts')-1 or w.state->'drafts'->p_version->'presentation' is distinct from p_presentation or jsonb_typeof(p_presentation)<>'object' then raise exception 'INSPECTION_STALE_PRESENTATION'; end if;
 if p_cover->'attribution'->>'rights_confirmed' is distinct from 'true' then raise exception 'PUB_RIGHTS_REQUIRED'; end if;
 insert into nyra_inspection.rights(owner_id,session_id,cover,note) values(p_owner,p_session,p_cover,p_note) returning id into r;
 insert into nyra_inspection.uploads(rights_id,owner_id,session_id,owner_expires,expires_at,work_id,version,presentation,presentation_sha,cover_sha,asset_sha,byte_length,code_sha,inspector_version)
 values(r,p_owner,p_session,p_expires,least(p_expires,clock_timestamp()+interval '5 minutes'),p_work,p_version,p_presentation,p_presentation_sha,p_cover_sha,p_cover->>'sha256',p_length,p_code,p_inspector) returning id into u;
 return nyra_inspection.packet(u);
end $$;
create function public.nyra_inspection_ready(p_owner uuid,p_session uuid,p_expires timestamptz,p_id uuid)
returns void language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);perform nyra_inspection.require_live(p_id);
 update nyra_inspection.uploads set state='ready' where id=p_id and owner_id=p_owner and session_id=p_session and state='preparing';
 if not found then raise exception 'INSPECTION_STATE'; end if;
end $$;
create function public.nyra_inspection_claim(p_id uuid,p_job text,p_code text,p_inspector text,p_lease integer default 60)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
declare u nyra_inspection.uploads;a nyra_inspection.attempts; aid uuid;
begin
 perform nyra_inspection.require_live(p_id);
 select * into strict u from nyra_inspection.uploads where id=p_id for update;
 if p_code<>u.code_sha or p_inspector<>u.inspector_version or p_lease not between 1 and 120 then raise exception 'INSPECTION_JOB'; end if;
 if u.state='processing' then
  select * into strict a from nyra_inspection.attempts where id=u.current_attempt for update;
  if a.lease_until>clock_timestamp() then raise exception 'INSPECTION_BUSY'; end if;
  update nyra_inspection.attempts set state='expired' where id=a.id;
 elsif u.state<>'ready' then raise exception 'INSPECTION_STATE'; end if;
 insert into nyra_inspection.attempts(upload_id,job_id,lease_until) values(p_id,p_job,least(u.expires_at,clock_timestamp()+make_interval(secs=>p_lease))) returning id into aid;
 update nyra_inspection.uploads set state='processing',current_attempt=aid where id=p_id;
 return nyra_inspection.packet(p_id);
end $$;
create function public.nyra_inspection_context(p_id uuid,p_attempt uuid,p_challenge uuid,p_job text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
declare u nyra_inspection.uploads;a nyra_inspection.attempts;
begin
 perform nyra_inspection.require_live(p_id);select * into strict u from nyra_inspection.uploads where id=p_id for update;
 select * into strict a from nyra_inspection.attempts where id=p_attempt for update;
 if u.current_attempt is distinct from a.id or a.upload_id<>u.id or a.challenge<>p_challenge or a.job_id<>p_job then raise exception 'INSPECTION_ATTEMPT'; end if;
 if u.state<>'accepted' and (u.state<>'processing' or a.state<>'processing' or a.lease_until<=clock_timestamp()) then raise exception 'INSPECTION_LEASE'; end if;
 return nyra_inspection.packet(p_id);
end $$;
create function public.nyra_inspection_complete(p_id uuid,p_attempt uuid,p_challenge uuid,p_job text,p_report jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
declare packet jsonb;u nyra_inspection.uploads;r nyra_inspection.rights;expected jsonb;rec nyra_inspection.receipts;
begin
 packet=public.nyra_inspection_context(p_id,p_attempt,p_challenge,p_job);
 select * into strict u from nyra_inspection.uploads where id=p_id;select * into strict r from nyra_inspection.rights where id=u.rights_id;
 expected=jsonb_build_object('protocol','nyra.inspection.v1','operation_id',u.id,'attempt_id',p_attempt,'challenge',p_challenge,'owner_id',u.owner_id,'rights_decision_id',r.id,'sha256',u.asset_sha,'byte_length',u.byte_length,'cover_sha256',u.cover_sha,'presentation_sha256',u.presentation_sha,'inspector_version',u.inspector_version,'code_sha',u.code_sha,'job_id',p_job,'passed',true);
 if p_report is distinct from expected then raise exception 'INSPECTION_REPORT'; end if;
 select * into rec from nyra_inspection.receipts where upload_id=u.id;
 if found then if rec.report<>p_report then raise exception 'INSPECTION_REPLAY'; end if;return jsonb_build_object('asset_id',rec.asset_id,'status','inspected_private','publishing',false);end if;
 insert into public.nyra_publication_assets(id,owner_id,session_id,cover,rights_note,approved_at) values(r.id,r.owner_id,r.session_id,r.cover,r.note,r.approved_at);
 perform public.nyra_delivery_link_asset(r.owner_id,r.session_id,u.owner_expires,r.id,u.asset_sha,u.cover_sha);
 insert into nyra_inspection.receipts(upload_id,attempt_id,asset_id,report) values(u.id,p_attempt,r.id,p_report);
 update nyra_inspection.attempts set state='accepted' where id=p_attempt;update nyra_inspection.uploads set state='accepted' where id=u.id;
 return jsonb_build_object('asset_id',r.id,'status','inspected_private','publishing',false);
end $$;
create function public.nyra_inspection_fail(p_id uuid,p_attempt uuid,p_challenge uuid,p_job text)
returns void language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
begin
 perform public.nyra_inspection_context(p_id,p_attempt,p_challenge,p_job);
 if exists(select 1 from nyra_inspection.receipts where upload_id=p_id) then raise exception 'INSPECTION_IMMUTABLE'; end if;
 update nyra_inspection.attempts set state='failed' where id=p_attempt;update nyra_inspection.uploads set state='failed' where id=p_id;
end $$;
create function public.nyra_inspection_assets(p_owner uuid,p_session uuid,p_expires timestamptz)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'cover',a.cover)) from public.nyra_publication_assets a join nyra_inspection.receipts r on r.asset_id=a.id where a.owner_id=p_owner),'[]'::jsonb);
end $$;
create function public.nyra_inspection_cleanup(p_id uuid,p_code text,p_cleared boolean default false)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
declare u nyra_inspection.uploads;
begin
 select * into strict u from nyra_inspection.uploads where id=p_id for update;
 if u.code_sha<>p_code then raise exception 'INSPECTION_JOB'; end if;
 if u.state not in('accepted','failed') and u.expires_at>clock_timestamp() and exists(select 1 from auth.sessions where id=u.session_id and user_id=u.owner_id and aal::text='aal2' and (not_after is null or not_after>clock_timestamp())) and exists(select 1 from public.website_owners where user_id=u.owner_id) then raise exception 'INSPECTION_ACTIVE'; end if;
 if p_cleared then update nyra_inspection.uploads set cleared=true where id=u.id;end if;
 return jsonb_build_object('operation_id',u.id,'cleared',p_cleared or u.cleared);
end $$;
-- Defense in depth: rights-only legacy assets cannot bypass the new acceptance.
create function public.nyra_inspection_eligibility() returns trigger language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
declare p jsonb;cov jsonb;
begin
 if tg_table_name='nyra_publication_previews' then p=new.preview;else select preview into strict p from public.nyra_publication_previews where id=new.preview_id and owner_id=new.owner_id;end if;
 if p->>'action'='withdraw' then return new;end if;
 cov=p#>'{release,presentation,cover}';
 if cov is null or not exists(select 1 from nyra_inspection.receipts r join public.nyra_publication_assets a on a.id=r.asset_id where a.owner_id=new.owner_id and a.cover=cov) then raise exception 'INSPECTION_REQUIRED';end if;
 return new;
end $$;
create trigger inspected_asset before insert on public.nyra_publication_previews for each row execute function public.nyra_inspection_eligibility();
create trigger inspected_asset before insert on public.nyra_publication_decisions for each row execute function public.nyra_inspection_eligibility();
do $$ declare f record;begin
 for f in select oid::regprocedure sig from pg_proc where pronamespace='public'::regnamespace and proname like 'nyra_inspection_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to service_role',f.sig);
 end loop;
end $$;
revoke all on all functions in schema nyra_inspection from public,anon,authenticated;
grant execute on all functions in schema nyra_inspection to service_role;
commit;
