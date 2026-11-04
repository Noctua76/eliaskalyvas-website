# Historical operation outline — superseded by final NO-GO readiness decision

**Current status:** See `extension-20261105-final-readiness.md`. Owner reports
57/57 alignment, successful renewal and authenticated readback at 19:40:27Z.
Do not repeat Section A. This outline is not a complete executable migration
package and is NOT approved for timer/source/config/DB mutation.

**Branch-only preparation. No merge, live replacement, timer change, credential
issuance, Owner/MFA action, dispatch, launch or production change was performed.**
The current enforced deadline remains **2026-11-04T21:05:00Z**. Requested extension
is exactly **2026-11-05T21:05:00Z (23:05 Athens)**, not an automatic entitlement.

## Artifacts and reviewed boundaries

| Artifact | Raw SHA-256 |
| --- | --- |
| `ops/acceptance-bootstrap/runtime-align-29a73458.py` | `3a3bb4ad022be42e30d59ac5f80412ddcc995394974e23d9b4d3cc6b85ce03da` |
| `ops/acceptance-bootstrap/extension-20261105.mjs` | `1147b2f2b555e0a28c8b04384f1217ce639e4164896aa468cc8636f23e4dec51` |
| `ops/acceptance-bootstrap/extension-readonly-inventory.py` | `0b03fc8a5eaacd7be1557b5086f9277a92438afc35e87b3b578ccd2d8d04a277` |
| Existing PR31 helper — unchanged | `b661247f53664f1ed016528188d3f5486a7faa0b58f53beab02fbf89d84fffc9` |

Source base: `29a73458d4cd941e5ed514db56dc2c553d041bda`. Exact branch head and
required CI are recorded in PR metadata / delivery response. A future merge SHA
is unknown until an independently approved merge occurs; do not substitute a
branch SHA for real remote main. Nothing in these tools is Owner/MFA evidence.

Read `extension-20261105-dependencies.md` (full matrix and host findings),
`extension-20261105-time-references.tsv` (315 source references), and
`extension-20261105-source-delta.md` (every affected source hash).

## A. Historical alignment procedure — COMPLETED, DO NOT REPEAT

Owner-reported live facts: candidate/source 57/57; live/source 55/57; PR31 syntax
and file hash pass, preflight stops at STAGED_BYTES. No issuance was attempted.
Both mismatches match code families in the original b97 offline bundle, but exact
actual before hashes must still be checked. Approved source29 contains the
personal-repository bypass correction and exact-host Nov4 exception. Neither may
be weakened. The alignment utility contains both exact before/after SHA pins and
refuses every other value, particularly a newer reviewed extension implementation.

1. Independently review the utility at the exact PR head and its fixture tests.
   Extract that exact file on the reviewer workstation and transfer it by the
   already approved private route, outside the reviewed checkout. After separate
   permission for host preparation, place it root-owned 0600 at
   `/root/nyra-github-app/runtime-align-29a73458.py`; never overwrite a different
   existing tool. Do not merge either PR merely to obtain an operator helper.

2. The following commands are for the owner/operator AFTER that separate approval:

   ```sh
   cd /root/nyra-github-app
   printf '%s\n' '3a3bb4ad022be42e30d59ac5f80412ddcc995394974e23d9b4d3cc6b85ce03da  runtime-align-29a73458.py' | sha256sum -c -
   /usr/bin/python3 -m ast runtime-align-29a73458.py >/dev/null
   unshare --net -- /usr/bin/python3 runtime-align-29a73458.py --preflight
   ```

   Preflight checks exact host/target/old deadline, old timer, root file ownership,
   clean source29, manifests, all 57 candidate bytes, all 57 live bytes and exactly
   the known older pair. Both owner/runtime services must be inactive, live role
   containers absent, active state/lock absent, and no unmanaged Node process may
   reference the acceptance paths. Those processes can retain imported modules in
   memory; a closed file descriptor does not prove no import. The installed unit
   ExecStart/dependency graph refers to these files even while services are stopped.
   **If active/failed/uncertain, STOP; do not stop or restart services automatically.**

   Expected (not claimed as host-observed here): ALIGNMENT_REVIEW_REQUIRED,
   candidateMatches57, liveMatches55, exact two replacement pairs, actual context
   digest, no network and authorization:false. No attempt is created by preflight.

