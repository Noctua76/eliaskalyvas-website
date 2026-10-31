# Five-minute complete account inventory — feasibility / one alternative

**No trust rule is relaxed by this PR.** The current signed verifier still requires
complete authenticated coverage of all five families, zero unknown entries and
freshness under five minutes. No approval record, signing key or paid host is
created. This proposal requires explicit independent external and owner approval
before any implementation/policy change or new acceptance infrastructure.

## Concrete owner-authenticated capture mechanism

Use the owner's existing computer, a fresh owner-controlled GitHub browser session
and a separately approved local audit/capture process. The owner signs in manually;
no password/cookie/token is sent to the agent or acceptance host. A capture process
controlled independently of the delivery runner records metadata from GitHub's
authenticated Settings list **and detail** responses/DOM, all pages/pagination and
owner numeric identity. It combines those account surfaces with narrowly scoped
read-only repository administration/API reads. Required surfaces:

- Settings/Applications: Installed GitHub Apps, Authorized GitHub Apps and
  Authorized OAuth Apps, every grant/detail page and selected/all repository scope.
- Settings/Developer settings: classic and fine-grained PAT inventories and
  permission/resource/expiry metadata (never the token values).
- Repository settings: Apps/integrations, actual permissions/coverage, collaborators,
  deploy keys and other outstanding write paths, including relevant webhooks.

The audit observedAt must represent the **oldest relied-on source observation**,
not a renewed signature timestamp. Re-signing stale metadata is not fresh capture.
The independent capture authority, not the owner typing JSON and not a repository
PAT, correlates actual App/installation IDs, owner/repository numeric IDs, scopes,
current repository inclusion/exclusion and effective permissions. It sanitizes
cookies,bearers,forms and secrets **before persistence**, retains private source
metadata/capture hashes, and emits the existing signed integration-audit envelope.
Use a separately approved non-runner signing key with public-key identity pinned
outside both delivery host and workflow. Signing a screenshot or a manually
asserted completeness field is insufficient. This is capture-source attestation,
not a GitHub-signed account export or an additional editorial approver.

This can be executed without purchasing a server, but the tool/session method,
metadata extraction, coverage validation and signer still need explicit approval
and a real observed trial. GitHub UI changes, hidden permissions, missing pages,
insufficient token visibility or unresolved integrations must produce incomplete
coverage. No such capture or independent key has been provisioned here.

## Why the current five-minute requirement is not yet feasible as accepted proof

Official GitHub docs checked for this implementation:
https://docs.github.com/en/apps/oauth-apps/using-oauth-apps/reviewing-your-authorized-oauth-apps
https://docs.github.com/en/rest/apps/oauth-applications
https://docs.github.com/en/rest/apps/installations

The supported owner account review surface includes Settings/Authorized OAuth
Apps. OAuth token inspection needs that application's client ID/secret plus an
already-known token; it is not a universal account discovery API. Installation
APIs expose their authenticated App/installation context, not all OAuth/PAT rights.
No complete GitHub-signed export or single account-wide API was established.
A repository PAT and the development Connector cannot prove universal completeness.
Do not request third-party client secrets or expand Codex Administration access.

A small account may be captured within five minutes in a trial; continuous complete
refresh within that deadline has **not** been demonstrated. Manual screenshots
cannot establish it. Installing automation would first require approved tooling,
safe extraction and an actual authenticated completeness check. Therefore the
current rule remains BLOCKED, not an invented PASS or a reason to buy a new host.

## One narrowly scoped alternative — BOUNDED_ACCEPTANCE_WINDOW (proposal only)

If a genuine trial cannot sustain five-minute account-wide refresh, request explicit
approval for **a single supervised acceptance window**, not a general production
trust downgrade:

1. Independently capture the complete account inventory immediately before the
   window, with real permission detail, zero unresolved integrations and a signed
   digest. Require it to be no older than15 minutes at window opening.
2. Limit one controlled discovery/provenance acceptance session to15 minutes; require
   a new full signed capture for any renewed window. The oldest accepted account
   observation could be up to30 minutes old at closure; this is an explicit risk,
   not equivalent to the current five-minute rule. Do not silently extend it.
3. Keep fresh (<60s) repository administration/Environment/check/App-specific
   read-back on every privileged operation and fresh challenge-bound genuine owner
   AAL2 risk receipts. Require owner acknowledgement of Codex/VSCode/GCM residual
   write/merge/workflow power. Do not claim exclusive technical GitHub authority.
4. Freeze the exact externally reviewed code, caller/reusable workflow SHA, subjects,
   governance mode/version and normal-build configuration digest for the window.
   An unexpected main move, installation/permission change, failed read, unknown job,
   token replay or revoked decision retires registrations/capabilities and stops.
5. Operator actively supervises account/installation changes; a detected change or
   visibility gap cancels the window. Capture a second complete account snapshot
   at closure and compare. A difference invalidates acceptance pending investigation;
   a matching final digest does not prove that no transient change occurred.
6. Keep all original crypto, job/check correlation, isolated process/IPC, image,
   byte-inventory, independent observation and owner editorial controls. No real
   article or production publication is permitted in this acceptance window.

**Threat model:** a write-capable integration could change workflow/repository state
or its permissions between account captures, including a transient change absent
from both snapshots. Fresh repository checks and immutable SHA/subject pins reduce
that exposure but do not continuously prove account-wide access. A compromised
owner device/capture signer can falsify attestation; independent key control and
review mitigate but do not eliminate that risk. Ordinary Pages authority remains
a distinct risk until the single deployment-authority replacement is accepted.
GitHub log visibility may be incomplete and is not a substitute for capture.

**Residual risk / approval boundary:** this trades five-minute continuous account
coverage for a bounded supervised snapshot model. It establishes neither complete
continuous account visibility nor owner-exclusive technical authority. It is
proposed only for non-publishing acceptance, not indefinite production operation.
External review must explicitly accept/reject this tradeoff and define any later
production inventory policy. If rejected or metadata remains incomplete, retain
BLOCKED and the existing verifier. No source flag activates this proposal.

## Consolidated next owner actions

Approve the capture operator/tool and independent signer arrangement; perform a
real metadata-only trial on the existing computer. Based on actual completeness
and timing, either accept the existing five-minute mechanism or approve/reject the
single alternative above. Only after that decision select/authorize a new isolated
acceptance environment, read identities, key pins and exact two invocation plans.
The prior FRA1 DNS/IP/credentials/expiry are retired and must not be reused.
