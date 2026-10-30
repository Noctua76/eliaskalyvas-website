# Integrated live trust acceptance — external review packet

Baseline `5f44725f231a4b67eb2983476900833e1637854d`, tree
`bd2f2147829c67c8937c2cf6aab4602351026642`. SINGLE_OWNER stays explicit;
OWNER_WITH_REVIEWERS remains future opt-in. No publication/inspection activation.
This PR implements adapters, one controlled manual workflow and isolated native
acceptance. It does not claim that real protected OIDC/provenance already passed.

## Actual read-back and limits

Authenticated connector reads on 30 October 2026 established:

| Fact | Evidence/status |
| --- | --- |
| Main SHA/tree | Exact baseline above |
| Main protected | true |
| Branch protection summary | enabled, required checks enforcement_level everyone |
| Required checks/source | nyra-required-regression and nyra-required-production-build, each app_id15368 |
| Rulesets | zero; classic protection reported by owner |
| Full branch protection | 403 Resource not accessible by integration |
| Repository permission summary | admin/maintain/push/pull/triage true in the connection context; NOT an App installation permission manifest |
| Latest ordinary Pages run | 41110797525 success, path .github/workflows/pages.yml, owner actor/triggering_actor217035723, check suite111444305418 |
| That run's referenced_workflows | empty array; this is not a reusable invocation compatibility test |
| nyra-build ID | 25832629700, owner-observed; administrative API verification pending |
| nyra-inspection ID | 25833532642, owner-observed; administrative API verification pending |
| nyra-publication ID | 25833663698, owner-observed; administrative API verification pending |
| Zero human collaborators / deploy keys | Owner-confirmed; dedicated administrative verification pending |
| Railway/Render privileged access removed | Owner-confirmed; installation scope read-back pending |
| Codex Connector remains write-capable | Owner-reviewed development dependency; complete installation ID/effective scope evidence pending |
| Default token read-only / Actions PR approval disabled | Owner-confirmed; dedicated API verification pending |

protected=true and screenshots cannot authorize production. The read-only adapter
requires full explicit API protection, bypass, reviewer, collaborator, Environment
ID/rules and empty-secret metadata. It additionally verifies default Actions token
settings and zero deploy keys, and requires a complete independently authenticated
App inventory source. Any inaccessible/ambiguous/incomplete field fails closed.
Only metadata is read; no secret values are requested. No getJSON endpoint can
mutate GitHub. The existing Connector is not granted Administration access.

**Minimum credential action:** owner separately authorizes a dedicated short-lived
fine-grained PAT restricted to this repository, with Administration:read,
Actions:read, Checks:read, Contents:read, Pull requests:read, Environments:read and
automatic Metadata:read. No write or Workflows permission is needed. Prefer a
24-hour acceptance window. Inject it into a private server-side tokenSource/secret
provider on the separately authorized acceptance host. Never paste it into chat,
repository files, Actions secrets/variables, job environment, logs or artifacts.
A repository-scoped read-only GitHub App identity is an alternative under separate
approval; do not expand the Codex installation to obtain this evidence.

Personal-account installation completeness is a separate source requirement:
/user/installations enumerates installations of the authenticated GitHub App, not
all third-party Apps on a personal account. A PAT or that response alone must not
be labeled a complete inventory. Obtain an independently authenticated owner
installation/permission audit, repository coverage and stable App/installation
IDs; record unavailable scope as NOT VERIFIED. No invented all-Apps endpoint or
screenshot-as-authorization fallback is implemented. Until that source is supplied,
readAdministrationEvidence cannot complete and the actual acceptance stays closed.

## Effective App authority and residual risk

The Connector performed authorized feature-branch writes of workflow definitions
in this work. This demonstrates the development connection's workflow-edit
capability on a branch; it does not independently identify every installation
scope or prove protected-main merge eligibility. Earlier authorized merges
occurred before live protection and do not prove the current saved rules.

Contents:write can supply PR merge capability. Workflows:write together with
appropriate content access can modify Actions definitions. Zero approving reviews
plus successful CI does not by itself require an owner-only merge actor. Therefore
a write-capable development App must be treated as potentially merge-capable until
actual permissions/restrictions prove otherwise. No unauthorized canary merge was
attempted. The existing App is neither removed nor narrowed here.

The App assessor never turns a write-capable App into a reviewer or evidence of
exclusive technical control. Any write permission is an explicit owner risk
decision; even a read-only App list does not alone prove exclusive technical owner
control. administrationGate pins the complete App permission digest and owner risk
decision; fresh changed/missing evidence rejects further acceptance. Real-profile
registrar/broker/observation bindings require that gate, independently registered
facts and authenticated owner dispatch metadata. Editorial owner/MFA authority
remains a separate unchanged requirement; development App status grants none.