3. STOP for a distinct operational Owner approval of the exact helper SHA,
   contextSHA256 and the two replacements. Then execute once, before old expiry:

   ```sh
   : "${ALIGNMENT_CONTEXT_SHA256:?Use only the independently approved digest}"
   unshare --net -- /usr/bin/python3 /root/nyra-github-app/runtime-align-29a73458.py \
     --apply "$ALIGNMENT_CONTEXT_SHA256" --owner-approved
   ```

   The flag records no MFA authority. A durable exclusive attempt is created at
   `/root/nyra-github-app/runtime-align-29a73458-once`. Only those two existing
   modules are archived/moved and replaced with exact candidate/source29 bytes;
   no directory replacement, source checkout change, dependencies, keys, DB,
   governance, private input, launch or evidence modification. A no-clobber link
   installs each replacement, preserving original modes and original file inodes
   in private archives. Full final 57/57 comparison is mandatory. A partial pair
   remains closed and inventoried; no retry/reset/automatic rollback is supplied.

4. On RUNTIME_ALIGNED_57_OF_57_NO_AUTHORIZATION, run ONLY the already reviewed
   PR31 local preflight with the existing unique capture path:

   ```sh
   : "${CAPTURE:?Use the existing independently verified historical capture path}"
   /usr/local/bin/node /root/nyra-github-app/stage3f-github-readback.mjs --preflight "$CAPTURE"
   ```

   Do not repeat historical Administration acceptance or issue a token as part
   of alignment. Other PR31 preflight blockers remain authoritative. Its >62min
   condition closes **strictly before 2026-11-04T20:03:00Z**. At/after that bound,
   do not bypass it; token issuance needs the separately approved extension path
   or retirement/continuation decision. Any actual issuance still needs a new
   exact PR31 context and separate approval. Old credential/marker stay intact.

**Separate pre-existing 3G blocker:** source29 passes the original target validator
for this host, but its live watcher still rejects end-start >24h. Alignment fixes
3F's bytes; it does not prove 3G readiness. This branch explicitly threads validated
target identity through runtime → composition → watcher and fixes that rule for
both the already-approved Nov4 target and the proposed Nov5 target. That runtime
change requires independent code review, approved main/source rollover and a
source-compatible Administration helper. Do not forge a newer start timestamp.

## B. Contingency: exact 24h extension — separate coordinated approval required

The seven source changes in the delta table preserve a 57-file closure, with 50
bytesets unchanged. No owner/evidence private key, DB schema, grants, passwords,
governance policyVersion, ownerAuthorizationSHA, public config, workflows or ingress
is changed. New trust configuration version / source-dependent policies are
proposals, not active state. Owner process lifetime stays <=24h even if the host
has >24h remaining: this is exact-new-target-only; restart is never automatic and
still requires fresh real MFA/Owner decisions. OIDC/registration/evidence limits
remain unchanged. Old 57/57 source29 acceptance is retained as historical evidence;
new source requires new delta/full-byte verification, not relabelled old evidence.

### Required independent decisions

- Exact source/runtime delta and eventual merge/source rollover (no merge now).
- Host operational extension old→new for exact resource615221104 and target digests.
- **Distinct DB credential-validity decision** for exactly two existing LOGIN roles,
  old→new VALID UNTIL, same passwords/grants. Host lifetime alone does not approve it.
- Exact unit/helper/plan/commit-generation installation and expiry handover.
- Source-compatible PR31 profile/helper review and its new execution context.
- Later actual credential/readback, Owner/MFA, OIDC/dispatch and runtime launch
  remain their existing distinct gates; extension is none of these approvals.

