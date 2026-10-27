begin;
-- Phase 2: private storage only. Not applied to production by this change.
create table public.nyra_publication_catalog (
 singleton boolean primary key default true check(singleton), owner_id uuid not null references auth.users(id),
 desired_manifest jsonb not null, verified_live_manifest jsonb check(verified_live_manifest is null)
);
create table public.nyra_publication_articles (
 article_id uuid primary key, variant_id uuid not null unique, owner_id uuid not null references auth.users(id),
 work_id uuid not null references public.nyra_work(id), locale text not null check(locale in ('el','en')),
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), canonical_url text not null unique,
 translation_group_id uuid not null, unique(owner_id,work_id), unique(locale,slug)
);
create table public.nyra_publication_assets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), session_id uuid not null,
 cover jsonb not null, rights_note text not null check(length(rights_note) between 10 and 2000), approved_at timestamptz not null default clock_timestamp()
);
create table public.nyra_publication_previews (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), session_id uuid not null,
 work_id uuid not null references public.nyra_work(id), version integer not null check(version>=0),
 source_work jsonb not null, preview jsonb not null, created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '15 minutes'
);
create table public.nyra_publication_decisions (
 id uuid primary key default gen_random_uuid(), approval_id uuid not null unique default gen_random_uuid(), authorization_id uuid not null unique,
 owner_id uuid not null references auth.users(id), session_id uuid not null, work_id uuid not null references public.nyra_work(id), version integer not null,
 preview_id uuid not null unique references public.nyra_publication_previews(id), request_id uuid not null,
 action text not null check(action in ('publish','replace','withdraw','rollback')), approved_payload_sha256 text not null,
 human_approved_at timestamptz not null, publication_authorized_at timestamptz not null,
 result jsonb not null, unique(owner_id,request_id)
);
create table public.nyra_publication_releases (
 id uuid primary key, owner_id uuid not null references auth.users(id), article_id uuid not null references public.nyra_publication_articles(article_id),
 decision_id uuid not null references public.nyra_publication_decisions(id), snapshot jsonb not null
);
create table public.nyra_publication_manifests (
 generation bigint primary key check(generation>=1), owner_id uuid not null references auth.users(id), snapshot jsonb not null
);
create table public.nyra_publication_events (
 id uuid primary key, owner_id uuid not null references auth.users(id), decision_id uuid not null references public.nyra_publication_decisions(id),
 generation bigint not null references public.nyra_publication_manifests(generation), event jsonb not null
);
create table public.nyra_publication_outbox (
 event_id uuid primary key references public.nyra_publication_events(id), owner_id uuid not null references auth.users(id),
 status text not null default 'held' check(status='held'), delivered_at timestamptz check(delivered_at is null)
);
create function public.nyra_publication_immutable() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin raise exception 'PUB_IMMUTABLE'; end $$;
do $$ declare t text; begin
 foreach t in array array['nyra_publication_catalog','nyra_publication_articles','nyra_publication_assets','nyra_publication_previews','nyra_publication_decisions','nyra_publication_releases','nyra_publication_manifests','nyra_publication_events','nyra_publication_outbox'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert on public.%I to service_role',t);
  if t<>'nyra_publication_catalog' then
   execute format('create trigger immutable before update or delete on public.%I for each row execute function public.nyra_publication_immutable()',t);
  end if;
 end loop;
end $$;
grant update(desired_manifest) on public.nyra_publication_catalog to service_role;

grant select(id,user_id,aal,not_after) on auth.sessions to service_role;

-- Only the verified server may call these invoker RPCs. No browser role gets EXECUTE.
create function public.nyra_publication_actor(p_owner uuid,p_session uuid,p_expires timestamptz)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if p_expires is null or p_expires<=clock_timestamp() then raise exception 'PUB_SESSION_INVALID'; end if;
 if not exists(select 1 from public.website_owners where user_id=p_owner) then raise exception 'PUB_FORBIDDEN'; end if;
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_owner and aal::text='aal2' and (not_after is null or not_after>clock_timestamp())) then raise exception 'PUB_SESSION_INVALID'; end if;
end $$;
create function public.nyra_publication_time() returns text language sql volatile security invoker set search_path=pg_catalog as $$
 select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;
