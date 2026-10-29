# Private Node inspection boundary — proposed additive integration

This document defines the boundary before the correction is incorporated into
PR #14. Everything remains unmounted and non-delivering. Contract v1.1 and all
historical migrations are unchanged. No production database or Storage action.

## Authority and data flow

The existing Phase 2 handler authenticates the exact Supabase token, website owner,
MFA AAL2 and active session. An unmounted upload adapter intercepts only its
server-finalized asset-rights RPC. It binds bytes (max 20 MiB) to the exact cover,
current owner work/version/presentation snapshot and immutable rights decision.
Browser work/version selectors are not authorization or trusted hashes.

Unverified bytes go to an explicitly private quarantine bucket under a server
operation UUID; never a URL or a public release. Four outstanding quarantine
reservations per owner bound accumulation; each object is capped at 20 MiB and
operations expire within five minutes or the initiating JWT expiry, whichever is
sooner. Quarantine remains quota-accounted until a trusted cleanup deletes it and
acknowledges removal. Stale/interrupted attempts never make an asset eligible.

An independently authenticated private inspecting job claims a server challenge
and lease. Existing OIDC-verifier verify/assert capability semantics are reused;
no browser result flag, decoded JWT, copied capability or caller job name is
trusted. Phase 5C must establish actual protected GitHub OIDC; local signed job
identities may exercise the functional boundary only. Workers get a bounded
server-selected byte stream and immutable rights/snapshot bindings, not a DB
service key, arbitrary object selector or URL fetcher.

The Node worker executes the existing full Sharp packageAssets checks using the
real recorded rights proof. Its report binds operation, attempt, challenge,
owner, rights-decision ID, SHA-256, byte length, cover hash, presentation hash,
inspector version, code SHA and independently verified job identity. The private
server rechecks current session, work/version/presentation and challenge/lease,
reads actual quarantine bytes again, verifies exact hash/length, promotes exact
bytes to private accepted storage, then atomically records receipt + existing
asset/rights record + existing delivery link. There is no browser-success route.
A failed DB commit leaves at most private bytes without eligible records; an
exact retry is idempotent. Changed bytes, failed decode, expired/revoked owner
operation, stale presentation, old challenge or foreign job fail closed.

The accepted asset remains immutable after approval; subsequent private edits do
not invalidate historical approved bytes. New releases still require the existing
exact owner editorial approval. Rights review is distinct and is not legal proof
of licensing. No extra human publication approval is introduced.

## New database objects (one additive migration)

Private schema `nyra_inspection`:

- `rights`: immutable owner/session, exact cover, rights note and approval time.
- `uploads`: immutable work/version/presentation/hash/size/code/version bindings;
  mutable bounded lifecycle and quarantine-cleanup acknowledgement.
- `attempts`: immutable upload/job/challenge/lease identity, mutable terminal state.
- `receipts`: immutable accepted report and existing asset identifier; unique per
  upload and attempt, allowing exact retry without duplicate approvals/assets.

Tables use RLS and no anon/authenticated access. Only explicit service-role
privileges and SECURITY INVOKER RPCs are prepared. Every owner operation and
inspection claim/result revalidates nyra_publication_actor using stored owner /
session / expiry; cleanup can only remove accepted, failed, expired or revoked
quarantine and cannot authorize content. Trusted job authentication occurs before
its server-only database adapter. There is no unrestricted SECURITY DEFINER.

RPCs: `nyra_inspection_begin`, `nyra_inspection_ready`, `nyra_inspection_claim`,
`nyra_inspection_context`, `nyra_inspection_complete`, `nyra_inspection_fail`,
`nyra_inspection_assets`, `nyra_inspection_cleanup`.

Additive BEFORE INSERT eligibility guards on Phase 2 previews and decisions
require an accepted inspection receipt for the selected public cover on publish,
replace and rollback; withdraw remains independent. This closes the old
rights-only asset bypass without modifying historical migration files or the
contract. Existing rights-only asset records remain private and cannot become
eligible via the new schema. The owner-facing wrapper additionally filters the
core handler's asset context to accepted receipts. Receipt acceptance creates the
existing publication asset and delivery link together, never an uninspected
placeholder asset.

## Native acceptance and outstanding gates

Reuse pinned Phase 5A PostgreSQL/Auth/PostgREST/Storage/Edge images and internal
networks. Execute new migration only in disposable databases. Exercise real
signed GoTrue/TOTP owner authorization, private Storage denials, Node Sharp full
decode/privacy/MIME/size/hash controls, concurrent claims, revoked sessions,
expiry, interruption, invalid/stale rights and replay. Real protected GitHub OIDC
is NOT VERIFIED; synthetic local job authentication is labeled explicitly.

Preserve native resource evidence and the unsupported Sharp-in-Edge diagnostic.
That diagnostic is an expected unsupported capability, not positive inspection.
The supported Node path is the required positive CI target. Local gateway limits
are not hosted-production limits; authorized publication transaction interruption
remains outside proof until an actual transaction is exercised end-to-end.

No production endpoint, job dispatch, credential, bucket, migration application,
Edge deployment, Pages change, real article or OpenAI request is authorized.

## Implementation mapping

- `lib/publication/runtime/inspection.mjs`: unmounted owner/machine orchestration,
  independent existing-verifier capability assertions, private quarantine adapter,
  exact report allowlist, final byte re-read/promotion, filtered authority context.
- `node-inspection.mjs` and the additive `inspectBytesWithRights` export in
  `node-assets.mjs`: actual full Sharp packageAssets checks using the immutable
  recorded rights proof, rather than automatic rights certification.
- `20261029194516_nyra_private_asset_inspection.sql`: the four proposed private
  tables, invoker RPCs, immutable identity/rights/receipt guards and additive
  preview/decision eligibility triggers described above. No historical SQL edited.
- `ops/edge-acceptance/inspection-*`: real isolated Edge/Node/native-service
  acceptance. The Node worker interface receives private bytes/minimal binding
  metadata through the authenticated Edge service, not a database service key.
  The test driver also performs privileged fixture setup; that co-location is not
  evidence of a production least-privilege process/container configuration.
- Phase 5A runner has an explicit opt-in inspection mode using the same networks,
  image pins, two disposable stacks and cleanup. Its historical mode intentionally
  remains scoped to its eleven reviewed migrations; the new mode applies all
  twelve and tests the new additive eligibility restriction.

Local job credentials are ephemeral RSA-signed synthetic identities verified by
unchanged createOIDCVerifier with server-supplied exact registered job facts. They
are not real GitHub OIDC evidence and create no repository or production secrets.
The old Sharp/Edge probe remains documented and retained as historical source;
it is no longer executed or packaged as a supported path. Resource-only CI emits
UNSUPPORTED for that capability, never PASS as native image inspection. The new
native-inspection job is the required positive acceptance target.