### Pre-apply inventory — read-only, never a self-approved report

After separately approved transfer of the pinned inventory script (root0600):

```sh
/usr/bin/python3 /root/nyra-github-app/extension-readonly-inventory.py --collect
systemctl cat nyra-repository-expiry.timer nyra-repository-expiry.service
systemctl list-timers --all --no-pager
systemctl list-unit-files 'nyra*' --no-pager
```

The collector must run in the host network namespace; it rejects unshare --net
before making any firewall assessment. The collector does only local reads and read-only PostgreSQL SELECT/pg_dump.
It prints no Docker Env, token, password, key, Auth identity, VITE value or process
argv. It captures target digests, source/57 comparisons, immutable file/DB/schema
identity, role expiry/attributes, firewall, old timer next trigger, possible cleanup
start, inactive services/artifacts, renewal-attempt metadata and credential expiry.
Save outputs privately with umask077 and no-clobber, if approved; don't publish raw
inventory. Unsupported/missing fields STOP rather than guessed defaults.

It deliberately reports provider and all-scheduled-task review as UNVERIFIED.
An independent reviewer must verify the authenticated DigitalOcean resource/name/IP,
active status, current billing and eventual destroy responsibility; inspect all
systemd drop-ins, cron/anacron/at jobs and any provider automation for earlier
cleanup. Do not install a provider CLI/dependency as a shortcut. Bind the actual
readback and full scheduled-task evidence hashes to a separate review record:
`nyra.acceptance.extension.independent-review.v1`. Its inventoryContextSHA256 is
canonical hash of the collector record excluding only observedAt. Exact provider
identity, authenticatedReadback:true, status:active, complete scheduled-task review
and evidence hashes are mandatory, with the separately approved ownerReviewSHA256.
This is operational eligibility review, not cryptographic Owner/MFA authorization.
Never flip inventory booleans manually to imitate that review.

`--plan inventory.json review-request.json` verifies that record and returns a
sealed plan with executionApproved:false. The request contains independently
approved actual newSourceSHA, ownerReviewSHA256, dbCredentialApprovalSHA256 and
independentReview. No example real hashes are invented. The inventory must still
be <60s old and the original window must have >5min remaining at planning/commit.
A fresh capture of unchanged stable context may reuse the reviewed context binding;
changed facts require new review. Existing attempts, cleanup started, active policy,
role processes, registrations, another destructive timer or 55/57 => STOP.

```sh
/usr/local/bin/node /root/nyra-github-app/extension-20261105.mjs \
  --plan "$INVENTORY_FILE" "$REVIEW_REQUEST_FILE"
```

### One integration sequence — no independent merge/deployment

The following is a reviewed operation ordering, **not authorization or a turnkey
--apply command**. The tools intentionally do not deploy source/config/timers.
Execution remains NO-GO until actual inventories, all exact new identities, source
rollover and PR31 compatibility have been independently reviewed. No activation
claim is made from fixture success.

1. Preserve source29 alignment/captures and original input/helper/attempt/governance
   hashes. Plan one coordinated review of this runtime delta AND the PR31 pin/profile
   follow-up. Do not merge PR31 to expose its helper. An approved extension merge
   changes actual main; verify that exact SHA/CI before constructing any new source
   pins. Until an exact updated PR31 profile/reader is independently reviewed, its
   original source29 helper is incompatible and must remain closed.
2. Before any live mutation, verify again all preconditions and reserve one root0700
   `/opt/nyra-5c/private/extension-20261105-attempt` with exclusive creation, durable
   fsync and old/new plan hash. Archive exact old target/launch/owner-source configs,
   unit/drop-in bytes and source delta privately; never copy private signing keys or
   passwords into evidence. Original input, helper, provisioning marker and evidence
   remain at their existing identities, without edits.
