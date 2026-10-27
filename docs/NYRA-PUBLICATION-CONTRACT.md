# Nyra publication contract v1.1 — Phase 1

Status: contract and local validation only. No production publication is enabled.
Baseline: `5be2f66302040a7180c30f327b73ce09ac364d0f`.

## Scope and authority boundary

Nyra remains the AI editorial creator. Elias Kalyvas is the human editorial supervisor, exclusive final approver and publisher; approval does not automatically make him the author. Nyra is never represented as a human Person. The versioned `identity` object fixes these public identities and carries a visible disclosure. A new `author` property is rejected.

This module has no network calls, provider clients, environment/secret access, database integration, Publish endpoint, deployment integration or authentication logic. A valid JSON document, hash, approval ID or `approved_by` value is **not proof of owner/MFA approval**. Phase 2 must obtain exact revisions from authoritative storage, verify owner/MFA, record authorization transactionally and establish trusted export provenance. Arbitrary user JSON must never be passed through validation and treated as publication authority.

All fixtures are synthetic and remain under `test/`; they are not a public publication source. The production adapter, routes, noindex policy and website workflow remain unchanged.

## Machine-readable artifacts

The six standalone JSON Schema draft-2020-12 documents live in `contracts/nyra-publication/v1.1/`:

| Schema | Wire version / purpose |
| --- | --- |
| `shared.schema.json` | Reusable strict field, content, presentation, identity and reference definitions |
| `release.schema.json` | `nyra.publication.v1.1`: immutable language-specific article snapshot |
| `manifest.schema.json` | `nyra.publication.manifest.v1.1`: complete authorized active set and withdrawal records |
| `event.schema.json` | `nyra.publication.event.v1.1`: explicit publish, replace, withdraw and rollback authorizations |
| `receipt.schema.json` | `nyra.publication.receipt.v1.1`: separate operational delivery/verified-live record |
| `dataset.schema.json` | Exact `{manifest, releases}` public export envelope |

Schema `$id` URLs are stable identifiers, not currently hosted endpoints. All references resolve locally; no schema is fetched over the network. Custom formats `nyra-utc` and `nyra-public-https` are registered by the validator. A consumer must use those formats and semantic validation, not only generic JSON Schema validation.

Every object is closed (`additionalProperties:false`), every declared field is required, optional absence is represented only by explicit allowed `null`, arrays and text have bounds, and versions use exact constants. Ajv 8.17.1 is a pinned **development** dependency with lockfile integrity entries. It is not imported into the website. Coercion, defaults and removal of unknown properties are disabled.

## Public release fields

- `article_id`: stable identity for one article in one language. GR and EN use different article IDs.
- `variant_id`: stable language-variant identity; its article ID, locale and canonical cannot be reassigned across history.
- `locale`: `el` or `en`; internal `gr` maps to `el` before constructing the snapshot.
- `format`: `signal` or `essay`.
- `slug`: lowercase ASCII alphanumeric words separated by one hyphen, length 1–120.
- `canonical_url`: exactly `https://eliaskalyvas.gr/{gr|en}/signals/{slug}/`. Foreign origins, aliases, query strings, fragments and conflicting language/slug are rejected.
- `content_revision`: immutable UUID and SHA-256 for `content`.
- `presentation_revision`: immutable UUID, nonnegative revision number and SHA-256 for `presentation`.
- `content`: exact title, summary, ordered content blocks and approved public source references.
- `presentation`: SEO and social title/description, share text, stable topic IDs, 3–5 hashtags, controlled final cover and up to two related article IDs.
- `identity`: Nyra AI voice; Elias editor/final approver and publisher; visible disclosure. No author substitution.
- `translation_group_id`: nullable shared group UUID.
- `approved_translation_relations`: at most one opposite-language article/variant relationship. This is not permission to export an absent counterpart.
- `authorization`: unique ID, action, public approver identity, human approval time, publication authorization time and approved-payload hash. Private user/session/MFA records never enter this object.
- `release`: immutable release ID, positive sequence, predecessor/restore pointers, release-issued time, first-publication time and modification time.

Image search brief, thesis, original contribution, counterargument, uncertainty notes, internal editor note, research report, tickets, source excerpts, model/cost records and unpublished revisions are intentionally not public fields. A public explanation needed by the article must already be incorporated in its approved body. Nothing is silently promoted from an internal editorial note.

## Deterministic hashes

`lib/publication/contract.mjs` uses SHA-256 of UTF-8 canonical JSON:

1. `content_revision.sha256 = hashJSON(content)`.
2. `presentation_revision.sha256 = hashJSON(presentation)`.
3. `authorization.approved_payload_sha256 = hashJSON(approvalPayload(release))`.
4. A manifest release reference contains `hashJSON(entireRelease)`.
5. A successor manifest contains `hashJSON(previousManifest)`.

