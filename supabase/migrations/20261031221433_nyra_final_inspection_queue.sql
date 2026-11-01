begin;
-- BRANCH ONLY. Owner intake already passed AAL2, immutable rights and byte hash.
-- A machine can select only the current server queue, never a browser's payload.
create table nyra_inspection.dispatches(
 upload_id uuid primary key references nyra_inspection.uploads(id),
 claimed_at timestamptz not null default clock_timestamp(),
 outcome text not null default 'claimed' check(outcome in('claimed','accepted','unknown'))
);
alter table nyra_inspection.dispatches enable row level security;
alter table nyra_inspection.dispatches force row level security;
revoke all on nyra_inspection.dispatches from public,anon,authenticated;
grant select,insert,update on nyra_inspection.dispatches to service_role;
create function public.nyra_inspection_next(p_code text) returns uuid
language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
declare selected uuid;
begin
 if p_code is null or p_code!~'^[a-f0-9]{40}$' then raise exception 'INSPECTION_CODE';end if;
 select u.id into selected from nyra_inspection.uploads u
 where u.code_sha=p_code and not u.cleared and u.expires_at>clock_timestamp()
 and (u.state='ready' or (u.state='processing' and exists(select 1 from nyra_inspection.attempts a where a.id=u.current_attempt and a.lease_until<=clock_timestamp())))
 order by u.created_at,u.id limit 1;
 return selected;
end $$;
create function public.nyra_inspection_nudge(p_operation text,p_code text,p_id uuid default null,p_outcome text default null) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public,nyra_inspection as $$
declare selected uuid;row nyra_inspection.dispatches;
begin
 if p_code is null or p_code!~'^[a-f0-9]{40}$' then raise exception 'INSPECTION_CODE';end if;
 if p_operation='claim' then
  select u.id into selected from nyra_inspection.uploads u where u.state='ready' and u.code_sha=p_code and u.expires_at>clock_timestamp() and not u.cleared and not exists(select 1 from nyra_inspection.dispatches d where d.upload_id=u.id) order by u.created_at,u.id for update skip locked limit 1;
  if selected is null then return null;end if;
  insert into nyra_inspection.dispatches(upload_id) values(selected);
  return jsonb_build_object('id',selected);
 elsif p_operation='outcome' and p_outcome in('accepted','unknown') then
  select d.* into strict row from nyra_inspection.dispatches d join nyra_inspection.uploads u on u.id=d.upload_id where d.upload_id=p_id and u.code_sha=p_code for update of d;
  if row.outcome<>'claimed' then if row.outcome=p_outcome then return jsonb_build_object('id',p_id,'outcome',row.outcome);else raise exception 'INSPECTION_DISPATCH_UNKNOWN';end if;end if;
  update nyra_inspection.dispatches set outcome=p_outcome where upload_id=p_id;
  return jsonb_build_object('id',p_id,'outcome',p_outcome);
 end if;
 raise exception 'INSPECTION_OPERATION';
end $$;
revoke all on function public.nyra_inspection_next(text),public.nyra_inspection_nudge(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.nyra_inspection_next(text),public.nyra_inspection_nudge(text,text,uuid,text) to service_role;
-- Owner-only receipt/rollback projection. Never returns broker facts or keys.
create function public.nyra_publication_delivery_status(p_owner uuid,p_session uuid,p_expires timestamptz,p_work uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public,nyra_delivery as $$
declare control_row jsonb;verified jsonb;restores jsonb;receipts jsonb;attempts jsonb;
begin
 perform public.nyra_publication_actor(p_owner,p_session,p_expires);
 if not exists(select 1 from public.nyra_work where id=p_work and owner_id=p_owner) then raise exception 'PUB_NOT_FOUND';end if;
 select to_jsonb(c) into control_row from nyra_delivery.control c where c.singleton and c.owner_id=p_owner;
 if control_row is null then return jsonb_build_object('verified_restore_release_ids','[]'::jsonb,'receipts','[]'::jsonb,'attempts','[]'::jsonb,'blocked',false);end if;
 verified=coalesce(control_row->'history','[]'::jsonb)||coalesce(control_row#>'{baseline,releases}','[]'::jsonb);
 select coalesce(jsonb_agg(m->>'held'),'[]'::jsonb) into restores from jsonb_array_elements(control_row->'mappings') m
 where exists(select 1 from jsonb_array_elements(verified) v where v#>>'{release,id}'=m->>'materialized' and public.nyra_publication_associated(p_owner,p_work,(v->>'article_id')::uuid));
 select coalesce(jsonb_agg(jsonb_build_object('receipt_id',r.id,'status',r.receipt->>'status','generation',r.receipt->'generation','verified_live_at',r.receipt->>'verified_live_at')),'[]'::jsonb) into receipts from (select id,receipt from nyra_delivery.receipts order by created_at desc limit 100) r;
 select coalesce(jsonb_agg(jsonb_build_object('attempt_id',a.id,'state',a.state)),'[]'::jsonb) into attempts from (select id,state from nyra_delivery.attempts order by created_at desc limit 20) a;
 return jsonb_build_object('verified_restore_release_ids',restores,'receipts',receipts,'attempts',attempts,'blocked',control_row->'blocked');
end $$;
revoke all on function public.nyra_publication_delivery_status(uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.nyra_publication_delivery_status(uuid,uuid,timestamptz,uuid) to service_role;
commit;
