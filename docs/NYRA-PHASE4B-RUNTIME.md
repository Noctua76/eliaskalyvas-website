# Nyra Phase 4B — private runtime and delivery controls

Status: **branch-only implementation for external review**. Base/main: `6f611eb43716d77401d1c50467f736bc95be046d`. No production route, migration, Storage bucket, credential, publication, dispatch, scheduler or deployment is enabled. Phase 4C is not implemented. `.github/workflows/pages.yml` is unchanged.

The repository contains Phases 1–3 but no separately recorded Phase 4A implementation document. The explicit Phase 4B instructions and the existing v1.1 contract are the implementation boundaries. The decisions below are recorded for review rather than presented as previously verified Phase 4A code.

## Four distinct states

1. **Owner-approved intent:** the existing Phase 2 decision, exact public approval hash and immutable held proposal/event. Owner/MFA authorization stays in the existing Phase 2 authority handler and RPCs. Editing or logging out after approval does not silently rewrite a prior decision; new owner actions still require current owner/MFA/session validation.
2. **Materialized immutable release:** a new delivery-candidate snapshot derived from that approved intent. It is not the old held proposal retimestamped or overwritten.
3. **Deployment candidate:** a complete materialized dataset, full F01 transition evidence, intent IDs, source generation, registered run/attempt/check-run/code identity, lease/fence and immutable public-file inventory seal. A candidate/permit is not proof of deployment.
4. **Last verified-live state:** a separate baseline advanced only by the verified receipt recorder. Desired Phase 2 state is never substituted for this baseline. A late public observation is separately recorded and blocks automated retries; it does not manufacture a normal receipt.

## Contract compatibility and timestamp delegation

All six `contracts/nyra-publication/v1.1` schema files, `lib/publication/contract.mjs` and the Phase 2 authority implementation remain unchanged. Materialization calls the existing `validatePublicationSet`, `validateTransition`, `validateDeploymentTiming` and `validateReceipt` functions.

Phase 2's `authorized_held` release is used as immutable **intent evidence**, not delivered as an expired publication. A materialization creates new release/event/delivery-authorization UUIDs and a private mapping to the original held proposal and decision. These mechanically derived delivery IDs are not a second human editorial approval. The original human decision, authorization record, content/presentation revision IDs, approved payload hash and human/authorization timestamps remain unchanged. The private candidate records the originating decision IDs. No generated UUID may reuse the held release or held authorization ID.

The contract's approved payload explicitly excludes server-controlled delivery metadata. A newly materialized release therefore keeps the exact approved content/presentation/identity/relationship payload while receiving its own issue/modification timestamp near preparation. First-publication time is established on the first materialization of a lineage; subsequent successful replacements/rollbacks preserve it. Historical held proposals and all abandoned candidate branches remain byte-immutable and auditable. A proven-never-deployed branch is not inserted into the committed verified-live transition history. A retry gets a new candidate/attempt, IDs and timestamps, linked to the same immutable decision, only after trusted non-delivery reconciliation.

Phase 2's context history can contain the current held proposal and other pending desired-state proposals; it is not a ready-made F01 per-step historical context or a verified-live baseline. Including a fresh/provisional next-step proposal as an already historical release correctly fails v1.1 validation. The mapping and candidate ledger must never omit a prior committed materialized release.

The canonical materialization history supplied to F01 consists of the committed lineage from the actual baseline, not unrelated aborted candidate branches. Aborted branches remain in the private candidate/observation ledger; they are not erased or renamed as successful releases. Retained active releases remain byte-identical. Complete queued transitions are validated in order; multiple steps within one candidate get deterministic millisecond ordering no later than the trusted preparation clock. A clock too early for the owner authorization fails closed.

An ordinary website rebuild has `previous=actual verified-live dataset` and `steps:[]`; it preserves all dates and release bytes. Withdrawals and rollbacks originate only in the existing exact owner action. Machine request JSON cannot choose a release, generation, intent or rollback target. GR and EN stay independent; unchanged GR bytes are retained when EN is materialized. Contract compatibility tests cover publish/replace/withdraw/rollback, retained rebuilds, independent language publication, F01 evidence and timing windows.

This delegated mapping is a security-sensitive review item: the trusted private runtime is responsible for proving that every derived candidate authorization maps to the original owner decision. Valid JSON/hash/UUID alone is never authorization. No v1.1 wire change or historical rewrite is introduced.

## OIDC trust boundary

`lib/publication/runtime/oidc.mjs` implements RS256 verification through WebCrypto and a pinned GitHub JWKS URL, with bounded parsing and a short cached key source. It rejects untrusted header key URLs, algorithm changes, unknown/ambiguous keys, malformed JSON/encoding, bad signatures, expired/not-yet-valid/future-issued or overlong-lived tokens. Key-cache misses fail closed; no unknown-key fallback trusts caller material.

