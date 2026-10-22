# Nyra private editorial workspace — v0.6

## Current implementation (supersedes the session-only v0.5 notes below)

Owner-only persistence: `nyra_work` and `nyra_steps`, RLS enabled with no client grants. All reads and mutations use owner/Auth/AAL2/origin checks in nyra-api. No public publishing routes exist. Old direct paid endpoints are no longer exposed by the deployed entrypoint.

Default model: gpt-6.1-sol; explicit choices: gpt-6-astra, gpt-6-luna. Selection is stored with work and each step. Changing a work model affects subsequent steps only. Pricing is dated 2026-10-22, USD Standard short-context; usage-based costs and web tool counts are estimates, excluding tax and hosting. Cached writes use the 30-minute rate. API Billing is authoritative.

The server owns research → evidence → draft → review transitions and the two-repair bound. Automatic repairs default OFF; a failed first review pauses for owner continuation. Manual revisions create a linked work item with its own selected budget. Completed stages are persisted before the UI receives the response. Refresh does not auto-resume paid execution. Browser close may interrupt the current request; an explicit recovery after five minutes retains the allowance for uncertain billing. No automatic paid retries.

Before each step, a row-locked RPC reserves an estimated allowance within the work budget. Concurrent or repeated sequence requests cannot start another call. Output caps remain research/review/topics 5,000 and drafting 12,000 tokens. Search adds up to eight web tool actions per research request. Search input can exceed the allowance, so this is an estimated preflight control, NOT a guaranteed invoice cap. Unknown usage keeps the allowance, and any error pauses the work. Reported usage is captured even if later article/schema validation fails. The sum includes all recorded iterations; reasoning is already included in output_tokens.

Topic discovery is an explicit paid action: exactly three independently framed, current topics across economy, technology, startups, investment, society, politics and work, connected to AI/technology. Research prefers seven days, broadening explicitly to 30 days, separating event and publication dates. Each proposal includes sources, why now, question, thesis, original angle, counterargument and format. No article research/writing starts before the owner selects a proposal. Selection is recorded with source work/version and date. Article approval/publication remains separate and inactive. No recurring scheduler has been configured.

History lists the latest 100 work items; each opens the full persisted research, sources, versions, reviews and per-step costs. Export excludes signed tickets. Import accepts earlier JSON draft exports, validates article structure and safe source URLs, strips tickets/evidence IDs, marks them imported and requires fresh research for new writing. Imported reviews/charges are not certified or counted as new ledger charges. Old session-only data cannot be recovered without its export.

Tests include database persistence, client grant denial, owner isolation, model allowlist, budget rejection before billing, concurrent lock rejection, duplicate replay, unknown costs, manual repair pause, proposal selection, safe import, and the two-repair bound. Mock provider tests do not establish real editorial quality or paid-account availability. Live three-topic acceptance remains required with API credit.

## Historical v0.5 implementation notes

# Nyra private editorial lab

The owner can give Nyra a topic, optional direction/references, language and format. Nyra researches with OpenAI Responses web search, writes a structured original draft, then performs a separate editorial review and up to two automatic repair cycles. Research and drafting use separate requests so neither needs to fit a combined Edge Function timeout. This is the private test harness preceding public Signals design.

## What is implemented

- `Nyra Lab` inside the existing owner Admin, behind its existing login/MFA flow.
- Independent `nyra-api` Edge Function: validates each exact bearer token through Supabase Auth, checks `website_owners`, and requires AAL2. Neither a publishable/service key nor a non-owner session grants access.
- Versioned core instructions from `docs/NYRA-EDITORIAL.md` section 6; no personal chat memory or site booking/contact data is sent to OpenAI.
- `/research`: a required web-search tool, a maximum of eight tool calls and a 5,000-token output cap. Collects actual search-source metadata and citation annotations; distinguishes completed recorded page opens from search results/citations and incomplete opens. A URL appearing in metadata is not proof that the source supports the article's claim.
- `/draft`: a structured article with per-paragraph source URLs, thesis, original contribution, counterargument, uncertainty and editor note. No tools or publication capabilities. URLs must be present in the research metadata. Length is measured by whitespace-separated words, excluding metadata and citations; out-of-range drafts are flagged for revision.
- `/review`: strict structured assessment of clarity, coherence, editorial contribution, counterargument and support in the research packet. No browsing or publication tools. The server independently checks length and whether cited URLs have a completed recorded open; absence triggers research. A completed open is not proof of successful full-text retrieval. Self-review cannot independently certify facts.
- The browser orchestrates up to two repair cycles: research → draft → review, followed by revision or targeted new research when indicated. After two repairs unresolved findings remain visible and the draft stays `needs_revision`. Passing review yields `pending_review`, never permission to publish. Each draft is retained immediately, so later request failure does not discard it.
- Manual revisions go through the same bounded flow. Original owner notes remain separate from automated feedback. Fresh research regenerates the article against its own signed source set, preserving the assignment but avoiding citation transfer from stale research. The research report includes correction/retraction checks and their concrete limitations.
- Server-signed, owner-bound, prompt/model-bound research ticket, expiring after 30 minutes. HMAC uses a domain-separated key derived from the API key, so rotating the API key invalidates tickets. The ticket authorizes only reuse of research for drafting, never publication. It is kept only in the current UI session and excluded from exports.
- Existing `website_rate_check` provides persistent per-owner limits: three research requests, six drafting requests and six review requests per ten-minute window. These are request-count bounds, not a currency budget. No database schema changes.
- Safe errors, no automatic provider retries after timeouts/network/provider failures, no secrets in frontend code. `store:false` is sent to OpenAI; it is not a claim of zero provider retention.
- Prior drafts and usage metadata stay in memory while the owner remains signed in. JSON download includes drafts, research, model, prompt version, timestamps, provider response IDs, token usage and review history. The flow runs while the Admin session is open, not as a durable background worker. A full assignment uses at most nine provider requests (three research, three draft, three review), including the initial research; this increases API cost relative to v0.3. Closing/reloading/logging out loses the session; persistent draft storage is not yet implemented. A before-unload reminder helps avoid accidental loss, but is not a persistence guarantee.

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

