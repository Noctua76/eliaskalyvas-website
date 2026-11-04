# Stage 3F: separately reviewed one-time renewal / Administration readback

Status: branch-only proposal. **NO-GO for host execution or merge until separate
review and owner execution approval.** This utility is not an authorization source.
No host command in this document was executed during implementation.

## Scope and exact pins

Only three new files: `stage3f-github-readback.mjs`, this document, and
`test/stage3f-github-readback.test.mjs`. The PR diff is the complete proposed change.

| Binding | Approved value |
| --- | --- |
| Installed source / remote main required by readback | `29a73458d4cd941e5ed514db56dc2c553d041bda` |
| Helper SHA-256 (raw bytes) | `0da0c185c7fd3bd191f656cc1976836d0a5234bcb0c891062fcf28f563571069` |
| Historical capture (canonical record digest; original evaluator source remains unchanged) | `5eb0c2c03f546214d684b48f15f2f415a2d78141eef874a8db67319595e86cf8` |
| Governance (canonical JSON digest) | `ec4b711e09bb448c74719e935ac2e3ca1e7675a8e75115526d67b9394d4e4a42` |
| Existing runtime protection fingerprint | `7bc1012c7309e172fda6a0616e670e9fd6a305f3325ca34eb5655e4f34759d97` |
| 57 source files + required CI workflow + staging utility: sorted `[path, raw SHA-256]` JSON digest | `410e8b9a64832651a02911d3cb1f6d797f7d4f040e7fc3dfc1901712df49e63f` |
| GitHub identity | App `5594139`, installation `178162814`, owner `217035723`, repository `1389733212` |
| Current host expiry | `2026-11-04T21:05:00Z` |

Exact permissions: actions, administration, checks, contents, environments,
metadata, pull_requests — all `read`, no additional permission. App slug:
`nyra-acceptance-read-noctua76`. Installation must remain selected-repository,
unsuspended, personal-account owned; a new token must enumerate exactly this repo.

The helper has only Node built-in top-level imports. The child reuses the
**installed, byte-verified** `administration-evidence.mjs`, `governance.mjs`,
`contract.mjs` and `owner-source.mjs` from the approved 57-file staged closure.
Their existing AJV dependency tree is reused and bound into the approved preflight
context. No npm install, pg/sharp import requirement, dependency copy, or new runtime
package is introduced. Preflight hashes the installed dependency tree and repeats
that check before issuance and before credential commit; compare its fingerprint
with the accepted host inventory during independent review. Before any issuance,
preflight also verifies same-filesystem credential handover and imports the
reviewed reader components as the coordinator with fetch explicitly denied.

## Mandatory compatibility gate

| Requirement | Implementation evidence / boundary |
| --- | --- |
| Stage 3C provisioning contract unchanged | No existing file modified; no DB connection, provisioning helper invocation, Docker mutation or key creation. |
| Existing source/governance/evidence pins unchanged | Exact clean installed HEAD, launch source/protection pins, governance and historical record hashes required. Historical evaluator SHA is never relabelled. |
| 57/57 remains valid | New utility is outside all staging roots. Focused test reproduces the static closure and checks the independently pinned 59-file fingerprint. Host preflight compares the exact 57-entry manifest and every staged/source byte. |
| No unrelated 3F–3G gate additions | Runtime code, credential path/schema, reviewed input, launcher and policy states remain unchanged. Renewal-specific approval/context and attempt checks apply only to this utility. |
| Publication/editorial/Owner/MFA/workflows unchanged | No workflow edits, dispatch routes, owner authorization calls, signatures or policy activation. Required PR CI remains unchanged. |
| Runtime fail-closed preserved | Runtime and owner services / live role containers must be inactive. During canonical-file handover the credential can briefly be absent or have two links; the existing private-file reader rejects both. |
| No irreversible prerequisite | No old marker/credential deletion, key regeneration, reprovisioning or resource replacement. Previous credential inode and bytes are archived privately before no-clobber installation. |

Preflight binds exact target, helper bytes, input/launch/provisioning marker,
governance, credential inode/bytes, prior renewal markers, existing evidence,
App key bytes/metadata, owner/evidence key and DB-config metadata, source files,
dependencies and timer calendar. It does not read owner/evidence private-key or
DB-password contents. It does not verify real DB state again or claim new live
Stage 3C–3E acceptance. Those completed results remain the operational baseline.