The trusted policy requires exact issuer, audience, configured subject, immutable repository and owner IDs, repository name, approved branch/ref type, environment, caller workflow identity, immutable reusable-workflow identity/SHA, allowed event and GitHub-hosted runner. Run ID, run attempt, check-run ID and code SHA are correlated with trusted job metadata. The policy is cloned; verified capabilities are frozen and tracked by verifier-instance WeakSet, so passing a decoded object is not enough.

There is no invented `job` JWT claim. GitHub's `check_run_id` is matched to the job's exact `check_run_url`, job name, run attempt and SHA using `github-jobs.mjs`. Environment comes from the cryptographically verified GitHub JWT and exact configured policy; the Jobs REST API does not independently return that environment field. The adapter's environment field is the configured expected value, not a falsely claimed second measurement. More than 100 jobs fails closed rather than ignoring incomplete pagination. A private server-controlled GitHub JSON reader is injected; no GitHub credential or dispatch is created here.

`machine.mjs` accepts exactly `{token}` for current export or current permit. Extra release/generation/rollback selectors are rejected. The database atomically checks the registered run/attempt/check-run/SHA, consumes a unique jti, checks source generation and active lease/fence/state, and returns only the selected current candidate. An export token cannot be reused for a permit: each operation/retry needs a fresh token/jti. New authorizations invalidate a stale candidate before export/permit. There are no browser or service-role credentials in machine responses; only the closed public dataset and opaque candidate capability are returned. Receipt and reconciliation operations are not machine-token methods.

## Prepared storage and locking

`supabase/migrations/20261028142242_nyra_private_delivery_runtime.sql` was generated with `supabase migration new`. It is **not applied to production**. It depends on the previously prepared Phase 2 migration and its narrow session privileges.

The unexposed `nyra_delivery` schema contains eleven tables:

- `control`: separate baseline/history/mapping/live pointers, source generation and lease/fence.
- `intents`: immutable projections of actual Phase 2 persisted decisions/events, not caller JSON.
- `attempts`: immutable run/code identity with controlled operational state.
- `candidates`: immutable full materialization and complete intent scope.
- `replays`: immutable consumed jti records.
- `artifacts`: immutable candidate/run/fence public-file inventory seal.
- `permits`: short-lived candidate/code/manifest/artifact/fence binding.
- `observations`: immutable operational evidence, including unknown/late outcomes.
- `receipts`: immutable final verified receipt and transition hash.
- `completed_intents`: exact-once correspondence to verified receipts.
- `asset_links`: immutable link from existing owner rights record to private byte object and full cover hash.

RLS is enabled on all eleven tables. PUBLIC/anon/authenticated have no schema/table access or RPC execution. The eleven new service-only public RPCs are SECURITY INVOKER with explicit search paths. Only control/attempt operational columns have UPDATE grants; all other new tables reject UPDATE/DELETE. Existing editorial records and Phase 2 history tables are unchanged.

Enqueue locks the existing Phase 2 catalog before delivery control, then attempt rows are locked in a consistent order. Lease expiry alone is not evidence that Pages never deployed: an expired lease blocks new work until reconciliation. Stale fencing and stale authorized generation reject writes/exports/permits. Duplicate decisions are not enqueued twice. A receipt retry with the identical immutable receipt is idempotent. There is no atomic transaction across Postgres and GitHub Pages; no local test claims otherwise.

`artifact.mjs` seals actual file bytes, retains a private snapshot and returns a deterministic SHA-256 of the sorted path/file-hash inventory. **The `artifact_sha256` permit field currently identifies that deterministic public-file inventory; it is not claimed to be the digest of GitHub's outer artifact ZIP.** The future upload/deploy integration must relate the sealed files to the actual GitHub artifact ID/archive attestation and verify the uploaded inventory. No artifact uploader or production permit consumer is enabled here. A deployment permit is denied until an artifact record is present and bound to the same code/manifest/candidate/fence.

## Receipts and reconciliation

The observation verifier consumes facts only from an injected independent trusted observer and issues WeakSet-tracked proofs. Runner/browser JSON cannot stand in for that proof. A `never_deployed` proof requires terminal run, no created/in-progress deployment and unchanged public manifest. Unknown delivery blocks retries. Verified-live proof requires matching run/attempt/code/candidate, successful deployment, exact manifest hash and completed canonical-route checks. Receipt times must exactly match the observer's requested/completed/observed times; they cannot be backdated to hide a delayed deployment.

