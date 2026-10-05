create or replace function public.website_save_settings(p jsonb,p_hours jsonb,p_blocks jsonb,p_actor uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 begin perform pg_advisory_xact_lock(70707);
 if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'INVALID_TIMEZONE'; end if;
 if (p->>'enabled')::boolean and (length(trim(coalesce(p->>'location','')))=0 or jsonb_array_length(p_hours)=0 or p->>'calendar_mode'='unconfigured' or (p->>'calendar_mode'='manual' and not coalesce((p->>'manual_acknowledged')::boolean,false))) then raise exception 'INCOMPLETE_CONFIGURATION'; end if;
 update meeting_settings set enabled=(p->>'enabled')::boolean,timezone=p->>'timezone',duration_minutes=(p->>'duration_minutes')::int,buffer_minutes=(p->>'buffer_minutes')::int,notice_hours=(p->>'notice_hours')::int,horizon_days=(p->>'horizon_days')::int,location=p->>'location',calendar_mode=p->>'calendar_mode',manual_acknowledged=(p->>'manual_acknowledged')::boolean,updated_at=now() where id = true;
 delete from meeting_hours where id is not null; insert into meeting_hours(weekday,starts,ends) select weekday,starts,ends from jsonb_to_recordset(p_hours) as x(weekday int,starts time,ends time);
 delete from meeting_blocks where id is not null; insert into meeting_blocks(starts_at,ends_at) select starts_at,ends_at from jsonb_to_recordset(p_blocks) as x(starts_at timestamptz,ends_at timestamptz);
 insert into website_audit(actor_id,action,resource_id) values(p_actor,'availability_update','settings');
 end $$;
