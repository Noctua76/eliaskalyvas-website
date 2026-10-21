# Nyra private editorial lab

The owner can give Nyra a topic, optional direction/references, language and format. Nyra researches with OpenAI Responses web search, then writes a structured original draft. Research and drafting use separate requests so neither needs to fit a combined Edge Function timeout. This is the private test harness preceding public Signals design.

## What is implemented

- `Nyra Lab` inside the existing owner Admin, behind its existing login/MFA flow.
- Independent `nyra-api` Edge Function: validates each exact bearer token through Supabase Auth, checks `website_owners`, and requires AAL2. Neither a publishable/service key nor a non-owner session grants access.
- Versioned core instructions from `docs/NYRA-EDITORIAL.md` section 6; no personal chat memory or site booking/contact data is sent to OpenAI.
- `/research`: a required web-search tool, a maximum of five tool calls and a 5,000-token output cap. Collects actual search-source metadata and citation annotations; distinguishes recorded page opens from search results/citations. A URL appearing in metadata is not proof that the source supports the article's claim.
- `/draft`: a structured article with per-paragraph source URLs, thesis, original contribution, counterargument, uncertainty and editor note. No tools or publication capabilities. URLs must be present in the research metadata. Length is measured by whitespace-separated words, excluding metadata and citations; out-of-range drafts are flagged for revision.
- Revisions receive the previous article plus the requested changes and use the same research; new evidence requires fresh research.
- Server-signed, owner-bound, prompt/model-bound research ticket, expiring after 30 minutes. HMAC uses a domain-separated key derived from the API key, so rotating the API key invalidates tickets. The ticket authorizes only reuse of research for drafting, never publication. It is kept only in the current UI session and excluded from exports.
- Existing `website_rate_check` provides persistent per-owner limits: three research requests and six drafting requests per ten-minute window. These are request-count bounds, not a currency budget. No database schema changes.
- Safe errors, no automatic provider retries, no secrets in frontend code. `store:false` is sent to OpenAI; it is not a claim of zero provider retention.
- Prior drafts and usage metadata stay in memory while the owner remains signed in. JSON download includes drafts, research, model, prompt version, timestamps, provider response IDs and token usage. Closing/reloading/logging out loses the session; persistent draft storage is not yet implemented. A before-unload reminder helps avoid accidental loss, but is not a persistence guarantee.

## Configuration and rollout

Target only the existing **eliaskalyvas-website** Supabase project `drebxpsircxmnthnrliw`. Do not use Aegis Link's project.

Use the existing `ALLOWED_ORIGINS`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Add the following **server-side Edge Function secrets** through the Supabase dashboard's secure input:

| Name | Value / meaning |
| --- | --- |
| `OPENAI_API_KEY` | A project API key supplied securely by the owner; never paste it into chat or a Vite variable |
| `NYRA_MODEL` | An API model available to the owner's project that supports web search and structured outputs; must be selected and verified before activation |
| `NYRA_ENABLED` | Exact value `true` to enable chargeable calls; absent/false keeps calls disabled |

`GET /status` checks configuration presence, not whether OpenAI will accept the key/model or whether billing is sufficient. No credit charge occurs for this status route. Real API acceptance requires an owner-initiated research/draft run.

`supabase/config.toml` declares `verify_jwt=false` for `nyra-api` because the handler performs the token validation and owner/MFA authorization itself, including CORS preflight. Never remove those handler checks.

Deploy `supabase/functions/nyra-api/` with both library files. The browser derives its URL from the existing website Supabase URL; no new frontend key or URL variable is required. Ship the frontend through the existing Pages pipeline after review. The backend is disabled by default and can be deployed before the UI. Disabling `NYRA_ENABLED` blocks new calls but cannot undo API requests already accepted.

## Verification and remaining scope

`npm test` covers the new research/draft flow using a mocked provider plus auth, non-owner/MFA denial, untrusted origins, configuration gates, count limits, signed-evidence tampering/expiry/version binding, unsafe or invented URLs, incomplete/refused/time-out responses, safe errors, revision input and length validation. Existing PostgreSQL/booking/calendar tests remain part of the suite.

These tests establish code behavior, not Nyra's editorial quality. The 24 bilingual behavior scenarios in `NYRA-EDITORIAL.md` still require real API execution and Elias's review. After activation, start with one Greek Signal on AI and human judgment; inspect research, citations, originality, coherence and revision quality. Repeat in English. No agent acceptance is claimed until those runs have been evaluated.

Not implemented: weekly unattended topic discovery, social-network account integrations, persistent drafts, public Signals pages, verified-reader accounts/comments, moderation or Publish/Reject controls. There is deliberately no publication endpoint in this lab. Implementation of those stages follows editorial acceptance and the remaining policy decisions.

The core instructions are private to normal readers at runtime, but not a security boundary and not a secret vault. The public source repository necessarily contains the policy text. Access control is enforced by code, not by asking the model to keep a promise.
