# Final integration and delivery — review and operator runbook

This is branch-only implementation, not production authorization. The owner explicitly
approved the repository-scoped policy replacement for branch implementation on
1 November 2026; that chat decision is not a signed live risk receipt. Baseline main
`dea8c5ede7df2d11a2de856d966046ca341f1ed6`. No OpenAI calls, infrastructure,
credentials, migrations, Edge deployment, protected dispatch or public article is
created by this change. PR24/25 and Trust Policy v2 are not incorporated.

## Verified current production / compatibility

Read-only Management API on 1 November 2026 confirmed `nyra-api` ACTIVE v6 and
nine applied migrations, ending in `nyra_article_presentation`. The five files
below remain unapplied. Information-schema read-back confirms the existing
`nyra_work` and `nyra_steps` column/type/nullability layout used by the committed
editorial migrations. Production migration history uses different timestamps for
several old files: compare schema/definitions and applied names, **do not replay
all repository migrations or renumber deployed history**. No editorial data was
read. Active `supabase/functions/nyra-api/index.ts` remains workspace-only;
`.github/workflows/pages.yml` remains unchanged and the sole active deployer.

## What is connected

- `createFinalEditorialApplication` binds the existing workspace/publication
  handler to separate accepted/quarantine private Storage adapters. It is an
  importable server factory, not a listener or an environment-based trust bypass.
  Off by default; enabled construction requires a reviewed immutable code SHA,
  two different private bucket names and a trusted server-side assertion function.
- The assertion is still the approved live administration/owner-risk/OIDC policy
  control plane. A browser, workflow input, `true` environment flag, v2 diagnostic
  or mock does not provide that assertion. Real composition must revalidate active
  policy/registration and authenticated administration at authorization/commit.
- `composeFinalDelivery` remains the separate protected machine root. Service
  credentials are confined to private servers. Registrar/broker LOGINs, signed
  revalidation, private authenticated IPC and the credential-free builder are not
  folded into the browser or GitHub job. Existing watcher/nudges/reconciliation
  remain server-selected and disabled until approved.
- Staging exports the complete editorial and protected machine factories, schemas
  and dependency graph. No staged factory mounts a route. The Edge runtime uses
  pinned AJV/parse5 and the established schema-integrity guard; Sharp stays Node.
- The existing UI appears only when authenticated server status exposes
  `publication_preparation:true`. There is one final editorial authorization
  action. Exact image rights reconfirmation and independent GR/EN decisions remain.

## Executable acceptance and its limits

Run `npm ci`, `npm ci --ignore-scripts --prefix ops/acceptance-bootstrap/runtime`
and `npm test`; the required build/isolation job remains unchanged.

`test/final-delivery-acceptance.test.mjs` connects persisted draft, rights staging
and separate owner confirmation, upload, actual Sharp, preview/approval, actual
SQL outbox/materialization, byte-sealed static artifact, one-shot dispatch,
independent observer logic and immutable SQL receipts. It exercises GR publish,
EN publish, GR replacement, unknown deployment/reconciliation, GR withdrawal and
historical rollback, retaining EN throughout. It checks exact SEO/citations,
JSON-LD, sitemap removal, tampered artifact denial and duplicate dispatch/receipt
idempotency. Auth, OIDC, GitHub deployment and public HTTP are **SIMULATED** there.

The focused `nyra-final-native-lifecycle` PR job reuses existing digest-pinned,
egress-blocked disposable PG17/GoTrue/PostgREST/Storage/Edge infrastructure once.
It applies all 13 committed migrations in order, including all five publication
files, checks native catalog privileges/RLS/invoker and runs the same connected
lifecycle through actual Edge and private Storage with **real local GoTrue owner
AAL2/TOTP sessions**. AAL1, other owner, tampered JWT and revoked-session denial are
native. Its job/OIDC/admin gate, GitHub deployment and public observation adapters
are **SIMULATED**. It does not grant genuine live provenance acceptance. There are
no published ports, paid resources or production secrets. The final lifecycle
driver alone has a bounded 512 MiB noexec/nosuid tmpfs for actual complete website
rebuilds (the prior 32 MiB SQL/inspection-only scratch space is insufficient).
Its disposable HTTP gateway closes both connection hops: CPU-heavy rebuilds must
not reuse stale keep-alive sockets and turn a native read into `fetch failed`.
There is no automatic retry of SQL mutations or production broker change. Normal CI independently
runs the existing native trust/replay/revocation/process-isolation checks.

