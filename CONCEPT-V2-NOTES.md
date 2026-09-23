# Whisk / Outside — concept 02

## Scope and route

Isolated homepage at `/concept/`, deliberately noindex. It is not linked from the existing homepage and does not replace it. Preview locally at `http://127.0.0.1:8003/concept/` while the preview server runs. After a normal approved deployment the route is `/concept/` on the production hostname.

Added: `templates/concept.html`, `scripts/concept.py`, generated `concept/index.html`, `assets/css/concept.css`, this document, and `PHOTOGRAPHY-SHOT-LIST.md`.

Modified: `scripts/build.py` to render the additional page and allowlist its stylesheet; `scripts/serve.py` to allow the single new public HTML path. No authentication logic was changed. Existing page markup, shared styles, data, editor, ordering, Worker and Cloudflare configuration remain unchanged.

## Environmental principles

Make the page the world reflected by the trailer. Act I is blue sky, introduction and schematic trailer crossing into grass. Act II is warm packaging paper, a recipe-book heading and four editorial food slots. Act III returns to sky/grass and the existing opening-status message, with a link to current locations.

Provisional CSS variables: sky #88c9f0, sky-light #c3e5f6, whisk-blue #acbde9, grass #a9c943, grass-bright #cee766, leaf #244c32, paper #faf4e5, ink #16241e, sun #fffdf3, silver #b5c5cc. These are relationship studies, not sampled or approved brand colors. Blue dominates the outside sections; yellow-green grounds the trailer; deep leaf green appears in its reflections; warm paper supports reading. Silver is limited to schematic metal and boundaries.

Typography uses only the existing self-hosted Fraunces, Public Sans and IBM Plex Mono families. No handwriting font was introduced. The identity remains a plain provisional wordmark pending the real logo.

## Trailer

The renderer reads the existing provisional trailer SVG without modifying that shared asset. A concept-only body clipping path contains broad irregular bands of sky, glare, leaf shadow and grass, plus narrow vertical white reflections. This is abstract SVG geometry requested by the brief, not a generated photograph or imitation hand drawing. The actual trailer geometry still requires reference photos. The body physically straddles the sky/ground boundary.

The service-window menu link is accompanied by a conventional Explore the menu button. No animation gates navigation. On phones the trailer grows relative to the viewport while surrounding detail is reduced; the menu retains a two-column composition with portrait crops, and the counter/location layouts change to one column.

## Sunlight

A single narrow white highlight travels along a button's top edge on hover or keyboard focus. There are no timers, repeated sparkles or continuous shimmer. Reduced-motion users receive a stationary highlight instead. No JavaScript is needed.

## Honest assets and content

The supplied generated concept image was viewed as reference only. It is not included, cropped, traced or embedded. No new AI imagery, stock photos, pretend food or pretend licensed illustrations were used. Butter and rolling-pin slots identify missing licensed source artwork. All six photo slots are named in the shot list: H01 wide trailer, M01–M04 food, D01 counter detail. C01 is an optional future portrait, not a seventh placeholder.

Menu names/descriptions come from currently available existing records at build time. The sample status is visible. Prices and checkout are deliberately left on the existing menu, so the concept introduces no separate pricing or ordering rules. Hidden products are excluded. No dates, addresses, phone numbers or Square information were invented. Locations, ordering and contact links lead to existing pages.

## Decision before wider rollout

Evaluate the page with Cindy's real wide trailer photo, actual logo and two licensed drawings before extending the design. Does the sky/grass relationship carry through the metal? Does food feel warm against the outdoor colors? Does the mobile window remain a legible menu link? With the logo removed, the reflected environment and trailer crossing the horizon still supply the specific concept; final photographic authenticity remains dependent on Cindy's assets.

## Verification

Cloudflare build succeeded. Existing 18 Python and 5 server authorization tests passed. Original generated pages and shared styles have no git changes. Desktop and mobile browser review checks layout and menu navigation. No deployment or push was performed for this experiment.

## September 23 — authored render composition pass (supersedes schematic layout above)

Nate supplied a non-AI, custom 3D render based on Cindy's trailer. The source on disk was lowercase `airstream.webp`; its casing was corrected to the requested `assets/trailer/airstream.WebP` without recompression or duplication. Dimensions are 2560 × 1440. The build allowlist explicitly copies this exact path, including on case-sensitive hosts.

The hero now uses this image edge-to-edge with eager/high-priority loading and explicit dimensions. Transparent navigation and oversized Whisk typography occupy the sky; offset supporting text and an underlined CTA replace the rigid heading stack. The image supplies the landscape and chrome, replacing the schematic SVG and separate sky/ground blocks. On phones the crop favors the trailer (67% horizontal position); a mobile `<source>` is ready for a dedicated portrait render. The supplementary hero phrase is omitted on phones to keep functional text in the sky.

Removed visitor-facing design-study ribbon, numbered environment labels, schematic/photo-pending captions, artwork-slot labels and all PHOTO NEEDED boxes. One short sample-menu disclosure remains because current products are not a confirmed live offering. No fictional prices, availability or locations were added.

The recipe composition alternates widths, offsets and oversized low-contrast recipe numerals behind real menu text. These typographic compositions stand in for missing photographs without pretending to depict food. Two simple replaceable SVG marks (`data-art="butter"` and `data-art="rolling-pin"`) reserve compositional positions for licensed artwork; they are abstract strokes, not fake hand drawings. The existing illustration assets were not treated as licensed originals. Replace these nodes with supplied licensed exports when available.

The location section returns to an angled crop of the same render. It references the same file, with no copied image. The only motion is a short white underline glint on CTA hover/focus, disabled for reduced motion. Existing production pages, shared CSS, editor, backend, content records and Cloudflare configuration were not redesigned. The one shared build change only includes the concept image in the public asset allowlist.

## Photo menu and meadow refinement

The concept uses the four user-supplied food JPEGs, with existing sample prices ($4.50, $3.50, $4.00, $4.00). Prices remain prototype content; ordering and production menu data are unchanged. The visible sample notice and product-title punctuation were removed as requested. Desktop has a single-line Georgia heading followed by a 0.5pt rule, with VIEW FULL MENU sitting above its right end. Mobile wraps the heading and puts the link on a separate full-width rule, keeping a 2×2 menu.

The lower section uses the supplied `assets/splashscreen/bottom.jpg` as a continuous meadow image; no date or venue was invented. Fine, uneven SVG tears replace the larger zigzags. Assets now follow the user-renamed splashscreen directory. Main/about page image references were repaired for the moved existing trailer SVG; their visual design did not change.

## Logo and caption correction

The supplied `assets/logo/SVG/Asset 1.svg` replaces the serif hero wordmark, with its existing Baked by Cindy lettering retained inside the SVG. The navigation W. has been removed without adding another logo there. All concept captions, navigation, functional links and prices now use 15px Courier New Bold (700), including mobile. Georgia product headings remain headings. Removed the underline glint pseudo-element, hover animation and keyframes; the other site styles have no active animations. Static focus outlines remain for keyboard access.
