# Deploy the secure phone editor

Cindy's approved login: **baker@whiskbakedbycindy.com**. Nate's approved login: **ncbourget0@gmail.com**. Current public hostname: **whisk-dnh.pages.dev**. Previously supplied Zero Trust team name: **whisk-by-cindy**; confirm its exact issuer in the dashboard. The code is implemented; these live account steps and acceptance tests remain required.

## 1. Cloudflare Access

1. Open Zero Trust in the correct Cloudflare account. Keep the Free plan.
2. Under Integrations / Identity providers, add or enable **One-time PIN**. Cloudflare emails the codes; Whisk does not collect passwords or generate codes. [Official OTP instructions](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
3. Under Access controls → Applications, create or edit one self-hosted application named **Whisk administration**. Use a one-hour session. Do not confuse it with the wildcard preview application.
4. Add the exact hostname `whisk-dnh.pages.dev` with each of these paths (without a leading slash): `editor`, `api`, `assets/js/editor.js`, `assets/css/editor.css`, `data`. Keep them in one application so the editor and API use the same audience. Verify parent paths cover their descendants. Do not protect the entire public bakery site.
5. Choose One-time PIN as the login method. Add one **Allow → Include → Emails** policy containing Cindy's exact address and `ncbourget0@gmail.com`. No Everyone, domain wildcard, Bypass, or blanket OTP allow rule.
6. Copy the application's **Application Audience (AUD) Tag**, and confirm the team issuer. Do not copy the audience from the preview app.

The Worker independently verifies signed JWTs, email, audience, issuer, expiry and the exact hostname on every administrative request. Protecting HTML alone is insufficient. [Cloudflare path policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)

## 2. Server runtime settings

Pages → whisk → Settings → Variables and Secrets → **Production**:

| Name | Value | Type |
| --- | --- | --- |
| ACCESS_TEAM_DOMAIN | `https://whisk-by-cindy.cloudflareaccess.com`, only after confirming the issuer | Text |
| ACCESS_AUD | The Whisk administration application's AUD | Text |
| ADMIN_HOSTNAME | `whisk-dnh.pages.dev` | Text |
| ADMIN_EMAILS | `["baker@whiskbakedbycindy.com","ncbourget0@gmail.com"]` | Secret |
| EDITOR_PUBLISH_ENABLED | `true` | Text |
| GITHUB_CONTENT_TOKEN | Repository-scoped credential described below | Secret |

The email list must contain exactly two distinct full addresses. Missing or invalid Access settings deny access. Missing publishing settings leave the editor read-only. Never enter a token into bakery content fields, source files, screenshots, chat, or frontend variables.

Keep **Runtime → Fail open / closed → Fail closed**. Leave Preview admin/publishing settings unset. Redeploy after changing runtime bindings.

## 3. Repository publishing credential

Create a **fine-grained GitHub personal access token** in the owning GitHub account. Restrict repository access to **ncbourget/whisk only** and grant **Contents: Read and write** (plus GitHub's automatic Metadata read permission). Do not grant Workflows, Actions, Administration, other repositories or account permissions. Set an expiration and record a renewal reminder privately. Enter the token directly into Cloudflare's encrypted `GITHUB_CONTENT_TOKEN` field; it never belongs in the repository or Whisk browser UI.

The implementation hardcodes repository `ncbourget/whisk` and branch `main`. It creates atomic content commits and uses non-force branch updates. If branch protections disallow those commits, publishing returns an error; do not disable protections without choosing an appropriate publishing workflow. [GitHub Git API](https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-your-git-database)

An expiring repository token is the supported initial setup. A GitHub App with short-lived installation tokens is a future rotation improvement; automatic App-token minting is not implemented.

Uploaded photos enter repository history immediately. Browser content edits remain unsaved until Publish. Do not upload private images or confidential drafts to a public repository. No new paid image-storage subscription is required.

## 4. Deploy this code

1. Run `npm test`, `python3 -m unittest discover -s tests`, and `npm run build` locally.
2. Commit and push the implementation to `main` once reviewed.
3. In Pages Build settings use `npm ci && npm run build`, output `_site`, root blank, Node 22+, Python 3.10+. Git automatic deployments must be enabled for `main`.
4. Wait for the deployment to succeed. A Python-only build intentionally has no hosted editor.

The `_worker.js` artifact contains private administrative content. It is for Cloudflare Pages advanced mode only; never host it as a downloadable static file. Public pages and images remain static; only admin routes invoke the Worker. Keep existing free plans. Quota/service failures should block publishing instead of activating paid upgrades.

## 5. Required live verification

- Incognito: public homepage/menu work without login. `/editor/` redirects to Cloudflare login. Cindy and Nate can log in using their exact emails; an unrelated address cannot.
- Without login: direct GET/POST `/api/content` and POST `/api/photo` cannot read content, publish or upload. Raw `/data/site.json` has no public response.
- Repeat admin checks on hash previews, branch aliases and alternate domains: they must deny even with a valid production token. Inventory and remove/protect old insecure deployments; a new deployment cannot secure old immutable files.
- After login: editor says **Signed-in publishing** and offers **Publish website**, photo upload, Add a baked good and Add a stop.
- From Cindy's phone: create a test product (keep “Show on the menu” off if it should not appear), upload a JPG/PNG/WebP under 5 MB, and publish. Verify the new commit and successful Cloudflare deployment. Then verify an intentionally visible test item's generated menu link and detail page. Remove the test entry afterward.
- Publish a test event and verify the rendered date, timezone, address and directions. Remove it afterward.
- Open two editor sessions, publish in one, then attempt a stale save in the other. It must reject with a conflict; download the draft before reloading.
- Confirm malformed images, invalid links and cross-origin writes fail; a publishing failure leaves the prior live deployment intact.
- Confirm Square checkout remains disabled. Content publishing does not configure payments, inventory or seller notifications.

A successful editor message means the repository accepted a commit. Cloudflare still needs to build. The UI does not yet poll deployment status; use View website to verify, or have Nate inspect Pages deployments if it does not update.

## Maintenance and recovery

Cindy's flow: open `https://whisk-dnh.pages.dev/editor/`, enter her email, enter Cloudflare's emailed code, edit, upload photos, Publish website, verify after the build. No GitHub Desktop is required for her.

Nate should fetch/pull before editing locally after Cindy publishes. A stale local checkout must not overwrite her content. Resolve conflicts rather than force-pushing.

Disable writes by setting `EDITOR_PUBLISH_ENABLED=false` and redeploying. Disable all admin access by unsetting `ADMIN_EMAILS` and redeploying. Revoke the GitHub token if exposed, replace it in Cloudflare, and redeploy. To revoke a person's access, remove them from Access, revoke their sessions, and update server configuration; the current two-email constraint means temporarily disabling the editor is safest until a replacement allowlist is configured.

The authenticated local editor remains available through Start Whisk.command. Never publish that local Python server through a tunnel or reverse proxy.
