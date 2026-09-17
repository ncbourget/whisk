# Deployment: public bakery + authenticated editor

Repository: `ncbourget/whisk`. The final hostname, Cloudflare team domain, application audience, and Cindy/Nate login emails have not been supplied. Do not infer these from screenshots or put guessed addresses in an allowlist. The code is prepared and fails closed until configured; this pass did not deploy or change any Cloudflare/GitHub settings.

## 1. Choose the deployment mode

- **Public website only:** `python3 scripts/build.py --output _site`. This build deliberately contains NO editor HTML, editor JavaScript/styles, raw content JSON, or administrative API. Cindy still edits locally. An old Cloudflare build command therefore fails safely after this change, with the hosted editor unavailable.
- **Public website + Access-protected download editor:** `npm ci && npm run build`. This adds a server-only `_worker.js` and `_routes.json`. Hosted saves/uploads are still disabled. Authorized users may edit/download drafts, then publish through GitHub Desktop; use the local notebook for direct local saves.

The second output is for **Cloudflare Pages advanced mode only**. Never upload its `_worker.js` as a static file to GitHub Pages, S3, a generic web server, or a public download location. It contains the full editor snapshot. Cloudflare executes this module instead of serving its source. [Advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)

Use the Free tiers for Pages/Workers and Zero Trust Access. Two users fit Access's advertised free tier; administrative requests count toward the Workers Free quota. Public static routes do not invoke the Worker. Keep fail-closed behavior at quota exhaustion rather than upgrading automatically. No paid plan, R2, D1, KV, email API, or Square subscription is required by this implementation. [Access pricing](https://www.cloudflare.com/sase/products/access/), [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)

## 2. Prepare the repository and public Pages project

1. Review the changed files in GitHub Desktop. Keep real credentials out of all files and commit messages. A public repository also exposes source content and history; make it private before storing confidential drafts. Access does not protect GitHub.
2. Confirm `data/site.json` uses `basePath: ""`. Set `domain` to the final HTTPS origin once known. Retain demo mode and disabled ordering until launch testing is complete.
3. With Python 3.10+ and Node 22+, run:

   ```sh
   npm ci
   npm test
   python3 -m unittest discover -s tests -v
   npm run build
   ```

4. In Cloudflare **Workers & Pages**, choose the **Pages** Git-integration flow (not the generic Create Worker flow), connect only `ncbourget/whisk`, and select the production branch, usually `main`.
5. Framework preset: **None**. Repository root: blank/root. Build command: **`npm ci && npm run build`**. Build output: **`_site`**. Select Node 22 or newer in build settings (`NODE_VERSION=22` is a build setting if needed). Python must be 3.10+.
6. The GitHub `Check website` workflow now verifies both authorization suites and builds the Cloudflare artifact; it does not deploy. Push only after reviewing the changes. Cloudflare's Git integration performs deployment.
7. Under the Pages project's **Custom domains**, associate the real bakery hostname. An apex domain requires the Cloudflare zone/nameserver setup. For a custom-hostname Access application, use a hostname managed/proxied by Cloudflare. Keep domain registration at GoDaddy if desired; preserve existing email/DNS records when changing nameservers. [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)

Do not publish the repository root. Only `_site` is the output. Never expose `scripts/serve.py` through Cloudflare Tunnel or another reverse proxy.

## 3. Configure email one-time PIN login