create function public.nyra_publication_context(p_owner uuid,p_session uuid,p_expires timestamptz,p_work uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare w public.nyra_work; c public.nyra_publication_catalog; m jsonb; clock text;
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);
 select * into w from public.nyra_work where id=p_work and owner_id=p_owner;
 if not found then raise exception 'PUB_NOT_FOUND'; end if;
 clock=public.nyra_publication_time();
 m=jsonb_build_object('schema_version','nyra.publication.manifest.v1.1','authority','nyra','audience','https://eliaskalyvas.gr','manifest_id',gen_random_uuid(),'generation',1,'previous_manifest_sha256',null,'issued_at',clock,'active_releases','[]'::jsonb,'withdrawn_variants','[]'::jsonb);
 insert into public.nyra_publication_catalog(singleton,owner_id,desired_manifest) values(true,p_owner,m) on conflict do nothing;
 select * into c from public.nyra_publication_catalog where singleton;
 if c.owner_id<>p_owner then raise exception 'PUB_FORBIDDEN'; end if;
 insert into public.nyra_publication_manifests(generation,owner_id,snapshot) values(1,p_owner,c.desired_manifest) on conflict do nothing;
 return jsonb_build_object('now',clock,'work',to_jsonb(w),'manifest',c.desired_manifest,
 'articles',coalesce((select jsonb_agg(to_jsonb(a)-'owner_id') from public.nyra_publication_articles a where owner_id=p_owner),'[]'::jsonb),
 'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'cover',a.cover)) from public.nyra_publication_assets a where owner_id=p_owner),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(r.snapshot) from public.nyra_publication_releases r where owner_id=p_owner),'[]'::jsonb),
 'stale_release_ids',coalesce((select jsonb_agg(r.id) from public.nyra_publication_releases r join public.nyra_publication_decisions d on d.id=r.decision_id join public.nyra_publication_previews p on p.id=d.preview_id join public.nyra_work sw on sw.id=p.work_id where r.owner_id=p_owner and (to_jsonb(sw)<>p.source_work or sw.active_seq is not null)),'[]'::jsonb),
 'active',coalesce((select jsonb_agg(r.snapshot) from public.nyra_publication_releases r where owner_id=p_owner and exists(select 1 from jsonb_array_elements(c.desired_manifest->'active_releases') x where x->>'release_id'=r.id::text)),'[]'::jsonb));
end $$;
create function public.nyra_publication_asset(p_owner uuid,p_session uuid,p_expires timestamptz,p_cover jsonb,p_note text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare a public.nyra_publication_assets;
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);
 if p_cover->'attribution'->>'rights_confirmed' is distinct from 'true' then raise exception 'PUB_RIGHTS_REQUIRED'; end if;
 insert into public.nyra_publication_assets(owner_id,session_id,cover,rights_note) values(p_owner,p_session,p_cover,p_note) returning * into a;
 return jsonb_build_object('asset_id',a.id,'status','rights_review_recorded','publishing',false);
