# ProductEngineer.pro — website plan

Status: revised 2026-11-10. Built: phase 0 (both style prototypes at `/prototype/`, style choice pending), phase 1, phase 3, phase 4 except going live. Phase 2: Measurement piloted, the other territories still to research. See `README.md`.

## 1. What this is

A static, general reference for product engineering, organised as the Skill Atlas: an interactive map of the whole discipline. Every territory, capability and skill has a brief description, curated learning resources, and the tools used for it.

The map is what sets this apart from a generated course or taxonomy. It is also the base for a later layer that shows which parts are active when you run an experiment on a product you own. That layer is not in this version, but the map is designed for it from the start (section 8).

## 2. Decisions taken

- The site is static and general. No accounts, no lessons, no experiments in this version.
- The atlas has three levels, and every node at every level gets its own page.
- Two map styles are prototyped on real data before one is chosen.
- Visitors keep casual progress as one status per skill, stored in their browser.
- The stack is Astro.

## 3. Taxonomy

Taken from taxonomy v1.0 in the brief.

| Level | Count | Example |
| --- | --- | --- |
| Territory | 10, plus the cross-cutting group | Measurement |
| Capability | 72 (63 in territories, 9 cross-cutting) | Experiment design |
| Skill | roughly 400 | Sample size |

The territories are Discovery, Strategy, Experience, Engineering, Shipping, Measurement, Activation, Retention, Distribution and Operations.

The first task is turning the taxonomy into data files. That needs some cleanup:

- **One home per skill.** Several skills are listed under more than one capability, for example cohort analysis, usability testing, caching and prioritization. A node has one position on the map, so each skill gets one home and the other capabilities link to it as related.
- **Compound entries.** Entries such as "user motivations, behaviors, contexts and needs" are split or merged into nodes that can each carry a description.
- **Stable ids.** Every node gets a slug that is never reused. A renamed node keeps its old id as an alias, so saved progress and later experiment links stay valid.
- **Cross-cutting capabilities.** These belong to no territory. Where they sit on the map is settled in the prototype. The proposal is the waters around the land, since they touch every territory.

## 4. What each page contains

| Page | Content |
| --- | --- |
| Territory | Its central question, a one-paragraph description, what a product engineer should be able to do here, its capabilities, the map zoomed to it |
| Capability | A short description, its skills with one-line summaries, overview resources, tools, the map zoomed to it |
| Skill | Two or three sentences on what it is and why a product engineer needs it, then resources, tools, related skills, the status control, and a small map showing where it sits |

Descriptions are drafted from the taxonomy and reviewed by you in territory batches. Each level has a fixed template and length so about 480 pages read consistently.

## 5. Research pass: resources and tools

This happens during implementation, with web search, one territory at a time. A pilot territory goes first to tune the criteria and the page template.

**Targets per capability and per skill**

- 3 to 5 resources: a short read, a deeper read, and a video when a good one exists.
- 2 to 5 tools, where the topic has tools. Some topics have none.
- No padding. Two good links beat a full quota.

**Selection criteria**

- Written or recorded by practitioners or recognised sources, and the primary source over a summary of it.
- Free to read or watch. A paid book or course is listed only when it is the standard reference, and is marked as paid.
- Still accurate. The year is recorded.
- In English.
- For tools: what is widely used, with an open-source or free option when one exists. No affiliate links.

**Verification**

- No link is written from memory. Each URL is opened and confirmed live and on topic before it is saved.
- YouTube links are checked through YouTube's oEmbed endpoint, which also returns the real title and channel.
- Each entry records the date it was checked. A link checker script is re-run on a schedule and flags dead links.

**Fields stored**

- Resource: URL, title, author or publisher, type (article, video, course, book, docs, talk, podcast), length, year, level (intro or deep), one line on why it is worth the time, date checked.
- Tool: name, URL, one line on what it does, pricing (open source, free, freemium, paid), date checked.

Resources and tools are their own collections, so one item can serve several skills. Each tool therefore gets a page listing the skills it serves.

This is the largest piece of work in the plan: about 480 topics, well over a thousand resource links, and a few hundred distinct tools.

## 6. The map

**Three zoom levels, matching the taxonomy**

- World: the ten territories, with capabilities as landmarks.
- Territory: its capabilities as named places.
- Capability: its skills as named points around the place.

Each level has its own URL. Moving between levels animates the zoom. Skills are drawn only at capability zoom, so the world view stays readable.

**Positions**

- Territory outlines and the 72 capability positions are placed by hand, once, and never move. The layout is the signature.
- Skill positions are computed around their capability and then frozen, so 400 points are not placed by hand.

**States a node can show**

- default
- hovered or selected
- progress: learning, comfortable
- lit, with an optional route joining lit nodes in order

The lit state is not used by any content in this version. It exists for section 8.

**Access**

- Every map has a list equivalent with the same states.
- On phones the list leads and the map sits above it, expanding on tap.
- All nodes are reachable by keyboard.

**Style prototype**

Both styles are built on the real taxonomy with the same layout.

