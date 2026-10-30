# Phase 5C-B2 inactive integration — external review packet

Branch only. No merge or administrative mutation authorized. B1 was merged as
`b53509520792eb3b600b5dd23465aa577023a151`, tree
`1575076dcdadcedd17966378fd5f5235f4b91b04`; post-merge Pages run
[41082727569](https://github.com/Noctua76/eliaskalyvas-website/actions/runs/41082727569)
passed 509 tests / 139 build modules and deployed that exact merge. GR/EN and
Signals HTTP smoke checks passed; the publication witness returned 404.

## Implementation and boundaries

- Three workflow_call-only definitions fix separate nyra-build, nyra-inspection
  and nyra-publication Environments. Each has contents:read + id-token:write,
  immutable approved checkout/setup-node action pins, no production secret,
  Pages write, artifact upload, workflow dispatch or installed caller.
- The inert caller template pins all three reusable definitions to implementation
  commit `64d848bed447a5d873eb961185a9c7a27610161d`. This is a candidate external
  review pin, not evidence that protected invocation already occurred. The caller
  belongs outside .github/workflows until separate installation authorization.
- delivery-policy requires the verified immutable repository prefix
  `repo:Noctua76@217035723/eliaskalyvas-website@1389733212`, exact subjects,
  explicit caller/reusable SHAs, privilege-specific audience/Environment/job,
  main and workflow_dispatch. It does not construct a full subject. Configuration
  is a trusted control-plane dependency, never accepted from a job/request.
- No accepted-configuration.json is shipped. The CLI fails before token acquisition
  or network without that separately accepted configuration. The policy's evidence
  SHA/acceptance flag is operator-pinned configuration, not a substitute for the
  external real-token verification ceremony. Synthetic fixture flags establish
  only test behavior, never successful GitHub acceptance.
- Registrar independently reads GitHub run, referenced_workflows, jobs, check run,
  main protection and Environment rules. It pins the caller commit separately,
  rejects missing/duplicate reusable evidence, ordinary Pages jobs, stale main,
  other attempts/checks/apps and writes immutable facts only after all checks.
- The approved 5C-A OIDC verifier, live protection checker, durable JTI store,
  normal provenance builder/authority and SQL proposal remain unchanged.
- Separate registrar and broker composition factories take distinct SQL roles;
  only registrar can register jobs/inventories or revoke jobs. Broker can read and
  consume JTI tombstones. No database connection, service key, route, listener or
  credential is provisioned by importing these modules.
- Empty operation-only broker transport is disabled by default. It accepts no
  runner job facts, subject/configuration, submitted paths, articles or inventory.
  Future trusted worker adapters receive an opaque authorized grant, not caller
  JSON. The handler is not mounted, and the job execution adapters/IPC are not
  provisioned. This is an executable composition boundary, not deployed delivery.
- Inventory registration authorizes a build identity, obtains an independent
  clean exact-checkout normal build through an explicitly injected isolated adapter to the existing builder, validates its
  path/byte inventory and registered pins, rechecks live job/protection state,
  then atomically inserts only while registration/policy/token are active. The
  existing immutable SQL record is consumed through a publication-only broker
  authority. Uploaded/unprotected/local inventories cannot select the approved
  SQL record. An interruption burns its JTI; retry requires a fresh token and
  immutable duplicate registration fails rather than overwriting evidence.
- Reconciliation remains the approved 5C-A operator-only implementation: unknown
  live lease waits, retired code requires fresh owner initiation, accepted receipt
  stays immutable, cleanup uses the authoritative retired SHA. No inspection
  token is repurposed as a reconciliation credential or owner/MFA authorization.

## Acceptance matrix

| Boundary | Branch acceptance | Real protected acceptance |
| --- | --- | --- |
| Immutable full subject / issuer / audience / repository / ref / Environment | Synthetic signed exact-match positive/negative tests, including old name-only rejection | NOT VERIFIED; full real subjects intentionally absent |
| Caller/reusable SHA / run / attempt / job / check / App | Independent API-fixture registration + approved verifier tests | NOT VERIFIED; actual referenced_workflows shape and claimed full identities require real protected run |
| Cross-job / cross-Environment / ordinary Pages substitution | Denied before registration or execution | NOT VERIFIED against protected settings |
| Replay / expiry / revocation / stale main | Targeted composition tests and durable SQL acceptance | Native concurrency evidence is synthetic identity only |
| Key rotation / old-key rejection | Synthetic key rollover and expiring opaque-grant tests | Real issuer key rollover/revocation operations NOT VERIFIED |
| Protected inventory registration / consumption | Independent rebuild fixture, native/PGlite SQL role and immutable record tests | Real protected normal-build bytes/registration/consumption NOT VERIFIED |
| Code rollover / unknown/interrupted inspection | Existing targeted reconciliation tests retained, no immutable record rewrite | Operational protected worker rollover NOT VERIFIED |
| Normal build isolation / general required checks | B2 Draft PR is the ordinary-PR candidate; exact run/head evidence in PR | Does not authorize publication |
| Native trust store | Targeted PostgreSQL17 using existing digest-pinned DB/Node images, separate broker sessions, internal network, host/external deny and cleanup | Not real GitHub OIDC |

CI uses the installed unconditional B1 checks on GitHub's PR merge revision plus
one targeted exact-head native trust job. It reuses the 5C-A native SQL assertions
and adds registrar/broker/inventory acceptance without booting Auth/Storage/Edge
or repeating the native image inspection suite. Local targeted tests use PGlite;
Docker is unavailable in this workspace, so native success must come from CI.

## Owner-dependent administrative gate — no changes applied

1. Owner nominates an independent reviewer. Current verified count is zero.
   Separately authorize an invitation; wait for acceptance; verify effective
   write-level PR review and Environment review eligibility. Do not guess an account
   or treat this external review as a GitHub approving review.
2. Verify B2's two general required contexts pass and appear in the selector,
   bound to actual GitHub Actions App 15368. Obtain separate owner approval for
   the exact complete classic-main rule and three Environment settings in the
   [B1 ordered plan](NYRA-PHASE5C-B1-PREPARATION.md). No partial rule/admin bypass.
3. Configure and read back protections only under that separate approval. Provide
   a durable authenticated Administration:read source; the current connector's
   403/unsupported routes cannot satisfy runtime live protection verification.
4. Precreate/review all three Nyra Environments, independent eligible reviewers,
   prevent self-review, disable admin bypass, main-only branch/zero tags. Preserve
   github-pages and existing Pages deployment. Do not install the caller first:
   invocation could auto-create an unprotected Environment.
5. Separately approve an isolated registrar, broker, authenticated IPC and worker
   adapters. Provision separate short-lived registrar/broker credentials outside
   jobs; specify issuer/rotation/revocation policy and revoke affected job rows on
   compromise. Jobs receive only short-lived GitHub OIDC, never DB/service keys.
   These factories do not themselves prove OS/process isolation or credential
   rotation. The trusted configuration must be supplied out of band; no production
   policy/configuration artifact or injection adapter is provisioned in this PR.
6. Separately authorize a genuine protected GitHub OIDC acceptance run. Verify
   issuer/JWKS/audience and the complete immutable subjects directly; review exact
   caller/reusable commits, independent job/run/check facts and evidence digest.
   Only then pin final policy. No wildcard, guessed suffix, old-format fallback,
   decoded unverified JWT, boolean flag or unprotected CI inventory can authorize it.
7. Demonstrate real normal-build registration/consumption and operational key/code
   rollover/reconciliation with authenticated isolated processes. Validate how
   the Nyra publication identity interoperates with GitHub Pages authorization;
   github-pages never substitutes for nyra-publication. Real Pages delivery,
   witness/receipt lifecycle and E2E acceptance remain Phase5D; no activation here.

Existing Pages workflow, historical migrations, publication contracts, owner/MFA
and production settings remain unchanged. No production credential, migration,
Storage bucket, Edge deployment, publication dispatch, real article or OpenAI call.