`approvalPayload` includes the schema version, article/variant/language/format, approved slug/canonical, both revision descriptors, content, presentation, identity and approved translation relationships. It excludes authorization audit fields and server-controlled delivery metadata, preventing circular hashing. This exclusion is the approved delegation to choose a release timestamp without another editorial approval; it never permits content changes.

Canonicalization follows RFC 8785 serialization within the contract's narrower JSON domain: safe integers only, sorted object keys, preserved array order, exact strings, UTF-8, no post-approval Unicode normalization. Invalid surrogates, negative zero, unsafe/fractional numbers, non-JSON values, cycles and exotic objects are rejected. No data is repaired. Hashes provide deterministic integrity, not a signature or human identity proof.

Use `parseContractJSON` on untrusted wire JSON: it rejects duplicate/escaped-equivalent keys, invalid JSON, over-40-level nesting and input above 4 MB before schema validation. A native `JSON.parse` call cannot retain evidence of duplicate keys.

## Content and source mapping

The verified current Nyra article shape is `paragraphs[{text,source_urls,evidence_ids}]`, not a rich block tree. `mapNyraContent(draft)` explicitly projects:

- Exact title and summary.
- Each paragraph in its original order with unchanged text.
- Each source URL into its approved public source ID.
- No private fields from the draft/workspace/research packet.

A source gets deterministic `s1`, `s2`, … from the supplied approved source-list order. Unreferenced source entries are omitted; remaining IDs are not renumbered. Duplicate URLs/IDs and unresolved references are errors. Source titles and URLs are preserved. The supplied source list is expected to be approved by Phase 2; a mapper cannot establish editorial approval.

Private `evidence_ids` are checked against captured source records and their source URLs. IDs and excerpt text are never copied. These checks establish mapping consistency, not factual truth or a passed editorial review. Legacy imports without evidence IDs remain projectable but cannot bypass Phase 2 review requirements.

`mapStructuredContent` is a separate explicit projection for an already approved structured document. Supported blocks:

- paragraph: exact text and multiple public source IDs;
- heading: exact H2 text;
- quote: exact text, nullable explicit attribution, public source IDs;
- list: unordered, preserving every item including duplicate approved items and item-level source references.

This helper does not change Nyra prompts or claim that current Nyra produces structured blocks. No automatic heading detection, Markdown reinterpretation, quotation invention, list conversion or dropped unknown block is allowed. Unsupported shapes must fail. Existing paragraph text remains literal, including line breaks; a renderer must preserve its approved text content.

The approved preview, initial HTML and hydrated view must later agree on ordered blocks, text, attribution and citations. Citation labels must derive from the approved source list and support multiple references; the current renderer's hard-coded `[1]` is a future integration change, not changed in Phase 1.

## Image contract — policy B

Every release requires either `final_cover` or an explicitly approved `editorial_template`. No missing-image fallback or automatic upgrade of the current demo placeholder.

Required fields: controlled absolute asset URL, SHA-256, JPEG/PNG/WebP MIME, positive bounded dimensions, language-specific nonempty alt text, caption, creator, source URL, license description, nullable license URL, explicit rights basis and `rights_confirmed:true`.

The asset URL is exactly `https://eliaskalyvas.gr/assets/signals/{sha256}.{jpg|png|webp}` and must match declared MIME and hash identity. An editorial template additionally requires a UUID and `rights_basis:'owned'`; a final cover has `template_id:null`. Fonts and all embedded elements must be licensed/owned. The schema does not independently certify rights or inspect image bytes. Phase 3 must compare actual bytes/hash/MIME/dimensions and hosting, and Phase 2 records the owner's rights review. No automated external image is assumed licensed.

## Languages and complete dataset validation

`validateRelease` checks one snapshot. `validatePublicationSet` additionally checks the complete active manifest:

- Exactly one release per article/variant identity; unique release/canonical/authorization IDs.
- Exact reference hash and identity equality; no missing or extra release payload.
- No active/withdrawn overlap.
- Active translation counterparts must agree on identity, opposite language and group and must be reciprocal.
- A dormant approved relation does not import or reveal the missing translation. `activeTranslationRelations` returns only actual reciprocal active counterparts; website integration must use it for alternates/navigation.
- Related links must target an active release in the same language.

Thus EN can be published/replaced/withdrawn independently without changing GR bytes. Removing EN may leave an immutable dormant relation in GR, but no EN body, route or alternate is exported. Approved relationships changing meaning require a new approval; the website never infers translation permission from matching slugs.

## Events, generations and immutable history

