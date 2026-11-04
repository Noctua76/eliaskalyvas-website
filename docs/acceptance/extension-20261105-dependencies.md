# Deadline dependency inventory — completed before implementation edits

Approved source: `29a73458d4cd941e5ed514db56dc2c553d041bda`.
Pending Stage 3F: PR #31 head `69f4dcf7870592296dee0e4e1aaf8771f5e4340b`.
This inventory is source/installed-contract analysis, NOT a live host attestation.
The current Library versions of the Stage 3B rollover and provisioning packages
were inspected. No private host, provider account or timer was accessed.

| Area / files or deployed object | Binding / rule | Treatment |
| --- | --- | --- |
| `ops/acceptance-bootstrap/replacement-target.mjs`, `/etc/nyra-acceptance/target.json` | Original creation Nov 2 21:06:46Z; old end Nov 4 21:05Z; exact resource 615221104, bootstrap/hostname nyra-acceptance-20261102-01, IPv4 139.59.136.219, acceptance origin. Default 24h; previous exact-host 48h exception. Target canonical digest includes expiry. | Add only Nov 5 21:05Z exact-host exception; no timestamp reset or general 72h policy. New target digest; preserve old bytes/history. |
| `offline-bootstrap.mjs`, `verify-offline.mjs`, original bundle `target.created.json`, `manifest.json`, `prerequisites.lock.json`, `setup.sh`, `expire.sh` | Bundle hashes, targetSHA256, exact approved source/dependency/image pins, installed units. Setup is fresh-host-only. | Do not re-run setup. Keep original bundle as historical; independently review new migration/source artifacts. |
| Installed provisioning contract `nyra-stage3-provision.mjs` (rollover-pr30 package) | Main 29a; fixed Nov 4 deadline; loader SHA 19bbb5e0…; dependency tree a140adb4…; input SHA and one-time attempt; governance/capture pins; rejects existing artifacts. | Never edit or replay. Extension is separate migration, not provisioning. Existing attempt/input/helper bytes remain historical evidence. |
| Rollover `nyra-stage3-rollover-source.py`, `source-rollover.json`, historical loader and private capture scripts | Fixed old/main SHA, deadline, old target, 767 dependency files, 57 source files; historical capture evaluator remains 6afcf035. | Do not relabel or re-run original rollover. New main needs a new exact delta/candidate/rollover approval. |
| `/opt/nyra-5c/private/stage3-reviewed-input.json`, `/private/input-sources/*` | Six VITE values, owner identity/public Auth configuration, unknown external rights, provenance and source SHA. | Preserve original input and sources. New extension input envelope references original raw digest; no invented values or expanded rights. |
| `/opt/nyra-5c/private/launch.json` | Embedded target, configuration, repositoryTrust.sourceSHA / version / identitiesSHA256, proposed policyStates; public config digest; signer pins. | New launch generation; preserve old copy and digests. Recalculate only deadline/source-dependent identities/trust/policy hashes; normal-build/config, governance and signer pins remain equal. |
| `/var/lib/nyra-5c/owner/source.json`, `owner-source.mjs` | policy.windowEndsAt; repository trust digest; allowed policy digests. Owner process remaining lifetime <=24h at startup (not host age). | New source config, same keys/Auth identity/origin, new trust/policy pins. Explicit new-target-only process lifetime is min(24h, remaining); general long windows still reject. No automatic restart; restarting requires fresh real Owner/MFA. No service start in migration. |
| `repository-launch.mjs`, `repository-runtime.mjs`, coordinator `repository.json`, role `runtime.json`, `ipc.json`, `role-ipc.json`, `repository.lock` | Exact clean installed source, 57 bytes, embedded target, runtime start/end, proposal hashes, active state file, process timer, no-restart services. | Migration only while absent/inactive; no generated runtime/IPC/lock artifacts. Exact new source rollover; committed extension receipt required before new launch. |
| `compose-trust.mjs`, `live-watcher.mjs` | Watcher end-start <=86400000; runtime passes original target.createdAt. This already rejects the 47h58m old target. | Explicit target-bound exception threaded through composition; ordinary watcher remains <=24h. No fabricated new start time. |
| `live-role-service.mjs`, `live-role-worker.mjs`, `private-port.mjs` | Role isolation, policy-state checks, IPC request timeouts (180s), revalidation/retirement. | Preserve; no lease/IPC timeout extension. All role containers must be inactive during migration. |
| `repository-db.mjs`, `db-stage.mjs`, `/var/lib/nyra-5c/{registrar,broker}/pg.json`, PostgreSQL `pg_roles.rolvaliduntil` | Original provisioning sets role VALID UNTIL old end; role password files are separate. | Retain DB/passwords/grants/schema. Extending exact two LOGIN validities requires a DISTINCT explicit DB-credential approval and transaction; host extension does not grant it automatically. |
| Docker `nyra-repository-pg`, `nyra-repository-db`, volumes / image, firewall bridge | Resources labelled with OLD target digest; container labels immutable. Network Internal and no host ports; INPUT/DOCKER-USER isolation. | No recreation/relabel. Cleanup must cover old and new target digests; enumerate mounted/unlabelled volumes separately for reviewed retirement. Preserve actual IDs, image, mounts, IPtables rules. |
| `cleanup.mjs`, `cleanupReplacement`, installed expiry script/service/timer | Exact digest filters, inspect-before-delete, absence verification; old script set -e; target validator and staged launcher dependency; fixed secret removal paths; provider destruction manual. | Preserve original bytes. New independent Persistent timer/router must work without mutable runtime/config during partial migration. Keep old deadline effective until coherent COMMITTED receipt and verified new enforcement. Dual-label scoped teardown; no broad cleanup. |
| `fra1-launch.mjs`, `fra1-runtime.mjs`, `plan.mjs`, `db-stage.mjs`, `live-watcher` legacy callers, `HOST-FRA1.md`, `POSTGRES-STAGE.md`, `plan.example.json` | Retired-host 12h/24h staging/launch plans and timers (`nyra-5c-*`); legacy origins and labels. | Do not revive/migrate. Live inventory must detect any active legacy timer and STOP if it can destroy current resources sooner. |
| `repository-trust.mjs`, `repository-policy.mjs`, `governance.mjs`, `runtime/nyra-edge/repository-binding.mjs`, `/var/lib/nyra-5c/policy/state.json` | Trust source SHA/identities/governance/key/config digests, trust version, active policy hashes and retirement. | Preserve SINGLE_OWNER/policyVersion/ownerAuthorizationSHA; new trust configuration generation and new proposal hashes, not active policy state. Existing active state => STOP for independently reviewed retirement, never silently migrate active authority. |
| `owner-risk-source.mjs`, Supabase Auth identity/AAL2/session/status, owner journal | Fresh MFA identity, JWT exp, active session digest, max decision 900s, receipt <=45s and verifier <=60s; bound to repositoryTrust SHA. | No session/decision/receipt extension or old signature edits. Fresh real MFA/decision/challenge for new trust. Retain old journal; never treat old receipt as new authority. |
| `job-registrar.mjs`, `protected-identity.mjs`, `oidc.mjs`, `github-jobs.mjs`, `ops/protected-delivery/schema.sql` | Registration 300s; SQL <=10min; JWT <=600s; issuer/JWKS cache 300s; run/attempt/check/sha/aud/jti correlation, expires_at/revoked_at and used_tokens. | Preserve all bounds/schema/replay rows. Zero active registrations at migration; expired registrations and old jtis stay historical, never extended. |
| PR #31 `stage3f-github-readback.mjs`, `STAGE3F.md`, tests | Hardcoded source29; exact 59-file fingerprint; old timer calendar, canonical input/launch, target-keyed one-time attempt; issuer <=hostend; >62min remaining; 60s capture; old marker/capture pins. | NOT source-compatible after runtime patch. Keep PR31 unmodified/unmerged. Requires coordinated separately reviewed pin/profile update and renewed preflight context AFTER actual integration main SHA exists; old helper may not execute on new source. No credential issue here. |
| Existing renewal/readback helpers and `admin-read.json`, App5594139 / install178162814 | Old expiry, target bootstrap, one repo and 7 read permissions, historical one-time marker; immutable capture/protections/governance provenance. | Existing lease/marker untouched. New token/readback only under separate approval; old evidence remains old. Never increase local/issuer expiry merely for extension. |
| `administration-evidence.mjs`, `compose-trust.mjs`, `acceptance-evidence.mjs`, `application-inventory.mjs` | Capture <60s, supplemental protections, canonical digest and Ed25519 key/context, application inventory max300s. | Fresh source-compatible readback for actual new main; unchanged keys; new signed evidence when required. Historical digests/signatures retain original window/source. |
| `.github/workflows/nyra-live-trust-acceptance.yml`, `nyra-live-trust-probe.yml`, `ops/protected-delivery/workflow-request.mjs`, `live-probe.mjs` | Exact main/caller/reusable SHA, per-run subjects, audiences, timeouts, owner dispatch; public probe plan and approval origin/key. | No workflow/config publication or dispatch. New main => new run-bound authorization. Revalidate public collector approval/pins; host origin/TLS/path isolation unchanged. |
| `live-ingress.mjs`, Caddyfile/caddy.service, public collector/probe plan | Exact origin, fixed readiness/acceptance paths, UNIX socket, 2-byte body cap, no owner/admin routes; no credentials at edge. | Preserve routing/private listeners. Verify collector target/source/key/plan generation separately; never activate ingress while migrating. |
| `lib/publication/integration/{normal-provenance,protected-composition,watcher,policy,observer}.mjs` | Approved inventory config/source/policy hashes, active registrations, retirement signature context, discovery/provenance separation. | New source/trust invalidates operational reuse; retain prior signed records as history. Fresh Stage3G material only; no fabricated acceptance. |
| `lib/publication/{authority,contract}.mjs`, remaining runtime delivery/inspection/materialize/assets/machine/controller modules; `contracts/nyra-publication/v1.1/*`; Supabase publication/inspection/delivery migrations | Independent editorial/preview/confirmation/session/lease/permit/generation/fence expiries and server clock; production replay and publishing rules. | UNRELATED: no change, no production migration/deployment. Acceptance-host extension cannot extend any of these TTLs or alter publication generations. |
| `ops/{edge-acceptance,native-acceptance,publication,protected-delivery}` fixture drivers; tests and native-results | Disposable fixture clocks/timeouts/synthetic authorization, acceptance evidence provenance. | No completed historical/native suite replay unless changed dependency requires it. New focused tests + automatically required CI only; not live acceptance. |
| DigitalOcean resource615221104, billing and destruction | Droplet does not self-expire with local timer; independent account/status/identity confirmation and destruction needed. | LIVE NOT VERIFIED. Provider billing continues until exact Droplet destruction. No extension of billing guarantee or automatic replacement. |

