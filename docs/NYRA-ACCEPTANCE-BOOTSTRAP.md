> **Replacement preparation:** see [the target-configurable offline package](../ops/acceptance-bootstrap/REPLACEMENT.md). Historical host commands below are not the current execution path. No resource is created by preparing the replacement.

# Phase 5C — consolidated operator bootstrap

Base main: `c24c891a8d75f4d48a54305eccbdf89722c66a69`.
This package is INACTIVE. A temporary FRA1 host/PG17 pilot was provisioned by
the operator and has now been destroyed; its DNS was removed. The current code
has not executed real owner authorization, protected OIDC or provenance acceptance. It does not repeat the accepted 639-test baseline.
No Phase 5D production operation is enabled. Exact CI/head evidence is in the PR.

## Current closure / future execution gate

**2026-10-31: FRA1 pilot retired.** Owner reports PG17 cleanup success/status0,
DB container and private network removed, no Docker mounts, Droplet destroyed and
DNS removed. Usage USD0.91 was covered by signup credit, estimated payable USD0.00
at observation time. These are operator observations, not signed trust evidence.
The old IP, origin, credentials and expiry are unavailable and must not be reused.
The public probe plan is disabled before any network or token request.

The instructions below are a **design/reference template**, not authorization to
execute against FRA1 or a replacement host. Current evidence, gaps and the minimal
future sequence are authoritative in [the PR20 independent review package](NYRA-PR20-INDEPENDENT-REVIEW.md).
Any new environment/target binding, credentials, signing authority, ingress or
invocation requires its specific owner approval. No Phase5D work is enabled.

## Future deployment and approval scope (reference only)

Use ONE owner-provided, temporary Linux host, Docker + systemd, 4 vCPU / 8 GiB /
20 GiB free, with an existing owner-managed HTTPS reverse proxy and a dedicated
acceptance hostname. Do not use the website server/container/database, github-pages
Environment, Railway/Render production integrations or production DB credentials.
This workspace has no usable Docker daemon and denies UNIX listen; it is not the
acceptance host. No paid provider/account is selected or created on the owner's behalf.

The owner must supply the actual host name and dedicated HTTPS origin before
approval is concrete. Prefer an already available isolated machine/VM: no new
permanent service, managed database or subscription is required. If none exists,
owner must select/approve a provider, region and cost cap BEFORE provisioning.

| Component | Access / isolation |
| --- | --- |
| Existing TLS proxy | Dedicated origin; forward ONLY fixed readiness and acceptance routes. No request/header/body access logs. No owner/admin/evidence endpoint. |
| Private control-plane coordinator | Dedicated GitHub read credential; independently reads admin/App evidence and current policy, fixed GitHub/JWKS endpoints only. Not a workflow process. |
| Registrar process/container | Own LOGIN in existing nyra_trust_registrar role; write registrations/inventory only; no broker/owner key or bearer; private authenticated IPC. |
| Broker process/container | Own LOGIN in nyra_trust_broker; verify real JWTs, consume replay IDs, revalidate; no registrar credential or owner signing key; private authenticated IPC. |
| Disposable PostgreSQL17 | Existing approved schema/image lock; internal network only, no host port or production connection. Bootstrap DBA credential removed from normal processes. |
| Clean builder | Exact reviewed checkout/source-byte manifest; read-only code, network none, no DB/API/signing/IPC key or JWT. Dependencies prestaged from reviewed lockfiles. |
| Owner-decision source | Separate owner-only UNIX socket, private signed journal and own externally pinned key; no DB or GitHub write identity. New owner AAL2 session in memory only. |
| Private evidence | 0700 directory / 0600 files, independent externally pinned evidence key; signed sanitized records only, no raw GitHub/owner JWT. |

GitHub-hosted jobs must reach the dedicated HTTPS ingress. "Private collector"
means restricted operation/identity and private internals/evidence, not an unroutable
private IP. Do not open PostgreSQL, owner socket, admin reader or evidence to ingress.
Block host/peer escape from role containers; allow the builder no egress. Host
control-plane egress is limited to GitHub API/JWKS and the exact approved Auth/status
origin. Docker image/package acquisition happens before isolated execution.

