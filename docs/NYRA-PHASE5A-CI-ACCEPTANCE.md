# Phase 5A — isolated native CI acceptance

Production baseline: `7aa786268e3ad8a37a6f0148cf97891c8abc85f3`. Dedicated Draft PR #13, branch `test/nyra-phase5a-native-acceptance`. No merge/deploy authorization. Only test workflow, native test driver/configuration/fixtures and acceptance documentation are changed. Existing application, Contract v1.1, all migrations, auth logic and Pages workflow are unchanged.

## Actual executed evidence

Completed native run: https://github.com/Noctua76/eliaskalyvas-website/actions/runs/40922654755

Its tested source was `9aa829a6a6c99c648973dcafbb41aaf79ef06f1a`. Both clean native stacks passed all eleven migrations, native catalog/privilege/RLS assertions, actual GoTrue TOTP/JWT/AAL2/negative Auth tests, native C01–C14 assertions and private Storage. Their normalized catalogs matched. Real session SELECT privileges were exactly id/user_id/aal/not_after; the eleven other native session columns were not readable by service_role. PostgreSQL ran as UID 100, not root.

This run also **reproduced native Edge bundle boot failure**. It must not be interpreted as full production readiness merely because the runner classified this preliminary gate NOT VERIFIED and therefore reported overall success. Executed boot failures are classified as **FAIL**, never converted to PASS. The final harness corrects its own bundle layout using the supported pinned-runtime static-asset mechanism, as described below; its actual result must be read from the latest exact-head run. The latest PR #13 workflow logs/artifact are authoritative for the subsequently expanded wire-level C09, stale-operation C05 and queued-replacement C13 assertions. Do not substitute an earlier run if the final executable revision fails.

Each run publishes `native-results/results.json`, image metadata, per-stack input migration SHA256s/catalogs and sanitized Edge/Storage boot logs. The artifact source is `git rev-parse HEAD`, asserted equal to the event's expected PR head, with a clean tracked tree. The pull_request merge SHA is recorded separately as eventSHA and can differ; it is not substituted for the tested checkout. Inspect the exact checkout step/head SHA in logs. No local-host or PGlite outcome is scored as native evidence.

## Native Edge finding — P5A-E01

In actual `supabase/edge-runtime:v1.77.4`, the test bundle starts at a relocated module URL such as `file:///var/tmp/sb-compile-edge-runtime/publication/index.ts`. The unchanged contract loads schemas through `new URL('../../contracts/nyra-publication/v1.1/', import.meta.url)` and `readFileSync()` (`lib/publication/contract.mjs`, schemaRoot/schemas initialization). The native runtime reports:

```
ENOENT: no such file or directory,
open '/var/tmp/contracts/nyra-publication/v1.1/shared.schema.json'
```

The initial main worker was destroyed before the expected default-disabled 503 response. Schemas were present at `/native/contracts` in that read-only test package; flattening the main service to the contract module's directory changed the import.meta.url ancestry. This demonstrates failure of the **initial test bundle layout**, not a proven defect of the original raw staged package, which remains NOT VERIFIED.

The pinned v1.77.4 upstream CLI source (`cli/src/flags.rs` and `cli/src/main.rs`) supports `start --static <glob>`. The final test-only package uses a real function root at `/native/nyra-delivery`, an index importing `./lib/publication/bundle.mjs`, unchanged schema files under `contracts/nyra-publication/v1.1/`, and `--static './contracts/**/*.json'`. This preserves the loader's original module-relative ancestry and includes those public schemas through the native compiler. No special `/var/tmp/contracts` mount, loader rewrite, filesystem escape, production config change or network relaxation is used. This is a harness packaging correction within the approved scope; it is not a production source correction. The latest exact-head CI must establish its native result. Any remaining genuine source/runtime incompatibility requires external review before production-code correction.

Enabled protected Edge operations, operational limits, native Edge image decoding/inspection and production packaging remain hard blockers. Successful Node/Sharp inspection is explicitly not native Edge image-inspector acceptance.

## Reproducible execution and isolation

