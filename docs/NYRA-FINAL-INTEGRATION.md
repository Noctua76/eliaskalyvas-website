# NYRA final integration — branch-only executable delivery

Baseline main: `f1c19ac79cffcef8982114bf01c924ae756f7f23`.
Single focused Draft PR. **NO production activation, migrations applied, Edge
replacement, workflow installation, dispatch, article publication or OpenAI call.**
The FRA1 pilot is destroyed; none of its IP/DNS/keys/deadlines is reused.

## What now connects

1. `composeEditorialPublication` combines the existing persistent workspace,
   quarantined image intake and inspection-aware publication authority. Its default
   is disabled; `supabase/functions/nyra-api/index.ts` still mounts workspace only.
   The existing production version6/project status supplied by the owner is not
   represented as a new deployment or independent audit in this PR.
2. An explicit private owner edit forks the selected latest persisted draft with
   exact run/presentation revision checks. Original work and approvals remain
   immutable. The fork clears automatic review and rights confirmation, enters
   review and does **not** call AI. A later explicit Continue uses the existing
   paid review workflow; edits cannot inherit old approval. No new AI feature.
3. The Admin panel appears only when the authenticated server advertises the
   preparation capability. Text/metadata/locale/image selections invalidate the
   old preview. The server, not the browser, assembles and seals the exact release.
   One final action uses the established preview/request-id owner/MFA contract.
   It records `authorized_held`, never declares public success from an HTTP ack.
4. Browser image bytes enter private quarantine after exact owner/AAL2/origin gates.
   Controlled URL/hash/MIME/dimensions are bound to immutable rights and persisted
   presentation. Browser metadata is only a hint: existing Node/Sharp inspection,
   private accepted storage and immutable receipt remain mandatory. Rights-only
   legacy assets never become eligible. No arbitrary image URL fetch/SSRF is added.
5. Accepted image preview is fetched with bearer/MFA over a private no-store route,
   checked again by SHA256 in the browser, and rendered from a temporary blob URL.
   An unpublished controlled public URL is not falsely shown as a working image.
   Object URLs are revoked; stale asynchronous previews cannot replace another work.
6. A new additive inspection queue RPC selects current-code ready/expired-lease
   operations server-side. A separate durable nudge records claim **before** dispatch;
   unknown outcome is not automatically resent. Existing claim/challenge/lease,
   ownership/session, receipt, failure and version-rollover checks still apply.
   The protected Node client receives image bytes only, never DB/owner credentials.
7. `composeFinalDelivery` derives exact policies from the reviewed trusted integration
   configuration, composes the existing protected OIDC verifiers, private inspection,
   materialization, artifact provenance, independent observer, receipt, outbox and
   reconciliation services. Administrative/owner-risk assertion must return true;
   an absent/false/inaccessible gate denies before SQL/dispatch. Publication and
   inspection use distinct registered roles and Environments. Every call obtains a
   fresh job token; replay/revocation/policy guard behavior is unchanged.
8. `createIntegrationWatcher` independently observes only current in-progress
   orchestrator jobs, delegates registration to the approved registrar (which
   re-reads every job/check/workflow/protection fact), revokes terminal runs and
   retires all three policy hashes on error/shutdown. Retries/wrong code/ambiguous
   API results fail closed; it never dispatches or approves editorial content.
9. Worker entry points `nudgeInspectionOnce`, `nudgeOnce`, `reconcilePending` are
   internal/default-disabled. After separately approved installation, an operator
   service invokes them; the owner does not need a second Publish confirmation.
   Inspection can trigger a serialized protected rebuild before any new publication
   decision; that rebuild exports only the existing authorized server state.

## Private routes / authority

