# NYRA Phase 5C — inventory source decision (review proposal)

**Date:** 2026-11-01  
**Status:** SINGLE_OWNER technical feasibility proposal — NOT TRUST ACCEPTED / NOT PRODUCTION AUTHORIZED  
**Repository:** `Noctua76/eliaskalyvas-website`  
**Reviewed main baseline:** `dea8c5ede7df2d11a2de856d966046ca341f1ed6`  
**Scope:** non-executable decision record only. No policy, verifier, deployment, GitHub settings, migration, credential, runtime, or production changes.

## Binding governance — SINGLE_OWNER, not a second human reviewer

The owner-approved `SINGLE_OWNER` governance in [NYRA-GOVERNANCE-REVIEW.md](NYRA-GOVERNANCE-REVIEW.md) **supersedes the historical B1/B2 mandatory second-person review model**. The owner `Noctua76` is the sole administrator and final editorial authorizer. The intended branch rule requires a PR and exactly **zero mandatory GitHub approval reviews**, while retaining strict required checks `nyra-required-regression` and `nyra-required-production-build` (GitHub Actions App 15368), enforced administrator protection and no bypass/force-push/deletion. The three Nyra Environments have no mandatory human reviewers and are restricted to `main` with no privileged secrets. `OWNER_WITH_REVIEWERS` is strictly future/opt-in.

**Do not request a second GitHub account, separate email, collaborator invitation, or outside PR/Environment reviewer as a prerequisite to this plan.** A second account run by the same owner would not provide independent human approval. The term **independent** in source validation means technical control separation: non-delivery credential/capture authority, independently pinned signing key, source-derived metadata and cryptographic verification; it does **not** require a second human GitHub identity.

The existing narrow GitHub integration cannot currently read the complete branch-protection settings (HTTP 403). `main.protected=true` and App-bound required-check metadata are visible, but the exact zero-approval, no-bypass and Environment settings require an authorized read-back before a *live* trust claim. Do not infer them merely from `protected=true`.

## Decision sought

**Recommendation: HOLD the existing five-minute full-account integration-inventory trust gate unchanged; stop repeated captures based on the current extraction approach.** First establish whether an independently controlled, owner-authenticated source can *actually* supply complete, correlated, effective permissions across the five required families, with verifiable provenance and an independent signer. No additional capture run or signer implementation is approved by this proposal.

**Do not adopt the proposed `BOUNDED_ACCEPTANCE_WINDOW` (15 minutes) yet.** A longer freshness window cannot repair missing permission evidence, incorrect classification, absent source attestation, or unknown write authority. If complete evidence later becomes demonstrable but repeat refresh within five minutes is infeasible, that bounded, non-publishing exception must receive an explicit owner decision and separate technical threat-model validation with its 15-to-30-minute stale-observation risk. It is *not* a production policy.

This proposal is **not itself an owner/MFA decision or independent technical evidence**. It must not be cited as a signed inventory, cryptographic attestation, policy acceptance, owner-risk decision, or authorization to merge/activate. In SINGLE_OWNER, a separately recorded explicit owner authorization and independently checkable technical evidence replace mandatory second-person GitHub reviews.

## Evidence observed, and what it does not prove

The latest local sanitized `SAFE_LOCAL_CLASSIFICATION` reports:

| Diagnostic | Count |
| --- | ---: |
| Reviewed pages (details **and** overviews) | 27 |
| Actual detail pages | 23 |
| Overview-only pages (not permission detail evidence) | 4 |
| Detail pages with some explicit permissions | 6 |
| Detail pages without explicit permission evidence | 17 |
| Total pages without explicit permission evidence (including 4 overviews) | 21 |
| Recognized permission fields across 6 partial detail pages | 32 |
| Unvisited details reported by local diagnostic | 0 |
| Navigation/pagination gaps | 0 |
| Local regression checks | 10 / 10 passing |

### Source-specific feasibility matrix — no invented permission values

