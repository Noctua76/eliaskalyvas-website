# Signals design preview

Preview implementation against the two supplied 22 October 2026 mockups.
No Nyra Lab, database, API, authentication or existing homepage section changes.

## Viewing

- Greek listing: `/gr/signals/?preview=1`
- English listing: `/en/signals/?preview=1`
- Article: `/gr/signals/who-decides-when-ai-suggests/?preview=1`
- The corresponding English article has the same slug under `/en/signals/`.
- Two other illustrative article entries exist in each language, linked in the listing.
- Paths respect Vite `BASE_URL`; all eight HTML entries are built for static direct navigation/refresh.
- Without `?preview=1`, the adapter returns no articles and renders a waiting/unpublished state.
- All current Signals entries are `noindex,follow` and absent from the sitemap.

## Data boundary

`src/signals/adapter.mjs` is the sole public data source. It currently returns only
explicit demo content, and only in preview mode. It imports no Admin, Nyra Lab,
Supabase, research packs, credentials, tickets or usage data.

The public contract includes language/slug, title/deck, format, topics, independent
featured flag, body blocks, 3–5 hashtags, image provenance/focal point, sources,
nullable real dates/reading time, translations and social metadata.

`metadata.mjs` runs through a Vite HTML transform. A future approved-publication
adapter can provide article-specific social metadata in the initial HTML.
Additional approved slugs must also receive a static HTML entry and build input;
GitHub Pages server fallback is not assumed.

## Deliberately inactive

- Nyra Lab publishing and research pipeline.
- Autonomous image search, image download and final photographic selection.
- Reader accounts, verification, comments and replies by Nyra.
- LinkedIn/copy/native sharing until a real published canonical URL is supplied.
- Publication dates, reading times, popularity and participation counts for demos.

The only image is an original, local geometric SVG placeholder. No remote image
providers, font services, tracking or additional runtime dependencies are introduced.
Existing legal/cookie controls are reused unchanged.

`signals-responsive-check.html` is a development-only iframe fixture for exercising
actual CSS layout viewports at 360, 768, 1024 and 1440 pixels with the existing browser.
It is not a Vite build entry and is not published.

## Production integration

The Signals implementation is integrated into the existing website's Vite build.
The homepage desktop navigation and mobile menu link to each language's normal
Signals list using `signalPath(BASE_URL, lang)`. Selecting Signals closes the menu.
No temporary preview-domain link or external Site dependency is used.
The normal list shows only approved publications (currently a waiting state).
Explicit `?preview=1` pages retain the marked, non-indexed illustrative articles.
Article HTML entry points also exist without the query; they show an unpublished
state rather than a fictitious approved article. Language links then return to the
corresponding normal listing when no approved translation is available.

Deploy using the existing GitHub Pages workflow. No new Site, DNS, backend or
Nyra Lab configuration is needed.

## Verification — 22 October 2026

- Existing + targeted suite: 119/119 PASS (7 Signals tests).
- Root production build: PASS. GitHub Pages subpath build: PASS.
- CSS viewports 360, 768, 1024, 1440: listing and article checked in actual iframes; no horizontal overflow.
- Filters, keyboard activation, article navigation, EN/GR, article refresh, return to listing: PASS.
- Sources expansion, legal modal, cookie controls and production waiting state: PASS.
- No actual booking, message, comment, Nyra call or provider action performed.
- Full-page browser screenshot capture was unavailable; delivered screenshots show the top viewport of each layout.
- Existing homepage change is limited to the Signals navigation import/link. Backend, Nyra, booking, sitemap, robots and hero assets are unchanged.
- Initial visual review used a separate private preview. This integration is intended for the existing production repository and Pages workflow.

## Signals files (plus `src/main.jsx` navigation integration)

- `docs/signals-preview.md`
- `en/signals/index.html`
- `en/signals/what-should-remain-human/index.html`
- `en/signals/which-problems-deserve-funding/index.html`
- `en/signals/who-decides-when-ai-suggests/index.html`
- `gr/signals/index.html`
- `gr/signals/what-should-remain-human/index.html`
- `gr/signals/which-problems-deserve-funding/index.html`
- `gr/signals/who-decides-when-ai-suggests/index.html`
- `public/assets/signals/placeholder.svg`
- `signals-responsive-check.html`
- `src/signals/SignalsApp.jsx`
- `src/signals/adapter.mjs`
- `src/signals/data.mjs`
- `src/signals/entries.mjs`
- `src/signals/main.jsx`
- `src/signals/metadata.mjs`
- `src/signals/model.mjs`
- `src/signals/signals.css`
- `test/signals.test.mjs`
- `vite.config.js`
