# Website messages and meetings — rollout / configuration

Status: source implementation and local verification. No hosted Supabase project, real owner account, email sender, Turnstile configuration or calendar authorization has been selected in this pass. No real mail/events were created. Public contact remains an explicit email draft; booking remains closed. Signals is outside this change.

## Architecture and configuration registry

The existing React/Vite site stays on its current GitHub Pages preview. A **separate** personal-website Supabase project hosts the database, owner Auth/MFA and `website-api` Edge Function. Do not use or modify the Aegis Link/My Mentor/Noctua Core projects or their credentials.

| Setting | Location | Current state |
| --- | --- | --- |
| Website Supabase URL / publishable key | Frontend `.env.example`, GitHub Actions Variables | Awaiting project selection |
| API URL | `VITE_OPERATIONS_API_URL` | Copy the actual deployed `website-api` URL, never guess a project ref |
| Turnstile site key | `VITE_TURNSTILE_SITE_KEY` | Awaiting real widget |
| Turnstile secret / exact hostnames | Edge Function secrets | Awaiting configuration |
| CORS origins | `ALLOWED_ORIGINS` | Exact origins, not paths; e.g. the existing GitHub Pages origin |
| Trusted source header/position | Edge Function secrets | Verify gateway-injected IP behavior before enabling |
| Email provider | Resend adapter | Implemented, no real account/key selected |
| Sender | `EMAIL_FROM` server secret | Owner-approved, verified domain sender required |
| Owner notification routing | Server code | To `info@eliaskalyvas.gr`, CC `iliaskalivas@hotmail.com` |
| Reply-To | Server validation | Visitor email; client cannot change recipients or sender |
| Owner identity | Supabase Auth + `website_owners` | Owner must choose login identity; not inferred from notification recipients |
| Calendar | OAuth + server secrets / Vault | Google or Outlook must be confirmed by owner |
| Meeting availability | Admin / `meeting_settings` | Disabled; timezone Europe/Athens, no fabricated working hours/location |
| My Mentor website | `VITE_MY_MENTOR_WEBSITE_URL` | Proposed `https://mymentorapp.space/` returned 403 in earlier check; keep blank until verified |
| Existing social/legal links | `src/contact-config.js` | LinkedIn retained; unconfigured YouTube/Instagram/legal links remain notices |

## Deployment sequence

1. Select an unused, separate website Supabase project. Confirm organization, region and plan before provisioning. Do not purchase/upgrade a plan, move the domain, or change DNS as part of this pass.
2. Apply `supabase/migrations/202610040001_website_operations.sql`, then `202610040002_calendar_vault.sql`. The second migration uses hosted Supabase Vault. Inspect database advisors after applying.
3. In Auth settings disable public signup and anonymous sign-ins. Create/invite the **owner-selected** account securely. Insert its actual Auth user UUID into `public.website_owners` using a privileged administrative connection. Do not add every authenticated user or infer the identity from recipients.
4. Register a real Turnstile widget for the preview host and, later, the approved final host. Server validates success, exact hostname and action (`contact`, `booking`, `manage`). Never enable production with test keys.
5. Create a separate Resend API key and verified sender for this website. Required domain verification/DNS work is a separate owner-authorized step. Keep key and sender exclusively in Function secrets. An unverified sender will fail and leave accepted messages visible in Admin; acceptance does not prove inbox delivery.
6. Configure Function secrets from `supabase/functions/.env.example`. `SUPABASE_SERVICE_ROLE_KEY` must never be in Vite variables or the browser bundle. Generate different random secrets for the token HMAC, rate-limit salt and worker. `PUBLIC_SITE_URL` must include the site's real repository base path.
7. Deploy the complete `supabase/functions/website-api/` directory (including `lib`). `verify_jwt=false` is intentional for public visitor routes; the handler independently verifies owner JWTs with Auth, owner allowlist and AAL2. The `/worker` route has a separate secret.
8. Confirm CORS and gateway address handling on the deployed project. The server requires `TRUSTED_IP_HEADER`; it does not silently trust a visitor's first `X-Forwarded-For` value. Verify which address/header the gateway overwrites or appends, then set `TRUSTED_IP_POSITION` accordingly. If this cannot be verified, add an authenticated gateway or use a verified Turnstile/source strategy before enabling. Default rate windows are 5 mutations or 60 slot requests per source per 10 minutes; salt-hashed source keys expire and are cleaned up.
9. Configure the worker schedule described below, owner MFA and calendar OAuth. Use a separate development project/mocks or explicitly approved test recipients for live verification. Do not send visitor mail or create personal test events without authorization.
10. Only after real integration checks pass, set the public GitHub Actions Variables listed in `.env.example` and rebuild. Actual names/URLs must come from the selected project/deployment. Leave the variables blank while services are incomplete. The CI runs `npm test` before the build.
11. Enable booking from Admin only after duration, hours, location and calendar checks are confirmed. The database rejects incomplete configuration. Alternatively, the owner may **explicitly** choose manual mode and acknowledge maintaining blocked times without personal-calendar conflict checking.

