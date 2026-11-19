# In practice: how entries are written

ProductEngineer.pro has two parts:

| Part | Kind of knowledge | What goes there |
| --- | --- | --- |
| Skills Map | Understanding | Skills, resources, tools. A general reference. |
| In practice | Practice | Reviews, comparisons, maker interviews, observations, experiments, shipped improvements and case studies. |

The point is the connection between them. Every entry names the skills it used on the Skills Map, so its page
lights them on the map and each skill page links back under *In practice*. Where possible an entry
also links to another entry: the comparison that led to an experiment, the observation that became
a review.

The goal is not to publish content about product engineering. It is to make product engineering work
visible: the problem, the decision, the evidence and the result.

## Files

| Path | What |
| --- | --- |
| `src/content/fieldwork/<id>.md` | One In practice entry. The file name is the URL: `/in-practice/<id>/`. |
| `src/content/products.yaml` | The products featured in In practice. |
| `src/content/author.yaml` | Author details used in “Who writes it” on `/about/`. |
| `src/editorial/schema.ts` | Front matter schemas and the required sections per kind (the source of truth). |
| `src/editorial/validate.ts` | The checks below. |
| `src/components/figures/` | The figures an entry can show: charts, diagrams, walkthroughs. See [figures.md](figures.md). |

Files starting with `_` are ignored, so a draft can sit as `_draft.md`.

## Figures

An entry that shows a funnel, a walkthrough of screens, a diagram or a result uses a figure. Read
[figures.md](figures.md) before adding one: it says which figure fits which section of each kind,
and how to mark the evidence. The entry becomes `<id>.mdx` (same URL) and uses figures by name.

## Writing a new entry

1. Copy the placeholder of the same kind (list below) to a new file name.
2. Fill the front matter. Write `skills` in the order the work used them: the page joins them with a
   route in that order.
3. Replace the guidance under each `##` heading with the real text. Keep the headings. Extra
   sections are fine between them (for example `## Screenshots`).
4. Delete `placeholder: true` and the word *Placeholder* from the summary.
5. Run `npm test`. It fails on an unknown skill id, a broken link, a missing product, or a missing
   or reordered section.

Placeholders, one per kind:

| Kind | Example file |
| --- | --- |
| Review | `fieldwork/linear-first-week.md` |
| Comparison | `fieldwork/language-apps-first-lesson.md` |
| Interview | `fieldwork/maker-interview.md` |
| Observation | `fieldwork/onboarding-checklists.md` |
| Experiment | `fieldwork/etengabe-first-session.md` |
| Improvement | `fieldwork/productengineer-synced-progress.md` |
| Case study | `fieldwork/linguaso.md` |

## Sections per kind

| Kind | Sections, in order |
| --- | --- |
| Review | Scope · Who it is for · First run · What works · Where it loses people · Trade-offs · What I would test · What I take from it |
| Comparison | Scope · The shared job · Side by side · Where they differ · What I would test · What I take from it |
| Interview | Who and what · The decision · How they knew · What they measured · What they would change · What I take from it |
| Profile | Who and what · On the map · one section per territory discussed · Beyond the product · What I take from it |
| Podcast | Same as Profile |
| Observation | What I saw · Why it matters · What I take from it |
| Experiment | Context · What I built · How I measured · What happened · Trade-offs · What I learned |
| Improvement | Context · What I shipped · Trade-offs · Effect · What I learned |
| Case study | Context · My role · Decisions · Outcome · What I would do differently |

## Front matter

All entries: `title`, `summary` (one or two sentences, used in lists), `skills` (Skills Map skill ids,
at least one), `related` (`fieldwork/<id>` or `fieldwork/<id>`), `placeholder`.

Reviews, comparisons, interviews and observations add: `kind`, `date`, `updated`, `subjects` (`name`, `url`, `maker`; two or more for a
comparison), `person` (interviews: `name`, `role`, `url`), `question` (what I set out to find out),
`method` (version, platform, dates, time spent, as what kind of user).

Experiments, improvements and case studies add: `kind`, `product` (an id from `products.yaml`), `started`, `ended` (`YYYY`, `YYYY-MM` or
`YYYY-MM-DD`), `status` (`planned`, `running`, `shipped`, `concluded`, `abandoned`), `problem`,
`hypothesis` and `metric` (both required for experiments; `metric` has `name`, `baseline`,
`target`, `result`), `guardrails` (same shape), `verdict` (`pending`, `supported`,
`not-supported`, `inconclusive`), `decision` (`pending`, `keep`, `iterate`, `revert`, `stop`).

These fields make the facts box at the top of every page, so a reader can scan any entry the same
way. A concluded or abandoned experiment must have a verdict.

### Profiles across territories

Use `kind: profile` for a maker conversation organised by territories instead of one decision.
It takes the same research fields as an interview, including `person`. Keep the profile's four
required headings, and add territory sections between **On the map** and **Beyond the product**.
`mamitsu.mdx` is the first example.

Add `coverage` to group the entry's `skills` by section. Each skill must appear exactly once;
`territory` must be its real Skills Map territory, and `section` must match a level-two heading exactly.
Use `scope: general` for a discussion beyond the featured product (the default is `product`).

Give each skill one sentence in `notes`: how the product applied it. A published profile without a
note for every skill gets a build warning. Bold one sentence in a few sections at most: the one a
reader skimming the piece should not miss.

```yaml
coverage:
  - territory: ai
    section: 'AI: a model that watches, agents that build'
    skills: [structured-outputs, mcp]
    note: The product is a model call; the team behind it is agents in Slack.
    notes:
      structured-outputs: Frames, audio and caption in; JSON in the shape you asked for out.
      mcp: Agents call it through an MCP server and get back only the fields they need.
```

