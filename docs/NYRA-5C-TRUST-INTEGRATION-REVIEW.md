# NYRA Phase 5C — trust integration review

**Status:** INACTIVE BRANCH IMPLEMENTATION — NOT LIVE TRUST ACCEPTANCE.
Repository: Noctua76/eliaskalyvas-website; existing Draft PR #20.
No merge, production publication, protected dispatch, Caddy activation or acceptance claim.

## Actual DigitalOcean observations (operator-supplied terminal screenshots)
- FRA1 Ubuntu, DNS/HTTPS, firewall and host preflight: PASS.
- PostgreSQL 17 private Docker network, no published ports, distinct DB logins.
- Registrar/broker cross-credential substitution: DENIED.
- Real separate-role process and authenticated IPC identity-only proof: 17/17 PASS.
- No real jobs registered, owner authorization or protected acceptance.

## Branch-only integration changes
- Watcher now revokes scoped registrations on completed runs; rollback on partial failure;
  failed revocations stay in state for retry but readiness becomes false.
- Readiness requires exact original GitHub check-run URL, run attempt and SHA.
- Inactive private trust composition binds independent admin/Owner gates, pinned
  Ed25519 signed observation verification, exact run/check identity and receipt storage.
- Repeat, stale, unsigned, wrong-role, missing-owner and revoked-admin paths fail closed.
- No listener, dispatch, token source or role process is started by these imports.

## BLOCKED / NOT VERIFIED in the real host
1. Independent authenticated GitHub administration reader with Administration:read.
   The connected GitHub integration returned 403 for main branch protection.
2. Complete owner-authoritative GitHub App inventory and effective permissions.
3. Fresh existing Owner AAL2/MFA session, signed short-lived decision and risk acknowledgement.
4. Privately pinned evidence keys, durable store and role-specific broker acceptance operations.
5. Genuine registrar registration/revocation and broker OIDC verification across distinct
   isolated live processes — current real IPC probe tests identity only.
6. End-to-end host process binding, scoped egress, approved HTTPS ingress, issuer-side
   revocation, real protected GitHub OIDC runs and independently signed evidence.
7. Cleanup of temporary secrets, proxy/DNS rollback and DigitalOcean Droplet destruction.

## Expiry
Previously observed PG17 automatic expiry: 2026-10-31 21:21:16.663 UTC
(23:21 Europe/Athens). The timer removes temporary DB resources, NOT the Droplet.
If the DB expires, provision a new isolated window only after scoped cleanup.
Neither a dry run nor CI tests can substitute for actual owner-risk authorization.

## Decision
Remain Draft and fail closed. Do not enable public ingress, real GitHub dispatch or
production publication until all independently verified gates are accepted.

## FRA1 executable binding — current PR20 revision

This section supersedes the earlier implementation blockers 4/5 above **for source
implementation only**. None of the new commands has been executed on DigitalOcean.
The latest protection/Environment/default-token audit is owner-supplied external
acceptance evidence, not a new API read by this development Connector. Existing
PG17 and identity-only IPC acceptance is retained, not repeated on the host.

### Actual process and credential boundaries

`fra1-launch.mjs` is the explicitly enabled root lifecycle manager on
`nyra-5c-acceptance` (FRA1, `201.79.94.104`). It verifies the reviewed checkout,
private-network firewall restrictions, exact expiry timer, non-login users and
coordinator supplementary groups before spawning anything. It never dispatches.
Its authenticated private build port permits only a clean rebuild at the reviewed
SHA in a credential-free, network-disabled container. Full website dependencies
are confined to that builder checkout; the role runtime has its own locked
pg/AJV/parse5 dependencies and static source/schema closure.

Registrar and broker run as distinct non-root users/DB LOGINs in digest-pinned
Node containers, no capabilities, read-only root/mounts, internal DB network,
no published ports. Registrar owns registration/inventory writes; broker owns
OIDC verification, replay consumption, inventory consumption and evidence signing.
Each gets only its own role files. Neither gets the GitHub credential, owner
signing key, Docker socket or another role's DB password. Direction/role/sequence
MACs protect inherited pipes. The non-root coordinator alone performs allowlisted
read-only GitHub administration/run/job/check/JWKS reads. Reverse IPC never exposes
credentials or permits arbitrary root operations. Every privilege revalidates
approved policy; independent post-build broker revalidation gates inventory writes.

Private signed observation, provenance and retirement envelopes are stored with
exclusive-create, mode0600 and fsync. Cleanup retires **all three policy hashes**,
including a registration whose acknowledgement was lost; signed broker read-back
must show zero unrevoked registrations. Failure remains incomplete cleanup, never
PASS. The root guardian, absolute timer and label-scoped emergency cleanup stop
only the three named temporary live containers. Issuer revocation, owner-source
shutdown/key retirement, DB expiry and Droplet removal remain explicit verified
operator steps; a container stop is not evidence of credential revocation.