## Worker schedule and delivery behavior

Schedule an authenticated POST to the real deployed function's `/worker` route every minute, using Supabase Cron (`pg_cron` + `pg_net`) and Vault for the worker secret/API URL. Keep the secret out of checked-in SQL and browser code. No external ChatGPT automation is needed. A template is in `supabase/worker-schedule.sql`; replace the Vault placeholders using secured dashboard input after the function exists, then apply the schedule.

Each invocation claims all eligible jobs for **one** resource under a database advisory lock, with a 3-minute lease and `SKIP LOCKED`-equivalent serialized resource claiming. Use a one-minute schedule for a small personal site; backlog capacity is roughly one submission per minute. Raise worker frequency or batch resources with per-resource locking if volume requires it. Watch failed/pending queues; claim limit and retry policy should be revisited before traffic increases.

Messages and their owner notification job are written atomically. Booking/rescheduling/cancellation and notification jobs are also transactional. Visitor success means durable DB acceptance. Notification `sent` means the provider accepted the API request, **not** a verified inbox delivery. Eight attempts with exponential backoff (up to 6 hours) are recorded separately from message status. Persistent failures remain in Admin. Provider errors are stored as safe codes without credentials or user payloads.

Resend idempotency keys are stable per job. Its deduplication window is 24 hours, so ambiguous email attempts are not resent beyond 23 hours: `DELIVERY_REVIEW_REQUIRED` requires checking provider records, rather than risking duplicate mail. The Admin cannot force a resend of these ambiguous old jobs. Rotate/recover only after an operator has established whether delivery happened. Accepted messages remain in the database throughout.

Calendar sync executes before attendee/owner booking emails. Pending/failed sync keeps the slot reserved and queues retries. Stable Google event IDs and Outlook `transactionId` prevent duplicate creates; Outlook recovers a lost response by scanning paginated event IDs/transactionIds (bounded at 20,000 events, fails closed above that). Reschedules update the existing event, cancellations delete it; stale revision jobs are superseded. Calendar revoked/expired authorization hides availability and refuses enabling/reserving. Calendar access is server-only. ICS has a stable UID/sequence and UTC dates, but is not itself conflict checking.

## Personal calendar authorization

Confirm **Google or Outlook** first. Hotmail as a notification address does not choose Outlook automatically.

- Google: register an owner-controlled OAuth client, enable Google Calendar API, register a real HTTPS callback on an owner-controlled authorization service, request offline access with Calendar read/write scope, obtain the owner's refresh token through consent, and select the actual calendar ID. Configure `GOOGLE_*` secrets. A consumer app left in OAuth testing mode may have expiring refresh tokens; confirm consent configuration before launch.
- Outlook: register an owner-controlled Microsoft Entra application supporting the owner's actual account type, register the real HTTPS callback, request delegated `Calendars.ReadWrite` + `offline_access` through consent and select the actual calendar ID. Configure `OUTLOOK_*` secrets and tenant (`consumers` is only for a confirmed personal Microsoft account). Rotating refresh tokens are saved in Supabase Vault using server-only RPCs.

No fictitious OAuth callback, Google Meet/Zoom link, account or credentials are provided. Authorization setup/consent is a remaining configuration task, not performed by typing a notification email. Calendar adapters are implemented and tested with mocks; actual provider permission/tenant/calendar behavior must be tested before public enablement.

## Admin use

Direct URLs: `/eliaskalyvas-website/en/admin/` and `/eliaskalyvas-website/gr/admin/`. There is no public Admin navigation item and no signup screen. Direct static HTML entrypoints allow refresh on GitHub Pages.

