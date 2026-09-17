# Whisk — first-version project report

Completed locally in `/Users/admin/whisk`, September 17, 2026. Repository remote verified as `https://github.com/ncbourget/whisk.git`. This is a comprehensive design/engineering preview, **not a launched or transaction-tested business website**.

## 1. What was built

Eight public pages: Home, Menu & Order, About, Find Whisk, FAQ, Contact, an Order destination, and a styled 404. Also a form-based content notebook with local save/preview, photo uploads, backups, download/import support, and understandable editing controls. All source and generated pages are in the existing repository directory.

## 2. How the site works

Normal links navigate between static HTML pages. Product details, availability, status, and events are generated from three JSON files. JavaScript adds menu filtering, clipboard sharing, photo-failure handling, and closing of stale time-limited order links. The actual menu is already in HTML; it is not waiting on a browser data fetch. Square owns the payment experience.

## 3. File structure

- `data/`: business, menu, and event content.
- `assets/`: CSS, vanilla JavaScript, temporary brand/food/trailer illustrations, and future owner photos.
- `templates/page.html` and `scripts/build.py`: shared shell and static publishing.
- `editor/` and `scripts/serve.py`: local content notebook and loopback-only server.
- Route folders and root HTML: generated customer pages.
- `tests/`: isolated fixtures and behavior/validation tests.
- `.github/workflows/check.yml`: source/content checks and a portable build artifact.
- `deployment/github-pages.yml.example`: inactive optional deployment workflow.
- `README.md`, `ARCHITECTURE.md`, `CLIENT-GUIDE.md`, `SQUARE.md`, `DEPLOYMENT.md`, `LAUNCH-CHECKLIST.md`, `CONTENT-NEEDED.md`: handover documentation.

## 4. Design rationale

A pantry-label identity, large serif headlines, off-white paper, dark ink, restrained red, and a silver trailer give the site a specific small-bakery character. The trailer is the hero’s central device; its service window is a real, keyboard-accessible menu link. A conventional menu button remains prominent. Small original whisk/food sketches stand in for artwork and photography that were not supplied. Navigation stays visible on mobile rather than hiding essential actions behind a scripted menu.

No photographs were available to inspect, so **no claim is made that the illustration reproduces Cindy’s actual trailer**. Refining it against the real photos is part of the remaining art direction.

## 5. Content management

Double-click `Start Whisk.command` to open the local notebook. It presents regular forms, checkboxes, photo uploads, and date/time controls. Save & preview validates the entire draft, backs up prior JSON, and generates the website. GitHub Desktop handles review/commit/push. A configured eligible host can build from those pushes.

The notebook on a static host can export changed JSON files for upload through GitHub; it cannot write to the public repository. This avoids deploying an authentication service. The tradeoff is that Cindy still needs a short initial GitHub Desktop walkthrough and Python installed on her editing computer.

## 6. How Square works

Version A is implemented: per-item hosted Square URLs and an optional general Square shop URL, centrally configured in content. No card fields, raw payment data, access token, API client, or backend integration is present. Individual links never silently substitute an unrelated general checkout link.

Checkout is blocked by demo mode, disabled ordering, closed status, global/item windows, sold-out state, or a missing item URL. Stock, tax, fulfillment, and real cutoffs must also be enforced in Square. A multi-item basket lives in Square Online if configured; this website does not create a fake cross-link cart. Square’s formal preorder feature has eligible paid-plan requirements. See SQUARE.md for official sources and the future Catalog/API tradeoff.

## 7. What Cindy can edit herself

Names, descriptions, prices, categories, item order, visibility, sold-out state, featured/seasonal flags, tags, allergens, photos/alt text, storage notes, Square links, status, hours, pickup/cancellation notes, email/phone, social profiles, introductory copy, and upcoming/cancelled stops. The client guide explains each operation, previewing, publishing, and recovery.

## 8. What Nate should edit

Layout, brand identity, typography, trailer artwork, integration behavior, hosting/DNS/HTTPS, first-launch configuration, unfamiliar timezone/currency settings, and new functionality. Nate should help with the first Square purchase/refund/pickup test and check the licenses and food-policy wording with Cindy.

## 9. What is currently placeholder

All four sample products, prices, descriptions, draft story text, generic food/allergen/pickup/refund wording, original provisional trailer/whisk/food drawings, temporary favicon, currency/time-zone defaults, and the unconfigured social-sharing image slot. No sample venue address, email, phone, domain, or social profile has been invented. Preview messages explicitly identify the menu as sample content.

