# Nyra publication authority — Phase 2

Implementation baseline: `f72f6ea6479e44a0e9efca98082cf84b12c407b4`.
Status: **private implementation for external review only**. No production migration, Edge deployment, public exporter, delivery integration or article publication.

## Scope and deliberate isolation

The Phase 1 v1.1 schemas/validators are reused unchanged. New application code is in `lib/publication/authority.mjs` and `authority-validation.mjs`. It implements a private Request-handler factory and in-process assembly boundary, with no listener, deployed URL, active function entrypoint import or browser credentials. `src/operations/NyraPublicationReview.mjs` is an unmounted private review component; existing Admin/auth and Nyra Lab code are unchanged.

The current Node 22 module uses Phase 1's Node/Ajv/schema-file runtime. Packaging it for Supabase Edge, mounting private routes/UI, applying migration and deployment are future separately approved integration steps. This PR does not claim the new module can be deployed as an unchanged standalone Deno bundle.

There is no public release feed. The existing public adapter, robots, canonical/index policy and workflow stay unchanged. No production environment switch is introduced. Every successful decision returns `status:'authorized_held', delivered:false, publishing:false`.

## Current Supabase documentation/security review

Reviewed on 27 October 2026:

- https://supabase.com/changelog.md — rechecked for this correction, along with the sessions and function privilege documentation; no authentication architecture change is introduced.
- https://supabase.com/docs/reference/javascript/auth-getuser — existing exact-token Auth-server verification architecture retained.
- https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel — explicit JWT argument used for server MFA checks; current and next levels must both be `aal2`.
- https://supabase.com/docs/guides/auth/auth-mfa — MFA must be enforced server-side, not merely by UI flags.
- https://supabase.com/docs/guides/auth/sessions — JWT session ID corresponds to `auth.sessions`; sensitive operations verify its continued existence/expiry.
- https://supabase.com/docs/guides/database/functions — invoker functions, fixed search paths and explicit execution grants.

Read-only metadata checks confirmed `auth.sessions.id`, `user_id`, `aal` and `not_after` exist in the current project. The production `service_role` currently lacks SELECT on those columns. The prepared migration therefore includes a **new, narrow SELECT grant for exactly those four columns to service_role**. This grant has NOT been applied. No session tokens, refresh tokens, auth settings, user grants or MFA enrollment behavior are changed. This explicit privilege addition is a required external-review item before future migration approval.

## Trust boundary

Every private action passes the existing `createNyraHandler` owner gate using **GET status only**: configured origin, `auth.getUser(exactToken)`, membership in `website_owners`, and the verified token's `aal2` claim. A provider-call guard is injected and no AI endpoint is invoked.

The new private layer then:

1. Rechecks `getUser` for that same token; rejects anonymous identities.
2. Checks verified token subject, session UUID and unexpired JWT expiry.
3. Calls `auth.mfa.getAuthenticatorAssuranceLevel(token)` and requires current/next `aal2`.
4. Passes server-derived owner/session/expiry to service-only invoker RPCs.
5. Rechecks owner allowlist and the active `auth.sessions` row (same owner, `aal2`, `not_after`) inside each privileged database operation.
6. Selects/locks Nyra work by **both** work ID and verified owner ID.

Request JSON never supplies owner/session identity, approval flags, public payloads, hashes or a published status as authority. Browser `approval_hash` is a display value only. The confirmation request accepts exactly `{preview_id, request_id}`.

The service credential remains the trusted backend boundary, as in existing Nyra. A database RPC cannot independently verify an HTTP JWT signature: its service-only caller must perform the exact-token checks above. `anon`, `authenticated` and PUBLIC have neither table access nor RPC execution. RLS is enabled on every new table. No new SECURITY DEFINER function is used. No service-role key is returned to browser code.

CORS preflight reuses the existing origin gate. Successful private responses are `no-store`, `no-referrer`, and allowed only for the verified configured origin. Private factory paths are not mounted in the active deployment:

| Private factory operation | Inputs | Result |
| --- | --- | --- |
| `POST /publication/assets` | Exact cover descriptor + explicit rights-review note | Immutable owner/MFA asset-rights metadata record; no upload/download |
| `POST /publication/identity` | Owned eligible work, slug and optional private counterpart ID | Stable non-public identity reservation only; no approval/event/release |
| `POST /publication/preview` | Action, work/version, article/restore pointers, approved presentation selections | Exact v1.1 release proposal or explicit withdrawal target + opaque expiring preview ID |
| `POST /publication/authorize` | Preview ID + idempotency UUID | Atomic human approval/authorization, immutable release, manifest/event and held outbox |

