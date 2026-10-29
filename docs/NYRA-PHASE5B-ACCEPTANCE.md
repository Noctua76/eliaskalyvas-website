# Phase 5B — native Edge inspector and resource acceptance

Baseline: `2504091fc1dcd4bcb70ad65bd8ee3e833362e31f`. This branch contains only
isolated acceptance harnesses, a test-only workflow and this report. No production
source, migrations, Contract v1.1, owner/MFA logic or Pages workflow is changed.
The final exact-head run, counts and detailed matrix are recorded in the Draft PR;
commands or planned assertions below are not an unconditional PASS claim.

## Inspector decision and native reproduction

The existing intended byte inspector is `inspectApprovedBytes()` in
`lib/publication/runtime/node-assets.mjs`, using `packageAssets()` in
`lib/signals/assets.mjs` and pinned Sharp 0.34.5. The Edge-facing
`createPrivateAssetRuntime()` deliberately requires an injected trusted inspector
and fails closed if absent. There is no approved native Edge decoder hidden in
that factory. The Phase 5A Node/Sharp result is not native Edge evidence.

Current primary documentation explicitly excludes native Sharp/libvips:
- https://supabase.com/docs/guides/functions/limits
- https://supabase.com/docs/guides/functions/examples/image-manipulation
- https://supabase.com/docs/guides/functions/wasm

The native probe vendors the exact root npm-ci Sharp JavaScript and actual linux
N-API/libvips packages, plus all direct dependencies, without esbuild replacement
or arbitrary download inside the sealed network. It dynamically imports that
real module in the pinned user worker, then attempts actual PNG/JPEG/WebP full
pixel decoding if import succeeds. Test images are generated locally by Sharp
only to create fixtures; this generation is not counted as inspection evidence.
Raw diagnostics must distinguish actual native incompatibility from missing
package/fixture/static-file evidence. The latter is a harness failure, not proof
of unsupported Sharp. No WASM/header-only fallback is substituted.

If native initialization fails, native image acceptance is **FAIL**, and decode,
MIME/extension, dimensions/pixels, file/decompression limits, corruption/truncation,
unsupported formats, metadata and hash controls are individually NOT VERIFIED in
Edge. The job stays red and still uploads all resource evidence. This is the
pre-existing explicitly deferred platform/design dependency, not a newly fixed
production-code defect. Actual private Storage and owner/session/rights behavior
from Phase 5A remains accepted at its original Node/private-runtime boundary; it
must not be relabeled as a working native Edge image pipeline.

## Resource test budgets and evidence

Uses the **same digest-pinned** Phase 5A Edge v1.77.4, curl and Node driver images.
Standard GitHub-hosted Ubuntu only, contents:read only, no production environment,
credentials, DB connection or dispatch. Images are acquired before creating an
internal network. Host INPUT and external forwarding from its bridge are blocked;
metadata/external/host egress probes must fail. No port is published. Cleanup only
removes this run's named containers/network/firewall rules and temporary files.

| Probe | Explicit bound | Required evidence |
| --- | --- | --- |
| Memory | 64 MiB worker; at most 16 touched 8 MiB arrays (128 MiB total) | Native Shutdown Memory, controlled HTTP error, healthy new worker, daemon not OOM-killed |
| CPU | soft 250 ms / hard 500 ms; computation bounded at 2.5 s; wall 3 s | Native Shutdown CPUTime, controlled HTTP error, recovery |
| Wall clock | 1 s worker; async wait 5 s | Native Shutdown WallClockTime, bounded client error, recovery |
| Execution deadline | 400 ms gateway response deadline; worker wall 3 s | HTTP 504 with fixed JSON; measured latency; distinct from native/provider idle timeout |
| Crash | One deliberate synthetic exception | Fixed HTTP 503, no client stack/private sentinel, fresh worker |
| Payload | Incrementally read at most 64 KiB + one received chunk | 65,537 bytes denied 413, including chunked/no-length input; nonempty smaller body denied 400 |
| Concurrency | 8 requests / one worker, 150 ms async overlap | Same native instance UUID, observed overlap, all successful |
| Network input | No caller-selected URL/path/options/body relay | URL/body/query selectors denied; native metadata/external egress blocked |
| Factory isolation | Actual unchanged default-disabled factory | HTTP 503 PUBLICATION_DISABLED and zero private calls |
| Inspector absent | Actual unchanged private asset factory | ASSET_INSPECTOR_REQUIRED before any DB/storage call |