Full lexical scan (tracked source only, includes numeric limits/SQL expiry rules)
is committed in `extension-20261105-time-references.tsv`. Each path is classified
above; hits in unrelated publication/business features remain unchanged. This is
not a claim that an offline scan can discover unrecorded host-local cron/drop-ins.
The read-only host inventory procedure is mandatory before deployment approval.

## Supplementary actual-host findings (Owner-supplied; not re-observed here)

The approved candidate matches 57/57; live runtime matches 55/57. Exactly
`lib/publication/runtime/protected-identity.mjs` and
`ops/acceptance-bootstrap/replacement-target.mjs` are older. The signed-off helper
PR31 SHA b661247f… correctly stops with STAGED_BYTES before issuance. Historical
capture is unique and supplemental Actions/ruleset fields exist. Preserve the
correct personal-repository bypass logic already in approved source29.

The independent alignment utility copies ONLY the two approved source29 byte
versions, only after exact known older-byte comparison and proof of inactivity.
It refuses every other before hash, including a newer reviewed extension. No
extension/source merge is necessary for alignment or current-source 3F preflight.
The unchanged source29 watcher still has a separate 24h lifetime incompatibility:
3G must not be declared ready merely because 3F alignment succeeds.

## New migration-only artifacts (not part of the 57-file import closure)

