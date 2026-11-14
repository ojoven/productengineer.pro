# ProductEngineer.pro evidence sources

Verified: 2026-11-11, approximately 20:53–21:04 UTC. Agent operations on source services were read-only: no application migrations, login, test events, settings changes, emails or installations. The owner provisioned the requested Rybbit credential. Outputs contain aggregate data; raw database/log records and replay content were not exported.

Goal supported: 10 engineers besides the owner use their personal learning map in two separate weeks by 2027-01-06. Source availability does not establish that this goal is measurable automatically.

## Category coverage

- **Product analytics: connected.** Rybbit GET queries work with the owner-provisioned credential, and the owner reconciled the current-period totals with the dashboard.
- **Database: connected.** Production SQLite queried in read-only mode over SSH.
- **Revenue: absent.** Intentionally free; the owner has no current monetization objective.
- **Feedback and support: connected + manual.** GitHub Issues is queryable but empty. The owner confirms no other feedback has been collected; use the planned interviews and follow-ups.
- **Errors and performance: connected, with gaps.** Apache and PM2 logs are readable. Browser error and Web Vitals collection are disabled in the live Rybbit configuration.
- **Acquisition: connected, with gaps.** Rybbit attribution queries and coarse Apache referrer evidence are readable. LinkedIn post data is a manual source once posts exist. No Search Console source was verified.
- **Session replay: connected.** An authenticated Rybbit listing returned one record with a requested limit of one; no recording was viewed or exported.

## Reusable checks

From `website/`, run the stdlib-only helper:

```sh
python3 scripts/product-sources.py database
python3 scripts/product-sources.py logs
python3 scripts/product-sources.py github
python3 scripts/product-sources.py rybbit
```

The helper returns only aggregate data, uses GET requests, never imports the application database initializer, and opens SQLite with `mode=ro` plus `PRAGMA query_only=ON`. Missing access returns `status: blocked` and exit code 2. Use `--end <timezone-aware ISO timestamp>` to reproduce a cutoff. Live sources can change after the proof below.

## SQLite · database · connected

**Answers:** how many accounts exist, when surviving accounts were created, and how many accounts have a latest nonempty skill status dated within a window. Accounts are not all visitors; progress writes are not all meaningful map uses.

**Access:** SSH alias `secondary`; `/var/www/html/productengineer.pro/data/productengineer.sqlite`. No database password or application OAuth credential is used. The verified schema version is 3. Read-only connection:

```python
sqlite3.connect(
    'file:/var/www/html/productengineer.pro/data/productengineer.sqlite?mode=ro',
    uri=True,
    timeout=5,
)
```

**Proof, 2026-11-11 20:58:52 UTC:**

```sh
python3 scripts/product-sources.py database --end 2026-11-11T20:55:06.993605+00:00
```

- All-time surviving accounts: **0**. All-time stored skill-status rows: **0**.
- Current rolling 28 days: `[2026-10-14 20:55:06.993, 2026-11-11 20:55:06.993)` UTC.
- Previous 28 days: `[2026-09-16 20:55:06.993, 2026-10-14 20:55:06.993)` UTC.
- Accounts created: **0 current / 0 previous**.
- Accounts with a latest nonempty progress timestamp in the window: **0 / 0**.
- Remaining sign-in-session rows created in the window: **0 / 0**.
- Denominators are rows/accounts under the query definitions, not a signup-to-activation cohort. No rate is inferred from zero accounts. Earlier windows predate the observed launch and do not establish a historical retention baseline.

The helper contains the exact SQL. For example:

```sql
SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at < ?;
SELECT COUNT(DISTINCT user_id) FROM progress
WHERE status != 'none' AND updated_at >= ? AND updated_at < ?;
```

**Caveats:** `progress` has one row per user and skill, overwritten on update. Its timestamp can originate on the client and be imported or synced later. It does not preserve an event history or prove a visit in a given week. Reviewing without changing a status is invisible. Anonymous browser-local progress is invisible to this database. Session rows expire, can be removed at logout, and are not a durable login history. User updates, account linking and account deletion also affect current state. Do not count repeat learners from these fields alone. Owner/test-account exclusions still need an agreed method once accounts exist.