An authenticated owner manually confirming image rights is recorded as a human attestation; this does not turn an arbitrary external image into a verified license. Public delivery still requires Phase 3 asset-byte, MIME, dimensions, ownership documentation and hosting checks.

## Exact approval prerequisites

Publish/Replace require all of:

- Owned `article` work with no active paid step, stage `done`, not imported history.
- Latest selected draft only; no superseded draft index.
- Non-imported run, article `pending_review`, successful stored automated review with `human_required`, no open issues or research requirement.
- Recomputed local `validateArticle`/`validateReview` prerequisites, source/evidence relationships and unchanged paragraph mapping; no new model call.
- Language/format matching the work assignment.
- Existing per-draft presentation revision; complete v1.1 metadata with no silent truncation/repair.
- Explicit owner-reviewed controlled final-cover or owned-template record matching the saved presentation's image URL, source, creator, license, alt, caption and rights confirmation.

Slug, topic IDs, SEO overrides, related IDs and translation selection are explicit review inputs. Missing SEO overrides use the saved share title/description; invalid lengths fail rather than being silently shortened. All public content/sources/presentation hashes and revision UUIDs are assembled by the server. A preview reserves stable identity/slug/canonical for its work before authorization; those identities remain immutable, including after withdrawal. It does not create a public route.

GR/EN identities have separate article/variant IDs and approvals. Translation groups and target identities are resolved from the owner's private registry, never from browser-provided relationship objects. A counterpart can be reserved/prepared privately, but its body is absent from the active export until its own owner action succeeds. Active reciprocal relationships are validated by Phase 1. A stale counterpart preview must be regenerated after a manifest change. When EN is added after GR is already authorized, identity reservation first creates the private EN counterpart without approving or exporting its body; a separately approved GR replacement can then add the dormant EN relationship, followed by the independent EN approval. Identity reservation is idempotent for the same work/canonical and never increments the publication generation.

## Prepared migration review

File: `supabase/migrations/20261027195057_nyra_private_publication_authority.sql`, created with the Supabase CLI migration command. Applied only to disposable local PGlite test databases.

| New table | Purpose / mutability |
| --- | --- |
| `nyra_publication_catalog` | Singleton owner; desired manifest; verified-live manifest forced NULL in Phase 2 |
| `nyra_publication_articles` | Stable per-language IDs, work origin, group, slug and canonical; immutable |
| `nyra_publication_assets` | Owner/session rights attestation and cover metadata; immutable |
| `nyra_publication_previews` | Exact proposal, selected work/version/full private source snapshot; expires after 15 minutes; immutable |
| `nyra_publication_decisions` | Separate human approval UUID and authorization UUID, same approved hash/time, work/version, actor/session, request and preview uniqueness; immutable |
| `nyra_publication_releases` | Immutable public snapshot, linked to private decision |
| `nyra_publication_manifests` | Immutable consecutive desired generations, including explicit empty generation 1 |
| `nyra_publication_events` | Immutable public event payload linked to private decision/generation |
| `nyra_publication_outbox` | Separate operational record constrained to `held`, delivered_at NULL; immutable |

Privileges: SELECT/INSERT only for service_role; only the catalog's desired-manifest column has UPDATE. Immutable triggers reject updates/deletes on the other eight tables. PUBLIC/anon/authenticated privileges are revoked, with no permissive RLS policies. All ten new helper/RPC functions are invoker functions with explicit search paths and service-only execution. Existing Nyra work/state/RLS functions are not changed.

The catalog is initialized only inside an owner/session-checked context call for an owned work. It is bound to that allowlisted owner; another owner cannot take over it. Existing website_owners membership remains the authority mapping for Elias; this PR does not add another public approver or modify the owner list.

## Atomic single-action authorization

Preparation reads authoritative work and publication context, assembles/validates the exact snapshot and stores an immutable preview. The server response exposes only the selected release proposal, withdrawal target, display hash, expiry and non-delivered status. Research, source excerpts, private work snapshots, actor/session IDs, internal history and outbox details are not exposed.

One explicit confirmation then:

1. Revalidates owner/MFA and reads the stored preview, never a browser-supplied replacement payload.
2. Finalizes server audit/issue times only; the approved payload hash and all approved fields remain unchanged.
3. Runs Phase 1 release/manifest/transition validation, including authoritative historical rollback targets.
4. Calls one commit RPC which locks the singleton catalog, owned work and evaluates the immutable preview.
5. Checks expiry, full current work equality, no active work for Publish/Replace, authoritative article lineage, exact manifest baseline, preview consumption and idempotency.
6. Rechecks the entire approved payload and retained candidate export. Only final timestamps and their dependent selected-release reference hash may differ from the stored proposal.
7. Inserts decision, new release (if applicable), next manifest, event and held outbox, and advances desired manifest in the **same transaction**.