3. Install the separately reviewed standalone expiry helper and sealed plan at
   `/usr/local/lib/nyra-extension-20261105/` (root directory not writable by others,
   helper0644, plan0600). Generate unit candidates with `renderUnits` using actual raw
   helper/plan hashes. Independently inspect the exact output. Install the NEW service
   and timer first; daemon-reload; enable/start ONLY the new expiry timer. Verify actual
   fragment/drop-ins, raw hashes, active/enabled, Persistent=yes, exact UTC calendar,
   no randomized delay and NextElapseUSecRealtime at Nov5 21:05Z. Record service/timer
   raw hashes in root0600 unit-pins.json. **Old timer stays enabled/active unchanged.**
4. Only after that proof install the reviewed old-service ExecStart drop-in produced
   by renderUnits and daemon-reload. It routes retirement independently of mutable
   checkout/config, with exact old/new digest scope. Before COMMITTED, the old deadline
   still causes cleanup. A half-replaced target or source cannot break that fallback.
   Preserve original script/service bytes. Do not disable, stop or mask the old timer.
5. Build a clean standalone candidate checkout of the exact approved actual new main
   OUTSIDE the existing checkout; use only already verified locked dependencies.
   No reset of old Git, no dependency installation, no whole-runtime replacement.
   Keep the original standalone checkout under a reviewed historical path when
   installing the new canonical source path. No shared-worktree .git links across
   moved paths. Source install is a separately approved mutation, never implied by
   this branch. Replace ONLY the seven staged files in the delta table, each with
   approved before/after hashes, private old copy and no-clobber commit; retain all
   other 50 bytes. Compare the entire 57 manifest against the new clean source.
6. Use proposeConfiguration with the new reviewed modules and actual old private
   records. It clones existing values, changes target end, identities/caller source,
   trust version/hash, proposed policyStates and owner allowed-policy/window binding;
   signer/governance/Auth/public/unknown-rights pins stay unchanged. Create a NEW
   `/opt/nyra-5c/private/stage3-extension-input.json` envelope (root0600), referencing
   original raw input digest without altering it. proposeConfiguration requires the
   actual inputFileSHA256; its previousInputCanonicalSHA256 is a separate digest.
   Receipt reviewedInputSHA256 binds the canonical NEW extension envelope, never
   relabels the historical raw file hash. Independently review all resulting
   canonical and raw hashes. Canonical target, launch and owner/source.json changes
   must be installed as one quiescent generation with original owner/modes preserved.
   Until final receipt the old router treats every partial generation as uncommitted.
7. Only under the distinct DB approval, generate dbValiditySQL from the exact sealed
   plan; review it and execute that SQL through the existing private postgres container
   connection. It transactionally checks both exact old VALID UNTIL values and safe
   LOGIN attributes, takes a scoped advisory lock and updates only those two dates.
   No DB recreation, password/key generation, grants/schema changes, row deletion or
   job/JTI expiry extension. A mismatch rolls the SQL transaction back and stops.
8. Independent post-apply proof must bind actual new target/source/launch/owner-source/
   extension-input digests, unit-pins raw hash, all 57 matches, unchanged immutable
   inventory/DB identity/schema/grants, two role expiries, absent active policy,
   inactive roles/owner, zero active registrations and compatible public collector.
   Confirm old enforcement is still armed and new timer's actual next trigger is
   correct. Check no cleanup has started. Never assert these booleans without reads.
9. Before original expiry minus5min, create the commitReceipt from the sealed plan
   and independently verified proof. Write it ONCE, root0600/O_EXCL, fsync file and
   parent at `/etc/nyra-acceptance/extension-20261105.json`. Duplicate commit/request
   or an existing attempt is not a retry. The new launcher requires exact committed
   target/source/launch pins. **This receipt grants no runtime or Owner/MFA authority.**
