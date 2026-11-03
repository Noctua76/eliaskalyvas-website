# NYRA — Initial SINGLE_OWNER Governance Approval Proposal (acceptance-only)

**STATUS: PROPOSED / NOT APPROVED.** This file is a reviewable proposal, not an accepted governance manifest, live policy-state, owner/MFA authorization, token, dispatch approval, or production activation. Do not install it as `governance.json` or `launch.json`; do not derive authorization from the presence or Git commit of this file.

## Pinned subjects

- Repository: `Noctua76/eliaskalyvas-website`
- Repository ID: `1389733212` (GitHub API read-back)
- Repository owner login: `Noctua76`
- GitHub owner ID: `217035723` (GitHub API read-back)
- Acceptance bootstrap ID: `nyra-acceptance-20261102-01`
- Temporary DigitalOcean Droplet ID: `615221104` (operator-reported host evidence; not independently queried here)
- Intended host: `https://nyra-acceptance.eliaskalyvas.gr/`
- Recorded baseline main: `b97f396d805c34333aae6b12e29d22261ee54497` (reverify at actual evaluation)
- Historical Administration capture SHA-256: `142434efeaed3b61c01c6e4cf32858d31be5bde49aae9083467e55b1a6747743` (operator-reported, not equivalent to a passing policy evaluation)

## Proposed initial governance

```json
{
  "schema": "nyra.governance.v1",
  "mode": "SINGLE_OWNER",
  "policyVersion": 1,
  "ownerId": "217035723",
  "reviewerIds": []
}
```

The proposed `policyVersion: 1` is conditional on independent verification and explicit owner attestation that no previously **accepted and installed** governance version exists. Historical drafts/test fixtures are not accepted policies. Any contrary version history blocks this proposal; do not silently overwrite or increment.

The required 40-character `ownerAuthorizationSHA` is **intentionally absent** from this proposal. After independent review and an explicit GitHub-authenticated owner approval of the exact commit containing this record (and no subsequent changes), use that exact Git commit SHA as the candidate value; independently verify GitHub actor, referenced SHA, effective owner identity, scope and approval provenance. Creating this commit or PR is not approval. Never substitute the main SHA, a test SHA or a repository blob SHA.

## Authorized scope — only after explicit approval

- Permit the installation of the reviewed **initial SINGLE_OWNER governance manifest** into the private NYRA coordinator control-plane for **offline evaluation of one already captured repository-scoped GitHub Administration evidence record**.
- Bind offline evaluation to exact historical capture digest, governance digest, and evaluator source SHA. Preserve the original observation timestamp; never represent historical evaluation as a current live trust read-back.
- Keep exclusively owner-controlled repository authority; `reviewerIds: []` does not create reviewer privileges. Existing GitHub main protection, required CI, Environment protections, Actions permissions, deploy keys, and collaborator facts must each be evaluated as actually observed.
- Fail closed on missing, incomplete, stale, inconsistent or unevaluated facts, or absent independently authenticated monotonic live policy state. Document all gaps separately.

## Explicit exclusions

This proposal **does not** authorize:
- Creation/issuance of new personal access tokens, GitHub App installations or installation tokens beyond prior narrowly authorized capture.
- GitHub protected workflow dispatches, genuine OIDC acceptance invocations, bypasses, merges of executable code, branch-protection or Environment mutations.
- Creation/activation of evidence/owner signing private keys or owner/AAL2 risk authorization.
- Production publication, migrations, Storage, Edge, Pages cutover, OpenAI API access, public test article or any production credential.
- Extending the DigitalOcean host lifetime or suspending its local expiry timer.
- Retrospective alteration of the historical capture or a claim of live trust acceptance.

## Evidence and authorization procedure

1. Independent reviewer inspects exact Git tree/diff, verifies owner and repository IDs, first-policy history, boundaries above and source governance schema. Record explicit PASS/BLOCKED findings.
2. Owner reviews **the exact immutable commit SHA** and explicitly approves the proposed initial version, subjects, acceptance-only scope and exclusions using an attributable authenticated GitHub action/comment. Record this approval separately from the code commit. If the branch changes, re-review and re-approve the new exact SHA.
3. Only after 1–2 succeed, derive `ownerAuthorizationSHA` from the approved record's commit SHA; verify it has 40 lowercase hexadecimal characters, match provenance, assemble the narrowly scoped private manifest, and validate with `validateGovernance` / `hashJSON`.
4. Install the approved manifest privately with the coordinator's required ownership and `0600` file permissions, and run **offline-only** evaluation of the existing captured facts; emit an assessment with the original evidence timestamps and all three digests. No live acceptance claim.
5. Owner/MFA risk consent, independently pinned distinct signer keys, actual protected OIDC dispatches, and production remain **separate future gates**.

## Expiry and deletion constraint

The temporary FRA1 resource has a separate operator-controlled decision at 2026-11-03 22:30 Europe/Athens, and an existing host expiry timer reported for 2026-11-03 23:05 Europe/Athens. This proposal does not extend or override either. A provider-level DigitalOcean Droplet deletion is required to stop compute billing; archive sanitized evidence, revoke credentials and confirm all independently billable resources before deletion.

## Approval fields — not yet populated

- Independent reviewer / result: **PENDING**
- Exact proposal commit SHA: **to be recorded out-of-band after commit**
- Owner decision: **PENDING / NOT AUTHORIZED**
- GitHub-authenticated owner approval event URL and timestamp: **PENDING**
- First-installed-version/history confirmation: **PENDING**
- Private manifest hash / installation: **PENDING**
- Offline evaluator result: **PENDING**