No Docker/PostgreSQL/Edge daemon exists in the local Work Mode runtime. Native
results must therefore come from the exact-head GitHub-hosted disposable job;
PGlite success is never labeled native Auth or production acceptance.

## Exact production migration order — approval required

Before executing anything: owner approves exact reviewed commit, project
`drebxpsircxmnthnrliw`, five migration hashes, two private buckets, server-only
configuration, deployment artifact, workflow changes and recovery checkpoint.
Take a private recoverable database backup plus the existing Edge v6 source/bundle,
configuration inventory and last verified Pages artifact/code identity. Do not
export secrets or article data into CI artifacts or this repository.

1. Run `ops/publication/sql/preflight.sql` with a separately authorized read-only
   session; compare with the observed production layout. Verify the owner lookup,
   `auth.sessions` columns and existing functions. Check current applied history;
   stop on drift or partial/manual application. Keep all new services disabled.
2. Through the approved migration mechanism, apply each **existing unchanged**
   transaction in this order, recording its actual source hash/history:
   - `20261027195057_nyra_private_publication_authority.sql`
   - `20261028142242_nyra_private_delivery_runtime.sql`
   - `20261029145714_nyra_protected_delivery_acceptance.sql`
   - `20261029194516_nyra_private_asset_inspection.sql`
   - `20261031221433_nyra_final_inspection_queue.sql`
3. Run `ops/publication/sql/postflight.sql`, compare native catalog evidence,
   test anon/authenticated denial, live owner allowlist/AAL2/session checks and
   PostgREST schema reload. Verify missing deployment does not make approval live.
   The migrations retain SECURITY INVOKER, private ACL/RLS and immutable records.
4. Create only the two separately approved **private** Storage buckets. No owner
   browser/direct authenticated Storage access is granted. Re-read `public:false`,
   size limit and access denials before accepting uploads. Quarantine uses operation
   keys; accepted assets are immutable, exact hash-addressed bytes.

A failed transaction is rolled back; stop before the next file. If a previous
file committed, keep all publication services off, preserve committed history and
immutable data, diagnose and use a separately reviewed forward fix. Do not drop
schemas or reverse live approvals. Restore the private backup only through an
explicit owner-approved recovery procedure, with editorial write freeze and
confirmed retention/recovery of any intervening work.

## Edge/server configuration and rollout — approval required

Stage the self-contained runtime with `stageEdgeRuntime` (offline locked deps if
needed). Preserve all relative paths and schema static_files. Install the reviewed
private deployment entrypoint which creates the existing non-persisting server
Supabase client and calls `createFinalEditorialApplication` with:

- existing Supabase server-only URL/service credential, existing allowed origins;
- exact reviewed `codeSHA` from trusted deployment configuration;
- `NYRA_PRIVATE_ASSET_BUCKET` and `NYRA_QUARANTINE_BUCKET`;
- the real approved `assertTrustReady` binding to the active control plane;
- explicit enabled state only **after** genuine trust acceptance.

The factory is intentionally dependency-injected: there is no shipped production
control-plane address/key or unsigned configuration claiming authorization. The
real authenticated decision source, external key pins, registrar/broker transport
and genuine OIDC acceptance remain external deployment prerequisites. Do not
replace them with the native test entrypoint or its simulated assertion.

Before enabling owner publication preparation, deploy to disposable/staging Edge
and repeat real owner/MFA, upload, byte inspection and exact preview. Preserve
workspace Research/Draft/Review/Revision/budget/recovery with deterministic
providers. After approval, replace only `nyra-api`; preserve website-api and all
booking/calendar functions. Begin disabled. Status must show `publishing:false`;
this means editorial authorization is not proof of public delivery. Browser
bundles must contain no service/admin/signing credentials. Keep Node inspector,
private delivery server, watcher/nudge and reconciler separate from owner routes.

## Single deployment-authority transition — approval required

`planPagesCutover` produces an **offline Map of atomic file replacements**, without
writing or calling GitHub. Supply the complete workflow-source inventory, the
reviewed current `pages.yml` byte SHA256 and a real reviewed immutable reusable
commit. It refuses stale Pages bytes or another Pages-write workflow. Its plan
deletes old `pages.yml` and adds `pages-orchestrator.yml`, `pages-delivery.yml` and
the queued inspection reusable. It does not authorize or execute that plan.

1. First install/review the inert reusable definitions at an immutable commit,
   keeping delivery/inspection disabled and no caller installed. Confirm all three
   pinned workflow files exist at that commit. Public normal CI still passes.
2. Establish genuine protected identities and trusted clean normal-build inventory
   for the exact operational caller/reusable pins, **both** push and dispatch
   contexts. Acceptance-only discovery tokens cannot satisfy this policy. A
   source/main move needs a reviewed rollover; never edit SHA pins speculatively.
3. Freeze deployment; wait for or owner-authorize cancellation of any old Pages
   runs. Independently verify none can deploy after cutover. Preserve github-pages
   Environment unchanged. Reconcile any unknown existing deployment first.
4. Through a separately approved PR, apply the atomic plan: remove old caller and
   install only the orchestrator. Preserve normal public VITE configuration,
   existing Pages concurrency group and locked private runtime installation
   **before npm test** (PR21 invariant). Required checks remain enforced.
5. Independently observe the exact first normal build and existing website before
   allowing an owner-approved controlled article. Verify source/artifact/inventory,
   one-shot permit, deployment identity, every public byte, routes and witness.
6. Exercise authorized controlled publish/replace/withdraw/rollback in both
   languages only with explicit permission to expose test content. An unknown
   outcome blocks new delivery; reconciler observes, never blindly redispatches.

Recovery: disable nudges/new permits and retire affected capabilities first.
Preserve ledger/receipts; independently inspect the actual live deployment.
Redeploy the last verified approved snapshot through the protected recovery path.
Restore Edge v6 workspace-only if needed without deleting new private records.
Do not restore ordinary pages.yml over live Signals content: it would remove
approved articles/witness. Returning to the ordinary deployer is permitted only
after an authorized withdrawal, independently verified empty baseline and explicit
owner approval; again use one atomic authority replacement, no overlapping runs.

## Readiness / remaining owner actions

| Boundary | Branch acceptance | Production acceptance |
|---|---|---|
| Editorial engine/budget/recovery | Existing deterministic tests retained | Existing v6; paid provider test deferred |
| Exact rights/Sharp/preview/owner action | Connected local + focused native test | NOT TESTED |
| Five migrations/order/ACL/RLS/atomicity | Local + native disposable test | NOT TESTED; deployment approval needed |
| GR/EN publish/replace/withdraw/rollback/receipts | Connected test, simulated GitHub/public HTTP | NOT TESTED |
| Build/SEO/static bytes/isolation | Real local rendering + required CI | No publication artifact deployed |
| Owner/MFA | Simulated local; real local GoTrue in native job | Existing contract; new routes NOT TESTED |
| Inventory/owner-risk/OIDC/registrar provenance | Approved verifier retained; synthetic negatives | NOT TESTED / BLOCKED by real evidence |
| Pages cutover | Offline atomic plan and negative tests | NOT APPLIED |
| OpenAI provider | No calls required for this acceptance | Deferred key/credit-authorized provider test |

The legacy full-account verifier is retained unchanged for legacy policies only.
The explicitly selected `nyra.repository-scoped-operation-bound.v1` context replaces
that requirement only for the new reviewed configuration; there is no automatic
fallback and no activation of PR25 diagnostics. Unknown external Apps/OAuth/PAT
rights remain UNKNOWN, never none/complete. No new broad capture cycle is required.
The prior 15-minute full-inventory proposal is not used as production policy.

One consolidated production approval may be requested only after the exact-head
branch results and real trust dependencies are resolved. It must name the project,
five migration hashes, private buckets, Edge version/artifact/configuration,
private control-plane identities/key pins, exact GitHub workflow replacement,
reviewed caller/reusable subjects and SHAs, controlled public content, verification
and recovery plan. No paid host/key/credential is provisioned by this PR.

## Exact unchanged migration bytes

| File | SHA256 |
|---|---|
| `20261027195057_nyra_private_publication_authority.sql` | `460308a494304f364b080c6c235f1e3441c250da1a7b9ffe391e160aff73fff6` |
| `20261028142242_nyra_private_delivery_runtime.sql` | `3c505038ddc063c76cd5923905b932343f649c8933857e56d7f061ca3849808e` |
| `20261029145714_nyra_protected_delivery_acceptance.sql` | `3d9e0da70f98addc2cb71f6e425fcbb3daa1842cb19a3f7b46a1fdcd0261cb0f` |
| `20261029194516_nyra_private_asset_inspection.sql` | `e6e3a23174e4426448a2e178b7fb63f2c6e785de5611c0c2a4345e501bc1ed59` |
| `20261031221433_nyra_final_inspection_queue.sql` | `961ad2f1e2d01f6de15815a3eaeca951ab0d1f3decb6cc8753d0629a08acc858` |


## Final Production Activation Packet — repository scope

