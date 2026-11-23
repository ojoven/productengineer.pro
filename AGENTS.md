# Reports

- Give routine findings in the conversation. Do not create Canvas reports or `.canvas.tsx` files.
- When a standalone report is needed, create a browser-accessible HTML page and provide its URL or opening instructions.

# Rybbit analytics

- For every new or changed user-facing feature, decide whether existing events answer adoption, success and failure/drop-off questions. Add a semantic event only for a concrete measurement gap, and update `docs/analytics.md`.
- Use the shared adapter in `src/scripts/track.ts`. Add fixed event names and allowlisted string/number properties there; never call another collector, add an independent SDK, or use generic click events to claim success.
- Fire from the confirmed state transition. Cover keyboard, touch, resumes and outgoing links; exclude no-ops, sync rehydration and duplicate completions. Verify meaningful outcomes, not just that a click handler ran.
- Keep credentials, account IDs, names, emails, raw search text, OAuth parameters and private skill statuses/maps out of analytics. Preserve the URL allowlist and opt-out behavior. Do not enable replay or persistent identification as a side effect of a feature.
- Development, staging, preview and agent runs must not send to the production collector. Use the isolated Playwright collector in `tests/analytics-browser.mjs` for browser validation.
- Run the relevant unit tests, type check and isolated browser checks. In the implementation summary, describe event changes or why existing tracking is sufficient; distinguish local validation from verified production receipt.
