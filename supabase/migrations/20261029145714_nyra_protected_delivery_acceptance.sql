begin;
-- PREPARED ONLY. No application to production or public Data API exposure.
create table nyra_delivery.provenance(
 candidate_id uuid primary key references nyra_delivery.candidates(id),
 attempt_id uuid not null unique references nyra_delivery.attempts(id), fence bigint not null,
 github_artifact_id text not null check(github_artifact_id~'^[1-9][0-9]*$'),
 zip_sha256 text not null check(zip_sha256~'^[a-f0-9]{64}$'),
 tar_sha256 text not null check(tar_sha256~'^[a-f0-9]{64}$'),
 inventory_sha256 text not null check(inventory_sha256~'^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp()
);
create table nyra_delivery.starts(
 attempt_id uuid primary key references nyra_delivery.attempts(id),
 permit_id uuid not null unique references nyra_delivery.permits(id),
 github_artifact_id text not null, started_at timestamptz not null default clock_timestamp()
);
alter table nyra_delivery.provenance enable row level security;
alter table nyra_delivery.starts enable row level security;
revoke all on nyra_delivery.provenance,nyra_delivery.starts from public,anon,authenticated,service_role;
grant select,insert on nyra_delivery.provenance,nyra_delivery.starts to service_role;
create trigger immutable before update or delete on nyra_delivery.provenance for each row execute function public.nyra_publication_immutable();
create trigger immutable before update or delete on nyra_delivery.starts for each row execute function public.nyra_publication_immutable();

create function public.nyra_delivery_inspect(p_run text,p_attempt text,p_check text,p_sha text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,nyra_delivery as $$
declare a nyra_delivery.attempts; c nyra_delivery.candidates;
begin
 select * into strict a from nyra_delivery.attempts where run_id=p_run and run_attempt=p_attempt and check_run_id=p_check and code_sha=p_sha;
 select * into strict c from nyra_delivery.candidates where id=a.candidate_id and attempt_id=a.id and fence=a.fence;
 return jsonb_build_object('attempt',to_jsonb(a),'candidate',c.candidate,'candidate_id',c.id,'manifest_sha256',c.manifest_sha256,'provenance',(select to_jsonb(p) from nyra_delivery.provenance p where p.attempt_id=a.id),'receipt',(select receipt from nyra_delivery.receipts where attempt_id=a.id),'started',exists(select 1 from nyra_delivery.starts where attempt_id=a.id));
end $$;

create function public.nyra_delivery_provenance(p_attempt uuid,p_candidate uuid,p_fence bigint,p_artifact text,p_zip text,p_tar text,p_inventory text)
returns void language plpgsql security invoker set search_path=pg_catalog,nyra_delivery as $$
declare c nyra_delivery.control; a nyra_delivery.attempts; v nyra_delivery.candidates;
begin
 select * into strict c from nyra_delivery.control where singleton for update;
 select * into strict a from nyra_delivery.attempts where id=p_attempt for update;
 select * into strict v from nyra_delivery.candidates where id=p_candidate and attempt_id=a.id and fence=p_fence;
 if c.blocked or c.lease_attempt is distinct from a.id or c.fence is distinct from p_fence or c.lease_until<=clock_timestamp() or a.state<>'exported' then raise exception 'PROVENANCE_SCOPE'; end if;
 if exists(select 1 from nyra_delivery.provenance where candidate_id=v.id) then
  if exists(select 1 from nyra_delivery.provenance where candidate_id=v.id and attempt_id=a.id and fence=p_fence and github_artifact_id=p_artifact and zip_sha256=p_zip and tar_sha256=p_tar and inventory_sha256=p_inventory) then return; end if;
  raise exception 'PROVENANCE_CONFLICT';
 end if;
 perform public.nyra_delivery_artifact(a.id,p_fence,v.id,gen_random_uuid(),p_inventory,jsonb_build_object('manifest_sha256',v.manifest_sha256,'code_sha',a.code_sha,'source','independent-github-archive-inspection'));
 insert into nyra_delivery.provenance(candidate_id,attempt_id,fence,github_artifact_id,zip_sha256,tar_sha256,inventory_sha256) values(v.id,a.id,p_fence,p_artifact,p_zip,p_tar,p_inventory);
end $$;

create function public.nyra_delivery_start(p_run text,p_attempt text,p_check text,p_sha text,p_jti text,p_expires timestamptz)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,nyra_delivery as $$
declare c nyra_delivery.control; a nyra_delivery.attempts; v nyra_delivery.candidates; p nyra_delivery.permits; provenance nyra_delivery.provenance;
begin
 perform public.nyra_delivery_enqueue();
 select * into strict c from nyra_delivery.control where singleton for update;
 select * into strict a from nyra_delivery.attempts where run_id=p_run and run_attempt=p_attempt and check_run_id=p_check and code_sha=p_sha for update;
 select * into strict v from nyra_delivery.candidates where id=a.candidate_id and attempt_id=a.id and fence=a.fence;
 select * into strict p from nyra_delivery.permits where attempt_id=a.id and candidate_id=v.id and fence=a.fence;
 select * into strict provenance from nyra_delivery.provenance where attempt_id=a.id and candidate_id=v.id and fence=a.fence and inventory_sha256=p.artifact_sha256;
 if p_expires is null or p_expires<=clock_timestamp() or p_expires>clock_timestamp()+interval '10 minutes' or p_jti is null or length(p_jti)<8 or length(p_jti)>200 then raise exception 'DELIVERY_TOKEN'; end if;
 if c.blocked or c.lease_attempt is distinct from a.id or c.fence is distinct from a.fence or c.lease_until<=clock_timestamp() or a.state<>'permitted' or p.expires_at<=clock_timestamp() or v.source_generation is distinct from c.source_generation then raise exception 'DEPLOYMENT_START_STALE'; end if;
 insert into nyra_delivery.replays(jti,attempt_id,expires_at) values(p_jti,a.id,p_expires);
 insert into nyra_delivery.starts(attempt_id,permit_id,github_artifact_id) values(a.id,p.id,provenance.github_artifact_id);
 update nyra_delivery.attempts set state='deploying' where id=a.id;
 return jsonb_build_object('permit',to_jsonb(p),'artifact_id',provenance.github_artifact_id,'zip_sha256',provenance.zip_sha256,'tar_sha256',provenance.tar_sha256);
end $$;

revoke all on function public.nyra_delivery_inspect(text,text,text,text),public.nyra_delivery_provenance(uuid,uuid,bigint,text,text,text,text),public.nyra_delivery_start(text,text,text,text,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.nyra_delivery_inspect(text,text,text,text),public.nyra_delivery_provenance(uuid,uuid,bigint,text,text,text,text),public.nyra_delivery_start(text,text,text,text,text,timestamptz) to service_role;

create table nyra_delivery.dispatches(
 attempt_id uuid primary key references nyra_delivery.starts(attempt_id),
 deployment_id text not null check(deployment_id~'^[1-9][0-9]*$'),
 requested_at timestamptz not null default clock_timestamp()
);
create table nyra_delivery.dispatch_acks(
 attempt_id uuid primary key references nyra_delivery.dispatches(attempt_id),
 pages_deployment_id text not null check(pages_deployment_id~'^[A-Za-z0-9_-]{1,100}$'),
 acknowledged_at timestamptz not null default clock_timestamp()
);
create table nyra_delivery.completions(
 attempt_id uuid primary key references nyra_delivery.dispatch_acks(attempt_id),
 completed_at timestamptz not null default clock_timestamp()
);
alter table nyra_delivery.dispatches enable row level security;
alter table nyra_delivery.dispatch_acks enable row level security;
alter table nyra_delivery.completions enable row level security;
revoke all on nyra_delivery.dispatches,nyra_delivery.dispatch_acks,nyra_delivery.completions from public,anon,authenticated,service_role;
grant select,insert on nyra_delivery.dispatches,nyra_delivery.dispatch_acks,nyra_delivery.completions to service_role;
create trigger immutable before update or delete on nyra_delivery.dispatches for each row execute function public.nyra_publication_immutable();
create trigger immutable before update or delete on nyra_delivery.dispatch_acks for each row execute function public.nyra_publication_immutable();
create trigger immutable before update or delete on nyra_delivery.completions for each row execute function public.nyra_publication_immutable();
create function public.nyra_delivery_dispatch(p_attempt uuid,p_operation text,p_value text default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,nyra_delivery as $$
declare a nyra_delivery.attempts; result jsonb;
begin
 select * into strict a from nyra_delivery.attempts where id=p_attempt for update;
 if p_operation='begin' then
  if a.state<>'deploying' then raise exception 'DISPATCH_STATE'; end if;
  insert into nyra_delivery.dispatches(attempt_id,deployment_id) values(a.id,p_value);
 elsif p_operation='ack' then
  if a.state<>'deploying' then raise exception 'DISPATCH_STATE'; end if;
  insert into nyra_delivery.dispatch_acks(attempt_id,pages_deployment_id) values(a.id,p_value);
 elsif p_operation='succeed' then
  insert into nyra_delivery.completions(attempt_id) values(a.id) on conflict do nothing;
 elsif p_operation<>'read' then raise exception 'DISPATCH_OPERATION'; end if;
 select jsonb_build_object('deploymentId',d.deployment_id,'pagesDeploymentId',ack.pages_deployment_id,
  'requestedAt',to_char(d.requested_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'completedAt',to_char(done.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'runId',a.run_id,'runAttempt',a.run_attempt,'checkRunId',a.check_run_id,'codeSHA',a.code_sha,
  'artifactId',s.github_artifact_id) into result
 from nyra_delivery.dispatches d join nyra_delivery.dispatch_acks ack on ack.attempt_id=d.attempt_id
 join nyra_delivery.starts s on s.attempt_id=d.attempt_id left join nyra_delivery.completions done on done.attempt_id=d.attempt_id where d.attempt_id=a.id;
 return result;
end $$;
revoke all on function public.nyra_delivery_dispatch(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.nyra_delivery_dispatch(uuid,text,text) to service_role;
create function public.nyra_delivery_pending() returns jsonb language plpgsql security invoker set search_path=pg_catalog,nyra_delivery as $$
declare a nyra_delivery.attempts;
begin
 select attempt.* into a from nyra_delivery.attempts attempt join nyra_delivery.control c on c.lease_attempt=attempt.id where c.singleton;
 if not found or a.candidate_id is null then return null; end if;
 return public.nyra_delivery_inspect(a.run_id,a.run_attempt,a.check_run_id,a.code_sha);
end $$;
revoke all on function public.nyra_delivery_pending() from public,anon,authenticated,service_role;
grant execute on function public.nyra_delivery_pending() to service_role;
create table nyra_delivery.nudges(
 id uuid primary key default gen_random_uuid(), source_generation bigint not null unique,
 requested_at timestamptz not null default clock_timestamp()
);
create table nyra_delivery.nudge_outcomes(
 nudge_id uuid primary key references nyra_delivery.nudges(id),
 outcome text not null check(outcome in('accepted','unknown')),
 recorded_at timestamptz not null default clock_timestamp()
);
alter table nyra_delivery.nudges enable row level security;
alter table nyra_delivery.nudge_outcomes enable row level security;
revoke all on nyra_delivery.nudges,nyra_delivery.nudge_outcomes from public,anon,authenticated,service_role;
grant select,insert on nyra_delivery.nudges,nyra_delivery.nudge_outcomes to service_role;
create trigger immutable before update or delete on nyra_delivery.nudges for each row execute function public.nyra_publication_immutable();
create trigger immutable before update or delete on nyra_delivery.nudge_outcomes for each row execute function public.nyra_publication_immutable();
create function public.nyra_delivery_nudge(p_operation text,p_id uuid default null,p_outcome text default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,nyra_delivery as $$
declare generation bigint; n nyra_delivery.nudges;
begin
 if p_operation='claim' then
  perform public.nyra_delivery_enqueue();
  select source_generation into strict generation from nyra_delivery.control where singleton for update;
  if not exists(select 1 from nyra_delivery.intents i where not exists(select 1 from nyra_delivery.completed_intents done where done.decision_id=i.decision_id)) then return null; end if;
  insert into nyra_delivery.nudges(source_generation) values(generation) on conflict do nothing returning * into n;
  if not found then return null; end if;return to_jsonb(n);
 elsif p_operation='outcome' then
  insert into nyra_delivery.nudge_outcomes(nudge_id,outcome) values(p_id,p_outcome);return jsonb_build_object('outcome',p_outcome);
 else raise exception 'NUDGE_OPERATION'; end if;
end $$;
revoke all on function public.nyra_delivery_nudge(text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.nyra_delivery_nudge(text,uuid,text) to service_role;
commit;
