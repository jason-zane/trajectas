# Instrument & Psychometrics — Congruent Product Design

**Status:** Design proposal — not approved, nothing built from it yet
**Date:** 2026-08-14
**Supersedes the product/UX sections of:** [`2026-08-13-assessment-builder-design.md`](./2026-08-13-assessment-builder-design.md)
(that document's *science* — forecast α, congruence panel, evidence classes — still holds)

---

## Contents

**I.** [What we actually have](#i-what-we-actually-have) · **II.** [Why it doesn't cohere](#ii-why-it-doesnt-cohere)
**III.** [Product shape](#iii-product-shape) · **IV.** [The instrument workspace](#iv-the-instrument-workspace)
**V.** [Item quality](#v-item-quality-what-we-check-and-what-we-dont) · **VI.** [The psychometrics workbench](#vi-the-psychometrics-workbench)
**VII.** [Data model](#vii-data-model) · **VIII.** [AI configuration](#viii-ai-configuration)
**IX.** [Build sequence](#ix-build-sequence) · **X.** [Open questions](#x-open-questions)

---

# I. What we actually have

Audited 2026-08-14. This section is deliberately unflattering; the redesign is only as good as
its honesty about the starting point.

## The instrument engine is plumbing with routes bolted on

| Finding | Evidence |
|---|---|
| **The item-generation page is unreachable** | `/instruments/[buildId]/blueprints/[blueprintId]/items` has **no inbound link** anywhere. The core generation step can only be reached by typing a URL. |
| **Coverage is currently fiction** | All 33 candidate items in production have `blueprint_cell_id = NULL` — including all 31 published. Every item is orphaned from the blueprint that specified it. |
| **The brief is never read** | Stored on `instrument_builds.brief`, displayed as a description, and consumed by nothing. There is no step turning intent into structure. |
| **AI drafting ignores half its inputs** | `draftBlueprintWithAI` passes construct name, definition and measure type only. The user's **exclusions and target α are not sent.** |
| **The stage graph is orphaned** | The whole of `src/lib/instrument/stages/` — registry, runner, definitions, topological resolution — is imported by nothing. The actions are linear procedural calls. |
| **The evidence ledger's honesty layer is dead** | `evidence.ts` (`resolveCurrentEvidence`, `formatEvidenceLabel`, `describeConfidence`, supersession) is imported nowhere. Evidence rows are written and never read. |
| **Two dead actions** | `updateInstrumentBuild`, `deleteCandidateItem`. |

The orphaned-cell finding deserves emphasis because it wasn't a hypothetical: saving the blueprint
grid after generating items detached every item, and the "31 items across 12 cells" reported during
the end-to-end run came from a query taken *before* that save. The fix landed later; the data
damage was never checked. **The engine silently destroyed its own provenance and reported success.**

## The psychometrics surface can't answer a question

- **No scoping.** `runCalibration` accepts `since` / `until` / `notes` — the UI button calls it with
  **zero arguments**, so none are reachable. Every run is "everything, always".
- **No campaign, assessment, client or participant filter** at any level.
- **Runs are invisible and permanent.** `getCalibrationRuns()` exists; no page renders it. There is
  **no delete, no label, no comparison**. Failed and test runs accumulate forever.
- **Only ever the latest run** is displayed anywhere.
- **Reliability and Norms are static lists** — no sort, no filter. Only Item Health has search.
- **`distractorAnalysis` is orphaned**; IRT models, CAT and 360 aggregation are all unreachable.
- **Omega-total is always null** — inserted as null, displayed as a column.

## No test data can be excluded — anywhere

There is **no `is_internal` / `is_test` flag** on `participant_sessions`, `campaigns`,
`campaign_participants` or `profiles`. Production currently contains at least six campaigns whose
titles say plainly what they are: *5Brains Test 1, June test, 5Brains Master Test, EPP Test 3,
Watermark Demo, Watermark (test)*. Every psychometric number computed to date includes them.

**This invalidates all current output regardless of dashboard quality**, and it is upstream of
everything else in this document.

## The legacy generator has capability the engine lacks

This reverses my earlier "retire it" recommendation. The generator is not merely an older path:

| Generator stage | Engine equivalent |
|---|---|
| Item **critique** (second-pass LLM review, keep/revise/drop, own model + prompt) | **None** |
| **UVA / weighted topological overlap** redundancy removal | **None** |
| Bootstrap EGA item-stability filtering | None (and rightly — see §V) |
| Difficulty targeting, leakage guard | Deliberately dropped (both were unsound) |
| **Playbook presets** — rubric, exemplars, SD tolerance, difficulty mix, critique strictness | **None** |
| Synthetic respondent validation | Demoted, then discarded entirely |

Two of those are exactly the gaps identified in §V: **redundancy detection** and **a critique
pass**. And the playbook system is the only mechanism either tool has for teaching the model house
style. Deleting the generator wholesale would destroy the answer to "are the items strong?".

Scale for context: `generated_items` holds 4,404 rows of which 60 were accepted; `generation_runs`
31; `generation_presets` 4.

---

# II. Why it doesn't cohere

Three causes, and only the third is about UI.

**1. An isolation rule outlived its purpose.** To ship the engine without risking live campaigns I
forbade touching any existing file. That was right for safety and produced: four AI stages sharing
one model config, hardcoded prompts, no sidebar entry, no reuse of the generator's machinery, and a
publish step that hands off into screens the engine can't see. Nearly every incoherence traces to
that constraint never being lifted.

**2. Phases were built as deliverables, not as a product.** Each phase shipped verified, tested and
green. But "blueprint authoring" and "evidence" and "publish" were built as *routes that work*
rather than *steps in one job*. Nothing owns the whole. Hence a stage-graph orchestrator that
nothing calls, an evidence ledger nothing reads, and an items page nothing links to.

**3. The UI models the data, not the task.** The screens mirror the tables — builds, blueprints,
cells, candidate items, evidence, publish. A user doesn't think in those nouns. They think: *I want
an instrument that measures these ten things, and I want to know it's any good.*

---

# III. Product shape

Three surfaces, drawn on what question each answers.

```
┌──────────────────────────────────┐   ┌───────────────────────────────┐
│  STUDIO — build an instrument    │   │  EVIDENCE — is it any good?   │
│                                  │   │                               │
│  brief → structure → blueprint   │   │  a-priori: congruence,        │
│  → items → review → publish      │──▶│  fairness, coverage, forecast │
│                                  │   │  empirical: α, discrimination │
│  one workspace, one progress rail│   │  scoped, comparable, cleanable│
└──────────────────────────────────┘   └───────────────────────────────┘
                  │                                    ▲
                  │ publish                            │ calibrate
                  ▼                                    │
        ┌──────────────────────────────────────────────┴─────┐
        │  LIBRARY + CAMPAIGNS  (existing platform)           │
        └─────────────────────────────────────────────────────┘
```

**Studio** absorbs the item generator entirely. One place an instrument is designed. The generator's
*capabilities* (critique, redundancy, playbooks) move in; its separate UI, routes and sidebar entry
go away.

**Evidence** is the merged psychometrics surface. It is deliberately **not** part of Studio, because
it answers a different question on a different cadence — "how is what we shipped behaving", across
instruments and over time. But it is reachable from an instrument, scoped to it.

**The bridge already exists and is unused.** The evidence ledger holds a-priori, synthetic and
empirical claims against the same target with class-ranked supersession. An instrument's page should
show *forecast α 0.78, superseded by observed α 0.74 (n=142)* on one line. That is the join between
the two surfaces, and it is written but never read.

**Naming.** "Item Generator" disappears. "Instruments" becomes the Studio. "Psychometrics" becomes
Evidence — or stays Psychometrics if that reads better to customers; the important part is that
there are two surfaces, not three.

---

# IV. The instrument workspace

## The flow today

Audited literally: **8 screens, ~6 distinct user actions per construct**, and for ten constructs
roughly **40+ navigations**, one of which is impossible without typing a URL.

## The flow proposed

**One workspace. A persistent progress rail. Five steps, each resumable.**

```
  BRIEF ──▶ STRUCTURE ──▶ BLUEPRINT ──▶ ITEMS ──▶ EVIDENCE ──▶ PUBLISH
   (you)      (AI)         (AI+you)      (AI)      (AI)        (you)
```

**1. Brief.** What are you measuring, for whom, for what decision. Free text plus measure type,
audience, use-context. *This is the only step that is mostly typing.*

**2. Structure — the missing step.** AI proposes the whole construct set from the brief: names,
definitions, exclusions, and a discriminability heat-map between every pair (the existing preflight,
promoted from a hidden gate to a visible instrument). You edit, merge, split, delete. **This is what
removes ten rounds of manual entry** and is the single largest UX win available.

**3. Blueprint.** All constructs' grids in one view, drafted together so facets don't collide across
constructs. Live α forecast per construct with the redundancy ceiling drawn. Exclusions and target α
actually passed to the model (they currently aren't).

**4. Items.** Generated per cell, reviewed per cell, with coverage as the organising unit. Reachable
by clicking. Accept/reject inline.

**5. Evidence.** Congruence, fairness, redundancy, critique. Failures surface first with the specific
remedy ("this item duplicates that one", "raters assigned this to Resilience").

**6. Publish.** As built today — the preview is good — plus the promotion steps currently stranded
outside the engine (activate items, set factor readiness) brought inside as an explicit
*"Make this live"* action with the consequences spelled out.

## What makes it feel like one thing

- **A real status that advances.** `instrument_builds.status` exists and nothing sets it. Each step
  computes its own state (not started / in progress / needs attention / complete) and the rail shows
  it. You always know where you are and what's next.
- **Nothing dead-ends.** Every screen has a "what's next" affordance.
- **The workspace owns the whole job**, including the post-publish promotion.
- **Long operations are visible, not modal.** Item generation and congruence take minutes; they
  should run in the background with progress against the blueprint grid, not a spinner you must sit
  through. `instrument_stage_runs` already records this and nothing displays it.

---

# V. Item quality: what we check, and what we don't

The honest answer to *"are we testing that the items are strong?"* is **partly — and the missing
half already exists in the tool we were about to delete.**

## Checked today

| Check | Method | Verdict |
|---|---|---|
| Does it measure the intended construct? | Blind multi-rater assignment accuracy | Sound |
| Is it relevant? | Aiken's V | Sound |
| Do raters agree? | Fleiss' κ | Sound but weakened — see below |
| Is it readable / fair? | Flesch-Kincaid, idiom, protected-class flags | Sound |
| Does the set cover the domain? | Blueprint coverage audit | Sound in design, **broken in practice** (§I) |
| Will the scale hang together? | α forecast from k and r̄ | Sound, clearly labelled as forecast |

## Not checked — and each is a real hole

**1. Within-construct redundancy.** Nothing detects two items that are near-paraphrases. This is the
single most common way a scale gets inflated α and narrowed content — the bloated-specific problem
the α forecast explicitly warns about but never measures. **The generator's UVA / weighted
topological overlap already does this.** It should move into Studio as a review-stage check.

**2. A critique pass.** The generator's second-pass LLM review (keep / revise / drop, with its own
model and prompt) has no equivalent in the engine. Cheap, effective, and already written.

**3. Social desirability.** `sd_rating` is a column nothing populates. Consequences: forced-choice
can never be built properly (it needs desirability-matched blocks), and selection-context items are
never screened for the obvious-right-answer problem.

**4. Rater independence.** Our three "independent" raters are the same model with the same prompt.
Research is clear that this overstates agreement: same-model repeated sampling agrees at r ≈ 0.88–
0.92, different families at r ≈ 0.75–0.85. Moving to multiple families is worth doing but the effect
is **modest — ΔICC ≈ +0.03–0.06** — and it does not reach human-panel independence. **Position and
label bias are the larger, cheaper win: shuffle the candidate-construct order per rater**, which we
don't do at all today. Report ICC alongside κ.

**5. Difficulty / endorsement spread.** We ask the model for an intensity band and never verify the
resulting items differ. The generator's synthetic-respondent pass — demoted for good reason, since
variance collapse makes absolute values untrustworthy — is still fine for *rank-ordering* difficulty
(r ≈ 0.7). Worth reinstating for that narrow purpose only, clearly labelled synthetic.

## Explicitly not reinstated

**Bootstrap EGA / NMI item-stability filtering.** Measured on this platform's own pools, embedding
separation between constructs is Cohen's *d* ≈ 0.63–1.03 and production NMI was 0.34–0.38 on every
run. It does not work at this granularity. UVA/wTO redundancy is retained because near-duplicate
detection is the one thing embeddings *are* reliable at; community recovery is not.

---

# VI. The psychometrics workbench

## The first problem is not the dashboard

**Nothing can be excluded from analysis.** Until sessions can be marked internal, every statistic on
this surface is contaminated, and improving the views only makes the contamination better presented.
This is fix #1 for the whole document.

## Scoped, comparable, cleanable runs

A calibration run should be **a defined analysis, not a global sweep**:

- **Scope selector** — campaign(s), assessment, date window, or explicit session selection; plus a
  standing "exclude internal" default that can be turned off deliberately.
- **The scope is recorded on the run**, so two runs are comparable and reproducible.
- **Run management** — label, compare two runs side by side, delete. Deleting a test run must be
  possible; right now nothing can be removed.
- **Runs are visible.** `getCalibrationRuns()` already exists with no page behind it.

## Views that match how you think

Currently: one flat list per tab, latest run only. Proposed pivots, all over the same data:

- **By construct / factor** — the natural unit, since α is a scale property
- **By assessment** — "is *this instrument* reliable?", the question that today cannot be answered
- **By campaign** — "did this client's cohort behave differently?"
- **Over time** — α and item discrimination across runs, which is how drift becomes visible
- **By item** — the existing Item Health view, kept, plus filters that match the above

## Which analyses, in what order

Sequenced by value-per-respondent, because you will be at 10–200 per scale for a long time.

**Now — stable at small n, mostly within-person:**
- **Careless-responding detection.** Long-string (≥ 3–5 consecutive identical), even–odd
  consistency, psychometric antonyms via existing reverse-keyed pairs, response-time floors. These
  are *within-person*, so they work at n < 50, and they are the highest-value thing available at
  your current volume — they tell you which of your handful of respondents to discard.
- **Response distribution and floor/ceiling flags** — already computed, already displayed.
- **Distractor analysis** — already written, orphaned. Surface it.
- **Coverage and missingness** — how much of each scale each session actually completed.

**At n ≈ 50–150 — with intervals, never as a point estimate:**
- α with confidence intervals (Feldt), item-total correlations, α-if-deleted
- Inter-item correlation matrix — the empirical redundancy check, and the counterpart to the
  a-priori one from §V
- Self–other agreement for 360, once observer stems exist

**At n ≈ 200+ — withhold below this, don't caveat:**
- IRT 2PL/3PL, test information curves, DIF, norms and percentiles

**The rule:** anything that is misleading below its threshold should be **withheld, not shown with a
warning**. The current provisional banner is right for α at n=10; a DIF statistic at n=10 shouldn't
render at all.

---

# VII. Data model

Additive. Ordered by dependency.

```sql
-- 1. Exclude internal data. Nothing else on this surface is trustworthy without it.
alter table campaigns             add column is_internal boolean not null default false;
alter table participant_sessions  add column is_internal boolean not null default false;
-- Backfill: campaigns whose title matches test/demo/sandbox, then sessions from those campaigns.
-- Reviewed by hand before applying — a title match is a heuristic, not a fact.

-- 2. Make a calibration run a defined, reproducible analysis.
alter table calibration_runs
  add column campaign_ids    uuid[],
  add column assessment_id   uuid references assessments(id) on delete set null,
  add column include_internal boolean not null default false,
  add column label           text,
  add column session_count   int,
  add column deleted_at      timestamptz;   -- runs must be removable

-- 3. Item versioning: statistics must know which wording they describe.
alter table item_statistics add column item_version int;
alter table instrument_evidence add column target_item_version int;
-- items.item_version and items.content_hash already exist and are unused.

-- 4. Provenance that survives editing. The current linkage is already broken in production.
alter table items add column blueprint_cell_id uuid
  references instrument_blueprint_cells(id) on delete set null;
-- NOTE (2026-08-14, after investigation): the 33 existing items CANNOT be repaired.

-- 5. Item quality signals that currently have nowhere to live.
alter table instrument_candidate_items
  add column redundancy_peer_id uuid references instrument_candidate_items(id) on delete set null,
  add column redundancy_score   numeric,
  add column critique_verdict   text,     -- keep | revise | drop
  add column critique_reason    text;
-- sd_rating already exists on instrument_candidate_items and is unpopulated.
```

**Also required (no schema change):** populate `instrument_candidate_items.blueprint_cell_id` on
generation — it is set today but destroyed by grid saves; the upsert fix landed, the historical data
did not get repaired.

### The 33 orphaned items: repair is impossible, and why that matters

Investigated 2026-08-14. The repair listed above cannot be performed, and attempting it would be
actively harmful.

The items were generated 13 Aug 23:40–23:42. The Adaptability blueprint's *current* cells were
created 14 Aug 05:43 — six hours later. Resilience and Decisiveness now have **zero** cells. The item
facet labels (`Ambiguity Tolerance`, `Learning Integration`, `Reactive Adaptation`, `Role
Versatility`) and the current cell facet labels (`Composure`, `Empathy`, `Information Integration`,
`Recovery and Pivoting`, `Role Expansion`, `Self-Awareness`, `Situational Flexibility`) are
**disjoint sets** — zero overlap.

So the blueprint was redrafted by AI after generation. Every old cell was deleted and replaced with
differently-named ones, and `ON DELETE SET NULL` cut all 33 items loose. The cells those items were
written against no longer exist in any form.

Re-linking them by proximity would attach an item written for "Ambiguity Tolerance" to a cell now
called "Situational Flexibility". For an instrument whose content-validity argument *is* the
blueprint→item trace, that would not be a repair — it would be fabricated provenance, and worse than
the honest NULL, because a NULL is visibly missing whereas a wrong link looks like evidence.

**What was done instead** (migration `20260814150000_blueprint_cell_retirement.sql`): the structural
cause is fixed so it cannot recur. A cell that has candidate items attached is now *retired*
(`retired_at`), never deleted. Retired cells drop out of the working grid but stay resolvable, so
provenance survives a redraft. Re-adding the same `(facet_label, intensity)` un-retires the original
row and reunites it with its items. Items on retired cells are excluded from publish by default —
shipping an item that measures a deliberately-dropped facet is a correctness bug — but remain visible
on the authoring surface as history.

The 33 items keep their NULL. They are a record of what the engine used to do to itself.

---

# VIII. AI configuration

Today every engine stage calls `getModelForTask('item_generation')` and uses a hardcoded prompt.
`getActiveSystemPrompt` appears **zero times** in the engine.

**Proposed purposes**, each with its own model config and editable prompt:

| Purpose | Job | Wants |
|---|---|---|
| `instrument_structure` | Brief → construct set | Strongest reasoning, low temp, one call |
| `instrument_blueprint` | Construct → facet grid | Strong reasoning, low temp |
| `instrument_items` | Cell → items | Fast, cheap, higher temp, many calls |
| `instrument_critique` | Review generated items | Mid-tier; reuse the generator's existing `item_critique` prompt |
| `instrument_congruence` | Blind rater | **Multiple models** — one config per rater slot |
| `instrument_fairness` | Fairness screen | Cheapest capable, batched |

Adding a purpose requires: extending the `AIPromptPurpose` union in `src/types/database.ts`, a
`purpose-meta.ts` entry, and seeded `ai_prompts` + model-config rows. That file was off-limits under
the isolation rule; the rule is now lifted.

**Playbooks carry over.** `generation_presets` — rubric, exemplars, SD tolerance, difficulty mix,
critique strictness — is the only mechanism for teaching house style, and it survives the
generator's retirement as a Studio-level setting applied to structure, blueprint and item stages.

---

# IX. Build sequence

Each phase independently shippable, ordered so the earliest work unblocks the most.

### Phase A — Make the numbers trustworthy *(small)*
Internal-data flags + backfill; calibration scoping (campaign / assessment / date / exclude-internal)
with the UI actually passing them; run list, labels, comparison, delete. **Nothing else on the
psychometrics surface is worth improving until this exists.**

### Phase B — Repair what's broken *(small)*
Link the items route so generation is reachable. Repair the 33 orphaned cell links. Wire
`evidence.ts` so forecasts and observations render together. Delete the orphaned `stages/` directory
and the two dead actions, or wire them — but not leave them.

### Phase C — Per-stage AI config *(small–medium)*
Six purposes, editable prompts, per-rater models for congruence, plus **per-rater candidate-order
shuffling** — the cheapest real improvement to rater independence.

### Phase D — The Structure step *(medium)*
Brief → construct set with live discriminability. The largest reduction in manual work.

### Phase E — Absorb the generator's quality machinery *(medium)*
UVA/wTO redundancy detection and the critique pass move into Studio's review stage. Playbooks become
a Studio setting. Then retire `/generate`, its routes and sidebar entry — keeping the tables until
the 60 accepted items' provenance is preserved elsewhere.

### Phase F — The unified workspace *(medium–large)*
Progress rail, per-step status, background operations with visible progress, post-publish promotion
brought inside.

### Phase G — Psychometrics views *(medium)*
By construct / factor / assessment / campaign / over time. Careless-responding detection. Surface
distractor analysis. Withhold-below-threshold rules.

### Phase H — Deferred until volume exists
IRT, norms, DIF. Schema already in place.

---

# X. Open questions

1. **Does Studio replace or sit beside the Assessment Builder?** An instrument published from Studio
   becomes factors that the Architect and Assessment Builder consume. That's a clean boundary — but
   it means two places create assessments. Worth deciding deliberately.

2. **Who is Studio for?** Platform-admin only today. If partners ever build their own instruments,
   the authz model and the amount of psychometric judgement we can assume both change sharply.

3. **How much should Studio block versus warn?** Currently it warns almost everywhere. Should a
   construct with failing congruence be publishable at all? My instinct: warn, but require an
   explicit acknowledgement that is recorded in the evidence ledger.

4. **Do we keep 4,404 `generated_items` rows?** 60 became live items. The rest are history. Archive
   or drop?

5. **Human-in-the-loop arbitration.** The literature's recommendation for LLM panels is *N models
   plus a human tie-breaker on disagreement*. Is a "review the 12 items the raters disagreed on"
   queue something you'd actually use? It would move the panel from defensible to strong.

6. **Is "Evidence" the right customer-facing name** for the psychometrics surface, or does
   Psychometrics carry more weight with buyers?
