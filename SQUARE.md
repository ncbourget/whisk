# Square integration

Research checked September 17, 2026 against Square’s official documentation. Account features, region, plan names, and processing rates can change; confirm inside Cindy’s account before launch. This implementation has no access to her account and has not created products, payment links, or transactions.

## Implemented: A — manually maintained menu + hosted links

The site renders menu information from `data/menu.json`. Each product can have a `squareUrl`; `data/site.json.squareUrl` is reserved for a general ordering destination, preferably the Square Online shop if baskets are needed. Customers leave this site to complete checkout on Square. No payment fields, card SDK, tokens, payment logs, or customer database exist here.

This is the least expensive and lowest-maintenance starting point. The cost is double entry: Cindy must keep the website’s price, sold-out status, and description consistent with Square. Square is authoritative for the purchase. See the notebook instructions in CLIENT-GUIDE.md.

[Square Payment Links](https://squareup.com/us/en/payment-links) currently advertises no monthly link fee, with transaction processing fees. The US public page lists 3.3% + 30¢ for new customers; Cindy’s actual agreement and payment method may differ. No plan upgrade is necessary merely to store a public link on this website.

## Choose the right workflow

| Customer need | Proposed setup | Important distinction |
| --- | --- | --- |
| Pay for one known item or fixed box | Item-specific Square Payment Link | Website button sends the buyer to the matching item. |
| Several items in one basket | Square Online shop linked from the general order button | This site does not manufacture a local cart from unrelated links. Configure the shop separately. |
| Order now for a published pickup window | Hosted Square workflow configured by Cindy | Instructions alone do not schedule or reserve a slot. Test actual checkout. |
| Select a future pickup time for currently available items | Square Online scheduled pickup, if enabled in the account | Confirm available scheduling options and plan in Cindy’s dashboard. |
| Holiday-style items sold ahead of their availability date | Square’s formal preorder feature | Square’s documentation lists eligible Plus/Premium plans. Not silently enabled here. |

Square distinguishes scheduling existing available items from formal preordering for later availability. Its [preorder documentation](https://squareup.com/help/us/en/article/8285-sell-items-as-preorders-with-square-online) lists Square Online Plus/Premium and Square Plus/Premium subscriptions. That feature’s pickup windows and cutoffs are managed in Square. Calling a button “preorder” does not activate it.

## Owner setup

Create the real catalog items, prices, and tax/fulfillment settings in Square. Copy each public item link into its notebook entry. The [payment-link setup guide](https://squareup.com/help/us/en/article/6692-get-started-with-square-checkout-links) describes creating and sharing links, optional custom fields, and deactivation. Notes can use an optional field if available in the chosen flow; do not treat a free-text note as a guaranteed pickup reservation.

The website accepts verified Square-owned URL families. If Cindy uses a custom-domain Square shop, Nate should verify that domain and extend the allowlist. Never put an access token in a link or JSON file.

After the real data and policies are reviewed:

1. Set global and item URLs.
2. Match prices, item variations, stock, and availability in Square.
3. Configure actual pickup instructions, dates, locations, and cutoffs in Square.
4. Set the site’s business time zone, optional ordering windows, and an open business status.
5. Add the customer-support email, pickup note, and agreed refund policy.
6. Test the complete purchase and receipt flow. Check the owner notification too.
7. Turn off demo mode and enable ordering only when everything is ready.

For a closing window or sold-out product, disable sales in Square first, then update and publish the website. A previously copied Square URL remains outside this site’s control.

## Confirmation and failure

Square handles the confirmation/receipt. This version does not redirect to a pretend “payment successful” screen. A buyer returning to Whisk is not evidence of payment. If a customer reports failure, Cindy should check Square before asking them to retry. No automated external checkout-uptime check is implemented.

The custom site does not decrement inventory, reserve stock, apply taxes, calculate refunds, or promise a pickup time. Those are Square/account-operational responsibilities.

## Alternative B — Square becomes the product source

Square’s [Catalog API](https://developer.squareup.com/docs/catalog-api/what-it-does) exposes items, variations, categories, and images; stock is a separate Inventory concern. Catalog access is authenticated. It is not a public browser feed, and a catalog item does not inherently supply a ready public checkout URL.

A proposed future adapter could run during a trusted build or in a tiny serverless service. It would map selected catalog variations to this project’s existing menu fields, preserve editorial allergen/storage/featured fields, and publish only customer-visible fields. Keep the manual menu as a last-known-good fallback. For a small bakery, a build-time snapshot is simpler than making every customer depend on a live API call, but it is not real-time inventory.

If dynamic payment-link creation becomes necessary, Square’s [Checkout API](https://developer.squareup.com/docs/checkout-api) uses `CreatePaymentLink` for hosted checkout. Design a server-side endpoint that accepts allowlisted variation IDs and quantity, resolves authoritative prices server-side, uses idempotency, and returns only the hosted URL. Add rate limits and genuine fulfillment validation. Do not accept browser-supplied prices as truth.

Secrets would belong in a hosting provider’s encrypted secret store or trusted CI secrets, never in public JSON, source files, client scripts, logs, or committed environment files. Only then add an `.env.example` with variable names and blank values. OAuth is appropriate if expanded beyond Cindy’s single account. Signed webhook verification would be required before using notifications to represent paid orders; a browser redirect is not verification.

**B is intentionally not implemented.** It adds credential lifecycle, sync failures, webhook/build monitoring, and more maintenance. Evaluate it once manual double entry becomes a real burden, not before.

## Required checkout acceptance test

Use Cindy’s actual intended workflow. If testing a future API integration, use Square Sandbox separately; this static-link implementation has no Sandbox API client.

- Confirm business identity, item/variation, quantity, amount, taxes, and pickup location/date/time.
- Test one item, sold-out rejection, closed cutoff, and a basket if a shop is configured.
- Check whether the intended note field appears and reaches the owner.
- Cindy/Nate place an authorized low-value real order; confirm charge, receipt, and owner notification.
- Test the refund process and customer notification; processing-fee treatment depends on the account’s terms.
- Test checkout cancellation, back navigation, mobile wallets if offered, and a customer who accidentally retries.
- Verify direct Square links cannot bypass stock or time restrictions.

No live transaction was performed during this build.