`.github/workflows/nyra-native-acceptance.yml` runs only for PR #13 from this repository's dedicated branch on standard `ubuntu-24.04` GitHub-hosted runners. Pinned checkout/setup-node/upload-artifact actions; only `contents: read`. No environment, production secret, id-token/Pages/deployment permission, workflow dispatch or persisted checkout token. Native and regression jobs are independent, so native failure does not hide regression/build evidence.

Commands executed by the workflow:

```sh
npm ci
npm ci --ignore-scripts --prefix ops/native-acceptance
NYRA_NATIVE_CI=1 node ops/native-acceptance/run.mjs
# Independent regression job:
npm test
npm run build
```

`run.mjs` requires GITHUB_ACTIONS, RUNNER_ENVIRONMENT=github-hosted, Node 22 and explicit opt-in, rejects production Supabase environment values, and pulls only immutable images from `images.lock.json`. It generates unique run/attempt/stack project IDs and fresh local-only keys. The seven image pins are from official upstream references/registry manifests; actual RepoDigests are captured after pull. No mutable tag is executed.

The two stacks run sequentially with fresh independent native database/Auth/Storage state. All images are acquired before creating an internal Docker network. New container-initiated host traffic and forwarding outside that bridge are denied by explicit iptables rules. External IP, metadata-service and bridge-host probes must fail before services start. Containers are not privileged and gain no added capabilities. The native Node driver is unprivileged, cap-drop ALL, no-new-privileges, read-only source/rootfs, with only a private credential-file mount, evidence output and bounded temporary storage. No Docker socket is mounted in it. No service has a published host port. The test SDK gateway binds only its container's loopback and maps only fixed local Auth/PostgREST/Storage services.

Native service schema bootstrap health must complete before application DDL. No fake auth tables, roles, sessions or signed-token mocks are installed. Role password initialization follows upstream Supabase docker roles initialization; no extra grants compensate for application failures. All eleven repository SQL files are applied unchanged in dependency order, with recorded input hashes and fail-stop errors. A 40P01 during an earlier concurrent bootstrap is retained in run history; it was not silently retried or repaired by changing a migration. Healthy bootstrap ordering is tested on two clean stacks.

Only synthetic @example.test identities, genuine local GoTrue-issued JWTs and TOTP challenges are used. Email autoconfirm/noop mail and phone/SMS disabled. Local service/anon keys are generated for this disposable stack; no production/machine publication credential is created. JWTs/keys/passwords are not included in evidence. Cleanup removes only named test containers/volumes/network/firewall rules and temporary local credentials, including a named driver on interruption. No global prune, user switch, seccomp bypass or production access occurs.

## Version and image inventory

Executed native PostgreSQL: **17.6**, server_version_num **170006**. GitHub orchestration/regression: Node **22.23.4**, npm **10.9.9** in the completed runs. Native driver: Node **22.22.0**. GoTrue **2.197.0**, PostgREST **14.18**, Storage **1.81.0**, Edge Runtime **1.77.4**. See actual RepoDigests in CI evidence rather than assuming a tag proves image identity.

| Component | SHA-256 image/index digest |
| --- | --- |
| supabase/postgres 17.6.1.136 | f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00 |
| supabase/gotrue v2.197.0 | 1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b |
| postgrest/postgrest v14.18 | c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf |
| supabase/storage-api v1.81.0 | 98ffec5d0678803783c30e404c27f4ec65e97efbe014088f2a86b4b8b54b9f54 |
| supabase/edge-runtime v1.77.4 | ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8 |
| node 22.22.0-bookworm-slim | dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 |
| curlimages/curl 8.16.0 | 463eaf6072688fe96ac64fa623fe73e1dbe25d8ad6c34404a669ad3ce1f104b6 |

## Acceptance cases and boundaries

Latest `results.json` gives actual PASS/FAIL/NOT VERIFIED per stack. The following describes assertions, not an unconditional success claim.