The outer disposable Edge container is capped at 768 MiB, 2 CPUs, 256 MiB tmpfs;
user workers receive no environment variables. Resource probes are independent
from production handlers, and do not receive private records or credentials. A
synthetic main-worker canary must not be visible in user-worker responses. Native
shutdown events are collected with the pinned runtime's supported EventManager,
correlated by exact service path. HTTP 503 alone is never treated as proof that a
specific resource limit fired. Whole-container OOM/exit is infrastructure failure.

The pinned per-worker supervisor arms its timer with the soft threshold and the
hard interval (`strategy_per_worker.rs`, timer.reset(soft, hard)); a continuously
busy loop can therefore receive its terminating second alarm around 250+500 ms.
Do not describe the configured hard=500 value as a demonstrated strict 500 ms
aggregate cap. The report includes actual cpu_time_used and elapsed time. Memory
sampling/callbacks can similarly overshoot 64 MiB by an allocation chunk; retain
the measured total/external/heap values and do not claim an exact byte ceiling.
Reference: https://github.com/supabase/edge-runtime/blob/v1.77.4/crates/base/src/worker/supervisor/strategy_per_worker.rs

These budgets demonstrate pinned **local native runtime mechanics**, not actual
hosted production plan/hardware limits or a production upload admission boundary.
The 64 KiB gateway is test-only; no production endpoint gained a body limiter.
The 400 ms deadline is not proof of the hosted 150 s idle timeout. Absence of
partial private writes is structurally assured for disabled/no-credential probes,
but an **authorized publication transaction interrupted inside Edge** remains
NOT VERIFIED. Phase 5A native SQL rollback/idempotency evidence is preserved and
is not substituted for that future end-to-end case.

## Smallest supported architecture for external approval

If the pinned Sharp import fails, keep Sharp in the existing private Node/build
worker and reuse its full byte/hash/MIME/extension/size/pixel/decode/orientation/
metadata checks. Supabase also documents magick-wasm, but choosing a new decoder
requires a separate equivalence/resource/security review; this branch does not
silently replace the approved inspector or install a production dependency.

A Node/build result must be bound to exact bytes and accepted only through a
server-authenticated private job/result boundary. Proposed private inspection
record binds asset SHA-256 and byte length, cover/presentation hash, actual MIME,
extension, dimensions, full-decode/metadata result, inspector version and code SHA,
owner identity and immutable rights-decision ID, plus server-issued one-use nonce,
expiry and registered job identity. The server verifies trusted job/OIDC identity
and exact current pending record, never a browser-uploaded attestation/flag. Hash
binding is necessary but alone is not authorization. No private proof belongs in
the public v1.1 release payload.

Untrusted upload bytes would need bounded private quarantine before inspection;
only an exact successful trusted result could make the asset eligible for the
existing human approval. Current asset runtime inspects **before** storage, so
this asynchronous arrangement needs separately approved private runtime/record
changes; it is not implemented here. Owner/MFA and exact rights review remain
mandatory. No extra human editorial approval, new paid service, machine secret,
public bucket, publication or Contract v1.1 change is proposed as automatic scope.
An owned editorial template can be pre-inspected at this same trusted boundary.
A rights confirmation record is not independent legal proof of a license.

## Execution and regression

The dedicated PR workflow runs:

```sh
npm ci
NYRA_EDGE_CI=1 NYRA_TEST_SHA=<exact-checked-out-head> node ops/edge-acceptance/run.mjs
npm test
npm run build
```

Native assertions run inside the pinned unprivileged Node 22 driver container.
Results: `native-results/phase5b.json`, `edge-cases.json`, `edge-native.log`.
Always inspect FAIL vs NOT VERIFIED, expected platform incompatibility vs harness
failure, and the final exact-head workflow. The separate regression job scans all
115 normal production files for witness/private/runtime/test markers. No fixture
is wired into Vite or the public website. This workflow never uploads a Pages
artifact or invokes a publication endpoint.

STOP for external review. No merge, deployment, production migration, Edge route,
bucket, credential/protection change, publication dispatch or OpenAI API request.
