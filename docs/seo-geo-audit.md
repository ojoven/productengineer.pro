# SEO and GEO audit: productengineer.pro

Date: 19 November 2026. Site live since 11 November 2026 (8 days).

GEO here means generative engine optimisation: being found, read and cited by AI answer engines
(ChatGPT search, Perplexity, Claude, Gemini, Google AI Overviews).

## Summary

**Score: 54 / 100.**

The site is built well. Crawling, canonicals, redirects, speed and content structure are mostly
right, and the MCP server and public JSON are rare GEO assets. The score is low because the site has
almost no authority yet: no referring domains were found, and a web search index does not return any
of its pages. That is normal for a site that is 8 days old. It is also the main thing to fix.

The five actions with the most effect, in order:

1. Register the site in Google Search Console and Bing Webmaster Tools, submit the sitemap and add
   IndexNow. ChatGPT search depends heavily on the Bing index.
2. Get the first 15 to 25 relevant links: own properties, the makers already profiled, MCP and
   agent-skill directories, and one launch (Show HN). See [Link targets](#link-targets).
3. Add site-wide structured data (WebSite, Person, BreadcrumbList, DefinedTerm for skills) and an
   `llms.txt`.
4. Write two or three citable hub pages for the queries people actually search, such as "what is a
   product engineer" and "product engineer skills".
5. Fix the duplicate `/library/` and `/tools/` pages, the long meta descriptions, and the layout
   shift on skill pages.

## Status (19 November 2026, later the same day)

Deployed to production on 19 November 2026 (from the working tree). IndexNow accepted all 506 sitemap
URLs. Done:

- Meta descriptions cut to 160 characters at a sentence or word (`clip()` in `src/lib/seo.ts`, applied
  in `Base.astro`). 0 of 506 pages are over the limit now.
- Short `seoTitle` for the two long entries; the site name is added to a title only when the whole
  title fits in 70 characters. New home title: "Product engineer skills map · ProductEngineer.pro".
- Empty "Tools for this topic are being researched" sections removed. A skill with no tools shows its
  capability's tools (96 pages) or no Tools section (186 pages). Same for empty resource sections.
- `/library/` lists entries by title, as the script does, so its first page is no longer the Tools page.
- `/search/` is `noindex`. Tool pages no longer have a `<script>` inside the `<h1>`.
- JSON-LD on every public page: `WebSite`, `Organization` (with `/logo.png`), `Person`,
  `ProfilePage`, `BreadcrumbList` (in `Crumbs.astro`), `DefinedTerm` for skills, `DefinedTermSet` for
  capabilities, territories and the map, `CollectionPage` for In practice, `FAQPage` on the new page.
- `/llms.txt`, `/llms-full.txt` and `/in-practice/rss.xml`, built from the content. `<lastmod>` for
  entries in the sitemap. `og:site_name`.
- Font layout shift: the two above-the-fold fonts are preloaded, and fallback faces with matched
  metrics (Arial and Roboto) are in `site.css`. With the web fonts held back 2.5 s, CLS went from
  0.17 to 0.01 on a skill page and from 0.29 to 0.03 on the new page.
- IndexNow: key file in `public/`, `indexnow_snapshot` and `indexnow_submit` in `deploy/config.sh`,
  called by `deploy.sh`. It submits only pages whose HTML changed (asset names ignored), plus
  deleted pages.
- New page `/what-is-a-product-engineer/`, linked from the home page, the footer and `llms.txt`.
- GitHub: the skills repo homepage is now `https://productengineer.pro/skills/`. The README link is
  edited in the local clone and still needs a commit and push.

Still open: Search Console and Bing Webmaster Tools verification, HTTP/2, the GitHub profile website
field (needs the `user` scope), and all of [Link targets](#link-targets). Skill bodies: research in
[skill-bodies.md](skill-bodies.md), the 40-batch plan in [skill-bodies-batches.md](skill-bodies-batches.md);
the code that shows a body is ready but not deployed, and no body is written yet.

## Scorecard

| Area | Weight | Score | Main reason |
| --- | ---: | ---: | --- |
| Crawling and indexing | 15% | 8/10 | Clean robots, sitemap, canonicals and 301s. `/library/` duplicates `/tools/`. Not yet in a search index. |
| On-page basics | 15% | 6/10 | Good titles and H1s on map pages. 373 of 505 descriptions are too long; article titles too long; home title has no target query. |
| Content depth | 20% | 5/10 | Unique taxonomy and strong long-form profiles, but skill pages are short and 81% show an empty tools section. No hub page for the main queries. |
| Structured data | 10% | 3/10 | Good `Article` JSON-LD on 4 entries. Nothing on the other ~500 pages. |
| Speed and UX | 10% | 7/10 | LCP 1.0 to 1.8 s on throttled mobile. CLS 0.16 on skill pages. HTTP/1.1 only. |
| Trust and entity (E-E-A-T) | 10% | 6/10 | Real author, method pages, dated entries, LinkedIn and GitHub links. No Person schema, no `sameAs`, similar brand names exist. |
| AI readiness (GEO) | 10% | 6/10 | MCP server, `atlas-data.json`, AI crawlers allowed, clear definitions. No `llms.txt`, no feed, not in Bing. |
| Off-site authority | 10% | 1/10 | 0 referring domains found. The site's own GitHub repo does not link to it. |
| **Total** | | **54** | |

## What was checked and how

- Live HTTP checks with `curl`: status codes, redirects, headers, compression, robots, sitemap,
  responses to AI crawler user agents.
- HTML of key pages: home, about, Skills Map, a territory, a capability, a skill, a tool, In practice
  index and three entries. Titles, descriptions, headings, JSON-LD, word counts, links.
- The local build (`dist/`, 17 Nov) for site-wide counts: 505 indexable pages.
- Mobile speed with Playwright on the live site: Pixel 7, 4x CPU slowdown, 1.6 Mbps, 150 ms RTT.
- Off-site: web searches for the domain and the topic, SE Ranking referring domains, a check of the
  makers' sites and the GitHub repo for links back.

Not measured, and why:

- **Backlink summary and keyword volumes.** The paid treg call for a backlink summary was blocked by
  the permission check, and the keyword volume provider answered "limits exceeded". Total spent: $0.
  The keyword targets below are therefore hypotheses to check with volume data.
- **PageSpeed Insights.** The free API was over its daily quota, so speed was measured locally.
- **Search Console data.** No connected account was found. I could not see if the site is verified.
- **AI-answer mentions.** Not run (about $0.10 per query). The manual check in
  [Measure it](#measure-it) replaces it.

## Findings

### Crawling and indexing

What works:

- `robots.txt` allows everything and points to the sitemap.
- HTTP and `www` redirect to `https://productengineer.pro/` with 301s. Old `/atlas/`, `/fieldwork/`
  and `/lab/` paths 301 to their new homes.
- Every page has a self-referencing canonical. Trailing slashes are consistent.
- Placeholders, drafts, `/me/`, `/connect/`, `/figures/` and `/operations/` are `noindex` and out of
  the sitemap.
- GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Googlebot and Bingbot all get a 200.
- HTML is gzipped. Static assets are cached for a year (`immutable`).

Problems:

1. **`/library/` and `/tools/` are 97% the same page** (server-rendered text compared by word
   triples). Both are in the sitemap and both are self-canonical. Google will pick one and may ignore
   the other. Make `/library/` render a different default view (for example, resources and tools
   together, with a short intro), or point its canonical at `/tools/`.
2. **No `<lastmod>` in the sitemap.** Add it for In practice entries (`dateModified`) and for map
   pages when their YAML changes. It helps crawlers spend their budget on new pages.
3. **`/search/` is indexable.** It is an empty search form. Add `noindex`.
4. **Not yet in a search index.** A web search for `"productengineer.pro"` and `site:productengineer.pro`
   returned no pages from the site. No Search Console or Bing verification file is in the repo
   (DNS verification is possible, so please check).
5. **435 map pages on a new domain with no links.** Google usually indexes a small share of a new
   site's pages and waits for signals. Expect many "Discovered, currently not indexed" pages until
   links arrive. Internal links are strong, so the bottleneck is authority, not structure.

### On-page basics

- **Meta descriptions: 373 of 505 are over 160 characters.** Skill and territory pages use the
  summary plus the full description (300 characters). Use the summary only, or cut at a sentence
  end before 155 characters.
- **Article titles are 90 to 96 characters.** For example "Mamitsu: one maker, a team of agents
  and an API that watches social videos · ProductEngineer.pro". Google shows about 60. Keep the long
  H1 and add a short `seoTitle` field for the `<title>`, with the product name and the main topic
  first.
- **Home page title and H1 do not name the main query.** Title: "ProductEngineer.pro · Product
  engineering, mapped and in practice". H1: "You already do more than write code." Suggested title:
  "Product engineer skills map: 350 skills, free · ProductEngineer.pro". The H1 can keep the hook if
  a visible line above it says "The product engineering skills map".
- **Tool pages have a `<script>` inside the `<h1>`** (the favicon error handler). Move it after the
  heading. Parsers that read the H1 text get JavaScript first.
- `og:site_name` and `article:published_time` are missing. `og:image` is the default on tool pages
  and on the main section pages.
- Images have `alt` attributes. `lang="en"` is set. Headings are in a logical order.

### Content depth

Strengths:

- The taxonomy is original. Nobody else publishes 350 product engineering skills with codes, short
  definitions, checked resources and links between them. That is a strong reason for other sites to
  link.
- In practice entries are long (Mamitsu: about 6,800 words), first-hand, dated, full of numbers and
  names, and have good `Article` JSON-LD. This is exactly the kind of source AI answers like to cite.
- Skill pages start with a clear one-line definition ("The smallest product that tests the most
  important assumption."). Good for featured snippets and AI answers.

Problems:

1. **Skill pages are short.** The average skill description is 35 words. Most of a skill page is
   navigation and a status control.
2. **282 of 350 skill pages (81%) say "Tools for this topic are being researched."** 16 have no
   resource at all. A visible empty section on most pages reads as unfinished to people and to
   quality systems. Hide the section when it is empty.
3. **Skill pages link to `noindex` placeholders.** The MVP page links to the Linguaso placeholder
   entry. Hide placeholders on indexable pages until they are real.
4. **No page answers the main queries in prose.** The search results for "what is a product
   engineer" and "product engineer skills" are owned by PostHog, Mixpanel, Statsig and recruiters.
   The site has the best skills answer, but only as an interactive map and a 3-sentence section on
   the home page.
5. **Only 4 indexable long-form entries.** Seven more exist as placeholders or drafts.

### Structured data

Only the 4 published In practice entries have JSON-LD (`Article`, with `about` → `SoftwareApplication`
and the maker as `Person`). That part is good. Missing:

- `WebSite` and `Organization` (with `logo`) on the home page.
- `Person` for Mikel on `/about/`, with `sameAs` (LinkedIn, GitHub) and `jobTitle`. Reference it from
  every `Article` `author`.
- `BreadcrumbList` on all map pages and entries. The breadcrumbs are already on the page.
- `DefinedTermSet` and `DefinedTerm` for territories, capabilities and skills. This is the schema.org
  type for a vocabulary, and it fits the map exactly:

```json
{
  "@context": "https://schema.org",
  "@type": "DefinedTerm",
  "name": "Minimum viable product",
  "termCode": "02.5.1",
  "description": "The smallest product that tests the most important assumption.",
  "url": "https://productengineer.pro/skills-map/strategy/product-scoping/mvp/",
  "inDefinedTermSet": {
    "@type": "DefinedTermSet",
    "name": "Product scoping",
    "url": "https://productengineer.pro/skills-map/strategy/product-scoping/"
  }
}
```

- `CollectionPage` with an `ItemList` on `/in-practice/` and `/skills-map/`.

`Base.astro` already accepts a `jsonld` prop, so this is mostly a matter of building the objects in
the page templates.

### Speed and UX

Mobile, throttled, live site:

| Page | FCP | LCP | CLS | Transfer | DOM nodes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 1.76 s | 1.76 s | 0.000 | 243 KB | 2,915 |
| `/skills-map/` | 1.35 s | 1.35 s | 0.002 | 169 KB | 1,001 |
| skill page (MVP) | 1.00 s | 1.00 s | **0.143** | 148 KB | 348 |
| `/in-practice/mamitsu/` | 1.43 s | 1.43 s | 0.033 | 276 KB | 3,037 |
| `/library/` | 1.50 s | 1.50 s | 0.009 | 273 KB | 669 |

- **CLS 0.14 to 0.16 on skill pages** (over the 0.1 limit). The shift happens at about 1.3 s and
  moves the nav and the status control: it is the IBM Plex web font replacing the fallback. Preload
  the IBM Plex Sans 400 `woff2` file and add a fallback `@font-face` with `size-adjust` and
  `ascent-override` so the two fonts take the same space.
- **TTFB is 550 to 700 ms** from here, for static files. The server speaks HTTP/1.1 only. Enable
  HTTP/2 in Apache (`mod_http2`, `Protocols h2 http/1.1`).
- The home page HTML is 668 KB (155 KB gzipped), mostly the inline map SVG and 516 links. It is fast
  enough today. Watch it as the map grows.

### Trust and entity

- The About page is honest and specific: who writes it, how resources are chosen, how entries are
  written, no affiliate links. That is good E-E-A-T.
- Missing: `Person` schema with `sameAs`, an author box with a photo on entries, and a publisher logo.
- **Brand confusion risk.** Other sites use nearly the same name: productengineer.org,
  productengineer.substack.com ("The Product Engineer") and productengineers.substack.com. Use the
  same name and description everywhere ("ProductEngineer.pro, a map of product engineering by Mikel
  Torres Ugarte") and link all profiles with `sameAs`, so search engines and AI models keep the
  entities apart.

### AI readiness (GEO)

What already helps:

- A public MCP server (`/mcp`, `/mcp/public`) and a full machine-readable map at `/atlas-data.json`.
  Few content sites offer this. It is also a link and mention opportunity (MCP directories, see below).
- AI crawlers are allowed. Pages are static HTML, so crawlers that do not run JavaScript still see
  the full content.
- Definitions come first on skill pages. In practice entries start with an "X is ..." sentence and
  carry concrete numbers.

What is missing:

1. **`llms.txt`** (404). Add one at the root: a short description, the 12 territories with links,
   the In practice entries, the MCP endpoint, `atlas-data.json` and the agent skills repo. Generate it
   at build time from the atlas, like the sitemap. Optionally add `llms-full.txt` with every skill's
   name, code, summary and URL.
2. **Bing indexing.** ChatGPT search and Copilot depend on Bing. Verify in Bing Webmaster Tools and
   send new URLs with IndexNow from `deploy.sh` after each deploy.
3. **A feed.** No RSS or Atom (all 404). Add `/in-practice/rss.xml` and a `<link rel="alternate">`.
   Feeds are read by aggregators, newsletters and some AI tools.
4. **Short fact blocks.** AI answers quote compact, self-contained facts. A "Key facts" list at the
   top of each entry (product, maker, founded, revenue or users, stack, source and date) would make
   the numbers easy to cite.
5. **AI referral tracking.** See [Measure it](#measure-it).

### Off-site authority

- SE Ranking found **0 referring domains** for productengineer.pro. (This index undercounts small
  sites, but 0 matches what the web search shows.)
- **The site's own GitHub repo does not link to it.**
  `ojoven/product-engineering-skills` has no homepage set, no topics and no mention of the site in
  the README.
- The homepages of the four profiled products (Mamitsu, Zernio, Papermark, and Unai Esteibar's site)
  do not link to their profiles.

## Recommendations

### This week

| # | Action | Effort |
| --- | --- | --- |
| 1 | Verify the domain in Google Search Console and Bing Webmaster Tools (DNS). Submit `sitemap.xml`. Request indexing for the home page, `/skills-map/`, `/in-practice/` and the 4 entries. | 30 min |
| 2 | Add IndexNow: a key file in `public/` and a ping of changed URLs at the end of `deploy.sh`. | 1 h |
| 3 | GitHub repo: set the homepage to `https://productengineer.pro/skills/`, add topics (`agent-skills`, `claude-code`, `product-engineering`, `mcp`), add a line and link at the top of the README. Do the same on the GitHub profile README and the LinkedIn "Featured" section. | 30 min |
| 4 | Fix `/library/` vs `/tools/` duplication, `noindex` on `/search/`, hide empty tools sections and placeholder links on skill pages. | 2 h |
| 5 | Cut meta descriptions to 155 characters. Add `seoTitle` for entries. New home title. | 1 h |
| 6 | Add `llms.txt`, generated at build time. | 1 h |

### Next 2 to 4 weeks

| # | Action | Effort |
| --- | --- | --- |
| 7 | Site-wide JSON-LD: `WebSite`, `Organization`, `Person` with `sameAs`, `BreadcrumbList`, `DefinedTerm` / `DefinedTermSet`, `CollectionPage`. | 0.5 day |
| 8 | Hub page "What is a product engineer?": a 2-sentence definition first, then product engineer vs software engineer vs product manager, the 11 territories in prose with links, the skills that matter most, and 5 to 8 FAQ answers. This is the page AI answers and other sites will cite. | 1 day |
| 9 | Hub page "Product engineer skills" or "Product engineer roadmap": a text version of the map with an order to learn in (core, then wider areas). Check search volume for "product engineer roadmap" first. | 1 day |
| 10 | Fix the font CLS. Enable HTTP/2. | 2 h |
| 11 | RSS feed for In practice. `<lastmod>` in the sitemap. | 2 h |
| 12 | "Key facts" block on each In practice entry. Author box with photo. | 0.5 day |

### Ongoing

- **Grow the skill pages that have search demand first**, not all 350. Good candidates: MVP, feature
  flags, jobs to be done, north star metric, activation metrics, onboarding, retention curves, time
  to value. Add "why it matters for a product engineer" and "common mistakes", about 150 to 250 words
  each, in Mikel's own words.
- **Publish one In practice entry a week.** Each one is a reason for a maker to link and share.
- **Build one linkable asset:** a downloadable poster of the map (SVG or PDF), or a shareable image of
  "my map" with the user's statuses. People share posters and self-assessments, and each share links
  back. (Keep it user-triggered, and keep statuses out of analytics, as `AGENTS.md` asks.)

## Link targets

Ordered by effort and relevance. Start with groups A to C: they are fast, relevant and mostly under
your control.

### A. Own properties (this week)

| Target | Action |
| --- | --- |
| github.com/ojoven/product-engineering-skills | Homepage field, README link, topics. |
| GitHub profile (`ojoven`) | Profile README line and the website field. |
| LinkedIn (`mikeltorresugarte`) | Website field, "Featured" link, link in the About text. |
| skills.sh listing | Check that it shows the homepage once the repo has one. |
| Linguaso, Etengabe, Codiluce, The Mêlée | A link from each site's about or "made by" page (not a site-wide footer). |

### B. Makers already profiled (warm and relevant)

The profiles were written partly to help these products' SEO and GEO. A short, friendly note with the
link, asking them to share it or list it on a press, "featured in", blog or about page is a natural
ask.

| Target | Page to ask for |
| --- | --- |
| Mamitsu (usemamitsu.com) and Unai Esteibar (uesteibar.com) | Press or blog link; a post on X and LinkedIn. |
| Zernio (zernio.com) and Miquel Palet | Press page or LinkedIn post. Also tag the Itnig podcast when sharing. |
| Papermark (papermark.com) and Marc Seitz (mfts.io) | Blog, press page or GitHub README "featured in". |
| RelievApp (reliev.app) | About or press link to Part I. |

### C. MCP and agent-skill directories (the site has a public MCP server and agent skills)

| Target | How |
| --- | --- |
| Official MCP Registry (registry.modelcontextprotocol.io) | Publish a `server.json` for the remote server. Several directories import from it. |
| Glama (glama.ai/mcp/servers) | Claim or submit the listing. |
| Smithery (smithery.ai) | Submit through the web dashboard. |
| mcp.so, mcp.directory | Submit form or GitHub issue (check each site's current method). |
| awesome-mcp-servers (`punkpeye`) | Pull request. |
| Claude connectors directory | Accepts remote MCP servers after a review. Higher bar, high value. |
| Agent-skill directories: claudemarketplaces.com, agent-skills.md, claudeskills.info | Submit the repo. Check each site's rules first. |
| awesome-claude-skills lists on GitHub | Pull request with a one-line description. |

### D. Product engineering community (most relevant to the topic)

| Target | How |
| --- | --- |
| awesome-product-engineer (`marcelkalveram`) | Pull request adding the Skills Map. It is the main curated list for this exact topic. |
| PostHog: "Product for Engineers" newsletter and the posthog.com/product-engineer pages | Pitch the map as a reference. PostHog owns the top results for "product engineer" and links to outside resources. PostHog is also in the tools library. |
| The Product Engineer (productengineer.substack.com), Product Engineers (productengineers.substack.com) | Comment, offer a guest piece, or ask for a mention. |
| Viljami Kuosmanen's "Product engineer checklist" (epilot, dev.to, Buttondown) | Share the map as a companion resource. |
| progression.fyi and swyx.io/career-ladders | Submit the map as a public framework. |

### E. Launch platforms (one-time spikes; also read by AI models)

| Target | Angle |
| --- | --- |
| Hacker News (Show HN) | "A map of 350 product engineering skills, with an MCP server." Post on a weekday morning US time; reply to every comment. |
| Product Hunt | The map plus the agent skills. |
| Indie Hackers | The podcast profiles: Zernio (about €5M ARR, no investors) and Papermark ($3M ARR, two founders) fit this audience well. |
| Reddit: r/ClaudeAI (MCP and skills), r/SideProject, r/ProductManagement, r/ExperiencedDevs | Read each subreddit's self-promotion rules first. Share useful content, not just the link. |
| dev.to and Hashnode | Republish entries with `canonical_url` set to the original. |

### F. Local and personal network

- The Mêlée meetup page and talk slides.
- Spanish and Basque tech podcasts and meetups: one talk about the map gives a link from the event
  page and the slides.

### Targets for later

Tool vendors in the library (PostHog, GrowthBook, Formbricks, Langfuse, Flagsmith and others) rarely
link to directories. Reach out only when an entry is about their product.

## Measure it

Targets for the next 90 days:

| Metric | Today | Target | Where |
| --- | ---: | ---: | --- |
| Referring domains | 0 | 20+ | Search Console links report, or a backlink tool once a month |
| Indexed pages | unknown | 300+ of 505 | Search Console, Pages report |
| Impressions per week | unknown | 2,000+ | Search Console |
| AI referrals | not tracked | tracked | Rybbit referrers: chatgpt.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com |
| Cited in AI answers | unknown | 3 of 10 prompts | Monthly manual check, below |

Monthly AI check: ask the same 10 questions in ChatGPT (search on), Perplexity, Claude and Gemini,
and record whether productengineer.pro is cited. Example questions:

1. What skills does a product engineer need?
2. Product engineer vs software engineer: what is the difference?
3. Is there a map or framework of product engineering skills?
4. How do I become a product engineer?
5. What is Mamitsu?
6. How did Zernio grow to millions in ARR?
7. How does Papermark make money?
8. What is a minimum viable product, for an engineer?
9. Which MCP servers help with product management?
10. What is RelievApp?

Questions 5 to 7 and 10 test whether the profiles work as citations for the makers (goal 2 of the
profiles).

## Sources

- [PostHog: What is a product engineer?](https://posthog.com/product-engineer)
- [PostHog: Things product engineers need to know](https://posthog.com/product-engineer/skills)
- [awesome-product-engineer (context-awesome listing)](https://www.context-awesome.com/list/marcelkalveram/awesome-product-engineer)
- [The Product Engineer Substack](https://productengineer.substack.com/p/its-never-been-a-better-time)
- [Product Engineers Substack](https://productengineers.substack.com)
- [The product engineer checklist (Viljami Kuosmanen)](https://buttondown.com/viljami/archive/the-product-engineer-checklist/)
- [Every public engineering career ladder (swyx)](https://swyx.io/career-ladders)
- [Where to list your MCP server (Apideck)](https://www.apideck.com/blog/mcp-server-directories)
- [MCP server directories (Geekflare)](https://geekflare.com/guides/mcp-server-directories/)
- [Claude connectors directory submission](https://claude.com/docs/connectors/building/submission)
- [mcp.directory submit](https://mcp.directory/submit)
- [Where to publish AI agent skills (DEV)](https://dev.to/brugeman/where-to-publish-your-ai-agent-skills-discovery-hubs-and-directories-5l7)
- [claude-skills-marketplace](https://github.com/beshkenadze/claude-skills-marketplace)
