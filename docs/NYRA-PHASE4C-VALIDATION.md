# Phase 4C validation and external-review inventory

Baseline: `d4fb25d0f44578c5ea25f35ab8972b75c8ef06b7`.
Branch: `feat/nyra-phase4c-integration`.
Architecture and all approval gates: [NYRA-PHASE4C-INTEGRATION.md](NYRA-PHASE4C-INTEGRATION.md).

## Executed local verification

Node **v22.22.0**, npm **11.9.0**. No OpenAI requests.

| Check | Result |
|---|---|
| `npm test` | **387/387 PASS**, zero failed/skipped; 51 new Phase 4C tests over the 336 baseline |
| `node --test test/phase4c-*.test.mjs` | **51/51 PASS** |
| Final immutable-action pin checks | **10/10 PASS** (dispatch/workflow test file) |
| Six new RPC ACL/transaction checks and nudge claims | **7/7 PASS** (storage test file; PGlite only) |
| Clean `npm run build -- --outDir /tmp/nyra-p4c-final-dist --emptyOutDir` | **PASS**, 139 modules |
| `git diff --check` | **PASS** |
| Normal-build isolation scan | **42** HTML/JS/JSON/XML/text files; no private/synthetic/runtime/witness markers |
| Local native Chromium **153.0.8010.0** | **28 no-JS cases + 12 JS cases PASS** |
| Actual native CSS viewports | **1440×1000**, **390×844**; no simulated iframe/resizing; preview overflow assertions PASS |
| Read-only production HTTP smoke | **33 URLs**, actual 404s; **7** referenced client bundles scanned; **5** static assets byte-identical |
| Production browser smoke | GR/EN homepage, Booking calendars/forms, Admin sign-in, privacy/terms, cookie dialogs, Signals waiting/listings, legacy preview navigation and refresh PASS |
| Local Deno **2.9.6** integration composition import | **PASS** using locked local dependencies; not native Supabase Edge evidence |

Native browser tests explicitly create contexts with `javaScriptEnabled:false`. Initial preview HTML contains the sample content and `noindex` without canonical/JSON-LD. Legacy query URLs without JS retain protected ordinary initial HTML rather than injecting demo content. With JS they navigate into physical preview namespaces. All legacy demo slugs remain reserved. No real article was exported to production.

The optional direct native-browser production stage encountered `ERR_CERT_AUTHORITY_INVALID` in that disposable Chromium trust store. No TLS warning was bypassed and no `ignoreHTTPSErrors` was enabled. Production interactions were verified separately in the supported browser with its normal trusted certificate store. An initial curl request for robots timed out; a bounded retry and the complete HTTP smoke subsequently passed. These were environment limitations, not suppressed application failures.

## Failure, retry and reconciliation matrix

| Scenario | Verified local behavior / remaining gate |
|---|---|
| Schema-valid JSON, copied build capability, foreign code/run, unsupported export version | Rejected before trusted build |
| Missing/extra image, bad actual hash/rights proof | Rejected; existing Sharp decode/MIME/dimension/private-metadata checks reused |
| Changed approved paragraph, second citation, public source, summary or disclosure | Rejected by independent semantic observation |
| Changed SEO, hreflang, duplicate schema or witness | Rejected; no verified receipt |
| Wrong GitHub ZIP digest, foreign run, unsafe/duplicate tar entry, corrupt ZIP | Rejected; no permit |
| Missing/ambiguous artifact | No newest-by-assumption selection; fail closed |
| New owner approval after permit, before start | SQL rejects stale source generation; no start record |
| Failed provenance insertion | Existing artifact insertion rolls back in same transaction; exact retry succeeds |
| Duplicate start / dispatch response uncertainty | Start consumed once; broker performs one Pages POST, no hidden retry |
| Duplicate legitimate receipt | Existing Phase 4B receipt idempotency retained; service returns stored verified receipt |
| Started job with lost response, stale CDN bytes, incomplete routes, failed provider status | `unknown`; ledger blocks new delivery |
| Terminal job without consumed start and independently unchanged prior public state | `never_deployed`; eligible for a fresh attempt without fabricating a live release |
| Late observed live result | `timing_exception`; preserve original materialization and observed dates; operator reconciliation required |
| Ordinary rebuild retaining historical releases | Retained releases do not get new-release timing windows |
| Independently approved GR-only / EN-only / both | Trusted isolated builds expose only approved variants; absent language stays waiting/noindex |
| Withdrawn route remains available | Observation fails rather than trusting GitHub success |
| Reconciliation after job termination | Internal server-ledger selection method exists; scheduling/native acceptance NOT VERIFIED |
| Duplicate outbox polling / lost nudge response | Durable generation claim, immutable accepted/unknown result, no blind resend |
| Old code rerun after main advances | Current-main job facts reject stale code SHA |
| Anonymous/non-owner/AAL1/private workspace changes | Existing Phase 2 owner/MFA/revision and Phase 4B regressions preserved in full suite; native Auth acceptance still NOT VERIFIED |

