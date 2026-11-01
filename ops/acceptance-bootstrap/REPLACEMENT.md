# Replacement acceptance bootstrap — offline package, not live authorization

Requested by PR26 owner comment `6564206677`. Reviewed starting head:
`1dbeb46c4ad7ac39dfc313bf47361bf2868e50ee`. Subsequent bootstrap changes require
independent review. Historical `HOST-FRA1.md`, `host-target.json`, `fra1-launch`
and `fra1-runtime` remain reference-only; do not execute their historical CLIs.
No previous IP, DNS record, password, credential, key or deadline is reusable.

## Stop before spending: protected-main boundary

Main was independently read as `dea8c5ede7df2d11a2de856d966046ca341f1ed6`;
PR26 was Draft/unmerged at the reviewed starting head. The real caller is
`.github/workflows/nyra-live-trust-acceptance.yml`, manual dispatch only, exact
`refs/heads/main`, actor `217035723`, protected ref; reusable probe pin remains
`cefd1a402dcffd0b00f05f7d7539ba381120641e`. The probe checks out **main**, and
reads `ops/protected-delivery/live-acceptance-plan.json` from that checkout.
That file remains `approved:false` and references the retired origin.

Consequently, **a protected run now cannot accept the new PR26 bootstrap/policy**.
Old-main subject observation is not PR26 acceptance. Neither main nor that public
plan is changed by this package. STOP before Droplet creation: independently
review the new exact branch head, obtain explicit exact-head merge authorization,
then authorize a reviewed non-secret public-plan update for the real collector
origin/evidence-key identity. The source/main merge SHA, its reviewed tree and
successful required checks must be pinned after merge. Do not guess the merge SHA,
change the reusable pin, set a fake genuine-OIDC flag or run acceptance on a branch.
A future plan change advances main and requires corresponding policy rollover.

## What was actually checked offline

`node --test test/replacement-bootstrap.test.mjs` checks fresh target rejection,
both firewall scopes, secret-file rejection, exact ingress, role mounts, retirement
absence checks and non-authorizing discovery/operational-policy separation.
`verify-offline.mjs` checks downloaded **public** binary/package SHA256s, actual
Docker `--version`, actual Caddy `adapt` of both configs, shell/Python syntax and
imports of the standalone private graph. It never installs a package or starts a
listener/container/daemon. CI repeats it on Ubuntu 24.04 and imports the new graph
under the already pinned Node container with network disabled.

Pinned prerequisites are in `prerequisites.lock.json`: Docker 29.9.2 static archive,
Caddy 2.11.7 static archive, Ubuntu noble iptables 1.8.10-3ubuntu2 and ufw 0.36.2-6.
Docker SHA256 was computed over the official TLS download; it is **not** claimed
publisher-signed. Caddy bytes additionally matched the publisher SHA512 checksum;
Ubuntu deb hashes matched the official Packages metadata. Node and PostgreSQL are
pinned to the previously accepted image digests in `offline-bootstrap.mjs`.
The bundle also contains `proposed-main-public-plan.json`, a routing-only proposal
(origin and planned evidence key ID, no key/subject/credential). It is never copied
to the checkout or imported. Its `approved:true` is only proposed file content,
not authorization; installation still needs the separate exact-main review above.
No `curl | sh`, latest-image tag or unpinned dependency fallback exists.
`apt-get --no-download` refuses an incompatible/missing Ubuntu base dependency;
that condition must be resolved with a separately reviewed pinned package, not
with a broad unpinned install. Actual fresh-host installation is NOT VERIFIED.

To validate without a host (public downloads only):

```sh
npm ci
npm ci --ignore-scripts --prefix ops/acceptance-bootstrap/runtime
node ops/acceptance-bootstrap/verify-offline.mjs --verify /tmp/nyra-public-prerequisites --fetch-public-pins
```

To render the actual operator package, fill the example's **real operator IPv4/32**
and unique bootstrap/hostname in a public local target JSON. Resource ID, public
IP and times must remain null. Example intentionally has no usable SSH allowlist.

```sh
node ops/acceptance-bootstrap/offline-bootstrap.mjs --prepare /private-local/target.planned.json /private-local/vendor /private-local/offline-bundle
sha256sum /private-local/offline-bundle/manifest.json
```

This command only writes files. The manifest seals all runtime/dependency bytes,
scripts and prerequisite archives. Pin its SHA256 through the independently
reviewed owner channel, outside the bundle. Re-rendering changes that identity.
No PAT/session/key or operator-secret file belongs in the bundle or repository.

