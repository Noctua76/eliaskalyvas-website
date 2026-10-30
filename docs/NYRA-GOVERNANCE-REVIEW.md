# Nyra governance adaptation — implementation review

Branch only, baseline `90cff7b557e54d90cd67feed325c16f078196614`.
The owner explicitly replaces the mandatory second-person operating model.
This packet supersedes B1/B2's reviewer-readiness requirement for SINGLE_OWNER;
those historical packets remain evidence of their original accepted scope.
No administration, production policy, service, caller or publication is activated.

## Explicit contract

| Control | SINGLE_OWNER — intended current model | OWNER_WITH_REVIEWERS — future only |
| --- | --- | --- |
| Configuration | Explicit trusted governance manifest; never inferred | Same architecture, explicit reviewed owner-authorized transition |
| Repository administration | Exact numeric repository owner, no other admin/maintain grants | Same exclusive owner administration; deliberately scoped reviewers |
| Main PR gate | Non-null required_pull_request_reviews object, explicit approval count 0 | At least 1 required approval, stale approvals dismissed, latest-push approval |
| Code-owner / last-push / stale-review flags | Explicit false; no hidden second-person requirement | Reviewed independent-review settings |
| CI | Strict, both exact required contexts, App15368, latest actual run/attempt successful | Same |
| Main bypass / force / delete | Enforce admins, no PR bypass actors, force/delete disabled, resolve conversations | Same |
| Nyra Environment | Exact independently pinned Environment ID/name, no mandatory reviewers | Approved numeric reviewer IDs, effective write eligibility and no self-review |
| Deployment scope | Exactly main branch, zero tags/wildcards, no admin bypass | Same |
| Environment secrets | Exact empty metadata list, no secret values read | Same |
| Editorial publication | Existing exact owner/MFA authority and single owner action | Same; technical review grants no editorial authority |

No implicit default mode exists. Missing/wrong mode or configuration fails closed.
Collaborator count cannot switch modes. The GitHub numeric owner ID identifies
repository administration, not a new Supabase editorial identity or MFA grant.

## Policy lifecycle

Top-level trusted configuration carries governance schema, mode, monotonic
policyVersion, ownerId, ownerAuthorizationSHA and explicit reviewerIds. Each
privilege policy includes this same manifest, so the full trust-policy digest,
immutable registration, issued capability and rebuilt inventory bind it.
Identity-level governance substitution is rejected. Job registration accepts only
runId/runAttempt selectors. JWT governance fields cannot choose policy: they are
ignored and the issued capability always records the trusted mode/version.

An independently approved live readPolicyState dependency is mandatory. It is
not provisioned here and must not be a request-controlled value or static startup
fallback. Every identity verification/assertion, delayed grant revalidation,
Pages-token assertion and inventory read checks the active policy state. Inventory
reads recheck after awaited SQL, rejecting retirement during a lookup. Incompatible
registrations are rejected before token consumption; legacy rows without governance
cannot authorize this composition. No existing SQL schema/migration is changed.

Controlled transition, including a future return to SINGLE_OWNER:

1. Explicit owner authorization, reviewed next manifest and new CI acceptance.
2. Validate version increment exactly one, predecessor governance digest and fresh
   owner-authorization evidence. Reviewer mode additionally requires verified,
   authorized and accepted scoped access and tested live protection settings.
3. Quiesce authorization by making the trusted active-policy state unavailable;
   this immediately rejects existing opaque capabilities, including Pages tokens.
4. Registrar retirePolicy revokes all still-active rows for each previous identity
   policy digest, using the existing monotonic revocation column/row locks.
5. Apply only separately authorized settings; install the new accepted state for
   each privilege and issue fresh registrations/tokens. Never reuse old grants.
   Interrupted transitions remain closed; no automatic fallback or un-revocation.
6. A reviewed policy/code rollover must create a fresh code/config inventory key.
   Immutable old inventories remain historical evidence and cannot satisfy a
   different governance manifest. Do not overwrite or delete them.

