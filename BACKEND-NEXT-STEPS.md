# Whisk: phone publishing and order-ahead

## Working now

The default homepage is the former concept design. Menu, About, Find Us, FAQ and Contact use the new type and shared navigation. Every visible editor menu entry generates `/menu/<id>/` and a link from the menu at build time. This is the Python builder, not Jekyll or a Gemfile.

The four earlier pages are frozen at `/index-concept/`, `/menu-concept/`, `/about-concept/`, and `/find-us-concept/`. Their source HTML and copied assets live under `snapshots/`; ordinary builds must never regenerate these sources. They are unlinked and noindex, but publicly accessible by URL. They are not private or access-controlled.

The Whisk cart stores only item IDs and quantities in the customer's browser. It supports adding, quantity changes, removal and a sample subtotal. It does not reserve stock, create a Square order, accept payment or notify Cindy. Checkout is intentionally disabled everywhere. Changing an editor ordering toggle cannot enable this new checkout.

## Remaining implementation: phone publishing

Hosted `/editor/` remains authenticated download-only. Local editor saves/uploads still work. A mobile layout alone does not make hosted publishing functional.

Recommended next implementation: authenticated server-side Git publishing, keeping GitHub invisible to Cindy. It fits the existing static build and avoids adding a metered image-storage subscription.

1. Finish Cloudflare Access for the exact production editor and admin API routes, restricted to Cindy and Nate's exact emails. Configure the Worker issuer, audience, hostname and email allowlist as described in ARCHITECTURE.md. Test anonymous and alternate-host access.
2. Give the Worker a server-only, repository-scoped GitHub credential with Contents read/write for `ncbourget/whisk`. Never paste it into source, a browser field in Whisk, or a public file. Use a Cloudflare secret. GitHub App installation tokens are preferable for rotation.
3. Implement authenticated content reads from the current Git revision, validated image uploads and atomic publishing of content plus images. Require revision matching to prevent overwriting concurrent edits; enforce same-origin writes, payload limits, image signatures, exact schema and fixed allowed file paths. Never expose a general GitHub proxy.
4. Save drafts separately from publishing. Publish creates a commit that triggers Cloudflare's existing build; show pending, succeeded or failed deployment status in the editor. A saved commit is not yet a successful deployment.
5. Test from Cindy's phone: sign in, add product, upload photo, publish, then verify the new public product page. No GitHub Desktop step should remain.

## Remaining implementation: Square order-ahead

Nate and Cindy's setup today:

1. Create the real cookie and other products/variations in Square, with confirmed prices, taxes and inventory handling.
2. Configure the actual pickup location, hours and preparation time. Decide when ordering stops before closing, and how Cindy pauses orders or marks items sold out.
3. Set up the seller device/app and its order notifications. Confirm those notifications with an actual controlled test; do not assume a custom API order behaves exactly like a Square Online order.
4. Create a Square developer application and start in Sandbox. Store credentials only as Worker secrets. Record location and catalog variation IDs for the integration; these IDs are not passwords.

Implementation after configuration:

- The Whisk cart remains on Whisk. A public, rate-limited checkout endpoint receives only item IDs and quantities, validates them, then looks up trusted prices and Square variation mappings server-side.
- Recheck availability, stock, ordering windows, pickup location, preparation time and capacity at checkout. Never trust browser totals or rely on static pages for live stock control. A Square Online hours setting must not be assumed to enforce a separately built API checkout.
- Create one Square order with pickup fulfillment and one Square-hosted payment checkout for the whole cart. Confirm the chosen Checkout API flow supports all required pickup information in Sandbox before enabling it.
- Use idempotency to avoid duplicate orders. Verify signed Square webhooks server-side and deduplicate events. Only a verified paid order counts as placed; returning to a success URL is not proof of payment.
- Verify the paid pickup order appears in Cindy's order workflow and triggers the intended notification. Test closing time, sold-out items, failed payment, retries, refunds and ready-for-pickup handling.
- Keep checkout disabled until these end-to-end checks pass. No card data belongs in Whisk or its repository.

Square references: [Checkout API](https://developer.squareup.com/reference/square/checkout-api), [pickup fulfillments](https://developer.squareup.com/docs/orders-api/fulfillments), [pickup detail fields](https://developer.squareup.com/reference/square/objects/OrderFulfillmentPickupDetails).

Static hosting stays on the existing free Cloudflare plan. Payment processing still has Square transaction fees. Avoid enabling paid Workers or metered storage as an incidental setup step; recheck current provider limits before choosing any new service.
