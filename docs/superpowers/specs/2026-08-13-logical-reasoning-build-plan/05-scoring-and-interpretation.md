# Logical Reasoning — Scoring, Interpretation and Reporting Plan

**Status:** design plan. Nothing in this document describes a validated instrument, and nothing here may be described as validated, normed or predictive. It specifies how a set of responses becomes a number, what that number is allowed to mean at each stage of the programme, and what the product must refuse to do with it.

**Companion documents.** This plan sits underneath and stays consistent with:

- `docs/superpowers/specs/2026-08-12-cognitive-assessments/03-logical-reasoning-design.md` — construct, item design, §10 timing policy, §11 scoring intent, §12 validation gates.
- `docs/superpowers/specs/2026-08-12-cognitive-assessments/06-battery-and-psychometric-programme.md` — §4 scoring architecture, §4.6 bands, §7 security, §8 validation programme.
- `scratchpad/cognitive-assessments/plan-architecture.md` — data model, `scoring_profile` dispatch, `participant_item_outcomes`, report-block touch list.
- `scratchpad/cognitive-assessments/plan-psychometrics.md` — the M0–M6 claims ladder, sample plan, reliability reporting rules.

Departures from those documents are listed in §9 with reasons. There are five, all small.

---

## 0. The client's sentence, answered properly

> "The score is pretty easy, it's just a pretty simple number."

That is true, and it is worth saying back plainly rather than talking around it. **The raw score is the count of scored items answered correctly.** Eighteen figural matrix items and ten deductive items; one key per item; one mark per key. There is no partial credit, no weighting of items by difficulty at this stage, no formula. A competent developer implements it in an afternoon, and `plan-architecture.md` §4.2 already specifies exactly that.

Where the work actually lives is in three places, and none of them is arithmetic:

1. **Deciding what a non-response is.** A blank is not one thing. It is a skipped item, an item the candidate never saw because the clock ran out, an item answered in 1.8 seconds without being read, or an item lost to a dropped connection. Those four are the same blank in the database and four different facts about the candidate. Getting this wrong quietly corrupts item difficulty at the end of every form and hands a tribunal an easy question.

2. **Deciding what the number is compared to.** A raw score of 19 out of 28 is not a result. It is an input to a comparison that does not exist yet. Until a named comparison group exists, the honest output is the raw score plus a statement that there is nothing to compare it to — and the product has to be built so that nobody can accidentally show a percentage that reads like a percentile.

3. **Deciding what may be said about a person on the strength of it.** This is where the money and the legal exposure both are. A figural matrix score supports a narrow claim about performance on abstract reasoning problems relative to a stated group, with a stated margin of error. It supports nothing about character, motivation, leadership, "potential", or fit. The report's job is to make the narrow claim clearly and to make the over-claim structurally impossible.

So: keep the simple thing simple. The scoring engine is a few hundred lines. The rest of this document is about the two hundred metres between that number and a defensible statement about a candidate.

---

## 1. The scoring pipeline, stage by stage

### 1.1 Maturity stages

Scoring behaviour is gated on the instrument's milestone in the claims ladder (`plan-psychometrics.md` §5), which maps onto `assessments.scoring_profile` (`plan-architecture.md` §1.4):

| Stage | Milestone | `scoring_profile` | What is computed | What is displayed to a client |
|---|---|---|---|---|
| **S0** | M0–M1 (design, cognitive pre-pilot) | none — assessment not releasable | Nothing candidate-linked | Nothing. Completion confirmation only. |
| **S1** | M2 (internally calibrated, beta) | `ability_dichotomous` | Raw correct, percent correct, per-item outcomes, RT metrics, effort flags | Raw score with form composition and an explicit no-comparison-group statement. Optional reference-sample position in thirds. `provisional = true`. |
| **S2** | M3 (normed, one occupational group) | `ability_irt` | θ (EAP) + SE(θ), T-score, percentile, band, composite | T-score, percentile, band, confidence interval, named norm group. |
| **S3** | M4+ (fairness-evidenced, criterion-supported) | `ability_irt` | As S2 plus DIF-clean bank, adverse-impact monitoring live | As S2 plus configurable cut scores and impact reporting. |

The stage is a property of the instrument version, checked at score-release time. It is data, not a deploy (`plan-architecture.md` §4.3). Every score row carries `provisional` and the report renderer must fail closed: unknown stage → no score rendered.

### 1.2 The pipeline

```
raw responses
  → response resolution (value → option → key)
  → per-item outcome classification
  → effort and validity screening (flags only; never silently alters the score)
  → completeness gate
  → raw score
  ├─ S1 stop here: raw + percent correct, no referent
  → θ (EAP, 2PL) + SE(θ)                       [S2+, requires current item parameters]
  → T-score against a named norm group          [S2+, requires N ≥ 300 in that group]
  → percentile from the empirical lookup        [S2+]
  → band + confidence interval                  [S2+]
  → composite (0.70 LR-M + 0.30 LR-D)           [S2+ only; see §1.4]
```

**Stage 1 — Response resolution.** Server-side only. The delivered form (`participant_section_forms`) is authoritative; the scorer never re-derives which items were presented. Content hashes are checked against the item bank and a mismatch aborts loudly. Any scored item with no key in `item_answer_keys` aborts scoring. A missing key must never resolve to "wrong" (`plan-architecture.md` §4.2, steps 2–3).

**Stage 2 — Outcome classification.** Every entry in the delivered form emits exactly one row in `participant_item_outcomes`:

| Situation | `outcome` | `counts_toward_score` | Scored as |
|---|---|---|---|
| Practice item | `excluded` | false | — |
| Unscored seed item | `correct` / `incorrect` | false | — (accrues to calibration only) |
| Response recorded, matches key | `correct` | true | 1 |
| Response recorded, does not match key | `incorrect` | true | 0 |
| Item displayed, no response, section completed or expired | `omitted` | true | 0 |
| Item never displayed, section expired first | `expired_unseen` | true | 0 |
| Response posted after deadline + grace | `omitted` if displayed, else `expired_unseen` | true | 0 |

`rapid_guess` is a boolean on the same row. It never changes `outcome` and never changes the score (`03-logical-reasoning-design.md` §10).

**Stage 3 — Effort and validity screening.** §2.3–2.5. Produces session-level flags, not score adjustments.

**Stage 4 — Completeness gate.** §2.6. A session that fails the gate produces no score, not a low score.

**Stage 5 — Raw score.** Per factor (LR-M, LR-D):

```
raw_correct     = count(outcome = 'correct' AND counts_toward_score)
items_used      = count(counts_toward_score)
items_attempted = count(counts_toward_score AND outcome IN ('correct','incorrect'))
scaled_score    = 100 × raw_correct / items_used
```

`scaled_score` is percent correct so that existing consumers that treat `scaled_score` as 0–100 do not misrender a raw count (`plan-architecture.md` §4.2). **This number is a pipeline convenience, not a reportable quantity.** See the warning in §5.2 — percent correct on a 0–100 axis is the single most dangerous number in this design, because it looks exactly like a percentile and is not one.

