# Skill pages: is 35 words enough?

Date: 19 November 2026. Research for the question "should skill pages have a bigger body?". The short
description (`summary` and `description`) stays as it is.

## Short answer

Yes, most skill pages are too thin to rank or to be cited, but the reason is not the word count. It
is that a 35-word definition answers only "what is it?", and people (and AI answers) also ask "how
do I do it?", "what goes wrong?" and "what does it look like in a real product?".

The recommendation:

1. **First, show what the site already has.** 94 skills have a one-sentence note from an In practice
   entry ("Papermark: a weekend build on Next.js and Vercel; upload a PDF, share a link, see who read
   which page."). Skill pages list the entry but not the note. Showing it adds unique, concrete text
   to 94 pages with no new writing.
2. **Then add an optional body of 250 to 450 words**, written to a fixed structure, to the skills with
   search demand first (about 20 to 40 skills), not to all 350.

## What the research says

- **Google: word count is not a ranking or quality factor.** John Mueller has said so several times
  (2018, 2019, 2022): "Word count is not a sign that a page is thin content." Google's helpful content
  guidance warns against writing to a word count. A thin page is a page that does not help, whatever
  its length.
- **But the pages that rank for skill queries do more than define.** For "what is an activation
  metric", the results include glossary pages of about 600 words (Ballpark) and a guide of about
  1,800 words (PostHog). For "vertical slicing user stories", the results are guides of 1,000 to 1,300
  words (DEV, Applied Frameworks). They all cover how to do it, examples and pitfalls. A 35-word
  definition competes only for the definition box.
- **AI answers cite pages with sources, numbers and quotes.** The GEO paper (Aggarwal et al., KDD 2024)
  found that adding citations, statistics and quotations raised a source's visibility in generative
  answers by up to about 40%, and that keyword stuffing did not help. In practice notes are exactly
  that kind of text: a named product, a number, a source.
- **A skill page is a node in a map, not a full guide.** Depth already lives in the linked resources
  and In practice entries. The body should make the page useful on its own and send people to the
  depth, not replace it. That points to 250 to 450 words, not 1,500.

## Today's skill pages

| Field | Skills that have it |
| --- | ---: |
| `summary` + `description` (average 35 words) | 350 |
| `evidence` (practice, artifact, checks) | 45 |
| `technicalLeverage` | 45 |
| `aiLeverage` | 26 |
| A note from a published In practice entry | 94 |
| Only one resource | 160 |

## Proposal

### 1. Show In practice notes on skill pages (small change)

In the "In practice" section of a skill page, show each entry's note for that skill under the entry
title. The notes are already validated and served in each entry's `map.json`. They are first-hand,
specific and different on every page.

### 2. An optional body per skill

Store bodies as MDX files in a content collection, `src/content/skills/<skill-id>.mdx`, not in the
atlas YAML. The YAML stays a clean taxonomy, Markdown gets Astro's rendering for free, and the
validator can fail the build when a file names a skill that does not exist.

Fixed headings, so skill pages can be compared, as In practice entries are:

| Section | Content | Length |
| --- | --- | --- |
| Why it matters for a product engineer | Where this skill changes a decision or a result. | 2 to 4 sentences |
| How to do it | 3 to 6 numbered steps, concrete enough to try this week. | 80 to 150 words |
| Common mistakes | 3 to 5 bullets. | 50 to 100 words |
| Example | A real product, ideally from In practice, with a number or a name. | 2 to 4 sentences |

Do not repeat what `aiLeverage`, `technicalLeverage` and `evidence` already say on the page.

Writing rules: the voice of the site, first-hand where possible, no filler to reach a length, every
link opened and checked before it is saved, and the short description stays the first sentence on
the page.

### 3. Which skills first

Start where search demand meets evidence on the site. Candidates to check with keyword volumes:

- Strategy: `mvp`, `north-star-metric`, `vertical-slicing`, `scope-cutting`
- Discovery: `user-interviews`, `competitive-analysis`, `ideal-customer-profile`
- Measurement: `funnel-analysis`, `retention-curves`, `tracking-plans`, `session-replays`, `hypotheses`
- Shipping: `feature-flags`, `rollbacks`
- Activation: `activation-events`, `progressive-onboarding`
- AI: `ai-evals`, `mcp`, `structured-outputs`

All ids above exist in the atlas today. A keyword volume run for these terms costs about $0.02
through treg.

## A sample body, for voice and length

Draft for `02.5.1 Minimum viable product`, about 280 words. Not on the site.

> **Why it matters for a product engineer**
>
> An MVP is where engineering and product meet. The engineer decides how small the first version can
> be while it still does its one job well. Build too much and you learn late. Build something broken
> and you learn nothing, because people leave for the wrong reason.
>
> **How to do it**
>
> 1. Write down the one assumption that would end the idea if it were wrong.
> 2. Choose the cheapest test that gives a real answer. Sometimes that is a landing page or a manual
>    service, not software (see Concierge and Wizard of Oz tests).
> 3. If it is software, build one thin slice from end to end, and make that slice good.
> 4. Decide before launch which result means keep, change or stop.
> 5. Put it in front of the people the assumption is about, and measure the one behaviour that matters.
>
> **Common mistakes**
>
> - Calling the first release of the full roadmap an MVP.
> - Testing with friends who are not the target users.
> - Skipping tracking, then arguing about what happened.
> - Treating MVP code as the foundation without deciding to.
>
> **Example**
>
> Before he wrote code, Marc Seitz bet that a tweet about the idea would get 50 likes. It got 265. The
> first Papermark was a weekend build: upload a PDF, share a link, see who read which page. Two
> founders took it to $3M ARR. (From the Papermark profile in In practice.)

## Sources

- [Mueller: word count is not a quality factor (Search Engine Journal)](https://www.searchenginejournal.com/word-count-not-a-quality-factor/397288/)
- [Mueller on word count (Search Engine Roundtable)](https://www.seroundtable.com/google-word-count-34092.html)
- [GEO: Generative Engine Optimization, Aggarwal et al.](https://arxiv.org/abs/2311.09735)
- [PostHog: WTF is activation and why should engineers care?](https://posthog.com/newsletter/wtf-is-activation)
- [Ballpark: activation metric](https://ballparkhq.com/research-glossary/activation-metric)
- [DEV: user stories and vertical slicing](https://dev.to/jan/user-stories-and-vertical-slicing-1dpo)
- [Applied Frameworks: making the vertical slice](https://agile.appliedframeworks.com/applied-frameworks-agile-blog/user-stories-making-the-vertical-slice)
