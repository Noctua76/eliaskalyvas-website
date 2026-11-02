-- Read-only production preflight; no user/editorial rows or credential values.
begin read only;
select current_database() database_name,current_setting('server_version_num') server_version;
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name in ('nyra_work','nyra_steps') order by table_name,ordinal_position;
select name,to_regclass(name) relation from unnest(array['public.website_owners','public.nyra_work','public.nyra_steps','auth.users','auth.sessions']) name;
select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and (c.relname in ('website_owners','nyra_work','nyra_steps') or n.nspname in ('nyra_delivery','nyra_trust','nyra_inspection')) order by 1,2;
select proname,prosecdef,has_function_privilege('anon',oid,'EXECUTE') anonymous,has_function_privilege('authenticated',oid,'EXECUTE') authenticated from pg_proc
where pronamespace='public'::regnamespace and proname like 'nyra_%' order by proname;
commit;