**Stage 6 — θ.** From S2, EAP with a standard-normal prior on the calibration population, over the dichotomous outcomes already persisted, using `is_current` parameters for the factor's scale code. If any scored item lacks current parameters, fall back to sum-correct and record `scoring_variant = 'sum_correct_fallback'` with the missing item ids. Never partially θ-score a form.

**Stage 7 — Standard score.** T-score (mean 50, SD 10) referenced to a **named** norm group. The report states group name, N, recruitment window, administration conditions and collection dates, every time, without exception (`06-…` §4.4).

**Stage 8 — Percentile.** From the empirical percentile lookup for that norm-group version. Never from the normal approximation unless normality has been confirmed and the confirmation is in the manual. No percentile is shown against any group with N < 300 (`plan-psychometrics.md` §5, M3); the battery document's N < 500 rule (`06-…` §8.3) is the target for a general applicant norm — see §9, departure 3.

**Stage 9 — Band and interval.** §4.

### 1.3 What is displayed before calibration exists

Explicitly, because this is where products go wrong:

- **S0.** Nothing. Not a raw score, not a "you completed 19 of 28". The instrument at M0/M1 has no reliability estimate, which means no standard error can be computed, which means any number shown carries an unquantified error. Candidates see a completion confirmation and the transparency pack. Internal researchers see everything.
- **S1.** Raw score out of the number of scored items, the form's composition, the interpretable-floor check (§2.7), and an explicit statement that no comparison group exists. Optionally, once Wave 1 is in, position within the reference sample expressed in **thirds**, named and dated. No percentile. No band label drawn from a norm distribution. No composite. No profile comparison between LR-M and LR-D.
- **S2+.** The full pipeline.

### 1.4 The composite

`03-logical-reasoning-design.md` §2 sets the composite at 70% LR-M / 30% LR-D, applied at θ level with `composite_method = 'weighted_lr_v1'`, weights stored as data on `assessment_factors.composite_weight`.

At S1 the pipeline computes and stores it (no code change from `plan-architecture.md` §4.2 step 9) but **the report must not render it.** A 70/30 weighted mean of two percent-correct scores from forms of unknown and different difficulty is arithmetic without meaning. Suppress display while `metric = 'percent_correct'`; render from S2, where the two θs are on calibrated metrics.

---

## 2. Scoring rules that matter more than people think

### 2.1 Not-reached, omitted, wrong — and the asymmetry

Three distinct facts, two different treatments depending on what the data is being used for.

**Operational scoring (what the candidate is scored on).** Omitted = 0. Not-reached (`expired_unseen`) = 0. Both count in the denominator.

The reasoning: this is a power test with a limit set at 1.25× the sum of design target response times (`03-…` §10), and the design verification requires ≥ 90% of candidates to reach the final item. If a candidate does not reach items on a form built to that specification, one of three things is true — they worked unusually slowly, they were disadvantaged by their device or environment, or the time limit is wrong. Only the third is a scoring problem, and the remedy is to fix the limit, not to score around it. Treating not-reached as *missing* in operational scoring would systematically advantage slower candidates and make the scale non-comparable between candidates who saw 28 items and candidates who saw 22. So: not-reached costs a mark, and the not-reached count is surfaced as an administration note.

**Calibration (what the item is scored on).** Not-reached is treated as **not administered** — excluded from the likelihood for that person–item cell. Omitted is treated as **incorrect**.

The reasoning is the mirror image. Items sitting at the end of a form accumulate not-reached responses that are a property of the form's position, not of the item, and scoring them as failures pushes their estimated difficulty up. Since forms are linked through anchors placed at matching serial positions, that bias propagates into the scale. Exclude them. This asymmetry is standard practice in large-scale assessment and should be stated in the technical manual in exactly these terms rather than left implicit — a reviewer who spots an undocumented asymmetry will assume it was chosen after seeing the results.

**Why omitted is incorrect and not missing, in both.** A candidate who saw an item and moved on has produced evidence. Treating a deliberate skip as missing rewards strategic omission, and under number-right scoring the candidate's rational strategy is to answer everything — which is precisely what we instruct them to do (§2.2). If pilot data show omission rates above 5% on any item, that is an item-clarity problem, not a scoring problem.

### 2.2 Guessing correction — recommend against

**Recommendation: no formula scoring. Number-right scoring, with an explicit instruction to answer every item.**

The instruction, verbatim in the candidate briefing: *"Answer every question. There is no penalty for a wrong answer, so if you are unsure, choose the option you think most likely and move on."*

Why not the classic correction (`R − W/(k−1)`):

1. **It changes what the test measures.** Formula scoring penalises omission, and propensity to omit under uncertainty is a risk-attitude variable, not a reasoning variable. It introduces documented, systematic group differences on a dimension that has nothing to do with the construct. On an instrument whose subgroup differences are already the central fairness problem (`plan-psychometrics.md` §7), volunteering an extra, construct-irrelevant source of them is indefensible.
2. **It corrects an amount of noise we can measure and would rather model.** With five options on matrices and four on the deductive section, chance is 20% and 25%. The right home for that is the measurement model — a fixed lower asymptote as a sensitivity analysis against the 2PL, per `06-…` §4.3 — not the score arithmetic. A free guessing parameter is not on the table at any realistic N.
3. **The correction is exactly rank-preserving under a "guess randomly on all omits" assumption**, which is not how candidates behave, and non-rank-preserving in the direction of penalising the cautious under any other assumption. It buys nothing and costs defensibility.
4. **It complicates the candidate's decision** at the moment we least want them thinking about strategy.

What we do instead:

- Instruct exhaustive responding, and verify in pilot that the omission rate is < 5% overall.
- Run the fixed-c sensitivity analysis at calibration and report whether it changes θ-ordering in the decision region. Adopt fixed-c only if it materially does, which above the cut regions we use it rarely will.
- Apply the **interpretable-floor rule** (§2.7), which is the honest way to handle the fact that a low score on a multiple-choice test may be indistinguishable from random responding.

### 2.3 Rapid-guessing detection

Two threshold regimes, because the good method needs data we do not yet have.

**Pre-calibration (S0/S1, and as a permanent floor).** Fixed thresholds from `03-…` §10:

- Matrices: response time < **3,000 ms**
- Deductive: response time < **4,000 ms**

**Post-calibration (S2+).** Item-level normative thresholds, which are strictly better because a 4-second response to a one-rule warm-up matrix is plausible and a 4-second response to a three-rule cross-layer item is not:

```
T_i = clamp(0.10 × median_RT_i , floor_i , 10,000 ms)
where floor_i = 3,000 ms (matrices) / 4,000 ms (deductive)
```

Median RT is computed on the calibration sample, excluding responses already flagged by the fixed floor, and is versioned with the item parameters. The 10-second cap prevents a slow item from setting an absurd threshold; the floor prevents a fast item from setting one so low it catches nothing.

**Session-level statistic.** Response Time Effort:

```
RTE = (count of scored items with RT ≥ T_i) / items_used
```

| RTE | Classification | Action |
|---|---|---|
| ≥ 0.90 | Normal | No flag. |
| 0.80 – 0.89 | Advisory | Session flagged `low_effort_advisory`. Score released with an administration note. Excluded from norm and calibration samples. |
| < 0.80 | Blocking | Score withheld. Session status `not_scorable_effort`. Candidate offered one retake at no disadvantage, wording per §8.6. Never described as cheating or as a low score. |

