# ProductEngineer.pro

**The Skill Atlas: a map of product engineering.** → [productengineer.pro](https://productengineer.pro)

A product engineer writes the software and also owns whether it matters. That means knowing who it
is for, whether people reach its value, and what the evidence says to do next. The job covers more
ground than any one role description. This site maps all of it, so you can see the whole discipline
at once, find the areas you never touch, and learn them from good sources.

The site has two parts. The **Atlas** maps the discipline. **Fieldwork** brings together reviews,
comparisons, maker interviews, experiments and shipped changes on real products. Every Fieldwork
entry lights the atlas skills it used, and each
skill page links back to it. See [docs/editorial.md](docs/editorial.md).

## The map

The atlas has three levels. There are **11 territories** plus a cross-cutting group, **72
capabilities**, and **about 350 skills**. Each skill is one tile on the map and has its own page:
a short description, a few checked resources (*Start here* and *Go deeper*), and the tools people
use for it.

| | Territory | The question it answers |
| --- | --- | --- |
| 01 | Discovery | Are we solving a real problem for the right people? |
| 02 | Strategy | Where should we invest our limited time and resources? |
| 03 | Experience | Can users understand, use and benefit from the solution? |
| 04 | Engineering | Can we implement this effectively, correctly, securely and sustainably? |
| 05 | Shipping | How do we shorten the time from decision to real feedback? |
| 06 | Measurement | What evidence supports our next decision? |
| 07 | Activation | How do we turn someone who tries the product into someone who experiences its value? |
| 08 | Retention | Why should users continue using the product? |
| 09 | Distribution | How does the product reach users who genuinely benefit from it? |
| 10 | Operations | Can we sustain the value we have created? |
| 11 | AI | How do we use AI effectively and build products whose behaviour depends on it? |
| X | Cross-cutting | How do you think, decide and work with others across every territory? |

Codes such as `06.4.5` read territory, capability, skill. Not every skill needs the same depth: do
the core work on your own, make informed decisions in the wider areas, and go deep where it pays
off. The atlas is a proposed framework, not a certification.

## How to use it

- **Scan the map** and look for the territories you rarely work in. That is usually where the next
  lesson is.
- **Mark skills** as *learning*, *comfortable* or *not interested*. Without an account your progress stays in your
  browser and nothing is sent anywhere. You can export a copy as a file.
- **Sign in, if you want,** with GitHub or Google to keep your map on every device. Your provider
  shares your profile and email address.
- **Connect an AI agent** to `https://productengineer.pro/mcp`. It can look up the whole atlas and,
  once you approve it, read your statuses.
- **Follow the links.** Every skill page links to related skills, so one topic leads to the next.
- **Browse [resources](https://productengineer.pro/resources/) and
  [tools](https://productengineer.pro/tools/)** across the whole atlas, filtered by type or
  territory.

## Focus, progress and AI

The explorer combines two filters: overlapping focus areas (People & collaboration, Product &
business, Software & systems, Data & evidence, AI & automation) and your progress. Each skill's
`focus` field lists its relevant areas. Both filters narrow the index and fill matching map tiles yellow;
they stay in the URL while you explore. `Not interested` is a reversible status, preserved by
export/import and account sync. Choose `Exclude not interested` to set those skills aside.

The AI territory contains AI engineering and AI-assisted work. General verification and workflow
automation remain cross-cutting; AI interaction design and inference costs connect from their own territories. Relevant skill pages
also include contextual AI workflows. Skill YAML supports three optional fields:

- `aiLeverage`: `workflow`, `limitations` and `verification`.
- `technicalLeverage`: what engineering knowledge enables you to implement or measure.
- `evidence`: a `practice` exercise, an `artifact` and a list of review `checks`.

Write specific applications where they help; omit these fields rather than adding generic advice.

## How resources are chosen

- Practitioners and primary sources, not summaries of them.
- Free, unless a paid book or course is the standard reference. Paid items are marked.
- No link is written from memory. Every link is opened and checked before it is saved, and a link
  checker runs again every week.
- Tools are widely used, with an open-source or free option where one exists. There are no
  affiliate links.
- Two good links beat a full quota, so some skills have fewer.

---

## Run it locally

The site is a static [Astro](https://astro.build) build with [Pagefind](https://pagefind.app)
search. Use Node 24 (`nvm use`, see `.nvmrc`); Astro 7 needs Node 22.23 or newer.

```sh
npm install
npm run dev            # http://localhost:4321
npm test               # content integrity + renderer (Vitest)
npm run build          # static build + search index
npm run test:visual    # Playwright snapshot of the map (after a build)
```

The API (accounts, synced progress, OAuth and MCP) lives in `server/`, with its own
[README](server/README.md). The dev server passes `/api`, `/oauth`, `/mcp` and the OAuth discovery
paths to it, as Apache does in production:

```sh
(cd server && npm install && cp .env.example .env)   # set PUBLIC_URL=http://localhost:4321 and DEV_LOGIN=1
npm run api            # exports the atlas for the API and starts it on :8790
npm run test:api       # API tests (node:test)
```

With `DEV_LOGIN=1` the profile page shows a *Dev sign-in* that needs no OAuth app.

## Editing the atlas

All content is YAML. There is no database and no CMS.

| Path | What |
| --- | --- |
| `src/content/atlas/<territory>.yaml` | The taxonomy: one file per territory, with its capabilities and skills. |
| `src/content/resources/*.yaml` | Resources keyed by id, grouped by the territory where each was first used. |
| `src/content/tools/tools.yaml` | Tools keyed by id. |
| `src/atlas/geometry.json` | The hex-tile layout. Generated once, then frozen. |
| `src/atlas/render.ts` | `(content, geometry, state) -> SVG`, shared by pages, the explorer and social images. |
| `src/atlas/ids.lock` | Every id ever published. Never remove a line. |
| `src/content/fieldwork/*.md` | Fieldwork entries: Markdown with front matter, fixed sections per kind. See [docs/editorial.md](docs/editorial.md). |
| `src/components/figures/` | Figures for entries (charts, diagrams, screen walkthroughs, decision figures), used from `.mdx` by name. Gallery at `/figures/`, reference in [docs/figures.md](docs/figures.md), regenerated with `npm run figures:docs`. |
| `src/content/products.yaml`, `src/content/author.yaml` | Products featured in Fieldwork, and author details used on `/about/`. |

**Add a resource or tool.** Open the URL and confirm it is live and on topic. Add the entry with
today's `checked` date, then reference its id from a skill or capability. For YouTube links, check
`https://www.youtube.com/oembed?format=json&url=<video url>`.

**Add a skill.** Add it under its capability, then run `npm run layout` (it gives the skill a free
tile; existing tiles never move) and `npm run lock-ids`.

**Rename a node.** Change `name`. If the id must change too, put the old id in `aliases`. The old URL
then redirects, and saved progress follows.

**Check links.** `npm run links` (add `--update` to refresh `checked` dates). `deploy/linkcheck.cron`
runs it weekly.

**Social images.** `npm run og` writes `public/og/*.jpg`.

## Deploy

Run `./deploy/setup.sh` once to set up the Apache vhost and TLS, and `./deploy/setup-api.sh` once to
add the API (it needs `server/.env.production` with the OAuth credentials; see `server/.env.example`).
Follow the [production setup checklist](server/README.md#production-setup-checklist) to configure
both OAuth apps, credentials and the first API deployment.
After that, `npm run deploy` tests, builds locally, updates the API and syncs `dist/` to the server. For page analytics, set `PUBLIC_ANALYTICS_SRC` (a
Plausible-compatible script URL) at build time; without it, nothing loads.
