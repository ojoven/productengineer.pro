# ProductEngineer.pro

Last reviewed: 2026-11-11 · Stage: pre-launch [reported: owner, no known external users; site is public]

Working draft: interview in progress. The owner has confirmed the initial user, job, sources of value, desired weekly review, free model, initial LinkedIn channel and dated adoption goal. Channel reach and resource limits remain open. The atlas is the core learning product; companion agent skills and future editorial experiments can support it. Their place in a shared proposition remains unverified. [reported: owner, interview 2026-11-11, n=1; assumed: role of companion skills]

## User
Initial primary user: an experienced software engineer responsible for a live product or side project, already doing product work and wanting a more deliberate way to experiment, practice and learn. The owner identifies themself as this user: “I realized that I was doing many of these things (but not all) in an unstructured way.” Their current alternative is their own unstructured practice; specific tools and sources have not been established. [reported: owner, interview 2026-11-11, n=1]

Whether this situation and need extend to a reachable audience beyond the owner remains unverified. [assumed; ledger 1]

The homepage addresses experienced engineers broadening their product judgment. The agent-skills page addresses solo builders and small teams working inside a product's repository. These are stated audiences, not evidence of demand. [observed: source review 2026-11-11, `src/pages/index.astro`, `src/pages/skills.astro`]

## Job
Owner-accepted wording: “I’m responsible for more than the code. Help me identify what I’m missing and apply it to the product problem in front of me.” [reported: owner, interview 2026-11-11, n=1]

The desired progress is to professionalize experimentation, practice and learning. The reported trigger was recognizing the breadth of product work already being done without a structure. The owner clarified that the learning map is sufficient value by itself: understand the discipline, see how skills relate, assess where they stand and see progress over time. Applying the learning in an experiment is optional. Frequency, the cost of the current approach and a specific recent episode remain unverified. [reported: owner, interview 2026-11-11, n=1; assumed: frequency and cost]

## Market
The atlas overlaps developer learning references and product-engineering education. Roadmap.sh offers developer roadmaps, guides and courses; PostHog publishes a Product Engineer Handbook covering skills, working practices and getting started. Their existence establishes alternatives, not demand for this project or a market-size estimate. [observed: primary websites reviewed 2026-11-11]

