# Phase 5C-B1 — required CI and GitHub configuration preparation

Status: PREPARATION ONLY. Branch/Draft PR implementation; no merge or
administrative change authorized by this packet. Publication and inspection
remain inactive. The actual configuration sequence below requires separate
external approval before execution.

Baseline/main: `4214bd1e197c9eaf4b0105507cfdc21e4d336f38`.
Baseline tree: `7256815b1de85bd0b48bb412b3992daeb1a15035`.
Verified historical Pages run: `41073128275`, success at that main SHA.
Branch: `prep/nyra-phase5cb1-required-ci`.

## General CI implementation

Only `.github/workflows/required-ci.yml` and this document are added. Existing
Pages, isolated native/Edge/5C acceptance workflows, runtime implementation,
owner/MFA authority, publication contract, migrations and dependencies remain
unchanged. No 5A/5B native suite is rerun by this workflow.

| Property | Implemented behavior |
| --- | --- |
| Workflow | `Nyra required CI` |
| Stable regression context | `nyra-required-regression` |
| Stable build context | `nyra-required-production-build` |
| Trigger | Every runnable PR targeting `main`: opened, synchronize, reopened, ready_for_review, edited |
| Draft PRs | Included; no draft condition |
| Base retargeting | `edited` includes a PR retargeted to main |
| Feature branches / file types | No head-branch, author, fork, label, path or file-type predicate |
| Job/step conditions | None; no dependency jobs, continue-on-error, or soft-failure wrapper |
| Checkout | Exact `github.sha`, the GitHub PR test-merge commit; credentials not persisted |
| Source correlation | Both jobs log event, ref and tested SHA; run metadata separately identifies PR head |
| Runner / runtime | GitHub-hosted ubuntu-24.04, Node 22, 15-minute job limit |
| Actions | Previously approved immutable checkout/setup-node commits from 5C-A |
| Permissions | Explicit contents:read only; no id-token, Pages, deployments, write scope or Environment |
| Credentials/configuration | No secrets, inherited secrets, production variables, broker/DB/Storage credentials |
| Regression | Locked npm installation and complete essential `npm test` suite |
| Build | Independent locked installation, normal `npm run build`, public-entry and isolation assertions |
| Isolation | No publication witness/private source paths/source maps/private canaries, private provenance or secret-key markers |
| Public inventory size | Recorded, not hardcoded: legitimate future website assets must not cause lockout |
| Deployment | None; no upload, dispatch or publication step |

The two required check names are unique across the current workflows. The old
`nyra-5c-*` checks and generic Pages `build`/`deploy` are NOT replacements for
these contexts. Do not make old branch-scoped/skipped checks required.

GitHub itself can withhold a run pending fork-contributor approval, when a PR
cannot be test-merged, or for commit-message skip directives. These are not
successful executions of this workflow. With exact required contexts configured,
missing/pending checks must block merge; never waive them or count a legacy
skipped job as evidence. Approve an eligible fork's read-only run through the
normal reviewed GitHub mechanism; do not switch to pull_request_target.

The workflow does not support a merge queue yet. Do not enable a merge queue
without a separately reviewed `merge_group` trigger and acceptance. Repository
write access can modify workflow YAML, so independent PR review of workflow
changes remains part of the trust boundary; status-name/App pinning alone does
not make repository code trusted.

## Current administration inventory — observed 30 October 2026

Sources are current authenticated connector reads and read-only observations in
the repository owner's signed-in GitHub Settings. No form values were edited,
no Save/Add/Remove/Invite/Enforce control was used, and no secrets were revealed.

