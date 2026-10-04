# Contact configuration

Section 07 uses the supplied panorama and eight icons, optimized as WebP with transparency preserved. `public/assets/contact/manifest.json` records the source mapping and hashes.

The preview has no message-delivery service configured. Valid submissions offer an email draft containing the name, email, selected interest and message. The site does not claim the message has been sent. No form data is kept in browser storage.

To enable direct delivery, set `VITE_CONTACT_ENDPOINT` to an approved HTTPS service at build time. It must accept a CORS JSON POST of `{ name, email, message, interest, language }`, return a non-2xx status on delivery failure, and return 2xx only after accepting delivery. Optional JSON `{ success: false }` or `{ error: ... }` also triggers the failure state. The form includes native required/email validation, whitespace checks, a 20-second timeout, loading/success/failure states, and a synchronous double-submit guard. Never expose a private API key in Vite variables. A provider-specific adapter may be needed when a service is selected.

The meeting link uses the Calendly URL linked from the existing official website: `https://calendly.com/eliaskalyvas`. Override with `VITE_MEETING_URL` if needed. LinkedIn uses the verified professional profile `https://www.linkedin.com/in/eliaskalyvas/`.

Set approved `VITE_YOUTUBE_URL`, `VITE_INSTAGRAM_URL`, `VITE_PRIVACY_URL`, and `VITE_TERMS_URL` when available. Until then, their footer controls open an accessible notice instead of fabricated profile URLs or unapproved legal text. The final legal documents and those two social profiles remain to be supplied before production launch.

Deploy only the existing GitHub Pages preview. The live domain and DNS remain separate.

## Section 07 visual-review checkpoint — 2026-10-04

Resumed from committed implementation `d130021`. Retained all supplied assets, intent selection, form transport, translations and footer content. Completed the missing shared-header visibility in Contact without duplicating the header; its original space is reserved so previous section positions do not move. Restored the footer tagline at intermediate desktop/tablet widths and adjusted Contact's top spacing for the visible header.

Production build and browser checks passed across EN widths 320, 390, 768, 1024, 1200, 1280, 1440, 1536 and 1800, plus GR at 390 and 1536. Checked five desktop cards in one row, tablet/mobile reflow and order, overflow, image loading, active rail/header, keyboard focus, required/email validation, email fallback, legal/social notices and reduced motion. Mocked delivery verified loading, success, HTTP/provider failure, message retention and double-submit protection; no external messages were sent. Additional checks confirmed one visible shared header, an unhidden footer tagline, mobile menu return to Home, and unchanged preceding section positions. Section 01–06, rail, brand and shared style files match the interrupted commit byte-for-byte.

No push or deployment was performed in this continuation. The work stops here for visual review. Remaining integrations: production contact delivery, YouTube/Instagram profiles, and approved Privacy Policy/Terms. The preconfigured Calendly and LinkedIn URLs are retained.
