# Library Data-Quality & Ingestion Layer — Design & Plan

**Status:** Design / pre-build (deep plan, no code yet)
**Date:** 2026-06-02
**Author:** Jason Hunt (with Claude)
**Related / builds on:**
- [`2026-05-24-ai-assessment-creator-design.md`](./2026-05-24-ai-assessment-creator-design.md) — proposed the "publishability bar" + library-hardening track and deferred it. **This document is that track**, plus a new keystone: a high-level *category* layer.
- [`2026-05-29-ai-assessment-creator-build-plan.md`](./2026-05-29-ai-assessment-creator-build-plan.md) — the Architect, whose coverage + matching get materially stronger once categories exist.

---

## 1. Executive summary

The platform can now *produce* bespoke assessments (the Architect). The bottleneck has moved upstream: **the quality and structure of the library content feeding it.** Today, library content enters through manual forms or CSV import with only *structural* validation (does the row parse, do the foreign keys resolve). There is no *content-quality* gate, no high-level grouping to reason about coverage, and no defined notion of what a "complete, strong" capability record looks like.

This plan proposes four interlocking pieces:

1. **A category layer** — a controlled, high-level grouping (5 action-named categories) above dimensions, tagged on every factor. This is the keystone: it gives coverage, matching, and the data pipeline a "whole-person" frame they currently lack.
2. **A metadata completeness schema** — an explicit definition of the fields a capability record *should* carry to be publishable, with a per-record completeness score and a `draft → in_review → published` lifecycle (the publishability bar).
3. **An AI-assisted ingestion quality gate** — every record entering the library (manual, CSV, AI-structured, upload) lands in a **staging area** first, where AI assigns its category, scores completeness, checks distinctness against the existing library, and *proposes values for the gaps*; a human reviews/edits/accepts; the record is promoted to the live library only when it clears the bar.
4. **The review UI/UX** — a "library inbox" review queue + per-record review surface + a library-health dashboard. This reframes import from a one-shot CSV dump into a continuous, governed **data pipeline** — a core platform feature.

The thesis: **content quality is the product.** A psychometric platform is only as defensible as the constructs it measures. Pre-customer is the cheapest time to install the gate.

---

## 2. Current-state audit

### 2.1 Taxonomy & metadata (what exists)

Hierarchy: `dimension → factor → construct → item` (factors↔constructs via the `factor_constructs` junction since the taxonomy unification).

| Entity | Metadata it carries today |
|---|---|
| **Dimension** | name, slug, description, definition, indicators low/mid/high, anchors low/high, band labels + POMP thresholds, development/strength narrative, `source_id`, `partner_id`, scored/order/active, soft-delete |
| **Factor** | as dimension, **plus** `is_match_eligible`, `client_id`, `dimension_id` (nullable), `applicable_outcomes[]`, `applicable_levels[]`, `applicable_functions[]`, `composition_locked` |
| **Construct** | as dimension (no applicability tags); linked to factors via `factor_constructs(weight, display_order)` |
| **Item** | stem, purpose, difficulty, weight, status, `construct_id`, `response_format_id`, reverse-scored, `source_id` |

**There is no grouping level above `dimensions`.** A `competency_categories` table existed in the original schema (`00001`) but was abandoned in `00003`; `category_id` is gone from the modern tables. `factors.category_id` referenced in old types is dead.

**Implication:** the highest grouping today is `dimension`, which is mid-altitude, uneven in size, and not designed to answer "are we measuring the whole person."

### 2.2 Coverage logic (weak, by the author's own assessment — confirmed)

`src/components/architect/architect-modal.tsx` (`coverage` useMemo) groups selected factors by **`dimensionName`**, counts per dimension, and flags dimensions with zero selected factors as "gaps." The AI overview (`runArchitectOverview`) adds a 2–3 sentence narrative.

Limitations:
- **Dimension-only.** Dimensions are too granular and inconsistent to support a "whole-person" claim; "you have a gap in dimension X" is not as meaningful as "you have no read on how this person *thinks*."
- No notion of *kind* of capability (cognitive vs interpersonal vs self).
- Gaps are binary at the dimension level; no weighting, no construct-level visibility.

### 2.3 Ingestion pipeline (structural validation only)

