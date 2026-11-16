# Controlled G08/G09 operator continuation

Additional automation only; accepted PR #36 head `225b1bc946b5626e9105f24afd644467852a91af` is unchanged. No native renewal, Owner Source, repository trust or governance module is modified by this automation change.

The distribution includes the exact v14 operator baseline, a complete outer integrity manifest and the files in this directory. Script files use UTF-8 BOM for native Windows PowerShell 5.1 Greek prompts. Secrets are read as SecureString, held only in memory, passed through SSH stdin and cleared; the same authenticated session is used for preflight/G07/G08. Approval acknowledgments are exact-scope local operator receipts, not cryptographic Owner signatures or substitutes for backend AAL2.

## First command, safe now

```powershell
.\Start-NyraAcceptance.ps1 -Mode Prepare
```

This verifies the complete package and reads PR #36/main through GitHub GET APIs. Until the separately approved merge actually exists, it produces the concrete merge-review scope and stops without SSH, credential issuance or protected work. The actual merge SHA is unknown before merge and is never guessed from the temporary PR merge ref.

## Controlled source release

The Implementation Agent executes these existing repository operations only after exact Owner merge approval:

1. Re-read PR #36 open/draft/unmerged, exact base `8b82cc964bdbc1919caf91c2669ca154204c025d`, head `225b1bc946b5626e9105f24afd644467852a91af`, tree `8fdac1689db7d0d2172481c4eb446bb20be18962`, successful required run `43841314749` and protected synthetic run `43841315084`. Stop on drift; no redundant rerun.
2. GET `actions/workflows/pages.yml`, retain original state. If active, PUT its `/disable`, independently GET and require `disabled_manually` before merge. If it cannot be disabled, STOP. Never change other workflows.
3. Mark Draft ready only if needed. Merge via protected repository procedure with `merge_method=merge` and exact expected SHA `225b1bc946b5626e9105f24afd644467852a91af`. No force, bypass, squash or rebase.
4. Capture actual main/merge SHA, exact expected tree and parents `[8b82cc964bdbc1919caf91c2669ca154204c025d,225b1bc946b5626e9105f24afd644467852a91af]`. Re-read merged PR and main independently.
5. Restore only pages.yml's original enabled/disabled state without dispatch, including on failure. Verify Pages workflow runs/deployment history: no deployment for the merge/procedure. Restore failure is a release STOP, never silently ignored.

No part of this package grants that merge approval. The script intentionally does not obtain a GitHub write token or merge on the operator's behalf.

After approved merge, the same Prepare command generates an immutable, separate bound-release directory with exact alignment, TLS carry-forward, updated execution policy/helper hashes and four-hour preparation scope. It performs no SSH. The directory is not overwritten on repeats. The original historical v14 runner/policy/scope/receipts remain in the baseline package. Changed code has new reviewed pins, never historic approval reuse.

## One-command interactive continuation after external review

```powershell
.\Start-NyraAcceptance.ps1 -Mode Continue
```

The process pauses for exact `APPROVE <KIND> <SHA256>` decisions at package review, inactive alignment, TLS carry-forward, necessary Administration/draft preparation, G07, G08, acceptance-only activation and one-shot dispatch reservation. Each scope file/hash is displayed for review. Do not type approval until the required independent acceptance exists. There is no approve-all option. Continue never merges or mutates the provider.

The inactive alignment adapts the existing locked PR35 mechanism to the exact PR36 merge, replaces only the two changed staged native modules, verifies all 64 runtime files and preserves all private configuration, signed journals, keys, target, labels, services and retirement timer. It does not install configuration. Configuration rollover remains inside the separately approved existing G07 mechanism.

TLS verification chains through the original PR35 verifier and original source `2779edc75c13b66246957b9ca0aa996d764901bc`; it checks exact permitted source changes and both runtime hashes. Original receipt/Caddy material is not rewritten, DNS/HTTPS tests are not repeated. Later acceptance-only activation still runs its existing trusted ingress check as an actual runtime readiness gate.