The utility is reviewed independently of installed runtime source. **Do not merge
this PR as a prerequisite for renewal:** doing so would change remote main and
correctly fail the existing source gate. Extract only this reviewed helper to a
private operator directory; leave both installed checkout and main at the approved
source. No source/pin rollover is authorized here.

## Consolidated operator sequence — future separately approved use only

1. Reviewer: inspect the exact PR head, three-file diff and required CI conclusions
   (`nyra-required-regression`, `nyra-required-production-build`). Run the focused
   test locally. Pin the reviewed utility commit separately from runtime source.

   ```sh
   node --test test/stage3f-github-readback.test.mjs
   sha256sum ops/acceptance-bootstrap/stage3f-github-readback.mjs
   git diff 29a73458d4cd941e5ed514db56dc2c553d041bda -- \
     ops/acceptance-bootstrap/stage3f-github-readback.mjs \
     ops/acceptance-bootstrap/STAGE3F.md test/stage3f-github-readback.test.mjs
   ```

2. **After separate permission for host preparation/preflight**, transfer the exact
   reviewed helper through the approved private transfer route, outside the source
   checkout, as root-owned mode 0600:
   `/root/nyra-github-app/stage3f-github-readback.mjs`. Do not overwrite a different
   existing helper. Do not transfer tokens, keys, input or host configuration out.

   ```sh
   cd /root/nyra-github-app
   printf '%s\n' '0da0c185c7fd3bd191f656cc1976836d0a5234bcb0c891062fcf28f563571069  stage3f-github-readback.mjs' | sha256sum -c -
   ```

   Identify the existing accepted capture without re-running historical acceptance
   or changing it. This command outputs only its path, and rejects ambiguity:

   ```sh
   CAPTURE=$(/usr/local/bin/node --input-type=module <<'NODE'
   import {readdir,readFile} from 'node:fs/promises';
   const dir='/var/lib/nyra-5c/coordinator/evidence',matches=[];
   for(const name of await readdir(dir))if(name.endsWith('.json')){
     try{const e=JSON.parse(await readFile(dir+'/'+name,'utf8'));
       if(e.digest==='5eb0c2c03f546214d684b48f15f2f415a2d78141eef874a8db67319595e86cf8')matches.push(dir+'/'+name);
     }catch{}
   }
   if(matches.length!==1)throw Error('CAPTURE_SELECTION_REQUIRES_REVIEW');
   console.log(matches[0]);
   NODE
   )
   /usr/local/bin/node /root/nyra-github-app/stage3f-github-readback.mjs --preflight "$CAPTURE"
   ```

   Expected (not claimed as observed on the host):
   `LOCAL_READ_ONLY_PREFLIGHT_PASS`, exact source above, `stagedFiles:57`,
   actual helper/dependency/context and input/launch/provisioning marker digests,
   unchanged host expiry,
   `networkRequests:0`, `authorization:false`. The default preflight never issues
   a token or creates an attempt. It requires more than 62 minutes remaining;
   the current window therefore closes for this procedure before 20:03 UTC.
   Do not change the timer or shorten/forge issuer expiry to evade this bound.

3. **STOP for separate owner execution approval** of the exact helper SHA,
   preflight `contextSHA256`, target/window and one issuance/readback/replacement.
   The approval is operational permission, not Owner/MFA evidence. Only after it
   exists, set the exact approved digest (never invent one) and execute once:

   ```sh
   : "${APPROVED_CONTEXT_SHA256:?Set the independently approved preflight digest}"
   /usr/local/bin/node /root/nyra-github-app/stage3f-github-readback.mjs \
     --execute-once "$CAPTURE" --approved-context "$APPROVED_CONTEXT_SHA256"
   ```

   One durable, exclusive root-private attempt directory is created per target
   digest. Old token must return authenticated HTTP 401; 403/timeouts do not count
   as proof of expiry. App/installation identity and permissions are checked before
   one POST. New issuer expiry must fit fully within the unchanged host deadline.
   A received token is retained privately before remaining response validation.
   Scope and fresh readback must pass before canonical credential installation.
   Protections/Actions/rulesets are compared with the accepted historical baseline
   and sampled again to detect concurrent changes; the existing merged-main CI
   validator is reused. Entire capture must remain under 60 seconds old.

   Success prints `CREDENTIAL_RENEWED_ADMINISTRATION_OBSERVED_NOT_AUTHORIZED`,
   source SHA, actual capture digest and private attempt path; never the token.
   New capture records actual evaluator source, helper/context digests and prior
   capture digest. No historical capture, input, helper or runtime pin is edited.