`src/app/actions/bulk-import.ts`:
- `importLibraryRows()` — CSV/TSV → header-alias normalisation (`HEADER_ALIASES`) → per-row Zod validation (`dimensionSchema`/`factorSchema`/`constructSchema`/`itemSchema`) → FK resolution by name/slug/id → batch insert via `mappers.ts`. Errors collected per row.
- `structureLibraryImportWithAI()` — unstructured text → `library_import_structuring` prompt → **CSV text** the user pastes back into the importer. Audit-logged.
- `importLibraryBundleRows()` — prototype, not integrated.

UI: `LibraryBulkImportButton` (one entity type at a time) on the partner library page.

**What it does NOT do (the gap):**
- No content-quality assessment: a one-word definition, a trait-vs-construct confusion, or a near-duplicate of an existing factor all import silently.
- **No category** (none exists to assign).
- No completeness scoring; `name` is effectively the only hard requirement.
- No distinctness check against the existing library.
- Content goes **straight to live tables** — there is no staging/review step. Once imported, it's in the library.

### 2.4 Existing AI quality infrastructure (under-used)

Active AI purposes (13): `architect_overview, brief_extraction, chat, competency_matching, factor_item_generation, item_critique, item_generation, library_import_structuring, preflight_analysis, report_*, synthetic_respondent`.

Two are directly reusable for a content-quality gate but **only run during AI-GENIE item generation, never on ingest:**
- **`construct-preflight.ts`** (`preflight_analysis`) — a working **distinctness engine**: embeds construct definitions (`text-embedding-3-small`), computes pairwise cosine similarity, and for pairs > 0.75 runs an LLM discrimination check, returning green/amber/red per pair (`PREFLIGHT_SIMILARITY_THRESHOLD = 0.75`). This is exactly the distinctness check the ingestion gate needs — it just needs to be pointed at "new record vs existing published library."
- **`item_critique`** — reviews generated *items* for construct purity / discriminant validity / readability. The *concept* (AI critique against criteria) is the model for a factor/construct-level quality critique, which doesn't exist yet.

### 2.5 Content quality vs psychometric quality (a key distinction)

The platform already has **psychometric** (post-data) quality: `/psychometrics` (item statistics, reliability, norms, DIF). That validates content *after* responses exist.

The gap this plan addresses is **content** (pre-data) quality: is the construct well-defined, distinct, complete, correctly categorised, defensible — *before* a single respondent sees it. These are complementary; this plan is strictly the pre-data half.

### 2.6 Gaps summary