| Family | Actual evidence counted | What is still missing |
| --- | --- | --- |
| Installed GitHub Apps | 5 detail pages; 27 individual fields recognized across partial pages | Verifiable full permission matrix, immutable App/installation IDs and exact repository scope for each |
| Authorized GitHub Apps | 8 detail pages; no explicit permission fields recognized | Grant-level permissions, distinction from installation permissions, effective acting-on-user authority |
| Authorized OAuth Apps | 7 detail pages; no explicit permission fields recognized | Source-verified token scopes and actual effective repository capabilities; no inference from an application name |
| Personal access tokens | 3 detail pages; 5 recognized fields on one partially evidenced page | Classic/fine-grained scope, target resources, expiry and each effective right; do not capture token bytes |
| Repository integrations | **4 overview pages**, **0 actual per-integration detail pages** | Enumeration and effective permissions for repository Apps, deploy keys, webhooks and relevant write paths |

**No family meets the complete signed-audit requirement.** The 4 overviews must not be described as detail-page observations. The apparent 0 navigation gaps means only that the diagnostic traversed its known URLs, **not** that all relevant grants and effective rights were enumerated independently.

For source-to-contract mapping, the GitHub source may expose privileges beyond the verifier's `read/write/none` vocabulary (for example fine-grained token `admin`). A reviewed mapping must preserve the original elevated level in authenticated private evidence and conservatively represent its **write-capable risk** without silently downgrading it. Missing fields may be recorded as `none` only with explicit authoritative negative evidence. This change proposes **no code modification** to the existing normalization contract.

**Inference boundary:** 27/27 pages visited is recorded navigation coverage only; only 23 were true detail pages. `withoutExplicitPermissions` means **UNKNOWN**, not `none`; partial fields cannot be promoted to a complete account-wide permission matrix. The report is `complete:false`, `independentlySigned:false`, `acceptedForTrust:false`, `liveAcceptance:false`, `productionAuthorized:false`. The test suite validates classifier behavior only.

## Existing technical trust contract (unchanged)

`lib/publication/runtime/application-inventory.mjs` requires a separately signed `nyra.authenticated.integration-audit.v1` envelope with:

- fixed owner ID `217035723`, repository ID `1389733212`, repository name `Noctua76/eliaskalyvas-website`;
- authenticated and complete coverage of five families: installed GitHub Apps, authorized GitHub Apps, authorized OAuth Apps, personal access tokens, and repository integrations;
- complete pagination, source URLs and per-family capture SHA-256; an empty `outstanding` list;
- actual immutable identifiers, scopes, repository access, and **eight explicit** permission values (`read`, `write`, or demonstrably `none`) for every integration;
- observed time derived from the **oldest relied-on source**, age strictly below five minutes, no clock-forward timestamps;
- verified Ed25519 signature using an independently approved pinned key. Re-signing stale data, a fabricated `complete:true`, or a screenshot alone must never pass.

`lib/publication/runtime/administration-evidence.mjs` additionally requires live protected repository and Environment evidence, a repository-scoped independently provisioned read credential, and a fresh **less-than-60-second** challenged owner AAL2/MFA risk receipt tied to the accepted applications digest. Source absence and changed evidence must remain fail-closed.

## Source feasibility — established limitations

GitHub documents owner-facing Settings views for authorized OAuth Apps, installed GitHub Apps and PATs. API endpoints available to a particular app or installation are not an authoritative export of every OAuth grant, personal token and effective repository capability owned by the account. No documented single complete GitHub-signed account-wide export has been established. Consequently the connected developer App, one repository PAT and the current browser text diagnostic cannot independently certify the whole required trust contract.

This is **not** a claim that a complete account capture is theoretically impossible. It is a finding that **the available evidence does not demonstrate one**.

Official documentation:
- https://docs.github.com/en/apps/oauth-apps/using-oauth-apps/reviewing-your-authorized-oauth-apps
- https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps
- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- https://docs.github.com/en/rest/apps/oauth-applications
- https://docs.github.com/en/rest/apps/apps