The transition validator and retirement operation are private control-plane
components, not public endpoints or owner-approval substitutes. Authenticating
owner evidence, durable monotonic state publication and process/IPC isolation
remain real acceptance gates. No agent/job/collaborator can approve its own policy
through workflow input or gain final editorial authority from these factories.

## Evidence and API limits

- Existing 537 tests retained; their assertions remain, with explicit governance
  fixtures/state and the two required contexts replacing legacy generic fixtures.
- 58 additional governance tests cover both modes; missing/ambiguous PR evidence;
  missing/pending/skipped/neutral/failed/wrong-source CI; latest attempt/suite;
  main/admin/force/delete/conversation gates; exact Environment ID/branches/secrets;
  reviewer eligibility/separation; collaborator-count non-transition; version/
  owner-evidence/predecessor validation; input/claim substitution; old registrations,
  grants, Pages capabilities and inventory rejection across policy retirement.
- Targeted suite: 145 passed locally, including existing identity/composition/SQL
  tests. Final full exact-head CI and targeted native trust results are reported
  with the Draft PR, without a self-referential evidence commit.
- Real authenticated metadata for main `90cff7...` / merged PR17 / latest general
  CI `41091055864`, check suite `111389111254`, checks `124184727237` and
  `124184726919` was correlated successfully by verifyMergedChecks using captured
  connector responses. This verifies metadata representation, not protections/OIDC.
- Actual GitHub responses have empty run.pull_requests after merge and duplicate
  check names across suites even with filter=latest. The adapter resolves the exact
  merged PR and the latest required-ci.yml run/attempt rather than guessing.
- Official REST documentation explicitly allows required_approving_review_count=0:
  https://docs.github.com/en/rest/branches/branch-protection?apiVersion=2022-11-28
- **Actual zero-review protection API read-back remains NOT VERIFIED.** Main is
  currently unprotected; the connector's protection read returned 403 Resource not
  accessible by integration. No protected zero-review rule exists to inspect, and
  creating one is unauthorized here. Null/missing required_pull_request_reviews
  is rejected. Before accepting a live SINGLE_OWNER configuration, obtain an
  authorized administration read of the saved rule, explicit zero count/flags,
  empty users/teams/apps bypass lists and exact App-bound checks. If GitHub omits
  fields, stop for evidence/adapter review; do not equate absence with enforcement.

## Exact SINGLE_OWNER settings — separate approval before applying

- Classic branch rule, pattern main: Require PR before merging ON; Require
  approvals OFF / required_approving_review_count 0; dismiss_stale_reviews,
  require_code_owner_reviews and require_last_push_approval false.
- Require status checks ON, strict/up-to-date ON; exactly nyra-required-regression
  and nyra-required-production-build, each App15368. Verify latest successful
  contexts in the selector. No bypass users/teams/apps; enforce admins ON;
  conversation resolution ON; force-push and deletion OFF.
- Precreate nyra-build, nyra-inspection, nyra-publication only after separate
  authorization. No required reviewer rule, no admin bypass, exact main branch
  policy with no tags/wildcards, zero Environment secrets. Read back each actual
  numeric ID and explicitly pin it in separately accepted trusted configuration.
  A workflow must never auto-create the Environment as a shortcut.
- Preserve github-pages, Pages workflow/source/domain and ordinary delivery.
  Do not enable mandatory signing, linear history, merge queue or global action
  SHA enforcement as part of this change. No collaborator invitation is needed.

Remaining gates: authorized read-only repository/Environment/access/secret-name
metadata; separately authorized actual settings and live zero-review read-back;
isolated registrar/broker/IPC and durable policy state; genuine issuer-signed
immutable full subjects; actual referenced_workflows run representation; genuine
protected job registration and normal-build provenance registration/consumption.
No full subject suffix, environment ID, credential or successful real OIDC result
is invented. Real publication/witness/receipt E2E remains Phase5D.

Website, Pages and all workflow files, crypto OIDC verifier, editorial owner/MFA
service, publication contract, inspection/rights/receipts and historical migrations
are unchanged. No real article, OpenAI call, production migration/bucket/Edge
operation or publication/inspection activation. Stop for external review.