| Gap | Consequence |
|---|---|
| No high-level category | Coverage can't speak to "whole person"; matching can't balance kinds of capability |
| No completeness definition / score | Quality decays silently as the library grows; no signal of thin records |
| No content-quality gate on ingest | Vague/duplicate/mis-scoped constructs enter unchecked |
| No distinctness check at ingest | Library accumulates overlapping constructs (the preflight engine exists but isn't used here) |
| Ingest writes straight to live | No review/staging; mistakes are immediately "real" |
| No lifecycle/status | Can't distinguish a draft from a defensible, reviewed, published construct |
| No library-health view | No way to see the library's own coverage, completeness, or conflicts |

---

## 3. The category layer (keystone)

### 3.1 The five categories

Action-named, high-level, MECE-by-primary-lens. Each answers a different question about a person.

| Category | The question it answers | Typical constructs |
|---|---|---|
| **Thinking** | How do they make sense of information and problems? | analytical thinking, critical analysis, judgement, strategic/conceptual thinking, ingenuity, commercial acumen |
| **Executing** | How do they turn intent into delivered results? | execution, planning, organisation, process discipline, prioritisation, drive-to-results |
| **Relating** | How do they engage and work through other people? | communication, influence, collaboration, interpersonal sensitivity, building relationships |
| **Adapting** *(working name for the "Self" bucket — may be renamed)* | How do they manage and develop themselves? | resilience, emotional regulation, self-insight, learning agility, flexibility, achievement drive |
| **Leading** | How do they take a group somewhere? | directing action, decisive leadership, setting direction, developing people, leading change |

Lineage: this is the convergent spine of **Korn Ferry's Thought/Results/People/Self** (4-factor Leadership Architect), the **SHL Great Eight**, and the academic cognitive/interpersonal/intrapersonal tripartite — with leadership split out as its own enacted axis. It is deliberately small (5) so the coverage story stays legible.

### 3.2 Categorisation logic (stored as data, not just docs)

The decision rules below are **stored on each category row** so the AI categoriser and human reviewers reference one source of truth:

- **Primary lens test:** tag by *what is fundamentally being measured*, not where the behaviour shows up. Strategic capability is `Thinking` even though leaders use it.
- **Capacity vs enacted behaviour:** the same word can sit differently. *Strategic thinking* (cognitive capacity) → Thinking; *setting strategic direction* (aligning others) → Leading. *Influence as rapport* → Relating; *influence as mobilising a team* → Leading.
- **Interpersonal test (Relating):** does expressing the construct *require other people*? If yes → Relating (or Leading if it's about moving a group).
- **Intrapersonal test (Adapting):** is it about the person's relationship with *themselves* — emotions, growth, regulation? → Adapting.
- **One primary, optional one secondary.** Coverage counts the primary. Genuine bridgers carry a secondary tag; the AI flags low-confidence/bridging cases for human review.

### 3.3 Worked mapping of the current 25 factors (proves the model — and surfaces a real finding)

| Category | Factors (primary) | n |
|---|---|---|
| **Thinking** | Analytical Thinking, Critical Analysis, Judgement, Ingenuity, Commercial Acumen, Strategic Vision* | 6 |
| **Executing** | Execution, Organisation, Process Discipline, Decision Prioritisation, Performance Tenacity* | 5 |
| **Relating** | Communication, Influence*, Collaboration, Interpersonal Sensitivity, Building Relationships | 5 |
| **Adapting** | Resilience, Emotional Regulation, Self-Insight, Learning Agility*, Flexibility, Achievement Drive*, Visible Self-Development | 7 |
| **Leading** | Decisive Leadership, People Development | 2 |

`*` = has a meaningful secondary (e.g. Strategic Vision → Thinking/Leading; Learning Agility → Adapting/Thinking; Influence → Relating/Leading; Performance Tenacity → Executing/Adapting; Achievement Drive → Adapting/Executing).

**Finding:** the live library is heavy on **Adapting** (7) and thin on **Leading** (2). That is itself a library-level coverage gap the category layer surfaces immediately — and exactly the kind of insight that's invisible today.

### 3.4 Where it attaches & schema

Attach to **factors** (the customer-facing measured unit; coverage and matching operate on factors). A `library_categories` lookup table (not an enum) so categories are renameable and carry their own definition/decision-rule — making the "logic" first-class, editable data.

```sql
CREATE TABLE library_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT UNIQUE NOT NULL,        -- 'thinking' | 'executing' | ...
  name          TEXT NOT NULL,               -- display label (renameable)
  definition    TEXT NOT NULL,               -- what it means
  decision_rule TEXT NOT NULL,               -- how to assign it (fed to the AI categoriser)
  display_order INT  NOT NULL,
  colour        TEXT,                         -- for UI chips/coverage viz
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE factors
  ADD COLUMN primary_category_id   UUID REFERENCES library_categories(id),
  ADD COLUMN secondary_category_id UUID REFERENCES library_categories(id);
```

(Dimensions/constructs can roll up to a category later; v1 tags factors only.) Coverage then becomes: *measuring 3/5 categories — strong on Thinking & Relating, nothing in Leading.*

---

## 4. The metadata completeness schema (publishability bar)

### 4.1 What a "strong" factor record looks like

The full "strong record" field set (drawn from SHL UCF, Korn Ferry, Hogan, and Cronbach & Meehl's nomological-network idea). These split across **two readiness tiers** — see §4.2:

| Field | Status today | Purpose |
|---|---|---|
| name, slug | ✓ | identity |
| **primary_category** | new | coverage / whole-person frame |
| definition (formal) | exists, optional | what it measures |
| description | exists, optional | plain-language framing |
| indicators low / mid / high | exists, optional | behavioural anchoring (positive pole) |
| anchors low / high | exists, optional | scale meaning |
| applicable_outcomes (≥1) | exists, sparse | matcher eligibility |
| applicable_levels (≥1) | exists, sparse | matcher eligibility |
| **overuse_signature** | new | the derailer / negative pole (KF "overused", Hogan dark-side) |
| **contrasts_with (≥1)** | new | distinctness / nomological net |
| **theoretical_lineage** | new (provenance partly via `source_id`) | defensibility — where it comes from |
| ≥1 linked construct | exists | composition |

Nice-to-have (not blocking): `applicable_functions`, critical-incident exemplars.

### 4.2 Two-tier readiness (DECISION)

There are **two trust levels**, because AI matching has *no consultant in the loop* and so demands maximal data integrity, whereas a consultant-built assessment has human oversight at selection time:

| Tier | Used by | Bar |
|---|---|---|
| **Assessment-ready** (lower) | the Assessment Builder — consultant-built assessments, where a human curates the set | well-defined + measurable: primary category, definition, description, indicators low/mid/high, anchors low/high, ≥1 linked construct, ≥1 active item |
| **Match-ready** (high) | the **Architect & any AI matching**, where there is no consultant visibility | everything in Assessment-ready **plus**: `applicable_outcomes` ≥1, `applicable_levels` ≥1, `overuse_signature`, `contrasts_with` ≥1, `theoretical_lineage`, **distinctness check PASSED** (no unresolved overlap with the published library), **category human-confirmed**, and an explicit human **sign-off** (`reviewed_by`) |

Match-ready is a strict superset of Assessment-ready. **The existing `factors.is_match_eligible` flag becomes *governed by* match-ready** — a factor can only be match-eligible once it clears the high bar. This closes today's gap where the matcher can consume thin/unvetted data with a manually-flipped toggle.

**Consumption rules:**
- **Assessment Builder** (manual/consultant) → may use factors at `assessment_ready` *or* `match_ready`.
- **Architect / AI matching** → may use **only** `match_ready` factors (replaces and strengthens the current `is_match_eligible` filter).
- `draft` factors are usable nowhere customer-facing — only in the author's own test context (see the manual-override path in §5.1).

Model it as a `factor_readiness` enum and enforce promotion with two `SECURITY DEFINER` functions (EXECUTE revoked from anon/authenticated so bulk/AI paths can't bypass):
- `promote_factor_to_assessment_ready(id)` — checks the lower bar.
- `promote_factor_to_match_ready(id)` — checks the full bar incl. a green distinctness verdict; sets `is_match_eligible = true`.

- **Completeness meters** (0–100): two sub-scores shown side by side — *% toward assessment-ready* and *% toward match-ready* — in the authoring UI and the health dashboard, so an author sees exactly what each tier still needs.

```sql
CREATE TYPE factor_readiness AS ENUM ('draft', 'assessment_ready', 'match_ready');
ALTER TABLE factors
  ADD COLUMN readiness              factor_readiness NOT NULL DEFAULT 'draft',
  ADD COLUMN overuse_signature      TEXT,
  ADD COLUMN contrasts_with         TEXT[] DEFAULT '{}',   -- factor slugs
  ADD COLUMN theoretical_lineage    TEXT,
  ADD COLUMN assessment_ready_score INT,
  ADD COLUMN match_ready_score      INT,
  ADD COLUMN reviewed_by UUID REFERENCES profiles(id),
  ADD COLUMN reviewed_at TIMESTAMPTZ;
-- is_match_eligible is now derived: true only when readiness = 'match_ready'.
```

---

## 5. The AI-assisted ingestion quality gate

### 5.1 Core architectural shift: ingest → staging, not ingest → live (DECISION)

**Every** entry path — including manual single-record creation — converges on the **staging area** and the AI assessment + human review, rather than writing the live tables. This keeps one governed quality model for all content.

```
 Manual form ─┐
 CSV import  ─┤
 AI-structured text ─┼──▶  library_ingest_staging  ──▶ [AI assessment] ──▶ [human review] ──▶ promote ──▶ live tables
 File upload ─┘
```

**One escape hatch — the "quick test draft."** For fast experimentation, an author can create a record that bypasses the inbox and writes a `draft` factor directly (flagged `source = 'manual_test'`). A test draft is usable only in the author's own test context — it **cannot reach `assessment_ready` or `match_ready` without going through the gate** (the promotion functions in §4.2 enforce this). So the override buys speed for tinkering without ever letting unvetted content into a customer or AI-facing assessment.

```sql
CREATE TABLE library_ingest_staging (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL,                 -- 'factor' | 'construct' | 'dimension' | 'item'
  source       TEXT NOT NULL,                 -- 'manual' | 'csv' | 'ai_structured' | 'upload'
  payload      JSONB NOT NULL,                -- the proposed record (editable)
  ai_assessment JSONB,                        -- categorisation + completeness + distinctness + flags + gap-fills
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | assessing | needs_review | ready | promoted | rejected
  promoted_id  UUID,                          -- the live row once promoted
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.2 The assessment stage (per record)

Runs automatically when a record lands in staging. Produces `ai_assessment`:

1. **Distinctness** (reuse `construct-preflight` machinery): embed the new record's definition, nearest-neighbour against the **published** library's persisted embeddings, and for high-similarity hits run the existing LLM discrimination check → green/amber/red + the conflicting records. *(Requires persisting embeddings on published factors/constructs — see §7.)*
2. **Categorisation** (new `library_categorisation` AI purpose): from name + definition + the stored category decision-rules, return `{primary, secondary?, confidence, rationale}`. Low confidence or a strong secondary → flag for human attention.
3. **Completeness**: compute the score; list missing required fields.
4. **Gap-fill + critique** (new `library_quality_review` AI purpose): for each missing field, *propose* a value (definition, indicators, overuse signature, contrasts, lineage) grounded in the record + nearby library context; and raise **quality flags** (vague/circular definition, trait-vs-construct confusion, indicators not behavioural, overlaps with X). This is the "AI fills in gaps and keeps quality high" the brief calls for — proposals only, never silent writes.

### 5.3 New / reused AI purposes

| Purpose | New? | Role |
|---|---|---|
| `preflight_analysis` (construct-preflight) | reuse | distinctness vs published library |
| `library_categorisation` | new | assign primary/secondary category + confidence |
| `library_quality_review` | new | per-field gap-fill proposals + quality-flag critique |
| `library_import_structuring` | reuse | messy text → structured staging records (now feeds the inbox, not live) |
| `embedding` | reuse | persist embeddings for distinctness |

All editable in **Settings → AI Configuration** (so prompts/models are tunable, as with the Architect purposes).

### 5.4 Human review & promote

The reviewer sees the assessment, accepts/edits each AI proposal, resolves distinctness conflicts (merge / keep-both / cancel), clears flags, then promotes. `promote_factor_to_published` enforces the bar at the DB layer; promotion writes the live row (status=published), stamps reviewer/version, and marks the staging row `promoted`.

---

## 6. UI/UX — the library as a data pipeline

This is where "library import becomes a core feature." Three surfaces:

### 6.1 Library Inbox (ingest review queue)
An inbox-style list of staging records: status chips (needs-review / ready / conflicts), entity type, source, category (AI-suggested), completeness meter, distinctness flag. Bulk actions (assess-all, promote-ready). The CSV importer and AI-structuring tool now drop records *here* instead of writing live.

### 6.2 Per-record review surface (drawer/page)
- **Completeness meter** ("8/11 published-ready · 3 remaining") and status.
- **Category** with the AI suggestion + confidence; one-click accept, or pick another (definitions shown inline).
- **Distinctness panel** — nearest neighbours with similarity + the discrimination verdict; "merge / keep both / this is a duplicate."
- **Per-field editor** — each missing/weak field shows an **AI-suggested value** as an accept/edit chip (the "Draft this for me" pattern, applied systematically).
- **Quality flags** — inline, dismissible with rationale.
- **Promote** — disabled until the bar is met, with a checklist of what's missing.

### 6.3 Library-health dashboard (platform-admin)
- Library coverage **by category** (the library's own whole-person balance — e.g. the Leading=2 finding).
- Completeness distribution; constructs/factors below the bar; status breakdown.
- Distinctness conflicts (overlapping pairs).
- Stale records (not reviewed in >N days); records with no linked items.

The existing manual authoring forms (factor/construct/dimension) gain the same completeness meter + per-field AI assists + category picker, so *all* authoring routes share one quality model.

---

## 7. Data model & migration sketch

1. `library_categories` table + seed the 5 categories (name, definition, decision_rule, colour, order).
2. `factors.primary_category_id` / `secondary_category_id` (+ later dimensions/constructs).
3. Completeness/lifecycle columns + `factor_status` enum + `promote_factor_to_published()` (revoke EXECUTE from anon/authenticated per the SECURITY DEFINER pattern).
4. `overuse_signature`, `contrasts_with`, `theoretical_lineage`, `completeness_score` on factors (and constructs).
5. `library_ingest_staging` table (+ RLS scoped by `partner_id`/`client_id` for future multi-tenant curation; UI exposed to **platform-admin only in v1**).
6. `pgvector` embedding column on published factors/constructs + backfill + update trigger (enables ingest-time nearest-neighbour without re-embedding the whole library each time).
7. New AI purposes (enum values + seeded prompts + model configs): `library_categorisation`, `library_quality_review`.
8. Backfill: categorise + score the existing 25 factors (worked mapping in §3.3 as the seed; human-reviewed).

Every DDL step follows the established flow (local → live via MCP → `get_advisors` → commit → PR → CI).

---

## 8. Build sequence (phased — each independently valuable)

- **Phase 0 — Category layer (keystone, small, high-leverage).** `library_categories` + factor category columns + seed 5 + backfill 25 + category picker in the factor form + **upgrade Architect coverage to group by category** (replaces the weak dimension grouping). Delivers the stronger coverage story on its own.
- **Phase 1 — Completeness schema + two-tier readiness.** New metadata columns (`overuse_signature`, `contrasts_with`, `theoretical_lineage`) + `factor_readiness` enum + the two promotion gate functions + **dual** completeness meters in the factor form + per-field AI "draft" assists. **Architect match-eligibility becomes governed by `match_ready`**; Assessment Builder accepts `assessment_ready`+.
- **Phase 2 — Distinctness at ingest.** Persist embeddings; reuse construct-preflight for new-vs-library; library-health dashboard (read-only first; includes library coverage-by-category and tier breakdown).
- **Phase 3 — The ingestion staging pipeline + Library Inbox UI (the big one).** `library_ingest_staging`; route **all** ingestion (CSV, AI-structuring, upload, *and* manual) through it, plus the "quick test draft" override; the review surface; `library_categorisation` + `library_quality_review` purposes.
- **Phase 4 — Full governance.** Promote flow end-to-end, conflict resolution (merge/keep-both), versioning on published edits, stale-content surfacing.

Phase 0 alone closes the "coverage is weak" complaint and is a few days of work. Phases 1–2 harden the data. Phase 3 is the data-pipeline product.

---

## 9. Decisions (resolved 2026-06-02)

1. **Category labels** — five locked: **Thinking / Executing / Relating / Adapting / Leading**. "Adapting" is a working label, renameable (one seed row); the bucket is stable.
2. **Gate strictness → two tiers** (§4.2): `assessment_ready` (lower bar, consultant-curated) and `match_ready` (high bar, for AI matching where there's no human in the loop). `is_match_eligible` is governed by `match_ready`.
3. **Staging scope → everything routes through the gate** (§5.1), with one **"quick test draft"** override that can never reach assessment/match-ready without passing the gate.
4. **Categorisation grain → factors only for v1.** Constructs get distinctness checks only for now; dimensions roll up from their factors later.
5. **Secondary category → display-only** in coverage maths for v1 (keeps the coverage story clean; primary drives coverage).
6. **Embeddings → `text-embedding-3-small`** (matches the existing preflight engine), persisted on published factors; backfill budgeted in Phase 2.
7. **Review ownership → platform-admin only for v1**, but the staging + gate data model is built **multi-tenant-ready** (RLS scoped by `partner_id`/`client_id`) so it can extend to partner — and eventually fully self-serve **client** — curation. That "an organisation builds and governs its own competency set end-to-end" capability is an explicit longer-term goal; only the platform-admin slice ships in v1.
8. **Psychometric QA → kept separate** from content-QA for now (this is pre-data; `/psychometrics` is post-data). Link the two surfaces later.

**No open blockers — plan is execution-ready.**

---

## 10. Appendix — key files

- `src/lib/ai/generation/construct-preflight.ts` — distinctness engine (embed → cosine → LLM discrimination → green/amber/red); `PREFLIGHT_SIMILARITY_THRESHOLD = 0.75`. **Reuse for ingest distinctness.**
- `src/app/actions/bulk-import.ts` — `importLibraryRows` (CSV→validate→insert), `structureLibraryImportWithAI` (text→CSV), `importLibraryBundleRows` (prototype). **Re-target to staging.**
- `src/components/library-bulk-import-button.tsx` — current import UI entry point.
- `src/components/architect/architect-modal.tsx` — `coverage` useMemo (dimension grouping to be replaced by category).
- `src/app/(dashboard)/constructs/construct-form.tsx`, `factors/factor-form.tsx`, `dimensions/dimension-form.tsx` — authoring forms (add completeness meter + category + AI assists).
- `src/lib/ai/purpose-meta.ts`, `prompt-config.ts`, `model-config.ts` — AI purpose registry + config (add `library_categorisation`, `library_quality_review`).
- `src/lib/supabase/mappers.ts` — row mappers (extend for new fields).
- `ai_system_prompts` / `ai_model_configs` — versioned prompts + model config (Settings → AI Configuration).
