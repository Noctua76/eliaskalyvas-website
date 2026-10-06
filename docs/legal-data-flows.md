# Legal layer — 2026-10-06

Scope: read-only source inventory, bilingual privacy/terms, modal + standalone public pages, local consent preferences. No database, provider, authentication, scheduling, notification or Turnstile changes.

## Source inventory

| Flow | Actual data and purpose | Source |
| --- | --- | --- |
| Contact | name/email/message/interest/language; idempotency UUID/hash, timestamp/status; owner notification | ContactSection.jsx, contact-config.js; validation.mjs, api.mjs; contact_messages |
| Email alternative | mailto draft; info@eliaskalyvas.gr + configured owner CC; user email client sends | contact-config.js |
| Booking | name/email/topic/start/end/timezone/language; reference/status/revision/management tokens/calendar and Meet identifiers | Booking.jsx, validation.mjs, api.mjs; meeting_bookings, booking_tokens |
| Google Calendar/Meet | availability read, calendar resource create/update/delete, meeting link | providers.mjs; Google implementation already verified; no live actions performed |
| Notifications | owner/attendee email, calendar tasks, delivery status/recipient/provider reference; .ics and management URLs | providers.mjs; notification_jobs |
| Supabase | database, Edge Functions, restricted operator data access | website-api/index.ts, api.mjs, migrations; no hosted changes |
| Resend | transactional notifications, reply-to and configured owner CC | providers.mjs |
| Turnstile | explicit client script, token/action/hostname verification; never gated by optional consent | Turnstile.jsx, api.mjs |
| Rate limiting | gateway IP → salted scope-specific hash; expiring counters/cleanup | api.mjs, website_rate_check migration |
| Hosting | GitHub Pages preview/static assets | .github/workflows/pages.yml |
| External links | My Mentor, Aegis Link, Noctua Core, Google Play, LinkedIn; configurable social links | SelectedWorkSection.jsx, ContactSection.jsx/contact-config.js |
| Analytics/advertising | none found; no tags or providers added | source review of src and HTML entries |
| Consent | browser localStorage only; version, choices, timestamp; no server consent database | src/legal/consent.js |

No fixed retention/deletion schedule for contact/booking was confirmed in source. Archiving/cancelling does not delete records. Rate-limit expiry is separate from business-data retention. Provider processing locations/contracts and specific transfer safeguards were not independently verified. Policy avoids inventing them.

## Shared content and routes

One authoritative document per language/kind in `src/legal/legal-content.js`. React modal and standalone pages consume it. Vite pre-renders that same content into standalone HTML for no-JS visitors/crawlers (no manually duplicated policy copy).

Routes: BASE_URL + gr/privacy/, gr/terms/, en/privacy/, en/terms/. Plain primary click opens native modal; modified/middle clicks and copied links preserve native standalone navigation. Native dialog handles focus containment, Escape/backdrop/close and focus restoration. Direct booking page includes legal controls; Admin logic stays unchanged.

## Consent contract

- Version 1; necessary always true; analytics/marketing OFF and unavailable because no providers are enabled.
- Accept all covers currently enabled categories only; it grants no blanket consent for future processing.
- Reject visible alongside Accept/Settings with equal styling. No consent wall.
- Reopen Cookie Preferences through footer on public site, booking or legal pages.
- Invalid/old preferences are discarded; blocked storage fails safely and explains that choices may not persist.
- localStorage storage events sync other tabs/booking iframe. No form submission, API call or Turnstile is gated by analytics/marketing rejection.
- Future optional loaders must consult categoryAllowed immediately before any network request; no loaders exist today.

## Before future Signals/optional features

Before newsletters, accounts, reactions/comments, saved preferences, personalisation, analytics, behaviour measurement, advertising or remarketing: document actual flows and providers; update privacy/terms and categories; bump policy/CONSENT_VERSION where appropriate; obtain fresh specific consent where required; test zero optional requests before consent and after rejection/withdrawal. Old consent never authorises newly introduced purposes. Enable optionalCategories only as part of that reviewed change.

## Owner follow-up before final launch

- Establish and implement a formal retention/deletion schedule for enquiries, bookings, jobs, calendars, notifications and backups. Do not publish invented periods.
- Confirm processor agreements, actual processing destinations and applicable international-transfer mechanisms; complete legally required disclosures with verified information.
- Review the legal drafts against actual professional arrangements and mandatory legal obligations. This implementation is not a certification of GDPR compliance.
- PRE-LAUNCH SECURITY ACTION — rotate TURNSTILE_SECRET_KEY (previous exposure noted by owner). No rotation performed in this task; never publish a secret value.

## Reference basis

GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng (Articles 6, 12–22, 44–49).
Hellenic DPA cookie guidance: https://www.dpa.gr/el/enimerwtiko/thematikes_enotites/electronikesepikoinwnies/cookies/enimerwsh_kai_sugatathesi_cookies

Uploaded instruction file ends inside the conceptual model in section 19. All supplied requirements were implemented; reopening preferences, version invalidation and failure handling were included to make the consent system usable.
