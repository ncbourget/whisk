# Architecture

## Why this structure

The public site is static, multi-page HTML with CSS and small progressive enhancements. JSON is the single source of frequently edited content. A dependency-free Python publisher exists because rendering the menu only in browser JavaScript would fail the brief’s no-JavaScript and discoverability requirements. It also centralizes repeated headers and metadata. This is a small publishing tool, not an application framework or a browser runtime dependency.

`data → scripts/build.py → HTML, sitemap, robots → any static host`

Cindy’s local workflow adds `editor → loopback server → validation + backup → JSON + HTML`. The optional Cloudflare server module authenticates the hosted editor and serves its draft data read-only. It has no database, publishing token, or hosted mutation capability. The public website remains static.

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
 server/access.mjs            server-only Cloudflare JWT verification
 server/handler.mjs           authenticated read-only admin routes
 scripts/build-access.mjs      bundles admin content into the server module
 tests/test_site.py            safety, content, routes, metadata tests
 tests/test_security.py        local authorization and artifact isolation
 tests/access.test.mjs         signed-token and Worker endpoint tests
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

## Authentication boundary (security audit: September 17, 2026)

`/editor/` is privileged. Its URL is public knowledge. Neither the route name, a hidden button, robots.txt, CORS, nor a frontend hostname check grants authorization. Production authentication belongs to Cloudflare Access, and the Worker independently verifies authorization before returning any administrative response. There is no frontend password system.

### Complete endpoint / write inventory

| Surface | Hosted Cloudflare behavior | Local notebook behavior |
| --- | --- | --- |
| `GET/HEAD /editor`, `/editor/`, `/editor/index.html` | Valid Access JWT + exact email + canonical hostname required | Valid OS-launched session cookie required |
| `GET/HEAD /assets/js/editor.js`, `/assets/css/editor.css` | Same authorization as editor HTML | Same local session required |
| `GET/HEAD /api/content` | Authorized full editor snapshot; `capabilities.write=false` | Authorized full snapshot + revision; `capabilities.write=true` |
| `POST /api/content` | Authenticate, then 405; no hosted save exists | Session AND exact same-origin/Host check, JSON type/size, revision, schema and URL validation, render preflight, backup, then save |
| `POST /api/photo` | Authenticate, then 405; no hosted upload exists | Session AND same-origin/Host check, size/type/signature checks, safe filename, then local image write |
| Other methods or `/api/*` routes | Administrative methods authenticated; unsupported methods 405, unknown reads 404 | No PUT/PATCH/DELETE handler; unknown POST rejected; no generic filesystem write |
| `/data/*.json`, dotfiles, source, backups | No static copy; canonical `/data/*` goes through auth and still returns 404 | Never served, including HEAD and encoded traversal |
| GitHub / Cloudflare deployment | GitHub push permissions and Cloudflare account authorization control publication | CLI/OS filesystem access is the trusted owner boundary |
| Square | Actual orders/payments/stock changes occur in Square under Square's own account permissions | Only public Square checkout URLs are stored; no Square API credentials |

The two local POST handlers are the complete website write API. A content save can change menu items, events, business status, Square links, and site configuration; therefore ALL fields share the same server-side authorization. Image upload has its own equally enforced check. Import/download and add/remove/reorder controls only modify browser drafts until an authorized local save; editing client JavaScript cannot authorize a save. There are no other Workers, Pages Functions, webhook receivers, OAuth callbacks, catalog-sync endpoints, storage bindings, or hosted GitHub write tokens in this repository.

### Hosted Access enforcement

`server/access.mjs` uses the maintained `jose` library, rather than handwritten JWT cryptography. It verifies the RS256 signature using the configured team's HTTPS JWKS, expected issuer, one application audience, expiration, issued-at and optional not-before, subject and email. Only the two exact configured addresses are accepted. It ignores unsigned email headers and does not trust a merely decoded JWT. Signing keys are cached briefly and refreshed by the library. Failed key retrieval, invalid tokens, missing/malformed configuration, and noncanonical administrative hostnames fail closed. Cloudflare recommends verifying the JWT at the origin even behind Access. [Cloudflare JWT verification](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