- A. Illustrated fantasy map, as in your mockup. Coloured terrain art as the base, with vector regions, nodes and labels on top.
- B. Blue ink, as in your ballpoint posts. Single-colour pen cartography, fully vector, with a highlighter colour for lit and completed nodes.

Each prototype covers the world view and one dense territory down to skill level. Measurement is the test case, with 7 capabilities and about 45 skills.

They are compared on:

- readability on desktop, on a phone, and as a 200px thumbnail
- how clearly lit nodes and progress states stand out against the art
- sharpness at territory and capability zoom (the illustrated style needs very large art or separate close-up art per territory)
- the cost of a taxonomy change
- page weight
- light and dark themes

The geography is original. Nothing is taken from Middle-earth or any published map.

## 7. Progress and profile

- One status per skill: not started, learning, comfortable. It is set on the skill page or from the map.
- A capability can be set in one action, which applies to all its skills. An experienced engineer can mark most of Engineering in seconds.
- Capabilities and territories show a roll-up of their skills.
- The profile page shows your map coloured by status, totals per territory, the skills you are learning, and an optional display name.
- Everything is stored in the browser, with export and import to a file and a reset. There is no account and nothing is sent to a server. The page says that clearing browser data loses it.

## 8. Built for experiments later

A later version adds the products you own and the experiments you run on them. An experiment lists the skills it exercised, and the map lights them and joins them with a route. Four things in this version make that an addition instead of a rebuild:

- Ids are stable and positions are fixed.
- The renderer already accepts a set of lit nodes and an ordered route.
- A link can carry the lit set, for example `/atlas?lit=sample-size,funnels`. You can share or screenshot a lit map, for a LinkedIn post, before any experiments section exists.
- Progress and lit are separate layers, so both can show at once.

Not in this version: accounts, experiment and product pages, lessons or course content, assessments.

## 9. Site structure

| Path | Purpose |
| --- | --- |
| `/` | What a product engineer is, the atlas, how to use the site |
| `/atlas` | Full-screen interactive map; accepts `?lit=` |
| `/atlas/[territory]` | Territory page |
| `/atlas/[territory]/[capability]` | Capability page |
| `/atlas/[territory]/[capability]/[skill]` | Skill page |
| `/tools`, `/tools/[tool]` | Tool index, and each tool with the skills it serves |
| `/resources` | All resources, filterable by type and territory |
| `/me` | Profile and progress |
| `/about` | |

Search covers every page through a static index (Pagefind).

## 10. Architecture

**Stack.** Astro with static output. Content collections give typed schemas and build-time checks on references between collections.

**Files.**

```
src/content/
  territories/     10 plus cross-cutting
  capabilities/    72
  skills/          ~400: id, capability, summary, related, resources, tools, description
  resources/       one entry per resource
  tools/           one entry per tool
src/atlas/
  geometry.json    territory outlines, capability and skill positions, keyed by id
  render.ts        (content, geometry, state) -> SVG
```

Geometry is kept apart from content, so a re-layout or a second style never touches the taxonomy.

**Renderer.** One pure function returns SVG. It serves the static, pre-zoomed map on every topic page with no JavaScript, the interactive explorer, and later the social images.

**Client code.** Only for map interaction, progress and search. Videos are click-to-load embeds.

**Build checks.** Every reference resolves, every node has a position and a description, and the link checker passes.

**Tests.** Vitest for content integrity. One Playwright visual snapshot of the map.

**Deploy.** Static build synced to your server, the same pattern as scroller.pro.

**Analytics.** Privacy-friendly page analytics plus a few map events.

The folder is not a git repository yet. Initialise it at the start of phase 0.

## 11. Phases

Durations are rough guesses for one person working with an agent.

| Phase | Scope | Rough duration |
| --- | --- | --- |
| 0. Taxonomy and style | Taxonomy as data files with the cleanup done, layout sketch, both style prototypes, choose one | 3 to 5 days |
| 1. Map and site | Astro site, pages and descriptions at all three levels, the map in the chosen style with three zoom levels, list fallback, search | 1 to 2 weeks |
| 2. Research pass | Resources and tools, pilot territory first and then the rest, tool and resource indexes, link checker | 1 to 2 weeks plus your review |
| 3. Progress and profile | Status per skill, roll-ups, profile page, export and import | 2 to 3 days |
| 4. Launch | Analytics, social images, deploy | 2 to 3 days |
| Later | Experiments on owned products lighting the map; accounts | not scoped |

Phases 2 and 3 do not depend on each other and can run in either order.

## 12. Assumptions to confirm

1. **Where status lives.** Status is set on skills, the third level, with the one-action shortcut on a capability.
2. **Cross-cutting capabilities.** Drawn as the waters around the land, subject to the prototype.
3. **Illustrated style art.** The base art comes from an image model, as your mockup did, generated outside this codebase from the layout sketch. Regions are then traced as vector shapes.
4. **Language.** English only.
5. **Launch timing.** The site goes public once the research pass covers every territory. Launching earlier, territory by territory, is possible.
