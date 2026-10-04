-- Optional hosted setup AFTER project/function/secrets are configured.
-- Use secured dashboard input to create Vault secrets named:
--   website_worker_url: the REAL deployed website-api URL + /worker
--   website_worker_secret: the SAME random WORKER_SECRET as the Edge Function
-- Never put values in this file/Git. The actual cron schedule is not installed by migrations.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('website-notifications','* * * * *', $$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='website_worker_url'),
   headers := jsonb_build_object('Content-Type','application/json','x-worker-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='website_worker_secret')),
   body := '{}'::jsonb,
   timeout_milliseconds := 120000
 );
$$);
-- Inspect net._http_response and cron.job_run_details using a privileged account.
-- Stop/replace an existing schedule by job name before reinstalling; never run two accidentally.