`validateEvent` checks a single event; `validateTransition(previous,next,events,{now,history})` checks authoritative change relationships. Full history for the affected variants must be supplied by the trusted future authority. An incomplete/untrusted history must not be used to claim authorization.

- `publish`: no prior article/variant, no target release, new sequence 1.
- `replace`: exact current active predecessor, new release/authorization IDs, same stable identity/canonical/first date, next sequence.
- `withdraw`: exact active target, no article payload, separate authorization ID; removes that language and records its event/time/target.
- `rollback`: exact predecessor and known historical restore target, new release/authorization IDs and next sequence; content/presentation hashes match the restore target. May restore a withdrawn variant with its complete history.

Generations increase by exactly one and bind the previous manifest hash. Each changed variant requires exactly one event. Stale expected generation/hash, reusing a historical release ID as new, changing immutable bytes, reassigning revision IDs, unauthorized active-set removals and tampered withdrawal audit records are rejected. Retained releases remain byte-identical. A website-only rebuild reuses the manifest and dates; it does not manufacture a content event.

Ordinary code rollback must rebuild against the current authorized manifest. An old HTML artifact is not a content rollback authorization. Online current-generation checks, database locks, leases and atomic outbox persistence remain Phase 2/4 integration requirements.

## Timestamp and receipt contracts

All dates must be exact valid UTC `YYYY-MM-DDTHH:mm:ss.sssZ`, calendar-correct and not later than the explicit validation `now`. `now` is mandatory for deterministic validation; the future server supplies its trusted clock. Approval precedes authorization, which precedes release issue. First publication is no later than modification; modification equals the release-issued timestamp. A first release has all three release dates equal. Replacements preserve the original first-publication date.

Normal publication uses one deployment. A trusted server issues a fresh release timestamp near final artifact preparation. `validateDeploymentTiming(releases,{now,phase})` checks start ≤15 minutes and verified-live ≤30 minutes after issue, inclusive. Receipt validation derives the required release set itself; callers cannot select it. Historical validity and deployment freshness are separate.

A receipt binds manifest ID/generation/hash, code SHA, attempt ID, GitHub run/attempt/deployment IDs, requested/completed/verified-live times and observed manifest hash. `released_verified` requires exact observed hash and complete ordered times. Failed/unknown outcomes cannot claim verified-live. `timing_exception` records abnormal completion instead of silently claiming normal timing. `validateReceipt` checks shape/consistency, not authenticity of the caller's GitHub/HTTP observations.

### Mandatory transition evidence for a verified-live receipt (F01)

`validateReceipt(receipt,{manifest,now,transition})` requires the following context for `released_verified`:

```js
transition: {
  previous: lastVerifiedLiveDataset,
  steps: [
    {next: authorizedDataset, events: authorizedEvents, history: affectedVariantHistory},
    // Every further intervening generation, in order, if the build coalesces changes.
  ],
}
```

Both datasets include complete manifests and active release payloads. Each step must supply all three fields, including explicit event/history arrays. The validator validates the baseline dataset, then every contiguous generation/hash/event/history transition at `deployment_requested_at`. The resulting final manifest must exactly equal the manifest bound to the receipt. Missing, skipped, stale, mismatched or malformed evidence fails closed.

The timed set is **all final active release IDs absent from the last verified-live baseline**, not merely the releases introduced in the final step. This covers first publication, replacement, rollback and coalesced pending generations. Superseded releases absent from the final public artifact are not timed. Retained historical releases are validated for integrity but are not subjected to fresh-release deadlines.

An ordinary rebuild supplies the actual last verified-live dataset as `previous` and `steps:[]`; the requested manifest must be identical. An explicit withdrawal-only transition may also produce an empty timed set. Neither case can be inferred merely from an omitted/empty caller release list. The obsolete `newReleases` option is rejected even if it is explicitly `undefined`, empty, complete or supplied alongside valid transition evidence. Failed/unknown receipts do not claim verified-live and do not require this successful-delivery transition context.

Phase 2 must obtain `previous` from authoritative verified-live state and `steps` from the complete authorized event history, rather than accepting a browser's claimed baseline or substituting an unverified pending generation. For the initial publication it must establish an explicit known baseline (for example the empty generation-1 dataset), then supply the publish transition. This pure module verifies consistency, not the authenticity of the baseline or event provenance. The wire receipt schema is unchanged: this evidence is a mandatory validator context for successful receipts, not another public receipt field.

Future integration must reconcile unknown delivery before retry, preserve a timestamp if content was actually delivered, create a fresh attempt for a proven never-delivered failure, and separately record delayed delivery. Withdrawal remains pending until removal is confirmed. There is no atomic transaction between Supabase and GitHub Pages, and caches cannot be universally erased.

