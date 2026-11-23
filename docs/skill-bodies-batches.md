# Skill bodies: the batch list

The plan for adding a body to every skill page, in batches. Why and what a body contains:
[skill-bodies.md](skill-bodies.md). The short description (`summary`, `description`) does not change.

- 350 skills in 40 batches: a pilot of 8, then 16 batches of skills people search for or that have
  evidence on the site (wave 1), then 23 batches with the rest of the map, whole capabilities together
  (wave 2).
- Tick a skill when its body is merged. A batch is done when all its boxes are ticked.
- The code is ready: an `.mdx` file in `src/content/skills/` shows on its skill page under the short
  description, with its sources, and the build fails if the file name is not a skill id. With no
  files, the pages do not change.
- Every body has one figure from the figure library ([figures.md](figures.md)). Bodies use figures by
  name, with no import, as In practice entries do. A link to an In practice entry shows the entry's
  logo and avatar in front of it.
- External links on the whole site get `utm_source=productengineer.pro` when the page is built
  (`src/middleware.ts`), so links in a body are written without it.
- Generated on 19 November 2026 from the atlas and the published In practice entries (Mamitsu, Zernio,
  Papermark, RelievApp Part I). New entries add notes; add them by hand to the skills they touch.

## Order and signals

Wave 1 takes every skill with at least one of these signals, grouped by territory and sorted by
score inside each territory:

- **search term**: a common industry term that people search for. This is a judgment call (62 skills),
  not measured. A keyword volume check for all 350 names costs about $0.09 (DataForSEO through treg)
  and can reorder wave 1.
- **In practice note**: a published entry has a sentence about how a real product used the skill
  (94 skills). These notes are the first source for the Example section. They are listed under each skill.

Other labels, for the writer:

- **has evidence / technicalLeverage / aiLeverage**: the page already shows these sections. The body
  must not repeat them.
- **1 resource / 0 resource**: the page is thin. Look for a second good resource while writing, and
  add it to the resource YAML if it passes the usual checks.

## How to run a batch

1. Take the first batch that still has unticked skills. Do the pilot first and stop after it: Mikel
   reviews the eight bodies and the rules below change if needed.
2. For each skill, read its page and its YAML (summary, description, related skills, resources and
   the leverage and evidence fields), and the "Start here" resources.
3. Write `src/content/skills/<skill-id>.mdx` in the format below: 250 to 450 words of prose, the four
   sections, in this order.
4. The Example uses a real product. First choice: the In practice note listed under the skill, with a
   link to the entry. Second: a public source you opened and checked, listed in `sources`. If there is
   no good example, leave the section out. Never invent a product, a number or a quote.