| Route below nyra-api | Meaning / mandatory checks |
| --- | --- |
| POST /work/:id/edit | Owner private fork; enabled only in opt-in composition; latest version/run/revision; sources/evidence validated; no inherited approval |
| POST /publication/catalog | Existing owner actor/session SQL gate; inspected owned assets, associated history, verified rollback eligibility, receipt status and manifests only; no tickets/private credential |
| POST /publication/upload | Owner/MFA before reading bounded multipart data; exact file+metadata fields; immutable quarantine intake; asset_id remains null until inspection |
| POST /publication/asset | Owner actor/context; inspected owned asset only; content-hash read-back; no-store binary; no public URL/token query |
| POST /publication/identity | Reserve stable language identity only; no publication decision |
| POST /publication/preview | Existing authority with inspection eligibility; exact release + approval hash; source work/version snapshot |
| POST /publication/authorize | Fresh trusted readiness before authority and again at commit; existing owner/MFA/session; exact preview; idempotent request; queued held intent only |
| Private machine inspection/next | Registered inspection OIDC; empty body; server chooses operation, no caller rights/payload/Environment selector |
| Private machine delivery/* | Existing exact publication OIDC, materialization, archive/permit/one-shot dispatch and independent observation |

No privileged route is mounted by importing a factory. `enabled` is an operator
installation control, **not** trusted acceptance evidence. Real readiness must
come from the existing independently authenticated administration/owner-risk source,
accepted live OIDC/job/provenance evidence and active reviewed policy. This PR
installs no accepted configuration or signer and supplies no fallback approval.

## Language and lifecycle operator use after separate activation

Edit/save the chosen language; explicitly complete its fresh automatic review.
Save presentation and rights metadata; upload the licensed/owned image. The private
inspection worker runs automatically from its approved nudge/poller. Refresh the
inspected assets, choose metadata, request exact preview and take one final owner
action. Independent observer/receipt determines public success. A lost response
uses the same request ID; unknown deployments reconcile, never blindly redeploy.

GR and EN have separate work/identity/preview/approval/receipts. For linked variants,
reserve both identities before approval, then approve the counterpart relationship
in each version. Dormant relations are not public navigation. Linking a newly
introduced language to an already approved GR release may require an explicit GR
replacement for its changed relationship; it never silently edits that approval.
Withdrawal/rollback select only associated article history. They cannot change a
counterpart's approval or invent a target that was never verified live.

Normal source rebuilds use the authoritative verified baseline plus pending owner
intents; zero pending intents retain existing releases byte/content identity.
A code rollback is a new reviewed main SHA and policy/inventory rollover, not
permission to run an old job against advanced main. The current normal Pages
workflow is untouched. Only after independent acceptance may the serialized
orchestrator **replace** it; never run both deployment authorities concurrently.

## Inactive workflow integration and exact identity compatibility

The old v1 protected policy pins `nyra-protected-caller` and dispatch-only events.
It cannot authorize the new Pages orchestrator/normal push. The new explicit
`nyra.protected.integration.v1` constructor pins:

- Caller `.github/workflows/pages-orchestrator.yml@refs/heads/main` and exact caller SHA.
- Build `build-inventory / trusted-build`, Environment nyra-build.
- Inspection `inspection / trusted-inspection`, Environment nyra-inspection.
- Delivery `delivery / protected`, Environment nyra-publication (ordinary Pages is
  not Nyra authority); Pages API deployment target remains github-pages.
- Exact immutable subjects, owner/repository numeric IDs, reusable SHA/ref per role,
  audiences and both explicitly accepted trigger contexts push/workflow_dispatch.

Old and new policy versions reject each other's configurations; no automatic
migration/event widening. Real acceptance of the actual run.referenced_workflows,
job names, subject claims and Pages token compatibility must precede production
policy provisioning. Unit fixture `genuineProtectedOIDC` flags are not real evidence.
No accepted JSON file is committed. Templates retain REVIEW_REQUIRED_IMMUTABLE_SHA
for reviewed replacements and cannot be installed as runnable files unchanged.
Both Pages build templates install the locked private runtime before full tests,
preserving PR21. Observation runs even after an uncertain earlier step; it can
reconcile only, not redeploy. Main protection/required App15368 CI stay mandatory.

## Migration / packaging

`20261031221433_nyra_final_inspection_queue.sql` was created with the Supabase CLI
migration-new command; it is **not applied to the connected project**. It adds one
private forced-RLS dispatch table and three invoker-only RPCs, revoked from PUBLIC,
anon and authenticated, granted only to the existing service_role. Historical
migrations, v1.1 contract schema bytes and production storage grants are unchanged.
The required four previously accepted publication migrations must be separately
approved/applied before this additive queue migration; editorial migrations alone
cannot run the publication composition. Private Edge staging now includes the
full opt-in factory import closure, without a listener, env load or credential.

## Executable acceptance and limitations

Commands from the branch, no production secrets:

```sh
npm ci
npm ci --ignore-scripts --prefix ops/acceptance-bootstrap/runtime
node --test test/final-*.test.mjs test/inspection.test.mjs test/phase4c-dispatch.test.mjs
npm test
npm run build
```

General CI executes the complete suite and normal public-isolation gate at the
PR test-merge. Native trust CI also executes a narrow native PostgreSQL queue SQL
harness in its existing disposable image/network. That harness uses parent-column
fixtures and rolls back; it is NOT full Auth/OIDC acceptance. Full owner/schema/
image HTTP flow uses disposable PGlite plus actual Sharp and private-storage/identity
fixtures. Existing native trust/replay/process isolation is retained. No new paid
server, live migration, real Auth session or protected job is used by these tests.

New cases cover manual editing/invalidated review, old version/unverified citation,
owner/AAL2/session denial, rights-only image denial, quarantine/Sharp/byte preview,
held approval with stale/replay/false-trust denial, independent GR/EN replace/
withdraw/rollback, unknown image dispatch/no resend, RPC ACL/RLS, actual HTTP image
client and lost completion response, strict old/new policy separation and delayed
UI preview after work switching. Existing tests cover exact static HTML/citations/
metadata, public artifact sealing, receipts, late/unknown outcomes, recovery and
normal non-Signals routes. Real public delivery and real-provider writing remain
separate acceptance gates, not inferred from fixtures or successful CI.

## Readiness matrix

| Boundary | Branch implementation / tests | External acceptance / owner action |
| --- | --- | --- |
| Persistent draft -> exact editable preview | Implemented; owner fork + private image + sealed existing authority | Review/approve opt-in route mount; live workspace remains version6 unchanged |
| Owner/MFA / same-version / GR-EN | Existing gates reused; negative, idempotency and independent lifecycle tests | Fresh real owner/MFA and controlled synthetic-content lifecycle later; no second editorial approver |
| Image provenance/rights/bytes | Private queue, immutable rights/receipt, actual Sharp, authenticated preview | Approve private buckets, machine/runtime identity and Node worker installation; no production bucket provisioned |
| Protected delivery / inventory / observer | Existing modules composed; normal-push strict policy template and negative tests | Real 5C accepted subjects/run/job/check/API representation, isolated registrar/broker and protected normal-build provenance still NOT VERIFIED |
| Complete App inventory | Existing verifier unchanged; concrete feasibility/alternative proposal below | Approved independent capture source or explicit external approval of alternative; no server purchase before resolution |
| GitHub settings / Pages separation | Main baseline checked protected; active Pages unchanged; inert replacement templates only | Exact approved Environments/Apps/privileges/SHAs and replacement deployment authority; no setting changes now |
| Migrations / services / recovery | Additive SQL fixture tests and native queue harness; disabled composition/poller entry points | Approve/apply four pending migrations plus additive queue migration, private services, credentials and read-back; real interrupted-run acceptance |
| Home/booking/legal/Signals/public build | Full regression + build/isolation; no public-site layout/content change | Normal deployment only after independent merge approval; no publication witness is expected now |
| OpenAI-dependent writing | No new AI function; no real provider call; existing workflow mocked in tests | Real research/draft/review/provider-cost tests need owner-approved API credits; publication lifecycle tests do not |

Verdict: branch-only integration prepared for independent review; **production is
NOT READY / NOT AUTHORIZED** until the external gates pass. Do not claim Phase5C
or real Phase5D closure from local/native fixtures. Source findings/CI evidence
and exact head/tree are supplied in the Draft PR delivery report.