| Surface | Actual observed state | Evidence / interpretation |
| --- | --- | --- |
| Main SHA/tree | Exact baseline above | Branch REST read |
| Main protection | `protected=false`; enforcement off, contexts/checks empty | Branch REST read |
| Classic branch rules | No existing rules listed | Settings > Branches: only add-rule options |
| Rulesets | `[]`, zero | Repository rulesets REST read |
| Required PR reviews | None enforced on main | No main protection/rule |
| Required check/App binding | None configured on main | No required contexts/checks; actual new check App identity must be captured from the real PR run |
| Independent reviewer readiness | **NOT READY — 0 collaborators** | Settings > Collaborators: "Only you can contribute" and no invitations yet |
| Repository ownership | Personal public repository, owner `Noctua76` | Settings > General / Collaborators |
| Default GITHUB_TOKEN | Read repository contents and packages | Selected radio in Settings > Actions > General |
| Actions PR creation/approval | Disabled | "Allow GitHub Actions to create and approve pull requests" unchecked |
| Allowed actions | Allow all actions and reusable workflows | Selected radio |
| Repository-wide immutable action requirement | Disabled | Full-length commit SHA requirement unchecked |
| Fork run approval | Require approval for first-time contributors | Selected radio |
| Retention | 90 days | Actions General retention field |
| Environments | Only `github-pages`, ID `22825945319` | Settings > Environments |
| Required Environment reviewers | Disabled; no reviewer rule | github-pages Required reviewers unchecked |
| Environment self-review prevention | No effective reviewer gate; latent option not verified | Do not infer a hidden setting while required reviewers are disabled |
| Wait timer | Disabled | Unchecked |
| Environment admin bypass | Enabled | "Allow administrators to bypass configured protection rules" checked |
| Deployment branch policy | Selected branches/tags; exactly `main`, 1 branch, 0 tags | github-pages Environment screen |
| Existing Pages Environment secrets/variables | None configured | Environment screen reports no secrets/no variables; no secret values accessed |
| Separate Nyra Environments | Absent | Environment list contains only github-pages |
| Pages source | GitHub Actions, existing `pages.yml`, github-pages Environment | Settings > Pages |
| Pages deployment | Live at `https://eliaskalyvas.gr/`, latest run `41073128275` | Settings > Pages |
| HTTPS | Enforce HTTPS enabled | Settings > Pages |
| OIDC subject template | Use default template enabled | Settings > Actions > OIDC |
| Immutable OIDC subject | Enabled, checkbox disabled, automatically enabled for this repository | OIDC screen |
| Exact displayed subject prefix | `repo:Noctua76@217035723/eliaskalyvas-website@1389733212` | OIDC screen; not a decoded JWT |
| Actual paid account plan / future protection enforcement | NOT VERIFIED | No billing changes or live protection configuration performed |

The owner account alone is not an independent reviewer for its own PRs or
deployments. An external review in chat is not a GitHub collaborator invitation,
eligible PR approval, or Environment review. No candidate GitHub identity is
invented or invited here. The owner must nominate an independent person, verify
the account, separately authorize the access grant, ensure the invitation is
accepted and verify write-level PR-review eligibility before review protection
is enabled. Environment reviewers need at least read access; use the already
verified independent collaborator rather than treating the public audience as
an approved operations reviewer.

### Newly verified immutable-subject compatibility blocker

The legacy name-only production subject examples in the historical 5C-A packet
are not the repository's displayed default prefix. This B1 inventory supersedes
those examples for configuration planning; historical code/docs are preserved.

Do not disable immutable subjects or accept both formats/wildcards as a
workaround. Keep the verifier's exact subject equality. A separately approved
protected invocation must demonstrate the real issuer-signed full subject,
including the Environment context, before the policy/registration is pinned.
The displayed prefix is established; full real JWT claims remain NOT VERIFIED.
The existing configurable verifier can require an exact subject; no verifier
rewrite or OIDC request is necessary or authorized in B1.

## Read permissions and exact owner verification screens

The connector's branch-protection endpoint returned HTTP 403 "Resource not
accessible by integration". Its Actions permissions endpoint was rejected as
unsupported. This is not evidence that the owner lacks administration rights.
The signed-in browser could read the settings above without changing them.
This human-readable inventory does not provision the ongoing authenticated
Administration:read source needed by the future identity broker.