Before positive real acceptance, owner must explicitly accept documented residual
merge/workflow risk or separately authorize compatible scope/actor restrictions.
Do not silently change App permissions or reintroduce a mandatory second reviewer.

## Minimal workflow and evidence safety

- Caller: .github/workflows/nyra-live-trust-acceptance.yml, workflow_dispatch only,
  no inputs, exact main/ref_protected, owner actor_id217035723, contents:read.
- One job calls the immutable reusable probe at
  `cefd1a402dcffd0b00f05f7d7539ba381120641e`. Reusable jobs fix the three Nyra
  Environments and owner/main/dispatch context; no Environment input is accepted.
- Each probe has only contents:read and id-token:write, reviewed SHA-pinned
  checkout/setup-node, persist-credentials:false and a ten-minute timeout.
- No Pages/deployments/content write permissions, secrets, article data, artifact
  upload, production delivery operation, external workflow dispatch or OpenAI call.
  The nyra-publication job is identity/provenance consumption only, not publication.
- No live-acceptance-plan.json is shipped. The CLI fails before any network/token
  request without a separately reviewed public plan (HTTPS collector origin and
  externally pinned evidence-key identity). It contains no credential or subject
  allowlist. The main SHA is pinned independently by the operator after merge,
  avoiding a self-referential source-SHA file inside its own commit.
- After context checks the probe polls an unauthenticated readiness boolean using
  public run/attempt IDs. The private watcher registers facts from GitHub first.
  No JWT is requested until readiness. This endpoint exposes no credentials,
  policy or private evidence and cannot register anything itself.
- Raw JWT travels only over the reviewed HTTPS collector connection, in memory.
  It is never logged, uploaded or persisted. Disabled collectors return503; the
  operation body is exactly {}, with no policy/inventory/article fields.
- The collector verifies GitHub RS256/JWKS/time/identity using the approved verifier,
  independent live registered job facts and token replay/revocation storage. Owner
  name and ID, actor/triggering actor, caller SHA and reusable pin remain exact.
- Discovery verifies the signed complete subject without inventing its suffix.
  It returns ONLY a sanitized signed observation, authorization:false. Its reserved
  discovery-policy subject cannot authorize an actual token through the exact
  production verifier. No discovered subject is automatically promoted to policy.
- The separate operator-pinned Ed25519 evidence key remains outside jobs. Private
  signed records contain whitelisted claims, issuer kid, token-byte SHA256 and plan
  digest. Jobs receive only receipt digest/key ID, never claims or the JWT.
  A job acknowledgement alone is not acceptance evidence; the independent
  verifier must check the private signed record with the pinned public key.

## Registrar/broker and normal-build acceptance

Existing protected-identity/job-registrar/protected-job-handler/compositions, SQL
roles/immutable rows, OIDC verifier and normal snapshot machinery are retained.
No registrar representation correction is made without actual contrary evidence:
the official API documents path@SHA plus sha for SHA-pinned referenced workflows,
matching current strict expectations. Actual protected invocation remains pending;
missing/branch/tag/ambiguous metadata must fail, never downgrade to a name match.

The actual acceptance composition accepts only the reviewed acceptance caller,
SHA-pinned reusable path, actual Environment IDs and independently approved exact
subjects. It reuses the approved registrar, protected verifier/replay store and
immutable inventory authority. It cannot dispatch or publish. Isolated credential
injection, authenticated administration source and durable active policy state are
external dependencies, not production resources provisioned by this PR.

Native trust CI reuses the existing disposable PostgreSQL17/images/schema suite.
It adds separate registrar and broker containers/LOGINs, read-only roots, private
role-specific mounts and no Docker socket/host/production credentials. A role-
bound, direction/sequence-bound MAC authenticates private stdin/stdout IPC. Broker
revalidation receipts are separately Ed25519 signed, grant/handle/policy-bound and
expire within five seconds; tampering fails before inventory insertion.

Order: independent synthetic registration, broker signature verification, exact
clean-source check, offline rebuild, fresh broker revalidation, immutable SQL
inventory insertion, publication-identity-only consumption. The builder has no DB
network, DB/IPC/signing credential, JWT or service key; a complete source-byte
manifest from the checked clean Git checkout is checked before/after normal Vite
build. The coordinator verifies HEAD/cleanliness before/after. Docker mount/role
inspection and denied broker writes are asserted. Replay/cross-role/revocation and
forged revalidation are exercised; existing expiry/stale/retirement/rollover tests
remain. Containers/networks/test credentials are destroyed in the same native run.

These are REAL native process/SQL/byte assertions with SYNTHETIC job identity.
They do not establish genuine GitHub protected provenance. Real execution must use
the same strict components with actual authenticated facts/JWKS and independently
pinned subjects/state; no synthetic key or fixture can authorize live publication.

