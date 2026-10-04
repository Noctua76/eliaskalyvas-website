-- Supabase Vault is installed in hosted Supabase projects. Requires its extension.
-- Store OAuth refresh tokens here only after authorization of the chosen calendar.
create extension if not exists supabase_vault with schema vault;
create table public.website_calendar_credentials(provider text primary key check(provider in ('GOOGLE','OUTLOOK')), secret_id uuid not null);
alter table public.website_calendar_credentials enable row level security;
revoke all on public.website_calendar_credentials from public,anon,authenticated;
grant all on public.website_calendar_credentials to service_role;
create function public.website_store_calendar_token(p_provider text,p_token text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare existing uuid; begin
 perform pg_advisory_xact_lock(70708);
 select secret_id into existing from website_calendar_credentials where provider=p_provider;
 if existing is null then
 select vault.create_secret(p_token,'website_calendar_'||lower(p_provider)) into existing;
 insert into website_calendar_credentials values(p_provider,existing);
 else perform vault.update_secret(existing,p_token); end if;
 end $$;
create function public.website_calendar_tokens() returns table(provider text,token text) language sql security definer set search_path=public,pg_temp as $$
 select c.provider,s.decrypted_secret from website_calendar_credentials c join vault.decrypted_secrets s on s.id=c.secret_id;
$$;
revoke all on function public.website_store_calendar_token(text,text),public.website_calendar_tokens() from public,anon,authenticated;
grant execute on function public.website_store_calendar_token(text,text),public.website_calendar_tokens() to service_role;
