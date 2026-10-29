# Phase 5C-A — protected delivery review packet

Status: branch-only, inactive implementation. NO MERGE, NO PUBLICATION.

Baseline: `573322caa7f06ad4359ba40e3efd5921976125fc`.
Baseline tree: `74d21cce5035e68df31ee348c7736ee91afc48f4`.
Draft PR: https://github.com/Noctua76/eliaskalyvas-website/pull/15

## Observed GitHub inventory

Read on 30 October 2026, Europe/Athens, using authenticated repository reads
and unauthenticated public GitHub REST reads. No settings were changed.

| Surface | Observed evidence | Result |
| --- | --- | --- |
| `main` SHA/tree | Exact approved values above | PASS |
| `main.protected` | `false`; checks enforcement `off`; contexts/checks empty | FAIL |
| Repository rulesets | API returned `[]` | FAIL |
| Environments | `total_count: 1`, only `github-pages`, ID `22825945319` | PASS: inventory |
| Environment reviewers | Only `branch_policy` rule returned; no required reviewers | FAIL |
| Environment admin bypass | `can_admins_bypass: true` | FAIL |
| Deployment branches | custom policy, one entry `main`, type `branch`, ID `61136639` | PASS: branch scope only |
| Branch protection detail API | Public read 401; connector excludes administration | NOT VERIFIED: detailed admin settings |
| Actions default permissions, allowed actions, OIDC subject customization | Not exposed by available connector | NOT VERIFIED |
| Collaborator/reviewer eligibility and account plan | Not established | NOT VERIFIED |
| Existing post-merge run | `40964992390`, exact baseline, success | PASS: historical CI only |

Sources:

- https://api.github.com/repos/Noctua76/eliaskalyvas-website/branches/main
- https://api.github.com/repos/Noctua76/eliaskalyvas-website/rulesets
- https://api.github.com/repos/Noctua76/eliaskalyvas-website/environments
- https://api.github.com/repos/Noctua76/eliaskalyvas-website/environments/github-pages/deployment-branch-policies
- https://github.com/Noctua76/eliaskalyvas-website/actions/runs/40964992390

The only active deployment workflow is `pages.yml`: push main / manual dispatch,
workflow-level contents:read, pages:write, id-token:write, build and deploy jobs,
`github-pages` Environment, and cancel-in-progress:true. Actions use mutable
major tags. It is unchanged. The historical 5A/5B workflows have branch/PR
restrictions and cannot serve as general required checks. Their skipped jobs
are not acceptance for Phase 5C.

## Minimum enforceable configuration — proposal only

Use classic main branch protection, because this adapter explicitly reads that
API. An equivalent ruleset-only configuration needs a separately tested adapter;
it must not be treated as equivalent just because `protected` becomes true.

1. Require PRs, one approving eligible independent reviewer, dismiss stale
   approvals, require approval after the latest push, resolve conversations.
   Enforce for administrators, no bypass lists, no force pushes or deletion.
2. Require strict/up-to-date checks, bound to the GitHub Actions App (`15368`),
   with unique contexts `nyra-5c-regression` and `nyra-5c-native-trust`.
   **Do not require the branch-scoped acceptance workflow as-is.** Before live
   protection, install a separately reviewed general CI workflow that actually
   runs on every eligible PR targeting main, without path/branch skip loopholes.
   Revalidate exact final merged SHA and main before job registration.
3. Precreate separate Environments `nyra-build`, `nyra-inspection`, and
   `nyra-publication`. Restrict each to exact branch `main` with no tag rule.
   Required independent reviewers; prevent self-review; disable admin bypass.
   The reviewer must be eligible; the sole author cannot self-approve. A human
   external review in chat is not itself a GitHub approval or Environment rule.
4. Keep the existing `github-pages` Environment separate. Its subject cannot
   authenticate to any Nyra audience. The future actual Pages job must also
   satisfy Pages' deployment requirements; Environment-name compatibility and
   reviewer behavior require genuine acceptance before activation. Do not
   activate the old all-privileges delivery proposal in `ops/publication`.
5. Repository Actions default: read-only; no approval/PR write permission.
   Restrict actions to reviewed immutable commit pins. No pull_request_target,
   no production secrets or privileged self-hosted runners for this system.

GitHub currently documents protected branches and protected Environments for
public repositories on current plans. This repository is public. We have not
verified this owner's actual plan or legacy-plan eligibility, so no upgrade is
asserted necessary. Configuration requires repository-owner/admin access.

Reference:
https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments

## Exact identity and independent registration

The existing cryptographic verifier is retained unchanged. The demonstrated
defect is in the old metadata adapter: `workflowSHA=run.head_sha`, with an
Environment supplied by configuration. The prepared `protectedVerifiers`
composition now requires the registered adapter and durable store. Missing
store/protection data fails closed; the legacy adapter is retained for its
existing tests, not used by this protected composition.

