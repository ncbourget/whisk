# Architecture

## Why this structure

The public site is static, multi-page HTML with CSS and small progressive enhancements. JSON is the single source of frequently edited content. A dependency-free Python publisher exists because rendering the menu only in browser JavaScript would fail the brief’s no-JavaScript and discoverability requirements. It also centralizes repeated headers and metadata. This is a small publishing tool, not an application framework or a browser runtime dependency.

`data → scripts/build.py → HTML, sitemap, robots → any static host`

Cindy’s local workflow adds `editor → loopback server → validation + backup → JSON + HTML`. There is no deployed backend, database, account system, or API credential.

## Files

```text
index.html                    generated homepage
menu/, order/, about/          generated normal pages
find-us/, faq/, contact/       generated normal pages
404.html                      generated error page
assets/
  css/                        brand tokens, responsive site, notebook
  js/                         enhancements and content notebook
  brand/                      reserved for final logo/social image
  illustrations/              provisional original whisk line art
  trailer/                    provisional original trailer SVG
  food/                       provisional original food SVGs; owner photos
  icons/                      SVG favicon
editor/index.html             form-based content notebook
 data/site.json               status, copy, contact, global ordering
 data/menu.json               ordered item array
 data/events.json             event array
 templates/page.html          semantic shared document shell
 scripts/build.py             validation + static rendering
 scripts/serve.py             local preview, save, photo upload
 tests/test_site.py            safety, content, routes, metadata tests
 .github/workflows/check.yml   validation + downloadable static artifact
 deployment/                  inactive GitHub Pages workflow example
 _site/                       ignored publish output
 .backups/                    ignored local content snapshots
```

## Data rules

- Strings are escaped before becoming HTML. JSON embedded in script tags escapes `<`.
- IDs are unique lowercase letters, digits, and hyphens. Menu order uses integer `position`; the editor updates positions with Move up/down.
- `available: false` hides an item. `soldOut: true` leaves it visible and removes checkout. Featured shows the first three visible marked items.
- Prices are nonnegative finite decimal major currency units. Supported currencies are USD, CAD, GBP, AUD, EUR. Square is authoritative for the actual charge, fees, and taxes.
- Categories are owner-supplied strings; filters are derived automatically.
- Images must be real project-relative files under `assets/`, without traversal. Nonempty image paths require alt text. Rendering includes dimensions, shape, object-fit, lazy loading, and a failure fallback.
- Order windows and event times are timezone-aware ISO timestamps. The notebook uses normal date/time inputs and converts them using the configured IANA business time zone. It rejects ambiguous/nonexistent daylight-saving times rather than guessing.
- Events include venue name, address, start/end, optional map URL, description, status, and special menu note. End must follow start. Past events are removed at build time; cancelled future events remain clearly marked without directions links.
- Unknown social/contact details remain empty and render useful text, not guessed addresses or dead links.

## Ordering contract

See SQUARE.md. `https_url`, `can_order`, and `order_state` are the commerce boundary. A checkout is available only when:

1. Demo mode is off.
2. Ordering is enabled.
3. Status permits ordering (`open_today`, `preorders_open`, `next_popup`).
4. Global and item windows are open.
5. Item is visible and not sold out.
6. Its own Square-hosted URL is valid.

Individual links accept HTTPS hosts `square.link`, `squareup.com`, `checkout.square.site`, or subdomains of `square.site`. Custom-domain Square shops are intentionally not automatically trusted; Nate can extend the allowlist after verifying ownership and checkout behavior. A general shop URL is used only by the general shop action, never as an invisible item fallback.

The browser rechecks time cutoffs on clicks, periodically, and when a tab returns to view. It only closes stale links; it does not open links absent from an old build. **Publish at opening times.** Static pages can be cached, JavaScript can be disabled, and buyers may retain direct Square links. All business-critical stock, cutoff, tax, fulfillment, and payment rules must therefore be enforced in Square. Browser state is not inventory or payment verification.

## Security and local notebook