The existing preparation code inspects Administration before issuing anything, replaces only actually expired credentials, issues at most once and fails closed for a still-valid credential with less than 35 minutes remaining. It creates the new source-bound unsigned session/drafts only when the changed source/expired state requires them. It preserves historical G05/G06/G07 PASS. No installation or role renewal is authorized by the four-hour preparation scope. All protected time/issuance thresholds remain unchanged.

Before bearer input, the exact instruction is displayed: **«Κάνε τώρα Ctrl + R στη σελίδα Owner και πάρε νέο AAL2 bearer.»** Never paste it in ChatGPT. Before timer activation, after readiness and separate G07 approval, the process displays **«ΠΡΟΣΟΧΗ — ΕΝΕΡΓΟΠΟΙΗΣΗ ΠΡΟΣΤΑΤΕΥΜΕΝΟΥ 15ΛΕΠΤΟΥ»**.

Preflight checks source/runtime/policy/configuration bindings, retirement timer, >35-minute Administration, >30-minute unused bounded session, backend AAL2/token margin, signed journal integrity, absence of staged credentials, PG17/SCRAM/role isolation/credential metadata, locks, inactive services and concrete G07 draft/scope binding. It runs again after the approval pause. Concrete G08 scopes cannot exist before the real signed G07 decision; the checked native mechanism emits them after G07 and the orchestrator verifies them before separate approval.

G07 and G08 share the securely held bearer; no extra bearer entry or internal command coordination is required within the process. G08 executes once immediately after its approval, targeting <=120 seconds from successful G07. Actual native source still enforces >600 seconds on the original signed decision at DB commit, 45-second receipt, 180-second timeout and exclusive native locks. A matching reused lease is not falsely reported as a new successful renewal. Uncertain/failed commit blocks G09.

G09 maps exactly to `ActivateDiscovery` → `ReserveDiscoveryDispatch` → `VerifyDiscovery` → operation-owned `CloseDiscovery`. The accepted policy explicitly says **Owner GitHub UI only; no new write token**. Consequently one Owner Run workflow click on main (and required environment approvals) remains mandatory; the orchestrator then performs bounded read-only verification automatically. It does not silently replace the dispatch mechanism. Live run/head/attempt/jobs/checks, three signed observations, operation-bound signed Owner decision and broker-signed zero-active proof are required. Synthetic CI cannot satisfy the native G09 PASS.

## Resume and uncertainty

Local state reserves every mutating/protected call durably before invoking it. Any interrupted or failed call is not replayed. A stopped process can resume safely before any attempted protected call; an outstanding reservation requires read-only native reconciliation and independent recovery review. Successful phase transitions and original evidence are retained. The process does not reinstall an old OWNER_AUTHORIZED cycle, reset locks or duplicate a renewal. Expired generated scopes stop; new preparation requires a new separately reviewed bounded successor, never overwriting the predecessor.

The single process can remain at a genuine approval prompt without rerunning commands. The decision/session/native margins are checked after approval; time spent waiting is not added to the protected window. Verification polling performs only reads and ends at the original timer deadline. G10 remains an independent acceptance gate after native G08/G09 proof and cleanup.

## Verification boundaries

`test/operator.test.ps1` runs the production module with isolated synthetic adapters and verifies positive sequencing, exact scopes, failed readiness/approval, no repeated protected calls, uncertain G07/G08, committed-vs-reused leases and rejection of synthetic G09. `test/v14-report.test.ps1` preserves the 25 accepted diagnostic negative cases. CI explicitly uses `shell: powershell` on Windows and asserts Desktop 5.1, plus a separate PowerShell 7 job. No tests contact the acceptance host, issue credentials or invoke protected OIDC.

The draft package is preparation, not live G08/G09 evidence. Missing merge, alignment, authorization or actual receipts must remain STOP/PENDING in the milestone register.
