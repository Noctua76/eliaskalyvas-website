# PR20 — final independent review package / FRA1 pilot closed

## Decision and immutable review scope

**READY FOR INDEPENDENT REVIEW of inactive implementation. Live acceptance is
BLOCKED / NOT VERIFIED.** This is a developer review package, not independent
approval or a security certification. Keep PR20 OPEN / Draft / unmerged. No
Phase5D implementation, infrastructure, DNS change, credential, dispatch, real
OIDC, inspection or publication is authorized by this document.

Repository `Noctua76/eliaskalyvas-website` (ID1389733212), owner ID217035723.
Base main `c24c891a8d75f4d48a54305eccbdf89722c66a69`.
Reviewed implementation parent `ef477a2d3cd655617c68a0b5485845f3fe0b0fd6`, tree
`a84f45f9ded07fce48940bacd16674ec06ca87fb` (59 changed files,35 commits at read-back).
The closure/correction commit belongs to the same existing Draft PR20. Obtain
its exact new head/tree from PR metadata and the delivery report; compare the
**entire base-to-head diff**, not just this correction, before any approval.

## Evidence ledger and limits

| Evidence | Exact reference | What it establishes |
| --- | --- | --- |
| Parent general CI | https://github.com/Noctua76/eliaskalyvas-website/actions/runs/41240248211 | 725/725 regression PASS,0 skips; normal139-module build and public isolation PASS at parent |
| Parent native trust | https://github.com/Noctua76/eliaskalyvas-website/actions/runs/41240248188 | PostgreSQL replay/revocation/least privilege/immutable inventory; minimal runtime imported under pinned Node image with network none |
| Check source | GitHub Actions App15368 on the exact parent | Check provenance; does not authorize production |
| Current targeted corrections | 103 PASS /0 FAIL /1 local Unix-listen EPERM skip (104 tests) | Retired-plan no-network denial; Docker-error cleanup; role completeness; failed-run retirement; prior live-trust negatives |
| Final correction CI | Exact-head run IDs supplied in delivery; required checks/native auto-run on synchronize | Must be checked at the new head/test-merge; parent success is not substituted |
| GitHub administration | Owner-supplied external verification in this thread | Main protection/CI/admin enforcement/no force/deletion, main-only Environments, default read Actions/no approvals,zero deploy keys; not a newly signed admin snapshot |
| FRA1 pilot and teardown | Owner operator observations,2026-10-31; HOST-FRA1.md | Historical isolation checks and resource removal; NOT signed live acceptance |
| Real owner/AAL2, protected OIDC and provenance | No accepted real records | NOT VERIFIED; unit fixture keys/JWTs are explicitly not evidence |

Pilot closure: PG17 cleanup Result=success/ExecMainStatus=0; container/network
removed; no Docker mounts reported; Droplet destroyed; DNS removed. Billing was
USD0.91 usage covered by signup credit, estimated payable USD0.00 **at observation**.
No claim of independent provider verification, final invoice or issuer revocation.
Old IP201.79.94.104, origin, host files, passwords and deadlines are unavailable.
Do not probe/recreate/reuse them. Historical code pins remain reference templates.
The public plan is explicitly disabled before DNS,HTTP or token acquisition.

## Security review findings and narrow corrections

| ID | Verified trigger / defect at parent | Correction and evidence |
| --- | --- | --- |
| PR20-CLOSE-01 | `approved:true` public plan retained a DNS destination after owner-confirmed teardown; probe readiness and token delivery could address a reassigned origin if dispatched | Set `approved:false`; test real shipped plan rejects before any fetch. No workflow identity, trust predicate or production setting weakened |
| PR20-CLOSE-02 | Live cleanup caught every inspect error as absence; DB helper/shell expiry did the same. Docker daemon/access failure could yield false cleanup success and remove local credential files | Exact-name list query must succeed; unknown/ambiguous output and inspect/remove errors propagate; verify absence after deletion. DB shell stub actually exits42 on failed Docker read before any rm. No real DB/host action performed |
| PR20-CLOSE-03 | Watcher treated completed failed/cancelled workflow as successful lifecycle completion; coordinator did not require all three signed observations or inventory consumption before normal exit | Retire rows first, deny non-success conclusion; require all three persisted verified roles, plus immutable inventory and consumption evidence in provenance mode. Missing evidence or interrupted coordinator fails; concurrent stop paths await the same retirement promise; no synthetic acceptance substituted |

