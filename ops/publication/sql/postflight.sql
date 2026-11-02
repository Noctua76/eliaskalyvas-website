-- Fail closed on missing objects or browser-accessible private RPCs.
-- No mutation or migration-history write; the transaction is read-only.
begin read only;
do $$declare name text;begin
 foreach name in array array['public.nyra_work','public.nyra_steps','public.nyra_publication_catalog','nyra_delivery.control','nyra_inspection.uploads','nyra_inspection.receipts','nyra_inspection.dispatches'] loop
  if to_regclass(name) is null then raise exception 'NYRA_POSTFLIGHT_MISSING: %',name;end if;
 end loop;
 if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and (proname like 'nyra_publication_%' or proname like 'nyra_delivery_%' or proname like 'nyra_inspection_%') and
  (prosecdef or has_function_privilege('anon',oid,'EXECUTE') or has_function_privilege('authenticated',oid,'EXECUTE'))) then raise exception 'NYRA_POSTFLIGHT_RPC_AUTHORITY';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and
  (n.nspname in ('nyra_delivery','nyra_trust','nyra_inspection') or n.nspname='public' and c.relname like 'nyra_publication_%') and not c.relrowsecurity) then raise exception 'NYRA_POSTFLIGHT_RLS';end if;
 if not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='nyra_inspection_next') then raise exception 'NYRA_POSTFLIGHT_QUEUE';end if;
end $$;
select 'NYRA_SCHEMA_POSTFLIGHT_PASS' result;
commit;
