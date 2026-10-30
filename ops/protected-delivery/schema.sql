-- ISOLATED PROPOSAL, NOT A PRODUCTION MIGRATION. No grants to Supabase roles.
begin;
create role nyra_trust_registrar nologin;
create role nyra_trust_broker nologin;
create schema nyra_trust;
revoke all on schema nyra_trust from public;
grant usage on schema nyra_trust to nyra_trust_registrar,nyra_trust_broker;
create table nyra_trust.jobs(
 run_id text not null check(run_id~'^[1-9][0-9]{0,19}$'),
 run_attempt text not null check(run_attempt~'^[1-9][0-9]{0,19}$'),
 check_run_id text not null check(check_run_id~'^[1-9][0-9]{0,19}$'),
 registration jsonb not null,policy_sha256 text not null check(policy_sha256~'^[a-f0-9]{64}$'),
 expires_at timestamptz not null,revoked_at timestamptz,created_at timestamptz not null default clock_timestamp(),
 primary key(run_id,run_attempt,check_run_id),
 check(coalesce(registration->>'runId'=run_id and registration->>'runAttempt'=run_attempt and registration->>'checkRunId'=check_run_id,false)),
 check(coalesce(registration->>'privilege' in('build','inspection','publication'),false)),
 check(expires_at<=created_at+interval '10 minutes')
);
create table nyra_trust.used_tokens(
 jti text primary key check(length(jti) between 8 and 200),
 run_id text not null,run_attempt text not null,check_run_id text not null,expires_at timestamptz not null,
 foreign key(run_id,run_attempt,check_run_id) references nyra_trust.jobs
);
create table nyra_trust.inventories(
 code_sha text not null check(code_sha~'^[a-f0-9]{40}$'),
 configuration_sha256 text not null check(configuration_sha256~'^[a-f0-9]{64}$'),
 digest text not null check(digest~'^[a-f0-9]{64}$'),record jsonb not null,
 primary key(code_sha,configuration_sha256)
);
create function nyra_trust.immutable() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' or tg_table_name<>'jobs' then raise exception 'TRUST_IMMUTABLE';end if;
 if old.revoked_at is not null or new.revoked_at is null or (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at') then raise exception 'TRUST_IMMUTABLE';end if;
 return new;
end $$;
revoke all on function nyra_trust.immutable() from public;
do $$declare t text;begin
 foreach t in array array['jobs','used_tokens','inventories'] loop
  execute format('alter table nyra_trust.%I enable row level security',t);
  execute format('alter table nyra_trust.%I force row level security',t);
  execute format('create trigger immutable before update or delete on nyra_trust.%I for each row execute function nyra_trust.immutable()',t);
 end loop;
end $$;
grant select,insert on nyra_trust.jobs,nyra_trust.inventories to nyra_trust_registrar;
grant update(revoked_at) on nyra_trust.jobs to nyra_trust_registrar;
grant select on nyra_trust.jobs,nyra_trust.inventories to nyra_trust_broker;
-- PostgreSQL row-lock privilege only. RLS WITH CHECK(false) and immutable
-- trigger independently deny every actual broker UPDATE.
grant update(run_id) on nyra_trust.jobs to nyra_trust_broker;
grant select,insert on nyra_trust.used_tokens to nyra_trust_broker;
create policy registrar_jobs on nyra_trust.jobs to nyra_trust_registrar using(true) with check(true);
create policy broker_jobs on nyra_trust.jobs for select to nyra_trust_broker using(true);
create policy broker_job_lock on nyra_trust.jobs for update to nyra_trust_broker using(true) with check(false);
create policy registrar_inventory on nyra_trust.inventories to nyra_trust_registrar using(true) with check(true);
create policy broker_inventory on nyra_trust.inventories for select to nyra_trust_broker using(true);
create policy broker_tokens on nyra_trust.used_tokens to nyra_trust_broker using(true) with check(true);
commit;