No further source redesign is included. These targeted changes leave cryptographic
OIDC, owner/MFA contract, governance, privileges and publication contracts intact.
This inspection does not prove the absence of all defects; independent review and
real controlled failure/recovery acceptance remain necessary.

## Critical controls / reviewer inspection targets

- **Owner authority:** `owner-risk-source.mjs`, owner-source/request adapters,
  administrationGate and bootstrap/live-trust tests. Real Auth bearer is checked
  against existing pinned owner UUID + AAL2/status gate; no service-role key. Fresh
  challenge-bound signed receipts, matching App digest/version/repository/owner,
  retirement/supersession/session expiry/restart denial. Receipt-only shared Unix
  socket cannot authorize or retire; no public owner endpoint. No editorial right
  is granted by GitHub job, App or reviewer status.
- **SINGLE_OWNER:** approved main protections and zero mandatory human approvals
  remain required. No automatic governance transition. Collaborators, Environments,
  bypass rules and required App15368 checks are independently re-read. No repository
  protection or collaborator/App permission changes are made by this PR.
- **App evidence:** `application-inventory.mjs` verifies a pinned independent
  signing source, fresh complete coverage, entity scopes/permissions/repository IDs
  and zero outstanding entries. `administration-evidence.mjs` binds it into owner
  risk digest. It is a verifier, **not an implemented account capture service**.
- **OIDC/job correlation:** existing approved OIDC/registrar/broker modules are
  reused. Exact repo/owner numeric IDs, immutable subject, caller/reusable SHA,
  actual run/attempt/job/check/App facts, JWT JWKS signature/expiry/replay/revocation
  and active policy all remain required. `run.referenced_workflows` real protected
  API compatibility remains unaccepted; absent metadata is never filled in.
- **IPC and dependencies:** canonical JSON extraction preserves old exports/bytes;
  standalone IPC has no contract/AJV import. MAC role/direction/sequence prevents
  substitution/replay; worker termination denies pending calls. Live role closure
  intentionally has its own locked pg/AJV/parse5 tree; no website/Vite/React mount.
- **Least privilege / host lifecycle:** fra1-launch/runtime, live-role-worker/service,
  private-port, stage-live-runtime and role tests. Separate nonroot LOGINs/containers,
  no public DB, capability drop, read-only mounts, restricted groups, no Docker socket
  in coordinator/roles, root accepts only fixed offline rebuild operation. Deadline
  units, label/name scope, registration retirement and cleanup read-back are explicit.
- **Provenance:** independent clean rebuild at reviewed source bytes, post-build
  broker revalidation, immutable protected inventory insertion and publication-only
  consumption. No ordinary CI/local inventory authorizes publication. Actual isolated
  end-to-end provenance remains NOT VERIFIED despite offline/native tests.
- **Public boundary:** manual-only existing pinned probes; no Pages/deploy permission,
  rawJWT log/artifact or owner approval route. Public plan is disabled. Existing Pages
  workflow/UI/assets, historical migrations and Phase1 contract schemas unchanged.
  `normal-provenance.mjs` defers build tooling import; Edge package inventory adds
  only the dependency-free canonical module. Required CI names/pins/read permissions
  retained; added locked runtime dependency install and pinned-container import check.

## Complete account-inventory feasibility and required evidence

Official sources checked2026-10-31:

- https://docs.github.com/en/rest/apps/installations — installation repository lists
  are scoped to the authenticating installation; not all account authorizations.
- https://docs.github.com/en/rest/apps/apps — app installation enumeration is scoped
  to the authenticated App/user access context, not a universal account audit.
- https://docs.github.com/en/apps/oauth-apps/using-oauth-apps/reviewing-your-authorized-oauth-apps
  — owner Settings / Applications / Authorized OAuth Apps is the supported review
  surface for the owner's OAuth grants.
