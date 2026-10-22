begin;
create table public.nyra_work (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 title text not null, kind text not null check(kind in ('article','topics')),
 model text not null check(model in ('gpt-6.1-sol','gpt-6-astra','gpt-6-luna')),
 budget numeric(12,6) not null check(budget between 0.10 and 100), spent numeric(12,6) not null default 0,
 auto_repairs boolean not null default false, state jsonb not null, seq integer not null default 0,
 active_seq integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index nyra_work_owner_created on public.nyra_work(owner_id,created_at desc);
create table public.nyra_steps (
 work_id uuid not null references public.nyra_work(id), seq integer not null, stage text not null,
 model text not null, reserved numeric(12,6) not null, cost numeric(12,6), usage jsonb,
 status text not null default 'running', error text, created_at timestamptz not null default now(),
 primary key(work_id,seq)
);
alter table public.nyra_work enable row level security;
alter table public.nyra_steps enable row level security;
revoke all on public.nyra_work, public.nyra_steps from public,anon,authenticated;
grant select,insert,update on public.nyra_work,public.nyra_steps to service_role;

create function public.nyra_begin_step(p_id uuid,p_owner uuid,p_seq integer,p_stage text,p_reserve numeric)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare w public.nyra_work;
begin
 select * into w from public.nyra_work where id=p_id and owner_id=p_owner for update;
 if not found then return 'NOT_FOUND'; end if;
 if w.active_seq is not null then return 'WORK_BUSY'; end if;
 if w.seq<>p_seq then return 'STALE_STEP'; end if;
 if p_reserve<0 or w.spent+p_reserve>w.budget then return 'BUDGET_EXCEEDED'; end if;
 insert into public.nyra_steps(work_id,seq,stage,model,reserved) values(p_id,p_seq,p_stage,w.model,p_reserve);
 update public.nyra_work set active_seq=p_seq,spent=spent+p_reserve,updated_at=now() where id=p_id;
 return 'OK';
end $$;
create function public.nyra_finish_step(p_id uuid,p_owner uuid,p_seq integer,p_state jsonb,p_cost numeric,p_usage jsonb,p_error text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare w public.nyra_work; s public.nyra_steps;
begin
 select * into w from public.nyra_work where id=p_id and owner_id=p_owner for update;
 if not found or w.active_seq is distinct from p_seq then return false; end if;
 select * into s from public.nyra_steps where work_id=p_id and seq=p_seq;
 update public.nyra_steps set cost=p_cost,usage=p_usage,error=p_error,status=case when p_cost is null then 'unknown_cost' when p_error is null then 'completed' else 'failed' end where work_id=p_id and seq=p_seq;
 update public.nyra_work set state=p_state,spent=spent-s.reserved+coalesce(p_cost,s.reserved),active_seq=null,seq=seq+1,updated_at=now() where id=p_id;
 return true;
end $$;
-- Row lock prevents lost settings updates or changing model while a request is executing.
create function public.nyra_update_work(p_id uuid,p_owner uuid,p_model text,p_budget numeric,p_auto boolean,p_resume boolean)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare w public.nyra_work;
begin
 select * into w from public.nyra_work where id=p_id and owner_id=p_owner for update;
 if not found or w.active_seq is not null then return false; end if;
 if p_budget<w.spent then return false; end if;
 update public.nyra_work set model=p_model,budget=p_budget,auto_repairs=p_auto,
 state=case when p_resume then (state-'error') || jsonb_build_object('stage',coalesce(state->>'resume_stage',state->>'stage')) else state end,
 updated_at=now() where id=p_id;
 return true;
end $$;
revoke all on function public.nyra_begin_step(uuid,uuid,integer,text,numeric),public.nyra_finish_step(uuid,uuid,integer,jsonb,numeric,jsonb,text),public.nyra_update_work(uuid,uuid,text,numeric,boolean,boolean) from public,anon,authenticated;
grant execute on function public.nyra_begin_step(uuid,uuid,integer,text,numeric),public.nyra_finish_step(uuid,uuid,integer,jsonb,numeric,jsonb,text),public.nyra_update_work(uuid,uuid,text,numeric,boolean,boolean) to service_role;
commit;