Official reference: [SQLite read-only URI connections](https://www.sqlite.org/uri.html). Implementation: `server/src/db.ts`, `server/src/users.ts`, `server/src/account.ts`, `src/scripts/progress.ts`, `src/scripts/sync.ts`.

## Rybbit · product analytics · connected

**Answers:** visitors, sessions, pageviews and available custom events, plus the basis for later page/journey analysis. The owner confirmed Rybbit is the analytics source to use. [reported: owner, 2026-11-11]

**Access:** `https://analytics.mtorr.es`, public tracking site identifier `0b9e1ee60f53`. The live `/` and `/me/` pages returned HTTP 200 and loaded `/api/script.js?siteId=0b9e1ee60f53` on this host. The source is in `src/layouts/Base.astro`. The old optional Plausible component remains in the repo but no Plausible script or inline queue was observed in those live pages.

No Rybbit MCP tools are connected in this session, and plugin discovery returned no matching Rybbit connector. Rybbit's official MCP endpoint is `https://analytics.mtorr.es/api/mcp` where supported by the installed version; it has not been configured or authenticated here. The prepared HTTP GET path is sufficient for the initial checks and does not require installing a provider.

**Access credential:** `PRODUCTENGINEER_RYBBIT_API_KEY` in the environment or gitignored `website/.env.sources`; the owner supplied it after being asked for only `sites:read`, `analytics:read`, `sessions:read`, `events:read`, `replay:read`. The helper uses a Bearer header against the fixed analytics host and never prints the credential. The public tracking identifier works directly in the verified endpoints. No MCP installation or additional analytics provider was needed.

**Proof, 2026-11-11 21:04:14 UTC:**

```sh
python3 scripts/product-sources.py rybbit
```

Read endpoints: `/api/sites/0b9e1ee60f53/overview` and `/events/names`, with `start_date`, `end_date` and `time_zone=Europe/Madrid`.

- Current complete 28 local days, **2026-10-14 through 2026-11-10 inclusive:** **8 visitors, 9 sessions, 27 pageviews**; **0 custom-event names / 0 occurrences**.
- Previous complete 28 local days, **2026-09-16 through 2026-10-13 inclusive:** **0 visitors, 0 sessions, 0 pageviews**, **0 custom-event names / 0 occurrences** returned by the API. This predates the observed launch; it is not a growth or retention baseline.
- A separate event-name diagnostic extending the end date through **2026-11-11's partial day** also returned **0 names / 0 occurrences**. It is separate from the complete-day comparison.
- The owner confirmed that **8 / 9 / 27 matches the dashboard** for the same dates and timezone. [reported: owner, 2026-11-11]
- Denominators are the API's distinct visitors, sessions and pageview events. These are counts, not an eight-person target-user cohort or confirmed external engineers.

For an exact date cutoff, the helper also accepts `--end 2026-11-11T21:04:14+00:00`. Complete local-day analytics windows differ from the rolling UTC database proof; align them before cross-source comparison. There is no received signup event to reconcile directly with account creation; visitors and accounts measure different stages.

**Credential renewal, if needed:** use Rybbit **Settings → Account → Personal API Keys** and the read scopes above. If a future installation cannot restrict scopes, use a viewer-only account. Keep the variable in the environment/ignored file rather than chat, source control or URL query parameters.

**Caveats:** no `rybbit.identify()` or equivalent bridge from the logged-in account was found in app source. The tracker has its own anonymous identity mechanism; it must not be treated as a verified count of the same engineers across weeks or devices. Ad blockers, owner/test traffic and unverified target-audience membership also affect interpretation. Eight visitors is compatible with zero accounts because sign-in is optional.

**Tracking gap:** `src/scripts/track.ts` calls `window.plausible`, while the live tracker exposes Rybbit and no Plausible bridge was found. The named status, map and account events therefore have no observed route into the installed provider. The successful API read found no custom events through today; that is consistent with the source mismatch, although absence of events alone would not establish its cause. This run did not change instrumentation or send test events. Pageview collection does work independently.

References: [Rybbit API authentication and read scopes](https://rybbit.com/docs/api/getting-started), [overview endpoint](https://rybbit.com/docs/api/overview/overview), [MCP](https://rybbit.com/docs/mcp), [user identification](https://rybbit.com/docs/identify-users).

## Rybbit · session replay · connected

**Answers:** whether replay records exist; later walkthroughs can use authorized recordings to investigate friction. No individual recording was opened or exported in this run.

**Access:** same host/key, with `replay:read`; `GET /api/sites/:site/session-replay/list`. The helper requests at most one replay record and emits only the returned count, not identifiers, URLs, content or personal traits. That probe is not a total replay count.

**Proof, 2026-11-11 21:04:14 UTC:** the public tracking config returned `sessionReplay: true`; the authenticated listing returned **one record with limit 1**, for 2026-10-14 through 2026-11-10 inclusive in Europe/Madrid. This establishes recording availability, not a total replay count, full coverage or a comparison with the preceding period.

**Caveats:** replay alone does not establish learning, target-audience membership or cross-week identity. The planned observed sessions remain useful for understanding the learner's situation and reasons.

Reference: [Rybbit replay listing](https://rybbit.com/docs/api/session-replay/list).

## GitHub Issues · feedback and support · connected

**Answers:** reports filed as issues and comments in the website and companion-skills repositories. Neither repository has Discussions enabled in the queried metadata.

**Access:** existing `gh` CLI; read-only calls to GitHub's repository metadata and issues APIs. The helper pages through all issues and excludes pull requests, which share the API endpoint.

```sh
python3 scripts/product-sources.py github
```

**Proof, 2026-11-11 20:58:52 UTC:** `ojoven/productengineer.pro` and `ojoven/product-engineering-skills` each returned **0 all-time issues, 0 open, 0 closed and 0 comments**. These are counts across all returned issue records. There is no previous saved snapshot for comparison. Empty accessible sources are still connected; this does not establish an absence of feedback elsewhere.

The owner confirmed the zero production accounts, zero saved skill statuses and empty issue trackers match their expectations. [reported: owner, 2026-11-11]

**Caveats:** people who never file an issue are absent. Issue totals are not distinct-user counts. Identities and raw feedback stay at the source; later digests should use segment labels and sanitized quotes.

Reference: [GitHub repository issue API](https://docs.github.com/en/rest/issues/issues#list-repository-issues).

## Interviews and weekly follow-ups · feedback and support · manual

**Answers:** whether target engineers share the need, understand the map, find personal statuses useful and return in a later week.

**Access:** the owner runs the approved five-person interview round using the guide in `PRODUCT.md`. On 2026-11-11 the owner confirmed that no other feedback has been collected yet and selected the planned interviews as the starting source. No support inbox, survey, community, spreadsheet or interview repository needs connecting at present. [reported: owner, 2026-11-11]

**Proof:** **no external participant observations exist yet according to the owner**; this is reported, not a query-backed measurement of all possible comments. The owner's own brief interview is intent evidence, not external product validation.

**Minimum collection:** retain participant contacts and original notes in the chosen external research source. Record when each person first used the map, what happened, any assistance, the later-use date and action, and whether a return was spontaneous or prompted. Follow up after 7–10 days. Export only aggregates or sanitized segment-level journeys for agent analysis. A stated intention to return, email open or scheduled coached session does not demonstrate independent return use.

For a later digest, put sanitized exports in `docs/product/evidence/imports/`; this path is gitignored. Include source, collection window, participants invited/observed/followed up, concrete actions and what is unknown. Do not treat differently anonymized records as new people. Until this produces evidence, the 10-repeat-learner goal remains unvalidated.

## Apache and PM2 · errors and performance · connected

**Answers:** HTTP response failures and server-side diagnostic coverage. These are operational logs, not a frontend product funnel.

**Access:** SSH `secondary`; Apache requires existing noninteractive `sudo` for reads. The helper aggregates `/var/log/apache2/productengineer-access.log*` and `productengineer-error.log*` on the server and never returns raw requests, IP addresses, querystrings or user-agent strings. PM2 logs were read under `/home/ubuntu/.pm2/logs/productengineer-api-*-6.log`.

```sh
python3 scripts/product-sources.py logs --end 2026-11-11T20:56:00.721705+00:00
```

**Proof, 2026-11-11 20:58:52 UTC:** the current access file covered timestamps from **2026-11-10 15:35:16 UTC**, so it does not cover a complete 28-day period. In the current proof window it contained **12,145 requests**, excluding four tagged source-check requests: **9,297 2xx, 1,372 3xx, 1,476 4xx**; denominator 12,145 request lines. All inspected access lines parsed. Previous-window traffic is **unavailable**, not zero. The available error file contained **222 lines** at the later check; its dated comparison was not computed. PM2's current error file had **0 lines** and stdout file **10 lines** at 20:55 UTC; these files had no timestamped lines or proven rotation history, so no error rate or trend is inferred.

Public read-only checks also returned HTTP 200 for `/api/health` and `/api/auth/providers`; the configured providers were GitHub and Google. These checks did not authenticate a user or create an account.

**Caveats:** bots, scanners, assets, redirects and internal testing are included. Zero PM2 stderr lines does not mean a successful user journey. HTTP 4xx and Apache diagnostics must be classified before calling them product defects. No synthetic uptime schedule, frontend error feed or real-user performance result was verified.

The live Rybbit public configuration returned `trackErrors: false` and `webVitals: false`. This records current collection settings; no setting was changed.

Reference: [Apache combined access and error logs](https://httpd.apache.org/docs/2.4/logs.html).

## Apache / Rybbit / LinkedIn · acquisition · connected / connected / manual

**Answers:** Apache gives coarse referrer evidence per HTTP request; Rybbit provides an authenticated attribution query path. LinkedIn post statistics and replies supply acquisition context for the initial channel.

**Access and proof:** the same verified Apache command returned, among 12,145 request lines, **3,480 self-referrers, 8,657 no/invalid referrer, 7 search referrers and 1 other external referrer**; **0 LinkedIn-tagged request referrers in the available file/window**. Prior-window coverage is unavailable. These are requests including bots/assets, not visitors, campaign results or evidence that a LinkedIn campaign has run.

Rybbit's public config returned `trackUrlParams: true`, `trackOutbound: true`, `trackInitialPageView: true`, `trackSpaNavigation: true`. On 2026-11-11 21:04 UTC, authenticated `/api/sites/0b9e1ee60f53/metric?parameter=referrer&limit=100&page=1` returned an empty referrer breakdown for both complete 28-day windows above; the aggregate overview still had 8 visitors / 9 sessions / 27 pageviews in the current window. Empty dimension rows do not mean zero visitors or proven zero acquisition. No Google/Bing Search Console reporting connection was verified; this is not proof that the owner has no account.

**Manual collection:** keep each LinkedIn post URL, date and its impressions/clicks/relevant replies in the original source; send an aggregate snapshot when assessing distribution. No LinkedIn reporting connector is currently configured for this product. Suggested campaign link for the first post:

```text
https://productengineer.pro/?utm_source=linkedin&utm_medium=social&utm_campaign=map-validation&utm_content=first-invite
```

**Caveats:** a missing referrer is not necessarily direct acquisition. Tagged campaign parameters need received-data verification. Posts, outreach and campaign/settings changes remain outside this read-only run.

## Revenue · revenue · absent

No checkout, payment SDK, subscription tables or billing webhooks were found in the client/server dependency and executable-source sweep. Free access and no current monetization objective are owner-reported decisions. Paying users and revenue are **not applicable**, not measured zero from a payment provider. No revenue integration is needed for the present goal.

## Configuration and access inventory

- Product repositories: `website/` and `skills/`. No mobile app or CI configuration directory was found in these repositories.
- Available relevant CLIs: `gh`, `ssh`, `sqlite3`, `python3`, `curl`, `psql`, `node`, `journalctl`. `stripe` and `sentry-cli` were absent. Only SSH/Python, `gh` and read-only HTTPS were needed.
- No connected Rybbit/Plausible/PostHog/Sentry tools were exposed in the session. Unrelated connected services were not queried for this product.
- Local `server/.env.example`, gitignored `server/.env.production`, and remote `server/.env`: variable names `PUBLIC_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Only names were returned; OAuth credentials were not used for evidence queries.
- Application/runtime config: `NODE_ENV`, `PORT`, `HOST`, `DB_PATH`; optional config reads also include `ATLAS_PATH`, `DEV_LOGIN`, `TRUST_PROXY`.
- Deploy config: `REMOTE_HOST`, `REMOTE_DIR`, `REMOTE_DATA_DIR`, `SITE_DOMAIN`, `SITE_CONF_NAME`, `SSL_CONF_NAME`, `PM2_APP`, `API_PORT`, `DEPLOY_ROOT`. `APACHE_LOG_DIR` names the web-server log directory. Shell-local variables are implementation details, not evidence-provider credentials.
- Optional build-time analytics variables: `PUBLIC_ANALYTICS_SRC`, `PUBLIC_ANALYTICS_DOMAIN`. The explicit live Rybbit script is separate from this optional Plausible-compatible component.
- Source-query credential: `PRODUCTENGINEER_RYBBIT_API_KEY`, supplied by the owner and successfully used for GET reads. `website/.env.sources` is ignored by the existing `.env.*` rule. No credential value was returned to the conversation or stored in tracked files.
- No installed tag manager, event router, feedback widget, email sender, billing integration or feature-flag SDK was detected in executable app code. Atlas resource/tool catalogs mention many such services as learning resources; those references are not installations. Rybbit's public feature-flag setting is disabled.

## Gaps and cheapest next checks

1. **Repeat use cannot yet be counted reliably:** Rybbit analytics, attribution and replay reads now work, and current aggregate totals reconcile with the owner's dashboard. Begin with dated participant follow-ups and label prompted versus spontaneous use. A later `audit-analytics` should verify stable cross-week identity and a meaningful map-review/status event. Current state and raw pageviews cannot prove the agreed goal.
2. **Custom event route is mismatched:** the received event-name list is empty through today, and the app helper targets Plausible. Propose a small tracking-adapter change and received-event verification in a separate implementation task. This run did not change instrumentation.
3. **External feedback not collected:** run the approved interviews and retain concrete actions and reasons. No paid helpdesk, replay installation or survey platform is required to start.
4. **Absent frontend errors/performance feed:** use the connected server logs initially. If first sessions show relevant failures, propose narrowly enabling the existing Rybbit capability and verifying the resulting data in a separate task.
5. **Attribution detail and absent verified Search Console / email reporting:** the referrer breakdown is empty despite nonzero overview traffic. Use tagged LinkedIn links and verify their appearance before interpreting channel performance. Search/email data cannot currently answer organic discovery or weekly-email delivery questions; prioritize the selected LinkedIn/interview route. Revenue integration is intentionally out of scope.