Sources: [roadmap.sh](https://roadmap.sh/), [PostHog Product Engineer Handbook](https://posthog.com/product-engineer/what-is-a-product-engineer).

Proposed positioning to test: a free learning map for experienced engineers who want to understand the whole of product engineering, see where they stand and guide their development. Connected skills, curated resources and visible personal progress are the core proposition. Editorial experiments can illustrate the discipline. Differentiation and reachable audience size remain unverified. Willingness to pay is outside the current scope. [reported: owner, interview 2026-11-11, n=1, intended value and free model; assumed: positioning and market response, ledger 3]

## Value moment
First value: zooming out and gaining a clear mental map of what product engineering means, what it involves and how its skills relate. Further value comes from setting skill statuses and seeing personal progress. These are the owner's reported sources of value; external user behavior has not been observed. [reported: owner, interview 2026-11-11, n=1]

Marked by: initial exploration that helps the user understand the discipline and its connections; a second observable milestone is setting skill statuses and viewing the resulting personal map. For external validation, watch exploration and ask plainly what was useful. Status changes are engagement proxies rather than proof of competence. Typical time from first visit: unknown; value is intended to begin on initial exploration. [reported: owner, interview 2026-11-11, n=1; assumed: external validation, ledger 2]

The current local frontend supports browser-local progress and optional GitHub/Google login for synced progress. This is a source observation, not a verified production walkthrough or evidence that anyone uses accounts. [observed: `src/pages/me.astro`, `src/scripts/progress.ts`, refreshed source review 2026-11-11]

## Return
Desired cadence: a short weekly review, possibly delivered by email after login. The owner welcomes this rhythm; actual return behavior has not been measured. [reported: owner, interview 2026-11-11, n=1]

Proposed review content: revisit skills being learned, reflect on progress, update statuses where appropriate and choose a next learning focus. Whether email prompts useful reviews and whether accounts are needed for this experience remain untested. This interview records a possible direction and does not establish that an email flow exists. [assumed; ledger 4]

## Model
Current model: a free public resource that supports learning, including the owner's own learning, and builds the owner's professional reputation. There is no current monetization objective. [reported: owner, interview 2026-11-11, n=1]

Who pays: no paying customer is planned for the current resource. Cost to serve, editorial time and acquisition cost remain unknown. The professional return on this investment has not been measured. [reported: owner, current free model; assumed: costs and professional payoff, ledger 5]

Possible future direction: if a community develops, the owner might consider a subscription for an LLM-guided learning platform. This is an option, not a present commitment or a reason to add paid-platform features now. [reported: owner, interview 2026-11-11, n=1]

## Distribution
Current acquisition channels and their shares: unknown. No `sources.md` or connected product evidence is documented. LinkedIn images exist in the parent workspace and the website plan mentions sharing maps there; neither establishes actual reach or acquisition. [observed: workspace and `PLAN.md`, 2026-11-11]

Initial channel: LinkedIn, accepted by the owner. Proposed approach: share useful views of the discipline, skill connections and editorial examples, linking to the corresponding map or learning resource. Existing audience size, relevant responses and publishing language were not established by the owner's “Yes”; they remain unknown. [reported: owner, channel choice, interview 2026-11-11, n=1; assumed: approach and reach, ledger 6]

The proposed weekly email serves existing learners and return use. Acquisition still needs a way for the initial audience to discover the map. [assumed: channel roles; reported: owner, interest in weekly email]

## Goal
Purpose: support learning and build the owner's professional reputation through a useful free resource. [reported: owner, interview 2026-11-11, n=1]

Agreed outcome: **By 6 January 2027, 10 engineers besides the owner have used their personal learning map in at least two separate weeks.** [reported: owner, goal accepted in interview 2026-11-11]

Metric: distinct target engineers, excluding the owner and internal/test activity, with meaningful use of their personal map in at least two distinct Monday–Sunday weeks in Europe/Madrid between 11 November 2026 and 6 January 2027. A review of marked skills, a status update, or using the map to choose or revisit learning qualifies. A page load, login or email open alone does not establish meaningful use. This operational definition is a working proposal. [assumed: counting rules]

Now: no known external users, according to the owner; **zero confirmed qualifying learners**, not a measured zero for traffic or all actual use. No analytics or database count was queried. Target: 10 by 2027-01-06. Prior window: unavailable. [reported: owner, interview 2026-11-11; assumed: evidence coverage]

Inputs: target engineers reached, first personal-map uses, return uses in a later week. Also review the number of returning learners each week, which can fall even while the cumulative milestone rises. Tag prompted and spontaneous returns separately; both can contribute when actual use occurs. Reputation is a secondary qualitative signal, captured through relevant independent recommendations, mentions and conversations. [assumed: operational measurement, ledger 7]

## Constraint
Immediate constraint hypothesis: getting the first relevant engineers to try the map and learning whether they find a reason to return. The owner reports no known external users, so there is no observed funnel drop-off to diagnose yet. Existing source work already provides a learning map; further feature building has not been shown to be the prerequisite for adoption. [reported: owner, no known external use; assumed: constraint, ledger 8]

The website history and companion-skills history inspected contain commits dated 2026-11-10. The website working tree also contains unfinished or uncommitted AI-learning and account/MCP work. This shows implementation activity, not adoption. [observed: local git history and working tree, 2026-11-11]

## Limits
Time: unknown hours per week. Team: not confirmed. Money: budget unknown; current model has no revenue objective. Deadline: adoption milestone on 2027-01-06; no separate launch deadline confirmed. Proposed working limit for confirmation: 2–3 hours per week, solo, organic distribution and existing tooling. [reported: owner, model and goal date; assumed: capacity and spending, ledger 9]

## Non-goals
The atlas describes itself as a proposed framework and self-assessment rather than a certification. The README says there are no learning paths or background-based sequences. Whether these remain strategic limits needs confirmation. [observed: `README.md`, `src/pages/about.astro`]

The core learning experience does not require running or recording experiments on a real product. Editorial experiments are intended as a possible enhancement. [reported: owner, interview 2026-11-11, n=1]

No monetization work is planned in the current scope. A community and paid LLM-guided learning platform are possible future directions, not current deliverables. [reported: owner, interview 2026-11-11, n=1]

Other audiences and work explicitly excluded for the next phase: empty, pending the limits round. [assumed; ledger 9]

## Taste
Draft principles drawn from existing content:

- Prefer a few useful practitioner and primary sources, with checked links, over filling a quota. [observed: `src/pages/about.astro`]
- Make the breadth of product engineering and the relationships between skills understandable; make personal progress visible. [reported: owner, interview 2026-11-11, n=1]
- Offer practice and examples as ways to deepen learning. [observed: current AI collection and `src/components/SkillPractice.astro`; reported: owner, editorial experiments as an enhancement]
- Make uncertainty explicit and preserve product context between agent sessions. [observed: `src/pages/skills.astro`]
- Keep the reference useful without requiring an account. [observed: current frontend; owner's long-term preference unconfirmed]

## Ledger
| # | Assumption | What rests on it | Cheapest check | Status |
| --- | --- | --- | --- | --- |
| 1 | Other experienced engineers owning products share the owner's need for a coherent view of product engineering and a way to guide their learning. | Audience beyond the owner and positioning. | Inspect recent learning needs from three other engineers in this situation and the approaches they already use. | open; owner's own need reported |
| 2 | Exploring the map clarifies the discipline and its connections; personal skill statuses help users understand where they stand. | Value moment and useful first-session criteria. | Watch three target engineers explore and mark their maps; ask what became clearer and which learning gap they identified. | open; value reported by owner |
| 3 | Connected skills, curated resources and visible personal progress provide a reason to choose this over existing learning references. | Market position and adoption. | Ask three target engineers to use this and their current alternative for the same learning question; inspect their choice and reason. | open |
| 4 | A short weekly learning review creates a sustainable reason to return, and email is a useful prompt. | Retention and any account/email investment. | Test the review with a few willing learners over two weekly cycles and observe useful returns before automating it. | open; cadence desired by owner |
| 5 | Publishing and maintaining a useful free resource meaningfully builds the owner's professional reputation. | The owner's return on time and spending. | Record relevant inbound conversations, recommendations and independent mentions attributable to the resource; review against the agreed time budget. | open; reputation and learning purpose confirmed, no current monetization |
| 6 | The owner can reach the chosen audience through LinkedIn. | Initial distribution. | Establish existing relevant audience and responses, then test one useful map example with a traceable link. | open; LinkedIn selected, reach unverified |
| 7 | The proposed meaningful-use rules accurately capture repeat value, and the evidence can identify qualifying learners across weeks. | Trustworthy progress toward the agreed target of 10 by 2027-01-06. | Start with dated, anonymized participant observations or concrete follow-up evidence; connect and inspect analytics/account data before automating counts. | open; goal and date agreed |
| 8 | Audience/job validation is the limiting factor rather than a demonstrated funnel drop-off. | Next investment of time. | Review any existing user journeys and feedback; if none, observe the first three attempts. | open |
| 9 | The proposed scope and validation work fit the owner's available time, team and budget. | Feasibility and non-goals. | Confirm weekly capacity, spending limit and deadlines. | open |

## First validation round
Proposed approach, not work already conducted. These are small-sample learning checks, not a market-size estimate or proof of product-market fit. [assumed: plan, ledger 1–4, 6–8]

1. **Recruit five likely users through LinkedIn.** Seek experienced engineers with responsibility for a product and a current interest in broadening their product skills. Include people beyond close friends where feasible. A draft invitation: “I built a free map of product engineering for engineers who want to understand the whole discipline and see where they stand. I’m looking for five people to try it for 20 minutes and tell me what helps or confuses them.” The owner sends or publishes it; this task has not contacted anyone.
2. **Observe a 20-minute first use.** Ask how they last chose something to learn and what they used. Then ask them to use the site to understand the discipline and see where their own skills fit, thinking aloud. Avoid a tour or instructions on where to click. Notice whether they can explore, find relevant resources, and express their own skill statuses. Ask “What, if anything, became clearer?” and “What felt missing or confusing?” Record assistance, friction and concrete usefulness separately from compliments.
3. **Check return after 7–10 days.** Ask whether they used it again and what they did. If a participant wants a weekly review prompt, try one manually through their agreed channel, then observe use. Label returns as spontaneous, prompted or coached. An email open or “I plan to return” is not repeat use. Avoid turning a forced second research session into apparent independent retention.
4. **Interpret and expand.** If most first users need a tour, address the observed comprehension or navigation problem. If they understand the map but find no reason to use it again, investigate that before investing in automated email or more content. Repeated concrete value is a reason to continue recruiting toward the 10-learner goal; the first five alone cannot achieve that target. Share useful map views and observed learning lessons on LinkedIn with links back to the relevant pages.

Record counts of people invited, first meaningful users and later-week users, plus segment-level observations, dates, evidence type and whether prompted. Keep names, emails and other identifiers in the external research source; only aggregates or anonymized journeys enter this workspace. Manual follow-up evidence is sufficient to start; account rows and latest skill statuses alone may not establish use in two separate weeks. [assumed: measurement plan; observed: current data model and optional analytics integration]

Method reference: [GOV.UK moderated usability testing](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing) recommends relevant tasks, observing likely users and neutral instructions; [planning user research](https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service) recommends small rounds matched to specific research questions. The sample, timing and decisions above are project-specific proposals.