**Effort-moderated scoring — recommend against for operational use.** Scoring only the effortful responses is attractive and wrong here: it rewards rapid-guessing on hard items, since the candidate who abandons the three-rule items has them excluded rather than marked wrong. Use it as a research sensitivity analysis and as an exclusion rule for the calibration and norm samples, never as the operational rule.

### 2.4 The other validity flags

All computed post-hoc, all feeding a review queue, none capable of failing a candidate on its own (`06-…` §7.3).

| Flag | Definition | Tier |
|---|---|---|
| `rapid_guess_rate` | RTE thresholds above | Advisory / Blocking |
| `fast_correct_hard` | ≥ 3 correct responses below the item threshold on items in the hard or very-hard bands | Advisory → verification retest |
| `metronomic` | Coefficient of variation of inter-item intervals < 0.20 across ≥ 10 items | Advisory |
| `stall_burst` | ≥ 2 cycles of (inter-item gap > 3× item median) immediately followed by a sub-threshold correct | Advisory → verification retest |
| `position_streak` | ≥ 5 consecutive responses in the same option position | Informational (key positions are balanced, so this is near-random behaviour) |
| `not_reached_excess` | ≥ 4 items `expired_unseen` on a 28-item form | Advisory, plus an instrument-level alert if the rate exceeds 10% of sittings (the time limit is wrong) |
| `focus_loss` | Tab/window blur count, paste events, mid-session device change | Informational; weighted into the composite anomaly score only |
| `person_misfit` | l_z < −2.0 | Advisory (S2+ only; needs parameters) |
| `technical` | Connection loss > 60 s, clock desynchronisation, render failure logged | Advisory; triggers the technical-remedy path in §2.6 |

**The escalation rule, stated once:** informational flags are logged and visible only internally; advisory flags produce an administration note on the client report in neutral language and exclude the session from norm and calibration samples; blocking flags withhold the score. No flag combination ever produces an adverse recommendation. Where flags suggest the score may not reflect the candidate's performance, the response is a **verification retest** under supervision (`06-…` §7.5), and the client-facing status is "verification not confirmed", never an accusation.

### 2.5 Where flags live

Add one small table rather than overloading `participant_item_outcomes.outcome`:

```sql
CREATE TABLE participant_session_flags (
  session_id   UUID NOT NULL REFERENCES participant_sessions(id) ON DELETE CASCADE,
  flag_code    TEXT NOT NULL,
  tier         TEXT NOT NULL CHECK (tier IN ('informational','advisory','blocking')),
  detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
  detector_version TEXT NOT NULL,
  raised_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by  UUID REFERENCES profiles(id),
  reviewed_at  TIMESTAMPTZ,
  resolution   TEXT,
  PRIMARY KEY (session_id, flag_code)
);
```

RLS as for `participant_item_outcomes` — service role only, no client or candidate read path. `detail` carries the numbers behind the flag so a review is auditable without re-running the detector. `detector_version` matters: a flag raised by v1 thresholds must not be silently reinterpreted under v2.

### 2.6 Partial sessions and the completeness gate

**Gate for a scorable session, all must hold:**

1. Every scored section reached a terminal state — submitted, or expired with auto-submit.
2. `items_attempted / items_used ≥ 0.80` for each factor scored.
3. No blocking flag.
4. No abort condition from §1.2 stage 1 (content-hash mismatch, missing key).

**Failure modes and what happens:**

| Situation | Handling |
|---|---|
| Candidate abandons mid-section, session not finalised | No score. Status `incomplete`. Resume link valid for the campaign window; the section clock continues from its server-side start (`plan-architecture.md` §3), so resuming does not buy time. On window expiry, `abandoned` — no score, ever. |
| Section expired with items unseen | Scored, with `expired_unseen` outcomes and a `not_reached_excess` note if ≥ 4. |
| Documented technical failure (logged connection loss, render error) | Session voided and re-issued on a form with **zero item overlap** against the candidate's exposure ledger. The voided attempt is retained internally, excluded from all samples, never reported. |
| One of two sections complete | Report the complete component alone, with its own SEM, clearly labelled as a partial administration. **No composite.** A 70/30 composite computed from one component is not a composite. |
| Attempted rate 0.80 ≤ x < 0.95 | Scored, administration note, excluded from norm and calibration samples. |
| Attempted rate < 0.80 | Not scorable. Status `not_scorable_incomplete`. |

The distinction that matters commercially: **a failed gate produces no score, never a low score.** Wiring an incomplete session into the bottom band is the single most likely route from a product decision to a discrimination claim, because incompleteness correlates with device quality, connection quality and disability.

### 2.7 The interpretable floor

Multiple-choice scores near chance carry no information, and reporting them as "low" asserts something the data does not support. Compute the floor from the guessing distribution of the actual form and hold the score above it.

For the operational configuration — 18 matrix items at five options, 10 deductive items at four options:

| Scale | Chance mean | Chance SD | 95th percentile of the pure-guessing distribution | Floor rule |
|---|---|---|---|---|
| LR-M (18 items, k=5) | 3.6 | 1.70 | 6.4 | raw ≤ **6** is not distinguishable from random responding |
| LR-D (10 items, k=4) | 2.5 | 1.37 | 4.8 | raw ≤ **4** is not distinguishable from random responding |
| Combined (28 items) | 6.1 | 2.18 | 9.7 | raw ≤ **9** is not distinguishable from random responding |

Below the floor, the report shows **"Below the interpretable range"** and no band, no percentile, no T-score. The internal view shows the raw score and the flag set. The recommended client action is a supervised retest, not a rejection. The floors are recomputed and versioned whenever form length or option count changes, and they belong in the technical manual as a table.

---

## 3. Score reporting formats

Three audiences, three views, one source of truth. Nothing is computed differently for different audiences; things are withheld.

### 3.1 What the candidate sees

**Recommendation: at S0/S1, completion confirmation and the transparency pack. No score. From S2, band and confidence statement on request, no number.**

This is a deliberate position and worth defending, because "candidates should see their scores" sounds obviously right.

- Releasing a provisional score to a candidate creates a document that will circulate, be screenshotted, and be quoted back — at a stage where we have said in the manual that the score means nothing outside research. There is no version of that which ends well.
- From S2, candidates get the band, the plain-English description of what the test measured, and the confidence statement — but not the number. A T-score or a percentile invites the candidate to treat it as a fact about themselves. The band with its interval is the honest resolution of the measurement and is what we ask clients to decide on; giving the candidate something more precise than we give the decision-maker would be incoherent.
- **Always available regardless of stage:** what the test measured, how it was scored, the retake policy, the adjustments route, the challenge route, and the data-retention position (§7).

Candidates who request their score in writing get it, with the interval and the interpretation copy, as part of the subject-access route. That is a right, not a product feature, and it is handled by the same copy.

### 3.2 What the client sees

