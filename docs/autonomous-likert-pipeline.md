# Autonomous Likert instrument creation

Quick Build creates, reviews, repairs and assembles Likert forms without an external reviewer. It records a specific acceptance decision for the current form and stops with actionable blockers when it cannot satisfy the specification. AI checks do not manufacture respondent evidence.

## Author workflow

1. Open **Instruments → Quick Build**, describe the use and audience, and supply or generate the construct model.
2. Choose 4–30 items per construct, a complete active 4–7 category agreement/frequency format, recall period, reading target and reverse-key proportion (0–50%). The alpha setting is a planning goal.
3. Keep the build page open. It advances saved steps automatically. Pause stops after the current request; reopening or resuming continues from the checkpoint.
4. Inspect **AI item review** for actual selected items, polarity, reviewer reasoning and JSON evidence export. Publish becomes available when the current form passes.

Supported measure types: traits, behavioural competencies, self-rated capability, preferences, climate and response-style/validity scales. Capability means perceived capability, not demonstrated performance. Validity-scale scores do not establish deception. SJT and forced choice are excluded from automatic creation.

## What must pass

| Level | Acceptance policy |
|---|---|
| Specification | Operational construct and facet definitions, resolved exclusion definitions, audience/context, recall, complete distinct anchors, explicit score direction |
| Blueprint | Model-generated facets independently refined by a different provider family; exact coverage targets |
| Item review | Three complete separate requests to three provider families; no writer key, intended assignment, prior judgments or other reviewer responses in the item payload |
| Content | At least two reviewers identify the intended construct and facet; all rate relevance and clarity at least 3/4; no unresolved major/critical issue |
| Scoring | All three infer the same polarity; raw hypothetical low/typical/high patterns must be coherent and, after keying, ordered with a span of at least two categories |
| Readability | At most 30 words and the selected Flesch–Kincaid ceiling; this is a screening heuristic, not observed comprehension |
| Selection | Exact facet-cell and construct counts, rounded reverse quota per construct, no confirmed redundant pairs |
| Form review | Pool-wide overlap scans are provisional hints. Every within-construct pair gets explicit judgments from two provider families different from the writer; either reviewer can flag redundancy and force reassembly |
| Publication | Current specification/item fingerprints, complete current item reviews, current pool and final-pair evidence, exact accepted set and the reviewed response format |

These numerical thresholds are engineering policies, not externally established validity cutoffs. Separate model providers and blind requests reduce shared-context bias; they do not establish statistical independence or replace observed response processes. The reliability table gives algebraic scenarios per construct, with no simulated confidence interval or pooled multi-construct alpha.

## Automatic repair and execution

The stages are `blueprint → generate → review → diversity → select → form_review → complete`. Standard Likert blueprints allocate items directly to facets. The legacy database intensity field is stored as `mid`; it does not impose easy/medium/hard situations or claim empirical difficulty. Missing coverage, key imbalance, rejected items and overlapping wording cause targeted replenishment. Completed constructs are retained. Writer feedback includes observed item defects and the actual overlapping stems and reasons. A separate wording editor simplifies drafts that exceed the reading target before all three blind reviewers see them; editing itself grants no acceptance credit. Replacements receive new IDs; earlier versions remain in history.

The pool has six generation/review rounds. Three additional repair rounds are reserved for defects discovered by explicit final-form pair checks. All work is also bounded by 600 model calls. A preflight rejects combinations whose initial generation and exhaustive final pair checks would consume over 80% of that budget, reserving some repair headroom before incurring any model usage. If item-level repairs exhaust their budget, one automatic redesign of the failing facets is allowed within the same model-call cap. The original construct definitions remain fixed and changed facets invalidate the old reviews. Budgets never relax the item or form gates. A failed provider request is retried from its actual saved phase; exhausted quality budgets require a refined specification/new build.

