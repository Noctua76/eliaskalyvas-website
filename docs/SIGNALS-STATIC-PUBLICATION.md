# Signals — Phase 3 static rendering and assets

Approved base: `a73a722f60e33e2140d2ce37892babc20bce51fc`.
Branch-only implementation; no merge/deployment/publication/migration authorized.

## Architecture and trust

`vite.config.js` installs `signalsStaticPlugin()` with **no dataset argument**. The ordinary `npm run build` has no JSON loader, network exporter, Supabase access, fixture import, publishing environment switch or credentials. It generates the existing waiting state and protected demo entries, now with meaningful initial HTML. It leaves the production sitemap and robots byte-for-byte unchanged and emits no approved article route. Home, booking, Admin, legal source, favicon, Hero, workflow and Phases 1/2 are unchanged.

`lib/signals/static-build.mjs` exposes `prepareSyntheticPublication({dataset, assetRoot, rightsDecisions, now})` and `buildSyntheticPublication(options)` **only for local isolated tests**. The latter creates its own fresh output directory under the OS temporary directory; callers cannot select production `dist` as its destination. There is no CLI/env/production configuration wiring to those functions. Invalid input fails before an output directory/build is created. Failed builds remove their temporary output.

The incoming dataset is the full closed v1.1 `{manifest,releases}` object. It is cloned, then passed unchanged to `validatePublicationSet` from Phase 1, including schemas, canonical identities, hashes, exact active references, dates, relationships and private-field exclusion. Assets are validated before the build plugin can consume the internal plan. The plugin factory accepting that plan is private; a WeakSet guards its local origin. This is an implementation capability boundary, **not cryptographic provenance, owner authorization or proof of live publication**.

A valid JSON schema, UUID, `published` view status, rights flag or synthetic decision does not prove approval. No production acquisition/trust mechanism is introduced. Phase 4 must authenticate and acquire the current authorized public dataset and rights decisions from the private authority, establish authoritative manifest freshness/withdrawal/rollback and release timing, and approve the delivery/verified-live receipt boundary. Never connect the Phase 2 held-only desired manifest directly to a public build merely because it validates. Held authorization is not actual verified-live publication.

## One dataset, one render

`src/signals/public-view.mjs` makes an explicit browser-safe projection of validated active releases. It copies exact content blocks/source IDs/text and approved presentation, dates, identity disclosure and related IDs. It excludes private work, research, decisions, session identifiers, authorization/history packets and credentials. Active language counterparts are resolved by approved article/variant/locale identities; matching slugs never infer a translation. Separate article language identities stay independent. `work` and `investment`, already supported by the Phase 1 topic contract, now have Signals labels.

`entry-server.jsx` renders the same `SignalsApp` used by the browser through React `renderToString`, transformed by a config-free Vite SSR loader with no HTTP listener. Build-time marker regions insert escaped initial HTML, head metadata and a script-safe public JSON snapshot. A `generateBundle` post hook uses Vite's processed listing entry as the shell for each exact active article entry, reusing the hashed CSS/JS asset links. Output is a fresh static tree, not an incremental overlay; stale/withdrawn article files must never be copied from a previous build.

- Listing: `/gr/signals/`, `/en/signals/`; initial H1, summary/cards/navigation or waiting state.
- Articles: only exact active `/gr/signals/{slug}/index.html` and EN equivalent.
- Reserved existing demo slugs cannot collide with an approved route; the pipeline rejects them explicitly rather than silently repurposing demos.
- Missing or withdrawn variants create no article file. GitHub Pages' existing non-SPA 404 page is unchanged; the native acceptance server deliberately uses real file lookup/404, not Vite's SPA fallback.
- Normal pages hydrate the embedded same-locale public snapshot via `hydrateRoot`; no client Supabase/API fetch. Preview mode deliberately uses `createRoot` and existing demo data.
- The existing legal component is unchanged. A Signals-only footer wrapper renders a stable initial fallback, then mounts the existing browser portal/storage UI after hydration. Native share availability is also detected after hydration. This avoids browser/SSR branches during the initial render.
- Complete paragraph/H2/quote/list blocks, repeated list items, quotation attribution and multiple source IDs per paragraph/quote/item are preserved. Citations visibly use their actual `sN` identifiers and resolve to approved source anchors, never a fixed `[1]`. External source/license/creator links retain safe React escaping and noreferrer/noopener.
- Only explicitly approved active same-language related article IDs produce related cards. No topical inference is used for release records; demo behavior remains compatible.
- A minimal Signals-only wrapping rule prevents long approved words from overflowing a mobile viewport; typography and breakpoints remain unchanged.

## SEO and sitemap

`lib/signals/seo.mjs` derives all outputs from the same validated snapshot:

- Independent SEO and social titles/descriptions; exact own-site canonical; Open Graph/Twitter image and alt metadata; dimensions; language; approved publication/modification times.
- Only active approved reciprocal counterparts generate article hreflang and language links. A dormant relationship exposes neither body, route nor alternate. Localized listings become indexable only when that language has an active release in the isolated publication build; normal builds always remain noindex.
- BlogPosting JSON-LD uses the exact visible title/summary and release dates; Nyra is disclosed as an AI editorial voice through visible disclosure, `creditText` and an explicitly described `Thing`. No human author is invented. Elias is the human editor and publisher (`Person` with the approved person identity). `author` is intentionally omitted rather than misclassifying AI as a human. Image/source attribution is included.
- JSON scripts escape `<`, `>`, `&`, U+2028/U+2029; HTML/XML attributes/text are escaped. Approved text is never interpreted as HTML or silently corrected.
- Sitemap preserves the existing entries and appends only active language listings/canonicals and approved language alternatives, with exact `modified_at` values. No preview/demo/dormant/withdrawn URL or invented listing modification date. The normal empty-publication build does not rewrite the existing sitemap.