- https://docs.github.com/en/rest/apps/oauth-applications — token inspection requires
  that application's own client ID/secret and a known token. It is not account-wide
  discovery; do not request third-party client secrets to simulate it.

**Feasibility:** partial independently authenticated API reads are possible with
appropriate read identities; no complete account-wide OAuth/App/PAT capture API or
GitHub-signed export has been established for this personal account. A repository
PAT or Connector does not establish universal coverage. Do not invent such an API,
export format or provider signature. The implemented method name
`authenticated-owner-settings-export` is our trusted-source evidence contract,
not a claim that GitHub offers a signed export product.

Minimum still required is an explicitly approved independent capture operator/tool
and signing authority, outside the acceptance host, accessing the real owner's
account through an authorized authenticated session. It must preserve authenticated
owner identity, all list/detail pages and pagination/completeness evidence for:

1. Installed GitHub Apps: actual App/installation IDs, account identity, permissions,
   all/selected repository coverage and current inclusion/exclusion of repository1389733212.
2. Authorized GitHub Apps and OAuth Apps: every grant, real effective scopes,
   capabilities and account/repository access, including Codex,VS Code,GCM.
3. Classic and fine-grained PAT inventories: current validity/expiry and effective
   resource/permission metadata without retaining or exporting token values.
4. Repository integrations/deploy keys/webhooks or outstanding access mechanisms:
   authenticated read-back and explanation of exclusions. Unknown effective rights
   or missing source coverage stay outstanding, so completeness must be false.

Capture raw metadata privately without cookies/bearers/passwords. Bind source
URLs, timestamps,capture digests,owner numeric ID,repository identity,all five
coverage families and zero outstanding items in the signed envelope. An independent
reviewer must validate capture completeness and approve the signer/public-key hash
out of band; signing an owner-typed list or screenshots does **not** authenticate
its truth. No such approved source/key or genuine bundle has been supplied here.
If the necessary metadata cannot be observed, this gate remains BLOCKED; neither
an owner risk acknowledgement nor widening a PAT may bypass completeness.

The current verifier freshness bound is five minutes. Future source must be able
to renew authenticated capture within that bound throughout acceptance; a slow
manual screenshot audit cannot silently satisfy it. Feasibility of that sustained
source is **NOT VERIFIED**. Do not automate owner credential entry or expand Codex
permissions without specific authorization.

Codex broad access and VS Code/GCM broad OAuth scopes remain residual potential
merge/write/workflow authority. No direct bypass exploit or harmlessness is proven.
The approved SINGLE_OWNER human model does not itself prove exclusive technical
GitHub merge authority. Preserve these capabilities in the risk digest and obtain
genuine owner/MFA acknowledgement, without conflating that with editorial approval.

## Live Acceptance Readiness Matrix

Categories are independent: tested implementation is not a live PASS.

