# MoreSpace Services — website and Railway deployment details

## Live website

[Open MoreSpace Services](https://morespace-website-production.up.railway.app).

The Railway production deployment is SUCCESS and serves the complete website over HTTPS. The public health endpoint reports the expected 151 pages, 76 tools, 45 metrics, 6 services, 12 solutions, 18 capability groups, 8 company stages, and all 216 static files. Its archive checksum matches the reviewed source package.

Source repository: [hemantsatishjadhav06-ai/more-space-service-repo-](https://github.com/hemantsatishjadhav06-ai/more-space-service-repo-). The repository preserves the complete build source and reviewed public files. The running Railway deployment uses a standard Node container with a verified asset archive; it currently does not automatically deploy GitHub pushes.

## Railway production resources

| Resource | Value |
|---|---|
| Project | MoreSpace Website |
| Project ID | f94252d1-a408-4e46-9606-30608890aa89 |
| Environment | production |
| Environment ID | 241a6e87-56bc-4d47-829a-bcd69733049d |
| Service | morespace-website |
| Service ID | 66f765f0-e260-448c-b6a6-2a78c88954b9 |
| Deployment ID | fd429608-bc16-43e0-854d-0584463f353d |
| State | SUCCESS |
| Image | node:22-alpine |
| Region / replicas | us-west2 / 1 |
| Public website | https://morespace-website-production.up.railway.app |
| Public domain ID | 4cd1e59d-f3a2-4f05-b19a-5c003033b1bb |
| Domain target port | 3000 |
| Health endpoint | https://morespace-website-production.up.railway.app/health |
| Deployment created | 2026-10-07T17:59:27.316Z |

[Manage the Railway project](https://railway.com/project/f94252d1-a408-4e46-9606-30608890aa89). Runtime logs confirm the container started with all 216 files and the matching archive checksum. The environment has no pending staged changes.

## Website contents

| Area | Delivered |
|---|---|
| Website routes | 151 real pages |
| Services | 6 connected disciplines |
| Capability groups | 18 detailed scopes |
| Solution blueprints | 12 architectures |
| Tools | 76 marketing, software, collaboration, AI and data platforms |
| Metric library | 45 definitions, calculations and analysis guides |
| Genuine logos | 61 embedded locally; 15 cited remote images |
| Interaction | Four-level explorers, nested tabs, search, contextual deep links, six-tool shortlist |
| Calculators | Funnel forecast and actual acquisition/unit economics; USD, EUR, GBP, INR |
| Briefs | Local text download or copy, retaining the selected company stage |
| Company lifecycle | 8 stages across Launch, Operate, and Scale |
| Design | Navy, cobalt and mist; Manrope headings and Inter body |

Main navigation: Home, Company Journey, Services, Solutions, Tool Workbench, Growth Lab, Calculators, Approach, Project Brief, Sources, and Privacy. The Goal Explorer connects objectives to a service, a capability, and detailed delivery tabs. Each tool has its own implementation guide and source links. Each metric explains the population, period, formula, interpretation, limitations, and next actions.

The catalog includes Clay, Smartlead, WhatsApp, Retool, n8n, Canva, Power BI, Tableau, Apollo, Mailchimp, Meta Ads, Google Ads, Bright Data, Apify, Jira, Asana, Slack, Discord, and additional software, AI, analytics, and marketing platforms.

## Company journey and new operations offer

| Stage | What MoreSpace can implement |
|---|---|
| Define the business | Audience and offer positioning, operating goals, funnel assumptions, research, and a scoped delivery plan |
| Brand and digital launch | Brand system, service website, core content, campaign assets, tracking design, and launch checks |
| Demand and acquisition | Paid/organic campaigns, content workflows, enrichment, email outreach, and qualified demand routing |
| Sales and customer onboarding | CRM/pipeline structure, qualification, follow-ups, proposal handoffs, and onboarding records |
| Team delivery and collaboration | Jira or Asana boards, ownership, templates, approvals, Slack channels, and selected workflow notifications |
| Customer success and community | Discord server structure, onboarding, moderation roles, support escalation, knowledge workflows, and retention journeys |
| Management and performance | Agreed KPI definitions, reconciled reporting models, executive views, and review cadence |
| Scale and continuous improvement | Software improvements, bounded AI workflows, operating documentation, rollout evaluation, and priority management |

The dedicated Team and Customer Operations service has three capability groups: workspace setup; delivery control; community and support. Its Jira, Asana, Slack, and Discord profiles explain actual client-owned setup, roles/permissions, inputs, configuration sequence, integrations, metrics, source references, and practical platform limits. The operations-hub blueprint also connects the collaboration layer to internal records and exception handling. The website does not itself create these external accounts or provision workspaces.

The company-page hierarchy is Phase → Stage → Workstream → Detail. Every stage exposes its outcome, deliverables, delivery sequence, tool stack, required client inputs, named owner, measures, completion criteria, and scope boundaries. A stage-specific link preselects the relevant stage and service in the local project brief.

## Live container implementation

railway-container.cjs is the shipping bootstrap. prepare-railway-container.cjs builds deployment/container-variables.json and deployment/container-manifest.json from the exact reviewed dist/ tree. The deployment has 15 archive chunks plus the bootstrap, manifest, NODE_ENV, and PORT: 19 variables in total. The archive contains all 216 static files, including 151 HTML pages and 61 local brand assets.

| Setting | Live value |
|---|---|
| Payload format | Brotli compressed JSON, base64 encoded |
| Archive chunks | 15, each at most 24,576 bytes |
| Complete variable environment | 363,579 bytes |
| Archive SHA-256 | f413b80709f5b0d1bebb620d6bffa47b9ebeaab4b6b87275d85709c260a1ec2d |
| Port | 3000, from PORT |
| Health path / timeout | /health / 120 seconds |
| Restart policy | ON_FAILURE, 3 retries |
| App sleeping | Disabled |
| Database / volume / API keys | None required |

The start command is:

```text
node -e "eval(Buffer.from(process.env.MORESPACE_BOOT,'base64').toString('utf8'))"
```

The bootstrap checks the chunk count, SHA-256, decompression, JSON parsing, and exact file count before it listens. It binds 0.0.0.0, serves GET/HEAD, returns appropriate 400/404/405 responses, negotiates gzip, and adds content-type and browser security headers. /health reports the full website counts and expected archive checksum. No archive variables contain account credentials; they contain public website assets and the server code.

The user-supplied FileBrowser template was reviewed. Its public root is file management and its raw-file behavior is unsuitable for this interactive multipage website. No FileBrowser service, admin UI, or upload endpoint was exposed. The standard Node container serves the actual website directly.

The root Dockerfile provides an optional conventional repository-backed route. The live deployment uses the public Node image and the complete environment archive. GitHub currently stores the website source; automatic deployments from that repository have not been configured.

## Verification

The public HTTPS health endpoint and runtime logs match the reviewed archive. Detailed public-file verification results are saved in deployment/live-verification.json.

48 automated checks passed across the website and container suites: all 151 routes and navigation reachability; metadata, labels and static ARIA; internal assets, links and fragments; content relationships; safe local SVGs; calculation boundaries; hierarchy filters and deep links; nested click/keyboard selection; exact 216-file archive serving; portable-preview fidelity; isolated actual-HTML script tests for every page, search, exports, calculators, briefs, and mobile-menu handlers; all four company-tab levels and independent selections; all eight stage-specific brief deep links; and every static file served byte-exactly over HTTP by both Node entry points. The four container checks also verify the generated bootstrap and checksum, gzip and identity responses, explicit gzip quality zero, and nine invalid archive/manifest startup cases.

The actual node:22-alpine image is running successfully on Railway. Local Node checks used Node 24; no local Docker build was performed because Docker is unavailable. The Node entry point is tested with an injected PORT, the full updated health response, all 216 byte-exact file responses and content types, HEAD, 404, 405, malformed paths, and path handling. No browser surface was opened. Visual geometry, external font loading, and native browser rendering remain unverified. The native Figma canvas import is also incomplete; the source package does not claim a finished Figma design.

## Operating details

This is a static services website showcasing implementations MoreSpace can deliver. It does not connect visitors' accounts to 76 external platforms. Tool licenses, API access, permissions, data mapping, output review, measurement periods, and operating owners are agreed for each client implementation. Genuine brand images do not imply vendor partnership or endorsement.

The inquiry page creates a brief on the visitor's device. It does not send it to an inbox, CRM, WhatsApp number, or booking system. Those business destinations are needed to enable received inquiries. No tracking pixel or site analytics has been enabled. Remote fonts and 15 provider images may contact their hosts; hosting request logs are provider-managed. Worked metric examples are illustrative and do not represent client results or universal targets.

Source changes are maintained in content/ and brand-source/. Run npm run build and npm test; stage the regenerated container variables together and apply the deployment. For the optional repository-backed route, commit dist/ with its source and use the root Dockerfile. The current experimental railway-function.ts archive is 823,366 bytes, remains above the 96 KB Functions limit, is retained for package verification, excluded from the Docker build, and must not be deployed as a Railway Function.

## Railway references

- [Functions and their 96 KB source limit](https://docs.railway.com/functions)
- [Staged changes: Details and Deploy](https://docs.railway.com/deployments/staged-changes)
- [Image start commands](https://docs.railway.com/deployments/start-command)
- [Dockerfile deployments](https://docs.railway.com/builds/dockerfiles)
- [Config as Code deprecation](https://docs.railway.com/config-as-code/reference)