- `runtime-align-29a73458.py`: independently reviewed immediate two-file alignment;
  target remains Nov4, source29, no token or extension change. One private attempt.
- `extension-readonly-inventory.py`: local read-only DB/systemd/Docker/file facts;
  never asserts unauthenticated provider/all-scheduler review as verified.
- `extension-20261105.mjs`: proposed config/plan/commit validation, fixed-date unit
  candidates and separately approved installed expiry-router mode; no deploy/apply
  command and no operational authorization from a plan.
- `/usr/local/lib/nyra-extension-20261105/{extension-20261105.mjs,plan.json,unit-pins.json}`,
  `nyra-repository-extension-expiry.{timer,service}`, old-service reviewed drop-in,
  root0600 `/etc/nyra-acceptance/extension-20261105.json` and new private extension
  input: new identities; old target/config/units archived without signer/password copy.
- Commit/source/config/unit pins decide whether old expiry can defer; new expiry
  always retires both exact target-label generations. All containers precede all
  network removals. A missing/mixed/uncertain commit retains original retirement.
- New input, approval, unit, target, source, trust, proposed-policy and receipt
  hashes require new review; they are not replacement historical attestations.

Materialized deployed-contract provenance (current Library versions inspected):

| Package | Raw SHA-256 |
| --- | --- |
| nyra-stage3b-rollover-pr30.zip | `628b746bddd4f103e8dcbb77d59fe3b011bd439745fde993ea15825868ca71d3` |
| nyra-stage3-configuration-provisioning-plan.zip | `dc27e100f2038fd3115c0dd3e27d29bea96798b04abac3a91a2baad788097f5d` |

The source29 provisioning contract fixes Nov4 end, the preserved loader SHA,
767-file dependency fingerprint and original one-time markers. An extension
must never patch/re-run that contract to impersonate fresh provisioning.