These tests use synthetic data, simulated trusted GitHub responses and PGlite. They establish branch behavior, not native Auth/JWT/MFA or real protected GitHub acceptance.

## Native limits that remain NOT VERIFIED

- Native PostgreSQL: locally installed disposable PostgreSQL 18.4 binaries are available, but `runuser` fails with `cannot set groups: Operation not permitted`; no root-initdb workaround attempted. No actual multi-connection native transaction result is claimed.
- Supabase CLI native serving: `ServeLocalDbInspectError`, Docker/Podman absent. No cloud stack was provisioned. Auth/JWT/MFA/revocation, PostgREST, real RLS/ACL/session-column grants, Storage and Edge handler boot/resource acceptance remain open.
- Staged Deno/npm graph: online registry resolution did not complete and was stopped; the local locked-dependency composition import passed. Staging preserves source layout and schema bytes but contains an importable factory, not an enabled server entrypoint.
- Real GitHub OIDC/environment/subject/audiences and exact reusable job identity: no production token issued, secrets configured, protections changed or workflow dispatched. The reusable pin remains an explicit activation placeholder.
- Real artifact ZIP/Pages broker/numeric Deployment relation, native Edge memory/CPU, private Storage and supported owner-upload inspector: not accepted for production. Archive support is intentionally bounded and fails closed on ZIP64/unsupported structure.
- The Pages API supplies status, not a precise physical completion event. External review must approve the documented first-authoritative-confirmation timestamp semantics or require a different authoritative source before activation.
- Production outbox/reconciliation schedules, credentials, unknown-nudge operational recovery and real end-to-end acceptance require separate authorization.

## Protected scope

Unchanged: all v1.1 schemas and `contract.mjs`; Phase 2 authority and migration; Phase 4B migration; `.github/workflows/pages.yml`; public sitemap/robots; existing homepage/Hero/favicon, booking/Admin/legal and Signals client design/routes. The default build has no production publication dataset acquisition path. The only existing runtime correction is the demonstrated JSON-prototype interoperability fix in `machine.mjs`; no approved release field is changed.

Read-only production inspection still lists the nine existing Supabase migrations and only `website-api` v21 / `nyra-api` v6. No Phase 2/4B/4C production migration, Edge deployment, bucket, secret, publication endpoint, dispatch, receipt or publication was created. Main remains the approved baseline. No merge/deploy is authorized by this branch.

## Exact changed files (26)

```text
docs/NYRA-PHASE4C-INTEGRATION.md
docs/NYRA-PHASE4C-VALIDATION.md
lib/publication/integration/archive.mjs
lib/publication/integration/build.mjs
lib/publication/integration/dispatch.mjs
lib/publication/integration/github.mjs
lib/publication/integration/observer.mjs
lib/publication/integration/outbox.mjs
lib/publication/integration/runner.mjs
lib/publication/integration/service.mjs
lib/publication/integration/transport.mjs
lib/publication/runtime/machine.mjs
lib/signals/static-build.mjs
ops/publication/pages-delivery.yml.proposed
ops/publication/pages-orchestrator.yml.proposed
package-lock.json
package.json
runtime/nyra-edge/deno.json
runtime/nyra-edge/integration.mjs
runtime/nyra-edge/stage.mjs
supabase/migrations/20261029145714_nyra_protected_delivery_acceptance.sql
test/phase4c-browser.acceptance.mjs
test/phase4c-dispatch.test.mjs
test/phase4c-http.acceptance.mjs
test/phase4c-integration.test.mjs
test/phase4c-storage.test.mjs
```

STOP for external review. Draft PR only; no production activation.