| Element | S1 (M2, beta) | S2+ (M3, normed) |
|---|---|---|
| Provisional banner | Yes — "Pilot — not for selection decisions", non-dismissible | Only where `provisional = true` |
| Score | Raw correct out of items scored, per component | T-score per component and composite |
| Comparison | Explicit "no comparison group" panel, or position in thirds of a named reference sample | Percentile against a named norm group, with N, window, conditions, dates |
| Band | None | A–E, percentile-anchored (§4.1) |
| Uncertainty | Stated in raw-score units, as a range | Confidence interval on the T-score and the band, drawn crossing band boundaries where it does |
| Profile comparison LR-M vs LR-D | Suppressed (§3.4) | Suppressed unless the difference clears the reliable-difference threshold, which on current form lengths it effectively never will |
| Administration notes | Advisory flags in neutral language; timing adjustments **never** shown | Same |
| Item-level detail | Never | Never |
| Interpretation copy | Fixed, versioned, non-editable (§8) | Same |
| Guidance on use | Fixed, non-editable block (§6) | Same |

### 3.3 What the internal psychometric view shows

Gated to `platform_admin`, in `src/app/(dashboard)/psychometrics/`, never in a report:

Per session — every `participant_item_outcomes` row with option chosen, RT, rapid-guess status, item purpose and version, content hash; the full flag set with detector versions and detail payloads; θ, SE(θ), l_z person-fit; the delivered form and its assembly constraints; timing telemetry including server clock events; device and viewport class.

Per item — p-value, corrected item–total correlation, option-level trace lines by total-score quintile, RT distribution against target, exposure count and spread, current and historical parameters with standard errors and calibration-run linkage, DIF statistics per characteristic, LLTM-R residual against the radical-predicted difficulty.

Per instrument — reliability with its Feldt interval, testlet-adjusted reliability, conditional SEM curve with the decision region marked, form information functions, anchor drift, subgroup descriptives with intervals and their underpowered labelling, adverse-impact ratios at each configured cut.

### 3.4 Measurement error, honestly

A point estimate on its own is misleading, and the specific size of the problem should be in the plan rather than gestured at.

**At S1, in raw-score units.** Classical SEM = SD × √(1 − α). On a 28-item form with a plausible raw SD of about 5.2 and α = .85, SEM ≈ **2.0 raw points**, so a 95% interval is roughly **±4 raw marks** — on percent-correct, ±14 percentage points. That is the number to keep in mind when anyone proposes displaying "68% correct" as though it were meaningful to one significant figure. Where α is not yet estimated, no SEM exists, and therefore no score is shown.

**At S2, in θ and T units.** A well-targeted 20–25 item figural matrix form has a person SEM of roughly **0.40–0.55 logits** even with item parameters known exactly (`plan-psychometrics.md` §6). On a T-scale that is **4–5.5 T-points**, so a 95% interval spans about **±8 to ±11 T-points**.

**What that means at the middle of the distribution, said plainly.** A candidate at T = 50 — the 50th percentile — has a 95% interval running roughly from T = 40 to T = 60, which is the **16th to the 84th percentile**. That is the honest resolution of a 28-item reasoning test, and it is the single strongest argument for banding, for refusing to rank-order within a band, and for never letting a client sort a shortlist on this column.

**The SEM of a difference is larger.** Comparing two scores — two candidates, or a candidate's LR-M against their LR-D — the relevant quantity is SE_diff = √(SEM₁² + SEM₂²), about 1.41× a single SEM when both are similar. Two candidates are reliably different only when their T-scores differ by roughly **14 points or more**. The LR-D component at 10 items will have a materially larger SEM than LR-M at 18, which makes a within-candidate profile difference reportable only at differences so large they will not occur. **The product therefore does not draw a profile comparison at all**, at any stage, and the report does not place the two components on a shared axis where the eye will draw one for us.

**Display rules.**

1. Every displayed score carries its interval, in the same visual weight as the point estimate. Not a footnote, not a tooltip.
2. Intervals are drawn crossing band boundaries when they cross them, and the copy names the two bands (`06-…` §4.6).
3. The API exposes numeric SEM alongside every score so a client pipeline cannot silently drop it.
4. No score is ever displayed to more precision than its interval justifies: T-scores to the integer, percentiles to the nearest whole number and never above 99 or below 1, raw scores as integers, percent correct not displayed at all outside the internal view.

---

## 4. Interpretation framework

### 4.1 Bands and cut-score philosophy

**Recommendation: norm-referenced banding, five bands, percentile-anchored, fixed ex ante.**

Criterion-referenced scoring is the right answer for tests with an absolute standard — a driving test, a dosage calculation, a safety-critical checklist. Fluid reasoning has no such standard. There is no defensible statement of the form "a candidate needs to solve 19 of 28 figural matrices to do this job", and any attempt to construct one via an Angoff-style panel would be asking SMEs to judge the difficulty of abstract puzzles they have no basis for judging. Criterion-referencing here would manufacture an authority the evidence cannot support.

So: norm-referenced, against a **named occupational group**, with the group's identity forced into every sentence of the interpretation.

Bands, aligned to `06-…` §4.6 and mapped to T:

| Band | Percentile against the named group | T-score | Width in T |
|---|---|---|---|
| **A** | 90th and above | ≥ 63 | open |
| **B** | 70th – 89th | 55 – 62 | 8 |
| **C** | 30th – 69th | 45 – 54 | 10 |
| **D** | 10th – 29th | 37 – 44 | 8 |
| **E** | Below the 10th | ≤ 36 | open |

Why these widths. With a person SEM of about 5 T-points, an 8–10 point band means a one-SEM movement in the point estimate rarely crosses two boundaries, which is the property `06-…` §4.6 asks for. It is *not* true that the 95% interval stays inside one band — at ±10 T-points it routinely spans two, and the report says so rather than hiding it. Both facts belong in the manual: the bands are stable to ordinary measurement noise; the intervals are wide.

**Band labels.** Not the existing competency presets. `src/lib/reports/band-scheme.ts` ships `3-band`, `5-band` and `7-band` schemes with labels like "Highly Effective" and "Competent" — those are behavioural-competency labels and they are wrong for a cognitive score, because they attribute a quality to the person. Register a new preset:

```
cognitive-5-percentile
  A  "Well above the comparison group"     ≥ 90th
  B  "Above the comparison group"          70th – 89th
  C  "In line with the comparison group"   30th – 69th
  D  "Below the comparison group"          10th – 29th
  E  "Well below the comparison group"     below 10th
```

Unglamorous by design. Every label contains the words "comparison group", which forces the reader to the norm-group attribution line and makes it grammatically awkward to say "this candidate is a B". The palette should be `monochrome` or `warm-neutral`, not `red-amber-green` — a red band on a cognitive score reads as a verdict.

**Cut-score philosophy.**