Each request has a 105-second AI budget and a three-minute database lease. `commit_instrument_likert_step` atomically commits cells/items, the parent job revision and the step evidence. It checks lease age, job revision, current specification and item timestamps. Delayed workers, duplicate responses, concurrent edits and generation racing publication cannot overwrite a newer checkpoint. Published builds cannot regenerate. The functions are `SECURITY INVOKER`, have an empty search path, and are executable only by `service_role`.

The worker currently runs from the open build page, not a background queue. A closed tab pauses future work; it does not lose committed progress. Long jobs therefore require the page to stay open or be reopened.

## Review provenance and version changes

The specification and candidate identity (ID, text, cell and key) have canonical SHA-256 fingerprints. A changed definition, facet, audience, recall period, anchor or item invalidates its derived evidence. Facets are redrafted when their specification changes. Stored pass flags are insufficient: publication recomputes acceptance from the actual three reviews and verifies the persisted key.

Stage evidence records the models, specification, outputs, token usage, retries and, for new calls, exact prompts. Item, construct and final-pair requests use short batch-local IDs that are strictly mapped back to database IDs, preventing model copy errors from corrupting the audit. Requested and returned provider families must match. Truncated/empty responses cannot be treated as valid JSON; retries receive a larger completion allowance when truncation consumed the original limit. OpenRouter counts reasoning within the completion budget ([provider documentation](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)). No reasoning trace is collected.

AI decisions are stored in candidate payloads and instrument stage runs. They are never inserted into the append-only human `item_reviews` table. Cognitive-bank review gates remain in force. Future acceptance-policy or prompt changes must bump `LIKERT_VERSION` and define how existing builds are re-reviewed; do not silently reuse evidence under a changed policy.

## Reproduce the tests

Use `npm run test:unit`, `npm run test:architecture`, `npm run test:component`, `npm run typecheck`, `npm run lint`, `npm run build` and `npm run test:e2e:smoke` for application verification. Database tests must use `npm run test:integration:local`; `.env.local` can point at production.

For actual model calls, start local Supabase and apply the committed migration locally. Set `OpenRouter_API_KEY` in the shell, or set `LIKERT_ENV_FILE` to an env file containing that key. The runner reads only that key from the file and overrides database credentials with the local stack. Set `SUPABASE_BIN` if the CLI is not on PATH.

```sh
node scripts/testing/run-likert-benchmark.mjs
LIKERT_SCENARIO=traits LIKERT_ARTIFACT_DIR=output/autonomous-likert/traits node scripts/testing/run-likert-benchmark.mjs tests/benchmarks/autonomous-likert-live.test.ts
```

These opt-in benchmarks incur real model usage and create isolated local builds/library items. They never write test data to production. The default behaviour scenario tests Dependability and Behavioural Adaptability; the second tests Orderliness and Sociability. Both request two six-item constructs with four reverse-keyed items total. The authored challenge suite covers construct contamination, double-barrels, virtue claims, negation, opportunity/health proxies, idioms, preferences, climate and self-rated capability. Set `LIKERT_ITEMS_PER_CONSTRUCT` to vary the default six-item target. The model snapshot is in `tests/benchmarks/likert-models.json`; set `LIKERT_MODEL_SNAPSHOT` to use another snapshot.

Artifacts default to `output/autonomous-likert` (ignored by Git). Retain them before fixture cleanup. To resume an interrupted unpublished build, use `LIKERT_RESUME_BUILD` and the same `LIKERT_ARTIFACT_DIR`. Results are diagnostic benchmarks on authored scenarios; they are not a representative estimate of success across constructs or populations.

## Remaining measurement work

The system can autonomously produce and reject candidate instruments. Reliability, factor structure, item information, subgroup equivalence, criterion relationships and norms require actual responses. When those responses exist, use the calibration and psychometrics functions and keep each result bound to the delivered item version. Useful next engineering work is a background job runner and a larger frozen benchmark spanning construct families, anchor formats, populations and repeated runs. Neither is a human-review prerequisite for the implemented Likert workflow.