| Case | Native assertion |
| --- | --- |
| C01 | Concurrent real owner authorizations; observed database lock barrier; exact duplicate result and one decision |
| C02 | Competing prepared approvals; one 200, one stale 409; no lost generation |
| C03 | Native selected-work row lock; concurrent private edit causes PUB_STALE_WORK 409 |
| C04 | Two distinct native service backend PIDs plus monitoring connection; observed blocking PID; losing claim P0001/DELIVERY_LEASE_BUSY |
| C05 | Fence increments after explicit reconciliation; old candidate/export/artifact/permit/receipt writes rejected |
| C06 | New real owner intent invalidates old-generation export; approved other-language snapshot remains |
| C07 | Native JTI replay and wrong run/attempt/code SHA rejected |
| C08 | Failed provenance statement leaves no artifact; exact valid retry persists once |
| C09 | Native disconnect before commit rolls back; TCP proxy observes PostgreSQL COMMIT completion but drops acknowledgement before client receives it; exact retry leaves one durable record |
| C10 | Started then unknown delivery blocks takeover despite expired lease; recovery facts explicitly synthetic/local |
| C11 | Wrong/foreign stored-candidate transition digest denied, including an otherwise matching duplicate receipt identity |
| C12 | Native receipt persistence/idempotency and exact verified baseline advancement; unchanged runtime rejects synthetic delayed/late timestamps |
| C13 | Pending publish/replace/withdraw/rollback retains private decisions without fabricated public history or inherited never-live date; independent EN retained |
| C14 | Native mutation denial for immutable approvals, releases, candidates and receipts |

PostgREST pool scheduling must not be assumed. C01/C02 capture only server-finalized commit arguments after genuine Auth/MFA and native HTTP confirmation, then execute the unchanged commit RPC on two explicit native service-role connections with a third monitor. This is a test-only database transport at the already authenticated boundary, never caller-supplied approval data. Other authority actions use actual PostgREST execution; C04 also proves distinct native connection contention. Stack B reverses C02 proposal order. Missing per-stack results are individually NOT VERIFIED, never filled by a PASS from the other stack. C09 packet interruption is confined to the local test database connection; no provider/GitHub ambiguity is manufactured. Cases C05/C10/C12 use synthetic observer facts to test native ledger mechanics; they are not proof of a real deployment, trusted GitHub provenance or verified-live public availability.

Real Auth assertions: signed owner AAL2 accepted; missing/forged/anonymous/AAL1/non-owner denied; native SQL session deletion denies an unexpired signed AAL2 token (both HTTP and SQL actor boundary); real GoTrue expiry and logout denied; real TOTP unenroll followed by replay of the still-unexpired AAL2 token denied. A separate disposable B is temporarily allowlisted solely to isolate session revocation from non-owner rejection, then removed. No production identity is used.

Private Storage assertions: real bucket with public=false; AAL1 blocked before upload; native owner/MFA upload through unchanged private asset runtime and existing Node inspector; immutable real rights decision and asset link; byte-identical service download; anonymous and other-user denial; MIME/hash/dimension/rights negatives. These are native Storage plus existing **Node/build** inspection, not Edge-native image support or legal licensing proof.

## Regression and production gates

Existing suite remains 414 tests; completed cited runs have 414 PASS, zero failed/skipped and clean 139-module builds under Node 22. The final PR run must confirm these again after the last harness change. The workflow also scans normal dist for publication witness and native/private/synthetic fixture markers. This test-only workflow never uploads dist as Pages or deploys it.

No existing source/migration was corrected. No production Supabase migration/grant, Edge deployment, bucket/credential, endpoint/exporter/worker mount, protected publication dispatch, real article or paid API execution occurred. Native local Auth/SQL/Storage acceptance applies to the recorded versions, not uninspected production configuration.

Hard blockers remain: native Edge packaging fix/retest and supported image inspector/resource acceptance; protected GitHub OIDC identity/exact reusable workflow SHA; branch/environment protections; independently trusted normal-build inventory provenance; production credential lifecycle and least privileges; real artifact/Pages/permit/witness/receipt end-to-end acceptance; approval of deployment_completed_at semantics and uncertain/late recovery; complete publish/replace/withdraw/rollback and ordinary rebuild/safe code rollback against actual delivery. No gate is waived by this branch. STOP for external review.

