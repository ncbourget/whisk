# Deployment and domain setup

No website has been deployed and no DNS records have been changed. Repository: `ncbourget/whisk`. Domain: **not yet supplied**. Instructions checked against official documentation September 17, 2026.

## 1. Choose an eligible host

**Do not assume GitHub Pages can host this commercial ordering website.** Its [usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) prohibit websites primarily directed at commercial transactions. The Square handoff does not establish an exception. Keep GitHub for source control; evaluate Cloudflare Pages or another host whose current terms permit this business use. No paid plan or account change is made by these files.

Cloudflare documents [static HTML hosting](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) and a [Free plan with limits](https://developers.cloudflare.com/pages/platform/limits/). For this project, use Git integration, no framework preset, `python3 scripts/build.py --output _site` as the build command, and `_site` as output. Confirm Python 3.10+ in the build environment. This is a proposed launch path, not an already connected service.

## 2. Prepare and verify locally

1. Open the notebook and enter the final content listed in CONTENT-NEEDED.md.
2. Keep demo mode on until real content and Square behavior are reviewed.
3. Set `domain` to the final HTTPS origin, without a trailing path: `https://[DOMAIN]`.
4. Set `basePath` to `""` for a custom domain or root hosted site. For an eligible GitHub repository URL, use `/whisk` and the origin `https://ncbourget.github.io`.
5. Run `python3 -m unittest discover -s tests -v`, then `python3 scripts/build.py --output _site`.
6. Complete LAUNCH-CHECKLIST.md. Turn off demo mode only when ready; rebuild. Enable orders only after Square testing.
7. Use GitHub Desktop to review, commit, and push the project. No credentials belong in the commit.

The provided **Check website** GitHub workflow validates the content and produces a downloadable static artifact. It does **not** deploy anything.

## 3. Suggested Cloudflare Pages publishing path

1. In Cindy’s Cloudflare account, choose Workers & Pages → create a Pages project → connect Git. Follow the current dashboard wording if it differs.
2. Authorize access to only the intended repository. Choose `ncbourget/whisk` and the publishing branch (normally `main`).
3. Choose no framework preset. Set the build command and output from section 1; leave the project root at repository root. No environment secrets are needed.
4. Deploy and inspect the assigned `pages.dev` address. Keep demo/noindex mode for previews.
5. Confirm all routes, photo assets, contact links, 404 response, and ordering behavior before connecting the domain.
6. Pushes to the connected publishing branch then rebuild automatically. Use branch previews for unapproved changes. Review any build failure before retrying.

For an apex domain, Cloudflare’s [custom-domain guide](https://developers.cloudflare.com/pages/configuration/custom-domains/) requires a Cloudflare zone/nameservers. A subdomain can use external DNS with a CNAME to the assigned `pages.dev` host, after associating it in the Pages dashboard. Decide with Cindy whether to keep DNS at GoDaddy using `www`, or move authoritative DNS to Cloudflare. The domain can remain registered at GoDaddy either way. Preserve mail records when moving DNS.

## 4. Exact GitHub Pages steps — for an eligible use only

These steps are retained to satisfy the requested deployment preparation. **Resolve eligibility before using them for this business.** Do not enable the workflow as a workaround for GitHub’s policy.

1. Commit and push the repository through GitHub Desktop.
2. Set `basePath` to `/whisk` for `https://ncbourget.github.io/whisk/`, or blank for a custom domain. Rebuild before pushing.
3. Copy `deployment/github-pages.yml.example` to `.github/workflows/pages.yml` and commit/push that file.
4. In GitHub, open repository **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Open **Actions → Publish eligible GitHub Pages site → Run workflow** on the publishing branch. This example is manual, so subsequent pushes do not deploy until it is run again.
6. Wait for both the build and deployment jobs to succeed. Follow the environment URL and inspect all pages.
7. For a custom domain, verify ownership in GitHub account settings first, then enter the real domain under repository **Settings → Pages → Custom domain** before changing DNS.
8. Configure DNS as below. Once GitHub offers **Enforce HTTPS**, enable it. It may take time for DNS validation and certificate issuance.
9. Confirm HTTPS, redirects between apex/www, canonical URLs, sitemap, and deep routes.

This workflow publishes `_site/`, not the entire repository. A custom Actions publishing workflow does not require CNAME; GitHub’s Pages settings store the domain. For branch-based publication only, a CNAME file contains the exact bare domain, for example `[DOMAIN]` with no protocol or slash. Do not commit a placeholder CNAME. Branch-root publishing is not the recommended workflow here because it bypasses the explicit build step for web-edited JSON.

GitHub’s [custom-domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) is the source of the DNS values below.

## 5. Exact GoDaddy DNS steps for an eligible GitHub Pages deployment

This section applies only to GitHub Pages. Do not mix its addresses with Cloudflare’s configuration.

1. Confirm the exact production domain with Cindy. In GoDaddy, open Domain Portfolio → choose the domain → DNS / Manage DNS. If nameservers point elsewhere, make these changes at the actual authoritative DNS provider instead.
2. Save a copy of the existing DNS records. Preserve email MX, SPF, DKIM, DMARC, and ownership-verification records.
3. In GitHub, configure the custom domain first, as above.
4. For the apex (`[DOMAIN]`), replace conflicting parking/hosting A records at `@` with these four A records, each using GoDaddy’s default TTL:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |

5. Add or edit **CNAME**, name **www**, value **ncbourget.github.io**, default TTL. Do not append `/whisk`, a protocol, or an apex redirect target. Remove only the conflicting `www` record if necessary; do not wipe unrelated records.
6. Remove conflicting apex AAAA records if they point to another web host, or replace with GitHub’s documented IPv6 values if deliberately using IPv6. Do not add wildcard records.
7. Wait for DNS propagation and GitHub’s DNS check. Return to Pages settings and enable HTTPS when available.
8. Open `https://[DOMAIN]` and `https://www.[DOMAIN]`. Confirm both reach Whisk and one redirects to the selected canonical domain. Test `/menu/` directly and a nonexistent route.

GoDaddy’s current help: [Add an A record](https://www.godaddy.com/help/add-an-a-record-19238), [Add a CNAME record](https://www.godaddy.com/help/add-a-cname-record-19236). UI labels may change; record types/names/values are the material settings. Do not change DNS yourself without owner authorization.

## 6. Caching and operational refreshes

Use the host’s normal static caching initially. Avoid year-long immutable caching on unfingerprinted HTML, JSON, CSS, or JS. HTML/content updates should be revalidated or have short lifetimes. Photos use content-derived names when uploaded from the local notebook. Purge/redeploy if a critical sold-out update is stale, while disabling the actual sale in Square immediately.

There is no automatic scheduled rebuild here. Publish when opening a new order window, changing business status, or removing past events. Browser cutoff checks enhance old pages but do not replace Square’s enforcement.

## 7. QR and sharing

After the canonical domain is live, generate a static QR for `https://[DOMAIN]/menu/` using an offline or trusted generator. Avoid subscription-based “dynamic QR” URLs. Print the readable URL alongside it, keep a quiet border, and test a physical proof on several phones. A stable `/menu/` destination means the menu can change without reprinting. Do not print a localhost, sample, branch-preview, or temporary Pages URL.

Supply and configure the social image, then check a real messaging/social preview. Do not assume a cached preview updates instantly.
