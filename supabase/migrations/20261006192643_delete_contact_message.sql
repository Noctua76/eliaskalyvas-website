-- Private website Admin only; authorization + AAL2 is enforced by website-api.
-- The RPC remains inaccessible to browser roles and trusts only the service role.
create function public.website_delete_message(p_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_actor is null or not exists (
    select 1 from public.website_owners where user_id = p_actor
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  perform 1 from public.contact_messages where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  delete from public.notification_jobs where resource_id = p_id and kind = 'message';
  delete from public.contact_messages where id = p_id;
  insert into public.website_audit(actor_id, action, resource_id)
    values (p_actor, 'message_deleted', p_id::text);
end;
$$;
revoke all on function public.website_delete_message(uuid, uuid) from public, anon, authenticated;
grant execute on function public.website_delete_message(uuid, uuid) to service_role;