Any exception rolls back all commit effects. A failed response can be retried using the same request ID; a committed result is returned exactly once without another decision. The same request ID with another preview conflicts. A consumed preview with a new request ID cannot authorize again. The catalog lock serializes decisions; immutable previews do not need UPDATE privileges or their own row lock. Work row locking/CAS coordinates with existing presentation writes.

## State transitions and invalidation

| Owner action | Prerequisite | Private result |
| --- | --- | --- |
| Publish | Eligible latest work; no previous authorized release for this identity | Sequence 1; desired generation advances; authorized_held |
| Replace | Eligible latest work and active predecessor | New release/approval, next sequence, same canonical and first date |
| Withdraw | Owned active exact target; explicit action | No new article snapshot; tombstone/event; removed from desired active set |
| Rollback | Owned known historical snapshot and current/latest lineage | New approval/release ID and next sequence restoring exact old content/presentation hashes |

For Replace, the selected work must be the identity's originating work or a genuine descendant through authoritative private `state.revision_of: {id, version}` records, matching the existing server-only Nyra revision workflow. `nyra_publication_associated()` checks owner, article kind, language, existing parent draft index, cycles, missing parents and conflicts with another reserved article identity. The context derives associated IDs server-side; the preview and commit RPCs independently repeat the check under row locks. No browser relationship field is accepted. The originating identity stays immutable; decision/preview `work_id` records the actual selected descendant for accurate audit attribution. The existing editorial workflow is not modified.

Withdraw/Rollback require that same article association and exact action target, but do not require an eligible or even present current draft, or idle editorial work. They retain the strict selected-work snapshot CAS between preview and authorization. Withdraw does not require the current working draft to pass review: an owner must be able to withdraw even when a revision is incomplete. Rollback uses a previously approved immutable snapshot, rather than promoting a rejected/current draft. Neither action transfers approval to another language.

Changing any work field after preview invalidates confirmation by full-snapshot comparison. This is deliberately conservative and includes private work bookkeeping/settings, beyond only the approved public fields. Nothing writes approval/status fields into existing editorial JSON.

After authorization, an immutable snapshot remains valid even if its private source work changes, is busy, or has an unfinished revision. `nyra_publication_context()` returns authorized stored snapshots and the desired manifest, not a staleness verdict derived from editable work. `preparedPublicationSet(ctx)` validates those snapshots with the unchanged Phase 1 validator and requires the explicit Phase 2 `authorization_state: authorized_held` / null verified-live boundary. It never imports newer drafts. Retaining the same dataset for an ordinary rebuild does not require workspace equality. Private editing of one article cannot block another article's authorization. Replace, Withdraw and Rollback remain explicit owner actions; editing alone changes neither manifest nor authorization.

`authorized_held` means an undelivered authorization, not publication. This phase still cannot record verified-live delivery. A future verified-live receipt and authoritative live manifest must be introduced separately; neither workspace equality nor an ordinary rebuild may be used as proof of publication. Immutable content validity does not waive deployment timing validation or authorize dispatch.

Reactivating a withdrawn identity with Publish or Replace is rejected. Only an explicit new Rollback authorization can restore an approved historical payload. A new working draft never mutates an older release. Reference hashes, active generation and translation relationships are checked against Phase 1 throughout.

## What is NOT implemented / integration dependencies

- No migration applied to production, no auth/RLS/credential changes executed there.
- No Edge entrypoint wiring, server deployment or live Admin mounting.
- No public exporter or machine credential, GitHub dispatch, workflow change, scheduler or delivery worker.
- No image upload/download/license automation or byte verification.
- No `Published` state. Phase 2 schema deliberately cannot store delivered outbox or verified-live manifest.
- No invention of an author: Nyra remains AI voice; Elias remains editor/final approver/publisher.

Phase 3 must review/host actual approved assets and integrate static rendering/public-only snapshots. Phase 4 must separately approve runtime packaging/mounting, migration execution, minimal credentials/protection, authenticated delivery, retries and verified-live receipts. Held issue timestamps are not evidence of actual publication; delayed never-delivered candidates need the approved fresh-attempt strategy before delivery without mutating an immutable snapshot. The desired manifest is **not** the last verified-live baseline: F01 receipt validation must receive real authoritative live state plus the complete transition chain. No bootstrap receipt is fabricated here.

