# NYRA 5C — actual temporary FRA1 host (non-secret record)

This is **not** a deployment, policy approval, real OIDC evidence, or an
instruction to provision GitHub credentials. Scope remains the existing Draft
PR #20 and separate owner authorization. The site, Pages and production Supabase
resources remain unchanged.

- Provider: DigitalOcean; single Ubuntu 24.04 Droplet `nyra-5c-acceptance`
- Region: FRA1; Basic Regular 4 vCPU, 8 GiB class, 160 GiB SSD
- Public IPv4: `201.79.94.104`
- Dedicated TLS origin: `https://nyra-5c.eliaskalyvas.gr`
- TLS certificate verified, baseline `GET /` responds `404`
- UFW default deny incoming with SSH/HTTP/HTTPS exceptions; Docker installed
- Detached code checkout: `/opt/nyra-5c/bootstrap`
- Private root directory: `/opt/nyra-5c/private` (0700)
- Separate non-login service identities: coordinator, registrar, broker, owner
- Disposable private PostgreSQL 17 is running: owner-verified real host output
  reports internalNetwork=true, publishedPorts=0, separateDbLogins=true.
- Two distinct local PostgreSQL logins have been provisioned; their credentials
  are local 0600 files, not shared in repo or chat.
- Current DB expiry timer was set to 2026-10-31T21:21:16.663Z (host UTC).
  This expires the isolated DB and its local credentials, **not the Droplet**.
- No live registrar/broker services, Github read identity, owner authorization,
  evidence signing key, real GitHub job or registration have been activated.

## Read-only prerequisite check on the selected host

After fetching the reviewed exact PR head (not main), run:

```sh
node ops/acceptance-bootstrap/host-preflight.mjs
```

This command was completed successfully **before** PostgreSQL provisioning.
It includes a requirement for no running containers, so it is an initial host
preflight and is NOT intended to be rerun unchanged after DB installation.
It checks concrete DNS/TLS, available CPU/RAM/disk, Caddy/Docker, UFW and
private Linux identity/directory permissions.
Its result is **never** a credential-issuance authorization or a PASS for Phase
5C. A local 404 and valid TLS are intentionally required before any listener.

## Mandatory gates still unfulfilled

- Independently review actual Github administrative/App evidence and owner
  residual write/merge/workflow authority; require fresh AAL2 risk receipt
- Approve and bound a <=24h window; install issuer-side revocation and a
  transient host cleanup timer **before** any credentials or GitHub invocation
- Implement actual private registrar/broker/coordinator network/SQL/IPC watcher,
  no builder egress, bounded host egress to exact approved GitHub/Auth origins
- Validate live role-isolated database clients, then connect actual role services
- Replace Caddy 404 only for exact approved fixed readiness and acceptance routes
  after binding is reviewed; do not expose private admin/owner/evidence or DB
- Compose actual independent evidence persistence and OIDC registration; fill
  reviewed public probe plan, pin eventual merged main SHA, run targeted tests,
  external review and separate merge/dispatch approvals

Do not interpret this host inventory as runnable real acceptance. Keep the old
runbook order and fail-closed requirements.
