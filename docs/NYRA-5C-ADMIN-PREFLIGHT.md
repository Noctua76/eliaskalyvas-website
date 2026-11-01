# NYRA 5C — private read-only administrative preflight

**Status: diagnostic implementation only — not authenticated account-wide inventory, Live Trust Acceptance, signing, owner risk approval or permission to publish.**

Current integration baseline: main `3145055d907b2464b5a28325d6c817704fe84578`. No deployment or Supabase change is needed to install this diagnostic. It is not invoked by GitHub Actions, Pages, any worker or an imported module.

## Why this is needed

The connected developer GitHub App can inspect ordinary builds and a protection summary, but its administrative branch-protection read returned HTTP 403; environment, collaborator, deploy-key and Actions-permissions REST routes are not exposed by this connector. A developer App `list_installations` response is not a complete personal-account integration inventory.

The owner has a separately scoped `NYRA-5C-READ-ONLY` fine-grained PAT for `Noctua76/eliaskalyvas-website`: Administration/Actions/Contents/Environments/Pull requests/Metadata Read, no User permissions, expires **2026-11-07**. The owner's token-setting UI did not offer a separate Checks permission. **Do not create or broaden a PAT to work around this UI limitation.** The check-run data require a separately authorized and authenticated GitHub App source; the existing admin/Checks evidence requirements stay unchanged.

## Operator-only invocation, in an owner-approved private local shell

`ops/acceptance-bootstrap/admin-preflight.mjs` uses the existing audited `administrationReader` URL allowlist and reads **only**:
- repository ID, main branch-protection details, all collaborators and deploy keys;
- default Actions workflow token/PR-review settings;
- `nyra-build`, `nyra-inspection`, `nyra-publication` Environment IDs and policy/secret metadata (secret **counts only**, never secret values or names).

The private token must be supplied under the process environment variable `NYRA_ADMIN_READ_TOKEN` by the owner's own secret/credential mechanism. **Never paste tokens into ChatGPT, tickets, commands copied into shared logs, GitHub workflows, repo files, Actions variables, or files/artifacts.** Do not pass a token as a CLI argument.

After private token injection, run:

```sh
node ops/acceptance-bootstrap/admin-preflight.mjs
```

Output is printed only to the operator's local stdout; the script does **not** save, sign, upload, dispatch or mutate anything. Remove the temporary environment variable after the run. A nonzero exit code indicates one or more missing, denied, paginated or inconsistent reads. Output includes metadata such as permission state and counts; keep it private until independently reviewed.

This intentionally **does not** read Settings/Applications, user-level OAuth/PAT inventory or App installation permission details and **cannot** meet the five-minute signed inventory gate. It only separates missing administration access from the harder account-wide audit blocker.

## Acceptance boundaries — unchanged

1. Independently authenticated owner Settings capture (all five family types and every relevant detail page), effective repository rights and a separately controlled Ed25519 signing identity are **NOT VERIFIED**.
2. The existing `normalizeIntegrationAudit` five-minute completeness/freshness rule is **UNCHANGED**. The 15-minute supervised-window alternative is a proposal requiring separate owner and independent reviewer approval, limited to non-publishing acceptance.
3. The `administrationGate`, exact owner AAL2 decision, live OIDC/provenance, production migrations, Edge mounting, protected workflow replacements and owner-authorized publication remain **NOT APPROVED / NOT ACTIVATED**.
4. No retired FRA1 host, DNS, IP or acceptance key may be reused.

Any result from this preflight is informational. It may be used to prepare the next independently reviewed acceptance decision, **not** as a bypass or fabricated positive trust witness.