## Security acceptance and limitations

Synthetic Node 22/PGlite tests cover owner/MFA/origin/session negatives; exact revision/source/presentation and rights checks; imported/unfinished/superseded drafts; duplicate and competing actions; owner revocation and revision changes between confirmation and locked commit; SQL candidate tampering; retention after private edits; GR/EN isolation and reciprocal identities; all four actions; failed transaction rollback and safe retry; strict table/RPC ACLs, immutable records and service-role execution; no private fields/canaries in preview/public snapshots; and escaped exact review rendering.

PGlite executes real PostgreSQL DDL/functions/transactions and role grants locally. Promise interleavings verify logical single-winner behavior, but this is not a native multi-connection PostgreSQL stress test. That check, actual Supabase JWT/MFA integration and full real-browser single-click acceptance remain gates before a future production rollout. The UI component is not mounted; SSR tests do not claim a complete browser E2E test.

No local test calls the OpenAI API. Authentication/providing mocks are synthetic; the service injects a provider-call guard. The existing editorial/model/budget code is imported for local validation and its established GET auth gate only, and is not changed.

## Native Supabase acceptance required before migration approval

The prepared `grant select(id,user_id,aal,not_after) on auth.sessions to service_role` is unchanged. Local PGlite is not a substitute for the following staging/native gates:

- Inspect native `auth.sessions` column types, schema USAGE, column-level SELECT and effective ACLs for the actual service role; run each invoker RPC using the actual PostgREST service role. Confirm no broader auth-table SELECT or browser EXECUTE/SELECT is introduced, all ten functions remain invoker with fixed search paths, and all nine tables retain RLS/no ordinary-client grants. Run native security advisors.
- Use actual signed tokens: Auth.getUser exact-token rejection for invalid/expired/anonymous users; website_owners removal; AAL1 rejection; verified AAL2 success; MFA unenrollment/downgrade; session deletion/sign-out, wrong-user session, expired `not_after`, and refresh/revocation behavior between preview, confirmation and commit. JWT expiry and continued session existence must both be enforced.
- Exercise independent native PostgreSQL connections for simultaneous preview/revision, ancestor lineage edits, duplicate authorization, competing manifest generations, owner/session revocation, failure rollback and retry. Verify row-lock order, deadlock rollback/retry behavior, function ACLs and atomic outbox/decision writes through the real API transaction boundary.
- Verify Edge runtime/schema packaging, origin/CORS restrictions, browser credential exclusion, exact citation review and single-action retry with actual authentication in an explicitly approved staging integration. No endpoints or UI are mounted in this correction.

These checks require a separately authorized native/staging environment. No production migration or privilege change has been applied.

## Recorded verification — 27 October 2026

- Exact local runtime: **Node.js v22.22.0 / npm 11.9.0**. No repository dependency or workflow changes.
- `node --test test/publication-authority.test.mjs`: **57/57 PASS** (11 additional correction regressions; updated immutable-lifecycle regression).
- Additional isolated SQL-tampering and exact-review/image-rendering regressions: **PASS**.
- `npm test`: **245/245 PASS** (188 baseline + 57 Phase 2).
- `npm run build`: **PASS**, 131 modules transformed.
- `git diff --check`: **PASS**.
- Local PostgreSQL catalog audit: **9 RLS tables, 10 invoker helpers/RPCs, 0 ACL/RLS findings** for ordinary roles. No production Supabase advisors run or native local Supabase stack is claimed; the local audit/tests use PGlite.
- New authority/status strings and private fixture canaries: absent from the production build.
- Existing tracked files, Phase 1 contract, active Edge entrypoint, public adapter, prompts, budgets, authentication UI, workflow and public content remain unchanged; this PR adds seven isolated files only.
- No OpenAI API calls, production migration, deployment, workflow dispatch or article publication.

## PR #9 targeted corrections

- F01: immutable authorized payloads survive later private work edits; strict preview-to-commit equality remains. Held desired state is explicitly distinct from verified live.
- F02: private server-record revision ancestry is enforced at assembly, SQL preview and locked commit; unrelated/cyclic/cross-owner/cross-language/conflicting identities fail closed. Administrative actions require association, not a reviewed current draft.
- F03: exact approved block text and each paragraph/quote/list-item citation are visible together; labels resolve against approved public sources, links are HTTPS-only and React-escaped. Full SEO/presentation JSON stays inspectable. No new publication capability.
