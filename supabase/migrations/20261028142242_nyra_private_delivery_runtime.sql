begin;
-- PREPARED ONLY: no production application or Data API/Edge activation.
-- Existing Phase 2 decisions/releases remain immutable intent evidence.
create schema nyra_delivery;
revoke all on schema nyra_delivery from public,anon,authenticated;
grant usage on schema nyra_delivery to service_role;
create table nyra_delivery.control(
 singleton boolean primary key default true check(singleton), owner_id uuid not null references auth.users(id),
 source_generation bigint not null, baseline jsonb not null, history jsonb not null default '[]', mappings jsonb not null default '[]',
 verified_candidate uuid, observed_candidate uuid, fence bigint not null default 0 check(fence between 0 and 9007199254740991),
 lease_attempt uuid, lease_until timestamptz, blocked boolean not null default false
);
create table nyra_delivery.intents(
 decision_id uuid primary key references public.nyra_publication_decisions(id), event_id uuid not null unique references public.nyra_publication_events(id),
 source_generation bigint not null unique, intent jsonb not null, enqueued_at timestamptz not null default clock_timestamp()
);
create table nyra_delivery.attempts(
 id uuid primary key, run_id text not null, run_attempt text not null, check_run_id text not null,
 code_sha text not null check(code_sha~'^[a-f0-9]{40}$'), state text not null check(state in('registered','leased','materialized','exported','permitted','deploying','unknown','never_deployed','verified','failed','timing_exception')),
 fence bigint, candidate_id uuid, created_at timestamptz not null default clock_timestamp(),
 unique(run_id,run_attempt,check_run_id)
);
create table nyra_delivery.candidates(
 id uuid primary key, attempt_id uuid not null unique references nyra_delivery.attempts(id), fence bigint not null,
 source_generation bigint not null, manifest_sha256 text not null check(manifest_sha256~'^[a-f0-9]{64}$'),
 candidate jsonb not null, transition_sha256 text not null check(transition_sha256~'^[a-f0-9]{64}$'), intent_ids uuid[] not null, created_at timestamptz not null default clock_timestamp()
);
create table nyra_delivery.replays(
 jti text primary key, attempt_id uuid not null references nyra_delivery.attempts(id), expires_at timestamptz not null,
 consumed_at timestamptz not null default clock_timestamp()
);
create table nyra_delivery.artifacts(
 id uuid primary key, candidate_id uuid not null unique references nyra_delivery.candidates(id), attempt_id uuid not null references nyra_delivery.attempts(id),
 fence bigint not null, artifact_sha256 text not null check(artifact_sha256~'^[a-f0-9]{64}$'), observation jsonb not null, created_at timestamptz not null default clock_timestamp()
);
create table nyra_delivery.permits(
 id uuid primary key, candidate_id uuid not null references nyra_delivery.candidates(id), attempt_id uuid not null references nyra_delivery.attempts(id),
 fence bigint not null, code_sha text not null, manifest_sha256 text not null, artifact_sha256 text not null, expires_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp(), unique(attempt_id)
);
create table nyra_delivery.observations(
 id uuid primary key, attempt_id uuid not null references nyra_delivery.attempts(id), kind text not null,
 observation jsonb not null, observed_at timestamptz not null default clock_timestamp()
);
create table nyra_delivery.receipts(
 id uuid primary key, candidate_id uuid not null references nyra_delivery.candidates(id), attempt_id uuid not null unique references nyra_delivery.attempts(id),
 receipt jsonb not null, transition_sha256 text not null check(transition_sha256~'^[a-f0-9]{64}$'), created_at timestamptz not null default clock_timestamp()
);
create table nyra_delivery.completed_intents(
 decision_id uuid primary key references nyra_delivery.intents(decision_id), receipt_id uuid not null references nyra_delivery.receipts(id)
);
create table nyra_delivery.asset_links(
 asset_id uuid primary key references public.nyra_publication_assets(id), owner_id uuid not null references auth.users(id),
 object_key text not null check(object_key~'^sha256/[a-f0-9]{64}$'), asset_sha256 text not null check(asset_sha256~'^[a-f0-9]{64}$'),
 cover_sha256 text not null check(cover_sha256~'^[a-f0-9]{64}$'), created_at timestamptz not null default clock_timestamp()
);
do $$ declare t text; begin
 foreach t in array array['control','intents','attempts','candidates','replays','artifacts','permits','observations','receipts','completed_intents','asset_links'] loop
  execute format('alter table nyra_delivery.%I enable row level security',t);
  execute format('revoke all on nyra_delivery.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert on nyra_delivery.%I to service_role',t);
  if t not in ('control','attempts') then execute format('create trigger immutable before update or delete on nyra_delivery.%I for each row execute function public.nyra_publication_immutable()',t); end if;
 end loop;