## One controlled source-feasibility gate — BEFORE another capture

The **sole owner**, using a separately documented, challenge-bound owner/MFA authorization, must explicitly approve a concrete **read-only extraction specification**, not an unbounded new crawler. Technical verification remains separate from editorial owner approval; no second-person GitHub review is required:

1. Enumerate every required account and repository surface, with owner authentication and all list/detail pagination; independently correlate immutable IDs, scopes, all/selected repository coverage, permission semantics, effective rights, disabled/revoked entries and exclusions.
2. Provide a mapping **for each of the eight permission dimensions** from an authoritative observable field to `read`/`write`/`none`. Missing, hidden, ambiguous or conflicting fields remain **UNKNOWN**; show explicit denial evidence before asserting `none`.
3. Verify source completeness against independently observed item counts/identifiers. A Settings overview must not count as permission-detail evidence. Treat UI, account-privilege, pagination and schema changes as fail-closed.
4. Document a secure owner-session procedure: no passwords, cookie stores, bearer tokens, form secrets or private credentials captured in the persistent report, application logs, repository, ChatGPT, or signing input. Scrub **before** persistence; use private source hashes and metadata only.
5. Define a technically isolated, owner-approved capture/signing **process or service** outside the delivery runner and acceptance host, with a separate Ed25519 private key unavailable to delivery jobs, repository or development agent and independently pinned public key ID/digest. The source process must actually verify authenticated metadata; it must never sign an owner-typed JSON assertion. This separation does **not** require a second human account. Cryptographic independence may be weakened by compromise of a shared owner device; record that residual risk.
6. Execute **one approved** real metadata-only trial and compare it against the existing verifier, including positive completeness and deliberate missing-field, stale, permission-conflict, pagination-gap, wrong-owner and signature-failure negatives. No signed PASS is accepted unless the observed evidence satisfies all constraints.
7. Record end-to-end acquisition latency, including the *oldest* observation. A successful single fresh trial does **not** prove repeatable five-minute revalidation. Independently demonstrate repeat refresh or keep live acceptance blocked.

### Acceptance verdicts

- **GO to separately owner-authorized live trust planning:** every family/entry and effective permission evidenced, zero unknowns, independent source authentication and signature validated, full five-minute refresh demonstrated, owner-risk and remaining live gates *separately* satisfied.
- **HOLD:** any unknown field, uncorrelated integration, partial/overview-only view, absent signer/key pin, refresh beyond five minutes, or unverifiable authorization. Neither tests nor a passing admin preflight can override HOLD.
- **REDESIGN (separate architecture proposal):** if full capture cannot be evidenced, prepare a new repo-scoped authority/threat-model design (e.g., strictly bounded GitHub App and deployment principals). Do **not** reinterpret this as an automatic waiver for existing OAuth/PAT or personal-owner authorities. Any replacement trust policy requires separate documented technical security validation, explicit owner/MFA authorization, tested migration and a new acceptance contract — not a mandatory second GitHub reviewer.

## Operational instruction and stop rule

For now **STOP** repeated `review-existing`, `detail-capture`, manual screenshot harvesting and unnecessary PAT expansion. Do not request OAuth app client secrets, weaken permissions, modify owner account settings or create a signer just to achieve a passing output. Keep all production routes, Pages deployment workflow, `main` trust checks and publication authority unchanged. The previous FRA1 infrastructure is retired; do not resurrect its IP, DNS, credentials or expired trust pins.

The next authorization, if any, is **approval of the specific source-extraction/signer specification for one non-publishing feasibility trial only**. That authorization is *not* approval to merge, dispatch protected workflows, create a new host, provision secrets, publish articles, or activate production.

## Owner decision and objective security gate (SINGLE_OWNER)

