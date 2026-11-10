# ProductEngineer.pro

The Skill Atlas: a static, interactive map of product engineering. See `PLAN.md` for the why.

Node 24 (`nvm use`, see `.nvmrc`). Astro 7 needs Node 22.23 or newer.

```sh
npm install
npm run dev            # http://localhost:4321
npm test               # content integrity + renderer (Vitest)
npm run build          # integrity check, static build, search index
npm run test:visual    # one Playwright snapshot of the map (after a build)
```

## Where things live

| Path | What |
| --- | --- |
| `src/content/atlas/<territory>.yaml` | The taxonomy: one file per territory with its capabilities and skills. One review batch each. |
| `src/content/resources/*.yaml` | Resources, keyed by id. Grouped by the territory where first used; any node can point to any resource. |
| `src/content/tools/tools.yaml` | Tools, keyed by id. |
| `src/atlas/geometry.json` | The hex-tile layout: one tile per skill, clusters per capability. Generated once, then frozen. |
| `src/atlas/render.ts` | `(content, geometry, state) -> SVG`. Used by static pages, the explorer and social images. |
| `src/atlas/ids.lock` | Every id ever published. Never remove a line. |
| `src/site.ts` | Site settings (name, URL, analytics). |

## Common tasks

**Edit a description.** Change the YAML; `npm test` checks the template lengths.

**Add a skill.** Add it under its capability, then:

```sh
npm run layout       # gives the new skill a free tile next to its cluster; existing tiles never move
npm run lock-ids     # records the new id
```

**Rename a node.** Change `name`. If the id must change too, put the old id in `aliases`; the old
URL redirects and saved progress follows.

**Add a resource or tool.** Open the URL and confirm it is live and on topic, then add the entry
with today's `checked` date and reference its id from the skill or capability. Never write a link
from memory. YouTube links: check with
`https://www.youtube.com/oembed?format=json&url=<video url>`.

**Check links.** `npm run links` (add `--update` to refresh `checked` dates on live links).
`deploy/linkcheck.cron` runs it weekly.

**Social images.** `node --experimental-strip-types scripts/og.ts` writes `public/og/*.jpg`.

**Deploy.** `./deploy/setup.sh` once (Apache vhost and TLS), then `./deploy/deploy.sh`. Both test
and build locally and sync `dist/` to the server.

**Analytics.** Set `PUBLIC_ANALYTICS_SRC` (a Plausible-compatible script URL) at build time.
Nothing loads without it.