The receipt recorder runs unchanged v1.1 F01 validation against the candidate's actual baseline and every transition. Normal start/verify windows remain 15/30 minutes. A late observation can only be a `timing_exception`, recorded separately and blocked for operational review; it cannot be relabeled `released_verified` or refreshed with new dates. Phase 4C must supply the real GitHub/HTTP observer, authenticated artifact facts, baseline bootstrap observation and explicit operational handling of a confirmed late public state. None is running in Phase 4B.

The first empty baseline must be explicitly established by a trusted operator with existing owner/MFA authorization and an actual observed normal/no-publication state. The bootstrap RPC is not a fabricated successful receipt or a public endpoint. It rejects nonempty/malformed initial datasets. Production bootstrap has not occurred.

## Assets and rights

`createPrivateAssetRuntime` reuses the exact Phase 2 owner/origin/MFA gate and additionally checks the active database session before inspecting or uploading bytes. No machine token is accepted as a browser owner. The owner supplies actual bytes and a precise cover/rights review; image URLs are never downloaded. Hashes are calculated from the bytes. `node-assets.mjs` reuses the entire Phase 3 `packageAssets` Sharp/MIME/dimension/full-decode/orientation/metadata/privacy pipeline without transformation.

The controlled storage adapter checks that its configured bucket exists and is private before every upload/download, uses only `sha256/{64-hex}` keys, disables upsert and compares stored bytes. No bucket is created. Existing duplicate objects are accepted only after actual-byte comparison. Rights metadata stays in the existing immutable Phase 2 record and a new cover-hash/object linkage. A failed later RPC can leave an orphan private object/record; it does not create publication authority. Cleanup requires separately reviewed reconciliation, not silent deletion.

The build-side rights RPC returns only the seven-field Phase 3 proof for covers in the current leased dataset. It does not export rights notes, session IDs, private license evidence or draft data. Node packaging uses its own temporary directory, validates the closed dataset, retrieves only controlled object hashes, reruns Phase 3 checks and returns exact public asset bytes. Private temp files are removed; rights proofs are not public bundles. Public cover attribution required by v1.1 remains public; that is distinct from private rights-review records/evidence.

Supabase Edge cannot silently pretend to run native Sharp. The Edge-facing asset runtime requires an explicitly injected trusted inspector and fails closed without one. The tested Node inspector supplies actual Sharp checks. Before production, Phase 4C must approve a supported private byte-inspection arrangement/attestation boundary for the actual Edge platform. No header-only fallback, new inspector service, credential or paid resource is introduced here.

## Node / Deno package boundary

`runtime/nyra-edge/package.mjs` is a packaging entry with no `Deno.serve`, client constructor, environment/secret read or listener. It loads the unchanged contract and Phase 2 authority plus private runtime factories. `package-layout.mjs` inventories the required private source/schema layout. The development Deno config resolves the existing installed pinned Ajv; it is not an active Supabase deployment config.

Local Node/Deno comparison verifies canonical/Unicode/byte hashes, identical schema bytes, valid dataset/materialization/receipt behavior, negative schema/JSON cases and real synthetic RSA token verification. This does not certify an unchanged file can simply be deployed to Supabase Edge: actual bundling/static schema inclusion, pinned npm resolution and the target Edge engine/permissions remain staging gates. Sharp stays Node-side. Provider callbacks in the reused owner gate remain guarded; no paid research/draft route is invoked.

## P4-B01 preview isolation

Eight new physical entries live under `/gr/signals-preview/` and `/en/signals-preview/`, preserving the three reserved demo slugs per language. Initial built HTML has `noindex,follow`, real demo markup, no canonical/hreflang/public article social metadata/JSON-LD, and no embedded public release data. Preview links and language switching remain inside the namespace; preview index.html aliases normalize there. Missing namespace slugs remain physical 404s.

Legacy `/signals/?preview=1` and known article query navigation use `location.replace` to the new namespace. With JavaScript disabled, the listing URL returns the ordinary public listing HTML, not demo HTML. Existing reserved public article URLs retain their ordinary unpublished state without JS; their query cannot change a static server response. The current actual normal build remains unpublished/noindex for all Signals URLs. In a synthetic future indexable build, public listing HTML contains only approved synthetic records and no demo content; the legacy no-JS listing still stays ordinary. No preview URL enters either sitemap.

## Current trust limitations

Service-role credentials remain the trusted private backend boundary; database RPCs do not independently verify an HTTP signature. Machine runners never receive those credentials. The injected job reader, observer, inspector and private store are trusted server dependencies, not request fields. The native Auth/PostgREST/Storage integration has NOT been certified. Exact production OIDC subject/job naming and GitHub protection configuration have NOT been observed through a production token, intentionally. The branch is not authorization to mount these factories or apply the migration.
