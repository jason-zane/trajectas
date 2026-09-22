# Redesigning competency matching around Jev — tested, 2026-09-22

Follow-up to `2026-09-22-jev-competency-matching.md`. Question: can the matching
pipeline be restructured so Jev does the ranking better, with an LLM only where text is
needed, and what does that buy in accuracy, cost and speed?

**Recommendation.** Yes. Score all 25 factors with Jev from the raw position description
(definition + behavioural indicators in each question), apply the level filter as a soft
penalty rather than a hard exclusion, optionally rerank the top 12 in a second Jev pass,
run brief extraction in parallel, and have a small LLM write the reasons for the chosen
eight afterwards. Against an independent expert panel this ranks at least as well as the
production Sonnet matcher (rho 0.90 vs 0.87) and the pipeline drops from ~56 s and
$0.073 per build to 7–13 s and $0.004–0.013.

## Reference

No ground truth exists, so the reference is a panel of three strong models from three
vendors — Claude Opus 5, GPT-5.6 Terra, Grok 4.7 — each scoring every factor 0–100 from
the raw PD with the full library (definition, high/low indicators, level suitability),
scores only, no reasoning. Consensus = mean z-score. Panel members agree with each other
at rho 0.94 / top-8 overlap 6.8 of 8, so ~0.95 is the ceiling any ranker can reach.

Thirteen roles: the one real Role Builder build (Accountant) plus twelve designed PDs
(Sales Director, Contact-centre Team Leader, CFO, Senior Software Engineer, Nurse Unit
Manager, Graduate Policy Analyst, HR Business Partner, Warehouse Shift Supervisor, Head of
Product, Data Scientist, Senior Construction PM, Hotel General Manager).

Script: `scripts/evals/jev-pipeline-redesign-eval.mjs` (`--report` reprints from the
saved JSON). Raw results: `docs/evals/2026-09-22-jev-pipeline-redesign-results.json`.

## Variants tested

| Variant | What Jev sees | Question shape |
|---|---|---|
| V0 | raw PD | one 5-level `score` per factor, definition only |
| V1 | raw PD | as V0 + high/low behavioural indicators + category |
| V2 | raw PD | three `noul`s per factor (required? differentiating? risky if weak?) averaged |
| V3 | raw PD + shortlist | V1, then a second pass rescoring the top 12 *relative to each other* |
| V4 | raw PD + Sonnet brief + level + purpose | V1 questions on the enriched state |
| V5 | — | rank-average of V1 and V2 |

Level for the eligibility pool came from Jev's own `choice` question on the raw PD
(V0 was also run with Sonnet's brief level to isolate that effect). Comparators: the
production pipeline (Sonnet 4.5 brief → Sonnet 4.5 match, prod prompts) and Haiku 4.5 on
the same matching prompt.

## Results

### Agreement with the panel consensus (mean over 13 roles)

| Ranker | rho | top-5 overlap | top-8 overlap |
|---|---|---|---|
| Sonnet 4.5 (production) | 0.869 | 3.69 | 6.54 |
| Haiku 4.5, same prompt | 0.800 | 3.23 | 5.92 |
| V0, Jev level | 0.873 | 3.46 | 6.62 |
| V0, Sonnet level | 0.861 | 3.38 | 6.54 |
| V1 +indicators | 0.876 | 3.54 | 6.54 |
| V2 three nouls | 0.843 | 3.46 | 6.15 |
| V3 two-stage | 0.875 | **3.69** | **6.69** |
| V4 enriched state | 0.874 | 3.62 | 6.54 |
| V5 ensemble | 0.863 | 3.69 | 6.46 |
| **V1 with soft level penalty (−0.5)** | **0.900** | — | 6.54 |

V3 matches or beats Sonnet in 9 of 13 roles. Differences among V0/V1/V3/V4 are within
noise at n=13; the soft-penalty gain is not.

### What moved the needle

- **Soft level filter (+0.024 rho).** Today the level gates which factors can be ranked
  at all. The panel put Commercial Acumen in the top 8 for the Data Scientist and the
  construction PM; both pools excluded it (it is `mid_manager`+). Scoring all 25 and
  subtracting 0.5 from out-of-level factors keeps the leader roles intact (no filter at
  all drops the Sales Director / CFO / Hotel GM to 0.75–0.79) while letting a strongly
  indicated factor through: Data Scientist 0.78→0.85, PM 0.73→0.81, HRBP 0.85→0.92. Only
  possible because scoring everything with Jev is free. The penalty size was chosen on
  this data; confirm on the golden set.
- **Jev's level call (+0.012 vs using Sonnet's).** Jev 12/13 vs Sonnet brief 10/13 vs
  Haiku brief 11/13 against the intended level. Its one miss (construction PM →
  first_line_manager) had confidence 0.66; correct calls were mostly 0.9–1.0, so a gate
  at ~0.7 sends three roles to a fallback and catches the miss.
