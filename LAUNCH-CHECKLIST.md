# Whisk launch checklist

## Content and ownership

- [ ] Confirm exact domain, account owners, public email, optional phone, region, currency, and time zone.
- [ ] Replace every sample menu entry, sample price, temporary description, and sample allergen statement.
- [ ] Supply real food and trailer photography; update the trailer drawing against actual references.
- [ ] Review final logo, favicon, fonts, colors, copy, and spelling with Cindy.
- [ ] Verify copyright/license scope for all supplied artwork and photographs; record asset provenance.
- [ ] Compress final photos, remove unwanted metadata, verify crop/alt text and no visible broken images.
- [ ] Confirm hours, upcoming venue addresses, directions, and all dates/times.
- [ ] Enter real Instagram and Facebook profile URLs.
- [ ] Review food/allergen/cross-contact wording, dietary tags, storage, pickup, cancellation/refund, and missed-pickup policies.
- [ ] Supply approved social image (1200 × 630) and alt text.
- [ ] Remove demo mode only when sample material is gone; verify real metadata and visible content.

## Square end-to-end — Cindy/Nate to complete

- [ ] Confirm account, merchant identity, plan, country, currency, and actual fees.
- [ ] Choose payment links versus Square Online basket; decide whether paid formal preordering is needed.
- [ ] Connect real per-item and general ordering URLs; no access tokens in repository or browser.
- [ ] Match menu price, variation, taxes, quantities, and inventory in Square.
- [ ] Confirm pickup date/time/location, capacity, order deadlines, and notes field in real checkout.
- [ ] Attempt to order a sold-out item and outside a cutoff directly in Square; verify rejection.
- [ ] Place an authorized small test order. Check amount, tax, receipt, customer confirmation, and owner email/order notifications.
- [ ] Check multi-item basket and mixed pickup availability if enabled.
- [ ] Test cancellation/back navigation, uncertain-payment recovery, and the process for duplicate attempts.
- [ ] Test refund and customer notification; document Cindy’s procedure.
- [ ] Walk through physical pickup using the test order and receipt.
- [ ] Enable ordering and choose the correct website status only after passing the above.

## Technical acceptance procedure

1. [ ] Run `python3 -m unittest discover -s tests -v` and `python3 scripts/build.py --output _site`.
2. [ ] Open Home, Menu, About, Find Whisk, FAQ, Contact, Order, and 404. Check navigation, unique titles, no missing assets, and console errors.
3. [ ] Check widths 320, 375, 430, 768, 1024, and 1440+; look for horizontal scrolling and clipped text after real content is added.
4. [ ] Test actual Safari/iPhone and Chrome/Android, including checkout. This build’s in-app browser checks do not replace device testing.
5. [ ] Keyboard through skip link, navigation, category filters, disclosures, and links. Confirm visible focus, readable order, and no traps.
6. [ ] Test screen reader headings/labels, 200% zoom/text, contrast, reduced-motion preference, and touch target spacing.
7. [ ] Disable JavaScript: menu, navigation, location, and existing order links must remain useful. Square enforces real cutoff/inventory rules.
8. [ ] Test empty menu, no featured items, all sold out, no upcoming stops, cancelled event, missing social URLs, failed photo, and invalid checkout link.
9. [ ] Edit price, sold-out state, photo, hours, and a stop in the notebook; save, preview, and publish a reversible change.
10. [ ] Check errors do not overwrite valid content; confirm backups and Git recovery with Nate.
11. [ ] Run Lighthouse on the final hosted site with real photos and check performance/accessibility/SEO. No benchmark score is claimed for this preview.

## Hosting, discovery, and handoff

- [ ] Resolve GitHub Pages commercial-use restriction; choose and configure an eligible host.
- [ ] Confirm build/publishing branch, output folder, failed-build handling, and rollback procedure.
- [ ] Connect domain with owner authorization; preserve mail and verification records.
- [ ] Verify DNS and HTTPS; check apex/www canonical redirects and mixed-content errors.
- [ ] Confirm basePath (blank on custom domain), canonical origin, titles/descriptions, sitemap, robots, and accurate Bakery schema.
- [ ] Remove noindex/disallow only for approved production content; keep previews out of search.
- [ ] Inspect Open Graph/messaging previews using the real domain and photo.
- [ ] Check genuine HTTP 404 behavior on the selected host.
- [ ] Decide whether analytics are needed. Default is none; if adding a privacy-conscious service, review current cost, IP/log handling, and consent needs first. No automatic cookie banner.
- [ ] Create and physically test a static QR only after the final `/menu/` URL works.
- [ ] Complete Cindy’s notebook/publishing walkthrough and “contact Nate” handoff.
- [ ] Recheck live website and Square together immediately before announcing launch.

## Administrative security release gate

- [ ] Follow DEPLOYMENT.md sections 3–7; use the exact two-email OTP policy and matching runtime allowlist.
- [ ] Protect `/editor`, `/api`, editor JS and raw-data paths in the same Access application; verify tokens server-side.
- [ ] Fail closed enabled; no static editor/raw JSON in output; no caching override.
- [ ] Public home/menu work anonymously; direct anonymous API reads/writes fail.
- [ ] Forged identity headers cannot authorize; other hostnames and previews cannot bypass.
- [ ] Both allowed owners tested; a non-allowlisted user denied.
- [ ] Old deployment URLs, public repository/history and rollback versions reviewed.
- [ ] No credentials in source, browser assets, content, logs, or Git history.
- [ ] Local Save and Upload require session plus same origin; hosted writes remain disabled.
