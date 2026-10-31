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
- No credentials, database, trust processes, evidence key, real GitHub job or
  registration have been provisioned.

## Read-only prerequisite check on the selected host

After fetching the reviewed exact PR head (not main), run:

```sh
node ops/acceptance-bootstrap/host-preflight.mjs
```

The command checks concrete DNS/TLS, available CPU/RAM/disk, Caddy/Docker,
UFW, no running containers and private Linux identity/directory permissions.
Its result is **never** a credential-issuance authorization or a PASS for Phase
5C. A local 404 and valid TLS are intentionally required before any listener.

## Mandatory gates still unfulfilled

- Independently review actual Github administrative/App evidence and owner
  residual write/merge/workflow authority; require fresh AAL2 risk receipt
- Approve and bound a <=24h window; install issuer-side revocation and a
  transient host cleanup timer **before** any credentials or GitHub invocation
- Implement actual private registrar/broker/coordinator network/SQL/IPC watcher,
  no builder egress, bounded host egress to exact approved GitHub/Auth origins
- Install disposable isolated PostgreSQL 17, separate scoped LOGINs and keys
- Replace Caddy 404 only for exact approved fixed readiness and acceptance routes
  after binding is reviewed; do not expose private admin/owner/evidence or DB
- Compose actual independent evidence persistence and OIDC registration; fill
  reviewed public probe plan, pin eventual merged main SHA, run targeted tests,
  external review and separate merge/dispatch approvals

Do not interpret this host inventory as runnable real acceptance. Keep the old
runbook order and fail-closed requirements.