Runtime-only settings: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_HOSTNAME`, and `ADMIN_EMAILS` (a JSON array of exactly Cindy's and Nate's distinct addresses). No real values or fallback users are committed. No request-supplied issuer, audience, host, or email may override them. Application audiences and public signing keys are not credentials; keep all configuration server-side regardless. Set the email list as a Cloudflare secret for privacy. Never expose bindings through a diagnostics endpoint or frontend build variables.

`server/handler.mjs` authorizes every administrative request, then dispatches. All hosted mutation methods return 405 even after successful authentication. No persistence binding exists. Administrative responses use `private, no-store`, frame denial, no-referrer, a restrictive CSP, and no CORS grant. There are no service-token or development bypasses. Only one exact HTTPS administrative hostname is accepted; direct `pages.dev`, preview, branch aliases, or other custom-domain routes are denied unless that exact hostname is deliberately selected as the canonical host.

The optional `npm run build` creates `_site/_worker.js` with the editor HTML, editor script/styles, and complete content snapshot inside the **server module**, never as downloadable static files. `_routes.json` invokes the Worker for `/editor*`, `/api*`, `/data*`, `/assets/js/editor*`, and `/assets/css/editor*`. Other traffic remains static. Missing code, encoded aliases, unsupported routes, or quota fallback cannot uncover a static editor/data copy because none exists. Use Cloudflare's **Fail closed** setting anyway. Do not serve this Worker artifact with a generic static server or another host: the `_worker.js` file contains the administrative snapshot and must be executed server-side. The plain Python-only build omits the hosted editor entirely. [Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/), [routing and fail-closed behavior](https://developers.cloudflare.com/pages/functions/routing/)

### Local authorization

`Start Whisk.command` launches a loopback-only server and opens a cryptographically random, single-use launch link. The code expires after five minutes. The server exchanges it for an eight-hour, host-only, HttpOnly, SameSite=Strict cookie and redirects immediately to `/editor/`; the code is never embedded in HTML, client JavaScript, a public file, or a saved configuration. Request logging suppresses the credential URL. The session is kept only in server memory and is invalidated on restart. This is an OS-authorized local capability, not a homemade web password or an alternative production login. The local cookie omits Secure only because the listener is plain HTTP on loopback; it must never be forwarded through a proxy, tunnel, or public interface.

Every local administrative GET/HEAD requires that session. Every local POST independently requires the session and matching Host/Origin before reading the body or modifying a file. The launch code is one-use, not a permanent backdoor. Unauthenticated sessions cannot request a new code over HTTP; the owner must restart from the OS. Open the notebook using the launcher rather than bookmarking a launch URL. Possession of the local OS account is trusted: malware or another process already running as that user can edit repository files directly and is outside this web boundary.

Local serving uses an explicit public-file allowlist, not a directory server fallback. Source, raw JSON, dotfiles, backups, directories and symlink escapes cannot be fetched via GET or HEAD. Unpublished uploaded photos are viewable only by the authenticated local owner until referenced by visible content. Filesystem writes preserve existing validation, conflict checks and backups. The editor UI's `capabilities.write` flag describes server support; it does not authorize anything.

### Public data, source control, and credentials

Public GETs serve the rendered bakery pages, visible product images, styles, fonts, and ordinary progressive-enhancement script. Embedded ordering JSON contains only status/window information and visible item IDs/windows needed to close stale checkout links. Full source JSON, hidden items' images, unknown files, old output leftovers, and admin resources are excluded from the public static artifact. Content schemas reject unknown fields and non-image/symlink asset references.

**A public GitHub repository and its history are public.** Access cannot make committed drafts, addresses, historic uploads, workflow artifacts, or previously deployed versions confidential. Treat committed source content as publishable; make the repository private before keeping confidential drafts there. Remove old public deployment artifacts and inspect history if sensitive material was previously committed. No actual account token/private key was found in the targeted audit of 62 text files and the one available Git commit (private-key, GitHub-token, AWS-key, Square-token and JWT patterns), but this is not a guarantee against every secret format. No deployment or repository-visibility changes were made in this pass.

There is no Cloudflare API token, GitHub publishing token, Square credential, password, or session secret embedded in browser JavaScript or committed configuration. Ephemeral local test signing keys are generated in memory, not fixtures. `.env*`, `.dev.vars*`, private-key files, local backups and Wrangler state are ignored. Ignore rules are not secret scanning: review commits, use GitHub secret scanning/push protection where available, and rotate any credential ever exposed. Never put credentials into content fields. If Square API sync is later added, credentials belong only in server-side secret bindings.

### Future hosted writes: requirements, not an enabled feature

Do not add a write handler by simply turning on the Save button. It must first use the same verified JWT/email/hostname boundary, then enforce same-origin CSRF protection, explicit method/content-type/size limits, input schemas and Square URL validation, concurrency control, audit logging without credentials, least-privilege persistence, and error rollback. Any new hostname/endpoint/storage route must be added to this inventory and negative authorization tests. Protecting only `/editor/` is never sufficient. Never proxy this local Python server publicly to enable saving.

Exact Access OTP setup, environment bindings, preview handling and release tests are in DEPLOYMENT.md. Cloudflare login has not been configured or tested against the real account; unknown emails, team name, audience, and domain are deliberately not guessed.

## Performance, accessibility, and failure states

Three self-hosted SIL Open Font License families: Fraunces, Public Sans, and IBM Plex Mono. No external font requests or scripts, trackers, map embeds, frameworks, video, or recurring font licensing fees. Brand tokens and font declarations live in assets/css/brand.css; public and editor styles consume them. Above-the-fold trailer is a small SVG; below-fold images lazy-load. All product and event content is present in HTML. Filters and copy-link buttons appear only when JS initializes. Native links, buttons, details/summary, form labels, semantic landmarks, skip link, focus rings, responsive widths, and reduced-motion CSS provide the foundation for WCAG 2.2 AA; formal certification is not claimed.

Focus styles and high-contrast text are retained. Decorative SVGs are hidden from assistive technology. Mobile navigation remains a short, visible row rather than depending on a hamburger script. All filtering controls support keyboard activation and announce result counts. Photo failures expose a text fallback. Empty menus and events are intentional. No social URL means no fake social link. Checkout trouble points customers back to Cindy; the site cannot detect the uptime of a cross-origin checkout in advance.

Images have stable dimensions; portrait/square/landscape containers permit owner crops. Native `<img>` is the reusable image component. Automatic responsive `srcset` variants and compression are not claimed: this version uses one optimized upload per item. Add a build-time image optimization step if real assets justify it. Uploaded image metadata is not automatically removed.

## SEO and preview isolation

Pages have distinct titles/descriptions and Open Graph title/type/description. Domain and basePath generate canonical/OG URLs and sitemap when known. The social-image field accepts the final 1200 × 630 image. No fake domain or social-image URL is emitted. Demo builds are noindex, have a disallow robots file, an empty sitemap, and no fabricated LocalBusiness address/hours schema. Live homepages emit Bakery schema containing only configured facts. No address, coordinates, review, rating, or operating hours are guessed. Mobile pop-up hours should not be represented as permanent storefront hours.

Before removing demo mode, configure the real origin. Sitemap/robots and status information update on build. Robots directives are search hints, not privacy protection.

## Hosting and costs

GitHub Pages preparation is retained, but its current commerce restriction makes it unsuitable to assume as the production host. See DEPLOYMENT.md. Public-only static output works on an eligible static host. The authenticated hosted editor specifically uses Cloudflare Pages advanced mode and Access; it is not portable static content. Square payment-processing fees still apply; formal preorder features require an eligible paid plan. No subscriptions were enabled here.

## Extension points, not speculative features

- Gift cards: add a verified Square-hosted gift-card URL and one menu/footer link.
- Catering/custom cakes/private events: add a contact page subsection; introduce a form processor only if needed and with a spam/privacy plan.
- Seasonal menus: existing seasonal flag, availability, and windows; a collection field can group releases later.
- Multiple trailers: add an event `trailerId` and filter, keeping event locations independent of the business profile.
- Merchandise: new categories plus Square products, with shipping configured in Square.
- Newsletter: optional provider integration with consent and cost review; no subscriber database here.
- Stories/recipes/press/testimonials: add static routes and content collections, with owner consent and verified claims.
- Square catalog sync: an adapter can normalize public catalog data to this same menu shape. See SQUARE.md; no token ever belongs in browser code.

A free Git-backed CMS such as Decap could provide a hosted authoring experience but would add GitHub OAuth/auth-proxy setup, maintenance, and image workflows. It is not installed. Square as the product source is usually the more useful next investment if double entry becomes burdensome. The local notebook needs no paid service. Hosted notebook authentication is prepared for Cloudflare Access; hosted publication remains Git-backed and explicit.

## Storefront migration and cart boundary — September 24, 2026

`scripts/storefront.py` generates the promoted homepage, shared inner-page design, item pages and cart. `snapshots/` contains frozen public design references with their own asset copies. The public build and local server explicitly allowlist these outputs; they do not expose editor source, raw content JSON, backups or Worker source.

`assets/js/cart.js` is a non-authoritative browser cart. Its public data is limited to visible item IDs, names, prices, sold-out status and public image information. It holds no customer/payment/admin credentials. It cannot place orders, reserve stock or publish edits. There is no new public write endpoint. The existing Access verification and hosted 405 write refusals remain intact.

Hosted phone publishing and Square order creation are NOT implemented by this migration. See BACKEND-NEXT-STEPS.md for the required server boundaries, configuration and acceptance tests. Future customer checkout belongs on a dedicated public commerce route, separate from privileged `/api/` editor routes; admin Access must never be bypassed to make customer checkout work.