| Constraint | Required value / source |
| --- | --- |
| Issuer/JWKS | `https://token.actions.githubusercontent.com`, existing pinned verifier |
| Repository / numeric ID | `Noctua76/eliaskalyvas-website` / `1389733212` |
| Owner numeric ID | `217035723` |
| Ref/type | `refs/heads/main` / `branch` |
| Event/runner | explicit approved event list, `github-hosted` |
| Audiences | separate `urn:nyra:build`, `urn:nyra:inspection`, `urn:nyra:publication`; Pages audience separate |
| Subjects | exact default `repo:Noctua76/eliaskalyvas-website:environment:nyra-<privilege>` |
| Caller workflow | exact approved path + `@refs/heads/main`, registered workflow ID and workflow SHA |
| Reusable worker | exact approved workflow path + full immutable SHA, matching `job_workflow_sha` |
| Registered job | exact run ID, attempt, check-run ID, job ID/name, check-suite ID, code SHA, privilege, Environment |
| Code | latest independently read protected main; stale code cannot acquire new capabilities |

The reusable worker path/SHA is deliberately not invented here. After review,
an administrator must install and pin the exact reviewed reusable workflows and
record those identities in the trusted registry. GitHub OIDC exposes
`job_workflow_ref` / `job_workflow_sha` for reusable jobs; an ordinary Pages
job is not an acceptable substitute.

The registrar is a distinct trusted control-plane process. It reads approved
source/workflow versions and live GitHub job facts, never accepts workflow
inputs as registration evidence, and inserts a registration (maximum ten
minutes). Registration mutation is forbidden except one-way revocation. A new
run attempt/check run requires a new registration; no wildcard retries.

The adapter checks branch protections and Environment settings live, latest
main, run repository/head repository, workflow path/ID/event, current attempt,
job ID/check URL/name/status/SHA, check-suite ID and Actions App. Pagination,
API errors and incomplete lookup fail closed. Registered workflow SHA is
compared to the signed claim, not inferred from code SHA.

Each broker request needs a fresh JWT (`exp-iat <= 600s`, existing verifier).
Durable jti consumption rechecks expiry/revocation, code, privilege and policy
digest under a row lock. Global unique jti rejects cross-process replay. A lost
acknowledgement burns the JWT; fetch a fresh token and reconcile operation state.
The Pages audience token remains inside the already tested one-shot dispatch
journal boundary; full Pages replay/receipt acceptance remains Phase 5D.

Reference: https://docs.github.com/en/actions/reference/security/oidc

## Credential and process separation

| Process | Allowed authority | Explicitly excluded |
| --- | --- | --- |
| Ordinary website/PR build | contents:read, public Vite variables, evidence artifact upload | trusted registration, broker DB, private Storage, Pages publication |
| Protected normal builder | exact build OIDC audience; independent clean normal build | inspection/publication capability, DB/Storage/Pages credentials |
| Private Node/Sharp worker | inspection OIDC; job-bound quarantine read/report through broker | service key, GitHub Pages token, DB login, public upload |
| Publication job | exact publication OIDC; candidate/permit protocol | owner/MFA credentials, direct Supabase DB/Storage key |
| Metadata reader | repository-scoped App token: metadata/actions/checks/deployments read plus administration read for protections | publication write, secret-management access |
| Registry/inventory registrar | separate `nyra_trust_registrar` role; reviewed inserts and one-way revoke | workflow/runner access, token consumption |
| Identity broker | `nyra_trust_broker`: read jobs/inventory, insert jti; row-lock column privilege | registration/inventory inserts, actual UPDATE/DELETE |
| Private reconciliation operator | private DB reader, existing cleanup RPC, quarantine delete | dispatch/publication, mutation of rights/code/receipts |
| Future Pages broker | narrowly scoped expiring Pages/deployment credential, server journal | builds, private inspection/owner secrets |

`schema.sql` is an isolated proposal, **not** a production migration. It adds no
grants to Supabase service_role/anon/authenticated. Tables force RLS; functions
are invoker-only. PostgreSQL FOR SHARE requires an UPDATE column privilege:
the broker receives only UPDATE(run_id), with RLS WITH CHECK(false) and an
immutable trigger independently preventing actual writes. Tests exercise this.

JWTs last at most ten minutes; registry records at most ten minutes. Keep replay
tombstones through all token validity windows (proposal currently retains them
indefinitely). Revoke the job registration immediately on cancellation/incident;
fresh requests recheck GitHub status. Expiring GitHub App tokens remain only in
server memory; renew before their API expiry and revoke the installation/token
for compromise. The App private key stays in an external broker secret store,
never a job. Rotate keys by installing a reviewed replacement then revoking the
old key, with a fail-closed overlap plan. Actual key provisioning/rotation and
server credential isolation are NOT VERIFIED and are not performed in 5C-A.
No JWT or credential is an artifact, command argument, diagnostic or VITE value.

## Immutable normal-build inventory

