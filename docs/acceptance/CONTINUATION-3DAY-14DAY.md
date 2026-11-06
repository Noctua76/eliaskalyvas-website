# NYRA — continuation: 3-day execution goal / 14-day host window

**Branch-only preparation. This is NOT an installer, migration capsule, owner authorization, or approved DigitalOcean creation.** No production activation, key generation, PR merge, provider charge or OIDC dispatch.

## Proven baseline
- Approved main: `29a73458d4cd941e5ed514db56dc2c553d041bda`.
- Original host (DigitalOcean ID `615221104`) was destroyed after a successful Nov4 local expiry cleanup. Its DB/container/network/credentials/time-bound trust must not be treated as still existing.
- Historical Stage 3F GitHub Administration readback succeeded; capture digest `b230ef7e092ff661aa2e8fdfc307ef3db5dbdad28c88a051b9aab1474ff5788e`. It is historical evidence **only**, not host-bound authorization for a new environment.
- Draft PR #31 carries a prior-host/source-pinned credential helper. Draft PR #32 documents a Nov5 extension that was explicitly NO-GO live. Neither is a new-host deployment package or safe to merge blindly.
- Existing GitHub App remains installed; GitHub declined deletion of its only registered key. Rotate under separate approval, using a new securely generated private key; do not transfer the old host PEM.

## Schedule
- **Before Day 0:** independently approve clean source/CI, new-host-aware 3F/3G profile, exact offline bootstrap, isolated PostgreSQL provisioning, 14-day host expiry, 7-day extension migration (fully tested before provisioning), immutable source/config/unit pins, restart/partial failure/retirement tests, and key rotation plan. Check DigitalOcean cost. Obtain separate Owner authorization to incur charges/create the exact new resource.
- **Day 0–1:** create and authenticate the approved host, build the exact private environment, verify firewall/DB/57-file closure, new GitHub App key and fresh Administration readback.
- **Day 1–2:** actual Owner/MFA/AAL2 and repository governance/registrar/broker trust verification.
- **Day 2–3:** protected OIDC discovery and provenance, independent run-bound verification, rollback and retirement acceptance. Any security blocker is STOP, not permission to skip.
- **Day 7:** progress review (contingency only). **Day 10:** explicit extension decision (+7 days only with approved, verified enforcement). **Day 14:** original planned host retirement if no approved extension.

The host is 14 days; GitHub tokens, owner/MFA sessions, OIDC proofs, evidence freshness, registrations, owner worker and database leases retain their independent short TTLs and must be renewed through properly authorized workflows when needed. A 3-day delivery goal is not a 3-day expiry. The extension decision date is not a delivery target.

## Mandatory integration work (outstanding)
1. Reconcile source-compatible PR31 behavior and PR32 watcher/extension code against current main; remove retired-host exact-date exceptions.
2. Build a deterministically pinned new-host bootstrap plus operator capsule: real before/after source/config/unit digests, protected credentials, exclusive attempts, tested expiry and reversible partial-state behavior.
3. Verify 14-day host lifetime with short-lived owner/identity and OIDC sessions; pre-test one +7-day extension without replaying old authorization.
4. Include all private attempt, token, key, evidence and Docker volume cleanup in a reviewed exact-scope retirement procedure; distinguish DigitalOcean resource destruction/billing.
5. Produce independently observed pre/post checks, host-specific owner approvals and required CI before any live operations.

The new `continuation-readiness.mjs` is an offline fail-closed *proposal* checker. Its PASS means only readiness for a **separate live review**, never authority to provision. Preserve SINGLE_OWNER governance and existing production isolation.
