# Tools & resources library

`/library/` searches both kinds of entry. `/tools/` and `/resources/` use the same engine with a fixed kind. Query, format, territory, pricing, depth and sort are preserved in the URL. Search matches titles, descriptions, authors, domains and linked atlas skills; it supports quoted phrases, `-exclude`, and `site:domain.com`.

## Local workflow

Use Node 24 and run `npm run dev:catalog` from `website/`. Open <http://localhost:4322/operations/> and choose **Sign in with Dev**. The preview binds to loopback, uses `server/data/catalog-preview.sqlite`, and does not change production accounts or data. It detects an installed Treg CLI automatically. `CATALOG_PORT` and `CATALOG_API_PORT` override its default ports.

## Discovery and review

1. Choose Web & articles, YouTube, X / Twitter, GitHub or Hacker News; enter a topic and search. Web searches also find courses, books, documentation and tool websites. GitHub and Hacker News use public APIs. Web, YouTube and X use Treg, which supplies the provider credentials. Each source reports errors rather than substituting fabricated results.
2. Select promising results and **Retrieve selected**, or retrieve an individual result. Choose the suggested kind or override it as tools/resources. You can also retrieve a URL directly. Tracking parameters, fragments, www hosts, YouTube short links and Twitter aliases are normalized for duplicate detection. Existing records open in place rather than being added again.
3. Open a record in the review queue. Edit its title, description, author, kind, format, pricing and depth. Choose at least one atlas territory, and optionally link skills or capabilities. Saving edits returns it to pending.
4. **Check source** records retrieval time, final URL, HTTP status, an icon and any error. HTML metadata is extracted without running scripts; YouTube and X use oEmbed to avoid consent-page metadata. A recheck preserves the editorial copy and review decision.
5. **Validate** publishes an entry to the live library. It requires useful copy, an atlas territory, and a successful check within seven days. If a site blocks automated retrieval, open it yourself, tick manual verification and record the evidence in the note. **Invalidate** requires a reason and excludes the entry from the live library. Either decision can be changed; the history is retained.

The catalog view can filter every review state, source problems, never-retrieved items and entries last editorially checked over 90 days ago. Select a page of entries to recheck their links. Export JSON includes the current filtered records and review metadata.

Search history stores the query, source, timestamp, provider results and actual cost. Identical searches within 15 minutes reuse those saved results without a new provider request. Search costs are capped at $0.02 per paid query and $1 per UTC day by default. `DISCOVERY_DAILY_BUDGET` changes the daily ceiling. A single discovery request runs at a time to preserve the budget reservation. GitHub and Hacker News remain available when the paid budget is exhausted. API quotas still apply.

Paid searches reserve their maximum cost before contacting Treg and settle to the reported charge on success. A failed or interrupted search keeps the maximum reservation for that UTC day because its upstream charge may be unknown. History labels those amounts as held, rather than claiming they were charged.

## Production configuration

Use the existing Astro + Node API deployment (`npm run deploy`); no additional hosting service is needed. The existing API database gains `catalog_entries`, `catalog_events` and `discovery_runs` through a migration, and existing account data is preserved. Include this database in the normal backup process.

Set `OPS_ADMIN_IDS` to comma-separated account ids, or `OPS_ADMIN_EMAILS` to comma-separated **verified** login email addresses. Ordinary signed-in users cannot read the review queue, call discovery or change entries. Local dev sign-in is allowed only on localhost.

Set `TREG_TOKEN` in the API server environment; personal tokens also require `TREG_ORG`. Alternatively set `TREG_CLI` to the absolute path of an authenticated CLI executable available to the API process. Do not put credentials in browser code. Without a Treg connection, the panel clearly marks web, YouTube and X as unavailable; URL retrieval and GitHub/Hacker News still work.

The live catalog is seeded from the checked YAML atlas on API startup. Existing reviews are retained across restarts and deployments. Review decisions publish to the live library without a rebuild; they do not rewrite YAML or create static tool pages for discoveries. Use the JSON export when promoting reviewed discoveries into version-controlled atlas content. If the API is unavailable, the public interface labels its fallback as the catalog snapshot from the last site build; that snapshot can predate later review decisions.

Source retrieval rejects private networks and non-web protocols, checks DNS inside each socket connection and after redirects, limits response bytes, and has a deadline. Provider text is rendered with DOM text nodes. Operations require a same-site authenticated session, same-origin JSON writes, bounded payloads, rate limits and version checks against stale edits. Reviewer notes are excluded from public API responses. Favicons come from the retrieved origin or Google's domain favicon service, with a visible fallback when unavailable.