- **Recommended default configuration: minimum-competency screening, not top-down selection.** Where the battery is an early sieve, the recommended cut excludes band E only. This is the configuration with the best validity-per-adverse-impact profile for a volume funnel, and it is what we document as the default (`06-…` §4.6).
- Cut scores are set **before** any subgroup analysis of the applicant pool, recorded with the job-analysis basis, and versioned. A cut moved after seeing subgroup results is indefensible whichever direction it moves.
- Cut scores are never race- or sex-conscious. Adverse impact is managed by choosing the least discriminatory configuration that meets the business need, documenting the search for alternatives, and monitoring — not by adjusting scores per group.
- The platform supports a small menu of documented cut configurations, each with its own impact monitoring. Free-form client-set cuts are not supported.
- **No cut score may be configured while the instrument is below M4.** Below M4 there is no fairness evidence, and a cut without fairness evidence is a claim we cannot defend.

### 4.2 Language rules for interpretive text

**The governing rule: describe the performance and the occasion, not the person.** "This score falls above the comparison group" is a statement about a score. "This candidate is a strong reasoner" is a statement about a person, and the data does not reach that far. Every sentence of interpretation copy is written to the first form.

**May be said:**

- What the test consisted of, in concrete terms (number of items, item type, time allowed).
- Where the score sits relative to the named comparison group, with the group named in the same sentence or the one before it.
- The confidence interval and what it implies about distinguishing candidates.
- That the test measures reasoning with novel abstract material, and that performance depends on the specific problems presented on the day.
- That the score is one input among several and what other evidence would sensibly sit alongside it.
- Administration facts relevant to interpreting the score (a partial administration, an advisory flag), in neutral language.

**Must not be said, at any stage, by any surface, including AI-generated text:**

| Prohibited | Why |
|---|---|
| "Intelligence", "IQ", "cognitive ability" as a property of the person | The instrument measures performance on one narrow ability. "IQ" imports a scale and a history we have not earned. |
| "Potential", "ceiling", "capacity", "raw horsepower" | Claims about the future from a single-occasion measurement. |
| Trait nouns — "a strategic thinker", "an analytical mind", "quick learner" | Explicitly prohibited by `03-…` §11. These are personality inferences from a reasoning score. |
| Predictions of job performance from this score | Not supportable below M5, and above M5 only for the studied population, with the coefficient named. |
| "Will struggle with", "is unlikely to cope with", "not suited to" | Prediction plus prescription, from one number. |
| Anything about effort, motivation or attitude | A low score is not evidence of not trying. Effort statements belong nowhere near a score, even when a flag fired. |
| Comparison to other named candidates, or a rank position | Manufactures precision the SEM forbids. |
| "Above average" without naming the group | The average of what? Every comparative statement carries its referent. |
| Combining this score with other assessment data into a single verdict | The composite is defined; anything beyond it is an unvalidated model. |
| "Validated", "proven", "predictive", "scientifically" — before the milestone that licenses each | `plan-psychometrics.md` §5. |

**Structural enforcement, not editorial discipline.** Interpretation copy is a fixed, versioned, human-written string table keyed by band and stage. It is not generated by an LLM, and the `ai-text` block is disabled for cognitive assessments. The copy is not client-editable. Clients may add their own commentary in a clearly attributed block, and that block carries an attribution line naming them as its author. This is the difference between a rule and a hope.

### 4.3 Guidance for hiring users

Delivered as a fixed, non-editable block in every report (§6) and in the client onboarding pack.

1. **Decide at band level.** Candidates in the same band are not distinguishable by this test. Do not sort a shortlist on this score.
2. **Use it as one input with a stated weight, set in advance.** Record what weight the score carries in your process before you see any scores.
3. **Use it as a screen at the bottom, not a ranking at the top.** The evidence for excluding the lowest band is stronger than the evidence for preferring the top band over the second.
4. **Never as the sole basis for an adverse decision.** This is a product rule as well as advice (§7).
5. **Pair it with evidence that adds something.** Structured interviews and work samples add incremental validity over a reasoning test; unstructured interviews and CV screening largely do not.
6. **Record the job-analysis basis.** Why does this role need abstract reasoning, and what work behaviour does that map onto? This is the objective-justification defence, and it has to exist before the test is used, not after it is challenged.
7. **Watch the interval at boundaries.** A candidate whose interval crosses a boundary belongs to both bands for decision purposes.
8. **Read the administration notes.** A partial administration or an advisory flag changes what the score supports.

---

## 5. Before norms exist

This is the section that determines whether the product is honest, because it is where the pressure to show something comparative is highest and the ground is weakest.

### 5.1 The three states

| State | Condition | What the report shows |
|---|---|---|
| **No score** | S0, or completeness gate failed, or blocking flag, or below the interpretable floor | No number. An explanation and a next step. |
| **Raw only** | S1, before Wave 1 reference data | Raw correct out of scored items, form composition, explicit no-comparison statement. |
| **Reference position** | S1, after Wave 1 (N = 400 panel) | The above plus position in thirds of the named reference sample. |

### 5.2 The trap to design around

The pipeline writes `scaled_score` as percent correct on a 0–100 scale. Every existing score block and band scheme in the report system treats a 0–100 `scaled_score` as a norm-referenced quantity and will render "68" against a five-band scheme as though it meant something. **A reader cannot tell "68% of items correct" from "68th percentile" at a glance, and most will not try.**

Three mechanical protections:

1. `score_overview`, `score_detail` and `norm_comparison` are **disabled** for any factor whose `metric = 'percent_correct'`. Enforced in the block resolver, with a unit test.
2. The `cognitive_profile` block never renders percent correct. It renders "19 of 28 items correct". A count with a denominator cannot be misread as a percentile.
3. No band scheme may be attached to a factor whose `metric = 'percent_correct'`. The band field renders as "Not available — see below", with the explanation.

### 5.3 The reference-sample position, when it exists

After Wave 1 (`plan-psychometrics.md` §3, N = 400 paid UK panel, unproctored), we have a distribution. It is not a norm group and must never be called one. What it supports:

- Position expressed in **thirds** — lower third, middle third, upper third of the reference sample. Not deciles, not percentiles. Thirds are coarse enough to survive the sampling error at N = 400 and coarse enough that nobody will mistake them for a normative percentile.
- Always with the full attribution: sample description, N, dates, recruitment method, administration conditions, and the sentence that it is a reference sample and not a norm group.
- No band label. No T-score. No composite.

### 5.4 The actual report copy, pre-norms

**Panel heading:** *Result*

**Score line:**

> **19 of 28 items correct**
> Logical Reasoning (figural matrices, 18 items; deductive reasoning, 10 items). Completed 4 September 2026 in 31 minutes of the 34 allowed.

**Uncertainty line, immediately beneath, same visual weight:**

> Scores of this length carry a margin of about ±4 marks. A score of 19 and a score of 16 are not meaningfully different.

**No-comparison panel — this is the load-bearing copy:**

> **There is no comparison group for this score yet.**
>
> A score only means something against a defined group of people. We have not yet collected one for this assessment, so we cannot tell you whether 19 of 28 is high, low or typical — and neither can anyone else. We would rather say that than show you a number that implies a comparison we cannot support.
>
> This score is suitable for research and for product evaluation. It is not suitable for deciding between candidates, and the platform will not let it be used that way.

**With a reference sample available, the panel becomes:**