### Independent application audit — remaining real source dependency

`application-inventory.mjs` verifies a fresh Ed25519-signed
`nyra.authenticated.integration-audit.v1` envelope from a **separately approved,
owner-authenticated capture source outside the acceptance host**. Its public-key
JWK hash and key ID are pinned out of band. This PR implements the verifier and
private report, **not a complete GitHub account capture service**. A PAT cannot
read/prove every OAuth grant or account-wide authorization. Screenshots, unsigned
JSON, copied identifiers and a signature from an unapproved signer are insufficient.
Do not create an inventory signer on FRA1 and call its own declaration independent.

The approved capture must cover installed Apps, authorized Apps, authorized OAuth
Apps, personal access tokens and other repository integrations, with authenticated
owner ID, exact GitHub settings source URL, capture digest, complete pagination,
zero unresolved integrations and an observation less than five minutes old. Each
entity records effective read/write/none permissions, actual scopes, active state,
all/selected/none/public-read-only repository access, immutable identifiers and
capture provenance. The verifier does not infer a reduced OAuth permission from
an exclusion screenshot. `repo`/`public_repo` write and `workflow` scopes cannot be
under-reported. Repository-scoped Apps require actual App/installation IDs.

Codex, VS Code and Git Credential Manager residual write/merge/workflow capabilities
are retained as risk evidence. Excluded installations remain in the signed digest.
**Owner-exclusive technical GitHub control remains NOT PROVEN.** The complete
normalized audit is bound into `acceptedApplicationsSHA256`, which must be accepted
by the real owner/MFA decision. A broad scope is potential authority, not proof of
an actual bypass or a harmless grant. No App is silently treated as a reviewer.
Renew the authenticated signed observation within five minutes throughout the
window; any permission change changes the digest and requires a new owner decision.

### Private configuration and operator sequence (not authorization to execute)

1. External review this exact PR and obtain separate inactive merge approval.
   Pin the eventual reviewed main merge SHA as `callerSHA`; do not dispatch this
   branch or guess a merge SHA. Keep reusable probe pin
   `cefd1a402dcffd0b00f05f7d7539ba381120641e`. Verify job names against its reviewed
   GitHub jobs. Preserve Pages and the three existing Environments.
2. Obtain one owner approval for the temporary source update/staging, limited
   OS groups, bridge-specific firewall controls, deadline units, private keys,
   credentials, capture authority and receipt-only source socket. No such host
   changes were performed by this PR. Verify the actual DB expiry first; the old
   timestamp above is historical. Do not extend/recreate it without approval.
3. Approved operator updates `/opt/nyra-5c/bootstrap` to that exact clean SHA,
   installs the locked runtime dependencies with `npm ci --ignore-scripts
   --prefix ops/acceptance-bootstrap/runtime`, then stages outside the checkout:
   `node ops/acceptance-bootstrap/stage-live-runtime.mjs --stage
   /opt/nyra-5c/bootstrap /opt/nyra-5c/live-runtime` (one shell line).
   Destination must not already exist. Review staged manifest against source.
   Root/system Node must support the reviewed Node APIs; CI also imports the same
   minimal graph under the digest-pinned Node container.
4. Use only narrow groups: `nyra-5c-ingress` for coordinator plus Caddy, and
   `nyra-5c-receipts` for owner plus coordinator. Coordinator must have only its
   primary and these two supplementary groups, never Docker/sudo/Caddy TLS groups.
   Receipt parent directory is owner-owned, receipts-group, mode0750; approval
   directory remains owner-only0700. `/run/nyra-5c` follows the existing ingress
   directory checks. Bridge-only existing rules must satisfy `iptables -C INPUT
   -i BRIDGE -m conntrack --ctstate NEW -j DROP` and `iptables -C DOCKER-USER -i
   BRIDGE ! -o BRIDGE -j DROP`; BRIDGE is derived from the actual internal network
   ID. The launcher checks these rules; it does not install them or alter SSH.
5. Provision only approved short-lived repository-scoped read credentials into
   coordinator-owned0600 files, never workflows/environment secrets. Reuse the
   existing owner Auth/status integration with the real pinned Auth user UUID,
   publishable key and fresh owner AAL2 session. No service-role key. Run owner
   source as `nyra-owner` with its original private approval socket and optional
   receipt-only socket (`receiptSocket`, `receiptGroupId`). This second socket
   accepts only challenge/decision-ID receipt requests, never approve/retire/token.
   Independently pin separate audit, owner and broker evidence public keys outside
   the host; broker label must be `nyra-5c-fra1-evidence-v1`. Keys remain private.
