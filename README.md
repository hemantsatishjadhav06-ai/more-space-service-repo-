# MoreSpace Services website

A complete static multipage website presenting marketing, funnel structuring, SaaS and internal tools, AI automation, data analysis, and team/customer operations as connected services.

Live website: [morespace-website-production.up.railway.app](https://morespace-website-production.up.railway.app).

Source repository: [more-space-service-repo-](https://github.com/hemantsatishjadhav06-ai/more-space-service-repo-).

## Content and interaction

- 151 real HTML routes: 12 core pages, 6 services, 12 solutions, 76 tool pages, and 45 metric pages.
- 18 capability groups with practical delivery outputs, implementation workflows, requirements, tools, and measurements.
- Four-level explorers: business area → service/family → capability/tool/metric → detailed tabs.
- 76 researched platforms including Clay, Smartlead, WhatsApp, Retool, n8n, Canva, Power BI, Tableau, Apollo, Mailchimp, Meta Ads, Google Ads, Bright Data, Apify, Jira, Asana, Slack, Discord, and AI/development tools.
- 61 genuine brand assets embedded locally. 15 other genuine assets use their cited provider URLs and show name-based fallbacks if unavailable.
- 45 metrics include definitions, formulas, worked examples, limitations, diagnostic questions, analysis dimensions, actions, source requirements, owners, and reporting cadence.
- Search and deep links retain hierarchy context. The six-tool shortlist can download a proposed implementation outline.
- Funnel and unit-economics calculators support USD, EUR, GBP, and INR. Calculations preserve the population and period assumptions and undefined zero denominators.
- An eight-stage Company Journey covers Launch → Operate → Scale through four levels of tabs: phase, stage, workstream, and delivery detail.
- Team and Customer Operations adds workspace setup, project delivery control, and community/support workflows.
- A project-brief builder downloads or copies a text brief locally, retaining the selected company stage and service.

## Run, build, and verify

Requires Node.js 22 or newer. The project uses no install-time dependencies.

```
npm run build
npm test
npm start
```

The server defaults to port 4173 locally and honors PORT. Build regenerates every page and the standalone preview. The prepared source datasets and real logo originals are included in brand-source/. Build also writes an experimental self-contained Bun archive to railway-function.ts for exact bundle verification. At 823,366 bytes, that archive exceeds Railway Functions' 96 KB source limit and must not be deployed as a Railway Function.

## Structure

- content/: content registries, page index, site counts, and preserved calculator/brief markup.
- brand-source/: verified tool sources and original SVG/PNG asset data.
- dist/: all public website pages, CSS, JavaScript, and local brand images.
- build-site.cjs, prepare-content.cjs: deterministic content/build generators.
- package-site.cjs: standalone preview and experimental self-contained Bun archive generator.
- checks/: calculation, hierarchy, route, markup, source, asset, and deployment verification.
- release/morespace-multipage-preview.html: complete navigable preview with embedded local assets.
- Dockerfile: production Node server with the reviewed static build; Railway detects it at the repository root.
- railway-function.ts: oversized experimental Bun archive used for package verification; excluded from the Docker build.

## Deployment

The complete site is live in a Railway production service using the official node:22-alpine image. This is a standard container, not a Railway Function. A small Node bootstrap reconstructs the reviewed static archive from 15 non-secret environment chunks, verifies its SHA-256, and serves all 216 files from memory. The largest variable is 24 KB; the complete environment is 363,579 bytes. No database, persistent volume, vendor API key, or new GitHub repository is needed for this route.

Current project: MoreSpace Website, production. Service: morespace-website. Deployment fd429608-bc16-43e0-854d-0584463f353d is SUCCESS. The HTTPS public domain routes to port 3000. The service uses 19 variables, the launcher command, /health, a 120-second health timeout, ON_FAILURE restart with 3 retries, and one us-west2 replica. Read RAILWAY-DEPLOYMENT.md for resource IDs, operational details, and verification scope.

GitHub stores the complete build source, original logo records, verification code, and reviewed dist/ files. The running Railway service is not connected to GitHub auto-deploy. Build-generated release/, railway-function.ts, and deployment/container-variables.json can be regenerated with npm run build; they are omitted from Git history.

For future changes, npm run build regenerates the static website, portable preview, and the standard-container archive. npm test validates the complete current package. Stage the generated deployment/container-variables.json values on the same Railway service and commit them together; do not mix chunks from different archives. The bootstrap refuses missing, corrupt, or inconsistent archives. deployment/container-manifest.json records the expected checksum and start command.

The root Dockerfile remains an optional repository-backed deployment route: commit the source and reviewed dist/ at a repository root, then connect that repository. Its Node server needs dist/, content/site-counts.json, and dev-server.mjs. No npm installation is required. railway.json is omitted because current Railway documentation deprecates Config as Code; use native service settings. The experimental Function archive is not used for the live website.

## Input and contact behavior

The calculators, shortlist, and brief work locally. They do not submit data to a CRM, email address, AI provider, or server. The project page clearly explains that it prepares a downloadable brief; no inquiry receiver or booking destination has been configured. There are no advertising pixels or analytics scripts. Google Fonts, the 15 remote logos, and external documentation links may load from the provider hosts. Railway retains ordinary hosting logs.

The tool directory explains proposed delivery applications. The website itself does not run or log into these 76 services. Tool plans, licenses, API access, permissions, source restrictions, data mapping, and operating ownership must be agreed for each client implementation. Brand assets do not imply vendor endorsement or partnership.

## Verification scope

48 checks passed. They validate calculations, actual nested-tab handlers, hierarchy selection, all 151 generated routes and their local links, content relationships, local SVG safety, exact serving of all bundled files, and actual-page script initialization. Automated browser rendering was not performed because browser access was previously rejected. Figma canvas editing was also previously blocked; no completed native Figma import is claimed by this package. The Docker image has not been built locally because a Docker runtime is unavailable; both Node entry points are covered by the automated suite, including every one of the 216 static files over HTTP. Four new container checks also verify encoding negotiation, archive integrity, and failure cases. Local checks used Node 24; the actual Node 22 Railway container is now running successfully. Live HTTPS checks and the runtime archive checksum are recorded in deployment/live-verification.json.