## P5A-E01: native Edge static packaging correction

The focused diagnostic at head `4dcb99bf093803491c19c60d0907ddd7c243a3a1`
(run `40932440114`) tested the actual v1.77.4 `EdgeRuntime.userWorkers.create`
execution path before changing any loader. The original test instead ran the
application as the runtime's main service. Its bundled module URL was
`file:///var/tmp/sb-compile-edge-runtime/nyra-delivery/lib/publication/bundle.mjs`;
Node attempted to open
`/var/tmp/sb-compile-edge-runtime/nyra-delivery/contracts/nyra-publication/v1.1/shared.schema.json`
and failed ENOENT. Mounting more files at that compiler path is not the solution.

In the real user worker, supported `staticPatterns` package the six files into
its virtual filesystem. The official pinned runtime example's
`context: {useReadSyncFileAPI:true}` is required for repeated Node synchronous
static-file reads. This is a supported API option, not a host permission grant,
filesystem remount or disabled authorization check. The diagnostic with that
option false retained its PermissionDenied outcome; no bypass was introduced.
Raw module URL:
`file:///var/tmp/sb-compile-edge-runtime/raw-sync/native-entry.ts`.
Independent bundle URL:
`file:///var/tmp/sb-compile-edge-runtime/bundle-sync/lib/publication/probe-bundle.mjs`.
All six hashes matched via Node and Deno, relative and module-URL reads, in both
variants. Missing shared.schema.json rejected the module import. Appending a
newline produced a different hash but previously still loaded valid JSON.

No change to `lib/publication/contract.mjs`, any JSON schema, Ajv configuration,
canonicalization, hashes of approved publication payloads, approval authority or
migration is needed or made. The narrowly scoped packaging correction is:

- `stage.mjs` retains the normal pinned npm import-map mode and adds an explicit
  offline-dependency mode for isolated CI. It vendors unbundled dependency files
  from locked npm-ci packages, verifies Ajv/parse5 versions, and preserves every
  application module and schema byte. No registry/network access is required
  inside the isolated stack. The original npm-import mode was attempted in the
  first diagnostic and was blocked by the deliberately absent registry egress;
  that infrastructure outcome is not presented as a successful native npm-mode
  boot. The final native raw test uses the actual offline stage output.
- `schema-assets.mjs` fixes the six approved file-byte SHA-256 values as a private
  Edge package inventory. The generated factory entry calls this guard before
  dynamically importing the unchanged application. Missing files throw; even a
  valid-JSON whitespace alteration throws `EDGE_SCHEMA_INTEGRITY`. There are no
  embedded/fallback schemas, caller-selected hashes or replacement validators.
- `edge-package.mjs` stages the raw package first; a separate copy is bundled
  afterwards. Neither variant rewrites application code or schema contents.
  Deliberately missing/altered copies exist only as negative test inputs.
- The test-only main gateway selects an exact fixed variant and creates a real
  user worker with static files. It passes no credentials or environment values.
  Only the standard read-only source package is mounted, not the compiler path.
- Assertions independently hash all six static files using WebCrypto, require
  the guarded factory plus six Ajv schema imports, test default-disabled 503,
  and test enabled-handler denials for missing/invalid tokens, browser Origin
  and anonymous GET. A deliberately rejecting machine verifier cannot grant
  access; private DB/fetch call counters must stay zero. These denial tests do
  not establish positive real GitHub OIDC acceptance.
- Every schema is removed and altered individually in native raw workers; the
  independent bundle also exercises both negative cases. A diagnostic listener
  returning 200 is never counted as application boot when coreLoaded is false.

The final exact-head workflow runs the focused assertions and then the complete
native suite in **two fresh independent environments**, followed by the separate
Node 22 full regression/build job. Final run results and exact-head evidence are
reported in PR #13. Earlier accepted passes are historical context, not evidence
for modified source. Native Edge resource-limit acceptance and native Edge image
inspection remain **NOT VERIFIED**; Node/Sharp Storage inspection does not waive
these gates. Production Pages, public entrypoints, migrations and credentials
remain unchanged and inactive. No merge or deployment is authorized.