## 10. What still needs to be provided

Real trailer references and licensed kitchen artwork, food photographs, approved menu and prices, public contact details, social URLs, operating area/hours/first events, domain, actual Square links and account workflow, approved food/pickup/refund policies, and final brand/social assets. CONTENT-NEEDED.md separates launch requirements from optional additions.

## 11. Current limitations and verification

**Verified:**

- Eleven Python tests pass: commerce gates and cutoff boundaries; missing-link behavior; empty/all-sold-out menus; expired/cancelled events; unsafe URLs and paths; escaping; invalid content; root and `/whisk` asset/navigation paths; static content; real metadata generation; current owner data validity.
- JavaScript syntax checks pass for the public enhancements and notebook.
- Eight public pages checked in the in-app browser at 320, 375, 430, 768, 1024, and 1440 widths: 48 checks, no horizontal overflow or broken loaded images. A tablet overflow discovered during testing was fixed.
- Desktop and mobile layouts visually inspected, including homepage, menu, and notebook.
- Menu filtering, ingredient disclosure, keyboard skip link/focus, keyboard FAQ opening, copy-link sharing, and styled nonexistent-route behavior tested.
- Local save/preview verified; sold-out state changed and reflected on the menu, then restored.
- A temporary event entered using local date/time controls rendered as the correct EST interval; deletion and the empty state were verified, then original content restored.
- A disposable PNG uploaded through the notebook successfully; original sample photo restored and test upload removed.
- A temporary menu snapshot with **zero script elements** still displayed all four items and hid JS-only filters. This tests static rendering; it is not a full browser JavaScript-disable certification.
- A deliberately broken image exposed the intended photo fallback and retained all menu text.
- Initial public-page checks produced no console warnings/errors. Deliberate missing-route/image tests naturally generate expected failed requests.

**Not yet verified / intentionally absent:**

- Cindy’s real Square account, external checkout links, payments, refunds, notifications, and pickup operations.
- Production hosting, domain/DNS, certificates, live social previews, or QR codes.
- Independent Safari/Chrome device passes, a formal screen-reader/WCAG audit, and final Lighthouse measurements. Reduced-motion rules were reviewed in CSS; an OS-level preference test remains in the launch checklist.
- Real licensed artwork and responsive photo derivatives. Photos resize/crop responsively, but there is no automatic compression, metadata stripping, or generated `srcset` pipeline.
- Live inventory synchronization or automatic status/event rebuild scheduling. Website availability is not an enforcement boundary; Square must enforce actual sale rules.
- Remote CMS authentication or one-click cloud publishing from Cindy’s notebook.

Changes remain local and uncommitted. No deployment, DNS update, paid subscription, or real transaction was made.

## 12. Optional future improvements

Square Catalog normalization to reduce double entry, an owner-friendly remote CMS if needed, image optimization at build time, catering/private-event inquiries, gift-card links, seasonal collections, stories, and an optional newsletter. These extension points are documented without installing speculative services.

## 13. Exact GitHub Pages deployment steps

DEPLOYMENT.md contains the specific repository settings, inactive workflow activation, build/output configuration, manual Actions deployment, basePath settings, verification, and HTTPS steps.

**Resolve eligibility first:** GitHub’s current [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) prohibit sites primarily facilitating commercial transactions. This bakery ordering website should not be assumed eligible. The project stays portable, and a Cloudflare Pages publishing path is documented as an alternative to evaluate. GitHub remains the source repository either way.

## 14. Exact GoDaddy connection steps

DEPLOYMENT.md includes GoDaddy Domain Portfolio navigation, preserving email records, the four GitHub A records and the `www` CNAME for an eligible Pages deployment, domain-first configuration, DNS propagation, HTTPS, and apex/www verification. It separately explains Cloudflare’s subdomain versus apex requirements. No guessed CNAME file or real DNS edit was created.

## 15. Pre-launch procedure

Follow LAUNCH-CHECKLIST.md in order: real content and asset/license review; Square purchase/refund/notification/pickup tests; device/accessibility/performance checks; eligible hosting and domain setup; metadata and HTTPS checks; Cindy’s editing/publishing walkthrough; then QR printing and public announcement. The full checklist includes failure states and direct-Square cutoff/sold-out tests so a cached website does not create a false sense of protection.
