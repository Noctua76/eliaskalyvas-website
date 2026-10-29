# Phase 5A — isolated native CI acceptance

Production baseline: `7aa786268e3ad8a37a6f0148cf97891c8abc85f3`. Dedicated Draft PR #13, branch `test/nyra-phase5a-native-acceptance`. No merge/deploy authorization. Only test workflow, native test driver/configuration/fixtures and acceptance documentation are changed. Existing application, Contract v1.1, all migrations, auth logic and Pages workflow are unchanged.

## Actual executed evidence

Completed native run: https://github.com/Noctua76/eliaskalyvas-website/actions/runs/40922654755

Its tested source was `9aa829a6a6c99c648973dcafbb41aaf79ef06f1a`. Both clean native stacks passed all eleven migrations, native catalog/privilege/RLS assertions, actual GoTrue TOTP/JWT/AAL2/negative Auth tests, native C01–C14 assertions and private Storage. Their normalized catalogs matched. Real session SELECT privileges were exactly id/user_id/aal/not_after; the eleven other native session columns were not readable by service_role. PostgreSQL ran as UID 100, not root.

This run also **reproduced native Edge bundle boot failure**. It must not be interpreted as full production readiness merely because the runner classified this preliminary gate NOT VERIFIED and therefore reported overall success. The final driver classifies that executed boot failure as **FAIL**. The latest PR #13 workflow logs/artifact are authoritative for the subsequently expanded wire-level C09, stale-operation C05 and queued-replacement C13 assertions. Do not substitute an earlier run if the final executable revision fails.

Each run publishes `native-results/results.json`, image metadata, per-stack input migration SHA256s/catalogs and sanitized Edge/Storage boot logs. The artifact corresponds to the PR head actually checked out; the workflow's pull_request merge SHA can differ and is not the tested checkout. Inspect the exact checkout step/head SHA in logs. No local-host or PGlite outcome is scored as native evidence.

## Native Edge finding — P5A-E01

In actual `supabase/edge-runtime:v1.77.4`, the test bundle starts at a relocated module URL such as `file:///var/tmp/sb-compile-edge-runtime/publication/index.ts`. The unchanged contract loads schemas through `new URL('../../contracts/nyra-publication/v1.1/', import.meta.url)` and `readFileSync()` (`lib/publication/contract.mjs`, schemaRoot/schemas initialization). The native runtime reports:

```
ENOENT: no such file or directory,
open '/var/tmp/contracts/nyra-publication/v1.1/shared.schema.json'
```

The executed main worker is destroyed before the expected default-disabled 503 response. Schemas were present at `/native/contracts` in the read-only test package; native compilation relocation means that is not the URL the bundle resolves. This demonstrates failure of the **tested bundled packaging**. It does not by itself establish the outcome of the original raw staged package, which remains NOT VERIFIED. No special `/var/tmp/contracts` mount, schema loader rewrite or filesystem escape was added to make the result pass. Neither the Phase 1 contract nor approved runtime/stage code was corrected under this test-only authorization. External review must decide the appropriate separately authorized packaging/source change and require native retesting.

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

PostgREST may serialize requests through its pool; C01/C02 require actual observed blocking rather than inventing two direct waiters. C04 independently proves distinct native connection contention. C09 packet interruption is confined to the local test database connection; no provider/GitHub ambiguity is manufactured. Cases C05/C10/C12 use synthetic observer facts to test native ledger mechanics; they are not proof of a real deployment, trusted GitHub provenance or verified-live public availability.

Real Auth assertions: signed owner AAL2 accepted; missing/forged/anonymous/AAL1/non-owner denied; native SQL session deletion denies an unexpired signed AAL2 token (both HTTP and SQL actor boundary); real GoTrue expiry and logout denied; real TOTP unenroll followed by replay of the still-unexpired AAL2 token denied. A separate disposable B is temporarily allowlisted solely to isolate session revocation from non-owner rejection, then removed. No production identity is used.

Private Storage assertions: real bucket with public=false; AAL1 blocked before upload; native owner/MFA upload through unchanged private asset runtime and existing Node inspector; immutable real rights decision and asset link; byte-identical service download; anonymous and other-user denial; MIME/hash/dimension/rights negatives. These are native Storage plus existing **Node/build** inspection, not Edge-native image support or legal licensing proof.

## Regression and production gates

Existing suite remains 414 tests; completed cited runs have 414 PASS, zero failed/skipped and clean 139-module builds under Node 22. The final PR run must confirm these again after the last harness change. The workflow also scans normal dist for publication witness and native/private/synthetic fixture markers. This test-only workflow never uploads dist as Pages or deploys it.

No existing source/migration was corrected. No production Supabase migration/grant, Edge deployment, bucket/credential, endpoint/exporter/worker mount, protected publication dispatch, real article or paid API execution occurred. Native local Auth/SQL/Storage acceptance applies to the recorded versions, not uninspected production configuration.

Hard blockers remain: native Edge packaging fix/retest and supported image inspector/resource acceptance; protected GitHub OIDC identity/exact reusable workflow SHA; branch/environment protections; independently trusted normal-build inventory provenance; production credential lifecycle and least privileges; real artifact/Pages/permit/witness/receipt end-to-end acceptance; approval of deployment_completed_at semantics and uncertain/late recovery; complete publish/replace/withdraw/rollback and ordinary rebuild/safe code rollback against actual delivery. No gate is waived by this branch. STOP for external review.
