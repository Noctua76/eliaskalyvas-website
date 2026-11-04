# NYRA — separate host lifetime and protected watcher sessions

For the next acceptance environment, **14 days is host existence, not 14 days of permission**. Preserve existing `createLiveWatcher`'s maximum 24-hour window and all independent GitHub/Owner/MFA/OIDC/registrar/DB TTLs.

The offline `proposeWatcherSession` function is intentionally not imported by the current production watcher. It accepts only an integrity-checked future-host proposal and a short session bounded by that host, plus a pinned source SHA. It rejects overlapping/malformed host ranges, more than 24h, nearly expired windows and an unpinned source. Its result explicitly states that separate new-host Administration evidence and Owner/MFA authorization are still required; it cannot dispatch or register anything.

**Historical PR #32 exception must not be cherry-picked:** it is pinned to destroyed Droplet `615221104`, and targets an expired Nov5 timeline. New runtime integration requires separate source/profile approval, a reviewed actual-host identity, persistent expiry service, safe dual-generation migration and verified retirement.

**Not yet implemented:** the installer, real host expiry enforcement, host attestation, rotation execution, live watcher registration, and provider readback. Tests here are only offline interface tests. No claim of complete pre-provision readiness.
