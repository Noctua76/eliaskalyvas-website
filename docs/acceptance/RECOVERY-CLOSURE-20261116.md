# NYRA Stage 3G — Recovery closure and next execution boundary

Recorded 2026-11-16T22:03:56.432Z. Review checkpoint only. No executable successor approval is requested.

## Accepted closure

The existing Recovery incident is CLOSED / PASS on actual Owner-provided evidence:
the existing ED25519 key was loaded into the restored local agent, Recovery SSH
authenticated, native unmount returned NYRA_RECOVERY_UNMOUNT_PASS with exit 0,
Boot from Hard Drive completed, and normal Ubuntu SSH returned the expected
hostname/root device with SSH_EXIT=0. The exact execution UTC was not supplied;
screenshot metadata is not substituted for it.

**No R2 UFW write was required or executed.** Previous R2 scopes, failed attempts,
transport fixes and evidence remain historical. They must not be retried or used
as active authorization. The earlier authentication STOP is superseded by this
closure. The old proposed UFW postimage must never be presented as actual output.

Authenticated readbacks during this continuation confirm approved main
`4edff2353c55469918f2e3a90190916df9a8924d`, tree `8fdac1689db7d0d2172481c4eb446bb20be18962`,
the two accepted parents and PR36 merged. The existing acceptance Droplet is
active; its firewall is succeeded, bound to the expected tag, with the
Owner-confirmed SSH source and no pending changes. No provider setting changed.
Private host identifiers, allowlist values, raw screenshots and private evidence
links are deliberately retained in the private acceptance record.

## Current gate

Historical G01–G07 acceptance remains intact. Current G03/G04 access recovery is
PASS on the accepted native evidence. Inactive source alignment and TLS
carry-forward remain unverified. G08 STOP; G09–G12 PENDING. A new protected
15-minute cycle has not started.

v16 alignment expired at 2026-11-16T14:59:56Z. v17 alignment expired at
2026-11-16T19:04:19Z. Its preserved TLS hash
`12d82a85c36e0c8216b9f6cdca26d9cd730f14954b952a2ecdc2218b337bb8ca`
is a non-temporal content binding; it does not make the expired approval usable.
The last recorded Owner decision (09:08:15Z) and session (09:40:48Z) are expired.
Current Administration and database role credential expiries have not been read
from the host; no validity or mandatory rotation is inferred.

## Minimum executable successor package

Resume from the retained v17 archive using the accepted New-NyraRelease.ps1
generator and actual GitHub release receipt. Do not manually edit old times/hashes,
use an obsolete repository scheduling example, or regenerate the whole project.
Preserve accepted source, native modules, policies, signers, immutable target,
original TLS evidence, journals, attempt reservations and host retirement.

1. Recover original archive bytes and verify its recorded outer SHA256 plus all
   manifest/runtime/helper pins; inspect exact existing release-binding source.
2. Reconcile existing local and host attempts read-only before permitting staging.
   A fresh work directory is allowed only after conclusive pre-staging failure.
   Unknown outcome requires reconciliation; never delete/reset reservations.
3. Bind a genuinely future, non-overlapping bounded window through the unchanged
   generator. Record exact scope/dependency diffs and hashes. Keep TLS bytes fixed;
   obtain its separate explicit decision tied to that exact new window.
4. Use normal Ubuntu host identity, not the Recovery host key. Inspect the original
   transport for resolved KEX, agent, signature, quoting and IP-freshness failures.
   Rebind only demonstrated stale operator values; do not change immutable target.
5. Validate the targeted changed bindings and security negatives, including expiry,
   wrong source/window/TLS, identity substitution and uncertain attempt state.
   Synthetic/source checks cannot establish native Windows compatibility or live
   alignment. Do not rerun completed historical CI.
6. Submit the actual package and exact hashes to the Independent External Auditor.
   Obtain the exact required Owner scopes and bound-package acknowledgment only
   after the concrete reviewed package exists.
7. Perform authorized inactive alignment/TLS and verify native receipts. Stop at
   PREPARATION before bearer input, credential refresh, activation or G07/G08/G09.
   Then inspect actual credential/session state and use the established fresh gates.

The existing generator and complete v17 bytes could not be executed or unpacked in
this turn: the Project execution environment reports unavailable. The connected
provider catalog exposes metadata readback but no command runner for this existing
Droplet; sandbox/MicroVM tools are different resources and were not provisioned.
No private SSH key, token or new credential was requested.

This is a concrete closure/review checkpoint, **not an execution-ready package**.
New scope hashes, ZIP hashes or native test results are not invented.

## Failure prevention applied

| Previous failure | Control for continuation |
|---|---|
| keyscan KEX / missing agent / public-key probe mistaken for auth | Do not repeat solved diagnostics. Normal SSH exit 0 is retained; inspect reviewed transport before its next use. |
| wrong Recovery fingerprint | Use existing normal Ubuntu pin; never transpose a screenshot fingerprint or reuse Recovery identity after normal boot. |
| PowerShell/Bash quoting and corrupted paste | Retain reviewed file/stdin transport; no interactive multipart commands or large console paste. |
| operator IP / UFW mismatch | Current provider readback matched Owner baseline; next live step requires fresh authorized operator/source comparison. |
| expired scopes / obsolete script pins | v16/v17 expired, R2 retired unused; generator must produce exact new bindings, not textual substitutions. |
| uncertain attempts / blind retry | Preserve journals and reservations; read-only reconciliation before staging. |
| offline pass claimed as native pass | No new native tests or live alignment claimed in this checkpoint. |
| incomplete persistence / HTTP401 | Private register version15 read completely and hash matched; no private writeback is claimed without a successful save result. This review packet is a separate durable sanitized record. |

## Review requested

Review the incident closure classification, expiration assessment, preservation of
historical PASS, and the next execution boundary. Final successor execution review
is blocked until the exact generated package and targeted validation exist.
Independent acceptance remains separate from implementation. No merge, production
activation, protected write, OIDC dispatch or collaborator invitation is requested.
