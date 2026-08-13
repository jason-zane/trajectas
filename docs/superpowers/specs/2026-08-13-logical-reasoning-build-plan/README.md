# Logical Reasoning Assessment — Build Plan

**Date:** 2026-08-13 · **Status:** Plan, approved for sequencing · **Instrument:** LR-M (figural matrices) + LR-D (deductive)
**Predecessor:** [2026-08-12 cognitive assessments research pack](../2026-08-12-cognitive-assessments/README.md)

The full engineering and psychometric plan for putting a scientifically defensible logical
reasoning assessment into Trajectas: how it works in the platform, how it is run, how it is
scored, how it is interpreted, and how the work is ticketed.

| Document | What it settles |
|---|---|
| [02 — Platform architecture](./02-platform-architecture.md) | DDL, delivery path, server-authoritative timing, scoring dispatch, practice mode, generator placement, reporting, tests, migration order, PR slicing |
| [03 — Item generation pipeline](./03-item-generation-pipeline.md) | Item spec schema, generation algorithm, distractor grammar, solution-uniqueness verification, SVG renderer, QA gates, human review, bank management |
| [04 — Psychometric plan](./04-psychometric-plan.md) | The low-N strategy, what AI can and cannot do, calibration design, sample plan and budget, the claims ladder, fairness, EFPA/BPS readiness |
| [05 — Scoring and interpretation](./05-scoring-and-interpretation.md) | Scoring pipeline, rapid-guessing and effort rules, report formats, score bands, pre-norm reporting, guardrails, interpretive copy |

---

## The headline answers

### Can AI reduce the number of human completions?

**No — and the evidence against it is stronger than the evidence for most things in this plan.**
This was the central question and it has a clear answer:

- **Frontier vision models sit near chance on abstract visual puzzles** (~28% on expert-authored
  IQ-style items), and **56% of their failures are perceptual, not reasoning**. Item error rates
  from a model would track stroke weight and element count, not relational complexity — the
  ordering would be systematically wrong in a way only a human pilot could detect.
- **LLM "respondents" are too accurate and too uniform.** IRT identifies item parameters only
  relative to a person-ability distribution; collapse that distribution and difficulty is
  off-scale and discrimination is unidentifiable. No better model fixes this — it is a
  mathematical problem, not a capability problem.
- **Discrimination is unpredictable by AI.** Across 42 LLMs, the best zero-shot correlation with
  human-calibrated discrimination was ρ ≈ 0.15–0.24. Discrimination is precisely what separates a
  usable item from a dud.
- **AI cannot produce fairness evidence in principle** — synthetic respondents have no protected
  characteristics — and fairness is the largest legal exposure this instrument carries.
- **No professional standard recognises synthetic calibration.** EFPA's 2025 model scores norm
  samples on human-N thresholds. The precedent people cite (Duolingo) calibrates AI-generated
  content on real test-taker responses.

**Where AI genuinely pays:** item *authoring* (AI-authored items beat human-authored ones on
expert paired comparison and match on realised difficulty once piloted), **pre-pilot triage**
(automated item review predicts human accept/reject at ~.75 accuracy, AUC .80 — it filters, it
does not certify, and it demonstrably fails on bias/fairness flags), and **weakly-informative
Bayesian priors** on difficulty with mandatory prior-sensitivity analysis. The saving is in
**items, not people**.

### So how many people do we actually need?

My earlier "~250" figure was too low. The honest numbers, after adversarial review:

| Milestone | N | What it licenses |
|---|---|---|
| Stage 0 cognitive pre-pilot | 25 | Item revision; no claims |
| **Wave 1 — calibration** | **400** (recruit 480) | Provisional item difficulties with SEs, internal consistency, construct-representation evidence. **Internal beta only — no candidate may be rejected on the score.** |
| **Wave 2 — fairness and norming** | **≈800**, quota-recruited | Occupation-specific norms, DIF evidence, adverse-impact ratios. This is the gate for hiring use. |
| Criterion validity | operational data | Local validity evidence |

**≈1,200 completions, ≈£15,000–17,500 in panel costs, ≈£25,000–35,000 including analysis.**

The binding constraint is **not item difficulty** — 400 people settle that comfortably. It is
**fairness evidence**: a figural reasoning test is a general mental ability test, GMA carries the
largest subgroup differences of any selection method (UK meta-analysis, 23 tests, 2m+
observations: Black–White *d* = .65), adverse impact is near-certain by construction, and a
tribunal will attack job-relatedness and impact ratios long before it attacks item parameter
standard errors. A 400-person panel yields protected subgroups of 20–80, which supports no DIF
analysis at all.

### What genuinely reduces the cost

1. **A bigger item bank from a rule-based generator** — 60–80 items, not 30. The cost lever is on
   items, and that is where AI earns its place.
2. **Rasch/1PL by CML as the pre-registered primary model**, not 2PL. Below N=500 unconstrained
   2PL by MML returns negative discriminations 11–25% of the time. Rasch difficulties are stable
   at N=400; cross-check with penalised JML and MML and report agreement.
