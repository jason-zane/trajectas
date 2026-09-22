# Jev (TypeSafe AI) for competency matching — evaluation, 2026-09-22

**Verdict.** Jev ranks our factor library against a role at least as consistently with the
production Sonnet 4.5 matcher as Haiku 4.5 does, in under a second, for roughly
1/300th of the cost. It cannot write the per-factor reasoning, the summary, or the
recommended count, so it replaces the *ranking* half of `competency_matching`, not the
whole step. Worth a shadow-mode trial behind a flag; not a drop-in swap.

## What Jev is

A "System One" decision model from TypeSafe AI (founded by ex-OpenAI researcher Diogo
Almeida; released 15–18 Sep 2026). It does not generate text. You send a `state`
(string / JSON / array) plus a map of typed questions — `choice` (≤255 options), `score`
(2–10 ordered levels), `noul` (yes/no) — and get back typed answers with a probability
distribution and a confidence, all questions evaluated in parallel. Priced at $0.042 per
million input tokens, output free, 32k context.

Reachable three ways: TypeSafe direct (`POST https://api.typesafe.ai/v1/systemone`),
OpenRouter (`POST https://openrouter.ai/api/alpha/decisions`, model `typesafe/jev-1.13`,
**alpha** endpoint, not chat completions), and Vercel AI Gateway (`typesafe-ai/jev` via
`experimental_evaluate` in the AI SDK, or its HTTP API). We tested through OpenRouter
because the project already has that key.

## How we tested

- **Task shape.** One `score` question per level-eligible factor, in a single request:
  "How relevant is it to measure *{factor}* … for this decision about this role?" with
  five levels from *Not relevant* to *Critical*. Ranking = descending probability-weighted
  score. Also tried `noul` per factor, a single 21-way `choice`, and a reworded 5-level scale.
- **State.** Either the Sonnet-extracted brief (JSON, as the matcher sees it today) or the
  raw position description with the decision — i.e. skipping brief extraction entirely.
- **Cases.** The one real Role Builder build in prod (Accountant, ic, with Sonnet's stored
  ranking) plus six designed PDs: Regional Sales Director, Contact-centre Team Leader, ASX
  CFO, Senior Software Engineer, Nurse Unit Manager, Graduate Policy Analyst.
- **Comparators.** The production pipeline (Sonnet 4.5 brief extraction → Sonnet 4.5
  matching, prod prompts verbatim) and Haiku 4.5 on the same matching prompt — the obvious
  "cheaper LLM" alternative.
- **Metric.** Spearman rho over the eligible pool and top-5 / top-8 overlap against
  Sonnet's ranking. There is no ground truth; Sonnet is the incumbent, not the oracle.

Script: `scripts/evals/jev-competency-match-eval.mjs` (needs OpenRouter credit;
`node --env-file=.env.local scripts/evals/jev-competency-match-eval.mjs`).
Raw outputs: `docs/evals/2026-09-22-jev-*.json`.

## Results

### Agreement with the production Sonnet ranking (six designed roles)

| Ranker | mean rho | mean top-8 overlap |
|---|---|---|
| Haiku 4.5, same prompt | 0.75 | 6.0 / 8 |
| Jev, brief as state, score | 0.84 | 6.3 / 8 |
| Jev, brief as state, reworded scale | 0.84 | 6.5 / 8 |
| Jev, brief as state, noul | 0.79 | 6.0 / 8 |
| Jev, **raw PD** as state, score | **0.85** | 6.3 / 8 |

Per role, Jev raw-PD vs Sonnet: rho 0.80 / 0.89 / 0.88 / 0.87 / 0.76 / 0.91; top-8 overlap
6, 6, 7, 7, 5, 7. Haiku's worst two (0.63, 0.65) are lower than Jev's worst (0.76).

### The real build (Accountant, ic, 21 eligible factors)

| | rho | top-5 | top-8 |
|---|---|---|---|
| Jev, brief as state | 0.92 | 4/5 | 6/8 |
| Jev, raw PD as state | 0.90 | 4/5 | 7/8 |

Sonnet's top 3 (Analytical Thinking, Process Discipline, Execution) are Jev's top 3 in
both variants. Disagreements are in the 6–10 band (Judgement / Building Relationships /
Organisation ordering), where Sonnet's own scores are within a few points of each other.

### Seniority level from the raw PD (a `choice` question)

Jev matched the intended level on all seven roles (confidence 1.00 on five; 0.50 on the
Sales Director, 0.82 on the Nurse Unit Manager). Sonnet's brief extraction differed on
the two borderline cases (Sales Director → `mid_manager`, Nurse Unit Manager →
`first_line_manager`). Worth noting because the level gates which factors are eligible.