What the page does with it:

- Every heading that `coverage` points at gets a strip under it: the territory, linked, and the
  section's skills as chips (the note shows on hover). Nothing to write in the body.
- In **On the map**, the `Territories` figure links each lit territory to its section.
- A linked index and a reading time from the prose (aim for 5 to 10 minutes).
- The side column holds the **quick tour** (below): the map with every discussed skill lit, then one
  card per skill while the map flies from each skill to the next. It replaces the old side map and the
  "Skill by skill" summary at the end.
- `/in-practice/<id>/map.json` exports versioned coverage with section anchors, scope, Skills Map ids,
  names, codes, links and notes. Consumers can highlight a section's `skills` or select sections
  by `scope`; the content front matter remains the source of truth.

#### The quick tour

Every published profile and podcast has one: `src/content/tours/<id>.mdx`, named after the entry, no
front matter. It holds one `<Stop skill="…">` per skill of `coverage`, in the same order (the build
fails otherwise, and warns when a published profile has no tour). A stop only names its skill: the
territory, the skill's name and code, its position and the link back to its section come from
`coverage`.

```mdx
<Stop skill="pricing">
Per connected account: two free with no card, then $6 a month each up to ten, $3 up to a hundred.

<Bars title="Price per connected account, per month" unit=" USD" items={[...]} />

<Hot>The price per account falls as a customer grows, and the bill still grows with them.</Hot>
</Stop>
```

- One to three sentences, specific to the product: what it did with that skill, with its numbers and
  names. Not the one-line `notes`, which stay for the strips under the headings and `map.json`.
- A figure or a diagram where it shows something the sentence cannot: a number to compare, a flow, a
  before and after. Any figure works; it lays itself out for the narrow card. Same evidence rules as in
  the body, and every number from the entry's own sources (say so when the arithmetic is mine).
- My opinion goes in `<Hot>`, which labels it *Hot take*, so it is never read as what the maker said.
- On a phone the tour opens full screen (and the back button closes it); on a desktop it runs in the
  side column, with a button for full screen. Check every stop at 390 px.

For the product and the maker, put the logo and a square portrait under `public/img/fieldwork/<id>/`
and point to them: `subjects[].logo`, `person.avatar`. Add `subjects[].what` (one quotable sentence
on what the product is) and `person.sameAs` (their other profiles). They show in the page head and
the In practice list, go into the page's structured data, and make its social image: run
`npm run og -- fieldwork` and commit `public/og/fieldwork/<id>.jpg`.

#### A profile about a person

When the conversation is about a person and their work, not a product (a designer, a team lead),
leave `subjects` out. `person` is then required, with the avatar. The page head, the In practice
lists and the social image lead with the person, the facts box has no Product row, the structured
data is `about` the person, and the third required heading becomes **Beyond the work** instead of
**Beyond the product**. Territory sections keep the default `scope: product`: they are about the
person's work. `edorta-ramirez.mdx` is the first example. When the person works for a company that
must not be named, say so in `method` and describe patterns, not internal details.

A profile is also a citation for the maker's product. Say what the product is in one plain sentence
near the top, name the platforms and the jobs it does in the words people search for, and link to
the product, its docs or comparison pages and the maker's site.

### Podcasts

Use `kind: podcast` for a profile built from a public episode someone else recorded: a maker on
another show, not a conversation I had. Everything above about profiles applies (`coverage`,
`person` for the guest, logo and avatar, the four headings, the quick tour). It adds
`episode`, which shows in the facts box and goes into the page's structured data as the
`PodcastEpisode` the article is based on:

```yaml
episode:
  show: Itnig podcast
  title: Lanzó una API en un fin de semana y llegó a 5M€ de ARR en 13 meses   # the episode's own title
  url: https://www.youtube.com/watch?v=vE2z1XrCA6o
  host: Bernat Farrero
  published: 2026-11-12
  duration: '1:30:46'          # h:mm:ss or m:ss
  language: Spanish
```

What changes in the writing:

- The `method` says I did not talk to the guest, where the transcript came from, that quotes are my
  translation if they are, and that the numbers are the guest's, as said on the show.
- The host asks the questions: "Bernat asked...", not "I asked him...". My part is what I would
  ask next and what I would test, kept apart from what was said.
- Speakers in an automatic transcript are not labelled. When it is unclear who said a line, say so
  ("the trailer kept a line") instead of guessing.
- Keep the transcript under `interviews/<domain>/` next to the other source material.

`zernio.mdx` is the first example.

Set `draft: true` while the interviewee reviews the write-up. A draft builds at its URL but is
excluded from listings, skill backlinks, search and the sitemap. Remove the flag once reviewed.

## Rules

These are also on the About page.

- Say how I looked: version, platform, dates, time spent and what I left out.
- Keep what I saw apart from what I guess about other users.
- Write the hypothesis, metric and guardrails of an experiment before looking at the result.
- Publish failed and inconclusive experiments with the same detail as the ones that worked.
- Interviewees read their interview before it goes out. No sponsored reviews, no affiliate links.
- Numbers are real or marked as not measured. Never round a guess into a number.
- Write in plain, direct language, first person. No hype.

## Placeholders

`placeholder: true` shows a notice on the page and a tag in every list, sets `noindex`, and keeps
the page out of search and the sitemap. The pages still build and are reachable by URL. Replace or
delete the placeholders before deploying, or keep them only while the sections are empty.

Former `/lab/` URLs redirect to `/in-practice/`, including individual entries. The separate author
URLs `/mikel/` and `/about/mikel/` redirect to `/about/#who-writes-it`.