- **Second-stage rerank (top-5 3.54→3.69).** Rescoring the shortlist relative to each
  other sharpens the head of the list for +0.5 s and +$0.0002.
- **Indicators in the question (+0.003).** Marginal on its own; kept because it also
  makes the criteria more specific, which the independent evals say is what Jev needs.

### What did not help

- **Decomposing into three nouls (V2, −0.03).** Contrary to the phishing-benchmark
  finding; here the direct relevance judgment is the better question. "Explicitly
  required by the PD" pulls rankings toward what is written rather than what matters.
- **Putting the brief in the state (V4).** No change. Jev reads the PD itself; the brief
  is for the user, not the model.
- **Ensembling (V5).** Averaging in the weaker V2 dilutes V1.
- **Confidence as a review trigger.** Mean top-8 confidence correlates −0.46 with
  agreement: Jev is slightly *more* confident on the roles where it diverges from the
  panel (Head of Product, construction PM). Confidence gates the level call; it does not
  gate the ranking.
- **A score threshold for "how many".** The gap between rank 8 and 9 is ≤0.10 on a 0–4
  scale in every role. The count stays a product rule (the existing 4–8 clamp).

Head of Product is the one role where Jev is clearly behind Sonnet (0.76 vs 0.85): Jev
led with Judgement / Decisive Leadership / Decision Prioritisation where the panel wanted
Analytical Thinking / People Development / Commercial Acumen. Worth a look at the criteria
wording for data-driven product roles before trusting it there.

### Cost and latency (per build, measured full-response; Sonnet at 67 tok/s)

| Step | ms | cost |
|---|---|---|
| Brief extraction, Sonnet 4.5 | 4,320 | $0.0084 |
| Brief extraction, Haiku 4.5 | 3,886 | $0.0028 |
| Matching, Sonnet 4.5 (prod) | 51,228 | $0.0642 |
| Matching, Haiku 4.5 | 29,913 | $0.0209 |
| Jev level (`choice`) | 558 | $0.00003 |
| Jev V1 scores, all 25 factors | 665 | $0.00034 |
| Jev V3 stage 2 (top 12) | 487 | $0.00016 |
| Reasons for 8, Haiku, two sentences | 8,552 | $0.0040 |
| Reasons for 8, Haiku, one sentence | 6,859 | $0.0026 |
| Reasons for 8, Gemini 2.5 Flash, one sentence | 2,708 | $0.0009 |

| Pipeline | wall time | cost | vs current |
|---|---|---|---|
| Current: Sonnet extract → Sonnet match | 56 s | $0.073 | — |
| A: Sonnet extract ∥ (Jev level + V1) → Haiku reasons | 13 s | $0.013 | 4.3× faster, 5.7× cheaper |
| B: Haiku extract ∥ (Jev level + V1) → Haiku reasons | 12 s | $0.007 | 4.5× faster, 10× cheaper |
| C: Haiku extract ∥ (Jev level + V1 + V3) → Gemini Flash reasons | ~7 s | $0.004 | 8× faster, 18× cheaper |

If the result page renders the ranking as soon as Jev returns and fills reasons in
afterwards, the visible wait is ~4–5 s (bounded by extraction) in every proposed variant.

## Proposed pipeline

1. On submit, in parallel: (a) brief extraction with Haiku (Sonnet if the displayed
   brief quality matters more than $0.006), (b) one Jev request: `level` choice + 25
   `score` questions with definition and indicators, raw PD as state.