## API usage (synthetic/local only)

```js
import {parseContractJSON, validatePublicationSet, validateTransition, validateReceipt}
  from '../lib/publication/contract.mjs';

const candidate = parseContractJSON(input);
validatePublicationSet(candidate, {now: trustedServerUTC});
validateTransition(previous, candidate, authorizedEvents, {
  now: trustedServerUTC,
  history: authoritativeAffectedVariantHistory,
});

validateReceipt(receipt, {
  manifest: candidate.manifest,
  now: trustedServerUTC,
  transition: {
    previous: lastVerifiedLiveDataset,
    steps: [{next: candidate, events: authorizedEvents, history: authoritativeAffectedVariantHistory}],
  },
});
```

The names `authorizedEvents` and `trustedServerUTC` describe required provenance, not a capability provided by this module. There is deliberately no production signer, publish/export endpoint or approval factory. `sealFixture` exists only under `test/fixtures/` and computes test hashes; it is not a signature.

## Privacy boundary and limits

Closed schemas reject accidental draft, ticket, API-key, evidence-excerpt and unpublished-version fields at any nesting level. Explicit projection tests use private canary values and verify none enters the public snapshot. Defense-in-depth scanning also rejects recognizable OpenAI key, Bearer/JWT and private-key patterns in otherwise permitted text. Errors expose codes, not rejected content.

No validator can recognize every confidential fact or arbitrary secret embedded as ordinary approved prose. Trusted field projection, human review of the exact public preview and Phase 2 provenance are mandatory. The module makes no claim to classify arbitrary text as nonconfidential, prove source truth, verify DNS/redirect safety, establish ownership rights or authenticate receipts. All server-side fetching remains future work; syntactically public HTTPS is not a DNS/SSRF guarantee.

## Acceptance and regressions

Commands:

```sh
node --test test/publication-contract.test.mjs
npm test
npm run build
git diff --check
```

Tests cover GR-only/independent EN, reciprocal/dormant language links, foreign canonicals, forged statuses, hash/identity/revision conflicts, dates, source/evidence projection, all supported blocks, missing/invalid assets and template rights, private fields/canaries, canonicalization/wire parsing, explicit events/rollback, manifests and deployment receipts/timing. No test executes provider/network calls from the contract module. Existing private editorial, DB, auth, booking, legal and Signals tests remain in the regression suite.

Before Phase 2, external review must approve these exact files/diff. Later phases separately implement owner/MFA authority, immutable storage, trusted export, production protections and unified deployment. No Phase 1 test constitutes permission to publish or enable indexability.

### Recorded Phase 1 verification — 27 October 2026

- Runtime: Node.js 24.22.1; repository CI configuration remains Node 22 and was not changed or dispatched.
- Targeted contract tests: **59/59 PASS**.
- Full existing plus contract regression suite: **178/178 PASS** (119 existing + 59 new).
- Production `npm run build`: **PASS**, 131 modules transformed.
- `git diff --check`: **PASS**.
- Existing production source/configuration/website content diff: empty.
- Contract version strings and private fixture canaries: absent from generated `dist`.
- No OpenAI requests, database changes, workflow dispatch, merge, deployment or real publication.

### F01/F02 external-review correction verification — 27 October 2026

- Reproduced F01 against reviewed head `d562cbce013b47da7715c30bf930a0ba237fbbea`: a stale `released_verified` receipt was accepted when the release list was omitted. The temporary probe was removed.
- Removed caller-selected timing coverage. Verified-live receipt validation now requires an explicit validated baseline/transition chain and derives all final newly issued release IDs itself. An unchanged rebuild explicitly proves the same manifest; a missing context is never treated as an empty change set.
- Added ten targeted regression tests: missing evidence/previous bypass, forbidden caller release lists, incomplete/tampered evidence, exact 15/30-minute boundaries, historical rebuild, independent EN with retained GR, replacement, withdrawal-only deployment, rollback and coalesced multi-generation releases.
- Exact compatibility runtime: **Node.js v22.22.0 / npm 11.9.0**. Installed isolated Node 22 tooling outside repository dependencies; package files and GitHub Actions configuration unchanged by this correction.
- `node --test test/publication-contract.test.mjs`: **69/69 PASS**.
- `npm test`: **188/188 PASS** (119 existing + 69 contract tests).
- `npm run build`: **PASS**, 131 modules transformed.
- `git diff --check`: **PASS**.
- Correction scope: only `lib/publication/contract.mjs`, `test/publication-contract.test.mjs` and this documentation. Receipt wire schema and fixtures unchanged.
- No OpenAI calls, merge, deployment, workflow dispatch, production database/auth/API/credential/content/indexability changes. PR #8 remains Draft for external review.