end $$;
-- Reserve a non-public counterpart identity without granting publication permission.
create function public.nyra_publication_identity(p_owner uuid,p_session uuid,p_expires timestamptz,p_work uuid,p_expected jsonb,p_identity jsonb,p_target uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare w public.nyra_work; c public.nyra_publication_catalog; a public.nyra_publication_articles; target public.nyra_publication_articles;
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);
 select * into c from public.nyra_publication_catalog where singleton for update;
 if c.owner_id is distinct from p_owner then raise exception 'PUB_FORBIDDEN'; end if;
 select * into w from public.nyra_work where id=p_work and owner_id=p_owner for update;
 if not found then raise exception 'PUB_NOT_FOUND'; end if;
 if to_jsonb(w) is distinct from p_expected or w.active_seq is not null then raise exception 'PUB_STALE_WORK'; end if;
 if p_target is not null then
  select * into target from public.nyra_publication_articles where variant_id=p_target and owner_id=p_owner;
  if not found or target.locale=p_identity->>'locale' or target.translation_group_id::text is distinct from p_identity->>'translation_group_id' then raise exception 'PUB_IDENTITY_CONFLICT'; end if;
 end if;
 insert into public.nyra_publication_articles(article_id,variant_id,owner_id,work_id,locale,slug,canonical_url,translation_group_id)
 values((p_identity->>'article_id')::uuid,(p_identity->>'variant_id')::uuid,p_owner,p_work,p_identity->>'locale',p_identity->>'slug',p_identity->>'canonical_url',(p_identity->>'translation_group_id')::uuid)
 on conflict(owner_id,work_id) do nothing;
 select * into a from public.nyra_publication_articles where owner_id=p_owner and work_id=p_work;
 if a.locale is distinct from p_identity->>'locale' or a.canonical_url is distinct from p_identity->>'canonical_url' or (p_target is not null and a.translation_group_id<>target.translation_group_id) then raise exception 'PUB_IDENTITY_CONFLICT'; end if;
 return (to_jsonb(a)-'owner_id')||jsonb_build_object('status','identity_reserved','publishing',false,'delivered',false);
end $$;
create function public.nyra_publication_preview(p_owner uuid,p_session uuid,p_expires timestamptz,p_work uuid,p_version integer,p_expected jsonb,p_preview jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare w public.nyra_work; c public.nyra_publication_catalog; p public.nyra_publication_previews; a jsonb; d jsonb;
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);
 select * into c from public.nyra_publication_catalog where singleton for update;
 if c.owner_id is distinct from p_owner then raise exception 'PUB_FORBIDDEN'; end if;
 select * into w from public.nyra_work where id=p_work and owner_id=p_owner for update;
 if not found then raise exception 'PUB_NOT_FOUND'; end if;
 if to_jsonb(w)<>p_expected or p_preview->'source_work'<>p_expected or w.active_seq is not null then raise exception 'PUB_STALE_WORK'; end if;
 if p_version<0 or p_version>=jsonb_array_length(w.state->'drafts') or (p_preview->>'version')::int<>p_version then raise exception 'PUB_INVALID_VERSION'; end if;
 if c.desired_manifest<>p_preview->'before'->'manifest' then raise exception 'PUB_STALE_MANIFEST'; end if;
 if p_preview->>'action' in ('publish','replace') then
  d=w.state->'drafts'->p_version;
  if w.state->>'imported'='true' or w.state->>'stage'<>'done' or p_version<>jsonb_array_length(w.state->'drafts')-1 or d->'article'->>'status'<>'pending_review' or d->'automatic_review'->>'passed' is distinct from 'true' then raise exception 'PUB_REVIEW_REQUIRED'; end if;
 end if;
 a=p_preview->'new_identity';
 if a is not null and a<>'null'::jsonb then
  insert into public.nyra_publication_articles(article_id,variant_id,owner_id,work_id,locale,slug,canonical_url,translation_group_id)
  values((a->>'article_id')::uuid,(a->>'variant_id')::uuid,p_owner,p_work,a->>'locale',a->>'slug',a->>'canonical_url',(a->>'translation_group_id')::uuid);
 end if;
 if not exists(select 1 from public.nyra_publication_articles where article_id=(p_preview->'event'->>'article_id')::uuid and owner_id=p_owner) then raise exception 'PUB_UNKNOWN_ARTICLE'; end if;
 insert into public.nyra_publication_previews(owner_id,session_id,work_id,version,source_work,preview)
 values(p_owner,p_session,p_work,p_version,p_expected,p_preview) returning * into p;
 return jsonb_build_object('id',p.id,'expires_at',p.expires_at);