**Packet status: NO-GO for live activation until the genuine evidence and owner
production approval below exist.** Implementation/tests can pass without creating
that authorization. The existing 763-test baseline and normal Pages remain intact.

### Exact trusted configuration and binding

The new `configuration.repositoryTrust` has model
`nyra.repository-scoped-operation-bound.v1`, a reviewed monotonic version, exact
repository/owner numeric IDs, source SHA, normal-build configuration SHA256,
identities SHA256, governance SHA256 and an independently observed administration
fingerprint. Three exact role identities remain in `configuration.identities`;
the existing integration policy still requires genuine protected OIDC acceptance
before operational policy construction. No observed subject suffix is guessed.

`knownAuthorities` is explicitly historical, source-hash-bound metadata reviewed
by the owner. Each permission is read/write/none/unknown; missing metadata is not
silently filled. `unknownExternalRights` must include unlisted GitHub Apps, OAuth
Apps, personal tokens and unobserved administration mutations.
`inventoryComplete:false` and `exclusiveTechnicalOwnerControl:NOT_PROVEN` are
mandatory. These are risk descriptions, not authenticated completeness claims.

The complete context is included in every role policy hash. Existing registration,
JTI, revocation and immutable inventory checks therefore reject old/mismatched
policies. A scoped publication broker additionally checks the approved normal
inventory's builder policy against the exact scoped build policy and configuration
pin; an old full-account inventory cannot be reused just because governance matches.
An immutable existing code/config inventory is never overwritten: retirement and
reactivation need a reviewed release/clean rebuild under compatible new pins.

`bindRepositoryControlPlane` constructs the **actual** `administrationReader`
using the separately authorized private read-only token source. It does not accept
admin evidence, trust booleans or a policy supplied by a workflow/API caller. Its
required external dependencies are the real owner-risk receipt transport, pinned
owner public key, independently authenticated current policy-state reader, and
existing registrar/broker private IPC retirement transport with its different
pinned evidence key. The owner and retirement signers cannot share a key under
different key IDs: the trusted context pins both public Ed25519 key fingerprints,
not just their names. No private key or credential is shipped in this packet.

Wire the returned `assertTrustReady` into `createFinalEditorialApplication`, and
`getJSON`, `readPolicyState`, `assertAdministration`, `assertTrustActive` into the
existing registrar/broker/final-delivery compositions. These scoped compositions
refuse absent gate hooks. Run registrar and broker in their existing separate
private processes/SQL roles; do not co-locate both credentials in a workflow job.

The actual GitHub read-back reuses all accepted main/CI/App15368, zero-review,
no-bypass, exact Environment/main-only/empty-secret, owner/collaborator/deploy-key
and Actions-default verification. A stable security fingerprint excludes ordinary
issue counters/activity metadata. Inconsistent repeated reads fail closed. Its
oldest relied-on observation must remain under 60 seconds through owner receipt
verification; it is refreshed per privileged operation.

The owner-risk source reuses `existingOwnerMFA`, the signed append-only journal and
fresh challenge-bound signatures. Scoped decisions/receipts have distinct schemas
`nyra.owner-repository-risk-decision.v1` and
`nyra.owner-repository-risk.receipt.v1`; legacy and scoped receipt schemas reject
one another. The authorized context digest, exact role policy hash, operation,
owner/repository, governance version, active/non-superseded state and explicit
unknown-write/admin-mutation risk acknowledgement must match. Fresh receipts last
at most 60 seconds (the existing source issues at most 45 seconds). The existing
owner session/decision window remains bounded, including the existing 15-minute
decision maximum: expiry stops operations, never silently renews approval. A
reviewed operating renewal/owner-MFA arrangement must be verified before claiming
continuous unattended production readiness. This is administration risk consent,
not a second editorial/GitHub Publish action.

On a detected policy/pin/permission/source/owner change or unavailable evidence,
the local authority latches closed synchronously. Wrapped policy/capability guards
deny old claims immediately, while the existing registrar retires its policy rows.
A fresh broker-signed zero-active-registration proof confirms retirement; failed
or unsigned retirement stays closed and is reported unconfirmed. Recovery creates
new reviewed state; correcting a failed response does not revive an old gate.

The concrete binding requires synchronous `invalidatePolicyState(policySHA256s)`
and checks every role's current source after invalidation, before awaiting IPC.
`ops/acceptance-bootstrap/retire-policy-state.mjs` provides the private atomic-file
implementation: the coordinator owns its directory and all workers mount the
**directory** read-only, so renaming the file cannot leave a mounted old inode.
Bind `readPolicyState(role)` to reread that same file on every guard, and bind
invalidation to `retirePolicyState({path,policySHA256s})`; do not cache its contents.
The registrar revokes the exact policy hashes over authenticated private IPC; the
broker's `confirmRepositoryRetirement` independently queries its real SQL identity
and signs `nyra.repository.retirement.v1` with the coordinator's fresh challenge,
context/policies digests, zero active registrations and observation time. A replayed
proof or caller-provided row count cannot complete this operation.

