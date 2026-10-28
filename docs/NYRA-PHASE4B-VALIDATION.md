# Phase 4B validation and review record

Status: branch-only implementation; Draft PR for external review. Base: `6f611eb43716d77401d1c50467f736bc95be046d`. The PR commit is the authoritative head SHA; no self-referential commit hash is embedded in this document.

## Results

| Check | Actual result | Boundary |
| --- | --- | --- |
| Complete regression, Node 22.22.0 | 322 tests passed; 0 failures; 0 skipped | Includes strengthened actual SQL receipt/idempotency assertions |
| Production build, clean external output | PASS; 139 modules; 1.86 seconds | Normal build, no publication input or enabled export |
| Diff whitespace | PASS | `git diff --check` |
| Node 22 / Deno 2.9.6 equivalence | Byte-identical JSON results | Identical six schema bytes, canonical/Unicode/real-byte hashes, materialization/F01 receipts, negative validation and synthetic RSA verification |
| Native Chromium 153.0.8010.0 preview acceptance | 4 GR/EN desktop/mobile JS cases + 4 no-JS checks PASS | 1440×1000 and 390×844, DPR 1; exact HTTP server, fonts loaded |
| Existing Phase 3 Chromium acceptance | 4/4 PASS | Public synthetic SSR/hydration regression |
| SQL delivery/rights/security | PASS in PGlite | Not native PostgreSQL or Supabase certification |
| Native PostgreSQL / local Supabase Auth, PostgREST, Storage | NOT VERIFIED | No Docker; native PostgreSQL 18.4 initdb refuses root, sandbox rejects non-root uid/gid execution with EINVAL |
| Actual Supabase Edge deployment/package | NOT VERIFIED | No function mounted, migration applied, resource or credential created |
| Production GitHub OIDC / protected job | NOT VERIFIED, intentionally | No token requested or endpoint activated; isolated generated RSA tokens only |

The build tooling emitted the environment-level npm unknown `http-proxy` configuration warning and Node's experimental `EnvHttpProxyAgent` warning. No application build failure occurred. No paid service, research or OpenAI API call was made.

## Security and contract evidence

Synthetic signature/claim tests reject wrong issuer/audience/subject, immutable IDs, branch, workflow/reusable-workflow identity, environment, run/attempt/check-run/SHA, invalid signature/key/header/time and replay. The trusted job adapter correlates actual GitHub API-shaped facts; these fixtures are not evidence of an issued production token. Machine input rejects arbitrary caller-selected release, generation and rollback targets.

SQL tests exercise service-only SECURITY INVOKER ACLs, RLS, immutable rows, exact owner/session/AAL controls, duplicate decisions, stale source generations, lease/fence contention, interrupted attempts and unknown-delivery blocking, permits/artifact binding, actual verified receipt write/idempotency and separate baseline advancement. Actual signed GoTrue JWT/MFA/revocation through PostgREST and parallel native transactions remain mandatory future gates. The optional native acceptance script is prepared but was not run; PGlite results are not substituted for it.

Unchanged v1.1 validators accept publish, replace, withdrawal, rollback, retained rebuild and independent language candidates with full F01 evidence. A candidate never overwrites a held proposal or historical release. The delegated held-intent → newly identified materialized-release mapping is an explicit security-sensitive external-review item, detailed in NYRA-PHASE4B-RUNTIME.md. The complete committed materialized history must be retained; pending desired proposals and abandoned candidate branches must not be represented as already committed history. No v1.1 schema/contract change was made.

Actual-byte owner-authorized assets pass existing Phase 3 Sharp/MIME/dimension/decode/privacy validation, private storage hash verification and minimal build export tests. Private rights notes/session evidence are absent from public bundles. Edge requires a separately approved supported inspector boundary; native Sharp availability is not assumed.

## P4-B01 acceptance

- Eight physical GR/EN preview entries preserve reserved demo slugs and SSR demo content with initial `noindex,follow`.
- No preview URLs in sitemap; no demo content in indexable synthetic public listing HTML; no public article metadata or release records on demos.
- Legacy query navigation redirects client-side to the matching preview namespace; no-JS legacy listing requests retain ordinary public listing HTML.
- Preview language/navigation, direct access, refresh and missing-slug HTTP 404 pass controlled browser/HTTP tests.
- Ordinary normal-build Signals remains unpublished/noindex. No production publication loader or environment switch was enabled.

## Protected surfaces and remaining dependencies

The Pages workflow, homepage/Hero CSS, favicon, package manifests/lockfile, Supabase configuration, Phase 2 authority, and six v1.1 schemas/contract are unchanged. No production state was touched. The separate original checkout and its unrelated pre-existing temporary images were left untouched by using an isolated worktree.

Before any activation: external review of the materialization mapping; native Supabase and concurrency acceptance; actual Edge packaging and asset-inspector validation; approved private Storage integration; trusted attempt registration and independent observer; actual artifact archive/attestation binding; exact protected reusable-job OIDC policy and branch/environment/concurrency protections. `artifact_sha256` currently means sealed public-file inventory digest, not GitHub ZIP digest. No concrete live observer, uploader, dispatch, production permit consumer or route is enabled. See NYRA-PHASE4C-HANDOFF.md for ordered acceptance gates.

## Exact changed files

- `docs/NYRA-PHASE4B-RUNTIME.md`
- `docs/NYRA-PHASE4B-VALIDATION.md`
- `docs/NYRA-PHASE4C-HANDOFF.md`
- `en/signals-preview/index.html`
- `en/signals-preview/what-should-remain-human/index.html`
- `en/signals-preview/which-problems-deserve-funding/index.html`
- `en/signals-preview/who-decides-when-ai-suggests/index.html`
- `gr/signals-preview/index.html`
- `gr/signals-preview/what-should-remain-human/index.html`
- `gr/signals-preview/which-problems-deserve-funding/index.html`
- `gr/signals-preview/who-decides-when-ai-suggests/index.html`
- `lib/publication/runtime/adapters.mjs`
- `lib/publication/runtime/artifact.mjs`
- `lib/publication/runtime/assets.mjs`
- `lib/publication/runtime/controller.mjs`
- `lib/publication/runtime/github-jobs.mjs`
- `lib/publication/runtime/machine.mjs`
- `lib/publication/runtime/materialize.mjs`
- `lib/publication/runtime/node-assets.mjs`
- `lib/publication/runtime/oidc.mjs`
- `lib/signals/static-build.mjs`
- `runtime/nyra-edge/deno.json`
- `runtime/nyra-edge/package-layout.mjs`
- `runtime/nyra-edge/package.mjs`
- `src/signals/entries.mjs`
- `src/signals/main.jsx`
- `src/signals/model.mjs`
- `supabase/migrations/20261028142242_nyra_private_delivery_runtime.sql`
- `test/fixture.mjs`
- `test/fixtures/delivery.mjs`
- `test/fixtures/phase4b.mjs`
- `test/fixtures/publication-authority.mjs`
- `test/phase4b-assets.test.mjs`
- `test/phase4b-browser.acceptance.mjs`
- `test/phase4b-delivery.test.mjs`
- `test/phase4b-deno.acceptance.mjs`
- `test/phase4b-native.acceptance.mjs`
- `test/phase4b-preview.test.mjs`
- `test/phase4b-runtime.test.mjs`
- `test/signals.test.mjs`
- `vite.config.js`