end $$;
create function public.nyra_publication_confirmation(p_owner uuid,p_session uuid,p_expires timestamptz,p_preview uuid,p_request uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare p public.nyra_publication_previews; d public.nyra_publication_decisions;
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);
 select * into d from public.nyra_publication_decisions where owner_id=p_owner and request_id=p_request;
 if found then
  if d.preview_id<>p_preview then raise exception 'PUB_IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('result',d.result);
 end if;
 select * into p from public.nyra_publication_previews where id=p_preview and owner_id=p_owner;
 if not found then raise exception 'PUB_NOT_FOUND'; end if;
 if p.expires_at<=clock_timestamp() then raise exception 'PUB_PREVIEW_EXPIRED'; end if;
 return jsonb_build_object('preview',p.preview,'now',public.nyra_publication_time());
end $$;
create function public.nyra_publication_commit(p_owner uuid,p_session uuid,p_expires timestamptz,p_preview uuid,p_request uuid,p_candidate jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare p public.nyra_publication_previews; c public.nyra_publication_catalog; w public.nyra_work;
 d public.nyra_publication_decisions; r jsonb; e jsonb; m jsonb; result jsonb; decision_id uuid=gen_random_uuid(); normalized jsonb; item jsonb; expected_item jsonb; normalized_items jsonb;
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);
 select * into c from public.nyra_publication_catalog where singleton for update;
 if c.owner_id is distinct from p_owner then raise exception 'PUB_FORBIDDEN'; end if;
 select * into d from public.nyra_publication_decisions where owner_id=p_owner and request_id=p_request;
 if found then
  if d.preview_id<>p_preview then raise exception 'PUB_IDEMPOTENCY_CONFLICT'; end if;
  return d.result;
 end if;
 -- Catalog lock serializes all decisions; the preview is immutable and needs no UPDATE grant.
 select * into p from public.nyra_publication_previews where id=p_preview and owner_id=p_owner;
 if not found then raise exception 'PUB_NOT_FOUND'; end if;
 if p.expires_at<=clock_timestamp() then raise exception 'PUB_PREVIEW_EXPIRED'; end if;
 if exists(select 1 from public.nyra_publication_decisions where preview_id=p_preview) then raise exception 'PUB_PREVIEW_CONSUMED'; end if;
 select * into w from public.nyra_work where id=p.work_id and owner_id=p_owner for update;
 if not found then raise exception 'PUB_NOT_FOUND'; end if;
 if to_jsonb(w)<>p.source_work or w.active_seq is not null then raise exception 'PUB_STALE_WORK'; end if;
 if c.desired_manifest<>p.preview->'before'->'manifest' then raise exception 'PUB_STALE_MANIFEST'; end if;
 -- Every approved field must be byte-equivalent as JSON to the stored preview.
 -- The verified server may only finalize audit/issue times and their dependent reference hashes.
 if (p_candidate-array['release','event','after'])<>(p.preview-array['release','event','after']) then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
 r=p_candidate->'release'; e=p_candidate->'event'; m=p_candidate->'after'->'manifest';
 if jsonb_typeof(r) is distinct from jsonb_typeof(p.preview->'release') then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
 if (e-array['authorized_at','new_release'])<>((p.preview->'event')-array['authorized_at','new_release']) then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
 if r<>'null'::jsonb then
  if (r-array['authorization','release'])<>((p.preview->'release')-array['authorization','release']) or
     ((r->'authorization')-array['human_approved_at','publication_authorized_at'])<>((p.preview->'release'->'authorization')-array['human_approved_at','publication_authorized_at']) or
     ((r->'release')-array['release_issued_at','modified_at','first_published_at'])<>((p.preview->'release'->'release')-array['release_issued_at','modified_at','first_published_at']) then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
  if e->>'action'<>'publish' and r->'release'->>'first_published_at'<>p.preview->'release'->'release'->>'first_published_at' then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
 end if;
 if (m->>'generation')::bigint<>(c.desired_manifest->>'generation')::bigint+1 or
    (m-array['issued_at','active_releases','withdrawn_variants'])<>((p.preview->'after'->'manifest')-array['issued_at','active_releases','withdrawn_variants']) then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
 -- Recheck the entire candidate export. Only the selected release's finalized
 -- timestamps and dependent reference hash may differ from the immutable preview.
 normalized_items='[]'::jsonb;
 for item in select value from jsonb_array_elements(p_candidate->'after'->'releases') loop
  if r<>'null'::jsonb and item->'release'->>'id'=r->'release'->>'id' then
   if item is distinct from r then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
   normalized_items=normalized_items||jsonb_build_array(p.preview->'release');
  else normalized_items=normalized_items||jsonb_build_array(item); end if;
 end loop;
 if normalized_items is distinct from p.preview->'after'->'releases' then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
 normalized=m; normalized_items='[]'::jsonb;
 for item in select value from jsonb_array_elements(m->'active_releases') loop
  if r<>'null'::jsonb and item->>'release_id'=r->'release'->>'id' then
   select value into expected_item from jsonb_array_elements(p.preview->'after'->'manifest'->'active_releases') where value->>'release_id'=item->>'release_id';
   if (item-'release_sha256') is distinct from (expected_item-'release_sha256') then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
   normalized_items=normalized_items||jsonb_build_array(expected_item);
  else normalized_items=normalized_items||jsonb_build_array(item); end if;
 end loop;
 normalized=jsonb_set(normalized,'{active_releases}',normalized_items);
 normalized_items='[]'::jsonb;
 for item in select value from jsonb_array_elements(m->'withdrawn_variants') loop
  if item->>'event_id'=e->>'id' then
   if item->>'withdrawn_at' is distinct from e->>'authorized_at' then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
   item=jsonb_set(item,'{withdrawn_at}',p.preview->'event'->'authorized_at');
  end if;
  normalized_items=normalized_items||jsonb_build_array(item);
 end loop;
 normalized=jsonb_set(normalized,'{withdrawn_variants}',normalized_items);
 normalized=jsonb_set(normalized,'{issued_at}',p.preview->'after'->'manifest'->'issued_at');
 if normalized is distinct from p.preview->'after'->'manifest' then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
 if r<>'null'::jsonb and (r->'authorization'->>'human_approved_at' is distinct from e->>'authorized_at' or r->'authorization'->>'publication_authorized_at' is distinct from e->>'authorized_at' or r->'release'->>'release_issued_at' is distinct from e->>'authorized_at' or r->'release'->>'modified_at' is distinct from e->>'authorized_at') then raise exception 'PUB_PREVIEW_MISMATCH'; end if;
 if abs(extract(epoch from (clock_timestamp()-(e->>'authorized_at')::timestamptz)))>30 then raise exception 'PUB_STALE_CONFIRMATION'; end if;
 result=jsonb_build_object('decision_id',decision_id,'authorization_id',e->>'authorization_id','release_id',r->'release'->>'id','manifest_generation',m->'generation','status','authorized_held','delivered',false,'publishing',false);
 insert into public.nyra_publication_decisions(id,authorization_id,owner_id,session_id,work_id,version,preview_id,request_id,action,approved_payload_sha256,human_approved_at,publication_authorized_at,result)
 values(decision_id,(e->>'authorization_id')::uuid,p_owner,p_session,p.work_id,p.version,p_preview,p_request,e->>'action',p.preview->>'approved_payload_sha256',(e->>'authorized_at')::timestamptz,(e->>'authorized_at')::timestamptz,result);
 if r<>'null'::jsonb then
  insert into public.nyra_publication_releases(id,owner_id,article_id,decision_id,snapshot) values((r->'release'->>'id')::uuid,p_owner,(r->>'article_id')::uuid,decision_id,r);
 end if;
 insert into public.nyra_publication_manifests(generation,owner_id,snapshot) values((m->>'generation')::bigint,p_owner,m);
 insert into public.nyra_publication_events(id,owner_id,decision_id,generation,event) values((e->>'id')::uuid,p_owner,decision_id,(m->>'generation')::bigint,e);
 insert into public.nyra_publication_outbox(event_id,owner_id) values((e->>'id')::uuid,p_owner);
 update public.nyra_publication_catalog set desired_manifest=m where singleton;
 return result;
end $$;
-- Explicit RPC ACLs; no SECURITY DEFINER and no authenticated/browser entry point.
do $$ declare r record; begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'nyra_publication_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',r.signature);
  execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end $$;
commit;
