-- Each booking keeps its own Google Meet link under the existing owner-only RLS.
alter table public.meeting_bookings add column meeting_url text
 check (meeting_url is null or meeting_url ~ '^https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}$');