10. Re-read all hashes/units/statuses and evaluate expiryDecision against actual
    observations. At old expiry it defers only for a coherent committed generation
    with the verified new fixed timer; otherwise it retires both exact generations.
    After a reboot, Persistent fixed-date triggers catch up. At/after the new deadline
    it retires unconditionally within the two reviewed digest scopes, never renews.
    All old/new containers are handled BEFORE either network, preserving immutable
    DB labels without re-creation. Provider destruction/billing remains separate.

Useful verification commands (read-only; supply only actual reviewed plan paths):

```sh
systemctl is-active nyra-repository-expiry.timer nyra-repository-extension-expiry.timer
systemctl is-enabled nyra-repository-extension-expiry.timer
systemctl show nyra-repository-extension-expiry.timer \
  -p Persistent -p TimersCalendar -p NextElapseUSecRealtime -p FragmentPath -p DropInPaths
systemctl cat nyra-repository-extension-expiry.service
/usr/local/bin/node /usr/local/lib/nyra-extension-20261105/extension-20261105.mjs \
  --decision "$SEALED_PLAN_FILE" "$COMMIT_FILE" "$OBSERVATION_FILE"
```

The units / reboot catch-up / partial migration have fixture-level verification
only in this branch. Actual installed enforceability, reboot behavior, provider
identity, billing, active imports and file hashes are live prerequisites, not
results silently claimed from source review. Do not perform a real reboot merely
for this proposal; separately approve any live restart/reboot test if needed.

## Recovery, trust and final retirement

Partial or uncertain migration: STOP, keep services/authority inactive and original
deadline effective, preserve attempt inventory. No automatic continuation, reset,
key regeneration or broad cleanup. Recovery is a new exact-file/DB/unit plan with
separate approval. Old files may be restored only before old expiry and after
proving all old-generation pins/role validity/enforcement; never unconditionally
roll back to a window that expired. If cleanup began there is no resource
preservation guarantee. An uncommitted migration retires at the old deadline.

Old token local/issuer expiry, historical captures, Owner session/decision TTLs,
OIDC run/challenge/audience/JTI context, 300s registration leases, SQL10min bounds,
45s receipts and <60s evidence freshness remain independent. No existing signed
record is edited or treated as fresh. Old trust decisions cannot authorize the
new trust/source generation. Real new Owner/MFA, Administration and protected
OIDC evidence remain required; proposed policy states are never activated here.

Inventory the exact root-private PR31 attempt directories, alignment attempt,
extension attempt, original App RSA key and pending credential files by metadata
only. Existing retirement does not sanitize all of them. Keep these outside all
exportable evidence. After retaining only explicitly permitted sanitized signed
evidence, obtain/execute the existing separately approved exact-file private-secret
retirement and provider-destroy procedure. Never export raw captures, credentials,
private keys, source-config archives or private attempts to another host. Unlabelled
DB-mounted volumes require exact-ID inventory/manual review; no broad Docker prune.
Verify resource absence and actual DigitalOcean destruction/billing termination.
Do not claim that local cleanup destroys the Droplet or guarantees billing stop.

If safe completion before the original deadline cannot be demonstrated: **NO-GO**;
keep the approved retirement mechanism. A replacement/window needs independent
approval, fresh input/trust/context hashes and permitted evidence transfer only;
no automatic host replacement, key/expired-token transfer or approval carryover.

## Decision and residual risk

GO for independent branch review after focused tests and required CI pass. Current
execution remains NO-GO pending exact actual preflight/context and separate Owner
approval. Alignment may unblock source29 Stage3F without an extension; Stage3G's
existing watcher issue and all live trust gates remain explicit. Extension also
requires the coordinated PR31 follow-up and actual new-main/source review.

Modelled enforceability is not a live-host guarantee. Partial replacement spans
multiple files and DB/systemd boundaries; authority stays closed until the final
receipt, old expiry still wins on failure. Userland cannot exclude concurrent root
administration: keep one operator and stop on any mismatch. Timer/router/manifest
corruption or missing Docker requires independent retirement intervention; never
turn such an error into authority or automatic renewal.