| Boundary | Implemented / CI-tested | Externally verified | NOT VERIFIED / blocked | Explicit Owner authorization required |
| --- | --- | --- | --- | --- |
| Main protection / required checks / admin enforcement | Strict verifier + negative tests | Owner reports configured protections/App15368 checks | Fresh independent signed admin read-back at future run | New read identity only after approved private host; no setting changes authorized |
| SINGLE_OWNER / collaborator and App risks | Exact mode/policy binding, fail-closed metadata | Owner reports no additional humans; broad development/OAuth rights observed | Exclusive technical control not proven | Explicit residual-risk decision; no mandatory second reviewer |
| Three Nyra Environments | Exact IDs/main-only/secret/reviewer/bypass checks | Owner reports main-only policies | Full current identities/rules/secrets metadata snapshot at future run | Approved read scope; no Environment mutations |
| Complete application inventory | Signed-source verifier/permission digest/negative tests | Specific installation exclusions and broad scopes reported | Complete authenticated capture, approved independent signer and sustainable freshness | Approve capture source/session method/key pin; no permission expansion now |
| Real owner/MFA risk decision | Existing AAL2/status bridge, signed journal/challenge receipt tests | No accepted real decision | Fresh real session/decision matching current audit digest/version | Owner personally authenticates/acknowledges risk; never synthetic |
| FRA1 closure | Disabled public plan; corrected deterministic cleanup tests | Operator PG/container/network/mount/Droplet/DNS observations | Not independently signed; issuer-side revocation not evidenced | Do not reuse anything; obtain issuer revocation/no-issuance record |
| Future isolated host and credentials | Reviewed template, role mounts/IPC/deadlines | Historical pilot isolation only | No host/DNS/DB/credential/key is currently available | Explicit provider/cost/origin/window/egress/service/key/credential approval |
| Registrar/broker/private IPC | Unit/native role/replay/revocation tests; pinned-container graph | Historical identity-only real IPC proof | Full live bindings/process failure/recovery not accepted | Approve new isolated process installation; no production listener |
| GitHub actual job facts | Existing independent registrar and fail-closed adapter | No protected positive run accepted | Actual referenced_workflows/run/job/check/attempt compatibility | Discovery dispatch separately authorized after readiness |
| Real protected OIDC | Signature/JWKS/exact subject/pins/replay tested using fixtures | None | Complete genuine subjects/issuer/key/run correlation | First dispatch; independent subject review/policy approval; second dispatch |
| Trusted normal-build provenance | Offline/native inventory/revalidation/consumer controls | No real protected inventory | Independent registered clean build/byte inventory/consumption | Second fresh provenance invocation; no publication privilege |
| Completion / failure / cleanup | Missing evidence, failed/cancelled runs, Docker failures now deny | Historical teardown only | Full real interrupted/recovery/revocation/resource retirement evidence | Approved scoped cleanup and issuer-side revocation verification |
| Pages/public site/editorial authority | Normal build/isolation checks; Pages workflow unchanged | Previously accepted production baseline | No new production deployment claimed or needed | None now; production activation and Phase5D prohibited |

## Minimal future operator sequence — no executable old target

1. Independently review the full PR20 diff and exact-head CI; keep Draft/unmerged
   until separately approved. Close any review finding. Do not recreate FRA1.
2. Resolve **the authenticated complete inventory source first**, including its
   independent key/coverage/freshness feasibility. If impossible, stop before paid
   infrastructure or credential creation. Record old identities revoked or never
   issued at their issuer; destruction alone does not establish revocation.
3. Obtain one concrete owner approval for a NEW isolated host/origin/provider/cost
   cap/window, separate nonroot roles/DB,private IPC/egress,cleanup deadlines,private
   evidence storage and externally pinned distinct signing identities. No old
   IP, passwords,DNS,signing key or expiry is reused. Update/review all hard-coded
   historical target pins as one necessary target-binding change; editing only a
   JSON origin is insufficient because preflight/ingress/runtime enforce exact pins.
4. After approval, establish the new empty host and deadline/cleanup controls,
   verify isolation, then create only short-lived repository-scoped read identities
   in private files. Perform fresh complete administration and integration read-back;
   discrepancies/403/unknown coverage stop acceptance. Never add Admin to Codex.
5. Owner personally supplies a new genuine AAL2 session to the private source and
   accepts the exact independently captured risk digest/policy version. Verify
   fresh challenge-bound signed receipt; source/key/digest mismatch blocks arming.
   Install reviewed main/reusable SHA pins, route-only nonsecret plan and externally
   approved key pins; no wildcard/guessed subject. Activation remains separately approved.
6. First **separately authorized** manual main dispatch: non-authorizing discovery.
   Verify genuine GitHub JWKS/token identity,actual run/job/check/attempt/reusable API
   facts and private signed observations for all three roles. No inventory grant.
   Retire discovery registrations/services. Independently approve exact observed
   subjects and a reviewed new policy version; invalidate old registrations/decisions.
7. Second **separately authorized** fresh invocation: independently registered build,
   clean byte inventory,broker/policy revalidation,immutable registration and controlled
   publication-only inventory consumption. Require successful workflow plus complete
   signed observations/provenance,negative cases,replay/revocation and zero-active
   registration retirement. No article,Pages deploy or live publication is performed.