## Exact temporary identities / credentials

1. AFTER host readiness: one new repository-only GitHub read identity, at most24h:
   Administration, Actions, Checks, Contents, Pull requests, Environments:read;
   Metadata:read automatic. No write/Workflows scope, no Codex permission change.
   Keep it in private control-plane tokenSource only; broker/registrar API reads
   go through authenticated private transport, never a workflow credential.
2. Two distinct disposable DB LOGIN passwords and per-role IPC MAC keys, using
   the already approved SQL grants and authenticatedFrames/revalidation protocol.
3. One acceptance evidence/broker-revalidation key and a DIFFERENT owner-decision
   Ed25519 key. Generate only after approval, export public JWKs, and independently
   pin canonical hashJSON(publicJWK) + key IDs outside the host before use. Private
   keys never enter checkout, runner, artifact, builder or the opposite role.
4. One NEW owner AAL2 session, explicitly authorized for the private source, never
   an old stored production token/password/service-role key. A public/publishable
   API key is sufficient for the Auth call; no production secret is copied.
5. Reuse existing TLS proxy certificate handling; no secret/tunnel credential is
   installed in Actions. Read credential revocation remains an issuer-side owner step.

## Real owner/MFA reuse — supported read-only mechanism

owner-risk-source.mjs connects to TWO exact, separately pinned HTTPS GET routes:
`{projectOrigin}/auth/v1/user` and `{projectOrigin}/functions/v1/nyra-api/status`.
The first server-verifies this exact bearer and pinned Supabase user UUID. The
existing nyra-api status code invokes the existing website_owners/AAL2 gate;
it works even with generation disabled. Source additionally checks sub, AAL2,
session UUID, expiration, non-anonymous identity and exact origin. No editorial
RPC, OpenAI call, Auth admin API, refresh token or service-role key is used.

The mapping of the real Auth UUID to GitHub owner217035723 is trusted operator
configuration and must be independently approved; never derive it from caller
metadata. The existing status endpoint must actually be reachable and pass. If
it is absent/inaccessible, STOP: do not deploy an Edge Function or silently fall
back to locally decoded JWT claims. The baseline did not independently establish
this live status read, so it remains NOT VERIFIED until owner-approved execution.

The source authenticates on approval AND every receipt read, using a retained
in-memory fresh session. It appends actual signed decisions to a private chained
journal. Explicit acknowledgments bind inventory digest/policy/repository/owner.
Decisions expire within15min and the owner session; a receipt lasts at most45s.
Latest decision supersedes earlier IDs; retirement is journaled; a restart loses
session authority and requires fresh owner approval. Files alone cannot restore it.
Session/logout semantics are those of the existing Auth/status contract; strict
acceptance retirement is independently enforced by source close/journal retirement.
Do not claim a global JWT sign-out guarantee beyond that established contract.

### Private configuration (outside repository)

0700 directory containing owner-config.json, owner-signing-key.json and journal.
owner-config.json (0600) has: socket, journal (same private directory), signingKey,
keyId, publicKeySHA256, policy and auth. Signing-key file contains the owner-approved
keyId/privateKey/publicKey JWK pair. policy has repository/name/IDs, SINGLE_OWNER,
policyVersion, independently accepted applicationsSHA256, pinned ownerAuthUserId
and windowEndsAt. auth has projectOrigin, statusURL, ownerOrigin, ownerAuthUserId
and publicApiKey. Real values must come from authenticated reads/owner pins.

```sh
# NO listener starts without explicit execution enablement and valid private pins.
NYRA_ACCEPTANCE_OWNER_SOURCE=1 node ops/acceptance-bootstrap/owner-source.mjs /private/owner-config.json
# Separate owner terminal, private channel. The client reads JSON from stdin.
# Do not put bearer values in argv, shell history, environment, files or this chat.
node ops/acceptance-bootstrap/owner-request.mjs authorize /private/owner-config.json
```

