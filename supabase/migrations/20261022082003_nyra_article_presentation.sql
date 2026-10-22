begin;
-- Version-bound edits are independent of the paid workflow sequence and account ledger.
create function public.nyra_save_presentation(p_id uuid,p_owner uuid,p_version integer,p_expected_revision integer,p_presentation jsonb)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare w public.nyra_work; d jsonb; prior jsonb; rev integer; history jsonb;
begin
 select * into w from public.nyra_work where id=p_id and owner_id=p_owner for update;
 if not found then return 'NOT_FOUND'; end if;
 if w.active_seq is not null then return 'WORK_BUSY'; end if;
 if p_version<0 or p_version>=jsonb_array_length(w.state->'drafts') then return 'INVALID_VERSION'; end if;
 d=w.state->'drafts'->p_version;
 prior=d->'presentation';
 rev=coalesce((prior->>'revision')::integer,0);
 if p_expected_revision is distinct from rev then return 'STALE_PRESENTATION'; end if;
 history=coalesce(d->'presentation_history','[]'::jsonb);
 if prior is not null then history=history||jsonb_build_array(jsonb_build_object('saved_at',now(),'presentation',prior)); end if;
 d=d||jsonb_build_object('presentation',p_presentation||jsonb_build_object('revision',rev+1,'updated_at',now(),'approval','human_required'),'presentation_history',history);
 update public.nyra_work set state=jsonb_set(state-'publication_approval',array['drafts',p_version::text],d),updated_at=now() where id=p_id;
 return 'OK';
end $$;
revoke all on function public.nyra_save_presentation(uuid,uuid,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.nyra_save_presentation(uuid,uuid,integer,integer,jsonb) to service_role;
commit;
