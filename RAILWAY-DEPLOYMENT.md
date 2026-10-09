# MoreSpace Services: website and Railway deployment details

## Live website

[Open MoreSpace Services](https://morespace-website-production.up.railway.app) · [Industry websites and share kit](https://morespace-website-production.up.railway.app/industries.html)

The production service deploys automatically from this GitHub repository. Every push to the connected branch builds the root Dockerfile and replaces the running container only after `/health` succeeds. GitHub Actions rebuilds and tests every push, then waits for Railway to report the pushed commit and verifies the public website against that exact build.

## Pipeline

```text
git push ──► GitHub Actions: validate content → rebuild → committed output must match → 60 tests
        └──► Railway: build Dockerfile (node:22-alpine) → start dev-server.mjs → /health check → switch traffic
                                                                  │
GitHub Actions (live job) ◄── waits for /health to report the commit ┘
        → checks every public file byte for byte, short links, redirects and error codes
```

## Railway production resources

| Resource | Value |
|---|---|
| Project | MoreSpace Website (`f94252d1-a408-4e46-9606-30608890aa89`) |
| Environment | production (`241a6e87-56bc-4d47-829a-bcd69733049d`) |
| Service | morespace-website (`66f765f0-e260-448c-b6a6-2a78c88954b9`) |
| Source | GitHub `hemantsatishjadhav06-ai/more-space-service-repo-`, branch `main` |
| Build | Root `Dockerfile` on `node:22-alpine`; no npm install |
| Start command | `node dev-server.mjs` |
| Port | 3000 (`PORT` variable); the public domain targets 3000 |
| Health check | `/health`, 120-second window |
| Restart policy | On failure, 3 retries |
| Region / replicas | us-west2 / 1 |
| Public domain | `morespace-website-production.up.railway.app` (domain ID `4cd1e59d-f3a2-4f05-b19a-5c003033b1bb`) |
| First GitHub deployment | `dd57c1a7-e7c7-4cc2-87cd-6f84a5648242`, commit `03d5a22`, SUCCESS on 2026-10-09 |

[Manage the Railway project](https://railway.com/project/f94252d1-a408-4e46-9606-30608890aa89).

### Deployed branch

The service follows `main`, so every merge to `main` deploys automatically and the CI live job verifies it. To preview another branch on production temporarily, change Railway → morespace-website → Settings → Source → Branch, and switch it back to `main` afterwards.

### Rollback

Railway → morespace-website → Deployments → choose an earlier successful deployment → Rollback. Reverting the commit on the connected branch also redeploys the previous build. The earlier environment-archive variables (`MORESPACE_ASSETS_*`, `MORESPACE_BOOT`, `MORESPACE_MANIFEST`) remain on the service and are ignored by the Dockerfile start command; they can be deleted once the GitHub route has run for a while.

## What the server does

`dev-server.mjs` serves the committed `dist/` folder:

- GET and HEAD only (405 otherwise); malformed or invalid UTF-8 paths return 400; missing files return 404.
- Directory indexes: `/industries/hospitals/` serves its `index.html`, and `/industries/hospitals` redirects (301) to the trailing-slash URL so relative links resolve.
- Short share links from `content/site-routes.json`, case-insensitive and keeping the query string: for example `/hospitals`, `/schools`, `/ecommerce`, `/fashion`, `/fmcg`, `/electronics`, `/beauty`, `/furniture`, `/jewellery`, `/realestate`, `/hotels`, `/finance`, `/logistics`, `/legal`, `/gyms`, `/cars`, `/saas`.
- gzip when the client accepts it, `Vary: Accept-Encoding`, five-minute caching, and security headers: Content-Security-Policy (no framing, self-hosted scripts), `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
- `/health` returns the site counts and, on Railway, the deployed commit from `RAILWAY_GIT_COMMIT_SHA`.

## Website contents

| Area | Delivered |
|---|---|
| Website routes | 262 pages |
| Industry websites | 12 industries, 110 pages, 50 segment pages, 168 automation blueprints |
| Services / capability groups | 6 / 18 |
| Solution blueprints | 12 |
| Tools | 76, with 61 locally embedded logos |
| Metric library | 45 definitions |
| Company lifecycle | 8 stages |
| Sharing | Canonical URLs, Open Graph images per industry, WhatsApp/LinkedIn/email/copy buttons, short links, sitemap.xml, robots.txt |

Industries: Hospitals & Healthcare; Schools & Education; E-commerce & D2C Retail (fashion, FMCG, electronics, beauty, home & furniture, jewellery); Real Estate & Construction; Hotels, Restaurants & Travel; Manufacturing & B2B Distribution; Banking, Lending, Insurance & Fintech; Logistics & Supply Chain; Agencies, Legal, Accounting & Consulting; Fitness, Salons & Wellness; Automotive Dealerships & Service; SaaS & Startups.

## Updating content

1. Edit `content/industries/<id>.json` (or the registry in `content/industries.json`), following `content/INDUSTRY-SCHEMA.md`.
2. `npm run build` and `npm test`.
3. Commit the source together with the regenerated `dist/`, README table and manifests, then push. CI fails if the committed output does not match a fresh build.
4. Railway deploys the push; the CI live job confirms the public website serves it.

## Fallback route

`railway-container.cjs` and `prepare-railway-container.cjs` still build and test the earlier environment-archive deployment (Brotli archive split across environment variables, checked by SHA-256 before the server listens). It serves every page, short link and directory index, but it leaves out the share images in `dist/og/` to stay within its environment budget, so link previews have no image on that route. Use it only if GitHub deployments are unavailable.

## Verification

- 60 automated checks pass locally and in GitHub Actions, including byte-exact serving of every file by both Node entry points, the industry content schema, share metadata, filters, short links and directory routing.
- A second build reproduces every committed file byte for byte; CI enforces this on every push.
- All 262 pages were rendered in Chromium at 1440px and 390px with no script errors or horizontal overflow.
- Railway's build and health check succeeded for the first GitHub deployment (`dd57c1a7`), with the container logging `MoreSpace listening on 3000`.
- `node checks/live-site-check.cjs [url]` verifies a public deployment: health counts and commit, every file in identity and gzip form with content types and security headers, every short link, every industry directory redirect, HEAD, 404, 405 and 400. The CI live job runs it after each deployment and keeps `deployment/live-site-verification.json` as a build artifact.

## Railway references

- [Dockerfile deployments](https://docs.railway.com/builds/dockerfiles)
- [Railway-provided variables, including RAILWAY_GIT_COMMIT_SHA](https://docs.railway.com/variables/reference#git-variables)
- [Health checks](https://docs.railway.com/deployments/healthchecks)
- [Start commands](https://docs.railway.com/deployments/start-command)