| Screen | Minimum owner verification before separately approved changes |
| --- | --- |
| [Settings > Collaborators](https://github.com/Noctua76/eliaskalyvas-website/settings/access) | Named independent GitHub account, accepted invitation, effective write access; no owner self-review substitute |
| [Settings > Branches](https://github.com/Noctua76/eliaskalyvas-website/settings/branches) | Exact main pattern; required review/check toggles; strictness; administrator enforcement; force-push/deletion/bypass state |
| [Settings > Actions > General](https://github.com/Noctua76/eliaskalyvas-website/settings/actions) | Read-only default, approval permission off, external-contributor policy, allowed actions and SHA requirement compatibility |
| [Settings > Environments](https://github.com/Noctua76/eliaskalyvas-website/settings/environments) | Exact new Environment names and independent reviewer eligibility |
| [Configure github-pages](https://github.com/Noctua76/eliaskalyvas-website/settings/environments/22825945319/edit) | Preserve existing main-only policy, reviewer/bypass state and existing deployment compatibility |
| [Settings > Pages](https://github.com/Noctua76/eliaskalyvas-website/settings/pages) | GitHub Actions source, existing workflow/Environment, live domain and latest successful deployment |
| [Settings > Actions > OIDC](https://github.com/Noctua76/eliaskalyvas-website/settings/actions/oidc-configuration) | Default template, immutable-subject status and exact displayed prefix; do not change them |
| Draft PR > Checks > Nyra required CI > job details | Both exact context names truly ran, successful conclusion, current head/test-merge association, GitHub Actions App identity |

Current public-repository Settings exposes reviewer and administrator-bypass
controls. Actual entitlement/enforcement for newly created protected
Environments must still be verified during the separately approved operation.
If GitHub presents a plan or permission restriction then stop and report its
exact message; do not presume an upgrade is necessary or bypass the restriction.

## Ordered administrative change plan — DO NOT APPLY IN B1

Each mutation below requires separate approval. A dependency marked STOP must be
resolved before continuing; do not activate an incomplete rule and rely on an
administrator bypass to keep development moving.

1. **Approve and merge B1 separately.** Review this exact workflow/packet and its
   real Draft PR CI. Only a later merge authorization may install it on main.
   Verify the post-merge Pages deployment and unchanged website. Until then no
   required-check setting may refer to the replacement workflow.
2. **Establish independent reviewer readiness.** The owner nominates/verifies the
   independent GitHub account and separately authorizes an invitation/access
   grant. Confirm acceptance and effective write permission. Confirm availability
   to approve PRs authored/pushed by Noctua76 and to review future deployment
   jobs. STOP while the collaborator count remains zero or eligibility is unknown.
3. **Preflight the installed checks.** Use a later ordinary documentation-only PR
   against main, including Draft and a normal feature-branch name. Both stable
   contexts must really run on its current test-merge revision. Confirm no duplicate
   context names across workflows; capture run/job/check IDs and the actual App.
   Ensure both contexts appear in GitHub's selectable recent-check list. Missing
   contexts, pending fork approval or skipped jobs are STOP conditions, not grounds
   to select generic Pages build or historical branch-scoped checks.
4. **Prepare one complete classic main protection rule.** The accepted 5C-A live
   verifier reads the classic protection API. Do not substitute a ruleset-only
   rule without a separately reviewed/tested adapter. Pattern exactly `main`.
   Require PR review: one independent approving review, dismiss stale approvals,
   approval of the latest push, resolve conversations. Enforce for administrators
   ("Do not allow bypassing the above settings"). No review/check bypass actors.
   Require strict/up-to-date status checks: exactly `nyra-required-regression` and
   `nyra-required-production-build`, bound to the GitHub Actions App verified on
   the real run (expected App ID 15368; verify, never blindly hardcode another App).
   Leave force pushes and deletions disabled. Recheck reviewer/check readiness
   immediately before saving the complete approved rule.
5. **Verify protection without lockout.** Read back actual saved state via an
   authorized read-only Administration source and inspect the owner UI. Verify
   the preflight PR is blocked without review/check success and can proceed only
   after legitimate independent review and successful current checks. Do not
   merge a canary or intentionally bypass a gate without separate authorization.
   If a prerequisite unexpectedly fails, stop before further configuration;
   correcting/rolling back a live setting also requires explicit authorization.
6. **Precreate separate Nyra Environments, one at a time.** After confirming the
   reviewer, create exact names `nyra-build`, `nyra-inspection`, `nyra-publication`.
   For each: required independent reviewer; prevent self-review; disable admin
   bypass; Selected branches and tags with exactly branch `main`, no wildcard or
   tag rule. Read back and verify each environment before proceeding. No workflow
   may auto-create an unprotected Environment. Do not add credentials or activation
   variables in this configuration step. Preserve owner/MFA and single-owner-action
   publication contracts; operational review behavior needs separate acceptance.
7. **Preserve ordinary website delivery.** Leave `github-pages`, its existing
   main-only branch policy, reviewer/bypass settings, Pages source/domain and
   `pages.yml` unchanged. Do not require a github-pages deployment to succeed
   before PR merge: it currently deploys only after main push, creating a circular
   dependency. Do not enable linear history, mandatory signed commits, merge queue
   or a global full-SHA action rule without separately preparing compatibility.
   In particular, the current Pages workflow uses major action tags and would be
   disrupted by enabling a global immutable-action requirement now. The new CI
   already uses reviewed immutable pins and does not need that global switch.
8. **Provision trusted read access and pinned identities later.** Separately
   approve a repository-scoped read-only administration/Actions/checks metadata
   source for the broker. Pin reviewed caller/reusable workflow paths and SHAs,
   real immutable subject values, per-privilege audiences and independently
   registered job facts. Ordinary Pages identity must never authorize Nyra
   publication. Do not assume `nyra-publication` can replace the Pages Environment
   in Pages API/OIDC checks; validate that compatibility independently first.
9. **Perform genuine protected acceptance only under later authorization.**
   No production publish: establish actual GitHub issuer/JWKS verification,
   protected Environment claims, current main/code/workflow/job correlation,
   isolated registrar/broker, revocation/rotation/reconciliation and protected
   normal-build inventory registration/consumption. Unprotected/local inventory
   must continue to fail authorization. Phase 5D owns full Pages/witness/receipt
   lifecycle acceptance before any publication activation.

## B1 acceptance and remaining blockers

The final PR description/report carries exact base/head, changed-file list,
workflow/run/job/check URLs, source App identity, tested merge SHA and final
counts. Keeping final evidence there avoids changing the tested commit merely
to insert its own SHA/run URL into this document.

| Evidence | B1 interpretation |
| --- | --- |
| New general jobs execute on the real Draft PR | Required B1 CI evidence; not proof of live branch enforcement |
| Unconditional jobs / no path or head-branch filters / read-only pins | Structurally verified; real job steps must also run |
| Normal production build and isolation | Required B1 CI evidence; no deployment performed by new workflow |
| Actual settings inventory | Read via connector and owner UI; no administrative mutations |
| Independent reviewer | NOT READY: zero collaborators; owner action needed under separate access approval |
| Main/Environment enforcement | Not installed; separate approval and readiness required |
| Immutable GitHub subject | Prefix verified in Settings; full protected JWT NOT VERIFIED |
| Genuine protected OIDC / independent job registration | NOT VERIFIED; not requested or dispatched |
| Protected normal-build provenance registration/consumption | NOT VERIFIED; local/PR evidence remains untrusted |
| Registrar/broker, key rotation, code rollover/reconciliation isolation | Remaining protected acceptance blockers; no provisioning here |

No merge, administration change, production migration, secret/credential/bucket
change, Edge deployment, publication dispatch, real article or OpenAI API call
is performed in B1. Stop after the final general-CI result for external review.

## Official references used for the plan

- https://docs.github.com/en/pull-requests/reference/status-checks
- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims
