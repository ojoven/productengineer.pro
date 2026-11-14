# Fieldwork: how entries are written

ProductEngineer.pro has two parts:

| Part | Kind of knowledge | What goes there |
| --- | --- | --- |
| Atlas | Understanding | Skills, resources, tools. A general reference. |
| Fieldwork | Practice | Reviews, comparisons, maker interviews, observations, experiments, shipped improvements and case studies. |

The point is the connection between them. Every entry names the atlas skills it used, so its page
lights them on the map and each skill page links back under *In practice*. Where possible an entry
also links to another entry: the comparison that led to an experiment, the observation that became
a review.

The goal is not to publish content about product engineering. It is to make product engineering work
visible: the problem, the decision, the evidence and the result.

## Files

| Path | What |
| --- | --- |
| `src/content/fieldwork/<id>.md` | One fieldwork entry. The file name is the URL: `/fieldwork/<id>/`. |
| `src/content/products.yaml` | The products featured in Fieldwork. |
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
| Observation | What I saw · Why it matters · What I take from it |
| Experiment | Context · What I built · How I measured · What happened · Trade-offs · What I learned |
| Improvement | Context · What I shipped · Trade-offs · Effect · What I learned |
| Case study | Context · My role · Decisions · Outcome · What I would do differently |

## Front matter

All entries: `title`, `summary` (one or two sentences, used in lists), `skills` (atlas skill ids,
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
`territory` must be its real atlas territory, and `section` must match a level-two heading exactly.
Use `scope: general` for a discussion beyond the featured product (the default is `product`).

Give each skill one sentence in `notes`: how the product applied it. A published profile without a
note for every skill gets a build warning.

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
- `<MapSummary />` in **On the map**, after the `Territories` figure, lists each territory and
  skill with its note. It is the summary of the whole piece.
- A linked index, a reading time from the prose (aim for 5 to 10 minutes) and a sidebar grouped by
  territory. The map highlights discussed skills without implying a chronological route.
- `/fieldwork/<id>/map.json` exports versioned coverage with section anchors, scope, atlas ids,
  names, codes, links and notes. Consumers can highlight a section's `skills` or select sections
  by `scope`; the content front matter remains the source of truth.

For the product and the maker, put the logo and a square portrait under `public/img/fieldwork/<id>/`
and point to them: `subjects[].logo`, `person.avatar`. Add `subjects[].what` (one quotable sentence
on what the product is) and `person.sameAs` (their other profiles). They show in the page head and
the Fieldwork list, go into the page's structured data, and make its social image: run
`npm run og -- fieldwork` and commit `public/og/fieldwork/<id>.jpg`.

A profile is also a citation for the maker's product. Say what the product is in one plain sentence
near the top, name the platforms and the jobs it does in the words people search for, and link to
the product, its docs or comparison pages and the maker's site.

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

Former `/lab/` URLs redirect to `/fieldwork/`, including individual entries. The separate author
URLs `/mikel/` and `/about/mikel/` redirect to `/about/#who-writes-it`.
