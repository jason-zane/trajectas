# Jev competency-matching engine — implementation design (2026-09-22)

Evidence: `docs/evals/2026-09-22-jev-competency-matching.md` and
`docs/evals/2026-09-22-jev-pipeline-redesign.md`. This document is the build spec.
Deliberately out of scope for v1: the per-factor correction table (waits on the final
competency model), progressive loading of reasons in the UI, category-balance rules.

## Goal

Replace the LLM ranking step of competency matching with TypeSafe's Jev decision model
while keeping every existing contract (`MatchingOutput`, `ArchitectMatchResult`,
`public_builds.ranking`) intact, so the public Role Builder and the admin Architect both
get it behind one runtime switch, with an automatic fallback to the current LLM path.

## Runtime switch

`ai_model_configs.model_id` for purpose `competency_matching`:

- starts with `typesafe/` (or `~typesafe/`) → **Jev engine**
- anything else → **current LLM engine**, unchanged

No new schema, no env var. Flip in the AI Models settings page or by SQL; rollback is the
same flip. `config` JSON on that row may carry optional Jev knobs (all defaulted in code,
and stripped by the settings UI's zod schema, so code defaults are the source of truth):

```json
{ "level_confidence_gate": 0.7, "level_penalty": 0.5, "rerank": true,
  "reasons_count": 8, "fallback_model_id": "anthropic/claude-sonnet-4-5" }
```

The settings model picker lists text models only. For the `competency_matching` purpose
only, also list OpenRouter decision models (`/models?output_modalities=decisions`), and
have `updateModelForPurposeSchema` reject a `typesafe/` id for any other purpose.

## Pipeline (Jev path)

```
brief (+ raw PD when available)
  │
  ├─ factors: active, is_match_eligible, applicable_outcomes ∋ brief.outcome   (hard)
  │           level is NOT filtered here — all outcome-eligible factors go to Jev
  │
  ├─ Jev request 1 (one call): { level: choice over 5 seniority levels,
  │                              <factor>: score over 5 relevance levels × N factors }
  │     state = { decision, position_description: rawText }   or, when no raw text,
  │             { decision, role_brief: <rendered brief signal> }
  │
  ├─ resolve level: Jev's choice if confidence ≥ level_confidence_gate else brief.level
  ├─ soft penalty: score − level_penalty for factors whose applicable_levels is non-empty
  │                and excludes the resolved level (empty = applies to all, no penalty)
  ├─ order desc; shortlist top 12
  ├─ Jev request 2 (if rerank): rescore the 12 relative to each other (4 levels);
  │                              final order = stage-2 order, then the rest by stage-1
  ├─ map to FactorRanking[] (below)
  │
  └─ reasons stage (LLM, purpose `ranking_explanation`): one call for the top
       reasons_count picks → { summary, reasons: { <factorId>: text } }; non-fatal.
```

Fallback: any Jev failure (HTTP error after retries, timeout, malformed response, empty
answers) → log via `logActionError('matching.jev', …)` and run the LLM engine with
`fallback_model_id` (level filtered hard, exactly today's behaviour). `source.kind ===
'diagnostic'` always uses the LLM engine (with `fallback_model_id` when the configured
model is a Jev id).

### Mapping to the existing contract

| `FactorRanking` field | Jev path |
|---|---|
| `rank` | 1-based position in final order |
| `relevanceScore` | `round(clamp(penalisedScore / 4, 0, 1) × 100)` (stage-1 penalised score, even when reranked) |
| `reasoning` | from the reasons stage for the top N, else `''` |
| `incrementalValue` | `round(relevanceScore × max(0, 1 − (rank − 1) / N))` — a diminishing curve, kept only so `isValidRankingsPayload` and any consumer stay satisfied |
| `cumulativeValue` | running sum of `incrementalValue`, rescaled so the last entry is 100 |
| `summary` | from the reasons stage; fallback template: `"Ranked {n} capabilities for {roleTitle or 'this role'} at {level} level, ordered by how much each would tell you about a candidate's fit for the role."` |
| `recommendedCount` | `minimum = min(5, n)`, `optimal = clamp(count(penalised ≥ 3.0), 5, 8) capped at n`, `maximum = clamp(count(penalised ≥ 2.5), optimal, 12) capped at n` |
| `modelUsed` | the Jev model id returned by the endpoint (e.g. `typesafe/jev-1.13-20260917`) |
| `promptVersion` | `JEV_CRITERIA_VERSION` |
| `usage` | `inputTokens` = sum of Jev input tokens across calls + reasons-stage input tokens; `outputTokens` = reasons-stage output tokens |

Rankings include every factor Jev scored (no `relevanceScore ≥ 20` cut); the UI already
truncates/defaults with `recommendedCount`. `ArchitectMatchResult` gains two optional
fields for diagnostics: `engine: 'jev' | 'llm'` and `resolvedLevel?: AssessmentLevel`.
`eligibleFactors` and `consideredCount` keep today's meaning (outcome- and level-filtered
pool, computed in `architect-match.ts`), which is what the "add a factor" control lists.
A pick promoted from outside that pool by the soft penalty is still a valid pick.

## Criteria (the words are the model — versioned, in code)

`src/lib/ai/matching/jev-criteria.ts`, `JEV_CRITERIA_VERSION = 1`. Wording below is the
variant that tested best; change it only with the harness re-run.

Relevance question (one per factor, `type: 'score'`):

> The state contains a position description and the decision being made. How important
> is it to measure the competency "{name}" in a pre-hire psychometric assessment for this
> role? Judge what separates strong from merely adequate performers in this specific role
> at its level, not what is generically desirable. Definition: {definition} High
> performers: {indicators_high} Low performers: {indicators_low} (Category: {category}.)

Omit the "High performers"/"Low performers"/"Category" fragments when the field is empty.
Criteria (5 levels, in order):

1. Not relevant: measuring this would tell us little about success in this role
2. Marginal: occasionally useful but not a differentiator
3. Useful: contributes to performance in this role
4. Important: a clear driver of success in this role
5. Critical: among the few things that most separate strong from weak performers in this role

Level question (`type: 'choice'`, key `level`): "What seniority level is this role?" with
criteria `ic`: "Individual contributor with no direct reports"; `first_line_manager`:
"Manages a team of individual contributors"; `mid_manager`: "Manages managers or a
function"; `senior_leader`: "Leads a division or major business unit"; `executive`:
"C-suite or equivalent enterprise leadership".

Stage-2 question (per shortlisted factor, `type: 'score'`), state adds
`shortlisted_competencies: [names]`:

> The state contains a position description and a shortlist of competencies already
> judged relevant. Relative to the OTHER shortlisted competencies, how essential is
> "{name}" to measure for this role? {same definition/indicator fragment}

Criteria: "Least essential of the shortlist: the first to drop if the assessment had to be
shorter" / "Useful but secondary to the others on the shortlist" / "Core: clearly belongs
in the assessment for this role" / "Defining: the role cannot be assessed properly without it".

The `decision` state field is `"selection (hiring into this role)"` for outcome
`selection`, `"development (planning a person's growth in this role)"` for `development`,
`"team composition (balancing a team around this role)"` for `team_composition`.

Question keys: a slug of the factor name (`[^a-z0-9]+` → `_`, lower-case); keep a
key→factorId map, and never trust the model to echo ids.

## Jev client

`src/lib/ai/providers/jev.ts` — not registered in the provider registry (it is not a
completion provider). `decide(request, options)`:

- `POST https://openrouter.ai/api/alpha/decisions`, `Authorization: Bearer
  ${process.env.OpenRouter_API_KEY}`, same `HTTP-Referer`/`X-Title` headers as the
  OpenRouter provider. Body `{ model, state, questions }`.
- Per-attempt timeout 12 s (AbortController); 2 attempts via `withOpenRouterRetry`.
  Timeouts and network errors must surface as retryable: throw an error object with
  `status: 503` so `isRetryableOpenRouterError` treats them like a 5xx.
- Validate the response with zod: `{ model, answers: Record<key, ChoiceAnswer | ScoreAnswer
  | NoulAnswer>, usage: { input_tokens, output_tokens, cost? } }`; throw
  `ProviderRequestError('jev', …)` on anything else.
- Export `isJevModelId(id)`.

## Reasons stage

`src/lib/ai/matching/ranking-explanation.ts` — `runRankingExplanation({ brief, picks })`
where each pick is `{ factorId, factorName, definition, relevanceScore }`. Uses
`getModelForTask('ranking_explanation')`, `getActiveSystemPrompt('ranking_explanation')`,
`getDefaultProvider()`, `responseFormat: 'json'`. User prompt: the brief as compact JSON
plus one line per pick `- {factorId} | {factorName} ({relevanceScore}% match): {definition}`.
Tolerant parse (fences, prose); returns `{ summary, reasons: Record<factorId, string> }`;
on any failure returns `{ summary: null, reasons: {} }` after `logActionError`.

Seed migration `supabase/migrations/20260922120000_ranking_explanation_seed.sql`, same
guarded pattern as `20260529101000_architect_brief_extraction_seed.sql`:

1. Insert `ai_system_prompts` "Ranking Explanation v1", purpose `ranking_explanation`,
   `is_active = true`, unless a v1 exists. Content:

   > You are an organisational psychologist writing for a hiring manager who has just
   > been shown which competencies an assessment will measure for their role. For each
   > competency, write one or two plain sentences on why measuring it matters for THIS
   > role, anchored in something specific from the role brief. Then write a two-sentence
   > summary of what the set as a whole will and will not reveal. No headings, no jargon,
   > no markdown. Return ONLY JSON: {"summary": string, "reasons": {"<factorId exactly as
   > given>": string}}. Use the factorId from the list as the key, never the name.

2. Upsert `ai_model_configs` for `ranking_explanation` to `anthropic/claude-haiku-4.5`,
   display name "Claude Haiku 4.5", `{"temperature": 0.4, "max_tokens": 900}` (update if
   the row exists — production currently has `minimax/minimax-m2.5` there — else insert
   with the OpenRouter `provider_id` like the brief-extraction seed).

Do **not** change the `competency_matching` row in the migration; the switch to
`typesafe/jev-1.13` is an operational step after deploy.

## Code changes (files)

- `src/types/ai.ts`: `MatchingFactor` gains optional `indicatorsHigh`, `indicatorsLow`,
  `category`; the `brief` variant of `MatchingSource` gains optional `rawText`.
- `src/types/architect.ts`: `ArchitectMatchResult` gains optional `engine`, `resolvedLevel`.
- `src/lib/ai/providers/jev.ts` (new): client as above.
- `src/lib/ai/matching/jev-criteria.ts` (new, pure): constants + question builders.
- `src/lib/ai/matching/jev-ranking.ts` (new, pure): `resolveLevel`, `applyLevelPenalty`,
  `mergeRerank`, `toRankings`, `recommendedCountFrom`, `fallbackSummary`.
- `src/lib/ai/matching/jev-engine.ts` (new): `runJevMatching(input, opts)` — builds the
  requests, calls the client, applies the pure functions, returns `MatchingOutput &
  { resolvedLevel, levelConfidence }`.
- `src/lib/ai/matching/ranking-explanation.ts` (new): reasons stage.
- `src/lib/ai/matching/engine.ts`: `runMatching` resolves the task model, routes to Jev
  for `brief` sources when `isJevModelId`, applies the hard level filter itself for the
  LLM path (moved from `architect-match.ts`, same predicate), falls back to the LLM path
  with `fallback_model_id` on Jev failure, then runs the reasons stage for the Jev path
  and merges `reasoning`/`summary`. Return type gains optional `engine`, `resolvedLevel`.
- `src/lib/ai/architect-match.ts`: select `indicators_high`, `indicators_low`, category
  name; pass all outcome-eligible factors (with `applicableLevels`) and `options.rawText`
  to `runMatching`; keep computing `eligibleFactors`/`consideredCount` from the
  level-filtered set as today; surface `engine`/`resolvedLevel`.
- `src/app/actions/public-builds.ts`: `rankBuild` passes `rawText: build.pdText` (add
  `pdText` to `PublicBuildDTO`/DAL select if it is not already there).
- `src/app/actions/architect.ts` + `src/lib/validations/architect.ts`: `runArchitectMatch`
  accepts optional `rawText` (max 40000 chars, same truncation as `extractBrief`);
  `src/components/architect/architect-modal.tsx` passes the role text it already holds.
- `src/app/actions/model-config.ts` + settings models page: decision models listed for
  `competency_matching` only; validation rejects `typesafe/` elsewhere.
- `src/app/(marketing)/build/result-step.tsx` / `CapabilityDialog`: render the
  definition when `reasoning` is empty (verify; change only if an empty paragraph shows).
- `vitest.config.*`: add `src/lib/ai/matching/jev-ranking.ts` and
  `src/lib/ai/matching/jev-criteria.ts` to the coverage include list.
- `AGENTS.md`: short note under a new "Competency matching engines" heading pointing here.

## Tests

- `tests/unit/jev-ranking.test.ts`: level gate (≥ gate uses Jev, below uses brief, missing
  answer uses brief); penalty applies only to non-empty `applicableLevels` excluding the
  level; rerank merge order; `toRankings` output passes `isValidRankingsPayload` and
  `relevanceScore` is 0–100 with rank 1 = highest; `recommendedCountFrom` bounds
  (n < 5, compressed scores, all high); cumulative ends at 100.
- `tests/unit/jev-client.test.ts` (mock `fetch`): request shape and headers; parses a
  valid response; malformed body → `ProviderRequestError`; timeout → retried once then
  thrown; 429 → retried.
- `tests/unit/matching-engine-routing.test.ts` (mock `getModelForTask`,
  `getActiveSystemPrompt`, providers, jev client): typesafe id + brief → Jev path;
  Jev throws → LLM path with `fallback_model_id`; diagnostic source → LLM path; non-Jev
  id → LLM path with hard level filter (a factor for `executive` only is not sent when
  the brief is `ic`).
- `tests/unit/ranking-explanation.test.ts`: tolerant parse, keys by factorId, failure
  returns empty and does not throw.
- `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:architecture`
  all green; `npm run build` passes.

## Verification before merge

1. Unit + architecture suites green.
2. Live parity check: `scripts/evals/jev-engine-parity.mjs` (new, uses `tsx`) runs
   `runJevMatching` on two of the designed roles from
   `scripts/evals/jev-pipeline-redesign-eval.mjs` with the real client and prints the
   top 8 next to the harness's saved V3 order — expect the same top 5 up to ties.
3. After merge and deploy: apply the seed migration to production (already applied by
   MCP before the PR opens, per AGENTS.md), flip `competency_matching.model_id` to
   `typesafe/jev-1.13`, run one real Role Builder build, confirm `public_builds.usage`
   shows the Jev engine and the ranking took seconds, keep the LLM row value noted for
   rollback.