2. In code: take Jev's level if confidence ≥ 0.7, else the brief's; subtract 0.5 from
   factors outside that level; order; keep the top 12.
3. Optional second Jev request: rescore the 12 relative to each other; final order =
   stage 2 then the rest.
4. Render. Default selection = existing 4–8 clamp on the top of the list.
5. One small-LLM call writes one sentence per chosen factor plus the summary; populate
   `reasoning`/`summary` progressively. The existing `architect_overview` call is
   unchanged.
6. Fallback to the Sonnet matcher when the Jev endpoint errors or the level confidence
   is low and no brief is available.

Contract impact: `FactorRanking.relevanceScore` becomes Jev's score rescaled to 0–100;
`incrementalValue`/`cumulativeValue` are dropped or derived (nothing in the UI reads them
beyond `recommendedCount`); `reasoning` arrives late. Admin Architect and the public
builder share `runArchitectMatchPipeline`, so both get it behind one flag.

## Caveats and next steps

- The reference is a model panel, not human judgment. Jason's own top-8 on ~20 real PDs
  is the gate before switching; this harness can score any ranker against it in minutes.
- The −0.5 penalty and the 0.7 level gate were chosen on the same 13 roles.
- OpenRouter's Decisions endpoint is alpha; for production use Vercel AI Gateway
  (`typesafe-ai/jev`) or TypeSafe direct, with a short timeout and a retry.
- Criteria wording is the model. Keep the question text and level descriptions in
  `ai_system_prompts`-style config, version them, and rerun the harness on change.

## Addendum: what would make it better — more information, or calibration?

Script: `scripts/evals/jev-criteria-experiments.mjs` (runs against the saved panel).
Raw: `docs/evals/2026-09-22-jev-criteria-experiments-results.json`.

**More information in the question does not help.** Three richer designs, each on all
13 roles with the soft level penalty (baseline V1 = rho 0.900 / top-5 3.54 / top-8 6.54):

| Added to each question | rho | top-5 | top-8 | tokens |
|---|---|---|---|---|
| job-side signals ("matters most in roles involving …", drafted) | 0.902 | 3.62 | 6.23 | +45% |
| structured rubric levels (`what` + `examples`) | 0.900 | 3.62 | 6.69 | +65% |
| both | 0.899 | 3.85 | 6.46 | +55% |

Shifts are within noise and not consistent in direction. The model already gets what
it needs from the PD plus the definition and indicators.

**Jev has stable per-factor biases, and they are correctable.** Mean z-score gap
(Jev V1 minus panel) across the roles where each factor was eligible:

| Over-rated by Jev | | Under-rated by Jev | |
|---|---|---|---|
| Self-Insight | +0.48 | Strategic Vision | −0.56 |
| Building Relationships | +0.25 | Ingenuity | −0.46 |
| Decision Prioritisation | +0.24 (sd 0.13) | People Development | −0.38 (sd 0.15) |
| Execution | +0.21 | Influence (Negotiation) | −0.34 (sd 0.16) |
| Critical Analysis | +0.19 | Emotional Regulation | −0.31 |
| Visible Self-Development | +0.18 | Achievement Drive | −0.26 |

Leave-one-out: fit the 25 offsets on 12 roles, subtract them from Jev's z-scores on the
13th, re-rank. Mean rho 0.894 → 0.925 (full offset) / 0.920 (half offset); top-8 6.54 →
6.77 / 6.92. Head of Product 0.76 → 0.84, construction PM 0.79 → 0.86, Nurse Unit
Manager 0.87 → 0.94. That is the largest gain of anything tested and it is out of
sample. The offsets above are fitted to the model panel; the production table should be
fitted to Jason's own rankings on the golden set, and refitted whenever the library or
the question wording changes.

**How to read this.** Jev judges each factor in isolation as a calibrated probability
over the rubric levels given the PD and the question text. It does not compare factors
to each other, reason about redundancy, or explain itself. Its errors are therefore
systematic (the same factors drift the same way across roles) rather than random,
which is exactly what a small correction table fixes and what more context does not.
The remaining levers, in order: (1) a human-labelled golden set and the offset table
learned from it; (2) structure in code (soft level penalty, rerank, category balance);
(3) criteria wording, changed only with the harness re-run; (4) model version (`jev-latest`).
