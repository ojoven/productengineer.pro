# Rybbit instrumentation and measurement

Implemented 16 November 2026. Local source and isolated browser validation are distinct from
production receipt. Deployment and a received-event check start the usable measurement period;
historical custom events cannot be recovered. The dated HTML audit in `docs/product/evidence/`
is a historical snapshot, not the current tracking contract.

## Collection boundary

`src/scripts/track.ts` is the only collector. It sends pageviews, outbound clicks and semantic
custom events to Rybbit's [public ingestion API](https://rybbit.com/docs/api/sending-events).
The adapter exposes `window.rybbit.event` locally and dispatches through it; no external SDK or
Plausible bridge is loaded. This keeps collection independent of remote autocapture settings,
and lets us sanitize URLs before sending. Private API keys are never required in the browser.

Collection requires a production build on `productengineer.pro`. Localhost, preview/staging
hosts, `/operations/` and `/connect/` are excluded. `PUBLIC_RYBBIT_ENABLED=false` disables
collection at build time. The privacy page can exclude the owner's browser using
`disable-rybbit`; `window.__RYBBIT_OPTOUT__` is also respected on every send.

One pageview is sent per document load. Query, fragment, filter and Tour state changes do not
inflate pageviews. Automatic replay, copy/form/button capture, identification and arbitrary
browser-error capture are not used. Existing Rybbit replay settings do not activate recordings
without its replay client. Session replay would need a separate masking/URL/privacy design.

Only `utm_source`, `utm_medium`, `utm_campaign` and `utm_content` with bounded label-like values
are kept in analytics URLs. Referrers are reduced to their origin. Search text, OAuth parameters,
full personal maps, individual skill statuses and account IDs are never sent. The approved
campaign labels are also attached to events through 30-minute tab-session attribution, so an
internal navigation does not erase them. This is tab-session attribution, not cross-device identity.

Links that leave the site carry `utm_source=productengineer.pro`, so the sites we send people to can
see the visit came from here (`src/lib/utm.ts`, applied to every built page by `src/middleware.ts`
and to library links by `src/catalog/dom.ts`). Our own `outbound` event records only the origin and
path of the link, so the parameter adds nothing to our analytics.

Custom event properties are allowlisted strings/numbers. Early events have a bounded 50-item,
10-second startup queue that drains once. Blocked requests are harmless; no offline retries or
unload events fabricate activity at a later server timestamp. Delivery remains best effort.

## Events

- `tour_started`: entry into a visible skill card, including inline desktop, dock, keyboard,
  chapter/map jumps, resumes and hash/BFCache restoration. `start_type` distinguishes `new`,
  `resume`, `restart`, `restore`. Expanding an active Tour does not restart it.
- `tour_step_viewed`: each actual active-card transition. Includes `step_index`, public
  `skill_id`, `section_id` and `navigation`. Revisited cards are valid navigation; unique
  coverage is deduplicated by attempt + step.
- `tour_end_reached`: once per attempt, with `unique_steps_viewed`, `total_steps` and
  `final_step_index`. Back → Finish cannot double count. Explicit Start again resets the attempt.
- `tour_exited`: explicit close, browser back, read-profile, open-skill or back-to-overview
  action. Carries the step before mobile reset and a public destination identifier. Closed
  tabs and missing final events remain unknown outcomes, not invented abandonment reasons.
- `progress_changed`: one event per locally persisted single/bulk action, with `changed_count`,
  `mode`, `surface` and `storage=local`. No-op clicks, duplicate skill IDs, account hydration and
  sync retries do not count. The event does not assert cloud persistence.
- `map_used`: a deliberate changed selection or filter, with `action`, `view_level`,
  `focus_area`, `progress_filter` and `mode=explore|personal`. Personal mode requires a saved
  progress filter or selection of a marked skill. Initial rendering and resize are excluded.
- `search_results_viewed`: settled search/filter results, including zero matches. Carries
  `surface=catalog|site_search`, `trigger`, `result_count`, query-length bucket and controlled
  filter values/count. Catalog input settles for 500 ms after rendering (650 ms after the last
  keystroke); repeated submit of the same results does not duplicate. Pagefind uses its supported
  search API for total results, rather than counting visible cards. Raw terms remain local.
- `learning_link_opened`: a resource/tool outbound link activation, including keyboard and
  middle/modifier-click, with public entry ID, kind, surface and public context path. Count this
  as the learning conversion; raw `outbound` is a separate diagnostic, not another conversion.
- `setup_command_copied`: only after successful clipboard writes, with fixed command ID,
  surface and method. Copying is intent, not a verified install or successful MCP connection.

Tour context includes `tour_id`, a content-derived `tour_version`, `layout`, `total_steps` and
an ephemeral `attempt_id`. Attempts survive same-tab skill-page round trips and expire after
30 minutes of inactivity; content versions are separated. Resuming can create another start
episode for the same attempt. Count distinct attempts, not raw start events, for completion.

