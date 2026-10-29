# Phase 5A — native security acceptance preflight

> Historical host-preflight / preparation snapshot. Isolated GitHub-hosted execution is now authorized and implemented. See `NYRA-PHASE5A-CI-ACCEPTANCE.md` and the latest PR #13 native evidence artifact for actual execution results. No production activation is implied.

Date: 2026-10-29 (Europe/Athens). Verdict: **NOT READY for native security sign-off or activation**. Native execution is blocked by this host, not established to fail in the application.

## Baseline and scope

Verified GitHub main: `7aa786268e3ad8a37a6f0148cf97891c8abc85f3` (PR #12 merge); tree `ae582c9a37d9ec2a56cf4141fd47ae3ded46dcda`. The previous implementation worktree was clean at approved PR head `948731caf8381311a6971c63037d79fc8706fc0e`; fetched main and created a separate worktree/branch `test/nyra-phase5a-native-acceptance` at the approved main. No application source, migrations, runtime, authentication, contract, workflow or public files are modified. This phase adds this report and `NYRA-PHASE5A-NATIVE-RUNBOOK.md` only.

No production database access was needed for this preflight. No production credentials, cloud staging, external identities, services, storage or paid APIs were created or used. Production publication remains disabled by the unchanged reviewed baseline. No merge, deploy or publication job is requested.

## Actual environment evidence

Commands below were executed, not proposed; absolute cache paths identify already present tools, not additional dependencies added to the project.

| Command/check | Actual result | Interpretation |
| --- | --- | --- |
| `git status --short` / `git rev-parse HEAD` in original worktree | clean / approved PR head above | PASS |
| GitHub `GET /repos/Noctua76/eliaskalyvas-website/branches/main` | approved main SHA | PASS |
| `id` | uid=0, gid=0 | root host |
| `cat /proc/self/status` (capabilities/security lines) | CapInh/Prm/Eff/Bnd/Amb all zero; NoNewPrivs=1; Seccomp=2 | no supported privilege change; no attempt to bypass |
| `command -v docker podman supabase psql postgres initdb` | none on PATH | host native stack unavailable |
| `/var/run/docker.sock`, `/run/podman/podman.sock` | neither present | no existing standard local container socket |
| cached embedded `postgres --version` / `initdb --version` | PostgreSQL 18.4 | wrong major; not PostgreSQL 17 acceptance |
| cached embedded `initdb -D /tmp/nyra-phase5a-preflight-db` | `cannot be run as root` | blocked before cluster creation; no user-switch/isolation workaround attempted |
| cached Supabase CLI `--version` | 2.122.0 | CLI available outside PATH |
| cached CLI `start --help`, `status --help`, `init --help` | local command syntax inspected | documentation/preflight only |
| cached CLI `status --workdir .../phase5a-native` | `StatusDbInspectError`: docker not found (podman also not found); linked_project=null | stack unavailable; JSON error is failure even if process exits zero |
| cached Node binary `--version` | v22.22.0 | regression baseline available |

Exact cached tool commands:

```sh
/root/.npm/_npx/6d82ddbdd7da268b/node_modules/node/bin/node --version
/tmp/nyra-p4c-native-db/node_modules/@embedded-postgres/linux-x64/native/bin/postgres --version
/tmp/nyra-p4c-native-db/node_modules/@embedded-postgres/linux-x64/native/bin/initdb -D /tmp/nyra-phase5a-preflight-db
/root/.npm/_npx/6d82ddbdd7da268b/node_modules/node/bin/node /root/.npm/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js --version
/root/.npm/_npx/6d82ddbdd7da268b/node_modules/node/bin/node /root/.npm/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js status --workdir /workspace/scratch/3b655f1f8047/phase5a-native
```

There is no approved reusable native GoTrue/PostgREST/Storage stack available through the inspected local toolchain. Existing embedded PostgreSQL 18.4 and browser/Deno caches are reusable only for their respective limited purposes, not PG17/full Supabase evidence. No managed/cloud resource was probed as an alternative target.

## Migration dependency review — static evidence only

Apply the eight existing repository baseline migrations in filename order on genuine local Supabase, followed by:

1. `20261027195057_nyra_private_publication_authority.sql`: requires real `auth.users`, `auth.sessions`, native roles, `website_owners`, `nyra_work`, editorial versions and presentation schema. Adds nine public private-access tables, immutable triggers, server-only invoker RPCs and the four-column session grant.
2. `20261028142242_nyra_private_delivery_runtime.sql`: requires Phase 2 identities/decisions/events/manifests and `nyra_publication_actor`/immutable trigger. Adds private `nyra_delivery` schema, control/intent/attempt/candidate/replay/artifact/permit/observation/receipt/history/asset records and invoker RPCs.
3. `20261029145714_nyra_protected_delivery_acceptance.sql`: requires Phase 4B tables/functions and Phase 2 immutable trigger. Adds provenance, starts, dispatch journals, completions and nudge/outcome records plus six invoker RPCs.

Order/dependency references are present in source: PASS (static only). SQL compilation, real auth.sessions types/ownership and effective native grants: NOT VERIFIED. These CREATE migrations are one-time migrations; repeatability means two independent empty stacks with identical inputs, not executing CREATE twice against the same schema. An intentional duplicate apply must fail and must not be mistaken for a migration idempotency requirement.

## Acceptance matrix

| Gate | Status | Evidence or required next evidence |
| --- | --- | --- |
| Approved baseline and documentation-only scope | PASS | SHA/tree and diff gates |
| Safe native PostgreSQL 17 host | NOT VERIFIED / blocked | no PG17 binary, no container runtime; cached PG18 initdb rejects root |
| Real GoTrue, PostgREST, Storage availability | NOT VERIFIED / blocked | CLI cannot inspect/start containers |
| Migration dependency order | PASS — static only | source dependency inventory above |
| Three migrations compile/commit on PG17 | NOT VERIFIED | two clean-stack runs required |
| Native SECURITY INVOKER, RLS, ACL, session-column privileges | NOT VERIFIED | real catalog plus role/HTTP denials required |
| Real owner/JWT/MFA AAL2 acceptance | NOT VERIFIED | signed Auth session and real TOTP challenge required |
| AAL1, non-owner, anonymous, expired JWT denial | NOT VERIFIED | native HTTP responses and zero persisted decisions |
| Logout, revocation/deletion and MFA downgrade | NOT VERIFIED | replay still-unexpired real token against native session state |
| Approval/candidate/receipt immutability | NOT VERIFIED natively | mutation denial under real service_role and unchanged row hashes |
| Concurrent owner approvals / lease contention / fencing | NOT VERIFIED | separate native backend PIDs and observed lock waits |
| Stale generation, replay and duplicate idempotency | NOT VERIFIED natively | native ledger changes/denials, not mocks |
| Rollback-on-error, connection interruption, exact retry | NOT VERIFIED natively | abort/connection-loss evidence and consistent before/after state |
| Native receipt persistence/baseline advancement | NOT VERIFIED | local synthetic observation evidence, no real public deployment |
| GR/EN independence and single owner action semantics | preserved in unchanged code; NOT VERIFIED natively | native lifecycle matrix in runbook |
| Real Edge boot/import/limits and Storage inspector | NOT VERIFIED | native local edge HTTP boot and image checks |
| Real GitHub OIDC/Pages/provenance/verified-live delivery | NOT VERIFIED / out of Phase 5A local acceptance | separate protected end-to-end approval |

No native application PASS or FAIL is inferred from a missing runtime. There is no reproduced production-code defect in this phase; there is also no evidence sufficient to clear the native gates.

## Existing harness limitations (not new production defects)

- `test/fixture.mjs:databaseFixture()` creates synthetic auth roles/tables and stub auth functions. It must never initialize an actual Supabase Auth database.
- `test/fixtures/publication-authority.mjs:authorityFixture()` creates a minimal fake `auth.sessions`, synthetic JWT signatures and mocked Auth/MFA responses, and pregrants session privileges. It cannot prove native Auth behavior or whether Phase 2's own grant suffices.
- `test/phase4b-native.acceptance.mjs` can test one lock-contention/role scenario on native PostgreSQL with mocked Auth; it applies Phases 2/4B only and expects 11 delivery RPCs. Do not add Phase 4C underneath that assertion or report it as full-stack acceptance. Its safe disposable socket restriction stays unchanged.
- `test/phase4c-storage.test.mjs` exercises prepared migration semantics through PGlite. Its test names are not native execution evidence.
- `runtime/nyra-edge/stage.mjs:stageEdgeRuntime()` exports a factory without Deno.serve. Import success is not proof of native Edge listener/HTTP acceptance; a test-only wrapper must be reviewed separately.

Do not fix production code/migrations if a native case fails: retain sanitized reproduction/SQLSTATE/backend PID evidence and stop for external review.

## Regression execution (not native acceptance)

Re-executed on unchanged approved application code using Node **v22.22.0** and npm **11.9.0**:

```sh
PATH=/root/.npm/_npx/6d82ddbdd7da268b/node_modules/node/bin:$PATH npm test
PATH=/root/.npm/_npx/6d82ddbdd7da268b/node_modules/node/bin:$PATH npm run build -- --outDir /tmp/nyra-phase5a-normal-dist --emptyOutDir
git diff --check
```

- Existing full suite: **414/414 PASS**, 0 failed/cancelled/skipped; duration 116038 ms. These remain Node/PGlite/synthetic tests, not native security/concurrency acceptance.
- Clean isolated-output normal production build: **PASS**, 139 modules, 2.22 seconds. No dataset or publication loader was added.
- Documentation diff check: PASS. No test-harness source changed and no additional test cases were claimed.
- Local raw logs: `/tmp/nyra-phase5a-regression.log`, `/tmp/nyra-phase5a-build.log`. Reported results are this phase's local runs, not new GitHub Actions or native results.

## Security preservation and unresolved activation gates

Contract v1.1, owner/MFA authorization, exact content/presentation binding, GR/EN independence, one explicit human publication action, Phase 4B/4C controls, default Vite build and active Pages workflow remain unchanged. No new human approval was introduced.

Native security gates above remain open. So do protected OIDC/reusable-workflow identity, branch/environment rules, server credential lifecycle, independently trusted normal-build inventory provenance, actual artifact/Pages correlation, uncertain/late reconciliation policy, approval of deployment_completed_at meaning, witness/verified-live receipts, ordinary rebuild/safe code rollback and full publish/replace/withdraw/rollback end-to-end acceptance.

## Recommended next step

Review the companion runbook, then run it on an already owned Docker-capable nonproduction machine with unprivileged PostgreSQL 17 container processes, loopback-only ports and network egress isolation. No new hosted service is necessary; incremental service charge is zero on existing hardware (normal local disk/compute usage still applies). If no such host exists, obtain explicit approval for the chosen disposable VM/provider, budget and isolation before provisioning anything. No cost, cloud staging or new credential creation is authorized by this report.

The runbook is a reproducible acceptance plan, not a completed full native automated harness. Native Auth/Edge adapters, two-connection race drivers and result assertions still require implementation/review in the isolated test scope before any gate can pass. STOP for external review; no production activation.