Authorize stdin fields: token (NEW real AAL2 session), applicationsSHA256,
policyVersion, riskAcknowledgment:{write:true,merge:true,workflow:true}. The source
compares these to independently accepted trusted policy; an unsigned declaration
or static flag is never sufficient. Only decision ID/expiry are returned.
Private receipt client: `owner-request.mjs receipt /private/owner-config.json
/private/receipt.json`, stdin {decisionId,challenge}. Retirement uses `retire`
and {token,decisionId}. Source/socket/journal must remain owner-process only.
The trusted coordinator's narrow private client may request receipts; role
containers/jobs do not gain owner-approval or signing authority.

## Complete authenticated integration audit — unavoidable owner step

The connector's installation list is not an all-Apps personal-account inventory.
No repository read PAT can be advertised as solving that completeness problem.
Use the authenticated owner Settings → Applications → Installed GitHub Apps,
Authorized GitHub Apps and Authorized OAuth Apps, plus repository Integrations,
Deploy keys/Webhooks and applicable token access. Capture actual installation/App
IDs, repository selection/coverage, permission manifests and effective write scopes
with source URL/API representation, authenticated owner identity and observation
time. Compare all pages/pagination; revoked/no-access integrations are recorded
explicitly. Do not paste secret token values. Screenshots or a `complete:true`
JSON declaration do not establish authoritative completeness by themselves.

The owner must authorize an independently authenticated audit source/ceremony
and external verification of that record. If a manifest/completeness source cannot
be obtained, keep the App gate NOT VERIFIED; do not manufacture an all-Apps API.
The current Connector's protected PR19 merge demonstrates development connection
merge authority; do not infer owner-exclusive technical merge control. Evaluate
actual contents/workflows/admin scopes and any OAuth/classic-token equivalents.
After real read-back, validate/normalize the complete inventory through the existing
assessApplications and freeze its digest in reviewed private policy. Only THEN
obtain the actual owner/MFA risk decision. Infrastructure approval in this document
cannot pre-approve an unknown future inventory digest or missing evidence.

## Existing code vs this package vs host-specific binding

| Work | Mechanism / state |
| --- | --- |
| Branch/Env/check/access read-back | Existing administrationReader + readAdministrationEvidence; requires real read identity + complete App source |
| Owner risk source | NEW executable private owner source, remote existing-MFA bridge, signed durable journal, client; not provisioned |
| Deployment approval/pins | NEW plan.mjs reads real operator config; no generation/provision/dispatch; incomplete example intentionally denies |
| Registrar/broker, collector and IPC | Existing strict factories/protocols retained; host must compose them in separate credential/process contexts, never run synthetic isolated-worker as real acceptance |
| Normal build/inventory | Existing rebuildCleanNormal + createProtectedInventoryRegistrar + publication-only authority; real identity/dependencies injected only on host |
| Cleanup | NEW label-scoped dry-run/apply CLI; external issuer/session/proxy/file cleanup explicitly listed |
| Public probe plan | Existing CLI requires real ops/protected-delivery/live-acceptance-plan.json; no fake plan shipped |

The fixed host orchestration binding (private API proxy, real registration watcher,
role-process lifecycle and evidence persistence) must be filled using the selected
host's actual transport/paths and the EXISTING compositions. It is not a deployed
service in this PR. Keep that binding and the real non-secret public probe plan in
THIS consolidated Draft PR before final execution review/merge; no separate prep
PR or guessed host/subject/job name. This package alone cannot claim runnable real
OIDC acceptance without those bindings and independent App/owner evidence.

## Ordered execution — no implicit dispatch or merge

1. Owner supplies exact host, dedicated origin,24h window and existing Auth/status
   pins. One infrastructure approval covers resource limits, private reachability,
   fresh owner-session use, read identity scope, keys and the authenticated App-audit
   arrangement. It does NOT approve unseen App digests or either GitHub invocation.
