# NYRA continuation — actual systemd readback gate

The offline renderer only produces **proposals**; this second-level, strictly read-only assessor validates externally gathered **fresh actual-host observations**. No installation, systemd execution, DNS, Docker mutation, GitHub credential issue or provider creation happens from this module.

It requires an authenticated provider identity (not destroyed DigitalOcean Droplet ID 615221104), matching host machine identity digest, clean SHA-pinned source, root-controlled verified cleanup/manifest and SHA-matched systemd service/timer bytes, enabled+active+persistent timer, exact expected expiry command and next-trigger deadline, and reviewed private-artifacts inventory.

The observation must be acquired independently, not filled from expected fixture data. *This verifier does not perform those reads*; fixture PASS proves only predicate behavior. `HOST_EXPIRY_READBACK_VERIFIED` is not owner/MFA authorization or proof of completed private retirement, protected OIDC, provider destroy or full install.

**Remaining blockers:** actual provisioning installer, 14-day integration with existing 24-hour bootstrap plan/replacement-target (while retaining short-lived watcher), verified 7-day migration, DB role/private key scope, new-host GitHub App key renewal, independent CI/review, exact provider/account cost approval. This is branch-only and not READY TO CREATE.