6. Prepare coordinator `live.json` owned by `nyra-coordinator`, mode0600:
   `mode`, `callerSHA`, `origin=https://nyra-5c.eliaskalyvas.gr`, `windowStartsAt`,
   `windowEndsAt`, `ingressGroupId`, `policies` (build/inspection/publication),
   `auditKeyFile/auditKeyId/auditPublicKeySHA256`, corresponding owner/evidence key
   fields, `applicationAuditFile`, `githubReadCredential`, `ownerReceiptSocket`,
   `ownerDecisionId`, `acceptedApplicationsSHA256`, `evidenceDirectory` (0700).
   Each public-key file contains `{keyId,publicKey}` and is own-user0600.
   Run `node ops/acceptance-bootstrap/inventory-report.mjs PRIVATE_CONFIG` as
   coordinator to verify the independent audit and derive the exact accepted digest;
   stdout is private metadata and must not enter public artifacts. Have the owner
   authorize that digest, exact repository/owner IDs, SINGLE_OWNER policy version
   and explicit residual merge/write/workflow risk through the existing MFA source.
7. Root `live-launch.json` (0600, `/opt/nyra-5c/private/`) binds the same policies,
   SHA/window/mode/evidence key ID plus evidence public JWK, both narrow group IDs,
   `policyStates` keyed by role (active state, exact policy hash, governance mode,
   version and ownerAuthorizationSHA), and allowlisted public build environment.
   Role DB LOGINs already reside in their own0600 `pg.json` files (host `db`,5432,
   database `postgres`); broker evidence key in its own0600 `evidence-key.json`.
   No shared DB credential. Install the **exact** `cleanupUnits(windowEndsAt)`
   returned service/timer content at `/etc/systemd/system/nyra-5c-live-expiry.*`,
   activate the timer after owner approval. Window cannot outlive PG expiry or12h.
8. Discovery policies use purpose `identity-observation-only`, reserved subject
   `urn:nyra:unapproved-subject-discovery`, exact `codeSHA=callerSHA`, repository
   IDs1389733212/217035723, actual Environment IDs25832629700/25833532642/25833663698,
   exact workflow refs, role audiences `urn:nyra:acceptance:ROLE` and manual event.
   Policy files require the reviewed governance contract; no caller-supplied mode.
   Launch only with separately approved host operations:
   `NYRA_5C_FRA1_LAUNCH=1 node /opt/nyra-5c/live-runtime/ops/acceptance-bootstrap/fra1-launch.mjs --run`.
   The process arms the watcher; it does not dispatch. Only after owner approval
   activate the reviewed Caddy readiness/acceptance proxy to the Unix ingress.
   No approval endpoint is routed. Existing active404 config remains untouched now.
9. **First explicit dispatch authorization:** fresh manual main invocation for
   subject discovery only. Independently inspect private signed sanitized
   observations/JWKS identity, actual run/job/check/attempt and protection evidence.
   Retire the discovery registrations and stop processes. No inventory authority
   or publication results from discovery. Independently review exact observed
   subjects and sign-off before the second invocation.
10. Create a new approved provenance policy version with exact subjects and purpose
    `registered-provenance-acceptance`; retire old policy/decisions, refresh the
    signed audit and owner/MFA authorization. Coordinator additionally pins
    `reviewedDiscoveryPolicies` (original discovery policies, not the new version),
    `reviewedDiscoveryReceipts` and `reviewedDiscoveryDigests` for all three roles.
    Historical discovery signatures/pins are checked at their signed observation
    time and subjects must equal the newly approved exact policies. No wildcard,
    automatic subject promotion or ordinary Pages job substitution. Re-arm under
    a new approved window and exact timer after removing only reviewed stale files.
11. **Second separate explicit dispatch authorization:** fresh main invocation.
    Require genuine registered OIDC, isolated clean byte inventory, post-build
    broker/policy revalidation, immutable inventory registration and publication-only
    controlled inventory consumption. The publication role consumes evidence only;
    it never publishes an article or Pages deployment. Require signed observation,
    inventory/provenance and zero-active-registration retirement evidence. Failed,
    interrupted, expired or replayed runs remain failures, not partial acceptance.
12. Disable the reviewed acceptance proxy, terminate owner source (memory session
    destroyed), retire/revoke decisions/policies, revoke temporary GitHub identity
    at issuer, remove private temporary key material after private evidence export,
    verify fixed-label container and DB expiry cleanup, remove scoped socket files
    only after process termination, and remove temporary Droplet/DNS when separately
    authorized. Verify all revocations independently. No real Phase5C PASS until
    the two genuine runs and resource retirement are evidenced.

### External blockers / acceptance labels

Implemented and tested source does not establish live acceptance. The authenticated
account-wide capture source and its signing authority still require explicit owner
selection/approval; absent that source the verifier **fails closed**. Fresh real
MFA decision, key pins, private credentials, host wiring approval/execution, controlled
Caddy activation and the two individually authorized dispatches remain external.
The public plan contains routing identity only; `approved:true` is compatibility
with the existing workflow's plan format, not owner authorization or trust evidence.
Unit fixtures are UNIT ONLY and never live signed acceptance records.