> **Compared with a reference sample — not a norm group**
>
> This score falls in the **upper third** of a reference sample of 400 UK adults recruited through a paid research panel between March and May 2026, who took the assessment unsupervised under the same time limits.
>
> That sample is not a norm group. It was not recruited to represent applicants for any role, the people in it were not applying for anything, and it is too small to support percentiles. Treat "upper third" as a rough orientation, not a rank.

**Provisional banner, non-dismissible, at the head of the report:**

> **Pilot — not for selection decisions.** This assessment is in development. Its scores have not been calibrated against a comparison group and no validity evidence exists for them yet. See "How to read this report" below.

**Below the interpretable floor:**

> **Below the interpretable range**
>
> This score is 8 of 28. On a test with five answer options, a person answering entirely at random would score around 6, and scores up to 9 fall within the range random answering produces. We cannot tell the difference between this result and answering without engaging with the questions, so we are not reporting it as a score.
>
> This is a statement about what the test can and cannot tell us, not about the candidate. The usual next step is a supervised retake.

**Not scorable — incomplete:**

> **Not scored — incomplete administration**
>
> This session ended with 14 of 28 questions attempted. We do not report scores from partial sessions, because a score built on half a test is not comparable to one built on a whole test. The candidate can be re-invited; the retake uses a different set of questions.

### 5.5 Where the copy lives

A versioned string table, `report_copy_blocks`, keyed by `(surface, key, stage, locale, version)`, with the active version pinned per instrument version. Not in component source, so that copy can be reviewed and changed under a documented process without a deploy, and so that any given report can be reproduced exactly as it was rendered on the day. That last property is what a challenge under §7.5 needs.

---

## 6. Report blocks

Building on `plan-architecture.md` §7. Two new blocks, one new preset, three disablements, no PDF-specific work (the PDF path renders the same React tree).

### 6.1 `cognitive_profile` — new, category `score`

The only block that renders a cognitive score. Three states driven by `metric` and `provisional`.

**Block content, in render order:**

1. **Provisional banner** — when any contributing `participant_scores.provisional` is true. Non-dismissible, top of block, copy per §5.4.
2. **Per-scale result rows** — LR-M and LR-D, each:
   - Label: "Inductive reasoning (figural matrices)" / "Deductive reasoning".
   - Score in its stated metric, with the metric named. S1: "19 of 28 items correct". S2: "T = 58".
   - Uncertainty: S1 as a plain-language range statement; S2 as an interval bar with numeric endpoints, drawn crossing band boundaries where it crosses them.
   - Band chip: S2 only, from the `cognitive-5-percentile` preset. S1 renders "Not available".
3. **Composite row** — S2 only. Suppressed entirely while `metric = 'percent_correct'`.
4. **Comparison-group attribution** — mandatory, never suppressible. S1: the no-comparison panel or the reference-sample panel (§5.4). S2: group name, N, recruitment window, administration conditions, collection dates. Where `norm_group_id IS NULL` at S2, the block renders the no-comparison panel and suppresses the percentile — it never silently omits the attribution and shows the number anyway.
5. **Interpretation paragraph** — from the versioned copy table, keyed by band and stage. Never LLM-generated. §8.
6. **Administration notes** — advisory flags in the neutral wording of §8.6, plus partial-administration notice. Timing adjustments are never rendered here or anywhere in a client-visible surface.

**Explicitly not rendered, ever:** per-item correctness, chosen options, item content, response times, flag internals, θ or SE(θ) as raw numbers, percent correct, LR-M against LR-D on a shared axis.

### 6.2 `score_use_guidance` — new, category `narrative`, non-editable

The eight points of §4.3, fixed house copy, versioned, not client-editable. It gets its own block type rather than a locked `custom_text` because `custom_text` is editable by definition and someone will eventually edit it. Included by default in every cognitive report template; removable only by a platform admin, and its removal is logged.

### 6.3 Changes to existing blocks

| Block | Change |
|---|---|
| `cover_page` | Add instrument version, form identifier, administration date, and the provisional stamp when applicable. |
| `contents` | Register the two new blocks in `contents-sections.ts`. |
| `closing_page` | Add the standing footer: retake policy, adjustments route, challenge route, data-retention statement, and the named contact. §7.5. |
| `score_overview`, `score_detail`, `norm_comparison` | **Disabled** for factors with `metric = 'percent_correct'`. Resolver-level, unit-tested. |
| `ai_text` | **Disabled** for any assessment whose `scoring_profile` is `ability_dichotomous` or `ability_irt`. Cognitive scores get no generated narrative. Enforced in the runner, unit-tested. |
| `band-scheme.ts` | Add the `cognitive-5-percentile` preset. Add a guard rejecting attachment of any band scheme to a `percent_correct` factor. |

### 6.4 Internal surface, not a report block

Everything in §3.3 renders in `src/app/(dashboard)/psychometrics/`, gated to `platform_admin`. Item-level outcomes are key-equivalent and forbidden from any client- or candidate-facing surface (`06-…` §7.1) — the RLS on `participant_item_outcomes` already enforces this at the data layer, and the block registry should not contain a type capable of rendering it.

---

## 7. Guardrails

Product rules, enforced in code, tested, and documented in the client contract. Each of these exists because the alternative has a named failure mode.

### 7.1 No automated rejection

**Rule:** no cognitive score, band or flag may write to a candidate's status, trigger a rejection, or filter a candidate out of a list without a recorded human decision.

**Enforcement:** there is no code path from the scoring output to `participant_status` or any equivalent, and no API endpoint or webhook that accepts a score threshold as a filter parameter. Client-side list filtering by band is permitted for review convenience but produces no state change and is logged. An architecture test asserts that no module under `src/lib/scoring/**` imports a status-mutation function.

**Why:** UK GDPR Article 22 restricts decisions based solely on automated processing that produce legal or similarly significant effects, and a hiring rejection is the textbook example. The defence is not a better model; it is that the decision was not solely automated. That has to be true mechanically, not by policy.

### 7.2 Human review requirement

Before any adverse action taken with reference to a cognitive score, the platform records: the reviewing person, the timestamp, the score and interval as displayed at the time, the band, the administration notes visible to them, and a free-text reason. Adverse actions taken without that record are not blocked by us — we do not control the client's ATS — but the absence is visible in the client's own audit export, and the contract requires it.

Reviewers must complete the user-qualification module before scores are visible to their account. The module covers what the test measures, what the interval means, the eight guidance points, and the prohibited inferences. This is a BPS/EFPA test-user expectation and it is cheap to build.

### 7.3 Adverse-impact monitoring hooks

Built at S1 even though there is nothing to monitor yet, because retrofitting monitoring after launch means the first year is unmonitored.

- Protected-characteristic data, where lawfully collected, is stored in a separate table keyed by session, with its own lawful basis, its own retention period, and no read path from the scoring or reporting surfaces. It is used for aggregate analysis only.
- A scheduled job computes, per client, per configured cut, per quarter: selection rate by group, impact ratio against the highest-rate group, and the count in each group. Ratios are computed only where both groups have n ≥ 30, and are labelled with their confidence interval.
- An impact ratio below 0.80 with adequate n raises an alert to the client and to Trajectas, with the standing recommendation set: review the cut, review the job analysis, review whether a less discriminatory alternative exists, and document the review.
- Instrument-level aggregate impact across all clients feeds the technical manual and the annual DIF re-screen.
- **The honest framing that goes in the client pack:** a general mental ability measure will produce subgroup differences. The published UK meta-analytic figures make an impact ratio below four-fifths likely at most cut scores. Monitoring is not there to discover whether it happens; it is there to quantify it, to make the objective-justification case, and to force the search for alternatives. Clients who would rather not know should not use the instrument.