1. Sign in with the allowlisted owner account. Enroll/verify TOTP MFA in an authenticator. API and table reads require AAL2; an AAL1 owner can only check identity/enroll MFA, not read messages.
2. Messages: choose status filter and record, read details, change new/read/replied/archived, or open a reply in the owner's email application. Reply action is not automatic email sending.
3. Meetings: filter confirmed/cancelled, read reference/time/topic/sync, reschedule using a valid UTC ISO time or confirm cancellation. Server rechecks slots and personal calendar; arbitrary unavailable timestamps are rejected. Pending notification statuses are visible separately.
4. Availability: enter timezone, duration, buffer, notice, horizon, actual meeting location/method, weekly local hours and UTC blocked intervals. Select configured calendar mode, then enable. Saving incomplete settings fails. Manual mode needs the explicit acknowledgement checkbox.
5. Notifications: inspect queued/failed jobs and request safe retry for eligible failures; worker sends them. Audit: review changes to messages, availability and meetings.
6. Sign out. Auth sessions are memory-only; refreshing requires login/MFA again. Sensitive message/attendee data is not put into localStorage, analytics or public logs. Lists show the 250 most recent records; pagination/export is a future scale improvement.

Booking links in email open a page using reference/token in a URL fragment (not query logs), remove the fragment from browser history, then require verification and a confirmed POST. Opening a GET link or email scanner cannot cancel. Tokens are stored hashed, expire a day after the meeting and contain no personal information. Rescheduling updates expiry. If the page is refreshed after fragment removal, revisit the original email link.

## Costs, inactivity and recovery

Checked against provider pages on 2026-10-04. No paid service was purchased or enabled.

- Supabase Free: $0/month, 500 MB database, 2 active free projects, pause after a week of inactivity, no automatic database backups. Good for development/controlled trial; do not treat it as an always-available production calendar. Supabase Pro starts at $25/month for the organization with one Micro project covered by credits; additional Micro projects generally add $10/month. Existing organization/project billing must be checked before provisioning. Daily backups retained 7 days on Pro. Keep spend cap enabled and avoid PITR/custom-domain add-ons unless separately approved.
- Resend Free: verify current quota on the pricing page before rollout; the retrieved pricing at this pass shows 3,000 transactional emails/month, maximum 100/day. Owner To+CC and attendee notifications consume recipient quota, so budget for both recipients. Upgrade only when justified and approved.
- Cloudflare Turnstile has a free offering. A custom calendar has no separate scheduler subscription; account/calendar service and hosting usage still apply.
- GitHub Pages hosting remains unchanged. No final-domain transfer/DNS change in this pass.

For a free trial, take encrypted SQL exports to owner-controlled restricted storage, including auth role/schema definitions and website tables; exclude or separately protect OAuth Vault secrets. Verify restore into a disposable separate project before accepting real data. Do not commit exports or share attendee/message data as public artifacts. For production, choose a backup/restore plan explicitly (Pro daily backup plus periodic protected export and a restore drill). Free project pause/restart or provider authorization failure must leave a visible unavailable/error state, never fabricated slots/success. No backup job was silently configured.

Approved Privacy Policy/Terms must cover contact/booking purpose, Supabase and email/calendar processors, retention/deletion, international transfers as applicable and contact details. No legal copy or marketing consent has been invented. Retention period and data deletion procedures need owner-approved policy before final launch.

## Verification and limits

`npm test` checks validation, transactional/idempotent storage, provider failure persistence, rate limits, RLS/owner/MFA enforcement, booking overlap constraints and buffers, DST conversion, blocked times, safe GET management, calendar authorization failure, Google/Outlook duplicate recovery and ICS correctness.

Database tests run embedded PostgreSQL (PGlite), not a mocked SQL store. Parallel submissions are issued in tests but PGlite serializes commands on its one connection; the database exclusion/advisory-lock protections must additionally be exercised with multiple independent connections against the selected hosted project. Vault encryption, live Supabase Auth/TOTP, deployment gateway headers, actual calendar consent and real email delivery require hosted integration verification. There are no claims that these were tested live.

The reviewed changes do not recreate assets or alter the approved section layouts. Thinking is temporarily removed from both navigation menus, About targets `#about`, and legacy `#thinking` stays present. My Mentor Google Play label is explicit; the website CTA is configured but withheld pending destination verification. Signals has not been created.

References: https://supabase.com/pricing ; https://resend.com/pricing ; https://www.cloudflare.com/products/turnstile/ ; https://resend.com/changelog/idempotency-keys ; https://supabase.com/docs/guides/database/vault ; https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ ; https://developers.google.com/workspace/calendar/api/v3/reference/events ; https://learn.microsoft.com/en-us/graph/api/resources/event
