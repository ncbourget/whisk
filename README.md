# WHISK — Baked by Cindy

A small bakery website built for a polished silver trailer. Plain HTML, CSS, and vanilla JavaScript, with a Python-standard-library content publisher and a local form editor. No npm install, database, account system, analytics, or paid website dependency.

**Current state: local design preview, not ready to take orders.** All products, prices, illustrations, and draft copy are samples. No trailer photographs or licensed packaging assets were provided. Square payments are deliberately blocked in demo mode. No deployment, DNS changes, commits, or pushes have been performed by this implementation.

## Open the website and notebook

On this Mac, double-click **Start Whisk.command**, then use the notebook that opens. Python 3.10+ is required and available in the current development environment. On another computer, Nate should install Python from python.org if needed. Keep the terminal window open while editing; close it or press Control-C to stop.

From a terminal in the project folder:

```sh
python3 scripts/serve.py --open
```

- Website: http://127.0.0.1:8000/
- Cindy’s notebook: http://127.0.0.1:8000/editor/
- Alternate port: `python3 scripts/serve.py --port 8001 --open`

The editor saves locally, backs up the previous content in ignored `.backups/`, validates it, and regenerates the pages. GitHub Desktop is used to review and publish the changes. A hosted editor has **download-only** functionality; it cannot modify the public site.

## Content and design

| Change | Source |
| --- | --- |
| Business status, copy, hours, contact, Square shop | `data/site.json` |
| Products, categories, prices, photos, availability | `data/menu.json` |
| Upcoming locations, times, cancellations | `data/events.json` |
| Colors, type, spacing, responsive layout | `assets/css/site.css` |
| Shared HTML shell | `templates/page.html` |
| Page compositions and content validation | `scripts/build.py` |
| Small browser enhancements | `assets/js/site.js` |

Generated root/page HTML is committed for transparency and an immediate static preview. **Edit data or source templates, then rebuild; do not edit generated HTML.** Python runs only on the editor computer or build service. Customers receive static files; their browsers do not need Python.

```sh
python3 scripts/build.py
python3 scripts/build.py --check
python3 -m unittest discover -s tests -v
python3 scripts/build.py --output _site
```

`_site/` is the deployable output. It includes only public assets, content, editor, HTML, robots, and sitemap. It excludes local backups, scripts, tests, and developer documents. The hosted editor contains no secrets and provides downloads only. You can omit `editor/` from hosting if desired; Cindy can use it locally.

## Square

Public hosted checkout URLs only. Add Cindy’s Square shop URL under Bakery details, or an item payment link under its menu entry. A missing item link does not silently substitute an unrelated general payment link. For multi-item baskets, use Cindy’s Square Online shop. Keep actual stock, pickup settings, taxes, cutoffs, and notifications in Square. The custom website does not collect card details or verify payment.

See **SQUARE.md** for the researched choices, paid preorder distinction, setup, and tests.

## Hosting: read this before launch

The brief requests GitHub Pages, but GitHub’s current [usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) prohibit free hosting for sites primarily facilitating commercial transactions. This project’s ordering purpose likely falls within that restriction. Linking to Square does not establish an exemption.

Use GitHub for source control. **Cloudflare Pages is a practical static-hosting alternative to evaluate**; its Free tier is currently documented, but review the account’s current terms and quotas before launch. No Cloudflare connection or account is required to work on this code. Instructions for both hosts and GoDaddy DNS are in **DEPLOYMENT.md**. The Pages workflow is provided as an inactive example, not silently enabled.

The repository remote is `https://github.com/ncbourget/whisk.git`. No final domain is assumed. Do not add a guessed CNAME.

## Read next

- **CLIENT-GUIDE.md** — Cindy’s editing and publishing instructions
- **CONTENT-NEEDED.md** — the real information and artwork to supply
- **SQUARE.md** — checkout choices and setup
- **ARCHITECTURE.md** — data, security, extension points, tradeoffs
- **DEPLOYMENT.md** — host and GoDaddy setup
- **LAUNCH-CHECKLIST.md** — release and order testing
- **PROJECT-REPORT.md** — implementation summary and verification results