## Execution plan — requires separate final authorization

1. Review this exact PR/head and final CI. No merge is authorized in this task.
2. Separately authorize/provide the read-only identity and complete owner App audit.
   Run private administration read-back; resolve exact zero-review API fields,
   Environment IDs/bypass/rules, deploy keys, Actions settings and App risk decision.
3. Separately authorize isolated acceptance host/HTTPS origin, external receipt key,
   distinct ephemeral registrar/broker logins, private authenticated IPC, clean
   builder and durable approved policy-state source. No production service/DB.
4. Complete/review the non-secret public plan in the SAME PR/acceptance workflow,
   refresh exact-head CI as necessary, then obtain merge authorization. Preserve
   github-pages and all current delivery settings. Do not auto-create Environments.
5. After merge, approve the exact main SHA/reusable pin and execution window. Start
   the private registration watcher before Noctua76 manually dispatches main. It
   independently reads live run/job/check/attempt/referenced_workflows and owner
   actors before registration/readiness. Never register facts from the JWT/job.
6. First authorized invocation: observation only, reserved non-authorizing subject,
   private signed receipt for each Environment. Validate actual API representation
   and complete issuer-signed immutable subjects. Fail on missing fields; no raw
   token artifact or public evidence endpoint. Do not promote subjects automatically.
7. Explicitly approve/pin the observed exact subjects in an acceptance-scoped policy
   and fresh registered run. The SAME manual workflow may be invoked again only
   under separate final authorization for registered provenance acceptance, using
   the acceptance composition/real registered facts, offline exact-source bytes,
   active-policy revalidation, immutable registration and authorized consumption.
   A fresh run is required: immutable discovery registrations cannot be overwritten
   with a different policy digest. This is one implementation, not another prep PR.
8. Report PASS/FAIL/NOT VERIFIED, retain only sanitized signed private evidence,
   revoke/destroy acceptance credentials and shut down isolated services. No Pages
   publication/witness/receipt lifecycle or real articles; that remains Phase5D.

## Acceptance matrix

| Boundary | Implemented/isolated evidence | Real live status before execution |
| --- | --- | --- |
| Main/check App summary | Authenticated baseline read, true/everyone/twoApp15368 | PASS for these fields only |
| Full zero-review/bypass/force/delete/conversations | Strict read-only adapter + negatives | NOT VERIFIED, credential403 |
| Three actual Environment IDs/rules/secrets | Exact pins + independent reader + negatives | NOT VERIFIED |
| App installation permissions and merge/workflow capability | Complete-source gate, explicit write risk, no exclusivity inference | NOT VERIFIED; owner report/conditional risk only |
| Cryptographic identity observation/sanitization | Signed synthetic tests, issuer/audience/repo/owner/ref/env/SHA/run/attempt negatives | NOT VERIFIED actual GitHub JWT |
| Signature-protected evidence / replay | Tamper checks, broker-role token consumption | NOT VERIFIED live receipt key |
| Actual reusable run/job/check representation | Official schema compatible; ordinary run has [] | NOT VERIFIED real reusable invocation |
| Registrar/broker process/credential/IPC separation | Targeted native Docker/PG assertions in final CI | NOT VERIFIED real GitHub/service composition |
| Clean normal rebuild and byte inventory | Real source/bytes in offline native builder | NOT VERIFIED real protected build identity |
| Immutable registration / publication-only consumption / unprotected substitution | Existing + new isolated positives/negatives | NOT VERIFIED genuine protected provenance |
| Expiry/replay/revocation/stale/interrupted/policy/version rollover | Existing baseline and targeted acceptance retained | NOT VERIFIED operational live rollover |
| Normal public build isolation | Final general CI, no private paths/witness | No publication activation |

The first extended native attempt reached worker startup but exposed that the
existing command wrapper ignored SQL stdin. Role bootstrap now explicitly pipes
its SQL and grants only database CONNECT to the two acceptance logins; a real
subprocess stdin test prevents recurrence. Startup diagnostics are bounded and
redacted before reporting. This does not alter production permissions or schema.

Targeted local identity/governance/registrar tests pass; Docker is unavailable in
this workspace, so native evidence must be taken from exact-head CI, not invented.
Final run/head counts and complete file list are in the delivery report/PR checks.
No actual OIDC invocation, administrative mutation, production credential/resource,
article, OpenAI call, publication or inspection activation occurred.

Official sources:
- https://docs.github.com/en/rest/branches/branch-protection
- https://docs.github.com/en/rest/actions/secrets#list-environment-secrets
- https://docs.github.com/en/rest/apps/installations
- https://docs.github.com/en/rest/actions/workflow-runs
- https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request
- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app