1. In the intended Cloudflare account, open **Zero Trust** and select its **Free** plan if setup is needed. Record the team domain shown by the account, such as `https://YOUR-TEAM.cloudflareaccess.com`.
2. Go to **Zero Trust → Integrations → Identity providers → Add new identity provider → One-time PIN**. Save. New organizations may not have OTP enabled automatically. Cloudflare sends and verifies these codes; Whisk never handles them. [OTP setup](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
3. Obtain Cindy's and Nate's exact preferred login email addresses. They may differ from the public bakery contact email. Do not use an email domain wildcard.

## 4. Create ONE administrative Access application

1. Go to **Zero Trust → Access controls → Applications → Add an application → Self-hosted** (the UI may say “Self-hosted and private”). Name it **Whisk administration**. Set session duration to **1 hour**.
2. Add these public-hostname entries to the same application, using the exact production hostname selected above. Path fields omit the leading slash:

   | Hostname | Path |
   | --- | --- |
   | `[BAKERY_HOSTNAME]` | `editor` |
   | `[BAKERY_HOSTNAME]` | `api` |
   | `[BAKERY_HOSTNAME]` | `assets/js/editor.js` |
   | `[BAKERY_HOSTNAME]` | `assets/css/editor.css` |
   | `[BAKERY_HOSTNAME]` | `data` |

   Parent paths cover their descendants unless a more-specific application overrides them. Verify `/editor`, `/editor/`, `/editor/index.html`, `/api/content`, and `/api/photo` all inherit this application. Do not create narrower Bypass applications. Keeping these paths in one application gives the editor and API the same expected audience. [Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)

3. Select **One-time PIN** as the application's login method. Disable “accept all identity providers” if shown and only enable the intended OTP provider.
4. Create one policy: name **Cindy and Nate only**, action **Allow**, **Include → Emails**, with exactly the two supplied addresses. Do not use Everyone, Emails ending in, or Include → Login Methods → One-time PIN. Those would broaden access beyond these people. Leave unmatched users denied. No Bypass or Service Auth policy is needed. [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)
5. Save the application. Open **Configure → Additional settings** and copy its **Application Audience (AUD) Tag**. Copy the team's exact HTTPS issuer domain separately. The AUD must belong to this application, not another preview app. [JWT verification and AUD lookup](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

## 5. Add the server runtime configuration

In **Workers & Pages → Whisk Pages project → Settings → Variables and Secrets**, select the **Production** environment and add:

| Name | Value | Type |
| --- | --- | --- |
| `ACCESS_TEAM_DOMAIN` | `https://YOUR-TEAM.cloudflareaccess.com` (no trailing slash) | Text |
| `ACCESS_AUD` | Exact AUD copied from the administrative application | Text |
| `ADMIN_HOSTNAME` | Exact bakery hostname only, e.g. `www.example.com`; no scheme, slash, port, or wildcard | Text |
| `ADMIN_EMAILS` | `["CINDY_EXACT_EMAIL","NATE_EXACT_EMAIL"]` with both placeholders replaced | Secret/encrypted |

These are **server runtime bindings**, not browser environment variables. Do not add frontend prefixes, hardcode them into `editor.js`, or commit `.dev.vars`. No Cloudflare API token, Access service token, GitHub token, or Square key is required. `ADMIN_EMAILS` must be a JSON array of exactly two distinct complete email addresses; an empty/malformed configuration intentionally returns 503.

Under **Settings → Runtime → Fail open / closed**, select **Fail closed**. Do not configure cache rules that override administrative `no-store` responses. Redeploy after changing bindings so the new deployment receives them. [Fail-closed setting](https://developers.cloudflare.com/pages/functions/routing/)

## 6. Preview URLs, alternate hostnames, and old deployments

- `ADMIN_HOSTNAME` intentionally permits only one hostname. The production `pages.dev` address, hashed previews, branch aliases, and other custom domains must return 403 on admin routes even with a token if they are not the configured host. The public bakery can still be served at those addresses.
- Leave the Preview environment's admin variables unset for the default “no hosted preview editor” policy (503 denial). To test an editor preview later, explicitly provision a separate fixed preview hostname, its own Access application/AUD and environment settings; never loosen the production hostname check or use wildcard hostnames.
- Enable Pages' built-in **Access policy / preview protection** for the entire preview deployment if draft public HTML must be private. Inspect the resulting Access application and replace any broad rule with the same exact two-email policy. This edge protection is additional to the Worker's admin checks. Test hash and branch-alias URLs separately. [Preview Access setup and custom-domain caveats](https://developers.cloudflare.com/pages/platform/known-issues/)
- Inventory existing deployments before considering the boundary complete. Old immutable deployment URLs can still serve old `/data/*.json` and `/editor/` files. Remove obsolete preview deployments or protect them with Access, retire old publishing projects, and prevent rollback to an insecure build. A new production deployment cannot retroactively secure another deployment's files. Purge previously cached admin/raw-data paths if necessary.
- Do not advertise `pages.dev` as an alternate admin-login route. Without the intended Access application it should deny, not provide a backup login.

## 7. Release verification (required before claiming it is protected live)

1. In an incognito browser, public home/menu/find-us pages work without login.
2. Visit `/editor/` on the canonical host: Cloudflare's login appears. The exact Cindy and Nate emails work; an unrelated email must not gain access. Recheck the application's policy tester, especially for any broader inherited/specific application.
3. After signing in, the editor loads and says **Authenticated download mode**. `/api/content` returns the snapshot with `capabilities.write=false`. Save is disabled and uploads are absent. Downloaded drafts are not published automatically.
4. Test requests directly, without visiting the editor or sending any cookie/token:

   ```sh
   curl -i 'https://[BAKERY_HOSTNAME]/api/content'
   curl -I 'https://[BAKERY_HOSTNAME]/editor/index.html'
   curl -i -X POST 'https://[BAKERY_HOSTNAME]/api/content' -H 'Content-Type: application/json' --data '{}'
   curl -i -X POST 'https://[BAKERY_HOSTNAME]/api/photo' -H 'Content-Type: image/png' --data 'not-an-image'
   curl -i 'https://[BAKERY_HOSTNAME]/data/site.json'
   ```

   Replace the hostname first. Expect Access login redirects/denial, never editor content, source JSON, a successful save, or uploaded image. Repeat on `pages.dev`, a preview URL, and any other attached host. Worker denials are 401/403; missing configuration is 503. Raw data has no public file and remains 404 even after authorization at its canonical route.
5. The test suites send forged signatures, wrong audience/issuer/email, expired tokens, anonymous direct writes, bad origins and expired local sessions. Rerun them before each auth change. In an authenticated browser, any hosted POST/PUT/PATCH/DELETE still returns 405; there is no hosted persistence to mutate.
6. Remove one email from both the Access policy and server binding if access must be revoked, revoke active sessions in Access, and redeploy the binding change. To temporarily disable everyone, unset `ADMIN_EMAILS` and redeploy. Never add a development bypass. Use `https://[BAKERY_HOSTNAME]/cdn-cgi/access/logout` to end the current Access session.
7. Record the actual production hostname, Access application name, test date and results in your private operations notes. Do not store tokens/cookies/OTP codes in screenshots, issue comments, shell history, or repository files.

## Local editing and fallback

Double-click **Start Whisk.command**. It opens a one-use OS-generated launch URL, exchanges it for an HttpOnly local session, then redirects to `/editor/`. The launch link expires in five minutes; the local session expires in eight hours or on server restart. For a manually launched server, use the private link printed in that terminal. Do not share it. If the session expires, close/restart the launcher. Merely typing `/editor/` on a fresh browser is intentionally insufficient.

Local saves require the authenticated session and the exact local Origin/Host; image upload is guarded independently. No public internet login or paid provider is needed for this OS-local authoring workflow. Publish through GitHub Desktop after reviewing changes.

## Other hosts and rollback

GitHub Pages is not the assumed host for this commercial bakery; its [usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) restrict sites primarily facilitating commercial transactions. The inactive workflow example remains public-only and must never publish the Cloudflare Worker artifact. Other static hosts can receive the Python-only build, without a hosted editor.

For a rollback, choose a reviewed build with this authentication boundary or newer. Restore content through a reviewed Git commit or local backup and rebuild. Never restore an old public editor/data artifact as an emergency workaround for Access errors.