Static hosts cannot send different initial HTML/robots headers for query strings on the same path. Existing demo paths have initial-HTML noindex in **both** ordinary and synthetic builds. The legacy `?preview=1` client explicitly sets noindex and removes canonical/social/article-schema tags before rendering demos; query URLs never enter the sitemap. If Phase 4 enables indexable listings, its production integration must additionally decide the static preview namespace/redirect or hosting robots policy for legacy listing query URLs; do not claim query-specific initial noindex headers exist. Current production remains noindex for every Signals entry, so this issue does not activate indexing in Phase 3.

## Actual asset validation and rights record

Only local canonical `assets/signals/{sha256}.{jpg|png|webp}` bytes can be packaged; no external fetch or image generation. `lib/signals/assets.mjs`:

1. Matches the entire approved cover hash to a separate rights record.
2. Checks realpath containment (including symlink escape), file existence/type and a 20 MiB input cap.
3. Calculates SHA-256 over actual file bytes.
4. Uses pinned Sharp to detect format, verify extension/MIME, read dimensions and decode all pixels. A 40-million-pixel bound, single-frame restriction and orientation checks prevent unsupported/ambiguous decoding. Header inspection alone is insufficient.
5. Rejects embedded EXIF/IPTC/XMP rather than silently stripping/re-encoding approved bytes. Any prepared clean replacement must be independently rehashed/reapproved. This is a conservative metadata rule, not a guarantee that image pixels or every possible metadata container contain no confidential information.
6. Requires approved nonblank alt/creator/license, exact caption and all other cover fields via the cover hash. Final covers and owned editorial templates are supported. Template UUID/kind must match the separate rights record and Phase 1's owned-template rules.
7. Packages exact approved bytes, never transforms, crops or silently substitutes a demo placeholder. Existing Signals display styling remains unchanged.

The local build-side rights-record shape is closed and requires all seven fields:

```json
{
  "decision_id": "UUID",
  "asset_sha256": "SHA-256 of actual bytes",
  "cover_sha256": "Phase 1 hashJSON of the complete approved cover",
  "approved_by": "https://eliaskalyvas.gr/#person",
  "approved_at": "exact UTC timestamp, no later than human article approval",
  "kind": "final_cover or editorial_template",
  "template_id": "UUID for template, otherwise null"
}
```

These records stay build-side and are never embedded in HTML/JS. In tests they are synthetic, explicitly **not evidence of legal rights or human authentication**. Phase 4 must obtain the actual immutable private asset decision from a trusted server and establish its owner/MFA provenance and cover-hash binding. Recorded approval confirms the owner's decision; it does not independently prove ownership/licensing. Documentary license/consent review, owned template registry, pixel/metadata privacy review and final asset delivery/cache policy remain operational prerequisites.

## Tests and reproducibility

All fixtures and generated local assets live under `test/fixtures/signals-publication.mjs` and temporary directories. No fixture text/image is committed to public content or imported into production source. New dev dependencies are pinned: Sharp 0.34.5 (actual image decoding), JSDOM 27.4.0 (DOM/HTML/XML/hydration checks). The existing Node 22 baseline/workflow is retained.

- `node --test test/signals-publication.test.mjs`: build normal, GR-only, EN-only, reciprocal GR/EN with approved related article, and withdrawn-translation trees; verify fidelity/schema/hreflang/sitemap, SSR hydration node preservation and no errors, escaped injection, demo protection, exact image bytes and decoding, absent/mismatched/malicious assets, missing rights, private field/source leaks and normal client bundle isolation.
- `npm test`, `npm run build`, `git diff --check`: existing full regression/build gates.
- Optional native browser test (not an added CI requirement): `node test/signals-browser.acceptance.mjs /absolute/playwright-core/index.mjs /absolute/chromium-binary`. Uses only a local temporary synthetic build/server, blocks external network, checks direct article access, refresh, listing navigation, explicit language switch, demo/listing previews, real 404, text/citations and zero browser/hydration errors at 1440×1000 and 390×844, DPR 1. Produces local QA screenshots. Playwright/binary are temporary tooling, not repo/runtime dependencies; no workflow modification or browser download is required by npm test.

## Phase 4 integration gates

Authenticated dataset/rights acquisition and provenance; owner/MFA/native Supabase acceptance and separately approved migration; asset rights/privacy/hosting acceptance; unified production deployment using a fresh authoritative manifest for every build; explicit publication/withdrawal/rollback/retry/lease handling; actual release timestamp validation and verified-live receipts; production preview-query policy; rollout/smoke/rollback acceptance. No production loader, API mount, exporter, credentials, delivery worker or workflow activation is included here.

## Recorded results

Node v22.22.0 / npm 11.9.0: targeted 25/25 PASS; full suite 270/270 PASS; production build PASS (131 modules); git diff --check PASS. Normal dist contains no synthetic article/private canaries/test credentials; sitemap and robots remain unchanged. Native Chromium 153.0.8010.0: four GR/EN desktop/mobile acceptance cases PASS; layout screenshots inspected locally. No merge, production deployment, migration, Edge deployment, credential change or OpenAI API call.

Primary implementation references: https://react.dev/reference/react-dom/client/hydrateRoot ; https://vite.dev/guide/ssr ; https://sharp.pixelplumbing.com/api-constructor/ .
