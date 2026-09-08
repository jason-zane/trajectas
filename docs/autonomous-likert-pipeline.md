# Autonomous Likert instrument creation

Quick Build creates, reviews, repairs and assembles Likert forms without an external reviewer. It records a specific acceptance decision for the current form and stops with actionable blockers when it cannot satisfy the specification. AI checks do not manufacture respondent evidence.

## Author workflow

1. Open **Instruments → Quick Build**, describe the use and audience, and supply or generate the construct model.
2. Choose 4–30 items per construct, a complete active 4–7 category agreement/frequency format, recall period, reading target and reverse-key proportion (0–50%). The alpha setting is a planning goal.
3. Keep the build page open. It advances saved steps automatically. Pause stops after the current request; reopening or resuming continues from the checkpoint.
4. Inspect **AI item review** for actual selected items, polarity, reviewer reasoning and JSON evidence export. Publish becomes available when the current form passes. Publication activates the complete matching item set atomically.
5. In the assessment builder, select the published scales through the **construct** selector. Their active items and reviewed response format are available immediately. The parallel factor records retain the existing metadata-completeness and Architect recommendation rules; autonomous item review does not invent missing factor metadata or empirical calibration.

Supported measure types: traits, behavioural competencies, self-rated capability, preferences, climate and response-style/validity scales. Capability means perceived capability, not demonstrated performance. Validity-scale scores do not establish deception. SJT and forced choice are excluded from automatic creation.

## What must pass

| Level | Acceptance policy |
|---|---|
| Specification | Operational construct and facet definitions, resolved exclusion definitions, audience/context, recall, complete distinct anchors, explicit score direction |
| Blueprint | Model-generated facets independently refined by a different provider family; exact coverage targets |
| Content planning | A non-writer model specifies each candidate's action/experience, necessary condition, substantive distinction and polarity before wording; plans confer no acceptance credit |
| Item review | Three complete separate requests to three provider families; no writer key, intended assignment, prior judgments or other reviewer responses in the item payload |
| Content | At least two reviewers identify the intended construct and facet; all rate relevance and clarity at least 3/4; no unresolved major/critical issue |
| Scoring | All three infer the same polarity; raw hypothetical low/typical/high patterns must be coherent and, after keying, ordered with a span of at least two categories |
| Readability | At most 30 words and the selected Flesch–Kincaid ceiling; this is a screening heuristic, not observed comprehension |
| Selection | Exact facet-cell and construct counts, rounded reverse quota per construct, no confirmed redundant pairs |
| Form review | Pool-wide overlap scans are provisional hints. Every within-construct pair gets structured comparisons from two provider families different from the writer, using the full facet context. Each records the two actions/experiences, their relation and whether conditions are substantively equivalent. A disputed pair can receive one independent self-check per reviewer; any retained redundancy concern forces reassembly |
| Publication | Current specification/item fingerprints, complete current item reviews, current pool and final-pair evidence, exact accepted set and the reviewed response format |

These numerical thresholds are engineering policies, not externally established validity cutoffs. Separate model providers and blind requests reduce shared-context bias; they do not establish statistical independence or replace observed response processes. The reliability table gives algebraic scenarios per construct, with no simulated confidence interval or pooled multi-construct alpha.

## Automatic repair and execution

The stages are `blueprint → generate → review → diversity → select → form_review → complete`. Standard Likert blueprints allocate items directly to facets. The legacy database intensity field is stored as `mid`; it does not impose easy/medium/hard situations or claim empirical difficulty. Missing coverage, key imbalance, rejected items and overlapping wording cause targeted replenishment. Completed constructs are retained. Writer feedback includes observed item defects and the actual overlapping stems and reasons. Before wording, a non-writer model plans distinct item intents against the existing pool and observed defects. Plans are checkpointed with specification/pool hashes. Writers must return every intent index once and preserve its planned polarity; blind reviewers never see these intentions. An explicit planning coverage blocker advances to existing-pool review and bounded coverage repair, not fabricated candidates. A separate wording editor simplifies drafts that exceed the reading target before all three blind reviewers see them; editing itself grants no acceptance credit. Replacements receive new IDs; earlier versions remain in history.

The pool has six generation/review rounds. Three additional repair rounds are reserved for defects discovered by explicit final-form pair checks. All work is also bounded by 600 model calls. A preflight rejects combinations whose initial generation and exhaustive final pair checks would consume over 80% of that budget, reserving some repair headroom before incurring any model usage. If item-level repairs exhaust their budget, each failing construct can receive one automatic facet redesign within the same model-call cap. A later failing construct keeps its own opportunity for redesign, while an already repaired construct cannot repeatedly restart its budget. The original construct definitions remain fixed and changed facets invalidate the old reviews. Budgets never relax the item or form gates. A failed provider request is retried from its actual saved phase; exhausted quality budgets require a refined specification/new build.

