# AI-Assisted Assessment Builder — Audit, Redesign & Expansion Path

**Status:** Design proposal — not yet approved
**Date:** 2026-08-13
**Scope:** From construct idea to calibrated instrument, across measure types
**Relates to:** [`2026-05-24-ai-item-generator-refactor-design.md`](./2026-05-24-ai-item-generator-refactor-design.md) (shipped) ·
[`2026-05-29-ai-assessment-creator-build-plan.md`](./2026-05-29-ai-assessment-creator-build-plan.md) (Architect, shipped) ·
[`2026-05-25-taxonomy-unification-design.md`](./2026-05-25-taxonomy-unification-design.md) (shipped)

---

## Contents

**Part I — Where we are**
1. [State of the system](#1-state-of-the-system)
2. [What the evidence says](#2-what-the-evidence-says)

**Part II — How far AI can go**
3. [The governing principle](#3-the-governing-principle)
4. [The reach of AI, by evidence class](#4-the-reach-of-ai-by-evidence-class)
5. [Reliability by design — the forecast](#5-reliability-by-design--the-forecast)
6. [The calibration flywheel](#6-the-calibration-flywheel)

**Part III — The redesign**
7. [Architecture: stage graph + evidence ledger](#7-architecture-stage-graph--evidence-ledger)
8. [Stage-by-stage redesign](#8-stage-by-stage-redesign)
9. [Data model](#9-data-model)
10. [The builder workflow and UX](#10-the-builder-workflow-and-ux)

**Part IV — Expansion**
11. [Instrument types — the contract](#11-instrument-types--the-contract)
12. [Expansion tiers](#12-expansion-tiers)

**Part V — Delivery**
13. [Build sequence](#13-build-sequence)
14. [Integration constraints](#14-integration-constraints)
15. [Risks and open questions](#15-risks-and-open-questions)

---

# Part I — Where we are

## 1. State of the system

Three things are true at once, and the third one is the surprise.

**The generator is well-built and quietly failing.** `src/lib/ai/generation/` is a careful,
paper-faithful AI-GENIE implementation. It doesn't cheat — `walktrap.ts:95` explicitly discards the
true labels before community detection, so its numbers are honest. Those honest numbers say the method
isn't recovering construct structure (NMI 0.34–0.38 on every run since March). It also produces exactly
one artefact shape — a bare Likert stem — so "different measure types" doesn't currently exist below
the level of prose styling.

**The empirical half has never run.** Zero calibrations, zero IRT parameters, zero norms, max 13
responses on any item.

**But the empirical half is ~85% built.** This is the finding that changes the plan:

| Component | Status |
|---|---|
| `src/lib/scoring/item-statistics.ts` | ✅ **Written** — `computeItemStatistics`, `correctedItemTotalCorrelation`, `alphaIfDeleted`, `itemDifficulty`, `responseDistribution`, `distractorAnalysis` |
| `item_statistics` table | ✅ Exists — columns map 1:1 onto the function's output, plus IRT slots |
| `calibration_runs`, `dif_results`, `item_parameters`, `norm_groups`, `norm_tables` | ✅ All exist |
| `/psychometrics` dashboard (item health, reliability, norms) | ✅ Built and reading |
| **A job that writes any of it** | ❌ **Missing — nothing inserts, anywhere** |

`computeItemStatistics` is referenced exactly once in the codebase: a doc comment in
`src/lib/scoring/index.ts:37`. The entire psychometrics section is a read-only dashboard over empty
tables, waiting for one connecting job.

So "get to reliability" is not a research programme. It is **one job, then respondents.**

### Two dead types worth knowing about

`ItemScoringRubric` and `ItemMedia` are TypeScript interfaces with **no database table**. SJT scoring
infrastructure is typed but unbuilt; only `item_options.score_value` exists for keying.

## 2. What the evidence says

Production (`rwpfwfcaxoevnvtkdmkx`), read-only, 2026-08-13.

| | |
|---|---|
| Dimensions / Factors / Constructs / Items | 5 / 25 / 25 / 360 |
| Items from the AI generator | 60 (17%) |
| Items with an observer stem (360-eligible) | **0** |
| Formats with ≥1 item | Likert only. `sjt`, `forced_choice`, `binary`, `free_text` = **0 each** |
| Responses / sessions | 1,296 / 17 (12 completed) · **max 13 per item** |
| Calibrations / IRT params / norm tables | **0 / 0 / 0** |
| Generation runs | 23 stuck in `reviewing`, 8 failed, none since 2026-04-04 |
| NMI (initial → final) | **0.337 → 0.383** |

**Why NMI is low.** I sampled items evenly per construct across three runs and computed pairwise cosine
similarity, split by whether the pair shares an intended construct:

| Run | Within-construct (SD) | Between-construct (SD) | Cohen's *d* | ≈ AUC |
|---|---|---|---|---|
| `7d24cefa…` | 0.406 (0.094) | 0.347 (0.095) | **0.63** | 0.67 |
| `40aaa385…` | 0.417 (0.094) | 0.338 (0.084) | **0.89** | 0.74 |
| `06515959…` | 0.428 (0.084) | 0.343 (0.082) | **1.03** | 0.77 |

Given one same-construct pair and one different-construct pair at random, the embedding ranks them
correctly 67–77% of the time. Cluster the resulting matrix and you get communities driven by generic
workplace-language similarity. **This is not an implementation bug** — it's what happens when
general-purpose embeddings are asked to separate constructs as adjacent as "Strategic Thinking" and
"Commercial Judgement". The AI-GENIE method assumes more distant constructs than a leadership
framework contains.

---

# Part II — How far AI can go

## 3. The governing principle

> **AI can replace human judgement. It cannot manufacture human variance.**
>
> Everything a test developer *decides* is automatable today. Everything a test developer *observes*
> requires observations.

That line runs through the whole design, and the good news is that judgement is most of the labour and
nearly all of the calendar time. A traditional instrument spends weeks on SME panels, content reviews
and blueprint workshops, then a few weeks collecting pilot data. AI collapses the first part to
minutes. It cannot collapse the second — but it can make the second part **dramatically smaller**,
which is what §5 and §6 are about.

The corollary that matters commercially: **the ceiling on AI-only evidence is not "nothing". It is a
complete, defensible, provisionally-parameterised instrument** — one you can ship, run, and report on,
carrying honest uncertainty, which then sharpens with every campaign.

## 4. The reach of AI, by evidence class

| Evidence | Traditionally needs | AI-only ceiling | Real data needed |
|---|---|---|---|
| **Content validity** (does it cover the domain?) | 5–8 SMEs, days | ✅ **Complete** | none |
| **Construct discrimination** (is it distinct?) | SME panel | ✅ **Complete** | none |
| **Face validity / fairness / reading level** | Review panel | ✅ **Complete** | none |
| **Structural coherence** (does it hang together?) | Pilot, N≈200 | 🟡 Predicted r̄, ±0.10 | N≈50 to confirm |
| **Internal consistency (α)** | Pilot, N≈200 | 🟡 **Forecast ±0.08–0.12** | N≈100 to observe |
| **Item discrimination** | N≈200 | 🟡 Rank order, *r* ≈ 0.7 | N≈100 |
| **Item difficulty** | N≈200 | 🟡 Rank order, *r* ≈ 0.7 | N≈200 to calibrate |
| **Test–retest reliability** | 2 occasions | ❌ **Nothing** | 2 occasions |
| **Inter-rater reliability (360)** | Real rater sets | ❌ **Nothing** | real raters |
| **Norms / percentiles / cut scores** | N≈500 representative | ❌ **Nothing** | representative N |
| **DIF across groups** | N≈500/group | ❌ **Nothing** | group N |
| **Criterion validity** | Outcome data | ❌ **Nothing** | outcomes |

**The evidence behind the amber rows.** LLM-simulated respondents recover IRT difficulty estimates at
*r* > 0.7 against real human data ([Liu, 2025, BJET](https://bera-journals.onlinelibrary.wiley.com/doi/10.1111/bjet.13570)).
But across 285 published silicon-to-human comparisons only ~25% matched, 65% diverged, and LLM response
distributions show systematic **variance collapse** — they are too narrow
([Verian](https://www.veriangroup.com/news-and-insights/synthetic-sample-in-social-research)).

That asymmetry gives the operating rule: **rank order transfers; absolute values do not.** And because
variance collapse compresses the response distribution, synthetic α is biased **upward** — it will
flatter you. Any forecast must be shrunk, and the shrinkage must be empirically fitted (§6), not
guessed forever.

The green rows are not a compromise. Content validity *is* an aggregation of expert judgement — CVR,
CVI, Aiken's V and Lawshe's ratio are all just that. An LLM panel doing it isn't a proxy; it is doing
the job, with more raters than you could convene and perfect documentation of every rating.

## 5. Reliability by design — the forecast

This is the part that gets closest to what you asked for, and it works because **α is not a mystery —
it is arithmetic on two numbers you can influence at design time.**

Standardised alpha:

```
        k · r̄
α = ─────────────          k  = number of items
     1 + (k−1) · r̄         r̄  = mean inter-item correlation
```

So reliability is fully determined by *how many items* and *how tightly they intercorrelate*. Both are
blueprint decisions. Rearranged, it tells you the r̄ you need to hit a target:

**Mean inter-item correlation required for target α**

| items (k) | α = 0.80 | α = 0.85 | α = 0.90 |
|---|---|---|---|
| 6 | 0.400 ⚠️ | 0.486 ⚠️ | **0.600** ❌ |
| 8 | 0.333 | 0.415 ⚠️ | **0.529** ❌ |
| 10 | 0.286 | 0.362 | 0.474 ⚠️ |
| 12 | 0.250 | 0.321 | 0.429 ⚠️ |
| 15 | 0.211 | 0.274 | 0.375 |
| 20 | 0.167 | 0.221 | 0.310 |

⚠️ = narrow constructs only · ❌ = above the redundancy ceiling

The shading is the important part. Clark & Watson's guideline puts healthy r̄ between **0.15 and
0.50** — roughly 0.15–0.25 for broad constructs, 0.40–0.50 for narrow ones. Above ~0.50 you don't have
a reliable scale; you have **paraphrases of one item**. That's the attenuation paradox, and the table
makes it concrete: *α = 0.90 from 8 items is not an achievement, it's a warning.*

### What this buys the builder

The blueprint editor can compute, **before a single item is written**:

- the item count needed to reach a target α, given the facet spread you've specified;
- whether your target is in the redundancy zone (short + high α = bloated specific);
- the respondent-burden cost of each extra item;
- a **predicted α with an interval**, from three inputs: synthetic-respondent r̄ (shrunk), within-construct
  semantic homogeneity, and blueprint facet count.

So the flow becomes: *"Your blueprint has 8 items across 4 facets. That spread predicts r̄ ≈ 0.24–0.31,
so α ≈ 0.72–0.78 — under your 0.80 target. Add 3 items, or drop to 3 facets."* That is a real design
tool, it's honest about being a forecast, and no respondent is required to use it.

### What this is not

It is a **forecast**, not a measurement. It carries an interval, it says "predicted", and it is
replaced — not supplemented — the moment real α arrives. The UI must never let a forecast and an
observation wear the same badge.

## 6. The calibration flywheel

The forecast is only as good as its shrinkage factor, and the shrinkage factor is learnable.

```
  Build instrument           →  predicted r̄, predicted α, predicted difficulty rank
        ↓
  Run campaign (any client)  →  real responses
        ↓
  Item analysis job          →  observed r̄, observed α, observed difficulty rank
        ↓
  Store (predicted, observed) pair in the evidence ledger
        ↓
  Refit shrinkage            →  next instrument's forecast is tighter
```

Every campaign you already run feeds this. After ~5–10 instruments with real data you can replace the
initial guessed shrinkage constant with a fitted one and publish honest intervals. After ~20 you have
something genuinely defensible in a technical manual — and something no competitor can copy without
running the same volume.

**Two design rules that make the flywheel work:**

1. **Every prediction is stored at the time it is made**, before any data exists. Retrospectively
   "predicting" what you already observed is worthless. This is why the evidence ledger (§7) is
   append-only.
2. **Predictions are stored per-construct and per-item, not just per-instrument** — item-level
   difficulty rank correlation is the fastest-converging signal and needs the least data.

### How many respondents, honestly

With good priors you do not need the classical 200/item, because you are updating a distribution rather
than estimating from scratch:

| Milestone | Responses per item | What you can claim |
|---|---|---|
| Provisional | 0 | Content validity, discrimination, forecast α |
| Structural check | ~50 | Does it hang together as predicted? α with wide CI |
| Calibrated (CTT) | ~100–150 | Observed α, item-total r, flagged items |
| IRT 2PL | ~300–500 | Item parameters, test information |
| Norms | ~500 representative | Percentiles, cut scores |
| DIF | ~500 per group | Fairness evidence |

The first three rows are reachable from **three or four ordinary client campaigns**. That is the
difference the priors make, and it's the difference between "we need a research panel" and "we need to
ship."

---

# Part III — The redesign

## 6a. The engine boundary *(scope decision, 2026-08-13)*

The builder is a **separate engine**, not a layer on top of the runtime. It designs instruments; it
does not run them.

```
┌─────────────────────────────────┐         ┌──────────────────────────────┐
│   INSTRUMENT ENGINE             │         │   RUNTIME (untouched)        │
│   src/lib/instrument/           │         │                              │
│   instrument_* tables           │  reads  │  constructs, factors, items  │
│                                 │ ──────► │  response_formats            │
│   blueprint → generate →        │         │  participant_responses       │
│   congruence → forecast →       │         │                              │
│   evidence ledger               │         │  assessments · campaigns     │
│                                 │ ──────► │  scoring · reports           │
└─────────────────────────────────┘ publish └──────────────────────────────┘
                                    (explicit,
                                     one step,
                                     user-triggered)
```

**The contract:**

| Rule | Why |
|---|---|
| Engine writes **only** to `instrument_*` tables | A build can never corrupt live data |
| The **only** write outside that namespace is `publish` — an explicit, user-triggered step that inserts into `items` | One auditable door, not a diffuse coupling |
| No existing table gains a FK **into** `instrument_*` | One-way dependency; the engine can be dropped entirely without a migration on live tables |
| No `ON DELETE CASCADE` from the engine onto library data | Deleting a build must never delete a library item |
| The legacy generator (`src/lib/ai/generation/`) is **left running and untouched** | No regression risk; it is superseded by adoption, not by deletion |
| Math modules are pure — no DB, no network, no `server-only` | Unit-testable, coverage-gate friendly, and provably incapable of side effects |

Consequence: **every phase below is safe to ship mid-campaign.** Nothing in the engine can alter how a
running assessment is delivered or scored.

## 6b. The target

The success criterion is specific and worth stating as a test:

> **From a brief, produce an assessment of ~10 constructs × ~10 items each in which every item carries
> defensible a-priori evidence — blueprint cell, congruence verdict, fairness clearance — and every
> construct carries a reliability forecast with an honest interval. Validation follows later, from
> ordinary campaign traffic.**

That is 100 items, each traceable to a content-domain cell and a blind-rater verdict, with a predicted
α per construct and no claim made that data hasn't earned. Everything in Part III serves that sentence.

**Scoring, norms and calibration are explicitly out of scope for the first build.** The engine is
designed to *consume* response data when it arrives (§6, §7.2), but the empirical loop is deferred —
the generation side is what turns nothing into a usable instrument, and that is the gap.

## 7. Architecture: stage graph + evidence ledger

The current pipeline is a single 752-line function with a hardcoded stage order. Every new measure type
would fork it. Two structural changes fix that permanently.

### 7.1 The pipeline becomes a stage graph

```ts
interface Stage<In, Out> {
  key: StageKey
  requires: StageKey[]                  // dependency, not position
  run(ctx: BuildContext, input: In): Promise<{ output: Out; evidence: EvidenceRecord[] }>
  /** Whether a failure here blocks the build or just annotates it. */
  severity: 'blocking' | 'advisory'
}
```

The **measure type contract** declares which stages run and which gates block. `runPipeline` becomes a
resolver that topologically sorts the declared stages and executes them. Adding SJT means registering a
`scenario_generation` stage and a `key_derivation` stage and listing them in the SJT contract — not
touching the orchestrator.

This also fixes a live problem: today a critique failure, a leakage rejection and a parse error all
funnel into the same `consecutiveFailures` counter, so the pipeline can't distinguish "the model is
down" from "the critique is doing its job."

### 7.2 The evidence ledger

Every claim the system makes about an instrument gets a row:

```ts
interface EvidenceRecord {
  target: { type: 'item' | 'construct' | 'instrument'; id: string }
  claim: string                          // 'alpha' | 'assignment_accuracy' | 'item_total_r' | …
  value: number
  interval?: [number, number]
  /** THE critical field. */
  evidenceClass: 'a_priori' | 'synthetic' | 'empirical'
  method: string                         // 'congruence_panel_v2' | 'ctt_alpha' | 'forecast_v1'
  sampleSize: number | null              // null for a priori
  producedAt: string
  supersededBy?: string                  // empirical supersedes synthetic supersedes forecast
}
```

This single table does five jobs:

1. **Powers the honesty affordance** — every number in the UI renders with its evidence class and *n*.
   A forecast cannot accidentally render as a measurement.
2. **Powers the flywheel** — the (predicted, observed) pairs of §6 are just two rows with the same
   `target` + `claim` and different `evidenceClass`.
3. **Powers the technical manual** — generate it from the ledger rather than writing it by hand.
4. **Makes supersession explicit** — when real α arrives, the forecast row is marked superseded, not
   deleted. You keep the audit trail *and* the training data.
5. **Replaces the ad-hoc `aiSnapshot` blob** with something queryable.

## 8. Stage-by-stage redesign

### Keep as-is
- **Construct preflight** — the strongest existing component. Embedding similarity to *triage* pairs,
  then LLM discrimination with landscape context. Correct use of both tools. Promote from one-shot gate
  to live instrument in the structure editor.
- **Playbook presets** — rubric, exemplars, SD tolerance, critique strictness, snapshotted per run. Right
  abstraction, survives intact.
- **Item critique** — genuine a-priori quality control. Becomes one stage among several.
- **Run provenance** — better than most commercial tools. Migrates into the ledger.

### Fix
| Component | Problem | Fix |
|---|---|---|
| **NMI / WTO / bootEGA** | Presented as validity evidence; measures text similarity | Move to a **Semantic diagnostics** tab, `evidenceClass: 'a_priori'`, explicitly labelled not-validity. Keep — they're useful for spotting a pathological pool. |
| `pipeline.ts:726` | Single-construct runs hardcode `nmi: 1` | Return `undefined`; recovery is undefined with one community |
| **Bootstrap stability** | Resamples *embedding dimensions*, not cases — no sampling-theory meaning | Rename to `semantic_perturbation_stability`, or drop |
| **Difficulty targeting** | Distance-from-centroid selects *off-construct* items and labels them "hard" | Delete. Replace with LLM difficulty *ranking* (§4, *r* ≈ 0.7), stored as a prior |
| **Leakage guard** | Path-dependent (centroid moves as items are accepted) → rejects legitimate breadth, fights facet coverage in the same prompt | Make advisory-only. The blueprint's explicit exclusions do this job properly |
| **Synthetic alpha** | Variance collapse biases it upward; presented as an estimate | Rescope to feeding r̄ into the forecast, with fitted shrinkage. Never shown as α |
| **Cosine dedup** | Used for taxonomy (fails, §2) | Retain **only** for near-duplicate detection at cosine > 0.85, where it's reliable |

### Build
| Stage | What it does | Replaces |
|---|---|---|
| **Blueprint** | Facet × intensity grid with target counts; AI-drafted, human-edited | The implicit "generate 20 and hope" |
| **Congruence panel** | 3–5 blind raters assign each item among all K constructs + rate relevance → assignment accuracy, Aiken's V, Fleiss' κ, confusion matrix | **NMI as the headline metric** |
| **Fairness screen** | Reading level (Flesch–Kincaid vs audience), cultural loading, accessibility, protected-class proximity | nothing |
| **Payload completion** | Type-dependent: options, expert keys, observer stems, forced-choice blocks | nothing (only bare stems today) |
| **Reliability forecast** | Predicted r̄ and α with interval (§5) | "estimated alpha" |
| **Empirical calibration** | The missing job: `participant_responses` → `buildResponseMatrix` → `computeItemStatistics` → `calibration_runs` + `item_statistics` | nothing |
| **Prior update** | Refits shrinkage from (predicted, observed) pairs | nothing |

### Why the congruence panel replaces NMI

- **Interpretable.** *"4 of 5 blind raters assigned this item to Adaptability"* goes in a technical
  manual and survives a client's legal review. *NMI = 0.38* does not.
- **Item-level and actionable.** NMI is one number for a whole run; congruence names the item and the
  construct it leaked toward.
- **Diagnoses the construct set too.** A confusion matrix showing Strategic Thinking ↔ Commercial
  Judgement confused 40% of the time is the preflight's warning, now confirmed against real generated
  content.
- **No embedding-geometry dependency** — which §2 shows is the failing link.

## 9. Data model

Additive. Nothing changes an existing column's meaning or breaks a running campaign.

```sql
-- ── Blueprint ────────────────────────────────────────────────────────────
create table construct_blueprints (
  id uuid primary key default gen_random_uuid(),
  construct_id uuid not null references constructs(id),
  measure_type text not null,
  version int not null default 1,
  status text not null default 'draft',        -- draft | active | superseded
  target_alpha numeric,                         -- design target
  exclusions text[],                            -- what this construct explicitly is NOT
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (construct_id, measure_type, version)
);

create table blueprint_cells (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references construct_blueprints(id) on delete cascade,
  facet_label text not null,
  facet_definition text,
  intensity text not null,                      -- low | mid | high
  target_item_count int not null default 2,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ── Evidence ledger ──────────────────────────────────────────────────────
create table evidence_records (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('item','construct','instrument')),
  target_id uuid not null,
  claim text not null,
  value numeric not null,
  interval_low numeric, interval_high numeric,
  evidence_class text not null check (evidence_class in ('a_priori','synthetic','empirical')),
  method text not null,
  sample_size int,
  build_id uuid,
  superseded_by uuid references evidence_records(id),
  created_at timestamptz not null default now()
);
create index on evidence_records (target_type, target_id, claim)
  where superseded_by is null;

-- ── Congruence panel ─────────────────────────────────────────────────────
create table item_congruence_ratings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  generated_item_id uuid references generated_items(id) on delete cascade,
  rater_index int not null,
  rater_model text not null,
  assigned_construct_id uuid references constructs(id),
  intended_construct_id uuid not null references constructs(id),
  relevance int not null check (relevance between 1 and 4),
  named_facet text,
  rationale text,
  created_at timestamptz not null default now(),
  check (item_id is not null or generated_item_id is not null)
);

-- ── SJT scoring (the TS type already assumes this table) ─────────────────
create table item_scoring_rubrics (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  option_id uuid references item_options(id) on delete cascade,
  rubric_label text not null check (rubric_label in ('best','good','neutral','poor')),
  score_value numeric not null,
  explanation text,
  created_at timestamptz not null default now()
);

-- ── Column additions ─────────────────────────────────────────────────────
alter table items
  add column measure_type      text,           -- null ⇒ legacy; backfill 'competency_behavioural'
  add column validation_state  text not null default 'provisional',
  add column blueprint_cell_id uuid references blueprint_cells(id),
  add column reading_grade     numeric,
  add column sd_rating         numeric;        -- social desirability, for forced-choice matching

alter table campaigns add column is_pilot boolean not null default false;
alter table constructs add column measure_type text;
```

`item_statistics`, `calibration_runs`, `dif_results`, `item_parameters`, `norm_groups` and `norm_tables`
**already exist** and need no changes — `item_statistics` maps 1:1 onto `computeItemStatistics` output.

### Validation state

```
provisional  →  piloting  →  calibrated  →  published
                                 ↓
                          flagged / retired
```

- **provisional** — a-priori evidence complete, forecast α recorded. Usable in a pilot; **not** in a
  selection campaign.
- **piloting** — live in a campaign flagged `is_pilot`.
- **calibrated** — ≥ N responses, passed CTT item analysis.
- **published** — calibrated and the construct has a norm table.

**Backfill honestly:** the 360 live items → `measure_type = 'competency_behavioural'`,
`validation_state = 'piloting'` (they *are* in 14 active campaigns with 1,296 responses). The gate
**warns, never blocks**, until data supports promotion. Blocking on day one takes the live product down.

## 10. The builder workflow and UX

```
 ① Brief         ② Structure       ③ Blueprint        ④ Generate
   intent +    →   dims/factors/  →  facet grid +   →   per-cell
   measure type    constructs,       α forecast         batches
                   live preflight    (§5)
                                                             ↓
 ⑧ Campaign   ←  ⑦ Assemble    ←   ⑥ Review       ←   ⑤ Panel
   is_pilot       sections           coverage-first     blind raters
   → calibration  (homogeneous       + per-item         + fairness
     job            measure type)      evidence
        ↓
 ⑨ Calibrate → observed α, item stats → supersede forecasts → refit priors
```

**The blueprint grid is the spine.** Built in ③, fills in live during ④, and is the default lens in ⑥.
One artefact carried end-to-end, so "is this instrument complete?" is answerable at a glance rather than
by scrolling 200 rows.

**Two honesty affordances, everywhere.** Every number carries (a) evidence class and (b) *n*. Forecast α
renders visually distinct from observed α. An item with no response data never shows a green tick.

**③ is where the product earns its keep.** The α forecast updating live as you add facets or items — with
the redundancy ceiling drawn on the chart — is the single most differentiating screen in the build. It
turns test design from craft knowledge into a visible trade-off.

**Resumable, not wizard-locked.** ①–③ are cheap and iterative; ④ is expensive and asynchronous. A build
is a durable object you return to over days.

**Review (⑥) has three lenses over one item set:** by blueprint cell (default — the coverage audit); by
item (today's sortable table, congruence columns replacing network columns); by diagnostic (the
embedding/network view, clearly labelled).

---

# Part IV — Expansion

## 11. Instrument types — the contract

Today `measurementMode` is a prompt-styling string, so a `situational` run still emits a bare sentence
with no options and no key — which is not an SJT item. Make it an object that reconfigures the build:

```ts
interface MeasureTypeContract {
  key: MeasureType
  itemPayload: {
    requiresOptions: boolean
    requiresKey: boolean            // capability, sjt, validity_scale
    requiresObserverStem: boolean   // competency_behavioural (360)
    requiresBlock: boolean          // forced_choice
    requiresScenario: boolean       // sjt
  }
  compatibleResponseFormats: ResponseFormatType[]
  scoringContract: 'ctt_sum' | 'irt_graded' | 'keyed_correct' | 'expert_keyed' | 'ipsative'
  reverseScoringAllowed: boolean                       // false for capability
  difficultySemantics: 'endorsement_threshold' | 'item_location' | 'none'
  stages: StageKey[]                                   // §7.1 — the graph
  qualityGates: QualityGate[]
  reliabilityEstimator: 'alpha' | 'omega' | 'kr20' | 'thurstonian' | 'icc'
  requiresNormsForInterpretation: boolean
}
```

Picking a type then reconfigures generation, review, accept, assembly, scoring **and** reporting in one
move — including which reliability coefficient is even meaningful (α is undefined for ipsative
forced-choice; ICC/r*wg* is the right statistic for climate).

## 12. Expansion tiers

Ordered by build cost, not appetite. Each tier is a full vertical: generation → payload → review →
accept → assembly → scoring → report.

### Tier 1 — the existing path, near-free
| Type | What it needs |
|---|---|
| `trait` | Contract registration only. Existing Likert path. |
| `competency_behavioural` | Observer-stem generation wired up (`observer-perspective.ts` exists; **0 items have one**, so 360 is blocked today) |

Ship these with the Phase 1 refactor — no behaviour change, no new item shapes.

### Tier 2 — new payload, existing scoring shape
| Type | What it needs |
|---|---|
| `sjt` | Scenario generation, 4–5 options, **expert-key derivation with rationale**, `item_scoring_rubrics` table. Keying already supported via `item_options.score_value` (#309). Published method exists ([AIG for personality SJTs](https://arxiv.org/pdf/2412.12144)). Key agreement across raters is itself an evidence record. |
| `climate` | Mostly built — the org-diagnostic instruments (OPS/LCQ/REP) are this. Needs referent-shift wording rules and **aggregation statistics surfaced** (ICC(1), ICC(2), r*wg*) — a group-level score without them is not defensible. |

**`sjt` is the highest commercial value item on this list.** It's the format clients ask for, it's
faking-resistant, and most of the infrastructure is already there.

### Tier 3 — new scoring
| Type | What it needs |
|---|---|
| `capability` / knowledge | Keyed-correct scoring, **timing** (enforced, not just estimated), guessing parameter, KR-20 instead of α, IRT-shaped difficulty. Largest scoring change. Builds on the cognitive-ability design doc. |
| `forced_choice` | **Only with proper SD matching.** See warning below. |
| `preference` / interest | Normative vs ipsative decision; report language must not imply high = good |

> **Forced-choice warning.** `forced-choice-generator.ts` currently assembles blocks from existing
> Likert items by construct diversity alone. Faking resistance in forced-choice comes from **matching
> options on social desirability**. Without that you inherit ipsativity's full cost — scores not
> comparable between people, α undefined, factor structure distorted — and gain nothing. Either build
> it properly (items carry `sd_rating`; blocks minimise within-block SD variance; score with a
> Thurstonian IRT model) or **retire the format**. Half-built forced-choice is worse than none.

### Tier 4 — gated on data volume
| Capability | Gate |
|---|---|
| IRT calibration (2PL/3PL) | ~300–500 responses/item. Schema exists. |
| Norms / percentiles / cut scores | ~500 representative. Schema exists. |
| DIF | ~500 per group. Schema exists. |
| CAT / adaptive delivery | Requires a calibrated bank first |

Not buildable before the flywheel turns. All schema is already in place.

---

# Part V — Delivery

## 13. Build sequence

Generation-first, per the scope decision in §6a/§6b. Every phase is additive and isolated, so all of
them are safe to ship while campaigns are running.

### Phase 1 — Science core + isolated schema ✅ **DONE** *(2026-08-13, applied to production)*
Pure, tested modules in `src/lib/instrument/`: `reliability.ts` (the α forecast of §5),
`congruence.ts` (blind-panel aggregation of §8), `blueprint.ts` (coverage + validation),
`evidence.ts` (ledger supersession), `types.ts`. Plus the `instrument_*` migration.

Verified: 1366 tests pass · `tsc` and `eslint` clean · coverage 96–100% lines on all four modules
· one existing file touched (`vitest.config.ts`, coverage registration only).

Independently cross-checked: reference values for the Spearman-Brown family, Aiken's V and the
classic 14-rater Fleiss example (κ = 0.2099) were derived outside the implementation and asserted
in `tests/unit/instrument-crosscheck.test.ts`, so the tests and the modules cannot share a bug.

Production state confirmed: 7 tables, RLS on all with one policy each, all 13 FKs originating
*from* `instrument_*` with the three outbound refs (`constructs`, `profiles`, `items`) set to
`ON DELETE SET NULL`. Security advisors show no new findings.

Two isolation defects were caught and fixed before apply: `created_by → profiles ON DELETE
RESTRICT` (would have let a build block a profile deletion) and `intended_blueprint_id → 
instrument_blueprints ON DELETE RESTRICT` (would have made build deletion fail whenever
congruence ratings existed).

### Phase 2 — Stage graph + build object ✅ **DONE** *(2026-08-13)*
`src/lib/instrument/stages/` — registry with topological resolution (transitive deps, deterministic
tie-breaking, named-cycle errors) and a runner with blocking-vs-advisory failure semantics and an
injectable clock. `src/lib/dal/instrument{,-mappers}.ts` split pure/server-only per convention.
`src/app/actions/instrument.ts` — 14 actions, every one gated on `requireAdminScope()`.

### Phase 3 — Blueprint authoring ✅ **DONE** *(2026-08-13)*
AI drafting (`blueprint-draft.ts`, a pure prompt-builder + forgiving parser — needs no new
`AIPromptPurpose` and no DB prompt row), the facet × intensity grid editor, and the live α forecast
panel with the redundancy ceiling rendered as a warning and the forecast labelled "Forecast — no
response data".

Verified: 1483 tests pass · `tsc` exit 0 · `eslint` 0 issues · `next build` exit 0 with all four
`/instruments` routes compiled · coverage gate passed on all 8 pure modules (95.8–100% lines).
Only `vitest.config.ts` modified outside the engine. Every DAL query targets `instrument_*` only.

**Three real defects found and fixed during verification** (all had passed the agents' own checks):

1. **The evidence ledger stored nothing.** The Phase 1 `EvidenceRecord` type omitted `value`,
   `method` and the interval, and its `targetType` union (`'dimension' | 'scale'`) contradicted the
   production CHECK constraint (`'instrument'`). The DAL had worked around this with
   `value: 0, // required but not used` and `method: rec.claim // fallback` — so every forecast
   would have been persisted as zero. Type reconciled to the schema; `recordAlphaForecast` now
   writes the actual predicted α and its interval.
2. **`page.tsx` swallowed genuine errors into 404s** via a `try/catch` around `notFound()` — the
   same anti-pattern #328 fixed elsewhere. Removed.
3. **The grid editor was orphaned.** `build-detail.tsx` linked to
   `/instruments/[buildId]/blueprints/[blueprintId]`, a route that did not exist. Added, along with
   the `getBlueprintDetail` action it needs.

### Phase 4 — Per-cell generation ✅ **DONE** *(2026-08-13)*
`item-generation.ts` (pure cell-targeted prompt builder + forgiving parser + normalised dedup),
`stages/definitions.ts` (generation and coverage wired into the graph), bulk-insert DAL,
`generateItemsForBlueprint`, and the coverage-first candidate-items review surface.

Three settled design decisions, implemented rather than left to inference:
- **Intensity is measure-type dependent.** For `trait` / `competency_behavioural` / `preference` /
  `climate` it is an *endorsement threshold*; for `capability` / `sjt` it is *item difficulty*; for
  `validity_scale` it is meaningless and the prompt says so. Conflating these is exactly the
  difficulty-by-centroid-distance error the legacy generator makes (§1.4).
- **Contrast is two-level.** Items must be distinguishable from the blueprint's *other facets* as
  well as from the construct's exclusions. Only doing the latter lets a blueprint decay back into
  "generate 20 and hope".
- **An empty cell fails the coverage stage** — it is a content-validity hole, not a cosmetic gap.
  The review UI mirrors this: empty cells still render, styled as defects.

Verified: 1599 tests pass · `tsc` exit 0 · `eslint` exit 0 · `next build` exit 0 with all five
`/instruments` routes compiled · coverage gate passed on 10/10 pure modules (94.2–100% lines).

**Defects found and fixed in verification** (the parallel agents drifted on the module interface):
1. The actions called a generation API that did not exist (`deduplicateItems`,
   `normalizeStemForDedup`, a `targetCount` field, treating the parse result as an array). Realigned
   to the module's actual, tested surface.
2. `?? 0 > 0` — operator precedence. `??` binds looser than `>`, so the deficit check evaluated to
   `deficit ?? (0 > 0)`, yielding a number rather than a boolean. Latent only because `deficit` is
   clamped to ≥ 0, but wrong.
3. **A single cell's provider failure marked the whole run failed.** Now failures are counted
   per-cell and the run is only a failure when nothing was produced *and* the provider was the
   reason — matching the `item_generation` stage semantics.
4. **`seenStems` was never updated with newly generated items**, so later cells could duplicate
   earlier cells' output within one run.
5. `listBlueprintCandidateItems` returned a projection that dropped `blueprintCellId` — the field
   the entire by-cell review surface groups on.
6. **Orphaned items were invisible.** `blueprint_cell_id` is `ON DELETE SET NULL`, so deleting a
   cell detaches its items; a view organised purely by cell silently lost them. Now surfaced.

### Phase 5 — Congruence panel + fairness *(medium)*
Blind multi-rater assignment, Aiken's V, Fleiss' κ, confusion matrix, reading level, fairness flags.
**After this phase, §6b's target is met: 10 × 10 with defensible a-priori evidence on every item.**

### Phase 6 — Review surface + publish *(medium)*
Coverage-first review UI with the three lenses, bulk accept per cell, and the single explicit publish
door into `items`.

### Phase 7 — Measure Type contracts, Tier 1 → Tier 2 *(incremental)*
Contract registry wired into the stage graph. Tier 1 (`trait`, `competency_behavioural` + observer
stems, unblocking 360) first, then `sjt`.

### Phase 8 — Empirical loop *(deferred, small when wanted)*
The one missing job: campaign close → `buildResponseMatrix` → `computeItemStatistics` →
`calibration_runs` + `item_statistics`. The math, tables and dashboard all already exist. Deferred by
scope decision, but the evidence ledger is built from Phase 1 to receive it — empirical records simply
supersede forecasts when they arrive, no rework.

### Phase 9 — Flywheel, then Tier 3/4 *(gated on Phase 8 + volume)*

**Sequencing note.** Phases 3 and 5 are what make the output defensible; Phase 4 is what makes it
complete. Phase 8 is small and can be pulled forward at any point — it's decoupled by design.

## 14. Integration constraints

| Area | Constraint |
|---|---|
| **Live campaigns** | 14 active on 360 Likert items. New columns backfill to no-ops. Gates warn, never block. |
| **Scoring** | `src/lib/scoring/` — measure type dispatches to a scoring contract *without* changing the default CTT path. Keyed scoring (#309) exists; reuse, don't fork. |
| **Architect** | Assembles from `factors` with `is_match_eligible`. Backfilled types keep every existing factor eligible. |
| **Reports** | `ReportDisplayLevel` is dimension/factor/construct. A capability score and a trait score must not silently share a band scheme — `requiresNormsForInterpretation` drives report language. |
| **DAL** | New reads in `src/lib/dal/`. `src/components/**` must not import `createAdminClient` (`tests/architecture/no-db-in-components.test.ts`). |
| **Authz** | Builder actions gate on `canManageCampaign`, **not** `requireAdminScope` — org-admins get locked out otherwise (#311/#318 pattern). `acceptGeneratedItems` currently uses `requireAdminScope`; correct while platform-admin-only, must change if exposed to partners. |
| **RLS** | Policies on every new table from day one; `get_advisors` after each DDL change. |
| **Soft delete** | New tables carry `deleted_at`, honouring runtime enforcement from #327. |
| **Migrations** | Local → `npm run test:integration:local` → live via MCP → advisors → commit → PR (`AGENTS.md`). |
| **Worktree** | Branch into `.claude/worktrees/`. |

## 15. Risks and open questions

**Risks**

| Risk | Mitigation |
|---|---|
| **Forecast α gets treated as observed α** | Evidence class on every rendered number; visually distinct badges; forecasts superseded, not merged |
| **Optimising for α narrows constructs** (attenuation paradox) | Redundancy ceiling enforced in the blueprint editor; r̄ > 0.50 is an error, not a win |
| **Shrinkage constant stays a guess** | Phase 5 gated on ≥5 instruments with real data; until then publish wide intervals |
| **LLM congruence raters share a blind spot** | ≥2 model families; report Fleiss' κ; calibrate once against a human SME panel |
| **Pilot data never materialises** | Phase 1 rides on campaigns already running — no new respondent acquisition needed to start |

**For you**

1. **Is the AI-GENIE lineage load-bearing commercially?** Demoting NMI needs a positioning answer. My
   read: "blind expert-panel congruence + piloted item analysis + published forecast-vs-observed
   calibration" is a *stronger* story than "network psychometrics on embeddings", and survives due
   diligence better. Your call, not an engineering one.
2. **The 60 live AI-generated items** came from runs at NMI ≈ 0.35. I'd run the congruence panel over
   them retrospectively in Phase 4 and act on the result, rather than pre-emptively pulling them.
3. **Forced-choice: build properly or retire?** It is currently half-built in the costly direction.
4. **Who is the builder for?** Platform-admin only (today's assumption) or eventually partners? Changes
   the authz model and how much science can be left as an expert affordance.
5. **Is there a route to a first pilot cohort** beyond ordinary client campaigns — a partner, a panel, a
   free-assessment funnel? Not required to start, but it's what moves Tier 4 from theory to product.

**Genuinely open (technical)**

6. **How many congruence raters, which models?** Starting guess: 3 raters across 2 model families.
   Worth calibrating once against a human SME panel on a known-good construct set.
7. **Initial shrinkage constant** for synthetic → empirical r̄. Variance-collapse magnitude suggests
   something near 0.6, but that is a literature-informed guess until Phase 5 fits it.
8. **Blueprint granularity** — facet × 3 intensities is a good default; some constructs want facet-only.
   Make intensity optional per blueprint.

---

**Sources:** [Liu 2025, BJET — LLM respondents for item evaluation](https://bera-journals.onlinelibrary.wiley.com/doi/10.1111/bjet.13570) ·
[Verian — limits of synthetic samples](https://www.veriangroup.com/news-and-insights/synthetic-sample-in-social-research) ·
[Minds — silicon sampling](https://getminds.ai/blog/silicon-sampling) ·
[AIG for personality SJTs](https://arxiv.org/pdf/2412.12144) ·
[Evaluating instrumental quality of LLM-generated items](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2026.1837523/full)