The server binds only to 127.0.0.1. Saves require a matching loopback Host and Origin plus JSON content type. This blocks ordinary cross-site form submissions and DNS-rebinding-style Host requests. No permissive CORS. Content is size limited, validated, rendered before save, backed up, atomically replaced file by file, and restored on save failure. A hash revision detects conflicting notebook windows. Photo uploads accept only JPG/PNG/WebP signatures, cap size at 5 MB, sanitize filenames, and add content hashes. The host’s photo filenames are never directly used as filesystem paths.

This is a trusted local authoring tool, not a hardened multi-user network service. Never bind it to a public interface or deploy it. Dot-directories such as `.git` and `.backups` are blocked from local GET routes. The production artifact excludes source tools and backups. No tokens, passwords, or `.env` files are needed for version A. `.gitignore` protects likely secrets; `.env.example` is deliberately not created because no backend needs configuration secrets.

## Performance, accessibility, and failure states

No external fonts or scripts, trackers, map embeds, frameworks, video, or fonts with recurring licensing fees. Above-the-fold trailer is a small SVG; below-fold images lazy-load. All product and event content is present in HTML. Filters and copy-link buttons appear only when JS initializes. Native links, buttons, details/summary, form labels, semantic landmarks, skip link, focus rings, responsive widths, and reduced-motion CSS provide the foundation for WCAG 2.2 AA; formal certification is not claimed.

Focus styles and high-contrast text are retained. Decorative SVGs are hidden from assistive technology. Mobile navigation remains a short, visible row rather than depending on a hamburger script. All filtering controls support keyboard activation and announce result counts. Photo failures expose a text fallback. Empty menus and events are intentional. No social URL means no fake social link. Checkout trouble points customers back to Cindy; the site cannot detect the uptime of a cross-origin checkout in advance.

Images have stable dimensions; portrait/square/landscape containers permit owner crops. Native `<img>` is the reusable image component. Automatic responsive `srcset` variants and compression are not claimed: this version uses one optimized upload per item. Add a build-time image optimization step if real assets justify it. Uploaded image metadata is not automatically removed.

## SEO and preview isolation

Pages have distinct titles/descriptions and Open Graph title/type/description. Domain and basePath generate canonical/OG URLs and sitemap when known. The social-image field accepts the final 1200 × 630 image. No fake domain or social-image URL is emitted. Demo builds are noindex, have a disallow robots file, an empty sitemap, and no fabricated LocalBusiness address/hours schema. Live homepages emit Bakery schema containing only configured facts. No address, coordinates, review, rating, or operating hours are guessed. Mobile pop-up hours should not be represented as permanent storefront hours.

Before removing demo mode, configure the real origin. Sitemap/robots and status information update on build. Robots directives are search hints, not privacy protection.

## Hosting and costs

GitHub Pages preparation is retained, but its current commerce restriction makes it unsuitable to assume as the production host. See DEPLOYMENT.md. Static output works on Cloudflare Pages or another eligible host without vendor-specific code. Square payment-processing fees still apply; formal preorder features require an eligible paid plan. No subscriptions were enabled here.

## Extension points, not speculative features

- Gift cards: add a verified Square-hosted gift-card URL and one menu/footer link.
- Catering/custom cakes/private events: add a contact page subsection; introduce a form processor only if needed and with a spam/privacy plan.
- Seasonal menus: existing seasonal flag, availability, and windows; a collection field can group releases later.
- Multiple trailers: add an event `trailerId` and filter, keeping event locations independent of the business profile.
- Merchandise: new categories plus Square products, with shipping configured in Square.
- Newsletter: optional provider integration with consent and cost review; no subscriber database here.
- Stories/recipes/press/testimonials: add static routes and content collections, with owner consent and verified claims.
- Square catalog sync: an adapter can normalize public catalog data to this same menu shape. See SQUARE.md; no token ever belongs in browser code.

A free Git-backed CMS such as Decap could provide a hosted authoring experience but would add GitHub OAuth/auth-proxy setup, maintenance, and image workflows. It is not installed. Square as the product source is usually the more useful next investment if double entry becomes burdensome. The current local notebook is free, understandable, and has no deployed authentication service.