Each request has a 105-second AI budget and a three-minute database lease. `commit_instrument_likert_step` atomically commits cells/items, the parent job revision and the step evidence. It checks lease age, job revision, current specification and item timestamps. Delayed workers, duplicate responses, concurrent edits and generation racing publication cannot overwrite a newer checkpoint. Published builds cannot regenerate. The publication step uses `activate_autonomous_likert_items` to activate all selected library items together, after rechecking the complete current AI proof and locking the job, specification, candidates and library rows. Mismatched wording, keys, formats or construct links, archived/deleted items and cognitive-item specifications block activation. Unchanged draft publications can safely retry; an unreviewed complete flag cannot authorize activation. It does not create human review ledger entries or claim a measured lifecycle stage. The functions are `SECURITY INVOKER`, have an empty search path, and are executable only by `service_role`.

The worker currently runs from the open build page, not a background queue. A closed tab pauses future work; it does not lose committed progress. Long jobs therefore require the page to stay open or be reopened.

## Review provenance and version changes

The specification and candidate identity (ID, text, cell and key) have canonical SHA-256 fingerprints. A changed definition, facet, audience, recall period, anchor or item invalidates its derived evidence. Facets are redrafted when their specification changes. Stored pass flags are insufficient: publication recomputes acceptance from the actual three reviews and verifies the persisted key.

Stage evidence records the models, specification, outputs, token usage, retries and, for new calls, exact prompts. Item, construct and final-pair requests use short batch-local IDs that are strictly mapped back to database IDs, preventing model copy errors from corrupting the audit. Pair batches retain their mapping explicitly. Both complete structured pair judgments are persisted and their combined verdict is recomputed when checking readiness. Pair evidence uses `likert-pair-v2`; older unstructured decisions cannot satisfy this gate. A failed self-check retains the complete original judgment, and self-checking is never repeated merely to obtain a desired answer. Requested and returned provider families must match. Truncated/empty responses cannot be treated as valid JSON; retries receive a larger completion allowance when truncation consumed the original limit. OpenRouter counts reasoning within the completion budget ([provider documentation](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)). No reasoning trace is collected.

AI decisions are stored in candidate payloads and instrument stage runs. They are never inserted into the append-only human `item_reviews` table. Cognitive-bank review gates remain in force. Future acceptance-policy or prompt changes must bump `LIKERT_VERSION` or the applicable `PAIR_REVIEW_VERSION` and define how existing builds are re-reviewed; do not silently reuse evidence under a changed policy. Published builds remain immutable; a new build is required to qualify their content under a newer policy.

## Reproduce the tests

Use `npm run test:unit`, `npm run test:architecture`, `npm run test:component`, `npm run typecheck`, `npm run lint`, `npm run build` and `npm run test:e2e:smoke` for application verification. Database tests must use `npm run test:integration:local`; `.env.local` can point at production.

For actual model calls, start local Supabase and apply the committed migration locally. Set `OpenRouter_API_KEY` in the shell, or set `LIKERT_ENV_FILE` to an env file containing that key. The runner reads only that key from the file and overrides database credentials with the local stack. Set `SUPABASE_BIN` if the CLI is not on PATH.

```sh
node scripts/testing/run-likert-benchmark.mjs
LIKERT_SCENARIO=traits LIKERT_ARTIFACT_DIR=output/autonomous-likert/traits node scripts/testing/run-likert-benchmark.mjs tests/benchmarks/autonomous-likert-live.test.ts
```

These opt-in benchmarks incur real model usage and create isolated local builds/library items. They never write test data to production. The default behaviour scenario tests Dependability and Behavioural Adaptability; the second tests Orderliness and Sociability. Both request two six-item constructs with four reverse-keyed items total. The authored challenge suite covers construct contamination, double-barrels, virtue claims, negation, opportunity/health proxies, idioms, preferences, climate and self-rated capability. Set `LIKERT_ITEMS_PER_CONSTRUCT` to vary the default six-item target. The model snapshot is in `tests/benchmarks/likert-models.json`; set `LIKERT_MODEL_SNAPSHOT` to use another snapshot.

To recheck an existing local published result through activation and the construct-based builder without any model calls, set `LIKERT_RESUME_BUILD` and run `tests/benchmarks/likert-published-handoff.test.ts` with the same opt-in runner. This can activate unchanged draft items produced before the activation fix; it writes only to the explicitly selected local fixture.

Artifacts default to `output/autonomous-likert` (ignored by Git). Each new invocation records its Git revision, tracked-change flag, source hashes, model snapshot and resume target in `run-manifests/`. Retain them before fixture cleanup. To resume an interrupted unpublished build, use `LIKERT_RESUME_BUILD` and the same `LIKERT_ARTIFACT_DIR`. Results are diagnostic benchmarks on authored scenarios; they are not a representative estimate of success across constructs or populations.

## Remaining measurement work

The system can autonomously produce and reject candidate instruments. Reliability, factor structure, item information, subgroup equivalence, criterion relationships and norms require actual responses. When those responses exist, use the calibration and psychometrics functions and keep each result bound to the delivered item version. Useful next engineering work is a background job runner and a larger frozen benchmark spanning construct families, anchor formats, populations and repeated runs. Neither is a human-review prerequisite for the implemented Likert workflow.
