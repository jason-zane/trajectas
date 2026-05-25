# AI Assessment Creator — Design Document

**Status:** Exploration / pre-build
**Date:** 2026-05-24
**Author:** Jason Hunt (with Claude)
**Related:**
- [`2026-04-20-org-diagnostic-campaigns-and-roles-design.md`](./2026-04-20-org-diagnostic-campaigns-and-roles-design.md)
- [`2026-05-25-taxonomy-unification-design.md`](./2026-05-25-taxonomy-unification-design.md) — **prerequisite, implemented 2026-05-25**: the matcher and wizard described here operate exclusively on factors; construct-level matching, scoring, and display are no longer surfaced to customers.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Concept](#the-concept)
3. [Why Now](#why-now)
4. [Current Platform State](#current-platform-state)
5. [The Library Quality Problem](#the-library-quality-problem)
6. [Proposed Library Schema Additions](#proposed-library-schema-additions)
7. [Quality Enforcement: The Publishability Bar](#quality-enforcement-the-publishability-bar)
8. [AI Matcher Pipeline](#ai-matcher-pipeline)
9. [UI Direction](#ui-direction)
10. [Build Sequence](#build-sequence)
11. [Open Questions](#open-questions)
12. [External Grounding (I-O Psych Frameworks)](#external-grounding-i-o-psych-frameworks)
13. [Appendix: Relevant Files](#appendix-relevant-files)

---

## Executive Summary

A wedge product: an AI-powered "fast lane" for generating bespoke psychometric assessments. An admin pastes a position description (or free text, or uploads a doc), names the decision they're making, and the system uses AI to select a coherent set of constructs from the existing library and assemble a publishable assessment in minutes.

This is **parallel to** the org-diagnostic flow, not in competition with it. Both share the same downstream matching + assembly stages; they differ in how the "brief" is sourced: stated intent (this product) vs measured organisational reality (the diagnostic).

**The critical insight:** the matcher's quality is bounded by the library's metadata depth. Library hardening must come first. We are pre-customer, so the cost of retrofitting metadata and tightening the quality bar is at its lowest.

**Recommendation:** do the library work and the wedge product together, library first. Don't build a separate competency-builder tool — the existing one (`construct-form.tsx`) is substantive; extend it.

---

## The Concept

### The flow

1. Admin opens a quick wizard modal from the dashboard
2. They paste a position description / type free text / upload a document
3. They name the **decision** they're making (selection, development, team composition, etc.)
4. AI extracts a structured "brief" from the input
5. AI matches the brief against the construct library, ranking + selecting an appropriate subset
6. Admin reviews the picks — each with a rationale — and can swap, remove, or add
7. Live counters show estimated assessment length and item count as the user tweaks
8. Admin names the assessment and saves; system generates/assembles items

### Inputs

- Free text (plain English description of the role / use case)
- Uploaded position description (PDF/DOCX → text extraction)
- Optional structured fields: role title, level, function

### Outputs

- A draft assessment with constructs selected, weighted, and ordered
- Item count and time estimate
- Per-construct rationale ("why this construct was selected for this brief")

### What this is NOT

- Not a generic competency-framework picker (the matcher is grounded in *our* library, not a third party's)
- Not an item generator from scratch (items come from existing pools or existing generation pipelines)
- Not the org diagnostic product (that one starts from measured reality, not stated intent)
- Not multi-tenant for v1 (one global library; client-specific competencies are a v2 problem)

---

## Why Now

Three reasons this is the right next product:

1. **Time-to-value collapses from weeks to minutes.** The org diagnostic needs data collection. This needs a paste-bin and three clicks. Far cheaper sales conversation.
2. **De-risks the diagnostic.** Both flows share matching and assembly. Building this first proves out those stages without needing the diagnostic data layer.
3. **Library is small enough to retrofit.** Pre-customer, hardening the schema and backfilling metadata is cheap. Six months and several clients from now, it isn't.

### Cannibalisation risk

A working fast-lane could undercut the higher-touch diagnostic engagement. Deliberate positioning needed:
- **This product:** quick, single-role, stated-intent, "starter"
- **Diagnostic product:** organisation-wide, measured, strategic, transformational

If positioning blurs, the more valuable conversation never starts.

---

## Current Platform State

We are extending a mature platform, not building from scratch. Survey findings:

### Library hierarchy

3-level hierarchy with a "skip factors" mode:

```
dimensions (top, e.g. "Strategic Thinking")
  └─ factors (middle, e.g. "Systems Analysis")
      └─ constructs (leaf, what items measure, e.g. "Pattern Recognition")
          └─ items (questions)
```

The `scoring_level` enum on `assessments` lets dimensions link directly to constructs, skipping the factor layer. Junction tables: `dimension_constructs`, `factor_constructs`, `assessment_constructs`, `campaign_assessment_constructs`.

### Construct admin form — already substantive

`src/app/(dashboard)/constructs/construct-form.tsx` captures:

| Field | Type | Required? |
|---|---|---|
| `name` | text | yes |
| `slug` | text (auto-generated) | yes |
| `description` | rich text | no |
| `definition` | rich text (formal definition for reports) | no |
| `indicatorsLow` / `indicatorsMid` / `indicatorsHigh` | rich text | no |
| `strengthCommentary` | rich text (for reports) | no |
| `developmentSuggestion` | rich text (for reports) | no |
| `anchorLow` / `anchorHigh` | text, ≤150 chars | no |
| `sourceId` | FK to `content_sources` | no |
| `isActive` | boolean | yes |
| parent factor relationships | many-to-many | no |
| dimension relationships | many-to-many | no |
| linked items | one-to-many | derived |

UI is tabbed (Details / Indicators / Items / Relationships / Settings) with field-level auto-save and unsaved-changes guard.

### Wizard scaffolding

`src/components/action-dialog/`:
- `ActionDialog` — modal shell
- `ActionWizard` — stepper with back/next/complete, validation gates (`canAdvance`), async submission (`isSubmitting`), slide animation

Reference implementation: `src/components/campaigns/quick-launch-modal.tsx`. Reuse this — building a new modal shell would be wasted work.

### AI infrastructure

- `ai_system_prompts` table — versioned, purpose-tagged. `competency_matching` is already an enumerated purpose. `library_import_structuring` already takes external content and produces import-ready CSV.
- `ai_model_configs` — pluggable provider/model registry
- `matching_runs` + `matching_results` — execution + output for the matcher
- `generation_runs` — item generation execution
- Construct-distinctness preflight is at v3 (`00055_v5_construct_v3_factor_v3_preflight_prompts.sql`)

### Content provenance

`content_sources` table (`20260515160000_content_sources.sql`) is admin-managed and joined via nullable `source_id` on dimensions, factors, constructs, items, assessments. Independent of `clients` — it's a label, not a tenancy relationship.

---

## The Library Quality Problem

The construct form captures the right *kinds* of fields, but two structural gaps make scaling difficult:

### Gap 1 — Metadata depth for AI matching

Today's fields describe **what a construct measures**. They don't describe **when it's appropriate to measure it**, **what nearby constructs it's distinct from**, or **what it looks like at the edges**. All three matter for AI matching quality.

### Gap 2 — Quality enforcement is field-by-field at insert, not workflow-based

Only `name` is required. Everything else is optional at every status. As the library grows, this is how content quality decays: well-intentioned drafts ship with three of nine fields filled, and there's no signal to anyone that they're incomplete.

### Gap 3 — No versioning on published constructs

When a published construct is edited, the prior definition is lost. This breaks psychometric defensibility: scores from a 2026 assessment can't be tied to the construct definition as it existed in 2026.

---

## Proposed Library Schema Additions

In rough order of "would change matching quality" → "nice for defensibility":

### 1. `overuse_signature` (rich text)

> "When overused or misapplied, this looks like…"

Borrowed from **Korn Ferry / Lominger** ("overused skill") and **Hogan** (dark-side derailers). Differentiates a serious library from a generic one. Gives the matcher a signal to down-weight constructs that would be problematic given the brief's context (e.g. "decisive" overused → bullying; useful to know when picking for a collaborative culture).

### 2. Critical-incident exemplars (new table)

Separate `construct_exemplars` table:

```sql
CREATE TABLE construct_exemplars (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  construct_id UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,
  pole         TEXT NOT NULL CHECK (pole IN ('low', 'high')),
  vignette     TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

2-3 concrete situational vignettes per pole per construct. **Stronger than abstract indicators for AI matching from a JD**, because JDs are themselves situational. Grounded in Flanagan's Critical Incident Technique (1954) — the lineage for the BARS tradition.

Example for "Stakeholder Framing":
- Low: "Sends a 47-slide deck to executives without a one-page summary; loses the room in the first minute."
- High: "Walks into a board meeting having pre-tested the framing with two directors; the discussion lands on the right tension within five minutes."

### 3. Applicability metadata (tag arrays on `constructs`)

```sql
ALTER TABLE constructs
  ADD COLUMN applicable_outcomes TEXT[] DEFAULT '{}',
  ADD COLUMN applicable_levels   TEXT[] DEFAULT '{}',
  ADD COLUMN applicable_functions TEXT[] DEFAULT '{}';
```

- `applicable_outcomes`: `selection | development | team_composition | succession | coaching`
- `applicable_levels`: `ic | first_line_manager | mid_manager | senior_leader | executive`
- `applicable_functions`: free tags (sales, engineering, ops, ...) — kept loose because job families are messy

Tags-on-rows is the right structural level here. A separate `construct_applicability` table is overbuilt; these are facets of the construct row, not entities in their own right.

### 4. `contrasts_with` (text array)

```sql
ALTER TABLE constructs
  ADD COLUMN contrasts_with TEXT[] DEFAULT '{}';
```

2-4 nearby constructs this is meant to be distinct from (stored as construct slugs). The preflight pipeline (`00055_v5_construct_v3_factor_v3_preflight_prompts.sql`) already computes this at generation time and throws it away. Persisting it:
- Gives the matcher a dedupe signal (don't pick both "curiosity" and "openness to learning")
- Helps authors avoid future overlap when adding new constructs
- Encodes the nomological network (Cronbach & Meehl, 1955) for defensibility

### 5. `theoretical_lineage` (short text)

```sql
ALTER TABLE constructs
  ADD COLUMN theoretical_lineage TEXT;
```

Examples:
- "Big Five (Conscientiousness, NEO-PI-R)"
- "Goleman 1995 — Emotional Intelligence"
- "Originated for Trajectas"

Cheap to add. Matters for defensibility when a client psychologist asks where a construct comes from.

### 6. Item burden estimate

```sql
ALTER TABLE constructs
  ADD COLUMN typical_item_count        INT DEFAULT 4,
  ADD COLUMN typical_seconds_per_item  INT DEFAULT 20;
```

Lets the wizard show "this selection ≈ 14 min" live as the user tweaks picks. Hand-set default; can later be derived from `items` joins.

### 7. Embeddings — deferred

`pgvector` on the constructs table, populated via embedding-on-insert/update. **Defer until the library outgrows pure-LLM matching** (probably ≥200 constructs). For v1, pass the full library description set into a single LLM call. Don't build vector infrastructure just because it's the textbook answer.

### Summary table

| Field | Purpose | Effort | Priority |
|---|---|---|---|
| `overuse_signature` | Matcher context fit; report nuance | Low | High |
| `construct_exemplars` (table) | Matcher quality from JDs | Med | High |
| `applicable_outcomes/levels/functions` | Matcher eligibility filtering | Low | High |
| `contrasts_with` | Matcher dedupe; authoring guidance | Low | High |
| `theoretical_lineage` | Defensibility | Low | Med |
| `typical_item_count`/`seconds` | Wizard UX (live time estimate) | Low | Med |
| Embeddings (`pgvector`) | Scale matching past ~200 constructs | High | Defer |

---

## Quality Enforcement: The Publishability Bar

Required-at-insert is the wrong gate. **The bar tightens at promotion, not at creation.**

### Status workflow (extend `isActive`)

```sql
CREATE TYPE construct_status AS ENUM (
  'draft',
  'in_review',
  'published',
  'archived'
);

ALTER TABLE constructs
  ADD COLUMN status construct_status NOT NULL DEFAULT 'draft',
  ADD COLUMN reviewed_by UUID REFERENCES profiles(id),
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN published_at TIMESTAMPTZ;
```

### Promotion rules

A construct cannot move to `published` unless it has:
- `description` non-empty
- `definition` non-empty
- All three indicators (low/mid/high) non-empty
- Both anchors (low/high) non-empty
- `overuse_signature` non-empty
- ≥1 `construct_exemplar` per pole (so ≥2 total)
- `theoretical_lineage` non-empty
- ≥1 entry in each of `applicable_outcomes`, `applicable_levels`
- ≥1 entry in `contrasts_with`

Enforced in a DB function:

```sql
CREATE FUNCTION promote_construct_to_published(p_construct_id UUID)
RETURNS void AS $$
DECLARE
  c RECORD;
  exemplar_low_count INT;
  exemplar_high_count INT;
BEGIN
  SELECT * INTO c FROM constructs WHERE id = p_construct_id;
  -- ... validation checks ...
  -- raise on any failure with a specific message
  UPDATE constructs
    SET status = 'published',
        published_at = now(),
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = p_construct_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Enforcing at the DB layer means AI agents and bulk imports can't skip it.

### Completeness indicator in the UI

A header bar in the construct edit form: "8/10 published-ready fields complete · 2 remaining". Author-facing, not blocking. Tells you what's missing without being annoying at draft stage.

### Library health dashboard

Platform-admin-only page. Per-construct rows:
- Completeness score (0-10)
- Status
- Last reviewed date
- Linked item count
- Linked assessment count

Aggregate widgets:
- Constructs by status (per dimension)
- Average completeness by dimension
- Constructs with no linked items
- Constructs not reviewed in >180 days

### Versioning

```sql
CREATE TABLE construct_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  construct_id  UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,
  version_num   INT NOT NULL,
  snapshot      JSONB NOT NULL,  -- full row at time of snapshot
  snapshotted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshotted_by UUID REFERENCES profiles(id),

  UNIQUE (construct_id, version_num)
);
```

Trigger: any UPDATE to a row with `status = 'published'` snapshots the prior version. Score tables (`participant_scores`) get an optional `construct_version_id` so we can tie a 2026 score to the 2026 definition.

### AI-assisted authoring

Per-field "Draft this for me" button in the existing form:
- "Draft overuse signature"
- "Suggest 3 critical incidents from these indicators"
- "Generate contrast set from the description"

Same AI infra that powers the matcher. Author reviews and edits. Cuts authoring time without lowering the bar.

---

## AI Matcher Pipeline

### Stage 1 — Intent capture

Single input: paste/upload/free text + outcome chip-picker. Don't fragment this into three separate forms. The model can handle ambiguity better than the user can self-classify.

### Stage 2 — Brief extraction

One LLM call with structured output:

```ts
type Brief = {
  role_title: string;
  level: 'ic' | 'first_line_manager' | 'mid_manager' | 'senior_leader' | 'executive';
  function: string;
  outcome: 'selection' | 'development' | 'team_composition' | 'succession' | 'coaching';
  responsibilities: string[];        // 3-7 bullets
  context_signals: string[];         // e.g. "fast-growth startup", "matrixed org", "regulated industry"
  technical_requirements: string[];  // domain skills mentioned
};
```

Show the brief back to the user in Stage 3 so they can sanity-check the model's reading.

### Stage 3 — Matching

Two architectural options:

**Option A — Pure-LLM ranking (recommended for v1)**
- Feed brief + all eligible constructs (filtered by `applicable_outcomes`/`applicable_levels`) in one prompt
- Model returns ranked list with rationale per pick
- Works at <100 constructs
- No new infrastructure

**Option B — Retrieve-then-rerank (for scale)**
- Embed brief
- Vector-search top ~30 constructs
- LLM reranks with rationale
- Adds pgvector, embedding column, backfill job, update trigger

**Decision rule:** start with A. Switch to B when matching latency or cost becomes the bottleneck, or when library exceeds ~150 constructs.

### Stage 4 — Review surface

Ranked list of picks. For each:
- Construct name + description
- **Rationale** ("This matters because the JD emphasises ambiguity tolerance, and this construct measures decision-making under incomplete information")
- Swap / remove controls

Below the list: running counters
- Estimated total items: ∑ `typical_item_count`
- Estimated time: ∑ (`typical_item_count` × `typical_seconds_per_item`) / 60

Add-construct: search bar at the bottom of the list.

### Stage 5 — Item assembly

Open question (see below). Two paths:
- Fresh item generation per construct via existing pipeline (high latency, high quality, novel items)
- Pull from existing item pools per construct (low latency, reuses calibrated items)
- Hybrid: pool first, generate to fill gaps

---

## UI Direction

Reuse `ActionDialog` + `ActionWizard`. Four steps:

1. **Brief** — single dense textarea + file upload affordance + outcome chip-picker. One step, not three.
2. **Reviewing…** — loading state. Show the extracted brief back to the user ("We read this as: Senior PM, IC-track, hiring decision. Continue?") so they can sanity-check before the matcher runs.
3. **Picks** — ranked construct list with rationales, swap/remove/add, live time + item counters. Dialog likely needs to be wide (`max-w-4xl`) because rationale text needs reading room.
4. **Name + create** — name the assessment, optional visibility/access settings, submit.

### Why a modal (not a full page)

Preserves the "quick action" framing. A full page would invite over-investment in tweaks. The modal communicates "this should take 3 minutes" — which it should.

### When the modal pattern would break

If Step 3 starts feeling cramped (more than ~12 picks, long rationales, edit affordances stacking up), shift the dialog wider. Don't shift to a side panel or sheet — those communicate "this is a long-running edit," which fights the framing.

---

## Build Sequence

Library work and wedge product can proceed in parallel; library first within each track.

### Track A — Library hardening

1. **Migration: schema additions** — new columns (`overuse_signature`, `applicable_*`, `contrasts_with`, `theoretical_lineage`, `typical_item_count`, `typical_seconds_per_item`), new tables (`construct_exemplars`, `construct_versions`), new status enum + columns
2. **Migration: `promote_construct_to_published` DB function**
3. **Backfill** — add critical incidents, overuse signatures, applicability tags, contrast constructs to existing constructs. Largest hand-work item. AI-assisted with human review.
4. **Construct form extensions** — new field UI, completeness indicator, "promote to published" action with validation feedback
5. **Library health dashboard**
6. **Versioning trigger** — snapshot on update where `status = 'published'`
7. **AI authoring assists** — per-field draft buttons

### Track B — Wedge product

1. **`brief_extraction` prompt** — new row in `ai_system_prompts`
2. **Sharpen `competency_matching` prompt** — consume new metadata fields
3. **File ingestion** — PDF/DOCX → text (check whether `content_sources` infra covers this)
4. **Wizard scaffold** — new component reusing `ActionWizard`, 4 steps
5. **Step 3 (picks UI)** — the design-heavy step; ranked list + rationale + counters + add/swap/remove
6. **Assembly + save** — wire to existing assessment-creation paths
7. **Item assembly strategy** — depends on open question

---

## Open Questions

These should be answered (or at least taken positions on) before significant code work begins.

### 1. Library size today

How many live constructs / factors / dimensions exist? Determines whether pure-LLM matching is sufficient for v1 or whether embeddings are needed up front.

**How to answer:** quick SQL count against the live database.

### 2. `anchor_definitions` semantics

What does the `anchor_definitions` migration (`20260416044746_anchor_definitions.sql`) actually anchor — scale wording (Likert points) or construct poles (low/high meaning)? If construct poles, we may not need new exemplars fields; if scale wording, exemplars is a separate concern.

**How to answer:** read the migration in full + look at where the fields are consumed in code.

### 3. How much existing content already meets a tighter publishability bar?

Informs whether the bar can be applied retroactively to existing constructs (auto-promote those that meet it) or only to new ones.

**How to answer:** after backfill plan is set, run a dry-run query of how many constructs would pass each version of the gate.

### 4. Constructs to deprecate

Pre-customer is the cheapest time to prune. Old experimental constructs that no longer reflect the model should be archived now.

**How to answer:** Jason reviews the list with the library health dashboard once built.

### 5. Drop legacy `competencies` / `competency_categories` tables?

These exist in `00001_initial_schema.sql` and appear superseded by the dimensions/factors/constructs hierarchy. Confirming and removing reduces ambiguity for future agents and AI tooling that reads the schema.

**How to answer:** grep the codebase for any reads/writes to these tables; if none, drop in a migration.

### 6. Per-tenant library extensions

Explicitly out of scope for v1, but worth deciding *when* it becomes a question. Some buyers will want their own competencies surfaced alongside the global library. Sketch the structural answer now (probably `client_id` nullable on `constructs`, with RLS gating visibility) so we don't paint into a corner.

### 7. Item generation strategy at assessment creation

Three options:
- Generate fresh items per construct (existing pipeline; high latency, high quality, novel items)
- Pull from pre-existing item pools per construct (low latency, reuses calibrated items)
- Hybrid: pool first, generate to fill gaps

Latency considerations push toward pool-first for a fast-lane product. But the pool needs to exist — how mature is the per-construct item bank today?

### 8. Outcome taxonomy

Proposed: `selection | development | team_composition | succession | coaching`. This is a guess. Worth sanity-checking against actual buyer conversations Jason has had. The taxonomy drives `applicable_outcomes` and the wizard's chip picker.

### 9. Authoring assist scope

How much should AI write on the author's behalf vs. only suggest with mandatory human review? Defensibility implications:
- Suggest + accept (low-touch): faster, but published content may slip through unread
- Suggest + edit (medium-touch): forces review interaction
- Fully manual with examples (high-touch): slowest, highest quality

Recommendation: medium-touch for v1 (AI populates field, button says "Accept & edit" not "Accept").

### 10. Pricing / positioning relationship

If the wedge lands well, deliberate positioning prevents cannibalising the diagnostic. This is a marketing/sales decision, not a build decision, but it should be settled before launch.

### 11. Outcome of preflight vs persisted contrasts

The construct-distinctness preflight already produces overlap analysis. Should the persisted `contrasts_with` field be:
- Manually authored only (preflight stays advisory)
- Auto-populated from preflight (preflight becomes the source of truth)
- Hybrid (preflight suggests, author confirms)

Probably hybrid, but worth deciding before designing the authoring UI.

### 12. Brief extraction failure modes

What does the wizard do when the input is too thin to extract a useful brief? E.g. "I need a sales assessment." Options:
- Push back with clarifying questions
- Generate against minimal brief and rely on the user editing picks
- Refuse to proceed below a confidence threshold

Each has different UX implications.

---

## External Grounding (I-O Psych Frameworks)

This work draws from several established frameworks. Capturing the lineage here so future contributors understand the "why" behind specific schema choices.

### SHL Universal Competency Framework (UCF)

8 factors → 20 dimensions → 96 competency components. Each component has a definition plus **positive and negative behavioural indicators**. We have the positive side (`indicatorsLow/Mid/High`); the `overuse_signature` field is the negative-indicator equivalent.

### Korn Ferry / Lominger Leadership Architect

67 competencies, each with: skilled / less-skilled / talented / **overused skill** descriptions. The "overused skill" framing is Lominger's distinctive contribution and is the direct inspiration for our proposed `overuse_signature`.

### Hogan Assessment Systems

Bright-side (HPI) / dark-side (HDS) / values (MVPI) triad. The dark-side scales are derailer-focused: what does competent behaviour become under stress or when overused. Maps onto the same overuse concept.

### NEO-PI-R (Costa & McCrae)

Big Five with 6 facets per domain. Established nomological network — facets within a domain correlate; facets across domains do not. Primarily relevant for the construct-distinctness story (`contrasts_with`); we may eventually want a domain-level grouping that mirrors this structure.

### Behaviourally Anchored Rating Scales (Smith & Kendall, 1963)

Rating scales where each point is anchored to a concrete behavioural example. Our `construct_exemplars` table is a structural cousin — vignettes anchoring the low and high poles of each construct.

### Critical Incident Technique (Flanagan, 1954)

The source method for generating behavioural exemplars: collect specific instances of effective and ineffective behaviour from people who do or observe the work. We're not running CIT studies, but the *output format* — situational vignettes — is what we want exemplars to look like.

### Construct Validity & Nomological Network (Cronbach & Meehl, 1955)

The theoretical basis for `contrasts_with`. A construct's meaning is partly defined by what it converges with and what it diverges from. Persisting these relationships makes the library's validity story explicit rather than implicit.

### O*NET (US Department of Labor)

Free dataset. Every US occupation tagged with skill descriptors (importance 1-5, level 1-7). Not for direct import — but a canonical reference for what "skill X matters for job Y" looks like at scale. Could later seed `applicable_functions` defaults.

### DDI (Development Dimensions International)

"Key actions" per competency. Concrete behaviours that signal the competency. Similar to our indicators but more action-oriented and granular. Worth referencing when authoring indicators, but no schema implication.

---

## Appendix: Relevant Files

### Schema / migrations

- `supabase/migrations/00001_initial_schema.sql` — base tables (legacy `competencies` table here too)
- `supabase/migrations/00002_taxonomy_hierarchy.sql` — dimensions/factors/constructs hierarchy
- `supabase/migrations/00004_seed_library_data.sql` — initial library content
- `supabase/migrations/00023_anchor_presets.sql` — Likert anchor library
- `supabase/migrations/00037_ai_prompt_management.sql` — `ai_system_prompts` infra
- `supabase/migrations/00040_v2_item_generation_prompts.sql` — construct/factor item-gen prompts
- `supabase/migrations/00045_library_import_structuring_prompt.sql` — bulk import prompt
- `supabase/migrations/00046_library_slug_uniqueness_soft_delete.sql` — slug uniqueness, soft delete
- `supabase/migrations/00052_strengthen_generation_preflight_prompts.sql` — preflight v2
- `supabase/migrations/00055_v5_construct_v3_factor_v3_preflight_prompts.sql` — preflight v3
- `supabase/migrations/20260416044746_anchor_definitions.sql` — anchor_low/high columns
- `supabase/migrations/20260416044824_flexible_taxonomy_hierarchy.sql` — scoring_level, dimension_constructs
- `supabase/migrations/20260416050051_promote_library_factors_to_dimensions.sql` — hierarchy promotion
- `supabase/migrations/20260515160000_content_sources.sql` — provenance
- `supabase/migrations/20260515170000_relax_anchor_length_caps.sql` — anchor 150-char cap

### UI

- `src/app/(dashboard)/constructs/construct-form.tsx` — main construct authoring UI
- `src/app/(dashboard)/factors/factor-form.tsx` — factor authoring
- `src/app/(dashboard)/dimensions/dimension-form.tsx` — dimension authoring
- `src/app/(dashboard)/partners/[slug]/library/page.tsx` — library page (per partner)
- `src/components/action-dialog/action-dialog.tsx` — modal shell
- `src/components/action-dialog/action-wizard.tsx` — stepper wizard inside the modal
- `src/components/campaigns/quick-launch-modal.tsx` — reference implementation of wizard pattern
- `src/components/source-picker.tsx` — provenance picker (reusable)
- `src/components/rich-text-editor.tsx` — used throughout library forms
- `src/app/(dashboard)/_shared/indicators-tab.tsx` — indicators editor (reusable)
- `src/app/(dashboard)/_shared/settings-tab.tsx` — status/lifecycle editor (reusable)

### Server actions

- `src/app/actions/constructs.ts`
- `src/app/actions/factors.ts`
- `src/app/actions/dimensions.ts`
- `src/app/actions/construct-selection.ts`
- `src/app/actions/factor-selection.ts`
- `src/app/actions/dimension-constructs.ts`

### Related design docs

- [`2026-04-20-org-diagnostic-campaigns-and-roles-design.md`](./2026-04-20-org-diagnostic-campaigns-and-roles-design.md) — the diagnostic flow this product runs in parallel to
- [`2026-04-01-preflight-refinement-enhancements-design.md`](./2026-04-01-preflight-refinement-enhancements-design.md) — construct-distinctness preflight (relevant to `contrasts_with`)
- [`2026-04-02-admin-operated-launch-design.md`](./2026-04-02-admin-operated-launch-design.md) — campaign launch UX patterns (modal wizard precedent)
