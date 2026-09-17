# Whisk art-direction refinement — September 17, 2026

This refines the existing site rather than replacing its architecture. The attached brief described the identity; no actual brand screenshot, logo masters, trailer photos, or licensed packaging artwork were supplied. Colors and artwork remain provisional.

| Area | Result |
| --- | --- |
| 1. Typography before/after | Replaced the serious system-serif/italic emphasis and tracked sans labels with three disciplined roles: display serif, reading/UI sans, informational mono. No script UI or added italic voice. |
| 2. Families and rationale | Compared Fraunces, Instrument Serif, and DM Serif Display in a local type study; Fraunces offered softer, more peculiar forms than the delicate Instrument or heavier, formal DM. Compared Public Sans, Archivo, and Work Sans; Public Sans gave the quietest utilitarian reading/UI treatment. IBM Plex Mono makes prices and status distinct without taking over. Selected fonts are self-hosted under included SIL OFL licenses; no font subscription or third-party runtime request. Fraunces uses weight 500, SOFT 40, WONK 1, automatic optical sizing. |
| 3. Scale | Hero approximately 41–86px with responsive overrides; page headings 42–72px; sections 32–50px; product names 22–27px. Body 16px; intro 16–17px; descriptions/navigation/buttons 15px; metadata 13px; prices 15px. Notebook inputs 16px and labels 14px. Small preview/copyright and incidental trailer labels use 11–12px; important status also appears at readable size outside the illustration. |
| 4. Color | Centralized paper #f8f7f2, navy #20283f, provisional blue #b7c4e8, silver #c8cdd3 and white in brand.css. Removed red/green branding. Blue story environment and navy footer add contrast; chrome stays on the trailer. |
| 5. Copy | Kept “Good things. Small batches.” and one “See you at the next stop.” Removed repeated flour/Cindy slogans, decorative signoffs, and elaborate product names. Retained ordering, allergy, demo, availability, and pickup explanations. Sample ingredients and pricing remain explicitly unconfirmed. |
| 6. Layout | Status and location information precede the hero. Kept interactive service-window trailer. Larger lead product plus smaller companions replaces equal featured cards; blue story composition, direct inner-page headings, and quieter information layouts reduce repeated section grammar. Reduced blanket section spacing and decoration. |
| 7. Brand slots | Neutral SVG wordmark, reversed wordmark, W mark, and unused badge slot are ready in assets/brand. They deliberately do not imitate the daughter's script. Replacement paths and sizing instructions are in assets/brand/README.md. |
| 8. Editor | Shares brand tokens; sans controls and section titles, mono labels/status, one serif main title. Simplified colors and retained readable inputs and clearly separated actions. Local save, import/download, upload, validation, and publishing architecture remain intact. |
| 9. Mobile | Header navigation stays visible. Status precedes copy/actions; trailer follows on phones. Featured compositions explicitly rearrange at tablet and phone widths. Narrow menu items stack; editor becomes a single column and its action bar stops sticking on phones. |
| 10. Accessibility | Darkened secondary text on blue panels to preserve contrast. Preserved semantic headings, skip links, native disclosures, alt text, live filter results, reduced motion, and focus indicators. Main buttons/filter controls have at least 44px targets. Navy/paper contrast 13.63:1; navy/blue 8.40:1; muted/paper 5.77:1; white/navy 14.62:1; input outline/white 3.74:1. These checks do not constitute a formal accessibility certification. |
| 11. Left alone | Data schemas and identifiers, prices/availability/Square URLs, demo/payment gates, ordering schedules, browser behavior scripts, editor save/upload server, Git workflow, and Cloudflare deployment architecture. No new framework, dependency service, payment collection, or subscription. |
| 12. Revisit with final files | Approved logo variants, font licensing/preferences, exact colors and clear space; real trailer proportions/reflections; licensed kitchen illustrations; real product photography and crop choices; Cindy's final story/menu and location details. |

## Verification

- Nine routes (eight public pages plus editor) checked for overflow, heading count, and broken loaded images at 320, 375, 430, 768, 1024, and 1440px: 54 combinations, no horizontal overflow or broken loaded images, one H1 each.
- Visual review of desktop, tablet, and phone compositions, with the actual locally hosted fonts loaded. Main computed font roles verified in the browser.
- Local notebook Save & preview succeeded against the updated server. Menu tab controls remain available. Browser menu filter correctly announced one item; ingredient disclosure opened using Enter.
- Existing automated suite: 11 tests passing, including validation, payment gating, ordering windows, escaping, base paths, and static rendering.
- Cloudflare's configured `python3 scripts/build.py --output _site` builds successfully locally with the selected fonts and assets. No remote deployment, DNS change, commit, or push was performed during this pass.

The pre-edit findings are in ART-DIRECTION-AUDIT.md. Branding replacement instructions are in assets/brand/README.md; runtime fonts and source/license records are in assets/fonts/. The local candidate type-study files are ignored and excluded from deployment.

## Subsequent security update

The visual verification above is historical. DEPLOYMENT.md and ARCHITECTURE.md describe the newer authenticated notebook boundary. The Python-only deployment command now emits public files only; use the documented Node/Cloudflare build for the Access-protected hosted editor.
