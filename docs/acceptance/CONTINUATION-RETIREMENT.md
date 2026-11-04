# NYRA — new-host scoped retirement executor (Draft / not installed)

`retirement-v1.mjs` is a fixed-path, root-only executable for exact-plan labelled Docker containers, networks and volumes, with preflight inspection and post-removal verification. It takes no arguments and reads `/etc/nyra-continuation/retirement.json` and `/etc/machine-id`. Exact manifest keys bind future hostname, hashed machine ID, new provider ID, 14-day UTC start/end and 64-byte plan digest. Invoking it before the deadline fails closed.

This is an **actual cleanup implementation**, but it has NOT been installed, connected to a live systemd unit or independently verified on a host. A matching writable manifest does not by itself constitute signed owner authorization: a separate approved, SHA-pinned installer with owner evidence and root-only parent paths is mandatory. Complete retirement also requires private-artifact / database-role retirement, issuer credential revocation, DNS review, and DigitalOcean Droplet destruction (the last step is separate from local Docker cleanup and billing).

The executor produces `retirementComplete:false` and `providerDestroyed:false` even after a complete local Docker cleanup. It cannot erase unrelated Docker resources. Errors lead to STOP and independently approved recovery, never automatic retry. Do not reuse the retired host / PR #32 exact-host extension.

Still required before any live GO: reconcile new 14-day replacement target with 24h `bootstrapPlan` session; source/config/units SHA-256 capsule; tested extension migration; private-secret cleanup; independent machine/provider/firewall readback; CI and owner authorization. PR #33 remains Draft and unmerged.