The existing independent normal Vite builder is reused via a snapshot helper.
Capture verifies actual checked-out HEAD, a clean tracked/untracked tree and
absence of dotenv overrides both before and after build. It records code SHA,
public-build configuration digest, exact path set, per-file SHA256/byte length,
builder run/attempt/check and caller/reusable workflow pins. Canonical record
digest is approved by a separate registrar; unique (code, configuration) and
immutable storage prevent overwrite. Submitted publication archives never
define the normal path scope.

`buildNormalProvenance` can label protected provenance only after verifying a
build-privilege capability. PR CI capture has `unprotected_ci` assurance and is
explicitly rejected by the approval loader. Its placeholder check ID and
workflow pins cannot establish real provenance. A database writer/registrar is
part of the trusted computing base; CI cannot turn an evidence artifact into an
approval by uploading JSON. The production registrar and approved store wiring
must be independently accepted before activation.

## Inspection rollover and uncertainty

No immutable upload code, rights or receipts are rewritten. A pending upload
with an old SHA requires a fresh owner-authorized initiation under the new code;
there is no automatic transfer of approval. Accepted receipts remain immutable
across code versions. A live lease with interrupted/unknown transport waits;
same-code expired lease can claim a fresh attempt/challenge through existing
RPCs. An accepted state without a matching immutable report/receipt is an error.

Expired/failed old-code quarantine can be cleared by the separate operator
reconciler using the authoritative stored old code and existing cleanup RPC.
It does not need an old-code OIDC token or relax latest-main checks. It first
requests cleanup eligibility, deletes private bytes, then marks cleared;
interruption leaves it retryable. Production scheduling/credential isolation
for this operator is not installed.

## Acceptance matrix and evidence interpretation

| Case | Local/isolated assertion | Real protected GitHub result |
| --- | --- | --- |
| Valid signed claims + independently registered job | Synthetic RS256 functional acceptance | NOT VERIFIED |
| Invalid issuer/audience/subject/repo/owner/ref/type/Environment | Reject each mutation | NOT VERIFIED against real provider |
| Wrong caller/reusable workflow SHA, code SHA, run/attempt/check/job/suite | Reject mismatch; reject stale main | NOT VERIFIED against real provider |
| Expired/future/revoked/replayed JWT, metadata outage | Deny; durable unique replay | NOT VERIFIED against real provider |
| Cross-job/privilege/Environment/ordinary Pages substitution | Deny signed/API/registration mutations | NOT VERIFIED against real provider |
| Protection/admin-bypass/self-review/wildcard/tag/check-app failures | Deny each live API fixture mutation | Real current settings FAIL activation gate |
| SQL race/revocation/ACL/immutable inventory | Local PGlite; two-connection native PG17 on both existing isolated stacks | CI evidence required |
| Normal clean build and byte inventory | Exact-head normal capture; unprotected record cannot approve paths | Trusted protected inventory registration NOT VERIFIED |
| Pending inspection code rollover | Owner reinitiation, no rewrite | Production not invoked |
| Interrupted/unknown result | Wait live lease; fresh expired attempt; no invented success | Production not invoked |
| Old-code cleanup interruption | Recheck/delete/mark; retry after lost ack | Native existing cleanup acceptance retained |
| Pages/witness/receipt publication E2E | Existing components preserved | Phase 5D, NOT VERIFIED |

The active acceptance workflow has no id-token, Pages, deployment or secret
permissions. It checks out the exact PR head, runs regression/build/capture,
then reuses the pinned 5B native runner with two clean isolated PG17/Auth/MFA/
Storage/Node stacks and adds native trust-store concurrency/ACL assertions.
Synthetic identities are explicitly labelled. No protected invocation is
claimed. Exact-head run URL and final pass/fail counts belong in the PR body,
not a self-referential commit that would change the tested head.

## External actions and stop gate

After external review, the repository owner/admin must configure approved main
protection and precreated protected Environments, verify independent reviewers,
and provide read-only administration visibility to the trusted metadata reader.
The present connector cannot manage or read those admin endpoints. No bypass
or production secret is needed to resolve that administrative blocker.

Separately review/install immutable reusable workflow identities and a protected
acceptance-only caller. Provision an isolated registrar/broker with the proposed
roles, read actual GitHub facts, register the exact current run/attempt/check and
demonstrate genuine issuer-signed OIDC against live protections. Capture only
sanitized claims/hashes/job facts/protection snapshot and test isolation from
ordinary Pages and other audiences. Never preserve a bearer token as evidence.

Remaining blockers: live protections absent; eligible reviewer/admin visibility
unverified; reusable workflows and registry provisioning not installed; genuine
protected OIDC and immutable protected build registration not demonstrated;
production process/key rotation/reconciler isolation not demonstrated; Pages
deployment Environment compatibility and full end-to-end lifecycle reserved for
5D. Successful 5C-A CI does not remove these blockers. Stop for external review.