The owner may **ACCEPT / REQUEST CHANGES / REJECT** the documentation-only feasibility plan. Accepting the document never signifies accepted inventory or permission to activate. The technical evidence gate remains fail-closed and separately verifiable. Required factual questions:
- Does the documented current contract provide any truthful way to treat current 21 unknown pages as complete? (Expected: no.)
- Is there a concrete owner-authenticated source and separately controlled signer that can prove actual permission semantics for all five families?
- Can strict five-minute freshness be demonstrated from the oldest observation, rather than a late signature timestamp?
- If no complete source is available, must a separate owner-authorized, technically validated repo-authority redesign replace repeated captures?

**Operational separation:** Human GitHub PR/Environment approvals = **0** in SINGLE_OWNER. Machine verification, signed-source provenance, owner AAL2/MFA, immutable policy/job/check binding, secure separation of capture from delivery, and fail-closed handling of UNKNOWN permissions are retained. No unverified human reviewer is substituted with a self-created GitHub identity.

## 2026-11-01 execution checkpoint — no more broad capture loops

**Observed owner-side administration diagnostic (historical, not fresh acceptance):** owner-authenticated `NYRA-5C-READ-ONLY` preflight reported 14/14 sections readable: protected main and App15368 required CI, one owner/administrator collaborator, zero deploy keys, read-only default Actions, and exact IDs/one main policy/zero secrets for the three Nyra Environments. `allReadable:true` **did not** mean complete owner integration inventory, independently signed evidence, genuine owner/MFA authorization, or live trust. No repeat of this already completed preflight is justified absent a changed admin fact.

**Latest code-side checkpoint:** main branch protection reports `protected:true` with App15368-pinned required checks. The connector's full branch-protection endpoint remains 403; only the private owner-preflight can supply additional admin detail. The captured integration diagnostic still has 17 true detail pages with no recognized permission fields, plus four overview-only pages. This gap cannot be fixed by changing `complete` or adding 10 more tests.

### Practical decision route — SINGLE_OWNER

**Preferred for engineering feasibility assessment, not yet authorized for code:** Evaluate a **repository-scoped, operation-bound trust model** as a separately reviewed replacement **proposal**, not a disguised PASS for the present account-wide gate.

1. **Define explicit trust boundaries:** GitHub protected main/CI, approved caller/reusable workflow commits, repository and owner numeric identities, exact job/check/run/attempt IDs, three Env IDs/rules and fresh independently read admin state. Preserve distinct protected OIDC audiences, isolated registrar/broker, immutable normal-build inventory, and challenged owner AAL2/MFA decision.
2. **Treat unknown write-capable integrations as a material residual risk, never as `none`:** A repository-only reader does not enumerate all OAuth/PAT/App authority. Record plausible workflow, merge and settings-mutation threats, their enforceable protections and what remains unenforceable. Never assert exclusive technical owner authority. A branch-protection snapshot does not establish that admin Apps cannot modify branch rules.
3. **Technical acceptance burden:** Build a threat/attack-path matrix; separately verify live repository/Environment protections and app-defined check origins, attempt/replay/rollback, signer/key isolation, configuration rollover, and closure of all privileged bypass paths. Require explicit owner/MFA acceptance of any remaining administration/write risk. No lower standard may be silently presented as equivalent to the full-account five-minute signed inventory requirement.
4. **Change management:** If and only if the owner explicitly selects this alternative, prepare a **separate Draft, branch-only policy-v2 proposal** with old-v1 and new-v2 modes mutually rejecting one another, targeted negative tests and no active runtime/deploy. Maintain current v1 inventory blocker until the new architecture passes real source and security acceptance. No migration/activation/merge from this document.

**Why this route is under consideration:** GitHub's documented App-installation endpoints are scoped to the authenticated App/installation and access rights can intersect with the owner's rights; they do **not** establish a universal signed inventory of every personal OAuth and PAT grant. The present authenticated 27-page UI diagnostic did not supply that missing effective-permission proof. References: https://docs.github.com/en/rest/apps/installations and https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app .

**Stop line:** This checkpoint adds only design analysis. A proposed replacement is a governance/security decision, not an approved trust downgrade. Existing runtime verifier, publication switch, trusted policy, `main`, ordinary Pages and all privileged workflows are unchanged.