8. Disable ingress/stop sources; revoke decisions,keys and temporary GitHub credentials
   at their issuers; preserve signed sanitized evidence privately; verify exact scoped
   container/network/storage cleanup and destroy new temporary host/DNS. Only then
   independent reviewer may mark each Phase5C live boundary PASS. Phase5D remains
   outside this PR and is not started by this sequence.

## Full base-to-head changed-file inventory

The following manifest includes this review package. GitHub exact-head diff is the
source of truth; no public website/assets/Pages workflow/historical migrations are
part of this manifest. Unrelated local asset hydration files are not committed.

```text
A	docs/NYRA-5C-TRUST-INTEGRATION-REVIEW.md
A	docs/NYRA-ACCEPTANCE-BOOTSTRAP.md
A	docs/NYRA-PR20-INDEPENDENT-REVIEW.md
A	lib/publication/canonical-json.mjs
A	lib/publication/runtime/application-inventory.mjs
A	lib/publication/runtime/owner-risk-source.mjs
A	ops/acceptance-bootstrap/Caddyfile.review-only
A	ops/acceptance-bootstrap/HOST-FRA1.md
A	ops/acceptance-bootstrap/POSTGRES-STAGE.md
A	ops/acceptance-bootstrap/cleanup.mjs
A	ops/acceptance-bootstrap/compose-trust.mjs
A	ops/acceptance-bootstrap/db-stage.mjs
A	ops/acceptance-bootstrap/fra1-launch.mjs
A	ops/acceptance-bootstrap/fra1-runtime.mjs
A	ops/acceptance-bootstrap/host-preflight.mjs
A	ops/acceptance-bootstrap/host-target.json
A	ops/acceptance-bootstrap/inventory-report.mjs
A	ops/acceptance-bootstrap/live-ingress.mjs
A	ops/acceptance-bootstrap/live-role-service.mjs
A	ops/acceptance-bootstrap/live-role-worker.mjs
A	ops/acceptance-bootstrap/live-watcher.mjs
A	ops/acceptance-bootstrap/owner-request.mjs
A	ops/acceptance-bootstrap/owner-source.mjs
A	ops/acceptance-bootstrap/plan.example.json
A	ops/acceptance-bootstrap/plan.mjs
A	ops/acceptance-bootstrap/private-port.mjs
A	ops/acceptance-bootstrap/role-db-check.mjs
A	ops/acceptance-bootstrap/role-db-smoke.mjs
A	ops/acceptance-bootstrap/role-ipc-client.mjs
A	ops/acceptance-bootstrap/role-ipc-container-check.mjs
A	ops/acceptance-bootstrap/role-ipc-proof.mjs
A	ops/acceptance-bootstrap/role-ipc-worker.mjs
A	ops/acceptance-bootstrap/runtime/package-lock.json
A	ops/acceptance-bootstrap/runtime/package.json
A	ops/acceptance-bootstrap/stage-live-runtime.mjs
A	ops/protected-delivery/live-acceptance-plan.json
A	test/acceptance-application-inventory.test.mjs
A	test/acceptance-bootstrap.test.mjs
A	test/acceptance-db-stage.test.mjs
A	test/acceptance-fra1-binding.test.mjs
A	test/acceptance-host-preflight.test.mjs
A	test/acceptance-ipc-standalone.test.mjs
A	test/acceptance-live-ingress.test.mjs
A	test/acceptance-live-role-service.test.mjs
A	test/acceptance-live-watcher.test.mjs
A	test/acceptance-private-port.test.mjs
A	test/acceptance-role-db-smoke.test.mjs
A	test/acceptance-role-ipc.test.mjs
A	test/acceptance-trust-composition.test.mjs
A	test/canonical-json-compatibility.test.mjs
M	.github/workflows/nyra-integration-acceptance.yml
M	.github/workflows/required-ci.yml
M	lib/publication/contract.mjs
M	lib/publication/integration/normal-provenance.mjs
M	lib/publication/runtime/acceptance-ipc.mjs
M	lib/publication/runtime/administration-evidence.mjs
M	ops/protected-delivery/trust-only.mjs
M	runtime/nyra-edge/package-layout.mjs
M	test/edge-packaging.test.mjs
M	test/live-trust.test.mjs
```
