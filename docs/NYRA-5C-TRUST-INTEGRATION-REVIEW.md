# NYRA Phase 5C — trust integration review

**Status:** INACTIVE BRANCH IMPLEMENTATION — NOT LIVE TRUST ACCEPTANCE.
Repository: Noctua76/eliaskalyvas-website; existing Draft PR #20.
No merge, production publication, protected dispatch, Caddy activation or acceptance claim.

## Actual DigitalOcean observations (operator-supplied terminal screenshots)
- FRA1 Ubuntu, DNS/HTTPS, firewall and host preflight: PASS.
- PostgreSQL 17 private Docker network, no published ports, distinct DB logins.
- Registrar/broker cross-credential substitution: DENIED.
- Real separate-role process and authenticated IPC identity-only proof: 17/17 PASS.
- No real jobs registered, owner authorization or protected acceptance.

## Branch-only integration changes
- Watcher now revokes scoped registrations on completed runs; rollback on partial failure;
  failed revocations stay in state for retry but readiness becomes false.
- Readiness requires exact original GitHub check-run URL, run attempt and SHA.
- Inactive private trust composition binds independent admin/Owner gates, pinned
  Ed25519 signed observation verification, exact run/check identity and receipt storage.
- Repeat, stale, unsigned, wrong-role, missing-owner and revoked-admin paths fail closed.
- No listener, dispatch, token source or role process is started by these imports.

## BLOCKED / NOT VERIFIED in the real host
1. Independent authenticated GitHub administration reader with Administration:read.
   The connected GitHub integration returned 403 for main branch protection.
2. Complete owner-authoritative GitHub App inventory and effective permissions.
3. Fresh existing Owner AAL2/MFA session, signed short-lived decision and risk acknowledgement.
4. Privately pinned evidence keys, durable store and role-specific broker acceptance operations.
5. Genuine registrar registration/revocation and broker OIDC verification across distinct
   isolated live processes — current real IPC probe tests identity only.
6. End-to-end host process binding, scoped egress, approved HTTPS ingress, issuer-side
   revocation, real protected GitHub OIDC runs and independently signed evidence.
7. Cleanup of temporary secrets, proxy/DNS rollback and DigitalOcean Droplet destruction.

## Expiry
Previously observed PG17 automatic expiry: 2026-10-31 21:21:16.663 UTC
(23:21 Europe/Athens). The timer removes temporary DB resources, NOT the Droplet.
If the DB expires, provision a new isolated window only after scoped cleanup.
Neither a dry run nor CI tests can substitute for actual owner-risk authorization.

## Decision
Remain Draft and fail closed. Do not enable public ingress, real GitHub dispatch or
production publication until all independently verified gates are accepted.