end $$;
grant update(source_generation,baseline,history,mappings,verified_candidate,observed_candidate,fence,lease_attempt,lease_until,blocked) on nyra_delivery.control to service_role;
grant update(state,fence,candidate_id) on nyra_delivery.attempts to service_role;

-- Bootstrap must be called only by the private verified operator adapter with
-- an explicitly observed empty initial baseline. No fabricated success receipt.
create function public.nyra_delivery_bootstrap(p_owner uuid,p_session uuid,p_expires timestamptz,p_baseline jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,public,nyra_delivery as $$
declare catalog public.nyra_publication_catalog;
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);
 select * into strict catalog from public.nyra_publication_catalog where singleton and owner_id=p_owner;
 if jsonb_typeof(p_baseline) is distinct from 'object' or p_baseline->'releases' is distinct from '[]'::jsonb or p_baseline#>>'{manifest,generation}' is distinct from '1' or p_baseline#>'{manifest,previous_manifest_sha256}' is distinct from 'null'::jsonb then raise exception 'DELIVERY_BOOTSTRAP'; end if;
 insert into nyra_delivery.control(owner_id,source_generation,baseline) values(p_owner,(catalog.desired_manifest->>'generation')::bigint,p_baseline);
end $$;

-- Pull only actual Phase 2 persisted decisions; clients cannot supply intent JSON.
create function public.nyra_delivery_enqueue() returns integer language plpgsql security invoker set search_path=pg_catalog,public,nyra_delivery as $$
declare c nyra_delivery.control; n integer;
begin
 perform 1 from public.nyra_publication_catalog where singleton for update;
 select * into strict c from nyra_delivery.control where singleton for update;
 insert into nyra_delivery.intents(decision_id,event_id,source_generation,intent)
 select d.id,e.id,e.generation,jsonb_build_object('decision_id',d.id,'decision_authorization_id',d.authorization_id,'approved_payload_sha256',d.approved_payload_sha256,
 'human_approved_at',to_char(d.human_approved_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'publication_authorized_at',to_char(d.publication_authorized_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'event',e.event,'release',r.snapshot,'target_snapshot',target.snapshot)
 from public.nyra_publication_decisions d join public.nyra_publication_events e on e.decision_id=d.id
 join public.nyra_publication_outbox o on o.event_id=e.id and o.status='held'
 left join public.nyra_publication_releases r on r.decision_id=d.id
 left join public.nyra_publication_releases target on target.id=(e.event->>'target_release_id')::uuid
 where d.owner_id=c.owner_id order by e.generation on conflict(decision_id) do nothing;
 get diagnostics n=row_count;
 update nyra_delivery.control set source_generation=(select (desired_manifest->>'generation')::bigint from public.nyra_publication_catalog where singleton and owner_id=c.owner_id) where singleton;
 return n;
end $$;
create function public.nyra_delivery_register(p_id uuid,p_run text,p_attempt text,p_check text,p_sha text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,nyra_delivery as $$
declare a nyra_delivery.attempts;
begin
 if p_run!~'^[1-9][0-9]{0,19}$' or p_attempt!~'^[1-9][0-9]{0,19}$' or p_check!~'^[1-9][0-9]{0,19}$' then raise exception 'DELIVERY_RUN'; end if;
 insert into nyra_delivery.attempts values(p_id,p_run,p_attempt,p_check,p_sha,'registered',null,null,clock_timestamp()) on conflict(id) do nothing;
 select * into strict a from nyra_delivery.attempts where id=p_id;
 if a.run_id<>p_run or a.run_attempt<>p_attempt or a.check_run_id<>p_check or a.code_sha<>p_sha then raise exception 'DELIVERY_IDENTITY'; end if;
 return to_jsonb(a);
end $$;
create function public.nyra_delivery_claim(p_id uuid,p_seconds integer default 120)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,nyra_delivery as $$
declare c nyra_delivery.control; a nyra_delivery.attempts; pending jsonb; private_history jsonb;
begin
 if p_seconds is null or p_seconds<1 or p_seconds>300 then raise exception 'DELIVERY_LEASE'; end if;
 perform public.nyra_delivery_enqueue();
 select * into strict c from nyra_delivery.control where singleton for update;
 select * into strict a from nyra_delivery.attempts where id=p_id for update;
 if c.blocked then raise exception 'DELIVERY_RECONCILIATION_REQUIRED'; end if;
 -- Completed owner decisions remain private evidence even when never delivered.
 select coalesce(jsonb_agg(i.intent order by i.source_generation),'[]'::jsonb) into private_history from nyra_delivery.intents i where exists(select 1 from nyra_delivery.completed_intents d where d.decision_id=i.decision_id);
 if c.lease_attempt=p_id and c.lease_until>clock_timestamp() and a.state in('leased','materialized','exported','permitted') then
  select coalesce(jsonb_agg(i.intent order by i.source_generation),'[]'::jsonb) into pending from nyra_delivery.intents i where not exists(select 1 from nyra_delivery.completed_intents d where d.decision_id=i.decision_id);
  return jsonb_build_object('fence',c.fence,'existing',(select candidate from nyra_delivery.candidates where attempt_id=p_id),'baseline',c.baseline,'history',c.history,'heldMappings',c.mappings,'intentHistory',private_history,'intents',pending,'source_generation',c.source_generation);
 end if;
 if a.state<>'registered' then raise exception 'DELIVERY_ATTEMPT_STATE'; end if;
 if c.lease_attempt is not null then
  -- Expiration alone is NOT evidence a previous build never deployed.
  if c.lease_until>clock_timestamp() then raise exception 'DELIVERY_LEASE_BUSY'; end if;
  update nyra_delivery.control set blocked=true where singleton;
  return jsonb_build_object('reconciliation_required',true);
 end if;
 update nyra_delivery.control set fence=fence+1,lease_attempt=p_id,lease_until=clock_timestamp()+make_interval(secs=>p_seconds) where singleton returning * into c;
 update nyra_delivery.attempts set state='leased',fence=c.fence where id=p_id;
 select coalesce(jsonb_agg(i.intent order by i.source_generation),'[]'::jsonb) into pending from nyra_delivery.intents i where not exists(select 1 from nyra_delivery.completed_intents d where d.decision_id=i.decision_id);
 return jsonb_build_object('fence',c.fence,'baseline',c.baseline,'history',c.history,'heldMappings',c.mappings,'intentHistory',private_history,'intents',pending,'source_generation',c.source_generation);
end $$;
create function public.nyra_delivery_materialized(p_attempt uuid,p_fence bigint,p_id uuid,p_source bigint,p_candidate jsonb,p_sha text,p_transition_sha text,p_intents uuid[])
returns void language plpgsql security invoker set search_path=pg_catalog,nyra_delivery as $$
declare c nyra_delivery.control; a nyra_delivery.attempts; expected uuid[];
begin
 select * into strict c from nyra_delivery.control where singleton for update;
 select * into strict a from nyra_delivery.attempts where id=p_attempt for update;
 if c.blocked or c.lease_attempt is distinct from p_attempt or c.fence is distinct from p_fence or a.fence is distinct from p_fence or c.lease_until<=clock_timestamp() or a.state<>'leased' or c.source_generation is distinct from p_source then raise exception 'DELIVERY_STALE'; end if;
 select coalesce(array_agg(i.decision_id order by i.source_generation),'{}') into expected from nyra_delivery.intents i where not exists(select 1 from nyra_delivery.completed_intents d where d.decision_id=i.decision_id);
 if p_intents is distinct from expected or p_candidate#>'{transition,previous}' is distinct from c.baseline then raise exception 'DELIVERY_SCOPE'; end if;
 insert into nyra_delivery.candidates values(p_id,p_attempt,p_fence,p_source,p_sha,p_candidate,p_transition_sha,p_intents,clock_timestamp());
 update nyra_delivery.attempts set state='materialized',candidate_id=p_id where id=p_attempt;
end $$;

-- Artifact byte digest is recorded by the trusted build/attestation adapter,
-- not by browser JSON. No active endpoint invokes this in Phase 4B.
create function public.nyra_delivery_artifact(p_attempt uuid,p_fence bigint,p_candidate uuid,p_id uuid,p_digest text,p_observation jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,nyra_delivery as $$
declare c nyra_delivery.control; a nyra_delivery.attempts; candidate nyra_delivery.candidates;
begin
 select * into strict c from nyra_delivery.control where singleton for update;
 select * into strict a from nyra_delivery.attempts where id=p_attempt for update;
 if c.blocked or c.lease_attempt is distinct from a.id or c.fence is distinct from p_fence or a.candidate_id is distinct from p_candidate or c.lease_until<=clock_timestamp() or a.state<>'exported' then raise exception 'DELIVERY_ARTIFACT_SCOPE'; end if;
 select * into strict candidate from nyra_delivery.candidates where id=p_candidate;
 if p_observation->>'manifest_sha256' is distinct from candidate.manifest_sha256 or p_observation->>'code_sha' is distinct from a.code_sha then raise exception 'DELIVERY_ARTIFACT_BINDING'; end if;
 insert into nyra_delivery.artifacts values(p_id,p_candidate,p_attempt,p_fence,p_digest,p_observation,clock_timestamp());
end $$;

-- Single transaction for replay consumption, run/attempt correlation and fencing.
create function public.nyra_delivery_machine(p_run text,p_attempt text,p_check text,p_sha text,p_jti text,p_expires timestamptz,p_operation text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,nyra_delivery as $$
declare c nyra_delivery.control; a nyra_delivery.attempts; candidate nyra_delivery.candidates; permit nyra_delivery.permits; artifact nyra_delivery.artifacts;
begin
 perform public.nyra_delivery_enqueue(); -- detect newly authorized decisions before export/permit
 select * into strict c from nyra_delivery.control where singleton for update;
 select * into strict a from nyra_delivery.attempts where run_id=p_run and run_attempt=p_attempt and check_run_id=p_check and code_sha=p_sha for update;
 if p_expires<=clock_timestamp() or p_expires>clock_timestamp()+interval '10 minutes' or length(p_jti)<8 or length(p_jti)>200 then raise exception 'DELIVERY_TOKEN'; end if;
 if c.blocked or c.lease_attempt is distinct from a.id or c.fence is distinct from a.fence or c.lease_until<=clock_timestamp() then raise exception 'DELIVERY_STALE'; end if;
 select * into strict candidate from nyra_delivery.candidates where id=a.candidate_id and attempt_id=a.id and fence=c.fence;
 if candidate.source_generation is distinct from c.source_generation then raise exception 'DELIVERY_GENERATION'; end if;
 if p_operation is null then raise exception 'DELIVERY_ATTEMPT_STATE'; end if;
 if p_operation='export' and a.state not in('materialized','exported') or p_operation='permit' and a.state<>'exported' or p_operation not in('export','permit') then raise exception 'DELIVERY_ATTEMPT_STATE'; end if;
 insert into nyra_delivery.replays values(p_jti,a.id,p_expires,clock_timestamp());
 if p_operation='export' then update nyra_delivery.attempts set state='exported' where id=a.id;
 else
  select * into strict artifact from nyra_delivery.artifacts where candidate_id=candidate.id and attempt_id=a.id and fence=c.fence;
  insert into nyra_delivery.permits values(gen_random_uuid(),candidate.id,a.id,c.fence,a.code_sha,candidate.manifest_sha256,artifact.artifact_sha256,least(c.lease_until,clock_timestamp()+interval '60 seconds'),clock_timestamp()) returning * into permit;
  update nyra_delivery.attempts set state='permitted' where id=a.id;
 end if;
 return jsonb_build_object('candidate',candidate.candidate,'manifestSHA256',candidate.manifest_sha256,'capability',jsonb_build_object('candidate_id',candidate.id,'attempt_id',a.id,'fence',c.fence),'permit',to_jsonb(permit));
end $$;

-- These operations consume observations from an independently trusted server
-- observer. They do NOT authenticate browser/runner supplied success assertions.
create function public.nyra_delivery_reconcile(p_attempt uuid,p_observation uuid,p_kind text,p_evidence jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,nyra_delivery as $$
declare c nyra_delivery.control; a nyra_delivery.attempts;
begin
 select * into strict c from nyra_delivery.control where singleton for update;
 select * into strict a from nyra_delivery.attempts where id=p_attempt for update;
 if c.lease_attempt is distinct from a.id or a.state in('verified','never_deployed','timing_exception') then raise exception 'DELIVERY_RECONCILIATION_STATE'; end if;
 if p_kind not in('unknown','never_deployed','observed_late_live') then raise exception 'DELIVERY_OBSERVATION'; end if;
 insert into nyra_delivery.observations values(p_observation,a.id,p_kind,p_evidence,clock_timestamp());
 if p_kind='never_deployed' then
  update nyra_delivery.attempts set state='never_deployed' where id=a.id;
  update nyra_delivery.control set blocked=false,lease_attempt=null,lease_until=null where singleton;
 elsif p_kind='observed_late_live' then
  update nyra_delivery.attempts set state='timing_exception' where id=a.id;
  update nyra_delivery.control set blocked=true,observed_candidate=a.candidate_id where singleton;
 else
  update nyra_delivery.attempts set state='unknown' where id=a.id;
  update nyra_delivery.control set blocked=true where singleton;
 end if;
end $$;
create function public.nyra_delivery_receipt(p_attempt uuid,p_id uuid,p_receipt jsonb,p_transition_sha text,p_evidence jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,nyra_delivery as $$
declare c nyra_delivery.control; a nyra_delivery.attempts; candidate nyra_delivery.candidates;
begin
 select * into strict c from nyra_delivery.control where singleton for update;
 select * into strict a from nyra_delivery.attempts where id=p_attempt for update;
 select * into strict candidate from nyra_delivery.candidates where id=a.candidate_id and attempt_id=a.id and fence=a.fence;
 -- Bound at validated server-side materialization, never established by receipt JSON.
 if p_transition_sha is distinct from candidate.transition_sha256 then raise exception 'DELIVERY_TRANSITION_BINDING'; end if;
 if exists(select 1 from nyra_delivery.receipts where attempt_id=a.id and candidate_id=candidate.id and id=p_id and receipt=p_receipt and transition_sha256=candidate.transition_sha256) then return; end if;
 if c.lease_attempt is distinct from a.id or c.fence is distinct from a.fence or a.state not in('permitted','deploying','unknown') then raise exception 'DELIVERY_RECEIPT_STATE'; end if;
 if p_receipt->>'attempt_id' is distinct from a.id::text or p_receipt->>'id' is distinct from p_id::text or p_receipt->>'manifest_id' is distinct from candidate.candidate#>>'{dataset,manifest,manifest_id}' or p_receipt->>'generation' is distinct from candidate.candidate#>>'{dataset,manifest,generation}' or p_receipt->>'status' is distinct from 'released_verified' or p_receipt->>'observed_manifest_sha256' is distinct from candidate.manifest_sha256 or p_receipt->>'manifest_sha256' is distinct from candidate.manifest_sha256 or p_receipt->>'code_sha' is distinct from a.code_sha or p_receipt->>'github_run_id' is distinct from a.run_id or p_receipt->>'github_run_attempt' is distinct from a.run_attempt then raise exception 'DELIVERY_RECEIPT_BINDING'; end if;
 insert into nyra_delivery.observations values(gen_random_uuid(),a.id,'verified_live',p_evidence,clock_timestamp());
 insert into nyra_delivery.receipts values(p_id,candidate.id,a.id,p_receipt,candidate.transition_sha256,clock_timestamp());
 insert into nyra_delivery.completed_intents select unnest(candidate.intent_ids),p_id;
 update nyra_delivery.attempts set state='verified' where id=a.id;
 update nyra_delivery.control set baseline=candidate.candidate->'dataset',history=candidate.candidate->'history',mappings=candidate.candidate->'mappings',verified_candidate=candidate.id,observed_candidate=candidate.id,lease_attempt=null,lease_until=null,blocked=false where singleton;
end $$;
create function public.nyra_delivery_link_asset(p_owner uuid,p_session uuid,p_expires timestamptz,p_asset uuid,p_hash text,p_cover_hash text)
returns void language plpgsql security invoker set search_path=pg_catalog,public,nyra_delivery as $$
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);
 if not exists(select 1 from public.nyra_publication_assets where id=p_asset and owner_id=p_owner and cover->>'sha256'=p_hash) then raise exception 'DELIVERY_ASSET'; end if;
 insert into nyra_delivery.asset_links values(p_asset,p_owner,'sha256/'||p_hash,p_hash,p_cover_hash,clock_timestamp());
end $$;

-- Private build side receives only minimal Phase 3 rights proofs for the current
-- leased candidate. Notes, sessions, evidence and unselected covers never leave.
create function public.nyra_delivery_assets(p_attempt uuid,p_fence bigint,p_candidate uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,nyra_delivery as $$
declare c nyra_delivery.control; a nyra_delivery.attempts; candidate nyra_delivery.candidates; proofs jsonb;
begin
 select * into strict c from nyra_delivery.control where singleton;
 select * into strict a from nyra_delivery.attempts where id=p_attempt;
 if c.blocked or c.lease_attempt is distinct from a.id or c.fence is distinct from p_fence or a.fence is distinct from p_fence or a.candidate_id is distinct from p_candidate or c.lease_until<=clock_timestamp() or a.state not in('exported','permitted') then raise exception 'DELIVERY_ASSET_SCOPE'; end if;
 select * into strict candidate from nyra_delivery.candidates where id=p_candidate;
 if candidate.source_generation is distinct from (select (desired_manifest->>'generation')::bigint from public.nyra_publication_catalog where singleton) then raise exception 'DELIVERY_GENERATION'; end if;
 select coalesce(jsonb_agg(distinct jsonb_build_object('decision_id',rights.id,'asset_sha256',link.asset_sha256,'cover_sha256',link.cover_sha256,'approved_by','https://eliaskalyvas.gr/#person',
 'approved_at',to_char(rights.approved_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'kind',rights.cover->>'kind','template_id',rights.cover->'template_id')),'[]'::jsonb)
 into proofs from jsonb_array_elements(candidate.candidate#>'{dataset,releases}') release
 join nyra_delivery.asset_links link on link.asset_sha256=release#>>'{presentation,cover,sha256}'
 join public.nyra_publication_assets rights on rights.id=link.asset_id and rights.owner_id=c.owner_id and rights.cover=release#>'{presentation,cover}';
 return proofs;
end $$;

do $$ declare f record; begin
 for f in select oid::regprocedure name from pg_proc where pronamespace='public'::regnamespace and proname like 'nyra_delivery_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.name);
  execute format('grant execute on function %s to service_role',f.name);
 end loop;
end $$;

commit;
