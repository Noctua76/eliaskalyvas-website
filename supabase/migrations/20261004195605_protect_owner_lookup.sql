-- Keep the owner/MFA policy helper outside the exposed public API schema.
-- ALTER preserves its identity and existing RLS policy dependencies.
create schema if not exists website_private;
revoke all on schema website_private from public, anon;
grant usage on schema website_private to authenticated, service_role;
alter function public.website_owner() set schema website_private;
revoke all on function website_private.website_owner() from public, anon;
grant execute on function website_private.website_owner() to authenticated, service_role;