### Stability

- Same request twice: not byte-identical, but max score drift 0.09 on a 0–4 scale, rank
  rho 0.99–1.00, top-8 identical.
- Rewording the five scale levels: rho 0.96–0.99 vs the original wording.
- Brief-as-state vs raw-PD-as-state: rho 0.92–0.99.

### Cost and latency per matching call

| | tokens in / out | cost | latency |
|---|---|---|---|
| Sonnet 4.5 match (prod) | ~3.3k / ~3.6k | $0.065 | ~50 s (measured 67 tok/s) |
| Haiku 4.5 match | ~3.3k / ~3.5k | $0.021 | ~25 s (est.) |
| Jev, 21–25 score questions, raw PD | ~5.5k / 0 | $0.00022 | 0.3–0.8 s |

Sonnet brief extraction (kept in every variant below) is a further ~$0.009 and ~6 s.
Per 1,000 builds the matching step is ≈ $65 (Sonnet) / $21 (Haiku) / $0.22 (Jev). At
current volumes the dollar saving is immaterial; the user-visible saving is the ~50 s
"Match relevant capabilities" wait in `/build` collapsing to under a second.

## What Jev does not give us

The matcher's output contract (`FactorRanking`) has `reasoning`, `incrementalValue`,
`cumulativeValue`, plus `summary` and `recommendedCount`. Jev produces none of these.

- `reasoning` is shown in the public Explore dialog and under each pick in the admin
  Architect modal. Options: a single Haiku call that writes reasons for the top 8 only
  (~$0.005, ~5 s), or leave the definition text (the public list already prefers
  `definition` over `reasoning`).
- `summary` on the result step: the existing `architect_overview` call already writes a
  narrative once picks are chosen; a templated sentence would cover the interim.
- `recommendedCount`: Jev's absolute scores compress for leadership roles (15–20 of 22–25
  factors score ≥ "Important"), so a threshold does not yield a count. Use a relative rule
  (gap detection, or simply the existing 4–8 clamp in `recommendedPublicPickCount`).
- Redundancy ("avoid ranking two near-duplicate factors highly") is something the LLM is
  asked to reason about; Jev scores each factor in isolation. If it matters, apply it in
  code (category caps) rather than expecting the model to.

## Risks and limitations

- **Criteria wording is the model.** Independent evals (PriorBench, 5,721 calls) found
  wrong criteria descriptions drop accuracy below random; missing ones cost almost nothing.
  The level descriptions and per-factor instructions need to be owned by the psychologist,
  not tuned ad hoc, and regression-tested against a golden set.
- **Decomposed questions are its strength; single holistic judgments are not.** On a
  phishing task Jev scored 62.6% asked once and 95% when split into narrow questions. Our
  one-question-per-factor design is the good case.
- **OpenRouter's Decisions endpoint is alpha** (`/api/alpha/decisions`); one public harness
  reported ~15% read-timeout hangs. Use a short timeout and retry, or go via Vercel AI
  Gateway / TypeSafe direct for production.
- Vendor-listed jaggedness: literal reading of instructions, counting/date arithmetic,
  distraction by large irrelevant state, injected instructions in state (a pasted PD is
  untrusted text), no text generation.
- No explanations means no directional signal when it is wrong; keep an LLM path for
  sampling and review.

## Other places in Trajectas where a decision model fits

- **Brief extraction's classifications** (`level`, `outcome`, `function`): Jev was 7/7 on
  level from raw text; a confidence-gated Jev call could set these and let the LLM only
  write the free-text fields.
- **Item review at scale** (`item_critique`, `instrument_fairness`, `instrument_congruence`):
  rubric scores and fairness flags as `score`/`noul` per item, LLM only on the flagged
  minority — the "Jev on every trace, LLM on the failures" pattern Arize describes.
- **Chat data-mode guardrails / routing**: "is this answerable from the data tools?",
  "does this ask for numbers that must not reach the model?" as `noul` before the LLM turn.
- **Synthetic respondents**: a `choice` over Likert anchors is the natural shape and would
  be ~100× cheaper, but Jev is a calibrated decision model, not a persona simulator; treat
  as speculative.

## Recommended next steps

1. Build a golden set: ~20 real PDs with Jason's expected top-8, across levels and
   functions. Score Sonnet, Haiku and Jev against it (not against each other).
2. Shadow mode in the admin Architect: run Jev alongside Sonnet, log both rankings and
   agreement per brief, no UI change. Two weeks of real briefs settles it.
3. If it holds: feature-flag the public Role Builder to Jev ranking + Sonnet brief +
   Haiku reasons for the top 8, and keep the Sonnet path as fallback on low confidence
   or endpoint errors.
