# NYRA — future-host expiry unit contract (not installed)

This follow-up to Draft PR #33 produces reproducible **systemd service/timer text** for a future, 14-day, exact UTC host retirement deadline.

- Runtime expiry service is deliberately **not installed**, enabled or executed by this PR.
- Its ExecStart points to a **future independently reviewed and content-hashed retirement executable** at a root-controlled fixed path. That executable must actually be supplied, verified against the approved SHA-256 and tested separately. A generated timer without that executable is **not protective enforcement**.
- A future installer must verify the exact host identity SHA, completed host/source/config pins, complete cleanup scope and private artifact retirement, root ownership, unit file hashes, effective systemd unit state, persistent timer and actual next trigger. Fail closed on mismatch or absent executable.
- Timer uses a fixed UTC calendar time and Persistent=true, *not* `OnBootSec` or an unbounded recurring scheduler. A reboot after the deadline must not grant a new acceptance window.
- The app must independently stop accepting sessions, registrations, owner decisions, GitHub tokens and OIDC evidence at their own shorter TTLs. Host lifetime is not authorization, key rotation, or a DigitalOcean provider destroy automation.
- The old host's source, resource ID, keys, and extended PR32 timer must not be migrated.
- The `ConditionPathExists` is an additional guard but does **not** replace installer/health/readback verification. It may cause the service to skip if dependency is missing: readiness must treat this as NO-GO, not as completed retirement.
- All generated unit texts and SHA values are proposals for independent review; require signed authorization before any new host deployment.

Next deliverable must be the actual pinned retirement executable with safe private-artifact inventory and separate provider resource destruction check. Do not claim the new 14-day timer is running until live readback proves it.
