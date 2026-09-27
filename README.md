# Elias Kalyvas — Hero preview

This repository is the first, isolated implementation stage of the new eliaskalyvas.gr. It contains only the Hero and its three area panels. The existing live site and DNS are separate.

## Run locally

```bash
npm ci
npm run dev
```

Open `/en/` or `/gr/`. Build with `npm run build`.

## Deployment

The GitHub Actions workflow builds with `GITHUB_PAGES_BASE=/eliaskalyvas-website/` and publishes `dist/`. In repository Settings → Pages, select **GitHub Actions** as the source. The intended temporary URL is `https://noctua76.github.io/eliaskalyvas-website/en/` (and `/gr/`). Do not add a custom domain during development.

Both language pages contain their own HTML title, description and Open Graph text. The preview is marked `noindex,nofollow`; production canonical, hreflang, social images and SEO will be completed when the final domain and pages are approved. Future Signals posts require individual generated HTML pages for crawler-readable metadata.

## Hero scope

- The transparent portrait was derived from the supplied real photo. The mockup itself is not used as a page image.
- The `BRAINSTORM` word is currently a **static resting composition** for visual approval. Its 268 fixed SVG triangles occupy the `BRAIN` letter shapes, with a small connected network at the left, a transitional `ST`, and solid `ORM`. The accessible heading remains text. No GSAP timeline is installed or running yet; animation follows approval of this geometry. The static design also serves reduced motion.
- The approved transparent EK mark is the header symbol; the two-line wordmark remains HTML text.
- All six approved service visuals are stored under `public/assets/cards/`. The existing three Hero panels use the People, Business, and AI images. The remaining three are staged for their future approved sections.
- The panels currently open short descriptions inside the Hero. They can become smooth-scroll links after their respective sections are built and approved.
- Navigation labels for unbuilt sections are presentation text at this stage. The language selector, Home, Services and Hero interactions work.

The current preview needs visual review on real desktop and mobile browsers before the Hero can be approved. It is not a finished site.