Retired: `Random skill`, `Signed out`, `Agent revoked`, `Account deleted`, `Map zoom`,
`Your map filter`, `Lit map opened`, `Status set`, `Status set in bulk`, `Quick tour opened`,
`Quick tour finished`. The deletion event's false-success path is removed rather than migrated.
Backend login, sync-success and MCP authorization/tool-use telemetry remain optional future
work, with server-owned truth and a separate identity decision; they are not inferred from CTA clicks.

## Validation

Run with Node 24:

```sh
npm test
npm run check
npm run build
node tests/analytics-browser.mjs
```

The browser check serves `dist/` locally but gives the browser a virtual production origin.
Every Rybbit request is intercepted and collected locally; it cannot reach production. A second
localhost journey confirms no collection. This validates actual emitted HTTP payloads, not spies
on the track function. No production test event or account is created.

Before reading deployment results, verify the nine names appear in Rybbit with the expected
properties and no localhost traffic. Do not assume a successful HTTP response proves storage:
Rybbit may exclude a bot or opt-out and still return 200. The received-event list is the check.

## A useful dashboard

Use complete days in Europe/Madrid and record the release cutoff. Initially review weekly counts
and a comparable previous window. With fewer than 100 people/attempts, report counts such as
“3 of 12” and inspect the individual paths in the source, rather than emphasizing percentages.

1. In **Events**, check names and properties. Split Tour events by `tour_id`, `tour_version`,
   `layout` and `start_type`. Inspect the distribution of `step_index` and explicit exit reasons.
   Later-card view counts are not a strict linear funnel because readers can jump/backtrack.
2. Create a **Tour funnel**: profile path → `tour_started` → `tour_end_reached`, filtered to a
   profile/version. Rybbit's session/user funnel is a useful overview; exact attempt conversion
   requires grouping by `attempt_id`. Reaching the end is not full coverage or proof of learning.
3. Create an **onward-use funnel**: `tour_started` → `map_used` or `progress_changed` as two
   separate funnels. Include partial Tours; requiring end-reached would exclude useful exits.
   The sequence describes behavior, not proof the Tour caused it.
4. Review **search and learning**: zero-result search counts by surface/filter, then
   `learning_link_opened` by entry and placement. No raw search strings are collected, so learn
   which topics are missing through voluntary feedback or observed sessions.
5. Review **distribution quality**: compare `utm_source` / `utm_campaign` against meaningful
   map use, saved changes and learning clicks, rather than traffic alone. Exclude the owner's
   browser before normal testing and mark prompted participant sessions separately in research.

[Rybbit funnels](https://rybbit.com/docs/funnels) support custom-event property filters. Set
the hostname to `productengineer.pro`. Dashboard capabilities depend on the installed version;
use read-only API analysis when attempt-level grouping is unavailable.

## An agent's weekly review

The existing read-only credential is `PRODUCTENGINEER_RYBBIT_API_KEY`, loaded from the
environment or ignored `.env.sources`. Never paste it into a prompt, URL or frontend file.

```sh
python3 scripts/product-sources.py rybbit
```

This returns current/previous complete 28-day totals, counts for all nine planned events,
missing names, attribution availability and the query parameters used. A missing event may
mean no qualifying action yet; check it against controlled validation before calling it broken.

For deeper analysis use Rybbit's [MCP](https://rybbit.com/docs/mcp) at
`https://analytics.mtorr.es/api/mcp` with a viewer/read-only key, or its REST API. The MCP has
not been installed by this change. Relevant GET endpoints:

- `/api/sites/0b9e1ee60f53/events/names`: event counts.
- `/api/sites/0b9e1ee60f53/events/properties?event_name=...`: aggregate property counts; it is
  capped at 500 key/value pairs, so do not infer a complete attempt funnel from that response.
- `/api/sites/0b9e1ee60f53/events`: cursor-paginated events. Process attempts/identities only
  in memory, deduplicate event cursors, and return aggregate findings. Page until `hasMore=false`;
  do not silently treat the first page as the entire period.

Suggested agent prompt:

> Review the last 7 complete days against the previous 7 in Europe/Madrid, starting at the
> instrumentation release cutoff. Check tracking health first. Report distinct Tour attempts
> started and reaching the end, unique-card coverage, last viewed steps, explicit exits and
> onward meaningful map use, split by Tour/version and layout. Treat missing final events as
> unknown. Review zero-result searches, learning-link choices and campaign quality. Keep
> participant identity and raw journeys in the source; return aggregates with source, dates,
> denominator, previous-window count and completeness limits. Recommend one concrete next
> change and one question to investigate with users. Do not edit settings or contact users.

The product's actual goal remains ten external engineers using a personal map in two separate
Monday–Sunday weeks by 6 January 2027. Anonymous analytics cannot establish same-person
cross-week use or target-audience membership. Keep the planned observed sessions/follow-ups;
do not replace that evidence with anonymous visitor counts or add persistent identification
without an explicit, disclosed design decision.
