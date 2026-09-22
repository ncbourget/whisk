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