These tests establish code behavior, not Nyra's editorial quality. The 35 bilingual behavior scenarios in `NYRA-EDITORIAL.md` still require real API execution and Elias's review. One exploratory Greek Signal was reviewed under v0.3. For v0.4, repeat that assignment; inspect research, citations, originality, coherence and revision quality. Repeat in English. No agent acceptance is claimed until those runs have been evaluated.

Not implemented: weekly unattended topic discovery, social-network account integrations, persistent drafts, public Signals pages, verified-reader accounts/comments, moderation or Publish/Reject controls. There is deliberately no publication endpoint in this lab. Implementation of those stages follows editorial acceptance and the remaining policy decisions.

The core instructions are private to normal readers at runtime, but not a security boundary and not a secret vault. The public source repository necessarily contains the policy text. Access control is enforced by code, not by asking the model to keep a promise.

## v0.4 verification

Tests cover the separate review endpoint, owner/MFA and signed-ticket enforcement, malformed review output, mandatory length/access findings, completed-only access metadata, cited sources surviving the discovery cap, two-cycle bounds, fresh research on evidence gaps, preservation on review failure, and stopping without paid retries. These checks use mocked provider responses and do not establish real editorial quality. Existing 30-minute research tickets from v0.3 are invalid after the prompt version change; start a new assignment.

## v0.5: captured source evidence

The completed v0.4 exploratory run produced three versions and three reviews, with two repair cycles. It remained in revision. The model stages received research prose and access metadata, but no consistently recorded primary content. This caused repeated generic access objections and removal of scientific context.

- New `/evidence` endpoint: same owner/MFA, signed ticket, configuration and persistent rate checks. No OpenAI call. After each research request the browser captures content before drafting.
- `lib/evidence.mjs` retrieves up to three relevant cited sources from exact public research/institutional HTTPS hosts. Every redirect is revalidated, cookies and authorization are omitted, each retrieval is bounded to 12 seconds and 400,000 bytes, with at most three redirects. Arbitrary hosts, private IPs, credentials and nonstandard ports are rejected. No PDF parsing dependency was added; arXiv PDF links use the equivalent HTML URL where available. Other PDFs, inaccessible pages and unlisted hosts remain explicit gaps.
- Up to four automatically selected, nonoverlapping 1,100-character excerpts per source are literal slices of normalized fetched text, accompanied by original/final URLs, timestamp, hash, character positions and source-bound IDs. These receipts establish captured content, not factual truth, full reading or guaranteed sufficient context. Automatic selection can miss the needed passage.
- Receipts enter the signed packet, drafting, review, UI and JSON export. Paragraph `evidence_ids` must exist and belong to a cited URL. Review still judges whether the excerpt actually supports the claim. Open-page metadata alone no longer suffices, and lack of a web-search open-page event does not invalidate server-captured evidence.
- Follow-up research receives prior signed receipts and prioritizes exact research questions. Unchanged selected captures can be reused during the same 30-minute packet lifetime. A changed assignment cannot reuse a prior packet as if it belonged to the new assignment.
- Prompts now require proportionate, local checks; no full-book reading requirement for a sufficiently evidenced narrow quotation, no blanket version-history demands, no irrelevant research objections, no duplicate bibliography inside the article. Claims of visual PDF inspection remain unverified unless supported by actual tools/data.
- Maximum model calls and two-cycle repair limit remain unchanged. At most three additional source-capture HTTP operations occur per full workflow, without OpenAI calls; downstream token input grows with captured excerpts. The request body cap is 256 KiB and signed ticket cap remains 120,000 characters.

Verification includes literal excerpt provenance, no invented or cross-source IDs, blocked URLs and redirects, bounded downloads, explicit retrieval failures, carry-forward of signed receipts, and exact question priority. A real read-only capture of the Perseus page included the actual Greek quotation and returned provenance metadata. No authenticated OpenAI-backed v0.5 editorial acceptance is claimed. Refresh Admin after exporting previous work; old-version research tickets are invalid after the prompt update.