## Once separately approved, attended host setup

1. Owner is present. DigitalOcean: Create Droplet → FRA1 → Ubuntu 24.04 x64 →
   Basic Regular 4 vCPU/8 GiB, no backups/extra volumes/reserved IP. Use a NEW
   hostname such as `nyra-repository-acceptance`. Capture the actual resource ID,
   public IPv4 and provider creation time only after creation. Set a hard expiry
   no later than 24 hours after that time. Reject old hostname/IP/origin explicitly.
2. In DigitalOcean Networking → Firewalls, select this exact new resource ID:
   inbound TCP22 only from the actual operator /32; TCP80/443 public for ACME/HTTPS;
   no other inbound or UDP rules. Local UFW independently applies the same policy.
   Check provider attachment/rules through authenticated owner access; UFW output
   alone is not provider-firewall evidence. No DB port is published by Docker.
3. Securely transfer the manifest-pinned bundle. As root, create
   `target.created.json` mode0600 in the bundle, changing **only** resourceId, ipv4,
   createdAt and expiresAt from the planned target. No credential is created yet.
   Run `bash setup.sh --install-host REVIEWED_MANIFEST_SHA256`. The script rejects
   an existing private NYRA installation, an old resource, a changed manifest,
   a wrong OS/hostname/deadline or changed prerequisite bytes. It installs only
   the host base, private users/directories, disabled proxy config and expiry timer;
   it does not start the owner source, DB, coordinator or protected jobs.
4. Only with explicit DNS approval, create the new direct A record
   `nyra-acceptance.eliaskalyvas.gr` for the actual new IPv4; remove stale AAAA/proxy
   routing. Start only `nyra-caddy.service`, initially serving 404. Verify DNS,
   TLS certificate and HTTPS 404 from outside the host. Read-only
   `assessReplacementHost` requires OS/capacity, fresh private files, matching
   prerequisite hashes, both firewall scopes and the exact enabled deadline.
   It is diagnostic and **never** declares credentials/administration accepted.
   Caddy is non-root and can reach only the public-ingress Unix socket; owner,
   database and administration routes never appear in either Caddy configuration.

## Private trust installation, only after real host readiness

Create the one-day, repository-only fine-grained GitHub read identity **now**, not
before the host is ready: Settings → Developer settings → Personal access tokens
→ Fine-grained tokens → Generate; resource owner Noctua76; Only select repositories
→ eliaskalyvas-website; expiry one day; Administration, Actions, Checks, Contents,
Pull requests, Environments all **read**; Metadata automatic. No Workflows/write
permission, no Connector expansion. Inject only into the coordinator's private
mode0600 file via the approved secret channel; no value in argv/environment/chat,
Actions, browser bundle or logs. Issuer-side creation/expiry/revocation must be
verified by the owner: a JSON `issuedAt` field is not proof of fresh token issuance.

Use `administrationReader`/`readRepositoryAdministration` with this actual identity.
Reject any unavailable/incomplete response. Record/pin the real administration
fingerprint, exact main and three Environment IDs. Unknown external Apps/OAuth/PAT
rights remain UNKNOWN and explicitly acknowledged; there is no full-account audit.

As separate non-root owner and broker identities, generate NEW Ed25519 keys only
under separately approved private setup; verify public fingerprints through the
owner's authenticated independent channel. Owner secret exists only in the owner
process; retirement/evidence secret only in the broker. Distinct key IDs are not
enough: the approved context pins distinct actual public key SHA256s. Sharing a
VM retains a host-root compromise risk; signatures do not prove hardware/host
independence. No key is generated by the offline command.

Install owner-source configuration using the real Supabase project URL, existing
nyra-api/status contract, actual owner Auth UUID and public API key. No Supabase
service-role credential is needed by this source. Its own private socket and
receipt-only shared socket remain separate. Start `nyra-owner-source.service`
only after owner approval. Authorize using a new actual owner AAL2 session over
`owner-request.mjs` private stdin/SSH transport, Authorization header only; never
paste the session into a command, chat, token file, log or public endpoint.
The signed journal/decision binds the exact repository-trust context and all
unknown-write/admin-mutation acknowledgments. This is not editorial publication.
The decision lasts at most **15 minutes**, receipts at most **45 seconds**; revoked
sessions, process restart and expiry require fresh explicit owner authorization.
No automatic renewal or continuous 24h consent is inferred.

