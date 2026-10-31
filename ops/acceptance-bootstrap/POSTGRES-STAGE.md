# NYRA 5C — isolated temporary PostgreSQL stage

This is **not** production or real Live Trust Acceptance. The script provisions
only an isolated PostgreSQL 17 test database using the existing approved
digest-pinned image at ops/native-acceptance/images.lock.json.

Run on the approved temporary DigitalOcean Droplet ONLY from the reviewed,
exact Draft PR #20 head:

    cd /opt/nyra-5c/bootstrap
    node ops/acceptance-bootstrap/db-stage.mjs --dry-run
    node ops/acceptance-bootstrap/db-stage.mjs --apply

The host-specific preflight is required before provisioning. Before generating
any secrets, --apply installs a 12-hour persistent systemd cleanup timer. Docker
uses a dedicated --internal network with **no host-published ports**. Schema
comes from ops/protected-delivery/schema.sql. Random passwords for distinct
registrar and broker SQL LOGIN roles remain only in local 0600 files under
their separate /var/lib/nyra-5c directories, not in GitHub/CI/log output.

Read-only check:

    node ops/acceptance-bootstrap/db-stage.mjs --verify

Early cleanup:

    node ops/acceptance-bootstrap/db-stage.mjs --cleanup

Removal is limited to the exact named+labelled DB container and network, and
local DB secret files. The timer does **not** destroy the DigitalOcean Droplet;
billing continues until the operator destroys the Droplet in DigitalOcean.

Even after this stage is passing, REAL registrar/broker services and private
IPC, the GitHub administrative/App inventory source, the actual signed
Owner/AAL2 decision, bounded egress, the evidence collector, workflow/job
wiring, and live protected OIDC evidence remain unimplemented or unaccepted.
The live Caddy listener remains the safe 404; do not enable public routes.