The historical FRA1 launcher/runtime remains the legacy full-inventory acceptance
path. It is not silently converted or made executable by this policy change, and
its retired host, credentials and origin cannot be reused. The new binding is an
importable operational composition, not an installed listener: the approved future
private host must supply and independently verify these state/IPC/key mappings.
No existing factory or historical script is evidence that that deployment exists.

### Reality and residual risks

- Unknown external write paths are owner-accepted residual risk, not proven absent.
  Fresh repository snapshots cannot detect every transient/unobservable App or
  account-admin change. Immediate invalidation applies to observed changes and
  trusted policy state; continuous universal detection is not claimed.
- A sufficiently privileged external integration could alter workflows, website or
  Admin code outside the Nyra delivery boundary, potentially compromising an owner
  browser/session. Exact externally pinned code and the single-authority cutover
  reduce this exposure; MFA alone does not eliminate compromised-site risk.
- Read/signing sources and their private host must actually be independently
  provisioned and accepted. Missing sources, unavailable API permissions or
  arbitrary signed test records are not a live acceptance result. Existing 403
  from Codex is not worked around by expanding Connector permissions.

### What the owner must authorize once, before installation

Approve the exact reviewed PR head/tree, five unchanged migration hashes above,
the two proposed private buckets `nyra-private-assets` and `nyra-quarantine`
(20 MiB maximum), the `nyra-api` staged server artifact and trusted bindings, and
one atomic Pages authority cutover. Preserve `website-api` and `github-pages`.
The immutable reusable source SHA and complete genuine OIDC subjects must first
be independently observed and pinned; acceptance-only discovery cannot publish.

Name the approved private control-plane execution location, dedicated read-only
administration identity (and separately permitted check/job reader where needed),
registrar/broker SQL identities, source/evidence key identities and owner/MFA
receipt transport. Do not send credential values in chat. No resource is created
by this packet. GitHub Actions already supports the Node/Sharp inspection jobs;
no additional paid inspection server is required. Durable independent control-
plane execution remains a deployment dependency; do not silently put its DB/
admin/signing credentials in Actions or collapse registrar/broker privileges.
No new paid host is provisioned or assumed available; retired FRA1 cannot be reused.

Authorize each genuine discovery/provenance invocation explicitly, then the
controlled public GR/EN lifecycle content. These permissions can be specified in
one production authorization with stage-by-stage stop conditions; there is no
second mandatory GitHub reviewer or second editorial approval.

### GO / NO-GO and operator sequence

1. Review this PR and exact-head CI/native evidence. No merge from branch approval.
2. Establish the actual private control plane/read identity and current policy
   fingerprint, real owner MFA decision, key pins and accepted configuration.
   Missing credential/source/host keeps NO-GO; test signers are never installed.
3. With explicit production installation approval: backup and preflight, five
   migrations in the listed order, postflight, two private buckets, disabled Edge
   installation. Verify owner/AAL2/expiry/session/origin/direct-storage denials.
4. With the separately authorized exact-main invocation plans: real OIDC subject
   discovery, independent subject/policy pinning, then fresh registered provenance
   acceptance. Verify API run/reusable/job/check representations, clean rebuild,
   immutable inventory and consumption plus negative/revocation tests. No content
   publication at this stage. Missing GitHub facts or source metadata is NO-GO.
5. Verify no old Pages run can deploy; apply only the reviewed atomic cutover.
   Verify normal site/booking/legal/GR/EN/Signals and exact artifact before content.
6. With explicit controlled public-content approval: publish GR/EN, replace,
   withdraw, rollback, inspect actual URLs/SEO/images/sitemap/hreflang/JSON-LD and
   independent receipts. Prove outbox-driven execution without another GitHub click.
7. GO only if every mandatory live boundary passes and resources/credentials have
   their reviewed operational expiry/rotation/revocation/recovery arrangements.
   On any failure close authority, retire capabilities, reconcile unknown outcomes
   without redispatch, and follow the backup/Edge/Pages recovery plan above.

The packet contains **no** real owner-risk receipt, accepted operational policy,
JWT, signing key, production secret or fabricated deployment evidence. No OpenAI
provider call or credit is required for these acceptance steps.