### 7.4 Retest policy

Per `06-…` §7.6 and `03-…` §9:

- Standard interval **180 days** per construct. Client-initiated exception at **90 days**, delivering a form with **zero item overlap** against the candidate's exposure ledger, enforced mechanically.
- **Latest score stands**, announced in advance. Norms are built from first attempts only.
- Retests offered without prejudice after a voided technical session, a blocking effort flag, or a below-floor result — and the offer copy never implies suspicion (§8.6).
- All prior attempts visible to the scoring system; only the latest is reported to the client.
- Sibling items from the same generated family are never served to the same candidate across attempts.

### 7.5 Candidate feedback and the challenge route

Structured to the ICO's explanation framework, because that is the structure a regulator will look for and it is a good structure anyway.

A standing candidate-facing page, linked from the invitation, the assessment interface and the closing page:

| Explanation | What we publish |
|---|---|
| **Rationale** | What the assessment measures, what the score is, how it is calculated (count of correct answers, converted to a comparison against a stated group), and what it is used for. |
| **Responsibility** | Trajectas builds and scores the assessment. The hiring organisation decides. Named contact for each. |
| **Data** | What is collected — responses, timings, device class, adjustments — how long it is kept, and what it is used for beyond the decision (improving the questions). |
| **Fairness** | What we have checked, in plain terms, and honestly what we have not yet checked. At M2 that sentence reads: *"We have not yet been able to check whether these questions work equally well across ethnic groups, for disabled candidates, or for candidates whose first language is not English. We say so rather than imply we have."* |
| **Safety and performance** | The margin of error, in plain language, and the instruction that candidates close together are not distinguishable. |
| **Impact** | What a score can and cannot affect in the process. |

**Challenge route.** A form, reachable without logging in, requiring only the session reference. On submission we produce the technical record: the form delivered, the responses recorded, the timings, the score as computed, the copy as rendered on the day (which is why copy is versioned, §5.5), and any flags with the thresholds in force. A qualified reviewer checks scoring integrity — key correctness, timing enforcement, delivery faults — and responds within **one month**, aligned to the UK GDPR response period, extendable once with a reason given.

What a challenge can achieve: correction of a scoring or delivery fault; a voided session and a retest where a fault is found or cannot be excluded; a written explanation. What it cannot achieve: a change to the score because the candidate disagrees with it. Say both plainly in the copy.

**Adjustments.** Extra time presets of +25% and +50% through the standard route (`03-…` §10). The adjustment is recorded as a test condition, is never visible to hiring reviewers, and is never used as a score modifier or an interpretive caveat. Where the figural format itself is a barrier, the documented position is an alternative evidence route, and a candidate is never auto-rejected on an unattempted component under a declared adjustment (`03-…` §7.4).

### 7.6 Instrument-level gates

Enforced at score-release time on the instrument version, not on the client configuration:

| Gate | Below it, the platform refuses to |
|---|---|
| M2 | Release any score to any client surface |
| M3 | Show a percentile, a T-score, or a band |
| M4 | Allow a cut score to be configured, or a decisional use path to be enabled |
| M5 | Permit any statement about job performance in client-facing material |

A gate breach is a hard failure with a logged error, not a warning.

---

## 8. The interpretation copy

Fixed, versioned, human-written, non-editable. UK English. The register is restrained and specific: the report is a document a candidate may eventually read, and it is written on that assumption. No cheerfulness, no hedging clutter, no sentence that says something about the person rather than the performance.

### 8.1 Standing preamble — every cognitive report, every stage

> **What this assessment measured**
>
> The candidate completed 18 figural matrix problems and 10 deductive reasoning problems in 34 minutes. Matrix problems present a 3×3 grid of shapes governed by rules the candidate has to work out, with one cell missing; deductive problems present a set of statements and ask which conclusion necessarily follows. Neither draws on background knowledge, vocabulary or arithmetic. Both draw on working out unfamiliar rules under time pressure.
>
> The score describes performance on those 28 problems on that day. It is one piece of evidence about one narrow ability, and it is best read alongside evidence of a different kind — a structured interview, a work sample, or a record of relevant work.

### 8.2 Band copy — S2 and above

Each band's paragraph follows the same shape: where the score sits, the interval, what it does not tell you, what to do with it. The comparison group is named by the template in every instance; `{group}`, `{n}` and `{window}` are substituted from the norm-group record and cannot be blank.

**Band A — Well above the comparison group (90th percentile and above)**

> This score places the candidate's performance at or above the 90th percentile of {group} (N = {n}, {window}). Fewer than one in ten of that group scored as highly. Allowing for measurement error, the true position is very likely somewhere above the 80th percentile — the exact figure carries a margin of roughly ten percentile points either way and should not be read more precisely than that.
>
> This tells you the candidate worked out unfamiliar abstract rules quickly and accurately under time pressure. It does not tell you how they handle ambiguity in real problems, how they work with other people, or whether they will do this job well. Candidates in this band are not distinguishable from one another on this evidence; do not rank them by it.

**Band B — Above the comparison group (70th to 89th percentile)**

> This score places the candidate's performance between the 70th and 89th percentile of {group} (N = {n}, {window}) — above most of that group. The margin of error on a test of this length means the true position could reasonably sit anywhere from around the 55th to above the 95th percentile, so treat this band and the one above it as adjacent rather than separate.
>
> Abstract reasoning is unlikely to be a limiting factor for this candidate in a role where the job analysis identifies it as relevant. It is one input; weigh it as you decided to weigh it before you saw it.

**Band C — In line with the comparison group (30th to 69th percentile)**

> This score sits in the middle range of {group} (N = {n}, {window}) — around four in ten of that group scored in this range. The margin of error is wide relative to the band: the true position could reasonably fall anywhere from the bottom fifth to the top quarter of the group. In practice this score neither recommends nor argues against the candidate.
>
> The useful conclusion is that this assessment has not differentiated this candidate, and the decision should rest on evidence that does. Do not treat a mid-range score as a mild negative; it is an absence of signal, not a weak one.

**Band D — Below the comparison group (10th to 29th percentile)**

> This score falls between the 10th and 29th percentile of {group} (N = {n}, {window}). On the problems presented, the candidate worked out fewer of the rules within the time allowed than most of that group. The margin of error is wide — the true position could reasonably fall anywhere from below the 5th percentile to around the 50th — so this score should not be treated as a precise placement.
>
> Read this alongside the administration notes below, and alongside how much this ability actually matters in the role. This score says nothing about the candidate's knowledge, experience, judgement in familiar situations, or how hard they work. If abstract reasoning is not central to the job analysis, it should not carry much weight here.

**Band E — Well below the comparison group (below the 10th percentile)**