5. Add one figure that proves one point of the body, usually the Example or a step of How to do it.
   Pick it from [Figures by territory](figures.md#figures-by-territory) and follow the figure rules:
   - Its data comes from the same sources as the body: the In practice entry (often a figure the entry
     already has), or a public source in `sources`. Never example data: `illustrative` is not allowed
     in a body, and the tests fail on it.
   - The `caption` says what to read from it. Set `evidence` and `source` when the figure carries
     numbers or third-party facts; leave them out on quotes and on processes someone described.
   - Put it after the paragraph or list it supports, with a blank line before and after.
   - When nothing real can be shown (no numbers, no process, no quote), use a figure that needs no
     numbers, such as `ScopeCut`, `JobStory` or `Quote`, rather than inventing data.
6. Write in the voice of the site: international English, short sentences, plain verbs, no filler, no
   hype. Every link is opened and checked before it is saved. No link is written from memory.
7. Run `npm test` and `npm run build` (the build fails on a file whose name is not a skill id) and
   check the page, figure included, at 390 px.
8. Tick the boxes in this file. Mikel reviews the batch before it is deployed.

### File format

```mdx
---
updated: 2026-11-20
# Optional. Every source used for a fact or the example, opened and checked.
sources:
  - title: The product-minded software engineer
    url: https://blog.pragmaticengineer.com/the-product-minded-engineer/
---

## Why it matters for a product engineer

Two to four sentences.

## How to do it

1. Three to six steps, concrete enough to try this week.

## Common mistakes

- Three to five bullets.

## Example

Two to four sentences about a real product, with a name or a number.
([Papermark in In practice](/in-practice/papermark/))

<StatRow
  title="What the figure shows"
  stats={[
    { value: 265, label: 'Likes on the first tweet', signal: true },
    { value: 50, label: 'The bar set before it' },
  ]}
  caption="What to read from it, in one or two sentences."
  evidence="reported"
  source="Who said or measured it, and when"
/>
```

## Pilot

The pilot covers eight territories, so the review shows how the format works for very different
skills. `mvp` already has a sample body in [skill-bodies.md](skill-bodies.md).

### Batch 1 (pilot) · 8 territories · 8 skills

- [x] `02.5.1` [Minimum viable product](https://productengineer.pro/skills-map/strategy/product-scoping/mvp/) · `mvp` · search term; 1 In practice note; has evidence, technicalLeverage, aiLeverage; 1 resource
  - Papermark: A weekend build on Next.js and Vercel; upload a PDF, share a link, see who read which page. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `01.2.1` [User interviews](https://productengineer.pro/skills-map/discovery/user-research/user-interviews/) · `user-interviews` · search term; has evidence, technicalLeverage, aiLeverage
- [x] `05.3.1` [Feature flags](https://productengineer.pro/skills-map/shipping/controlled-releases/feature-flags/) · `feature-flags` · search term; 1 In practice note; has evidence, technicalLeverage, aiLeverage; 1 resource
  - Mamitsu: New code goes out behind a flag when it needs one. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `07.3.2` [Activation metric](https://productengineer.pro/skills-map/activation/time-to-value/activation-events/) · `activation-events` · search term
- [x] `08.2.1` [Retention curves](https://productengineer.pro/skills-map/retention/retention-analysis/retention-curves/) · `retention-curves` · search term
- [x] `06.3.1` [Funnels](https://productengineer.pro/skills-map/measurement/behavioral-analysis/funnel-analysis/) · `funnel-analysis` · search term; has evidence, technicalLeverage, aiLeverage; 1 resource
- [x] `09.2.1` [SEO](https://productengineer.pro/skills-map/distribution/organic-acquisition/seo/) · `seo` · search term; 3 In practice notes; has evidence, technicalLeverage, aiLeverage
  - Mamitsu: He works on GEO, being cited by AI answers, with prompts that run every day. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: Long-tail searches like "social media API" and "Meta app review", many of them won from Ayrshare. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: Alternative pages for DocSend and the data room incumbents; Latka read a domain rating of 73 on air. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `11.1.6` [Model Context Protocol](https://productengineer.pro/skills-map/ai/ai-engineering/mcp/) · `mcp` · search term; 3 In practice notes; has evidence, technicalLeverage; 1 resource
  - Mamitsu: Agents such as Claude Code or Codex call it through an MCP server and get back only the fields they need. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: The MCP server and the CLI are generated from the API, so each new endpoint reaches agents at no extra cost. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: An MCP server with 57 tools mapped to the REST API, and a verified connector in Claude. ([entry](https://productengineer.pro/in-practice/papermark/))

## Wave 1: searched skills and skills with evidence

### Batch 2 · Discovery · 8 skills

- [x] `01.4.1` [Competitive analysis](https://productengineer.pro/skills-map/discovery/market-research/competitive-analysis/) · `competitive-analysis` · search term; 4 In practice notes; has evidence, technicalLeverage, aiLeverage
  - Mamitsu: Supadata, PostReef and Apify already do the job; Mamitsu publishes comparison pages against five rivals. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: Metricool serves marketers, Ayrshare was the direct rival, and Twilio has sold the same model for WhatsApp for years. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: DocSend was the tool everyone knew and few liked, and it had slowed down after Dropbox bought it. ([entry](https://productengineer.pro/in-practice/papermark/))
  - RelievApp: Calm and Headspace teach meditation, Breathwrk guides breathing, Lumenate and TRIPP make you watch; RelievApp asks you to act. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `01.1.2` [Ideal customer profile](https://productengineer.pro/skills-map/discovery/user-understanding/ideal-customer-profile/) · `ideal-customer-profile` · search term; 2 In practice notes
  - Zernio: SaaS teams that embed it white-labelled come first, agencies second, people managing their own accounts last. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: From founders sending one deck to deal teams running fundraising, M&A and due diligence in data rooms. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `01.1.4` [Jobs to be done](https://productengineer.pro/skills-map/discovery/user-understanding/jobs-to-be-done/) · `jobs-to-be-done` · search term; 1 In practice note; 1 resource
  - RelievApp: The strongest of seven jobs was "a way in that isn't meditation", and it was only said in a FAQ. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `01.3.2` [Unmet needs](https://productengineer.pro/skills-map/discovery/problem-identification/unmet-needs/) · `unmet-needs` · 2 In practice notes
  - Mamitsu: Useful information is locked inside videos, and apps and agents have no simple way to get it out. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: A product that wants its users to post, message or run ads from inside it has to pass each platform's app review first. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `01.4.2` [Substitutes and existing solutions](https://productengineer.pro/skills-map/discovery/market-research/substitutes/) · `substitutes` · 2 In practice notes; 1 resource
  - Zernio: Building each integration in-house, or connectors like Zapier and n8n that still need your own developer app. ([entry](https://productengineer.pro/in-practice/zernio/))
  - RelievApp: For someone anxious right now, the alternative is a breathing video or the phone's feed, not another app. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `01.4.4` [Market trends](https://productengineer.pro/skills-map/discovery/market-research/market-trends/) · `market-trends` · 2 In practice notes; 1 resource
  - Mamitsu: Software made for agents to call, more than for people to open. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Papermark: In 2023 open-source alternatives to older SaaS were a wave, and Papermark joined it early. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `01.1.3` [Personas](https://productengineer.pro/skills-map/discovery/user-understanding/personas/) · `personas` · search term; 1 resource
- [x] `01.2.3` [Surveys](https://productengineer.pro/skills-map/discovery/user-research/surveys/) · `surveys` · search term

### Batch 3 · Discovery · 7 skills

- [x] `01.4.6` [Market sizing](https://productengineer.pro/skills-map/discovery/market-research/market-sizing/) · `market-sizing` · search term
- [x] `01.5.5` [Landing-page tests](https://productengineer.pro/skills-map/discovery/opportunity-validation/landing-page-tests/) · `landing-page-tests` · search term
- [x] `01.1.1` [User segments](https://productengineer.pro/skills-map/discovery/user-understanding/user-segments/) · `user-segments` · 1 In practice note
  - Mamitsu: Beta users wanted it for recipes, coffee and travel, so the users were developers with video data, not coffee drinkers. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `01.4.3` [Market structure](https://productengineer.pro/skills-map/discovery/market-research/market-structure/) · `market-structure` · 1 In practice note
  - RelievApp: An outside review mapped four categories, from meditation to digital therapeutics, and placed Reliev in interactive wellness. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `01.5.3` [Desirability tests](https://productengineer.pro/skills-map/discovery/opportunity-validation/desirability-tests/) · `desirability-tests` · 1 In practice note; 1 resource
  - Papermark: Marc bet his wife a tweet about the idea would get 50 likes before he built anything; it got 265. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `01.5.4` [Willingness to pay](https://productengineer.pro/skills-map/discovery/opportunity-validation/willingness-to-pay/) · `willingness-to-pay` · 1 In practice note
  - Papermark: The first customers asked to pay before payments were finished. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `01.6.3` [Domain constraints](https://productengineer.pro/skills-map/discovery/domain-understanding/domain-constraints/) · `domain-constraints` · 1 In practice note
  - Zernio: Meta asks for a screencast and about 14 days per permission, YouTube caps uploads, WhatsApp charges for templates outside a 24-hour window. ([entry](https://productengineer.pro/in-practice/zernio/))

### Batch 4 · Strategy · 10 skills

- [x] `02.7.2` [Pricing](https://productengineer.pro/skills-map/strategy/business-models/pricing/) · `pricing` · search term; 3 In practice notes
  - Mamitsu: Prepaid credits that do not expire, several times cheaper per video than Supadata. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: Two accounts free with no card, then $6, $3 and $1 a month per account as the volume grows. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: Flat monthly plans with three users included, against DocSend's price per user. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `02.1.4` [Differentiation](https://productengineer.pro/skills-map/strategy/product-vision/differentiation/) · `differentiation` · 3 In practice notes
  - Mamitsu: The model gets the raw video, not a transcript, and the answer comes back in the same request. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Papermark: The customer's domain and brand on every link and room, where incumbents show their own. ([entry](https://productengineer.pro/in-practice/papermark/))
  - RelievApp: Eyes open, hands on, two minutes, against products you listen to. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `02.2.2` [Competitive advantage](https://productengineer.pro/skills-map/strategy/product-positioning/competitive-advantage/) · `competitive-advantage` · 3 In practice notes; 1 resource
  - Mamitsu: A product built on the labs' models, or for their agents, can be copied when a lab ships it as a feature. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: Endpoints are easy to copy, by his own account; approved apps, quotas and platform relationships are not. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: Nobody can undercut a free core, and anyone can audit it. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `02.5.4` [Cutting scope](https://productengineer.pro/skills-map/strategy/product-scoping/scope-cutting/) · `scope-cutting` · 3 In practice notes
  - Mamitsu: Four platforms and one call, a link and a question in and JSON out; transcript features and a generic scraper stay out. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: No product of its own for marketers, because it would compete with its customers. ([entry](https://productengineer.pro/in-practice/zernio/))
  - RelievApp: On 16 Nov the catalog was cut from 18 sessions to 12 and the brain left; on 18 Nov it grew to 21. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `02.1.3` [Value proposition](https://productengineer.pro/skills-map/strategy/product-vision/value-proposition/) · `value-proposition` · search term; 1 In practice note; 1 resource
  - RelievApp: The promise moved from one picture to a place to go: "Whatever you feel, feel better." ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `02.3.3` [North Star metric](https://productengineer.pro/skills-map/strategy/goal-setting/north-star-metric/) · `north-star-metric` · search term; 1 In practice note; 1 resource
  - Papermark: Views of shared documents, 800,000 by mid-2025. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `02.6.1` [Roadmaps](https://productengineer.pro/skills-map/strategy/product-planning/roadmaps/) · `roadmaps` · search term; 1 In practice note
  - Zernio: Integrators ask for the next channel, and Zernio builds it when the rest of its users would use it too. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `02.1.2` [Vision and direction](https://productengineer.pro/skills-map/strategy/product-vision/long-term-direction/) · `long-term-direction` · 2 In practice notes; 1 resource
  - Zernio: No plan to sell; in five years he sees himself in the same seat. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: The next goal is $10M ARR, still bootstrapped. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `02.2.1` [Target audience](https://productengineer.pro/skills-map/strategy/product-positioning/target-audience/) · `target-audience` · 2 In practice notes
  - Mamitsu: Developers of apps and agents, with marketing teams that check sponsored videos as the first niche. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - RelievApp: People who want what meditation gives but can't sit still with it, most of all when they are anxious. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `02.2.3` [Market category](https://productengineer.pro/skills-map/strategy/product-positioning/category-positioning/) · `category-positioning` · 2 In practice notes
  - Papermark: From "the open-source DocSend alternative" to "secure data rooms for dealmakers". ([entry](https://productengineer.pro/in-practice/papermark/))
  - RelievApp: From its own category ("transitions") to a meditation app with superpowers, then to "your personal emotional regulator". ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))

### Batch 5 · Strategy · 9 skills

- [x] `02.7.1` [Revenue models](https://productengineer.pro/skills-map/strategy/business-models/revenue-models/) · `revenue-models` · 2 In practice notes; 1 resource
  - Zernio: Lifetime licences on AppSumo at launch, subscription tiers next to them, usage-based billing since early 2026. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: Open core, with a free AGPL core, a hosted service and a commercial licence for the features in ee/. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `02.7.4` [Costs and margins](https://productengineer.pro/skills-map/strategy/business-models/costs-and-margins/) · `costs-and-margins` · 2 In practice notes; 1 resource
  - Zernio: About 87% gross margin, without having optimised anything yet. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: About 80% of spend on freelancers and the founders' salaries, 15% on growth experiments, the rest on tools; profitable. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `02.3.2` [Objectives and key results](https://productengineer.pro/skills-map/strategy/goal-setting/okrs/) · `okrs` · search term
- [x] `02.3.5` [Guardrail metrics](https://productengineer.pro/skills-map/strategy/goal-setting/guardrail-metrics/) · `guardrail-metrics` · search term; 1 resource
- [x] `02.4.2` [Impact versus effort](https://productengineer.pro/skills-map/strategy/prioritization/impact-effort/) · `impact-effort` · search term; 1 resource
- [x] `02.4.4` [Cost of delay](https://productengineer.pro/skills-map/strategy/prioritization/cost-of-delay/) · `cost-of-delay` · search term
- [x] `02.7.5` [Customer lifetime value](https://productengineer.pro/skills-map/strategy/business-models/lifetime-value/) · `lifetime-value` · search term
- [x] `02.4.3` [Risk and uncertainty](https://productengineer.pro/skills-map/strategy/prioritization/product-risk/) · `product-risk` · 1 In practice note
  - Zernio: The platforms could close the door, and the largest customers could build it themselves. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `02.7.3` [Packaging](https://productengineer.pro/skills-map/strategy/business-models/packaging/) · `packaging` · 1 In practice note
  - Papermark: Seven plans from free to €999 a month; the top tier they hesitated to add grew fastest. ([entry](https://productengineer.pro/in-practice/papermark/))

### Batch 6 · Experience · 6 skills

- [x] `03.3.6` [Design systems](https://productengineer.pro/skills-map/experience/ui-design/design-systems/) · `design-systems` · search term; 1 In practice note; 1 resource
  - RelievApp: Written rules every session follows, for people and agents, with Lev as the one character. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `03.4.5` [Usability testing](https://productengineer.pro/skills-map/experience/prototyping/usability-testing/) · `usability-testing` · search term; has evidence, technicalLeverage, aiLeverage
- [x] `03.1.1` [Journey mapping](https://productengineer.pro/skills-map/experience/user-journeys/journey-mapping/) · `journey-mapping` · search term
- [x] `03.1.2` [User flows](https://productengineer.pro/skills-map/experience/user-journeys/user-flows/) · `user-flows` · search term; 1 resource
- [x] `03.1.5` [Information architecture](https://productengineer.pro/skills-map/experience/user-journeys/information-architecture/) · `information-architecture` · search term
- [x] `03.2.8` [AI interaction design](https://productengineer.pro/skills-map/experience/interaction-design/ai-interaction-design/) · `ai-interaction-design` · 1 In practice note; has evidence, technicalLeverage; 1 resource
  - Mamitsu: Experiences augmented with AI have no settled patterns yet. ([entry](https://productengineer.pro/in-practice/mamitsu/))

### Batch 7 · Experience · 6 skills

- [x] `03.4.2` [Wireframes](https://productengineer.pro/skills-map/experience/prototyping/wireframes/) · `wireframes` · search term; 1 resource
- [x] `03.4.4` [Functional prototypes](https://productengineer.pro/skills-map/experience/prototyping/functional-prototypes/) · `functional-prototypes` · 1 In practice note; has evidence, technicalLeverage, aiLeverage; 1 resource
  - Mamitsu: A two-hour demo instead of explaining an idea. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `03.5.5` [WCAG principles](https://productengineer.pro/skills-map/experience/accessibility/wcag/) · `wcag` · search term
- [x] `03.2.3` [System feedback](https://productengineer.pro/skills-map/experience/interaction-design/interface-feedback/) · `interface-feedback` · 1 In practice note; 1 resource
  - RelievApp: Every touch is answered with shape, sound or a haptic, one gesture per phase, and nothing can be failed. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `03.3.4` [Color](https://productengineer.pro/skills-map/experience/ui-design/color/) · `color` · 1 In practice note
  - RelievApp: Ten colours and no others, each with a meaning; a session moves from its hard colour to its settled one. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `03.6.4` [Plain language](https://productengineer.pro/skills-map/experience/content-design/plain-language/) · `plain-language` · 1 In practice note
  - RelievApp: No engine words in the copy, checked by a script, and English written for people who learned it second. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))

### Batch 8 · Engineering · 10 skills

- [x] `04.1.3` [API design](https://productengineer.pro/skills-map/engineering/software-development/api-design/) · `api-design` · search term; 1 In practice note; 1 resource
  - Zernio: One posts endpoint for every network, analytics stored and refreshed on Zernio's side, and features that ship in the API before the dashboard. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `04.1.5` [Asynchronous systems](https://productengineer.pro/skills-map/engineering/software-development/async-systems/) · `async-systems` · 2 In practice notes
  - Zernio: Platform events moved from cron jobs to Cloudflare queues. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: PDF-to-image conversion, video optimisation, bulk downloads and notifications run as Trigger.dev jobs. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `04.2.5` [Scalability](https://productengineer.pro/skills-map/engineering/software-architecture/scalability/) · `scalability` · 2 In practice notes
  - Mamitsu: Daily load tests, because holding load was his condition for selling it. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: About 100,000 posts a day, plus a constant flow of webhooks from the platforms. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `04.4.4` [Code review](https://productengineer.pro/skills-map/engineering/engineering-quality/code-review/) · `code-review` · search term; has evidence, technicalLeverage, aiLeverage; 1 resource
- [x] `04.4.6` [Refactoring](https://productengineer.pro/skills-map/engineering/engineering-quality/refactoring/) · `refactoring` · search term
- [x] `04.5.4` [Caching](https://productengineer.pro/skills-map/engineering/performance-engineering/caching/) · `caching` · search term
- [x] `04.6.3` [Threat modeling](https://productengineer.pro/skills-map/engineering/security-engineering/threat-modeling/) · `threat-modeling` · search term; 1 resource
- [x] `04.6.5` [Data protection](https://productengineer.pro/skills-map/engineering/security-engineering/data-protection/) · `data-protection` · 1 In practice note; has evidence, technicalLeverage; 1 resource
  - Papermark: Dynamic watermarks, screenshot protection, NDA gates, email verification and one-time codes for bulk downloads. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `04.1.6` [Code organization](https://productengineer.pro/skills-map/engineering/software-development/code-organization/) · `code-organization` · 1 In practice note; 1 resource
  - Papermark: Paid features live in ee/ folders under a commercial licence; the rest of the repository is AGPLv3. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `04.5.2` [Throughput](https://productengineer.pro/skills-map/engineering/performance-engineering/throughput/) · `throughput` · 1 In practice note; 1 resource
  - Mamitsu: From a block after about five requests to 3,000 TikTok requests a minute in his own load tests. ([entry](https://productengineer.pro/in-practice/mamitsu/))

### Batch 9 · Shipping · 8 skills

- [x] `05.2.1` [CI/CD pipelines](https://productengineer.pro/skills-map/shipping/release-engineering/ci-cd/) · `ci-cd` · search term
- [x] `05.3.4` [Canary releases](https://productengineer.pro/skills-map/shipping/controlled-releases/canary-releases/) · `canary-releases` · search term
- [x] `05.1.1` [Small batches](https://productengineer.pro/skills-map/shipping/iterative-delivery/small-batches/) · `small-batches` · 1 In practice note; 1 resource
  - Papermark: Weekends and nights at first; now they ship to production almost every day. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `05.1.3` [Early feedback](https://productengineer.pro/skills-map/shipping/iterative-delivery/early-feedback/) · `early-feedback` · 1 In practice note
  - Papermark: Unfinished features shared anyway, and six dev.to posts on how each part was built. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `05.2.4` [Rollback strategies](https://productengineer.pro/skills-map/shipping/release-engineering/rollbacks/) · `rollbacks` · 1 In practice note
  - Mamitsu: Every PR carries its own rollback plan; it has been used once. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `05.4.2` [Release notes and communication](https://productengineer.pro/skills-map/shipping/release-readiness/release-communication/) · `release-communication` · 1 In practice note; 1 resource
  - Papermark: A public changelog, and milestone posts that list every release month by month. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `05.4.3` [Launch telemetry](https://productengineer.pro/skills-map/shipping/release-readiness/launch-telemetry/) · `launch-telemetry` · 1 In practice note; 1 resource
  - Mamitsu: After a merge, an agent watches the logs until about ten requests have gone through the new code. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `05.5.2` [Delivery risk](https://productengineer.pro/skills-map/shipping/delivery-management/delivery-risk/) · `delivery-risk` · 1 In practice note; 1 resource
  - Mamitsu: A referee agent scores every PR and sends it back to Hermes, merges it or waits for Unai. ([entry](https://productengineer.pro/in-practice/mamitsu/))

### Batch 10 · Measurement · 7 skills

- [x] `06.1.1` [Event schemas](https://productengineer.pro/skills-map/measurement/product-instrumentation/event-schemas/) · `event-schemas` · 2 In practice notes
  - Papermark: One page_views event per page viewed, with its duration, page number and document version. ([entry](https://productengineer.pro/in-practice/papermark/))
  - RelievApp: Check-in, start, complete, exit with progress, and a before and after rating that only counts if you touched it. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `06.2.7` [Revenue metrics](https://productengineer.pro/skills-map/measurement/product-metrics/revenue-metrics/) · `revenue-metrics` · 2 In practice notes
  - Zernio: Net MRR expansion is the main metric, with ARR growing about €1M a month. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: $1M ARR in 18 months, $2M six months later, $3M four months after that. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `06.4.4` [A/B tests](https://productengineer.pro/skills-map/measurement/experiment-design/ab-tests/) · `ab-tests` · search term; has evidence, technicalLeverage, aiLeverage
- [x] `06.3.2` [Cohort analysis](https://productengineer.pro/skills-map/measurement/behavioral-analysis/cohort-analysis/) · `cohort-analysis` · search term
- [x] `06.4.5` [Sample size](https://productengineer.pro/skills-map/measurement/experiment-design/sample-size/) · `sample-size` · search term
- [x] `06.5.2` [Confidence intervals](https://productengineer.pro/skills-map/measurement/statistical-reasoning/confidence-intervals/) · `confidence-intervals` · search term; 1 resource
- [x] `06.5.4` [Statistical power](https://productengineer.pro/skills-map/measurement/statistical-reasoning/statistical-power/) · `statistical-power` · search term

### Batch 11 · Measurement + Activation + Retention · 13 skills

- [x] `06.2.2` [Engagement](https://productengineer.pro/skills-map/measurement/product-metrics/engagement-metrics/) · `engagement-metrics` · 1 In practice note
  - Papermark: Time per page, completion and visits per document and room, which is what customers pay for. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `06.2.5` [Retention](https://productengineer.pro/skills-map/measurement/product-metrics/retention-metrics/) · `retention-metrics` · 1 In practice note
  - Mamitsu: Not tracked yet; I suggested asking which extractions bring users back. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `06.3.3` [Segmentation](https://productengineer.pro/skills-map/measurement/behavioral-analysis/behavioral-segmentation/) · `behavioral-segmentation` · 1 In practice note; 1 resource
  - Zernio: The first split of users by use case showed integrators are 2% of signups and half the MRR. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `06.6.1` [Feedback analysis](https://productengineer.pro/skills-map/measurement/qualitative-evaluation/feedback-analysis/) · `feedback-analysis` · 1 In practice note
  - Mamitsu: Feedback arrives through the support email; since the call, a weekly agent report reads the extractions. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `06.6.3` [Observing real usage](https://productengineer.pro/skills-map/measurement/qualitative-evaluation/usage-observation/) · `usage-observation` · 1 In practice note; 1 resource
  - Mamitsu: He looks at what people ask Mamitsu now and then, by hand. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `06.7.3` [Balancing signals](https://productengineer.pro/skills-map/measurement/evidence-based-decisions/balancing-signals/) · `balancing-signals` · 1 In practice note
  - Zernio: Bernat's push, the loudest users bring 2% of the revenue; Miquel thinks they still bring reviews and word of mouth. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `06.7.4` [Iterate, expand or stop](https://productengineer.pro/skills-map/measurement/evidence-based-decisions/iterate-expand-stop/) · `iterate-expand-stop` · 1 In practice note
  - RelievApp: The catalog is broad so the numbers can say which sessions to keep, change or drop. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `07.3.1` [Aha moments](https://productengineer.pro/skills-map/activation/time-to-value/aha-moments/) · `aha-moments` · search term; 1 resource
- [x] `07.3.4` [Removing unnecessary steps](https://productengineer.pro/skills-map/activation/time-to-value/step-reduction/) · `step-reduction` · 1 In practice note; 1 resource
  - Papermark: Templates and an AI-generated folder structure, so a data room is up in under a minute. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `07.4.2` [Trust signals](https://productengineer.pro/skills-map/activation/conversion-optimization/trust-signals/) · `trust-signals` · 1 In practice note; 1 resource
  - Papermark: ISO 27001 and SOC 2 Type II above the headline, then customer logos and a rating. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `08.2.2` [Churn](https://productengineer.pro/skills-map/retention/retention-analysis/churn-analysis/) · `churn-analysis` · search term; 1 In practice note; has evidence, technicalLeverage, aiLeverage
  - Zernio: 9% blended, about 2% for integrators and about 17% for end users. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `08.1.2` [Recurring needs](https://productengineer.pro/skills-map/retention/recurring-value/recurring-needs/) · `recurring-needs` · 2 In practice notes; 1 resource
  - Zernio: Every new permission or quota means another review, so integrators keep needing Zernio after the first one. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: A fundraise or a sale ends, so the need comes back only with the next deal. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `08.4.1` [Re-engaging dormant users](https://productengineer.pro/skills-map/retention/customer-lifecycle/re-engagement/) · `re-engagement` · 1 In practice note
  - Papermark: A three-month pause instead of cancelling, with links still live and an email when someone views a paused room. ([entry](https://productengineer.pro/in-practice/papermark/))

### Batch 12 · Distribution · 8 skills

- [x] `09.2.2` [Content](https://productengineer.pro/skills-map/distribution/organic-acquisition/content-marketing/) · `content-marketing` · search term; 2 In practice notes; 1 resource
  - Mamitsu: Guides, comparison pages and docs, drafted by an agent from the gaps and read by him before they go out. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: Useful blog posts from a dedicated writer, after an earlier product lost its place in Google to 50,000 AI-written posts. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `09.4.1` [Self-serve adoption](https://productengineer.pro/skills-map/distribution/product-led-growth/self-serve-adoption/) · `self-serve-adoption` · search term; 2 In practice notes; 1 resource
  - Zernio: Sign up, connect two accounts with no card and no sales call; sales only past 2,000 accounts. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: About 100 signups a day on a free plan with no card, and about 100 new paying customers a month. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `09.6.1` [Customer acquisition cost](https://productengineer.pro/skills-map/distribution/growth-economics/customer-acquisition-cost/) · `customer-acquisition-cost` · search term; 2 In practice notes
  - Zernio: About €20 per paying customer, blended; competitor keywords convert cheapest. ([entry](https://productengineer.pro/in-practice/zernio/))
  - RelievApp: At €49.50 a year, paid ads alone can't carry the product, so distribution has to live inside it. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `09.1.1` [Channel selection](https://productengineer.pro/skills-map/distribution/go-to-market/channel-selection/) · `channel-selection` · 3 In practice notes; 1 resource
  - Mamitsu: Take the product to where people already are, like WhatsApp or the assistant they use. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Papermark: They tested more than 14 channels and kept 3. ([entry](https://productengineer.pro/in-practice/papermark/))
  - RelievApp: On 15 Nov each channel got its own front door, a toy for TikTok and a reset for Reels; on 16 Nov they were folded into one. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `09.3.1` [Referral loops](https://productengineer.pro/skills-map/distribution/viral-growth/referral-loops/) · `referral-loops` · search term; 1 In practice note; 1 resource
  - RelievApp: The gift card appears after a session that helped, and the person who receives one can give one too. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `09.6.3` [Attribution](https://productengineer.pro/skills-map/distribution/growth-economics/attribution/) · `attribution` · search term; 1 In practice note; 1 resource
  - Mamitsu: He can see Mamitsu cited more often, but not whether those citations bring users. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `09.1.2` [Launch planning](https://productengineer.pro/skills-map/distribution/go-to-market/launch-planning/) · `launch-planning` · 2 In practice notes; 1 resource
  - Mamitsu: A quiet launch first, and a wider relaunch next, Hacker News included. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: Launched on AppSumo in August 2025, because the marketplace brings the buyers and nobody else cares what you launch. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `09.2.6` [Directories and app stores](https://productengineer.pro/skills-map/distribution/organic-acquisition/discovery-platforms/) · `discovery-platforms` · 2 In practice notes
  - Mamitsu: Directories that AI answers cite count, and one that disagrees with your own site makes you less credible. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: Zapier and Make integrations partly for the link, and paid spots in "best API" rankings. ([entry](https://productengineer.pro/in-practice/zernio/))

### Batch 13 · Distribution · 8 skills

- [x] `09.3.2` [Sharing mechanics](https://productengineer.pro/skills-map/distribution/viral-growth/sharing-mechanics/) · `sharing-mechanics` · 2 In practice notes; 1 resource
  - Papermark: Every link without a custom domain is on papermark.com, so every visitor sees the product. ([entry](https://productengineer.pro/in-practice/papermark/))
  - RelievApp: A link that names the session, never the feeling, and opens free with the sender's name. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `09.2.5` [Developer relations](https://productengineer.pro/skills-map/distribution/organic-acquisition/developer-relations/) · `developer-relations` · search term
- [x] `09.3.4` [Network effects](https://productengineer.pro/skills-map/distribution/viral-growth/network-effects/) · `network-effects` · search term
- [x] `09.5.3` [Product demonstrations](https://productengineer.pro/skills-map/distribution/b2b-acquisition/product-demos/) · `product-demos` · search term; 0 resource
- [x] `09.2.3` [Communities](https://productengineer.pro/skills-map/distribution/organic-acquisition/communities/) · `communities` · 1 In practice note; 1 resource
  - Papermark: A circle of commercial open-source founders, Hacktoberfest, and 1,000 GitHub stars in the first months. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `09.2.4` [Social platforms](https://productengineer.pro/skills-map/distribution/organic-acquisition/social-platforms/) · `social-platforms` · 1 In practice note
  - Papermark: Twitter launched it; LinkedIn is where the customers are now. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `09.6.4` [Channel performance](https://productengineer.pro/skills-map/distribution/growth-economics/channel-performance/) · `channel-performance` · 1 In practice note; 1 resource
  - Zernio: About 40% of new business from organic search; paid brings about a quarter of the new MRR. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `09.6.5` [Payback and sustainable growth](https://productengineer.pro/skills-map/distribution/growth-economics/sustainable-growth/) · `sustainable-growth` · 1 In practice note; 1 resource
  - Zernio: Paid on its own pays back in about ten months, and he will not spend more until the campaigns are under control. ([entry](https://productengineer.pro/in-practice/zernio/))

### Batch 14 · Operations · 6 skills

- [x] `10.4.1` [Support workflows](https://productengineer.pro/skills-map/operations/user-support/support-workflows/) · `support-workflows` · 3 In practice notes; has evidence, technicalLeverage, aiLeverage; 0 resource
  - Mamitsu: Support emails he forwards become Slack threads that an agent investigates. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: 300 tickets a day after launch, answered by Miquel with Claude; the third hire was a developer only for support. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: Every support request is still answered by one of the two founders. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `10.2.3` [Incident response](https://productengineer.pro/skills-map/operations/reliability-engineering/incident-response/) · `incident-response` · search term; has evidence, technicalLeverage, aiLeverage
- [x] `10.2.2` [SLOs and error budgets](https://productengineer.pro/skills-map/operations/reliability-engineering/slos/) · `slos` · search term
- [x] `10.3.2` [Technical debt](https://productengineer.pro/skills-map/operations/maintenance/technical-debt/) · `technical-debt` · search term; 1 resource
- [x] `10.1.5` [Alerting](https://productengineer.pro/skills-map/operations/product-observability/alerting/) · `alerting` · 1 In practice note
  - Mamitsu: An agent polls Sentry and opens a Slack thread for each new error. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `10.3.1` [Bug triage and fixes](https://productengineer.pro/skills-map/operations/maintenance/bug-fixing/) · `bug-fixing` · 1 In practice note; 1 resource
  - Mamitsu: Fixes go through the same risk check; one reached production before Unai read about the error. ([entry](https://productengineer.pro/in-practice/mamitsu/))

### Batch 15 · Operations · 6 skills

- [x] `10.3.4` [Migrations and upgrades](https://productengineer.pro/skills-map/operations/maintenance/platform-upgrades/) · `platform-upgrades` · 1 In practice note; 1 resource
  - Zernio: The move has to happen with zero downtime and without a single user noticing. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `10.4.2` [Investigating user issues](https://productengineer.pro/skills-map/operations/user-support/issue-investigation/) · `issue-investigation` · 1 In practice note
  - Mamitsu: The agent works out whether the error is real and whether Unai needs to look. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `10.5.3` [Data governance](https://productengineer.pro/skills-map/operations/governance-compliance/data-governance/) · `data-governance` · 1 In practice note; 1 resource
  - Papermark: Data in the EU by default, US residency for enterprise, multi-region storage since June 2025. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `10.5.5` [Regulatory constraints](https://productengineer.pro/skills-map/operations/governance-compliance/regulatory-compliance/) · `regulatory-compliance` · 1 In practice note; 1 resource
  - Papermark: SOC 2 Type II and ISO 27001, with GDPR, HIPAA and CCPA workflows. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `10.6.1` [Infrastructure costs](https://productengineer.pro/skills-map/operations/operational-economics/infrastructure-costs/) · `infrastructure-costs` · 1 In practice note
  - Zernio: Vercel became expensive at Zernio's volume, so parts moved to Cloudflare and the whole API is next. ([entry](https://productengineer.pro/in-practice/zernio/))
- [x] `10.6.4` [Cost to serve](https://productengineer.pro/skills-map/operations/operational-economics/cost-to-serve/) · `cost-to-serve` · 1 In practice note; 1 resource
  - Zernio: Free accounts cost little; X is the exception because its API is paid, so connecting X asks for a card. ([entry](https://productengineer.pro/in-practice/zernio/))

### Batch 16 · AI · 9 skills

- [x] `11.1.4` [Agents](https://productengineer.pro/skills-map/ai/ai-engineering/ai-agents/) · `ai-agents` · search term; 3 In practice notes; has evidence, technicalLeverage
  - Mamitsu: Hermes runs on a Linux box at home, with nine or ten profiles split by project. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: End users run their posts and ads from Claude or Codex, and customers sell marketing on autopilot built on Zernio. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: Agents build a room's folders from a deal description and answer questions across documents with citations. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `11.2.1` [Delegating to agents](https://productengineer.pro/skills-map/ai/ai-assisted-work/delegating-to-agents/) · `delegating-to-agents` · 4 In practice notes; has evidence, technicalLeverage, aiLeverage
  - Mamitsu: Hermes hands the coding to Pi agents, which come back with code and proof that it works. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: He answered support with Claude, Claude writes the migrations, and the team wants to stop being the person between Claude and the customer. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: Cursor and CodeRabbit show up in the repository's contribution graph. ([entry](https://productengineer.pro/in-practice/papermark/))
  - RelievApp: Three agents worked on the same code in parallel, told each other what they committed, and committed only their own changes. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `11.1.2` [Structured outputs](https://productengineer.pro/skills-map/ai/ai-engineering/structured-outputs/) · `structured-outputs` · search term; 1 In practice note; has evidence, technicalLeverage; 1 resource
  - Mamitsu: Frames, audio and caption in; JSON in the shape you asked for out, with an optional JSON Schema. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `11.1.7` [Evals and datasets](https://productengineer.pro/skills-map/ai/ai-engineering/ai-evals/) · `ai-evals` · search term; 1 In practice note; has evidence, technicalLeverage
  - Mamitsu: No evals yet; he reads extractions himself. A weekly agent report came out of the call, and the first one arrived three days later. ([entry](https://productengineer.pro/in-practice/mamitsu/))
- [x] `11.2.3` [Human oversight](https://productengineer.pro/skills-map/ai/ai-assisted-work/human-oversight/) · `human-oversight` · 2 In practice notes; has evidence, technicalLeverage
  - Mamitsu: He reviews only the changes an agent scores as risky. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - RelievApp: Agents built nine sessions, a mascot and a new front door in about 45 minutes; I chose the category, the catalog and what went to staging. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `11.1.3` [Retrieval (RAG)](https://productengineer.pro/skills-map/ai/ai-engineering/retrieval/) · `retrieval` · search term; has evidence, technicalLeverage
- [x] `11.1.5` [Tool calling](https://productengineer.pro/skills-map/ai/ai-engineering/tool-calling/) · `tool-calling` · search term; has evidence, technicalLeverage
- [x] `11.1.11` [Prompt and context engineering](https://productengineer.pro/skills-map/ai/ai-engineering/prompt-context-engineering/) · `prompt-context-engineering` · search term; has evidence, technicalLeverage
- [x] `11.2.2` [Reviewing generated work](https://productengineer.pro/skills-map/ai/ai-assisted-work/reviewing-generated-work/) · `reviewing-generated-work` · 2 In practice notes
  - Mamitsu: We have both mostly stopped reading our projects' code, but it still matters where trust does. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - RelievApp: Agents also reviewed: an audit at 5 out of 10, a second pass at 7, and an outside view from ChatGPT. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))

### Batch 17 · Cross-cutting · 5 skills

- [x] `X.3.4` [Opportunity cost](https://productengineer.pro/skills-map/cross-cutting/decision-making/opportunity-cost/) · `opportunity-cost` · 3 In practice notes
  - Mamitsu: When code is cheap, what you choose not to build is the decision that matters. ([entry](https://productengineer.pro/in-practice/mamitsu/))
  - Zernio: Given a million euros, he would put it in paid, because product cannot absorb it and SEO would not know what to do with it. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: Asked about $30M cash from Dropbox, he said probably not yet, with DocSend's own price in mind. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `X.3.2` [Deciding under uncertainty](https://productengineer.pro/skills-map/cross-cutting/decision-making/deciding-under-uncertainty/) · `deciding-under-uncertainty` · 2 In practice notes
  - Zernio: He left a growing company to test whether he could build one without investors, and spent a year without cash looking for the idea. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: Savings from good jobs carried the first year, and Marc counts five or six failures before this one. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `X.7.4` [Professional development](https://productengineer.pro/skills-map/cross-cutting/continuous-learning/professional-development/) · `professional-development` · 2 In practice notes
  - Zernio: He credits Ucademy's non-technical founders with most of what he learned. ([entry](https://productengineer.pro/in-practice/zernio/))
  - Papermark: Iuliia learned to code by building on open-source projects and opening her own. ([entry](https://productengineer.pro/in-practice/papermark/))
- [x] `X.3.3` [Reversible and irreversible decisions](https://productengineer.pro/skills-map/cross-cutting/decision-making/reversible-decisions/) · `reversible-decisions` · 1 In practice note
  - RelievApp: A version that costs an hour can be decided with less evidence, as long as it can be undone. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))
- [x] `X.7.3` [Updating mental models](https://productengineer.pro/skills-map/cross-cutting/continuous-learning/updating-beliefs/) · `updating-beliefs` · 1 In practice note
  - RelievApp: The category changed again and again in five weeks, each time for a reason I could write down. ([entry](https://productengineer.pro/in-practice/relievapp-part-1/))

## Wave 2: the rest of the map, by capability

### Batch 18 · Discovery · 10 skills

- [x] `01.1.5` [Goals and motivations](https://productengineer.pro/skills-map/discovery/user-understanding/user-motivations/) · `user-motivations` · map coverage
- [x] `01.1.6` [Behavior and context of use](https://productengineer.pro/skills-map/discovery/user-understanding/context-of-use/) · `context-of-use` · map coverage
- [x] `01.2.2` [Observation and field studies](https://productengineer.pro/skills-map/discovery/user-research/field-studies/) · `field-studies` · map coverage
- [x] `01.2.4` [Diary studies](https://productengineer.pro/skills-map/discovery/user-research/diary-studies/) · `diary-studies` · 1 resource
- [x] `01.2.5` [Research synthesis](https://productengineer.pro/skills-map/discovery/user-research/research-synthesis/) · `research-synthesis` · has evidence, technicalLeverage, aiLeverage
- [x] `01.3.1` [Pain points](https://productengineer.pro/skills-map/discovery/problem-identification/pain-points/) · `pain-points` · 1 resource
- [x] `01.3.3` [Root-cause analysis](https://productengineer.pro/skills-map/discovery/problem-identification/root-cause-analysis/) · `root-cause-analysis` · 1 resource
- [x] `01.3.4` [Problem statements](https://productengineer.pro/skills-map/discovery/problem-identification/problem-statements/) · `problem-statements` · 1 resource
- [x] `01.3.5` [Problem severity and frequency](https://productengineer.pro/skills-map/discovery/problem-identification/problem-severity/) · `problem-severity` · map coverage
- [x] `01.4.5` [Category conventions](https://productengineer.pro/skills-map/discovery/market-research/category-conventions/) · `category-conventions` · 1 resource

### Batch 19 · Discovery · 6 skills

- [x] `01.5.1` [Assumption mapping](https://productengineer.pro/skills-map/discovery/opportunity-validation/assumption-mapping/) · `assumption-mapping` · map coverage
- [x] `01.5.2` [Evidence strength](https://productengineer.pro/skills-map/discovery/opportunity-validation/evidence-strength/) · `evidence-strength` · 1 resource
- [x] `01.5.6` [Concierge and Wizard of Oz tests](https://productengineer.pro/skills-map/discovery/opportunity-validation/concierge-experiments/) · `concierge-experiments` · map coverage
- [x] `01.6.1` [Industry workflows](https://productengineer.pro/skills-map/discovery/domain-understanding/industry-workflows/) · `industry-workflows` · map coverage
- [x] `01.6.2` [Domain language](https://productengineer.pro/skills-map/discovery/domain-understanding/domain-language/) · `domain-language` · map coverage
- [x] `01.6.4` [Stakeholders and buyers](https://productengineer.pro/skills-map/discovery/domain-understanding/domain-stakeholders/) · `domain-stakeholders` · map coverage

### Batch 20 · Strategy · 12 skills

- [x] `02.1.1` [Mission](https://productengineer.pro/skills-map/strategy/product-vision/mission/) · `mission` · 1 resource
- [x] `02.3.1` [Product goals](https://productengineer.pro/skills-map/strategy/goal-setting/product-goals/) · `product-goals` · map coverage
- [x] `02.3.4` [Leading indicators](https://productengineer.pro/skills-map/strategy/goal-setting/leading-indicators/) · `leading-indicators` · 1 resource
- [x] `02.4.1` [Opportunity assessment](https://productengineer.pro/skills-map/strategy/prioritization/opportunity-assessment/) · `opportunity-assessment` · has evidence, technicalLeverage, aiLeverage; 1 resource
- [x] `02.4.5` [Sequencing](https://productengineer.pro/skills-map/strategy/prioritization/sequencing/) · `sequencing` · 1 resource
- [x] `02.5.2` [Smallest valuable increment](https://productengineer.pro/skills-map/strategy/product-scoping/smallest-valuable-increment/) · `smallest-valuable-increment` · map coverage
- [x] `02.5.3` [Vertical slicing](https://productengineer.pro/skills-map/strategy/product-scoping/vertical-slicing/) · `vertical-slicing` · map coverage
- [x] `02.5.5` [Acceptance criteria](https://productengineer.pro/skills-map/strategy/product-scoping/acceptance-criteria/) · `acceptance-criteria` · 1 resource
- [x] `02.6.2` [Dependencies](https://productengineer.pro/skills-map/strategy/product-planning/dependency-management/) · `dependency-management` · map coverage
- [x] `02.6.3` [Product lifecycle stages](https://productengineer.pro/skills-map/strategy/product-planning/lifecycle-stages/) · `lifecycle-stages` · map coverage
- [x] `02.6.4` [Adapting strategy](https://productengineer.pro/skills-map/strategy/product-planning/strategy-adaptation/) · `strategy-adaptation` · 1 resource
- [x] `02.7.6` [Return on investment](https://productengineer.pro/skills-map/strategy/business-models/return-on-investment/) · `return-on-investment` · map coverage

### Batch 21 · Experience · 12 skills

- [x] `03.1.3` [Task analysis](https://productengineer.pro/skills-map/experience/user-journeys/task-analysis/) · `task-analysis` · 1 resource
- [x] `03.1.4` [Mental models](https://productengineer.pro/skills-map/experience/user-journeys/mental-models/) · `mental-models` · map coverage
- [x] `03.2.1` [Navigation](https://productengineer.pro/skills-map/experience/interaction-design/navigation-design/) · `navigation-design` · 1 resource
- [x] `03.2.2` [Forms](https://productengineer.pro/skills-map/experience/interaction-design/form-design/) · `form-design` · map coverage
- [x] `03.2.4` [Errors and recovery](https://productengineer.pro/skills-map/experience/interaction-design/error-recovery/) · `error-recovery` · has evidence, technicalLeverage
- [x] `03.2.5` [Empty states](https://productengineer.pro/skills-map/experience/interaction-design/empty-states/) · `empty-states` · 1 resource
- [x] `03.2.6` [Affordances](https://productengineer.pro/skills-map/experience/interaction-design/affordances/) · `affordances` · 1 resource
- [x] `03.2.7` [Progressive disclosure](https://productengineer.pro/skills-map/experience/interaction-design/progressive-disclosure/) · `progressive-disclosure` · 1 resource
- [x] `03.3.1` [Visual hierarchy](https://productengineer.pro/skills-map/experience/ui-design/visual-hierarchy/) · `visual-hierarchy` · 1 resource
- [x] `03.3.2` [Typography](https://productengineer.pro/skills-map/experience/ui-design/typography/) · `typography` · 1 resource
- [x] `03.3.3` [Spacing and layout](https://productengineer.pro/skills-map/experience/ui-design/spacing-and-layout/) · `spacing-and-layout` · 1 resource
- [x] `03.3.5` [Responsive design](https://productengineer.pro/skills-map/experience/ui-design/responsive-design/) · `responsive-design` · map coverage

### Batch 22 · Experience · 11 skills

- [x] `03.4.1` [Sketching](https://productengineer.pro/skills-map/experience/prototyping/sketching/) · `sketching` · 1 resource
- [x] `03.4.3` [Clickable prototypes](https://productengineer.pro/skills-map/experience/prototyping/clickable-prototypes/) · `clickable-prototypes` · 1 resource
- [x] `03.5.1` [Inclusive design](https://productengineer.pro/skills-map/experience/accessibility/inclusive-design/) · `inclusive-design` · 1 resource
- [x] `03.5.2` [Keyboard interaction](https://productengineer.pro/skills-map/experience/accessibility/keyboard-interaction/) · `keyboard-interaction` · 1 resource
- [x] `03.5.3` [Semantic markup](https://productengineer.pro/skills-map/experience/accessibility/semantic-markup/) · `semantic-markup` · map coverage
- [x] `03.5.4` [Assistive technology support](https://productengineer.pro/skills-map/experience/accessibility/assistive-technology/) · `assistive-technology` · 1 resource
- [x] `03.6.1` [Microcopy](https://productengineer.pro/skills-map/experience/content-design/microcopy/) · `microcopy` · map coverage
- [x] `03.6.2` [Instructions](https://productengineer.pro/skills-map/experience/content-design/instructional-copy/) · `instructional-copy` · 1 resource
- [x] `03.6.3` [Terminology](https://productengineer.pro/skills-map/experience/content-design/product-terminology/) · `product-terminology` · map coverage
- [x] `03.6.5` [Documentation UX](https://productengineer.pro/skills-map/experience/content-design/documentation-ux/) · `documentation-ux` · map coverage
- [x] `03.6.6` [Localization](https://productengineer.pro/skills-map/experience/content-design/localization/) · `localization` · 1 resource

### Batch 23 · Experience · 6 skills

- [x] `03.7.1` [Motivation](https://productengineer.pro/skills-map/experience/behavioral-design/motivation/) · `motivation` · 1 resource
- [x] `03.7.2` [Cognitive load](https://productengineer.pro/skills-map/experience/behavioral-design/cognitive-load/) · `cognitive-load` · map coverage
- [x] `03.7.3` [Decision friction](https://productengineer.pro/skills-map/experience/behavioral-design/decision-friction/) · `decision-friction` · 1 resource
- [x] `03.7.4` [Habit formation](https://productengineer.pro/skills-map/experience/behavioral-design/habit-formation/) · `habit-formation` · map coverage
- [x] `03.7.5` [Persuasive design](https://productengineer.pro/skills-map/experience/behavioral-design/persuasive-design/) · `persuasive-design` · map coverage
- [x] `03.7.6` [Ethical engagement](https://productengineer.pro/skills-map/experience/behavioral-design/ethical-engagement/) · `ethical-engagement` · map coverage

### Batch 24 · Engineering · 8 skills

- [x] `04.1.1` [Frontend development](https://productengineer.pro/skills-map/engineering/software-development/frontend-development/) · `frontend-development` · has evidence, technicalLeverage, aiLeverage; 1 resource
- [x] `04.1.2` [Backend development](https://productengineer.pro/skills-map/engineering/software-development/backend-development/) · `backend-development` · map coverage
- [x] `04.1.4` [State management](https://productengineer.pro/skills-map/engineering/software-development/state-management/) · `state-management` · 1 resource
- [x] `04.2.1` [Modularity](https://productengineer.pro/skills-map/engineering/software-architecture/modularity/) · `modularity` · map coverage
- [x] `04.2.2` [Separation of concerns](https://productengineer.pro/skills-map/engineering/software-architecture/separation-of-concerns/) · `separation-of-concerns` · 1 resource
- [x] `04.2.3` [System boundaries](https://productengineer.pro/skills-map/engineering/software-architecture/system-boundaries/) · `system-boundaries` · map coverage
- [x] `04.2.4` [Coupling and cohesion](https://productengineer.pro/skills-map/engineering/software-architecture/coupling/) · `coupling` · 1 resource
- [x] `04.2.6` [Technical tradeoffs](https://productengineer.pro/skills-map/engineering/software-architecture/technical-tradeoffs/) · `technical-tradeoffs` · 1 resource

### Batch 25 · Engineering · 10 skills

- [x] `04.3.1` [Data modeling](https://productengineer.pro/skills-map/engineering/data-engineering/data-modeling/) · `data-modeling` · has evidence, technicalLeverage; 1 resource
- [x] `04.3.2` [SQL](https://productengineer.pro/skills-map/engineering/data-engineering/sql/) · `sql` · 1 resource
- [x] `04.3.3` [Databases and persistence](https://productengineer.pro/skills-map/engineering/data-engineering/databases/) · `databases` · map coverage
- [x] `04.3.4` [Consistency](https://productengineer.pro/skills-map/engineering/data-engineering/data-consistency/) · `data-consistency` · 1 resource
- [x] `04.3.5` [Schema migrations](https://productengineer.pro/skills-map/engineering/data-engineering/schema-migrations/) · `schema-migrations` · map coverage
- [x] `04.3.6` [Data integrity](https://productengineer.pro/skills-map/engineering/data-engineering/data-integrity/) · `data-integrity` · 1 resource
- [x] `04.4.1` [Automated testing](https://productengineer.pro/skills-map/engineering/engineering-quality/automated-testing/) · `automated-testing` · has evidence, technicalLeverage, aiLeverage
- [x] `04.4.2` [Integration tests](https://productengineer.pro/skills-map/engineering/engineering-quality/integration-tests/) · `integration-tests` · map coverage
- [x] `04.4.3` [End-to-end tests](https://productengineer.pro/skills-map/engineering/engineering-quality/end-to-end-tests/) · `end-to-end-tests` · 1 resource
- [x] `04.4.5` [Debugging](https://productengineer.pro/skills-map/engineering/engineering-quality/debugging/) · `debugging` · has evidence, technicalLeverage, aiLeverage; 1 resource

### Batch 26 · Engineering · 9 skills

- [x] `04.5.1` [Latency](https://productengineer.pro/skills-map/engineering/performance-engineering/latency/) · `latency` · map coverage
- [x] `04.5.3` [Profiling](https://productengineer.pro/skills-map/engineering/performance-engineering/profiling/) · `profiling` · 1 resource
- [x] `04.5.5` [Performance budgets](https://productengineer.pro/skills-map/engineering/performance-engineering/performance-budgets/) · `performance-budgets` · 1 resource
- [x] `04.5.6` [Frontend performance](https://productengineer.pro/skills-map/engineering/performance-engineering/frontend-performance/) · `frontend-performance` · map coverage
- [x] `04.5.7` [Backend performance](https://productengineer.pro/skills-map/engineering/performance-engineering/backend-performance/) · `backend-performance` · map coverage
- [x] `04.6.1` [Authentication](https://productengineer.pro/skills-map/engineering/security-engineering/authentication/) · `authentication` · 1 resource
- [x] `04.6.2` [Authorization](https://productengineer.pro/skills-map/engineering/security-engineering/authorization/) · `authorization` · 1 resource
- [x] `04.6.4` [Secure coding](https://productengineer.pro/skills-map/engineering/security-engineering/secure-coding/) · `secure-coding` · 1 resource
- [x] `04.6.6` [Secrets management](https://productengineer.pro/skills-map/engineering/security-engineering/secrets-management/) · `secrets-management` · 1 resource

### Batch 27 · Engineering · 6 skills

- [x] `04.7.1` [Internal tooling](https://productengineer.pro/skills-map/engineering/developer-experience/internal-tooling/) · `internal-tooling` · 1 resource
- [x] `04.7.2` [Developer workflows](https://productengineer.pro/skills-map/engineering/developer-experience/developer-workflows/) · `developer-workflows` · map coverage
- [x] `04.7.3` [Developer documentation](https://productengineer.pro/skills-map/engineering/developer-experience/developer-docs/) · `developer-docs` · map coverage
- [x] `04.7.4` [Build systems](https://productengineer.pro/skills-map/engineering/developer-experience/build-systems/) · `build-systems` · 1 resource
- [x] `04.7.5` [Engineering automation](https://productengineer.pro/skills-map/engineering/developer-experience/engineering-automation/) · `engineering-automation` · 0 resource
- [x] `04.7.6` [CI quality checks](https://productengineer.pro/skills-map/engineering/developer-experience/ci-checks/) · `ci-checks` · 1 resource

### Batch 28 · Shipping · 11 skills

- [x] `05.1.2` [Incremental architecture](https://productengineer.pro/skills-map/shipping/iterative-delivery/incremental-architecture/) · `incremental-architecture` · map coverage
- [x] `05.1.4` [Limiting work in progress](https://productengineer.pro/skills-map/shipping/iterative-delivery/wip-limits/) · `wip-limits` · 1 resource
- [x] `05.2.2` [Automated deployments](https://productengineer.pro/skills-map/shipping/release-engineering/deployment-automation/) · `deployment-automation` · 1 resource
- [x] `05.2.3` [Environments](https://productengineer.pro/skills-map/shipping/release-engineering/environment-management/) · `environment-management` · 1 resource
- [x] `05.3.2` [Staged rollouts](https://productengineer.pro/skills-map/shipping/controlled-releases/staged-rollouts/) · `staged-rollouts` · map coverage
- [x] `05.3.3` [Beta programs](https://productengineer.pro/skills-map/shipping/controlled-releases/beta-programs/) · `beta-programs` · map coverage
- [x] `05.4.1` [Pre-release QA](https://productengineer.pro/skills-map/shipping/release-readiness/release-qa/) · `release-qa` · has evidence, technicalLeverage, aiLeverage; 1 resource
- [x] `05.4.4` [Support readiness](https://productengineer.pro/skills-map/shipping/release-readiness/support-readiness/) · `support-readiness` · map coverage
- [x] `05.4.5` [Operational readiness](https://productengineer.pro/skills-map/shipping/release-readiness/operational-readiness/) · `operational-readiness` · map coverage
- [x] `05.5.1` [Estimation](https://productengineer.pro/skills-map/shipping/delivery-management/estimation/) · `estimation` · map coverage
- [x] `05.5.3` [Removing blockers](https://productengineer.pro/skills-map/shipping/delivery-management/unblocking/) · `unblocking` · 1 resource

### Batch 29 · Measurement · 10 skills

- [x] `06.1.2` [Tracking plans](https://productengineer.pro/skills-map/measurement/product-instrumentation/tracking-plans/) · `tracking-plans` · has evidence, technicalLeverage, aiLeverage
- [x] `06.1.3` [Identity resolution](https://productengineer.pro/skills-map/measurement/product-instrumentation/identity-resolution/) · `identity-resolution` · map coverage
- [x] `06.1.4` [Data quality](https://productengineer.pro/skills-map/measurement/product-instrumentation/analytics-data-quality/) · `analytics-data-quality` · map coverage
- [x] `06.1.5` [Analytics architecture](https://productengineer.pro/skills-map/measurement/product-instrumentation/analytics-architecture/) · `analytics-architecture` · 0 resource
- [x] `06.2.1` [Adoption](https://productengineer.pro/skills-map/measurement/product-metrics/adoption-metrics/) · `adoption-metrics` · 1 resource
- [x] `06.2.3` [Task success](https://productengineer.pro/skills-map/measurement/product-metrics/task-success/) · `task-success` · map coverage
- [x] `06.2.4` [Conversion](https://productengineer.pro/skills-map/measurement/product-metrics/conversion-metrics/) · `conversion-metrics` · 1 resource
- [x] `06.2.6` [Satisfaction](https://productengineer.pro/skills-map/measurement/product-metrics/satisfaction-metrics/) · `satisfaction-metrics` · map coverage
- [x] `06.3.4` [Path analysis](https://productengineer.pro/skills-map/measurement/behavioral-analysis/path-analysis/) · `path-analysis` · 0 resource
- [x] `06.3.5` [Feature usage](https://productengineer.pro/skills-map/measurement/behavioral-analysis/feature-usage/) · `feature-usage` · map coverage

### Batch 30 · Measurement · 12 skills

- [x] `06.4.1` [Hypotheses](https://productengineer.pro/skills-map/measurement/experiment-design/hypotheses/) · `hypotheses` · 1 resource
- [x] `06.4.2` [Control groups](https://productengineer.pro/skills-map/measurement/experiment-design/control-groups/) · `control-groups` · 1 resource
- [x] `06.4.3` [Randomization](https://productengineer.pro/skills-map/measurement/experiment-design/randomization/) · `randomization` · map coverage
- [x] `06.4.6` [Experiment guardrails](https://productengineer.pro/skills-map/measurement/experiment-design/experiment-guardrails/) · `experiment-guardrails` · map coverage
- [x] `06.5.1` [Uncertainty and variance](https://productengineer.pro/skills-map/measurement/statistical-reasoning/statistical-uncertainty/) · `statistical-uncertainty` · 1 resource
- [x] `06.5.3` [Effect sizes](https://productengineer.pro/skills-map/measurement/statistical-reasoning/effect-sizes/) · `effect-sizes` · 1 resource
- [x] `06.5.5` [Sampling and selection bias](https://productengineer.pro/skills-map/measurement/statistical-reasoning/sampling-bias/) · `sampling-bias` · 1 resource
- [x] `06.5.6` [Confounding](https://productengineer.pro/skills-map/measurement/statistical-reasoning/confounding/) · `confounding` · map coverage
- [x] `06.5.7` [Simpson's paradox](https://productengineer.pro/skills-map/measurement/statistical-reasoning/simpsons-paradox-check/) · `simpsons-paradox-check` · 1 resource
- [x] `06.6.2` [Session replays](https://productengineer.pro/skills-map/measurement/qualitative-evaluation/session-replays/) · `session-replays` · 1 resource
- [x] `06.7.1` [Interpreting results](https://productengineer.pro/skills-map/measurement/evidence-based-decisions/interpreting-results/) · `interpreting-results` · map coverage
- [x] `06.7.2` [Causal reasoning](https://productengineer.pro/skills-map/measurement/evidence-based-decisions/causal-reasoning/) · `causal-reasoning` · map coverage

### Batch 31 · Activation · 12 skills

- [x] `07.1.1` [Landing experience](https://productengineer.pro/skills-map/activation/first-user-experience/landing-experience/) · `landing-experience` · 1 resource
- [x] `07.1.2` [Signup and account creation](https://productengineer.pro/skills-map/activation/first-user-experience/signup-flow/) · `signup-flow` · map coverage
- [x] `07.1.3` [First-run flows](https://productengineer.pro/skills-map/activation/first-user-experience/first-run-flows/) · `first-run-flows` · has evidence, technicalLeverage, aiLeverage
- [x] `07.1.4` [Expectation setting](https://productengineer.pro/skills-map/activation/first-user-experience/expectation-setting/) · `expectation-setting` · has evidence, technicalLeverage; 1 resource
- [x] `07.2.1` [Guided setup](https://productengineer.pro/skills-map/activation/onboarding-design/guided-setup/) · `guided-setup` · 1 resource
- [x] `07.2.2` [Progressive onboarding](https://productengineer.pro/skills-map/activation/onboarding-design/progressive-onboarding/) · `progressive-onboarding` · map coverage
- [x] `07.2.3` [Contextual guidance](https://productengineer.pro/skills-map/activation/onboarding-design/contextual-guidance/) · `contextual-guidance` · map coverage
- [x] `07.2.4` [Tutorials and walkthroughs](https://productengineer.pro/skills-map/activation/onboarding-design/tutorials/) · `tutorials` · map coverage
- [x] `07.3.3` [First successful task](https://productengineer.pro/skills-map/activation/time-to-value/first-successful-task/) · `first-successful-task` · 1 resource
- [x] `07.4.1` [Form friction](https://productengineer.pro/skills-map/activation/conversion-optimization/form-friction/) · `form-friction` · map coverage
- [x] `07.4.3` [Funnel optimization](https://productengineer.pro/skills-map/activation/conversion-optimization/funnel-optimization/) · `funnel-optimization` · map coverage
- [x] `07.4.4` [Signup and trial conversion](https://productengineer.pro/skills-map/activation/conversion-optimization/trial-conversion/) · `trial-conversion` · 1 resource

### Batch 32 · Activation + Retention · 6 skills

- [x] `07.5.1` [Drop-off analysis](https://productengineer.pro/skills-map/activation/activation-diagnosis/drop-off-analysis/) · `drop-off-analysis` · has evidence, technicalLeverage, aiLeverage; 1 resource
- [x] `07.5.2` [Technical friction](https://productengineer.pro/skills-map/activation/activation-diagnosis/technical-friction/) · `technical-friction` · 1 resource
- [x] `07.5.3` [Activation experiments](https://productengineer.pro/skills-map/activation/activation-diagnosis/activation-experiments/) · `activation-experiments` · 1 resource
- [x] `08.1.1` [Core usage loops](https://productengineer.pro/skills-map/retention/recurring-value/core-loops/) · `core-loops` · 1 resource
- [x] `08.1.3` [Product usefulness](https://productengineer.pro/skills-map/retention/recurring-value/product-usefulness/) · `product-usefulness` · map coverage
- [x] `08.1.4` [Value reinforcement](https://productengineer.pro/skills-map/retention/recurring-value/value-reinforcement/) · `value-reinforcement` · 1 resource

### Batch 33 · Retention · 11 skills

- [x] `08.2.3` [Engagement frequency](https://productengineer.pro/skills-map/retention/retention-analysis/engagement-frequency/) · `engagement-frequency` · 1 resource
- [x] `08.2.4` [Meaningful usage](https://productengineer.pro/skills-map/retention/retention-analysis/meaningful-usage/) · `meaningful-usage` · 1 resource
- [x] `08.3.1` [Reminders and notifications](https://productengineer.pro/skills-map/retention/engagement-design/reminders/) · `reminders` · map coverage
- [x] `08.3.2` [Personalization](https://productengineer.pro/skills-map/retention/engagement-design/personalization/) · `personalization` · has evidence, technicalLeverage, aiLeverage; 1 resource
- [x] `08.3.3` [User progression](https://productengineer.pro/skills-map/retention/engagement-design/user-progression/) · `user-progression` · 1 resource
- [x] `08.4.2` [Lifecycle communication](https://productengineer.pro/skills-map/retention/customer-lifecycle/lifecycle-messaging/) · `lifecycle-messaging` · map coverage
- [x] `08.4.3` [Customer education](https://productengineer.pro/skills-map/retention/customer-lifecycle/customer-education/) · `customer-education` · 1 resource
- [x] `08.5.1` [Feedback collection](https://productengineer.pro/skills-map/retention/customer-success/feedback-collection/) · `feedback-collection` · 1 resource
- [x] `08.5.2` [Friction reduction](https://productengineer.pro/skills-map/retention/customer-success/friction-reduction/) · `friction-reduction` · map coverage
- [x] `08.5.3` [Support insights](https://productengineer.pro/skills-map/retention/customer-success/support-insights/) · `support-insights` · 1 resource
- [x] `08.5.4` [Resolving adoption barriers](https://productengineer.pro/skills-map/retention/customer-success/adoption-barriers/) · `adoption-barriers` · 1 resource

### Batch 34 · Distribution · 10 skills

- [x] `09.1.3` [Messaging](https://productengineer.pro/skills-map/distribution/go-to-market/messaging/) · `messaging` · has evidence, technicalLeverage, aiLeverage
- [x] `09.3.3` [Invitations](https://productengineer.pro/skills-map/distribution/viral-growth/invitations/) · `invitations` · map coverage
- [x] `09.3.5` [Viral coefficient](https://productengineer.pro/skills-map/distribution/viral-growth/viral-coefficient/) · `viral-coefficient` · map coverage
- [x] `09.4.2` [Collaboration features](https://productengineer.pro/skills-map/distribution/product-led-growth/collaboration-features/) · `collaboration-features` · 1 resource
- [x] `09.4.3` [Product-driven expansion](https://productengineer.pro/skills-map/distribution/product-led-growth/product-driven-expansion/) · `product-driven-expansion` · map coverage
- [x] `09.5.1` [Sales funnels](https://productengineer.pro/skills-map/distribution/b2b-acquisition/sales-funnels/) · `sales-funnels` · 1 resource
- [x] `09.5.2` [Lead qualification](https://productengineer.pro/skills-map/distribution/b2b-acquisition/lead-qualification/) · `lead-qualification` · map coverage
- [x] `09.5.4` [Trials and proofs of concept](https://productengineer.pro/skills-map/distribution/b2b-acquisition/b2b-trials/) · `b2b-trials` · map coverage
- [x] `09.5.5` [Partnerships](https://productengineer.pro/skills-map/distribution/b2b-acquisition/partnerships/) · `partnerships` · 0 resource
- [x] `09.6.2` [Conversion efficiency](https://productengineer.pro/skills-map/distribution/growth-economics/conversion-efficiency/) · `conversion-efficiency` · 1 resource

### Batch 35 · Operations · 11 skills

- [x] `10.1.1` [Logs](https://productengineer.pro/skills-map/operations/product-observability/logging/) · `logging` · 1 resource
- [x] `10.1.2` [Traces](https://productengineer.pro/skills-map/operations/product-observability/tracing/) · `tracing` · map coverage
- [x] `10.1.3` [Service metrics](https://productengineer.pro/skills-map/operations/product-observability/service-metrics/) · `service-metrics` · 1 resource
- [x] `10.1.4` [Dashboards](https://productengineer.pro/skills-map/operations/product-observability/dashboards/) · `dashboards` · 1 resource
- [x] `10.1.6` [Performance monitoring](https://productengineer.pro/skills-map/operations/product-observability/performance-monitoring/) · `performance-monitoring` · 1 resource
- [x] `10.2.1` [Availability](https://productengineer.pro/skills-map/operations/reliability-engineering/availability/) · `availability` · 1 resource
- [x] `10.2.4` [Resilience](https://productengineer.pro/skills-map/operations/reliability-engineering/resilience/) · `resilience` · 1 resource
- [x] `10.2.5` [Backups and disaster recovery](https://productengineer.pro/skills-map/operations/reliability-engineering/disaster-recovery/) · `disaster-recovery` · map coverage
- [x] `10.3.3` [Dependency updates](https://productengineer.pro/skills-map/operations/maintenance/dependency-updates/) · `dependency-updates` · 0 resource
- [x] `10.4.3` [Customer communication](https://productengineer.pro/skills-map/operations/user-support/customer-communication/) · `customer-communication` · 1 resource
- [x] `10.4.4` [Feedback triage](https://productengineer.pro/skills-map/operations/user-support/feedback-triage/) · `feedback-triage` · 1 resource

### Batch 36 · Operations · 9 skills

- [x] `10.5.1` [Privacy obligations](https://productengineer.pro/skills-map/operations/governance-compliance/privacy-obligations/) · `privacy-obligations` · map coverage
- [x] `10.5.2` [Consent management](https://productengineer.pro/skills-map/operations/governance-compliance/consent/) · `consent` · 1 resource
- [x] `10.5.4` [Security policies](https://productengineer.pro/skills-map/operations/governance-compliance/security-policies/) · `security-policies` · 1 resource
- [x] `10.6.2` [Cloud efficiency](https://productengineer.pro/skills-map/operations/operational-economics/cloud-efficiency/) · `cloud-efficiency` · 1 resource
- [x] `10.6.3` [AI inference costs](https://productengineer.pro/skills-map/operations/operational-economics/inference-costs/) · `inference-costs` · has evidence, technicalLeverage
- [x] `10.7.1` [Feature adoption](https://productengineer.pro/skills-map/operations/lifecycle-management/feature-adoption/) · `feature-adoption` · 1 resource
- [x] `10.7.2` [Managing product changes](https://productengineer.pro/skills-map/operations/lifecycle-management/product-changes/) · `product-changes` · 1 resource
- [x] `10.7.3` [Deprecation and removal](https://productengineer.pro/skills-map/operations/lifecycle-management/feature-deprecation/) · `feature-deprecation` · map coverage
- [x] `10.7.4` [Migrating users](https://productengineer.pro/skills-map/operations/lifecycle-management/user-migrations/) · `user-migrations` · 1 resource

### Batch 37 · AI + Cross-cutting · 8 skills

- [x] `11.1.1` [LLM integration](https://productengineer.pro/skills-map/ai/ai-engineering/llm-integration/) · `llm-integration` · has evidence, technicalLeverage
- [x] `11.1.8` [AI observability](https://productengineer.pro/skills-map/ai/ai-engineering/llm-observability/) · `llm-observability` · has evidence, technicalLeverage
- [x] `11.1.9` [Guardrails](https://productengineer.pro/skills-map/ai/ai-engineering/ai-guardrails/) · `ai-guardrails` · has evidence, technicalLeverage
- [x] `11.1.10` [AI and language model fundamentals](https://productengineer.pro/skills-map/ai/ai-engineering/llm-fundamentals/) · `llm-fundamentals` · has evidence, technicalLeverage; 1 resource
- [x] `X.1.1` [Evidence versus assumptions](https://productengineer.pro/skills-map/cross-cutting/critical-thinking/evidence-vs-assumptions/) · `evidence-vs-assumptions` · has evidence, technicalLeverage, aiLeverage
- [x] `X.1.2` [Cognitive biases](https://productengineer.pro/skills-map/cross-cutting/critical-thinking/cognitive-biases/) · `cognitive-biases` · map coverage
- [x] `X.1.3` [Challenging requirements](https://productengineer.pro/skills-map/cross-cutting/critical-thinking/challenging-requirements/) · `challenging-requirements` · map coverage
- [x] `X.1.4` [Verification](https://productengineer.pro/skills-map/cross-cutting/critical-thinking/verification/) · `verification` · has evidence, technicalLeverage

### Batch 38 · Cross-cutting · 9 skills

- [ ] `X.2.1` [Interdependencies](https://productengineer.pro/skills-map/cross-cutting/systems-thinking/system-dependencies/) · `system-dependencies` · map coverage
- [ ] `X.2.2` [Feedback loops](https://productengineer.pro/skills-map/cross-cutting/systems-thinking/feedback-loops/) · `feedback-loops` · map coverage
- [ ] `X.2.3` [Second-order and unintended effects](https://productengineer.pro/skills-map/cross-cutting/systems-thinking/second-order-effects/) · `second-order-effects` · 1 resource
- [ ] `X.2.4` [Workflow automation](https://productengineer.pro/skills-map/cross-cutting/systems-thinking/workflow-automation/) · `workflow-automation` · map coverage
- [ ] `X.3.1` [Weighing tradeoffs](https://productengineer.pro/skills-map/cross-cutting/decision-making/tradeoffs/) · `tradeoffs` · map coverage
- [ ] `X.4.1` [Technical writing and documentation](https://productengineer.pro/skills-map/cross-cutting/communication/technical-writing/) · `technical-writing` · map coverage
- [ ] `X.4.2` [Product narratives](https://productengineer.pro/skills-map/cross-cutting/communication/product-narratives/) · `product-narratives` · 1 resource
- [ ] `X.4.3` [Clear explanations](https://productengineer.pro/skills-map/cross-cutting/communication/clear-explanations/) · `clear-explanations` · map coverage
- [ ] `X.4.4` [Persuasive arguments](https://productengineer.pro/skills-map/cross-cutting/communication/persuasive-arguments/) · `persuasive-arguments` · map coverage

### Batch 39 · Cross-cutting · 11 skills

- [ ] `X.5.1` [Working with product managers](https://productengineer.pro/skills-map/cross-cutting/collaboration/working-with-pms/) · `working-with-pms` · map coverage
- [ ] `X.5.2` [Working with designers](https://productengineer.pro/skills-map/cross-cutting/collaboration/working-with-designers/) · `working-with-designers` · map coverage
- [ ] `X.5.3` [Working with researchers](https://productengineer.pro/skills-map/cross-cutting/collaboration/working-with-researchers/) · `working-with-researchers` · map coverage
- [ ] `X.5.4` [Working with marketing and sales](https://productengineer.pro/skills-map/cross-cutting/collaboration/working-with-go-to-market/) · `working-with-go-to-market` · map coverage
- [ ] `X.5.5` [Working with support](https://productengineer.pro/skills-map/cross-cutting/collaboration/working-with-support/) · `working-with-support` · map coverage
- [ ] `X.5.6` [Working with other engineers](https://productengineer.pro/skills-map/cross-cutting/collaboration/working-with-engineers/) · `working-with-engineers` · map coverage
- [ ] `X.6.1` [Initiative](https://productengineer.pro/skills-map/cross-cutting/leadership-ownership/initiative/) · `initiative` · map coverage
- [ ] `X.6.2` [Accountability](https://productengineer.pro/skills-map/cross-cutting/leadership-ownership/accountability/) · `accountability` · map coverage
- [ ] `X.6.3` [Autonomy](https://productengineer.pro/skills-map/cross-cutting/leadership-ownership/autonomy/) · `autonomy` · 1 resource
- [ ] `X.6.4` [Conflict resolution](https://productengineer.pro/skills-map/cross-cutting/leadership-ownership/conflict-resolution/) · `conflict-resolution` · map coverage
- [ ] `X.6.5` [Stakeholder management](https://productengineer.pro/skills-map/cross-cutting/leadership-ownership/stakeholder-management/) · `stakeholder-management` · map coverage

### Batch 40 · Cross-cutting · 6 skills

- [ ] `X.7.1` [Reflection](https://productengineer.pro/skills-map/cross-cutting/continuous-learning/reflection/) · `reflection` · map coverage
- [ ] `X.7.2` [Seeking feedback](https://productengineer.pro/skills-map/cross-cutting/continuous-learning/seeking-feedback/) · `seeking-feedback` · 1 resource
- [ ] `X.8.1` [User autonomy](https://productengineer.pro/skills-map/cross-cutting/responsible-product/user-autonomy/) · `user-autonomy` · map coverage
- [ ] `X.8.2` [Fairness](https://productengineer.pro/skills-map/cross-cutting/responsible-product/fairness/) · `fairness` · map coverage
- [ ] `X.8.3` [Privacy by design](https://productengineer.pro/skills-map/cross-cutting/responsible-product/privacy-by-design/) · `privacy-by-design` · map coverage
- [ ] `X.8.4` [Safety](https://productengineer.pro/skills-map/cross-cutting/responsible-product/user-safety/) · `user-safety` · map coverage