3. **Everyone sees the same 30-item core form.** No sparse block design at small N — it costs
   nothing extra and removes the linkage fragility that makes small-N incomplete designs
   indefensible.
4. **Occupation-specific norms rather than general-population norms** — EFPA explicitly permits
   smaller N, and it is the more useful product anyway. Continuous norming across an
   age/occupation grid buys roughly 3× per-cell efficiency.
5. **Build the whole IRT/scoring/CAT pipeline against the MIT-licensed MaRs-IB *response data***
   (25,344 real trials on 384 matrix items, published Stan 3PL) before recruiting anyone. Weeks
   of engineering de-risked on real matrix-reasoning behaviour with clean provenance.

### Hard constraints discovered during verification

- **Do not anchor to MaRs-IB items.** The *response data* is MIT-licensed and usable; the
  *materials* are "academic and non-commercial purposes only". Anchoring a commercial
  instrument's scale to them would put a licence breach underneath the entire product.
- **OMIB is a dead end either way** — GPLv3 would destroy item security, and "No License" means
  all rights reserved. Both branches fail.
- **Published difficulty models are weaker than they look.** The headline R² = 0.53 for rule-based
  difficulty prediction is *circular* (regressing model output on model inputs). The honest
  out-of-sample figure is **0.43**, and **28% of true item-difficulty variance sits between clones
  identical on every modelled radical** — irreducible by any rule model. Never write "difficulty
  is known by design".
- **Distractor construction strategy is a first-class difficulty driver**, not a detail: matched-
  distractor items *p* = .525 vs perceptually-distinct *p* = .658 on a fully rule-balanced
  contrast (Δ = .133, *t* = 7.3). Bigger than moving from three rules to five. Log it as a
  generation parameter and a model term.

### Things that must never appear in any document

"AI-validated" · "difficulty is known by design" · "clones inherit the parent's parameters" ·
any norm claim before Wave 2 · any general-population norm claim.

---

## Platform shape, in brief

The full design is in [02](./02-platform-architecture.md); the architecture agent re-verified the
August audit against the code and found several corrections that change the build:

- **The two save RPCs are the correct chokepoint for deadline enforcement** — the live runner uses
  `/api/assess/save-batch` and `/api/assess/progress`, and the older server actions are dead code.
  Patch the RPCs and every path is covered.
- **`time_remaining_seconds` is not merely client-supplied — it is never written at all** in the
  live path. The column is permanently `{}`.
- **`SectionTimer` is not just unwired, it is broken**: its effect depends on `remaining`, so it
  re-creates the interval every tick and drifts. Rewrite, don't wire.
- **`item_parameters` does not fit calibration** — `UNIQUE(item_id)` with no run ID, scale version,
  or standard errors means one parameter set per item forever, contradicting the versioning
  decisions already recorded in the programme doc. It must be altered.
- **`participant_scores.construct_id` was dropped** by the taxonomy unification migration and
  `factor_id` is `NOT NULL` again, so every cognitive score must hang off a `factors` row.
- **Two hard blockers the audit missed:** `items_purpose_construct_check` forces
  `construct_id IS NULL` for any non-`construct` purpose, which breaks calibration grouping for
  new `practice`/`seed` purposes; and the documented Postgres enum-value transaction hazard means
  every new enum value needs its own migration.

## Delivery sequence

Seven PRs, each in its own worktree per `AGENTS.md`, migrations applied to live before the PR
opens:

| PR | Contents | Risk |
|---|---|---|
| 1 | Enums, item bank schema, **answer-key privilege hardening**, key-isolation tests | Low — no behaviour change |
| 2 | Server-authoritative timing: section start/finalise RPCs, deadline enforcement, new timer, expiry sweep | Medium |
| 3 | Frozen per-session forms | **Highest** — touches all assessments |
| 4 | Item spec schema, SVG renderer, `CognitiveResponse`, latency capture | Medium |
| 5 | Ability scorer + dispatcher | Medium |
| 6 | Practice mode with server-side answer checking | Low |
| 7 | Generator library, QA battery, LR-M pilot bank seed | Low — additive |

PR 1 carries a fix worth doing regardless of this project: `item_media` and
`item_scoring_rubrics` are currently readable by **anon**, and `item_options.score_value` by every
authenticated user.

## Milestones

- **M1 — platform ready.** PRs 1–6 merged; an item can be delivered, timed, and scored.
- **M2 — internal beta.** Generator + bank + Wave 1 (N=400) complete, analysis pre-registered.
  Provisional parameters with SEs. No hiring decisions.
- **M3/M4 — normed and fairness-evidenced.** Wave 2 (N≈800). Occupation-specific norms, DIF,
  adverse-impact monitoring live. Score may inform hiring decisions as *support*, never as a gate.
- **M5 — criterion evidence.** Local validation from operational data; technical manual mapped
  section-by-section to the EFPA Test Review Model v2025.