> This score falls below the 10th percentile of {group} (N = {n}, {window}). The candidate solved substantially fewer of the problems within the time allowed than that group. Even accounting for the margin of error, the score is unlikely to reflect a position in the upper half of the group.
>
> Before this influences a decision, check three things: that the administration was complete and untroubled (see the notes below), that the score is above the interpretable range for the form, and that the job analysis identifies abstract reasoning as genuinely relevant to this role. Where all three hold, this is meaningful evidence about one narrow ability, and it remains one input among several. A single low score is not a basis for rejection on its own, and the platform will not treat it as one.

### 8.3 Pre-norm copy — S1

There are no bands, so there is no band copy. The result panel copy is at §5.4, followed by:

> **How to read this**
>
> A raw score is a count, not a comparison. Nineteen of 28 tells you how many problems the candidate solved; it does not tell you whether that is a lot. Different sets of these problems differ in difficulty, and the same candidate would score differently on a harder or easier form. Until we have a defined comparison group and calibrated the questions against it, this number supports research and product evaluation and nothing else.
>
> We would rather show you a bare count and say what it is missing than dress it up as a percentage that reads like a percentile.

With a reference sample:

> **How to read this**
>
> "Upper third" locates the score within a specific group of 400 UK adults who took the same assessment under research conditions in spring 2026. They were paid research participants, not job applicants, and they were not selected to resemble any applicant population. A group of that size supports thirds; it does not support percentiles, and we do not report them.
>
> The margin of error on a test of this length is wide enough that a candidate near a third's boundary could sit either side of it.

### 8.4 Composite copy — S2 and above

> **Overall logical reasoning**
>
> The overall score combines the two components, weighting the matrix section at 70% and the deductive section at 30%, reflecting their relative length and the matrix section's closer fit to the ability being measured. It is more reliable than either component on its own and is the score to use for decisions.
>
> The two components are not reported against each other. On tests of this length, the difference between a candidate's matrix and deductive scores would have to be very large indeed before it meant anything, and it almost never is. A candidate who appears "stronger at one than the other" on these numbers is, on the evidence available, showing measurement error.

### 8.5 Interval copy — the standing framing line

Rendered next to every interval, at every stage:

> Scores within this range are not meaningfully different. Two candidates whose ranges overlap have not been separated by this assessment.

And where an interval crosses a band boundary:

> This score's range crosses the boundary between {band_lower} and {band_upper}. Treat the candidate as belonging to both bands for decision purposes.

### 8.6 Administration notes — neutral wording

These appear on the client report. Every one is written so that it could be read aloud to the candidate without embarrassment.

| Condition | Copy |
|---|---|
| Partial administration | *"This session covered {x} of {y} scored questions. Scores from partial sessions are less precise and are not compared against the norm group. A complete retake is available."* |
| Advisory effort flag | *"Some responses in this session were faster than the questions typically take to read and solve. This can happen for several reasons and does not indicate anything in itself, but it does mean the score should be read with more caution than usual. A supervised retake would give a firmer result."* |
| Blocking effort flag | *"This session has not been scored. The pattern of response times means we cannot be confident the score would reflect the candidate's performance. A retake has been offered."* |
| Below interpretable floor | Copy at §5.4. |
| Technical fault | *"A technical fault was recorded during this session and it has been voided. A fresh invitation has been issued using a different set of questions. The candidate is not disadvantaged by this."* |
| Verification not confirmed | *"A supervised follow-up assessment produced a materially different result. We are not drawing a conclusion about why. The recommended step is a further supervised assessment before this evidence is used."* |

### 8.7 Candidate-facing completion copy

At S0 and S1:

> **Assessment complete**
>
> Thank you — your responses have been recorded. This assessment is in development and is not being used to make decisions about applications. If you would like to know what it measured, how it is scored, and what happens to your responses, that is set out here: {link}.

At S2, on request or via subject access:

> **Your result**
>
> Your performance on this assessment placed you in the band described as **{band_label}**, compared with {group}.
>
> Assessments of this length measure with a margin of error. Yours is wide enough that your result could reasonably sit in the neighbouring band, and people whose results are close together have not really been separated by this test.
>
> This measured how you worked out unfamiliar abstract rules under time pressure across 28 problems on one occasion. It does not measure your knowledge, your experience, or how well you would do the job, and it is one part of the evidence considered.
>
> If you think something went wrong with the assessment itself, you can ask us to check it: {link}.

---

## 9. Departures from the existing specs

Five, all small, all with reasons.

1. **No composite displayed before S2.** `plan-architecture.md` §4.2 step 9 computes the 70/30 composite at the sum-correct MVP. Keep the computation — the pipeline needs continuity and the column should not be null-then-populated — but suppress display while `metric = 'percent_correct'`. A weighted mean of two percent-correct scores from forms of unknown difficulty is arithmetic without a referent.

2. **Percentile floor of N = 300 at M3, not N = 500.** `06-…` §8.3 sets "no percentile against any norm group with N < 500". `plan-psychometrics.md` §5 sets M3 at ≥ 300 in a named occupational group, matching the current EFPA v2025 high-stakes bands (200–299 adequate, 300–399 good, 400–999 excellent, per norm group). Adopt 300 as the release floor for a **named occupational** norm group, and retain 500 as the floor for anything described as a general applicant norm. The distinction is the one EFPA itself draws, and it needs to be explicit in the manual rather than resolved silently in favour of whichever number is convenient.

3. **New band preset rather than an existing one.** The `3-band`/`5-band`/`7-band` presets in `band-scheme.ts` carry competency labels that attribute qualities to people. Cognitive scores get `cognitive-5-percentile` with comparison-group labels, on a neutral palette.

4. **Not-reached is asymmetric between scoring and calibration.** Scored as incorrect operationally; treated as not administered at calibration. Neither source document states this. It is standard, it is defensible, and it must be documented before the data exists rather than after.

5. **One new table, `participant_session_flags`.** `plan-architecture.md` carries `rapid_guess` on the outcome row, which is right for the item-level fact. Session-level effort and anomaly flags need their own row with a detector version and a review trail; overloading the outcome enum would lose both.

---

## 10. Build order

| Step | What | Gate |
|---|---|---|
| 1 | Outcome classification, keys, completeness gate, raw score, `participant_item_outcomes` | Unit + integration tests on every outcome branch, including the two abort conditions |
| 2 | `participant_session_flags`, fixed-threshold rapid-guessing, RTE, interpretable floor | Thresholds versioned; blocking path tested |
| 3 | `cognitive_profile` block, S1 states, `score_use_guidance` block, copy table | Percent-correct never rendered; disabled-block assertions in `tests/unit/block-registry.test.ts` |
| 4 | Guardrails: no status write path, qualification gate, challenge route, retention | Architecture test on the scoring → status import boundary |
| 5 | Adverse-impact monitoring job and separated characteristic store | Runs and reports zero rows before there is anything to report |
| 6 | S2: θ/EAP path, T-scores, empirical percentile lookup, bands, intervals | Gated on M3 as a data change, not a deploy |

Steps 1–5 are buildable now and none of them depends on a single calibrated item. Step 6 waits for Wave 1 and the norm group, and the gate is a flag on the instrument version, not a release.
