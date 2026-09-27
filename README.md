# Elias Kalyvas — Hero preview

This repository is the first, isolated implementation stage of the new eliaskalyvas.gr. It contains the Hero and six service panels in two rows. The existing live site and DNS are separate.

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
- The `BRAINSTORM` SVG uses 268 fixed triangles in the `BRAIN` letter shapes, a connected network and irregular field polygons at the left, 39 transitional `ST` fragments, and solid `ORM`. A GSAP timeline converges and rotates the actual letter fragments into their fixed final coordinates over about 3.3 seconds. Select facets and nodes then move subtly without rebuilding the word. Desktop pointer movement gently displaces nearby fragments. Tablet and mobile hide and animate fewer elements. Reduced-motion displays the final geometry directly. The accessible heading remains text.
- The approved transparent EK mark is the header symbol; the two-line wordmark remains HTML text.
- All six approved service visuals are used in six equal-sized panels. Desktop shows three columns and two rows, tablet two columns and three rows, and mobile one column and six rows.
- The panels currently open short descriptions inside the Hero. They can become smooth-scroll links after their respective sections are built and approved.
- Navigation labels for unbuilt sections are presentation text at this stage. The language selector, Home, Services and Hero interactions work.

The current preview needs visual review on real desktop and mobile browsers before the Hero can be approved. It is not a finished site.