2. Host ready/private permissions/egress verified FIRST. Then owner creates/injects
   the read identity; generate/pin temporary keys and DB/IPC secrets. No production
   migrations/credentials/services. Read full branch/Env/access and complete Apps.
3. Owner reviews actual App residual write/merge/workflow authority; approves real
   decision via existing MFA; independently verify signature/currentness/digest using
   administrationGate. No real receipt means STOP.
4. Fill actual deployment binding + public probe plan in this same Draft PR. Run
   targeted changed-boundary tests and mandatory exact-head CI; external review
   and separate merge authorization. The eventual merged SHA becomes callerSHA;
   this base c24c891 is NOT a prediction of that future SHA.
5. Pin that actual main SHA, reviewed reusable SHAcefd1a4..., observed exact full
   workflow job names and validated environments. Start private watcher BEFORE
   requesting FIRST explicit owner authorization to dispatch discovery on main.
   Watcher independently reads run/attempt/jobs/check/suite/referenced_workflows,
   registers each in-progress job, then readiness; token can never self-register.
6. First invocation: reserved discovery subject policy only; GitHub JWKS verifies
   actual signed claims and exact registered facts; private signed authorization:false
   evidence. Confirm real referenced_workflows representation. No wildcard correction.
7. Independently review complete observed subjects for all3Environments and approve
   exact equality policies; retire discovery registrations. Fresh owner-risk receipt
   and SECOND explicit dispatch authorization; no reuse/overwrite of discovery rows.
8. Fresh invocation: registered build token → isolated exact-source normal rebuild →
   byte verification → current policy/registration revalidation → immutable approved
   inventory; inspection identity check only; publication identity-only consumption.
   Signed private evidence covers replay/expiry/revocation/stale/policy rollover and
   interrupted-state handling. No publication/inspection/editorial operation.
9. Retire decisions/registrations, close sessions, revoke GitHub read identity, archive
   only sanitized signed evidence outside temporary host. Remove keys/IPC/login files,
   containers/volumes/network/proxy and transient timer; verify issuer revocation.

### Executable plan and scoped cleanup

Copy plan.example.json to PRIVATE operator config, fill ONLY real host/origin/window
and externally pinned key metadata; callerSHA is the reviewed real eventual main.
`node ops/acceptance-bootstrap/plan.mjs /private/bootstrap.json` outputs a deterministic
planSHA256 and private/public exposure checklist, authorization:false, dispatches0.
It never provisions. The publicProbePlan output is routing config, NOT owner approval.

Label EVERY temporary Docker container/network/volume:
`com.noctua.nyra.acceptance=<planSHA256>`. Dry run:
`node ops/acceptance-bootstrap/cleanup.mjs /private/bootstrap.json`.
Approved destruction: same command with `--apply`; inspect labels again before
removal, fail on scope mismatch. Cleanup does NOT remotely revoke a GitHub token.

Before secrets or jobs, owner installs a transient systemd cleanup timer on the
approved host, running this reviewed cleanup CLI `--apply` at the window deadline,
from a pinned read-only code path. Host-wide power-off/deletion at deadline is an
additional operator backstop. Do not assume a user timer survives logout. Owner
source self-stops at its configured deadline; coordinator must also enforce deadline
and cleanup in finally. Missing reliable cleanup is a pre-dispatch STOP condition.

## Closure evidence

PASS requires actual authenticated complete admin/App reads; independently signed
current owner decision; BOTH real GitHub invocations and sanitized signed records;
exact subject/workflow/Env/job correlation; native isolated SQL/process/build bytes;
immutable registration/controlled consumption; all security negatives; production
unchanged; temporary credential/resource retirement independently confirmed.
Missing credential/source/host/representation is NOT VERIFIED, never synthetic PASS.
After all pass, proceed directly to5D synthetic non-public lifecycle acceptance under
its specific delivery/migration/permission approvals; no credits or real article needed.