## Partial failure, recovery and retirement

**Never rerun issuance, delete the old marker/attempt, regenerate a key, or run
broad cleanup.** After any uncertain/partial execution, keep authority closed and
use only this separately permitted read-only inventory:

```sh
: "${ATTEMPT_PATH:?Use the exact private attempt path reported by preflight}"
/usr/local/bin/node /root/nyra-github-app/stage3f-github-readback.mjs \
  --recovery-inventory "$ATTEMPT_PATH"
```

Inventory prints file metadata only, including presence/absence of canonical
credential. Attempt files are root-private except staged credential contents,
which are coordinator-owned 0600 inside a root 0700 parent:

| Inventory item | Interpretation / independently approved next action |
| --- | --- |
| `00-reserved.json`, no `10-issuance-pending.json` | No issuance request reached this code path; review logs/context before approving another attempt. No automatic reset. |
| `10-issuance-pending.json`, no received token | Issuance outcome unknown. Independent issuer audit; prove revocation/expiry and scope before approving recovery. Never POST again merely because response was lost. |
| `received-token.json`, `pending-admin-read.json` | May contain a live token. Independent private inspection and exact-token revocation/expiry verification if abandoning; never `cat`, export or log these files. |
| `30-commit-pending.json`, no `40-complete.json` | Canonical install/evidence persistence may be partial. Compare exact hashes/inodes and runtime inactivity. Preserve `previous-admin-read.json`, pending/received token and unexpected canonical files. |
| `previous-admin-read.json` | Original expired credential bytes/inode, not permission to restore it as valid. |
| `fresh-administration.json` / `administration-stage3f-<digest>.json` | Unsigned private readback, not Owner/MFA or signed acceptance evidence. |
| `40-complete.json` | Local transaction completed; no production/owner/OIDC authorization implied. |

Recovery needs a distinct owner-approved plan naming exact attempt, files,
credential digests and issuer disposition. Options: abandon and verify exact-token
revocation/expiry; or, only if all live checks can be freshly repeated and no
concurrent state exists, separately reviewed completion of the handover. This
helper intentionally has no recovery mutation or automatic rollback mode. A file
restore must never overwrite an unexpected canonical credential or revive expired
metadata. There is no token-wide App/installation revocation fallback.

The existing expiry mechanism remains byte-for-byte untouched. **It does not
know this new attempt directory.** Private attempt/credential files must be listed
in the independently approved retirement inventory; do not assume the timer
sanitizes them. No automatic deletion/export is introduced. Before any transfer,
preserve only evidence explicitly allowed by the approved retirement procedure
and already sanitized/signed as required. Private attempts, raw captures, expired
credentials and signing keys are not approved transfer material. Provider billing
retirement remains the existing separately approved procedure.

If time expires, all issuance/commit gates close; do not extend/disable expiry or
replace the host automatically. A future window needs independent host/window,
configuration/provisioning, trust/evidence and execution approvals. Do not move
private keys/expired tokens or treat old input/context hashes as new approval.
The helper can be reviewed/reused with the same source/identity contract and a
new independently approved target/context; incompatible source or governance
requires a targeted review, not pin substitution. Historical records keep their
original provenance. Required pre-existing expired credential belongs to that
new approved target; absence is a blocker, never a reason to copy the old secret.

## Residual gates / decision

GO for independent code review only when focused tests and both required CI jobs
pass. NO-GO for merge, host execution or Stage 3G authority in this implementation
session. Live App/installation/scope/Administration observations remain unexecuted;
Owner/MFA authorization and protected OIDC acceptance remain separate unverified
live gates. No completed Stage 3B–3E live acceptance was re-run.

Residual risks: API changes after the final read cannot be atomically excluded
across GitHub and the filesystem (existing runtime performs its own fresh checks);
concurrent root administration cannot be made safe by a userland file lock; keep
exclusive operator control. Partial commits intentionally require manual recovery.
A readback exceeding 60 seconds closes rather than retries. New-token issuance
can be uncertain despite a timeout. Attempt secrets need explicit retirement
inventory handling. These limits are not an Owner/MFA bypass or a new runtime gate.