Use `NYRA_REPOSITORY_DB=1 node .../repository-db.mjs --apply /etc/nyra-acceptance/target.json`
only after the timer is live. It creates the private disposable DB/network and
separate expiring LOGINs using the existing trust schema/roles. Secrets are
randomized privately, never command arguments. Verify actual identity/ACLs with
the existing role proof. Production Supabase migrations remain untouched.

Root-only `/opt/nyra-5c/private/launch.json` supplies target, reviewed acceptance
configuration, exact role policy states, owner decision ID, owner/evidence public
key files, receipt socket, private credential path `/var/lib/nyra-5c/coordinator/admin-read.json`, evidence directory, ingress
GID and public clean-build configuration. Only the new `repository-launch.mjs`
starts this composition. It checks actual source/stage bytes, deadline, network
and policy digests, creates fresh sequence-bound IPC and mounts one coordinator-
owned policy directory read-only into both workers. Every guard rereads state.
`repository-runtime.mjs` calls **bindRepositoryControlPlane** with the actual
independent read identity and owner source; it cannot grant editorial authorization.

## Two invocations — each needs explicit owner approval

1. Discovery: same manual caller/ref/owner/reusable pins above, only contents:read
   and id-token:write in probe jobs, exact nyra-build/inspection/publication
   Environments. No Pages, content, dispatch, production or private article power.
   Use discovery-only trusted configuration with the reserved non-authorizing
   subject. After genuine owner receipt and watcher readiness, explicitly authorize
   the exact run. The pinned probe performs its HTTPS readiness GET **from the
   actual GitHub-hosted runner before requesting a JWT**. Therefore real runner
   reachability remains NOT VERIFIED until this future run, not an offline claim.
2. Independently verify the signed sanitized observations, complete immutable
   subjects, GitHub issuer/JWKS, exact actual run/attempt/job/check/reusable facts,
   and owner-reviewed envelope digests. Do not edit a subject based on JWT decoding
   alone. Retire discovery registrations and verify the fresh broker-signed proof;
   prepare a new context/state/owner decision for the provenance phase. Remove a
   retired state file only after retirement verification; launch never overwrites it.
3. Fresh provenance invocation: explicit owner approval again; exact observed
   subjects and independently pinned discovery artifacts. Validate registered jobs,
   credential-free offline rebuild, byte inventory, immutable registration and
   publication-only **non-publishing** consumption. No public content or witness.
   Lost response, stale policy, owner expiry or interrupted run closes authority;
   do not retry an uncertain operation or relabel it PASS. Owner/session renewal
   plus a new separately approved run is required if the 15-minute window is missed.
4. Actual retirement: synchronous shared-state invalidation → exact SQL revocation
   → fresh nonce-bound broker-signed zero-active-registration proof. Failure stays
   closed/unconfirmed. Preserve private signed receipts and their transfer manifest;
   no raw JWT, request Authorization or private key is persisted as evidence.

## Teardown — provider destruction is mandatory

The root-owned persistent timer stops local processes and removes only Docker
resources with the exact target digest label, then independently checks absence.
Its errors propagate. It does **not** destroy the Droplet or stop provider billing.
An interrupted or unconfirmed retirement is NOT VERIFIED even if the DB is removed.

While the owner is present: retire owner decision/revoke the dedicated owner session;
export only sanitized signed evidence and verify destination hashes/signatures;
revoke the PAT **at GitHub's issuer** and verify denial; remove signing/IPC/login/
journal files after transfer; remove only the approved DNS record; DigitalOcean →
exact Droplet ID → Destroy (and associated billable resources only if explicitly
identified/approved). Verify provider absence, zero unexpected attached resources,
DNS absence and final account usage/billing. Retain redacted operator observations
separately from independently signed trust evidence. No unattended provisioning or
promise that a local timer performs provider cleanup.

## After 24h: production still requires a durable private execution home

GitHub Actions stays the build/Sharp/OIDC worker; Supabase retains existing owner
Auth/editorial/storage duties. The current Unix IPC/synchronous policy-file and
independent credential custody require the actual private control plane to remain
available for operational authorizations, outbox/reconciliation and retirement.
The accepted conservative host profile (4 vCPU/8 GiB) costs about **$48/month**,
or $0.07143/hour, before tax, at the observed DigitalOcean Basic Regular price.
Smaller continuous-worker sizing is not verified; do not quote a smaller instance
as accepted or provision one silently. A separately approved durable host,
credential rotation/backups/monitoring and operational owner-window acceptance are
required before production activation. The temporary host is destroyed after its
run; it is not silently converted to a permanent service. Without that independent
owner approval, production remains OFF even if temporary live acceptance passes.
