> **Replacement preparation:** see [the target-configurable offline package](REPLACEMENT.md). Historical host commands below are not the current execution path. No resource is created by preparing the replacement.

# NYRA 5C — HISTORICAL FRA1 PILOT — RETIRED

**Recorded 2026-10-31 from the owner's operator observations.** No independent
signed Live Trust Acceptance evidence was produced. This file is an archival
record, not a current host inventory or executable deployment instruction.

| Historical resource | Final operator-observed state |
| --- | --- |
| DigitalOcean FRA1 Droplet `nyra-5c-acceptance` | Destroyed |
| PostgreSQL17 cleanup service | `Result=success`, `ExecMainStatus=0` |
| Container `nyra-5c-pg17` | Removed |
| Private Docker network | Removed |
| Docker mounts | None reported |
| DNS `nyra-5c.eliaskalyvas.gr` | Removed |
| Billing observation | USD0.91 usage, covered by signup credit; estimated payable USD0.00 at observation time |

Historical IPv4 `201.79.94.104`, old TLS origin, local paths/users, credential
files and PostgreSQL deadline are **not available resources**. No request, SSH,
DNS recreation, credential reuse or new billing operation is authorized by this
record. Billing is a point-in-time operator observation, not a final invoice or
independently checked provider balance.

The pilot previously exercised private PG17 role isolation and identity-only
process/IPC checks. These observations establish neither genuine protected OIDC
nor owner/MFA authorization, registered provenance or full live acceptance.
Droplet destruction does not prove issuer-side credential revocation; any issued
identity must have separate issuer-side revocation evidence, or an authenticated
record that no such identity was provisioned. No credential is assumed reusable.

`host-target.json`, `Caddyfile.review-only`, host-specific scripts and the detailed
FRA1 binding notes preserve the old reviewed template. They are **not a selected
future destination**. The public probe plan is disabled (`approved:false`) and
rejects before DNS/HTTP/token acquisition. Do not run old provisioning commands.

For independent review and a separately approved future environment, read
[NYRA-PR20-INDEPENDENT-REVIEW.md](../../docs/NYRA-PR20-INDEPENDENT-REVIEW.md).
