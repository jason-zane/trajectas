# Logical Reasoning (Figural Matrices) — Implementation Architecture

**Date:** 2026-08-13 · **Status:** Implementation design, ready to build against
**Sources of truth:** `docs/superpowers/specs/2026-08-12-cognitive-assessments/{02,03,06}-*.md`, `AGENTS.md`, `src/lib/dal/README.md`
**Verified against:** working tree at `eb890c7` (`docs: cognitive reasoning assessments — research & design pack`)

This document specifies the build for **LR-M (figural matrices)** plus the shared foundations
(timing, key security, frozen forms, ability scoring, practice, generation, reporting) that
LR-D / numerical / verbal reuse. It is written so another engineer can implement without
re-deriving decisions. Every file path is real; every DDL statement is against the schema as it
actually exists today.

---

## 0. Audit verification — what is still true, and what has drifted

I re-checked every load-bearing claim in `02-infrastructure-audit.md` against the code. The audit
is accurate in substance. Corrections and additions:

| Audit claim | Verdict | Detail |
|---|---|---|
| `items`/`item_options` SELECT-able by every authenticated user | **Confirmed** | `00001` lines 850–861, recreated in `20260508214600` lines 337–376 as `TO public USING ((select auth.uid()) IS NOT NULL)`. `score_value` rides along. |
| `item_media` / `item_scoring_rubrics` readable by anon | **Confirmed** | `00005` lines 74, 78: `FOR SELECT USING (true)` with no `TO` clause → applies to `anon`. |
| `'cognitive'` exists in the DB enum with a seeded format | **Confirmed** | `00001` line 54 declares it in `response_format_type`; `00005` line 93 seeds `a5000000-…-000006 'Pattern Recognition'`. Note `00018`'s comment ("never added to the enum") is **stale and wrong** — harmless, but don't trust it. |
| App enum missing `cognitive` **and `ranking`** | **Half wrong** | `ranking` *is* in `ResponseFormatType` (`src/types/database.ts:22`) and is rendered (`ranking-response.tsx`, dispatched in `item-card.tsx`). It is missing from `ActiveResponseFormatType` and from the zod enum in `src/lib/validations/response-formats.ts:5`. `cognitive` is missing from all three. |
| `time_remaining_seconds` is client-supplied | **Confirmed and worse** | The live client path (`updateSessionProgressLite` → `update_session_progress_for_session`, and `/api/assess/progress`) **never passes `p_time_remaining` at all**. The only caller that could is the `updateSessionProgress` server action, which is dead code (no callers). So the column is permanently `{}` in practice. |
| `saveResponse` / `saveResponseLite` / `updateSessionProgress` server actions | **Effectively dead** | The runner uses `/api/assess/save-batch` (→ `save_responses_batch_for_session`) and `/api/assess/progress`. `/api/assess/save` (→ `save_response_for_session`) exists as the single-save fallback. **Consequence: the RPCs are the correct chokepoint for deadline enforcement — patch the two RPCs and every path is covered.** |
| `response_time_ms` plumbed but never measured | **Confirmed** | `section-wrapper.tsx:372` calls `enqueueSave({itemId, sectionId, value, data})` with no `responseTimeMs`; the field exists all the way through `use-save-queue.ts` and both RPCs. |
| `SectionTimer` unwired | **Confirmed** | `src/components/assess/section-timer.tsx` has zero importers. It is also **not fit for purpose**: its `useEffect` depends on `remaining`, so it re-creates the interval every tick and drifts. Rewrite, don't wire. |
| `allow_back_nav` not in `SectionForRunner` | **Confirmed** | Column exists (`00009`), never selected. |
| Dormant psychometric schema exists | **Confirmed** | `calibration_runs`, `item_statistics`, `construct_reliability`, `norm_groups`, `norm_tables`, `factor_analysis_results`, `dif_results` (`00010`); `item_parameters` (`00001`). |
| `item_parameters` "fits" for calibration | **NOT stated by the audit, and it does not fit** | `CONSTRAINT item_parameters_item_unique UNIQUE (item_id)`, no `calibration_run_id`, no scale/version, no SEs, no immutability. One parameter set per item, forever, unversioned — directly contradicts doc 06 §5.2 ("parameters frozen per version", "every parameter set immutable and versioned"). Must be altered. |
| `item_statistics` fits | **Confirmed** | `UNIQUE(item_id, calibration_run_id)`, `difficulty` (p-value), `discrimination` (r_it), `alpha_if_deleted`, `response_distribution` jsonb (distractor analysis), `irt_*` columns, `flagged`/`flag_reasons`. Good fit for the doc 06 §4.2 CTT gates as-is. |
| `participant_scores` has percentile + CI | **Confirmed**, but | **`construct_id` and `scoring_level` were DROPPED** by `20260525140000_taxonomy_unification_drop_construct_path.sql`, and `factor_id` is `NOT NULL` again. The audit doesn't mention this. **Consequence: every cognitive score must hang off a `factors` row.** There is no construct-level score row any more. |
| `participant_responses` carries a server timestamp | **Not claimed, and false** | Columns are `id, session_id, item_id, section_id, response_value, response_data, response_time_ms, created_at`. `created_at` is not touched by the upsert's `DO UPDATE`, so it is *first-write* time, not answer time. No server receipt timestamp exists. |

Two additional blockers the audit doesn't list:

1. **`items_purpose_construct_check` (migration `00016`)** — `CHECK ((purpose='construct' AND construct_id IS NOT NULL) OR (purpose<>'construct' AND construct_id IS NULL))`. Adding `practice`/`seed` to `item_purpose` therefore *forces* those items to have `construct_id IS NULL`, which breaks calibration grouping and (for seeds) the whole point of seeding onto a construct's bank metric. The constraint must be relaxed.
2. **Enum-value transaction hazard** — `00001` lines 45–51 document it explicitly: Postgres forbids *using* an enum value in the transaction that adds it (SQLSTATE 55P04), and this broke `supabase db reset` before. Every new enum value must land in a migration that does not reference it.

---

## 1. Data model

### 1.0 Naming and reuse summary

| Existing object | Treatment |
|---|---|
| `items`, `item_options` | **Reused**, with additive columns. `item_options` stays the response-value carrier (values 1–5), which keeps the `save_responses_batch_for_session` bounds ladder working unchanged. |
| `item_media`, `item_scoring_rubrics` | **Not used** for matrices (see §2 on SVG). RLS hardened anyway. |
| `assessment_sections`, `assessment_section_items` | **Reused**, one additive column (`section_role`). |
| `participant_sessions`, `participant_responses` | **Reused**, additive columns. `time_remaining_seconds` is left alone (legacy, unused). |
| `participant_scores` | **Reused**, additive columns. Rows remain factor-scoped. |
| `calibration_runs`, `item_statistics`, `norm_groups`, `norm_tables`, `dif_results` | **Reused as-is.** |
| `item_parameters` | **Altered** (versioning). Table is empty in every environment, so the alter is free. |
| `generation_runs` / `generated_items` / `generation_run_logs` | **Not extended** — see §6. |
| `response_formats` row `a5000000-0000-0000-0000-000000000006` ('Pattern Recognition', type `cognitive`) | **Reused** as the section's response format; its `config` is rewritten to the shape in §2.3. |
| `item_purpose`, `item_status` | `item_purpose` **extended**; `item_status` **left alone**, with a parallel `item_lifecycle_state` (below). |

**Why a parallel lifecycle enum rather than extending `item_status`:** `item_status` (`draft|active|archived`) is filtered on across the admin UI, assessment composition, and DAL. Adding `piloting|calibrated|operational|suspended|retired` to it would silently change the meaning of every `status = 'active'` query. Instead `items.lifecycle_state` carries the doc 06 §5.2 state machine and a trigger enforces the invariants `lifecycle_state='operational' ⇒ status='active'` and `lifecycle_state='retired' ⇒ status='archived'`.

### 1.1 Migration A — enums only

`supabase/migrations/<ts>_cognitive_enums.sql`

```sql
-- Enum values only. Postgres forbids USING a value in the transaction that
-- ADDs it (SQLSTATE 55P04) — see the note in 00001_initial_schema.sql. Every
-- statement that references these values lives in the next migration.

ALTER TYPE item_purpose ADD VALUE IF NOT EXISTS 'practice';
ALTER TYPE item_purpose ADD VALUE IF NOT EXISTS 'seed';

CREATE TYPE item_lifecycle_state AS ENUM (
  'draft',
  'content_reviewed',
  'fairness_reviewed',
  'piloting',
  'calibrated',
  'operational',
  'suspended',
  'retired',
  'killed'
);

CREATE TYPE assessment_section_role AS ENUM ('scored', 'practice', 'instructions');

CREATE TYPE scoring_profile AS ENUM (
  'pomp_factor',          -- today's behaviour: scoreSessionCTT
  'ability_dichotomous',  -- sum-correct against keys
  'ability_irt'           -- EAP theta from item_parameters
);

CREATE TYPE cognitive_spec_kind AS ENUM ('figural_matrix');
```

### 1.2 Migration B — item bank, specs, keys, provenance

`supabase/migrations/<ts>_cognitive_item_bank.sql`

#### 1.2.1 Relax the purpose/construct constraint

```sql
ALTER TABLE items DROP CONSTRAINT items_purpose_construct_check;
ALTER TABLE items ADD CONSTRAINT items_purpose_construct_check CHECK (
  (purpose IN ('construct','practice','seed') AND construct_id IS NOT NULL)
  OR
  (purpose IN ('impression_management','infrequency','attention_check') AND construct_id IS NULL)
);
```

Practice and seed items keep their `construct_id` — required so seeds calibrate onto the right
bank metric (doc 06 §5.1 Stage 2) and so practice items are drawn from the same family pool.

**Knock-on:** `getSessionState`'s factor filter (`src/app/actions/assess.ts:541`) reads
"`purpose !== 'construct'` ⇒ always include". Practice and seed items now hit that branch and are
always delivered regardless of campaign factor selection — which is the desired behaviour, but it
must be stated in the code comment, and `src/lib/dal/session-completeness.ts` mirrors the same
rule (it must, or the completeness gate desyncs).

#### 1.2.2 Item families and lineage

```sql
CREATE TABLE item_families (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL,                        -- 'LRM-XOR-XLAYER' (doc 03 §6)
  construct_id  UUID NOT NULL REFERENCES constructs(id) ON DELETE RESTRICT,
  kind          TEXT NOT NULL CHECK (kind IN ('figural_matrix','deductive')),
  rules         JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ['R6','R2'] etc.
  radicals      JSONB NOT NULL DEFAULT '{}'::jsonb,   -- doc 03 §4.1 radical profile
  predicted_b   NUMERIC,                              -- doc 03 §4.4 linear model
  band          TEXT CHECK (band IN ('easy','moderate','hard','very_hard')),
  exemplar_item_id UUID,                              -- FK added after items alter
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ,
  CONSTRAINT item_families_code_unique UNIQUE (code)
);

ALTER TABLE items
  ADD COLUMN family_id       UUID REFERENCES item_families(id) ON DELETE RESTRICT,
  ADD COLUMN parent_item_id  UUID REFERENCES items(id) ON DELETE SET NULL,
  ADD COLUMN item_version    INT NOT NULL DEFAULT 1,
  ADD COLUMN lifecycle_state item_lifecycle_state NOT NULL DEFAULT 'draft',
  ADD COLUMN content_hash    TEXT,
  ADD COLUMN exposure_count  INT NOT NULL DEFAULT 0,
  ADD COLUMN retired_at      TIMESTAMPTZ;

ALTER TABLE item_families
  ADD CONSTRAINT item_families_exemplar_fk
  FOREIGN KEY (exemplar_item_id) REFERENCES items(id) ON DELETE SET NULL;

CREATE INDEX idx_items_family ON items(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX idx_items_lifecycle ON items(lifecycle_state);
```

`parent_item_id` + `item_version` give clone lineage (doc 03 §4: a clone is a *new item row*
pointing at its exemplar, sharing `family_id`).

#### 1.2.3 Lifecycle + immutability triggers

```sql
CREATE OR REPLACE FUNCTION public.items_lifecycle_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_legal boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.lifecycle_state <> OLD.lifecycle_state THEN
    v_legal := (OLD.lifecycle_state, NEW.lifecycle_state) IN (
      ('draft','content_reviewed'), ('draft','killed'),
      ('content_reviewed','fairness_reviewed'), ('content_reviewed','draft'),
      ('fairness_reviewed','piloting'), ('fairness_reviewed','draft'),
      ('piloting','calibrated'), ('piloting','killed'),
      ('calibrated','operational'), ('calibrated','suspended'),
      ('operational','suspended'), ('operational','retired'),
      ('suspended','operational'), ('suspended','retired'), ('suspended','calibrated')
    );
    IF NOT v_legal THEN
      RAISE EXCEPTION 'illegal item lifecycle transition % -> %',
        OLD.lifecycle_state, NEW.lifecycle_state;
    END IF;
  END IF;

  -- Operational/calibrated items are frozen content. Edits must clone.
  IF TG_OP = 'UPDATE'
     AND OLD.lifecycle_state IN ('calibrated','operational','retired')
     AND (NEW.stem IS DISTINCT FROM OLD.stem
          OR NEW.construct_id IS DISTINCT FROM OLD.construct_id
          OR NEW.reverse_scored IS DISTINCT FROM OLD.reverse_scored
          OR NEW.content_hash IS DISTINCT FROM OLD.content_hash) THEN
    RAISE EXCEPTION
      'item % is % — content is frozen; clone it (parent_item_id, item_version+1) instead',
      OLD.id, OLD.lifecycle_state;
  END IF;

  IF NEW.lifecycle_state = 'operational' AND NEW.status <> 'active' THEN
    RAISE EXCEPTION 'operational items must have status = active';
  END IF;
  IF NEW.lifecycle_state = 'retired' AND NEW.status <> 'archived' THEN
    RAISE EXCEPTION 'retired items must have status = archived';
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER items_lifecycle_guard_trg
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION public.items_lifecycle_guard();
```

This is the concrete answer to audit gap 3 ("editing an item mid-flight silently changes what a
session was"): frozen content + `content_hash` recorded in the per-session form snapshot (§1.3.1),
so the scorer can detect drift and refuse rather than mis-score.

#### 1.2.4 Structured item specs (the generated matrix)

```sql
CREATE TABLE cognitive_item_specs (
  item_id              UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  kind                 cognitive_spec_kind NOT NULL,
  spec_version         INT  NOT NULL DEFAULT 1,
  spec                 JSONB NOT NULL,
  render_style_version TEXT NOT NULL DEFAULT 'v1',
  generation_run_id    UUID REFERENCES cognitive_generation_runs(id) ON DELETE SET NULL,
  generator_seed       TEXT,
  qa                   JSONB NOT NULL DEFAULT '{}'::jsonb,   -- doc 03 §5.4 battery results
  content_hash         TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ,

  -- The spec is the only structure rendered to the candidate. Nothing that
  -- names or indexes the key may live in it. Belt-and-braces to the zod
  -- .strict() schema in src/lib/cognitive/spec/schema.ts.
  CONSTRAINT cognitive_item_specs_no_key CHECK (
    NOT (spec ? 'key') AND NOT (spec ? 'answer')
    AND NOT (spec ? 'correctOption') AND NOT (spec ? 'keyIndex')
    AND NOT (spec ? 'solution')
  ),
  CONSTRAINT cognitive_item_specs_shape CHECK (
    spec ? 'grid' AND jsonb_typeof(spec->'grid') = 'object'
  )
);

CREATE TABLE cognitive_option_specs (
  option_id  UUID PRIMARY KEY REFERENCES item_options(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  spec       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cognitive_option_specs_item ON cognitive_option_specs(item_id);
```

**Spec JSON schema (proposed; the normative version is the zod schema, §2.1).** Directly encodes
doc 03 §5.1's notation so a renderer reproduces the item "without further judgement calls":

```jsonc
{
  "specVersion": 1,
  "kind": "figural_matrix",
  "grid": {
    "rows": 3, "cols": 3,
    "blank": { "row": 3, "col": 3 },
    "cells": [
      { "row": 1, "col": 1, "layers": [
          { "layer": "outer", "element": "square",  "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
          { "layer": "inner", "element": "tick",    "length": 30, "rotation": 0 }
      ]}
      // … 8 cells; the blank cell is omitted
    ]
  },
  "options": [
    { "slot": "A", "layers": [ /* same layer grammar */ ] },
    { "slot": "B", "layers": [ … ] }, { "slot": "C", … }, { "slot": "D", … }, { "slot": "E", … }
  ],
  "rules": [
    { "id": "R6", "attribute": "shape", "layer": "outer", "axis": "row_and_column",
      "values": ["square","circle","diamond"] },
    { "id": "R2", "attribute": "rotation", "layer": "inner", "stepPerColumn": 90, "stepPerRow": 90 }
  ],
  "radicals": { "ruleCount": 2, "crossLayer": true, "perceptualLoad": 1,
                "elementTypes": 3, "nearMissCount": 2 },
  "distractorPlan": { "A": "IR", "C": "IR", "D": "PM", "E": "RP" },   // key slot absent by design
  "render": { "styleVersion": "v1", "strokeWidth": 2, "minElementPx": 8, "canvas": 100 }
}
```

Layer element grammar (closed vocabulary, doc 03 §5.1):
`element ∈ {circle, square, triangle, diamond, pentagon, arrow, tick, dot, bar}`,
`fill ∈ {outline, solid, hatched}`, `size ∈ {S, M, L}`, `anchor ∈ {TL, TR, BL, BR, CTR}`,
`rotation ∈ [0,360)`, `count ∈ [1,5]`, `bars ⊆ {H, V, D1, D2}`.

**Note `distractorPlan` names only the four distractor slots** — the key slot is absent, so the
plan is not key-revealing *by omission of the labels*… except it *is*: whichever slot has no label
is the key. It therefore lives in the spec only for the generator/QA path and **must be stripped
before delivery**. Two mechanical protections: (a) the DTO builder projects an explicit allow-list
of spec fields (§2.2), never the whole spec; (b) an architecture test asserts the runner path
never selects `cognitive_item_specs.spec` without going through that projection helper. If that
feels too subtle — and it reasonably might — move `distractorPlan` into `item_option_diagnostics`
(below) and drop it from the spec entirely. **Recommendation: move it.** It costs one join in the
generator and removes an entire class of leak.

Revised: `cognitive_item_specs.spec` contains `grid`, `options`, `rules`, `radicals`, `render`
only. `rules`/`radicals` are still never delivered (they'd hand a multimodal model the answer
structure) — the projection is `grid` + `options` + `render`.

#### 1.2.5 Answer keys — the secure set

```sql
-- Composite target so the FK itself proves the key option belongs to the item.
ALTER TABLE item_options
  ADD CONSTRAINT item_options_id_item_unique UNIQUE (id, item_id);

CREATE TABLE item_answer_keys (
  item_id           UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  correct_option_id UUID NOT NULL,
  scoring_rule      TEXT NOT NULL DEFAULT 'dichotomous'
                      CHECK (scoring_rule IN ('dichotomous')),
  rationale         TEXT,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ,
  CONSTRAINT item_answer_keys_option_fk
    FOREIGN KEY (correct_option_id, item_id)
    REFERENCES item_options (id, item_id) ON DELETE RESTRICT
);

-- Per-option error labels (WR/IR/PM/RP, doc 03 §5.3). Key-revealing by
-- omission, so it lives in the secure set, never in the spec.
CREATE TABLE item_option_diagnostics (
  option_id     UUID PRIMARY KEY REFERENCES item_options(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  error_label   TEXT CHECK (error_label IN ('WR','IR','PM','RP','CNV','OVG','UMD','ATM','REV')),
  rationale     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_item_option_diagnostics_item ON item_option_diagnostics(item_id);
```

**RLS for the secure set — actual policies.** The pattern is *deny-all by absence of policy* plus
explicit privilege revocation, following the enforcement style of
`20260703120000_aggregate_only_enforcement.sql`:

```sql
ALTER TABLE item_answer_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_option_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_item_specs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_option_specs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_families           ENABLE ROW LEVEL SECURITY;

-- No policies are created for these tables. RLS-enabled with zero policies
-- denies every non-BYPASSRLS role. service_role (which the admin client uses)
-- has BYPASSRLS in Supabase, so server-side access is unaffected.
REVOKE ALL ON TABLE item_answer_keys        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE item_option_diagnostics FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE cognitive_item_specs    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE cognitive_option_specs  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE item_families           FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE item_answer_keys        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE item_option_diagnostics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cognitive_item_specs    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cognitive_option_specs  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE item_families           TO service_role;
```

Do **not** use `FORCE ROW LEVEL SECURITY` here: the migration role (`postgres`, table owner) would
then be subject to the zero-policy deny and later DDL/data migrations would fail confusingly.
Ownership-based access is acceptable; the exposure we care about is the `authenticated` dashboard
JWT, which is fully closed off.

**Verification that this is safe:** every read of `item_options` in the codebase goes through the
service-role admin client — `src/app/actions/items.ts:232/310/315/495` (all behind
`requireAdminScope()`), `src/lib/scoring/ctt-session.ts:167`, and `getSessionState`. No RLS-scoped
(`@/lib/supabase/server`) client touches item tables. That makes the legacy-key hardening below
zero-risk:

#### 1.2.6 Legacy key hardening (`item_options.score_value`)

```sql
-- Column-level privilege split: authenticated dashboard JWTs lose the ability
-- to read the keyed-scoring column. Server paths use service_role.
REVOKE SELECT (score_value) ON TABLE item_options FROM anon, authenticated;

-- Cognitive items must never carry keys on options — keys live in
-- item_answer_keys and nowhere else.
CREATE OR REPLACE FUNCTION public.forbid_option_keys_on_cognitive_items()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.score_value IS NOT NULL
     AND EXISTS (SELECT 1 FROM cognitive_item_specs s WHERE s.item_id = NEW.item_id) THEN
    RAISE EXCEPTION
      'cognitive item % must not carry item_options.score_value; use item_answer_keys',
      NEW.item_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER forbid_option_keys_on_cognitive_items_trg
  BEFORE INSERT OR UPDATE ON item_options
  FOR EACH ROW EXECUTE FUNCTION public.forbid_option_keys_on_cognitive_items();
```

Also tighten the anon-readable item tables (audit gap 2) in the same migration:

```sql
DROP POLICY item_media_select ON item_media;
CREATE POLICY item_media_select ON item_media
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
DROP POLICY item_scoring_rubrics_select ON item_scoring_rubrics;
CREATE POLICY item_scoring_rubrics_select ON item_scoring_rubrics
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- Item parameters / statistics are commercial IP, not general dashboard data.
DROP POLICY item_parameters_select_authenticated ON item_parameters;
CREATE POLICY item_parameters_select_platform_admin ON item_parameters
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = (select auth.uid()) AND p.role = 'platform_admin'));
DROP POLICY item_statistics_select ON item_statistics;
CREATE POLICY item_statistics_select_platform_admin ON item_statistics
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = (select auth.uid()) AND p.role = 'platform_admin'));
```

#### 1.2.7 Generation provenance

```sql
CREATE TABLE cognitive_generation_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              cognitive_spec_kind NOT NULL,
  generator_name    TEXT NOT NULL,          -- 'matrix-sgmt'
  generator_version TEXT NOT NULL,          -- semver of src/lib/cognitive/generator
  git_sha           TEXT,
  seed              TEXT NOT NULL,          -- root PRNG seed → full reproducibility
  params            JSONB NOT NULL DEFAULT '{}'::jsonb,  -- families, clones/family, band targets
  status            TEXT NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running','succeeded','failed')),
  items_proposed    INT NOT NULL DEFAULT 0,
  items_accepted    INT NOT NULL DEFAULT 0,
  items_rejected    INT NOT NULL DEFAULT 0,
  qa_summary        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- per-check pass/fail tallies
  error_message     TEXT,
  requested_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE cognitive_generation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cognitive_generation_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE cognitive_generation_runs TO service_role;
```

`(generator_version, git_sha, seed, params)` is the reproducibility tuple: re-running the
generator with the same tuple must produce byte-identical specs. A unit test asserts this.

### 1.3 Migration C — delivery, forms, timing

`supabase/migrations/<ts>_cognitive_delivery_and_timing.sql`

#### 1.3.1 Frozen per-session form snapshot

```sql
CREATE TABLE participant_section_forms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES participant_sessions(id) ON DELETE CASCADE,
  section_id        UUID NOT NULL REFERENCES assessment_sections(id) ON DELETE RESTRICT,
  assembled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  assembly_seed     TEXT NOT NULL,                 -- '<sessionId>:<sectionId>'
  assembler_version TEXT NOT NULL,                 -- 'form-assembler@1'
  form_code         TEXT,                          -- named parallel form, when applicable
  entries           JSONB NOT NULL,
  entry_count       INT NOT NULL,
  CONSTRAINT participant_section_forms_unique UNIQUE (session_id, section_id),
  CONSTRAINT participant_section_forms_entries_array
    CHECK (jsonb_typeof(entries) = 'array' AND entry_count = jsonb_array_length(entries))
);
ALTER TABLE participant_section_forms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE participant_section_forms FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE participant_section_forms TO service_role;
```

`entries[i]`:

```jsonc
{ "position": 1,
  "itemId": "…", "itemVersion": 2, "contentHash": "sha256:…",
  "purpose": "construct",              // construct | practice | seed
  "countsTowardScore": true,
  "optionOrder": ["<optionId>", "…"]   // per-sitting option shuffle, doc 06 §5.3
}
```

The snapshot is authoritative for: delivery order, the completeness gate, and scoring. It replaces
the read-time recomputation in `getSessionState` (`applyItemOrdering` +
`selectItemsByDifficulty`) for any assessment with `scoring_profile <> 'pomp_factor'`, and is
written for *all* assessments going forward (cheap, and it fixes the general "the delivered set is
never persisted" hazard).

#### 1.3.2 Server-authoritative section timing

```sql
ALTER TABLE assessment_sections
  ADD COLUMN section_role assessment_section_role NOT NULL DEFAULT 'scored',
  ADD COLUMN grace_seconds INT NOT NULL DEFAULT 20
    CHECK (grace_seconds BETWEEN 0 AND 120);

CREATE TABLE participant_section_states (
  session_id          UUID NOT NULL REFERENCES participant_sessions(id) ON DELETE CASCADE,
  section_id          UUID NOT NULL REFERENCES assessment_sections(id) ON DELETE RESTRICT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  base_limit_seconds  INT,                     -- NULL = untimed section
  time_multiplier     NUMERIC NOT NULL DEFAULT 1.0
                        CHECK (time_multiplier BETWEEN 1.0 AND 3.0),
  accommodation_id    UUID,                    -- FK added below
  deadline_at         TIMESTAMPTZ,             -- NULL when untimed
  grace_seconds       INT NOT NULL DEFAULT 20,
  expired_at          TIMESTAMPTZ,
  finalised_at        TIMESTAMPTZ,
  finalised_by        TEXT CHECK (finalised_by IN ('participant','client_timer','sweep','submit')),
  PRIMARY KEY (session_id, section_id)
);
CREATE INDEX idx_section_states_open_deadlines
  ON participant_section_states (deadline_at)
  WHERE finalised_at IS NULL AND deadline_at IS NOT NULL;

CREATE TABLE participant_accommodations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_participant_id UUID NOT NULL REFERENCES campaign_participants(id) ON DELETE CASCADE,
  assessment_id           UUID REFERENCES assessments(id) ON DELETE CASCADE,  -- NULL = all
  kind                    TEXT NOT NULL CHECK (kind IN ('extra_time')),
  time_multiplier         NUMERIC NOT NULL CHECK (time_multiplier IN (1.25, 1.50)),
  reason_category         TEXT NOT NULL
    CHECK (reason_category IN ('disability','temporary_impairment','language','other')),
  notes                   TEXT,
  approved_by             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX participant_accommodations_active_unique
  ON participant_accommodations (campaign_participant_id, COALESCE(assessment_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE revoked_at IS NULL;

ALTER TABLE participant_section_states
  ADD CONSTRAINT participant_section_states_accommodation_fk
  FOREIGN KEY (accommodation_id) REFERENCES participant_accommodations(id) ON DELETE SET NULL;

ALTER TABLE participant_section_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_accommodations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE participant_section_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE participant_accommodations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE participant_section_states TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE participant_accommodations TO service_role;
```

Accommodations are **never visible to hiring reviewers** (doc 03 §10): deny-all RLS, admin surface
gated to `platform_admin`, and explicitly excluded from `report_snapshots.rendered_data` (add to
the sanitiser checklist in `src/lib/reports/sanitize-block-data.ts` review).

#### 1.3.3 Server answer timestamps

```sql
ALTER TABLE participant_responses
  ADD COLUMN answered_at TIMESTAMPTZ,        -- server receipt, set/refreshed on every write
  ADD COLUMN client_latency_ms INT;          -- the client's claim, retained but never trusted
COMMENT ON COLUMN participant_responses.response_time_ms IS
  'Server-derived item latency (ms) where available; client-reported otherwise. See client_latency_ms for the untrusted client value.';
```

### 1.4 Migration D — scoring artefacts

`supabase/migrations/<ts>_cognitive_scoring.sql`

```sql
ALTER TABLE assessments
  ADD COLUMN scoring_profile scoring_profile NOT NULL DEFAULT 'pomp_factor';

CREATE TABLE participant_item_outcomes (
  session_id          UUID NOT NULL REFERENCES participant_sessions(id) ON DELETE CASCADE,
  item_id             UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  section_id          UUID REFERENCES assessment_sections(id) ON DELETE SET NULL,
  outcome             TEXT NOT NULL CHECK (outcome IN
                        ('correct','incorrect','omitted','expired_unseen','excluded')),
  chosen_option_id    UUID REFERENCES item_options(id) ON DELETE SET NULL,
  counts_toward_score BOOLEAN NOT NULL DEFAULT true,
  item_purpose        item_purpose NOT NULL,
  item_version        INT NOT NULL,
  content_hash        TEXT,
  response_time_ms    INT,
  rapid_guess         BOOLEAN NOT NULL DEFAULT false,   -- doc 03 §10: <3s on matrices
  scorer_version      TEXT NOT NULL,
  scored_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, item_id)
);
CREATE INDEX idx_item_outcomes_item ON participant_item_outcomes(item_id);
ALTER TABLE participant_item_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE participant_item_outcomes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE participant_item_outcomes TO service_role;

ALTER TABLE participant_scores
  ADD COLUMN metric               TEXT NOT NULL DEFAULT 'pomp'
    CHECK (metric IN ('pomp','percent_correct','t_score')),
  ADD COLUMN scoring_variant      TEXT,          -- 'mean_pomp' | 'sum_correct' | 'eap_2pl'
  ADD COLUMN raw_correct          INT,
  ADD COLUMN items_attempted      INT,
  ADD COLUMN theta                NUMERIC,
  ADD COLUMN theta_se             NUMERIC,
  ADD COLUMN parameter_scale_code TEXT,
  ADD COLUMN norm_group_id        UUID REFERENCES norm_groups(id) ON DELETE SET NULL,
  ADD COLUMN norm_version         TEXT,
  ADD COLUMN provisional          BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN participant_scores.provisional IS
  'True while the instrument is pre-validation (doc 03 §11/§12). Report blocks MUST render the "pilot — not for selection decisions" label when set. Product-level enforcement, not convention.';

-- item_parameters: versioned, run-linked, immutable-per-version.
ALTER TABLE item_parameters
  ADD COLUMN calibration_run_id UUID REFERENCES calibration_runs(id) ON DELETE RESTRICT,
  ADD COLUMN scale_code         TEXT,            -- 'LR-M-v1'
  ADD COLUMN is_current         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN se_a NUMERIC, ADD COLUMN se_b NUMERIC, ADD COLUMN se_c NUMERIC,
  ADD COLUMN n_responses INT;
ALTER TABLE item_parameters DROP CONSTRAINT item_parameters_item_unique;
CREATE UNIQUE INDEX item_parameters_current_unique
  ON item_parameters (item_id, scale_code) WHERE is_current;
CREATE INDEX idx_item_parameters_run ON item_parameters (calibration_run_id);
```

`norm_group_id`/`norm_version` on `participant_scores` implement the first decision in
`docs/superpowers/specs/2026-06-13-norms-versioning-note.md`. The `norm_group_versions` snapshot
table from that note is **out of scope here** and blocks percentile *reporting*, not sum-correct
scoring — call it out in the PR description so it isn't quietly forgotten.

### 1.5 Taxonomy prerequisite (data, not DDL)

Because `participant_scores.factor_id` is `NOT NULL` and construct-level scoring was dropped
(`20260525140000`), the LR assessment needs real taxonomy rows before anything scores:

```
dimension  "Cognitive Ability"
  └ factor "Logical Reasoning — Inductive"   (LR-M)   → construct "Figural Matrix Reasoning"
  └ factor "Logical Reasoning — Deductive"   (LR-D)   → construct "Deductive Reasoning"
```

with `factor_constructs` links (weight 1.0), `assessment_factors` rows for the LR assessment, and
`items.construct_id` pointing at the constructs. The 70/30 LR-M/LR-D composite (doc 03 §2) is
applied by the ability scorer when writing `participant_sessions.composite_score`
(`composite_method = 'weighted_lr_v1'`), **not** by `factor_constructs` weights — those roll
constructs into factors, one level below.

---

## 2. Delivery path

### 2.1 Spec validation and rendering libraries (new)

```
src/lib/cognitive/
  spec/
    schema.ts        # zod: figuralMatrixSpecSchema (.strict() everywhere)
    hash.ts          # canonicalJson() + sha256 → content_hash
    project.ts       # toRenderSpec(spec): strips rules/radicals — the ONLY way specs
                     # reach a renderer that produces client-bound output
  render/
    primitives.ts    # circle/square/triangle/diamond/pentagon/arrow/tick/bar/hatch defs
    matrix-svg.ts    # renderMatrixGrid(renderSpec, opts) → string
                     # renderOptionTile(optionRenderSpec, opts) → string
  generator/         # see §6
```

`.strict()` on every zod object is a load-bearing security property: an unknown key such as
`"key"` or `"isCorrect"` fails validation at write time, so a malformed generator cannot smuggle
key material into a client-bound blob.

### 2.2 DTO changes

`src/app/actions/assess.ts`:

```ts
export type CognitiveStimulus = {
  kind: 'figural_matrix'
  /** Inline SVG markup produced server-side from the item's render spec. */
  gridSvg: string
  /** Honest accessibility text, NOT a cell-by-cell description (doc 03 §7.4). */
  ariaLabel: string
}

export type ItemOptionForRunner = {
  id: string
  label: string        // 'A'…'E' for cognitive items
  value: number        // 1..5, unchanged — keeps the save-RPC bounds ladder working
  sortOrder: number    // per-sitting shuffled position from the frozen form
  optionSvg?: string   // present for cognitive items
}

export type ItemForRunner = {
  id: string
  stem: string
  displayOrder: number
  options: ItemOptionForRunner[]
  stimulus?: CognitiveStimulus
  /** True only for practice items. Seed items are DELIBERATELY indistinguishable
   *  from scored items on the wire (doc 06 §5.1) — never ship `purpose`. */
  isPractice?: boolean
}

export type SectionForRunner = {
  // … existing fields …
  allowBackNav: boolean          // NEW — column exists, was never selected
  sectionRole: 'scored' | 'practice' | 'instructions'   // NEW
  timing?: {                     // NEW, present only for timed sections
    startedAt: string
    deadlineAt: string
    serverNow: string
    graceSeconds: number
  }
}
```

There is deliberately **no** `correctOptionId`, `scoreValue`, `isCorrect`, `errorLabel`, or
`rules` anywhere in the DTO.

### 2.3 `getSessionState` changes

New DAL modules (per `src/lib/dal/README.md` — `import 'server-only'`, DTOs out, no raw rows):

- `src/lib/dal/session-forms.ts`
  - `getOrCreateSectionForm(db, { sessionId, sectionId, assessmentId, campaignId })` →
    `SectionFormDTO`. Assembles once (existing selection logic: campaign factor filter →
    `selectItemsByDifficulty` → `applyItemOrdering`, plus a per-sitting option shuffle seeded on
    `sessionId:itemId`), then `INSERT … ON CONFLICT (session_id, section_id) DO NOTHING`, then
    re-`SELECT`. Two concurrent tabs converge on one form; a refresh never reshuffles.
  - `listSectionForms(db, sessionId)`.
- `src/lib/dal/cognitive-items.ts`
  - `getCognitiveItemsForDelivery(db, itemIds)` → `Map<itemId, { gridSvg, optionSvgByOptionId }>`.
    Selects `cognitive_item_specs.spec` and `cognitive_option_specs.spec`, runs them through
    `toRenderSpec()` and the renderer. **This is the only module in the runner path allowed to
    touch `cognitive_*_specs`,** and it never touches `item_answer_keys` /
    `item_option_diagnostics`.

`getSessionState` then:

1. Loads sections + `assessment_section_items` (unchanged query, plus `allow_back_nav`,
   `section_role`, `grace_seconds`).
2. For each section, calls `getOrCreateSectionForm` and builds items **from the snapshot's
   ordering**, not from `applyItemOrdering`. For legacy (`scoring_profile='pomp_factor'`)
   assessments the snapshot content is identical to today's computation, so behaviour is unchanged
   — but it is now recorded.
3. If the section's `response_formats.type === 'cognitive'`, calls
   `getCognitiveItemsForDelivery` for the snapshot's item ids and attaches `stimulus` /
   `optionSvg`.
4. For timed sections, calls the `start_section_for_session` RPC (§3) and attaches `timing`.
5. Never selects `score_value` (already true) and never selects the secure set (new).

`src/lib/dal/session-completeness.ts` is refactored to read the frozen form instead of
re-deriving "delivered" (it currently re-implements the selection pipeline in a comment-documented
mirror — a standing correctness hazard the snapshot removes), and to subtract unanswered items in
expired sections (§3.5).

### 2.4 How SVG is produced and served — recommendation

**Recommendation: render SVG server-side from the spec at delivery time, inline in the DTO. Do not
pre-bake to storage.**

Justification against this repo:

- **No CSP is configured** (`src/lib/next-config/security.ts` sets HSTS, Referrer-Policy,
  nosniff, Permissions-Policy, X-Frame-Options — no `Content-Security-Policy`), so inline SVG is
  unblocked. If a CSP lands later, inline `<svg>` markup (not `<img src="data:">`, not inline
  `<script>`) remains allowed under a strict policy.
- **The storage alternative carries real risk here.** The only precedent bucket,
  `brand-assets` (`00062`), is `public = true`. A public bucket of matrix stimuli is a leaked item
  bank with a stable URL. A private bucket forces a signed-URL layer per item per sitting
  (doc 06 §7.1 wants exactly that, but it is Phase 2 work) plus cache invalidation whenever a spec
  or `render_style_version` changes.
- **One renderer, three consumers.** The same pure function serves delivery, the QA render-check
  (doc 03 §5.4 item 5), and admin item preview. Pre-baking would need a build/backfill step for
  each.
- **Per-session watermarking** (doc 06 §7.4) is a one-line render option when rendering happens
  per request; it is impossible with a pre-baked shared asset.
- **Cost is negligible.** A matrix is ~40 SVG primitives; rendering nine cells plus five options
  is sub-millisecond, and the section page is already a server component doing several DB
  round-trips.

Phase 2 (deferred, noted for the record): flatten to raster with per-session watermark using the
existing headless-browser infrastructure (`src/lib/reports/pdf-browser.ts`), served through a
short-lived signed route. That satisfies doc 06 §7.4 fully; it is not needed to ship LR-M.

**Safety of `dangerouslySetInnerHTML`:** the markup is generated by our own renderer from a
zod-validated closed vocabulary — no free text, no user input, no admin-authored HTML. Two unit
tests pin it: (a) rendering every bank fixture never emits `<script`, `<foreignObject`, `on\w+=`,
`href`, or `xlink:`; (b) all emitted numeric attributes are finite. The alternative — shipping the
render spec and building React SVG elements client-side — was rejected because it puts structured
item content in the page source (easier to harvest and to paste into a model) and would either
duplicate the renderer or force `rules`/`radicals` handling into client code.

### 2.5 The renderer component

`src/components/assess/formats/cognitive-response.tsx` (new):

- 3×3 grid above a 2-or-3-per-row option block; fits 360×640 CSS px without horizontal scroll
  (doc 03 §7.3).
- Option cells ≥ 64×64 px, ≥ 8 px gaps, `role="radiogroup"` with arrow-key traversal and
  Enter/Space to select, then an explicit **Confirm** button (doc 03 §7.3: "selection requires tap
  + explicit Confirm to prevent mis-tap penalties").
- `aria-label` on the stimulus is the honest limitation statement, not a cell description.
- Colour is never an encoding channel; fills are `outline`/`hatched`/`solid` via SVG pattern defs.

`src/components/assess/item-card.tsx`: add
`{responseFormatType === "cognitive" && <CognitiveResponse … />}` and pass `item.stimulus`.

`src/components/assess/section-wrapper.tsx`:

- `cognitive` goes in `CONTINUE_FORMATS`, not `AUTO_ADVANCE_FORMATS` (tap + Confirm).
- **Latency capture** (closes audit gap 4): a `itemShownAtRef = useRef(performance.now())` reset in
  the `currentItem` effect; `handleResponse` passes
  `responseTimeMs: Math.round(performance.now() - itemShownAtRef.current)` into `enqueueSave` —
  the parameter already exists end-to-end. Stored as `client_latency_ms`; the server's
  `answered_at` delta is the trusted figure.
- Renders the new timer (§3.4) when `section.timing` is present.
- Honours `section.allowBackNav === false` by hiding the Back control and blocking
  `goToPreviousItem` (doc 03 §10 allows within-section revisit for LR, so LR-M sets
  `allow_back_nav = true`; the plumbing is needed for the speeded Checking module later).

### 2.6 The key never reaches the client — mechanical guarantees

Four independent layers:

1. **Storage:** keys live only in `item_answer_keys` / `item_option_diagnostics`, which are
   RLS-deny-all and privilege-revoked from `anon`/`authenticated` (§1.2.5).
2. **Schema:** `cognitive_item_specs_no_key` CHECK + zod `.strict()`.
3. **Projection:** `toRenderSpec()` allow-lists `grid`/`options`/`render`; the DTO builder consumes
   only its output.
4. **Architecture test** (`tests/architecture/answer-key-isolation.test.ts`, new):

```ts
const RUNNER_PATHS = [
  'src/app/actions/assess.ts',
  'src/app/actions/assess-practice.ts',   // audited exception, see below
  'src/app/api/assess',
  'src/components/assess',
  'src/lib/assess',
  'src/lib/dal/session-forms.ts',
  'src/lib/dal/session-completeness.ts',
  'src/lib/dal/cognitive-items.ts',
];
const FORBIDDEN = [
  /item_answer_keys/, /item_option_diagnostics/, /correct_option_id/,
  /score_value/, /participant_item_outcomes/, /\bisCorrect\b/, /\.spec\b.*rules/,
];
// Exactly one allowlisted violation: src/app/actions/assess-practice.ts may read
// item_answer_keys, and only inside checkPracticeAnswer (§5). The test asserts the
// file also contains the practice-purpose guard regex.
```

Plus a second assertion in the same file: the source text of the `ItemForRunner`,
`ItemOptionForRunner`, and `CognitiveStimulus` type declarations contains none of
`correct|key|answer|isCorrect|errorLabel|scoreValue`.

And an **integration** test (§8) that `JSON.stringify(await getSessionState(...))` contains
neither the key option's id in any key-ish field nor any of the forbidden tokens.

---

## 3. Server-authoritative timing

### 3.1 Where the clock starts

New RPC, following the `20260424143500` hardening pattern exactly (SECURITY DEFINER,
`SET search_path = public`, token → session → membership validation, `REVOKE EXECUTE` from
`PUBLIC, anon, authenticated`, `GRANT` to `service_role`):

```sql
CREATE OR REPLACE FUNCTION public.start_section_for_session(
  p_access_token text,
  p_session_id   uuid,
  p_section_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_participant_id uuid;
  v_assessment_id  uuid;
  v_limit          int;
  v_role           assessment_section_role;
  v_grace          int;
  v_mult           numeric := 1.0;
  v_accom          uuid;
  v_row            participant_section_states;
BEGIN
  SELECT ps.campaign_participant_id, ps.assessment_id
    INTO v_participant_id, v_assessment_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND cp.deleted_at IS NULL
    AND ps.status = 'in_progress';

  IF v_participant_id IS NULL THEN RETURN NULL; END IF;

  SELECT s.time_limit_seconds, s.section_role, s.grace_seconds
    INTO v_limit, v_role, v_grace
  FROM assessment_sections s
  WHERE s.id = p_section_id AND s.assessment_id = v_assessment_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Practice sections are never timed, whatever the column says (doc 03 §2).
  IF v_role = 'practice' THEN v_limit := NULL; END IF;

  IF v_limit IS NOT NULL THEN
    SELECT a.id, a.time_multiplier INTO v_accom, v_mult
    FROM participant_accommodations a
    WHERE a.campaign_participant_id = v_participant_id
      AND a.revoked_at IS NULL
      AND a.kind = 'extra_time'
      AND (a.assessment_id IS NULL OR a.assessment_id = v_assessment_id)
    ORDER BY a.assessment_id NULLS LAST, a.time_multiplier DESC
    LIMIT 1;
    v_mult := COALESCE(v_mult, 1.0);
  END IF;

  INSERT INTO participant_section_states AS st (
    session_id, section_id, started_at, base_limit_seconds,
    time_multiplier, accommodation_id, deadline_at, grace_seconds)
  VALUES (
    p_session_id, p_section_id, now(), v_limit,
    v_mult, v_accom,
    CASE WHEN v_limit IS NULL THEN NULL
         ELSE now() + make_interval(secs => ceil(v_limit * v_mult)) END,
    v_grace)
  ON CONFLICT (session_id, section_id) DO NOTHING;

  SELECT * INTO v_row FROM participant_section_states
  WHERE session_id = p_session_id AND section_id = p_section_id;

  RETURN jsonb_build_object(
    'startedAt',    v_row.started_at,
    'deadlineAt',   v_row.deadline_at,
    'serverNow',    now(),
    'graceSeconds', v_row.grace_seconds,
    'multiplier',   v_row.time_multiplier,
    'expired',      v_row.deadline_at IS NOT NULL AND now() > v_row.deadline_at,
    'finalised',    v_row.finalised_at IS NOT NULL);
END; $$;

REVOKE EXECUTE ON FUNCTION public.start_section_for_session(text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_section_for_session(text, uuid, uuid)
  TO service_role;
```

`ON CONFLICT DO NOTHING` is the whole refresh story: the clock starts once, on first delivery of
that section, and no client action can restart it.

### 3.2 Deadline enforcement in the save RPCs

Both `save_response_for_session` (`20260424143500`) and `save_responses_batch_for_session`
(`20260810093000`) are re-issued with `CREATE OR REPLACE` (same signatures, so the existing
`REVOKE`/`GRANT` set still applies — re-state them anyway for clarity).

In the batch function, immediately after `v_section_id` is resolved and before the bounds ladder:

```sql
    -- Server-authoritative deadline. Late writes are REJECTED, not clamped —
    -- same contract as the bounds check: the item is absent from the returned
    -- array, so the client surfaces its failure banner rather than silently
    -- believing a discarded answer was saved.
    SELECT st.deadline_at, st.grace_seconds, st.finalised_at
      INTO v_deadline, v_grace, v_finalised
    FROM participant_section_states st
    WHERE st.session_id = p_session_id AND st.section_id = v_section_id;

    IF v_finalised IS NOT NULL THEN
      CONTINUE;
    END IF;
    IF v_deadline IS NOT NULL
       AND now() > v_deadline + make_interval(secs => COALESCE(v_grace, 20)) THEN
      CONTINUE;
    END IF;
```

The single-save RPC gets the same block, returning `false` instead of `CONTINUE`.

**Why the grace period exists and why it is 20 s:** a save posted at T−1 s can arrive at T+3 s over
a poor mobile link, and the offline queue can hold a genuinely-in-time answer for a few seconds
(`FLUSH_INTERVAL_MS` is 1500 ms, retry backoff climbs to 10 s). Rejecting those punishes network
quality, which is exactly the construct-irrelevant variance doc 03 §1.4 exists to exclude. 20 s
covers one full backoff cycle. It is per-section configurable
(`assessment_sections.grace_seconds`) and it does **not** extend the displayed countdown — the
candidate sees the true deadline.

**Clock skew:** the client's clock is never used for any decision. `start_section_for_session`
returns `serverNow` alongside `deadlineAt`; the client computes
`skewMs = Date.parse(serverNow) - Date.now()` once at hydration and drives the countdown from
`performance.now()` deltas against `Date.parse(deadlineAt) - skewMs`. A candidate who moves their
system clock changes only their own display, never enforcement.

### 3.3 Expiry, auto-submit, and finalisation

```sql
CREATE OR REPLACE FUNCTION public.finalise_section_for_session(
  p_access_token text,
  p_session_id   uuid,
  p_section_id   uuid,
  p_reason       text            -- 'participant' | 'client_timer'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
…
  -- 1. re-validate token/session/section exactly as above
  -- 2. refuse unless (deadline_at IS NOT NULL AND now() > deadline_at) OR p_reason='participant'
  -- 3. UPDATE participant_section_states
  --      SET expired_at = COALESCE(expired_at, deadline_at),
  --          finalised_at = now(), finalised_by = p_reason
  --    WHERE finalised_at IS NULL
  -- 4. RETURN the section state + a count of unanswered delivered items
$$;
```

Three finalisation triggers, in order of preference:

1. **Participant** finishes the section normally → server action `finaliseSection` →
   `finalise_section_for_session(..., 'participant')` → navigate.
2. **Client timer** hits zero → the same server action with `'client_timer'`; the server verifies
   the deadline actually passed, so a tampered client cannot end a section early (and cannot extend
   one — the deadline is server-side regardless).
3. **Sweep** for abandoned sessions: a new cron `/api/cron/assessment-timing-sweep` registered in
   `vercel.json` at `*/5 * * * *`, modelled on
   `src/lib/reports/generation-sweep.ts` + `src/app/api/cron/report-generation-sweep/route.ts`.
   It finds `participant_section_states` rows with
   `finalised_at IS NULL AND deadline_at < now() - interval '10 minutes'`, finalises them
   (`'sweep'`), and, when every section of the session is finalised, invokes the same submit path
   as the participant (marking `participant_sessions.status='completed'` and running the scorer).

**Auto-submit on expiry of the last section:** the client-timer path finalises the section and then
calls the existing `submitSession`. `submitSession` must not reject on incompleteness for expired
sections — see §3.5.

### 3.4 The timer component

Replace `src/components/assess/section-timer.tsx` (the existing one re-creates its interval every
tick because `remaining` is in the dependency array, drifting several seconds per minute):

```ts
export function SectionTimer({ deadlineAt, serverNow, onExpiry }: {
  deadlineAt: string; serverNow: string; onExpiry: () => void;
})
```

- Computes `skewMs` once on mount; ticks on a single `setInterval(…, 250)` reading
  `Date.now() + skewMs`; renders whole seconds.
- Fires `onExpiry` exactly once (ref-guarded).
- Re-syncs on `visibilitychange`/`pageshow` (a backgrounded mobile tab throttles timers; the
  computed remaining is derived from wall-clock, so it self-corrects).
- Per doc 03 §10 there is **no per-item countdown** — one section timer plus an items-remaining
  indicator, deliberately.

### 3.5 Refresh, reconnect, and the completeness gate

- **Refresh mid-section:** page re-renders → `getSessionState` → `start_section_for_session`
  returns the *original* `started_at`/`deadline_at` → timer resumes at the true remaining time.
  Responses come from the DB plus the IndexedDB queue as today.
- **Reconnect after being offline past the deadline:** the queue flushes, the RPC rejects the late
  items, `savedItemIds` omits them, and the client's existing persistent-failure banner shows. The
  section is then finalised by the client timer (which has already fired) or the sweep.
- **Completeness gate:** `getSessionCompleteness` gains an `expiredSectionIds` input; items
  delivered in an expired section that have no response are excluded from `expected` and recorded
  as `omitted` outcomes at scoring time. Without this change, `submitSession`'s
  `incomplete_submission` guard (`src/app/actions/assess.ts:1419-1439`) would make a timed-out
  candidate permanently unable to submit — the single most likely way to ship a broken timed test.

---

## 4. Scoring

### 4.1 The dispatcher

`src/lib/scoring/dispatch.ts` (new):

```ts
export async function scoreSession(sessionId: string):
  Promise<{ success: true; scoreCount: number } | { error: string }> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('participant_sessions')
    .select('assessment_id, assessments(scoring_profile)')
    .eq('id', sessionId).single()
  if (error || !data) return { error: error?.message ?? 'Session not found' }

  switch (data.assessments?.scoring_profile ?? 'pomp_factor') {
    case 'pomp_factor':         return scoreSessionCTT(sessionId)
    case 'ability_dichotomous': return scoreSessionAbility(sessionId)
    case 'ability_irt':         return scoreSessionAbilityIRT(sessionId)
    default:                    return { error: `Unknown scoring profile` }
  }
}
```

`src/app/actions/assess.ts:1158` changes from `await scoreSessionCTT(input.sessionId)` to
`await scoreSession(input.sessionId)` inside `finalizeCompletedSessionProcessing`. Nothing else in
the submit state machine moves: the `scoring → scored → reporting/ready` transitions,
`markParticipantSessionProcessing`, the report-snapshot fan-out, and the token rotation all stay.

**Why a new `scoring_profile` enum rather than dispatching on `assessments.scoring_method`:**
`scoring_method` is `irt|ctt|hybrid`, and every existing assessment is `ctt`. Ability sum-correct
is *also* CTT, so `scoring_method` cannot distinguish mean-POMP from sum-correct without
retro-fitting meaning onto existing rows. `scoring_profile` defaults to `pomp_factor`, so every
existing assessment keeps today's behaviour with no data migration. `scoring_method` remains as the
psychometric-model label and is what `participant_scores.scoring_method` records.

### 4.2 `scoreSessionAbility` — `src/lib/scoring/ability-session.ts`

```
SCORER_VERSION = 'ability-sum-correct@1'

1. Load session (assessment_id, campaign_id) and all participant_section_forms rows.
   → the delivered set is the frozen form, NOT a re-derivation. Fail closed if a
     scored section has no form row.
2. Load items for every form entry: id, construct_id, purpose, item_version, content_hash.
   → if any entry's contentHash ≠ the item's current content_hash: ABORT with
     'item content changed mid-flight' (the immutability trigger should make this
     impossible; the check is the seatbelt, and it must be loud, per the repo's
     fail-loudly convention in ctt-session.ts).
3. Load keys: item_answer_keys for those item ids (admin client only).
   → any scored item with no key: ABORT. A missing key must never score as wrong.
4. Load responses (item_id, response_value, response_time_ms, answered_at) and
   item_options (id, item_id, value) for value→option resolution.
5. Load participant_section_states → expired sections.
6. Per form entry, emit a participant_item_outcomes row:
     purpose 'practice'                     → outcome 'excluded', counts_toward_score false
     purpose 'seed'                         → correct/incorrect as normal, counts false
     no response, section expired           → 'expired_unseen', counts true
     no response, section not expired       → 'omitted',        counts true
     response → option → option = key       → 'correct'   else 'incorrect'
   rapid_guess = response_time_ms < 3000 (matrices) / 4000 (deductive) — FLAG ONLY;
   it never alters the score (doc 03 §10).
7. Aggregate per FACTOR (via items.construct_id → factor_constructs → assessment_factors):
     raw_correct     = count(outcome='correct' AND counts_toward_score)
     items_attempted = count(counts_toward_score AND outcome IN ('correct','incorrect'))
     itemsUsed       = count(counts_toward_score)
     scaled_score    = 100 * raw_correct / itemsUsed        -- percent correct
8. Upsert participant_scores on (session_id, factor_id):
     raw_score = raw_correct, scaled_score = percent correct,
     metric = 'percent_correct', scoring_method = 'ctt',
     scoring_variant = 'sum_correct', items_used, raw_correct, items_attempted,
     provisional = true            -- until doc 03 §12 stages 1–4 complete
9. Composite: participant_sessions.composite_score = 0.70*LR-M + 0.30*LR-D
   (doc 03 §2), composite_method = 'weighted_lr_v1'. Weights come from a new
   assessment_factors.composite_weight column (additive, default NULL = equal
   weights) so the 70/30 is data, not a constant in code.
```

**Why percent-correct in `scaled_score` rather than the raw sum:** every downstream consumer —
band schemes (`src/lib/reports/band-scheme.ts`), `score_overview`/`score_detail` blocks, the
trajectory canvas — treats `scaled_score` as a 0–100 quantity. Writing a raw count there would
render "13" as a 13% band. `raw_score`/`raw_correct` preserve the count.

**Why not POMP through `scoreKeyedResponse`:** `src/lib/scoring/keyed-options.ts` POMP-scales the
chosen option's key across the item's key range, which for a dichotomous item collapses to
0 or 100 per item and then *means* them — numerically identical to percent-correct, but it routes
right/wrong through a keying abstraction meant for SJT gradations, and it requires putting keys
back into `item_options.score_value`, which is the thing §1.2.6 removes. Keep the paths separate.

### 4.3 Extending to IRT — `scoreSessionAbilityIRT`

Everything needed already exists and is dormant:

```
1. Read participant_item_outcomes for the session (already dichotomous 0/1) —
   the outcome table is the IRT input, which is why step 6 above persists it
   even for the sum-correct MVP.
2. Load item_parameters WHERE is_current AND scale_code = <the factor's scale>.
   If any counts_toward_score item lacks current parameters → fall back to
   scoreSessionAbility and record scoring_variant='sum_correct_fallback'
   plus the missing item ids in the log. Never partially theta-score.
3. Build Map<itemId, IRTParameters> and call
   estimateEAP(responses, itemParams)  — src/lib/scoring/irt/estimation.ts:240
   (EAP, not MLE: defined at perfect/zero scores, and doc 06 §4.3 specifies EAP
   with a standard-normal prior on the calibration population).
4. theta, theta_se = estimate.theta, estimate.standardError.
5. T-score: scoreToTScore / toTScore  — src/lib/scoring/transforms.ts:85-92,
   referenced to a named norm group.
6. Percentile: from norm_tables.percentile_lookup for that norm group version,
   NOT toPercentile()'s normal approximation, unless normality is confirmed
   (doc 06 §4.4 step 4).
7. Write participant_scores: metric='t_score', scoring_variant='eap_2pl',
   theta, theta_se, parameter_scale_code, norm_group_id, norm_version,
   scaled_score = T-score, percentile,
   confidence_interval_lower/upper = T ± 1.96 * (10 * theta_se)   -- SEM in T units
```

Gate: `assessments.scoring_profile` flips to `ability_irt` only when the doc 06 §4.3 N-floors are
met, and the flip is a data change, not a deploy.

### 4.4 What is written to `participant_scores` — summary

| Column | MVP (`sum_correct`) | Phase B (`eap_2pl`) |
|---|---|---|
| `factor_id` | LR-M factor / LR-D factor | same |
| `raw_score` | count correct | theta |
| `scaled_score` | percent correct (0–100) | T-score |
| `metric` | `percent_correct` | `t_score` |
| `scoring_method` | `ctt` | `irt` |
| `scoring_variant` | `sum_correct` | `eap_2pl` |
| `raw_correct` / `items_attempted` / `items_used` | populated | populated |
| `theta` / `theta_se` / `parameter_scale_code` | NULL | populated |
| `percentile`, `confidence_interval_*` | NULL | populated |
| `norm_group_id` / `norm_version` | NULL | populated |
| `provisional` | `true` | `true` until doc 03 §12 completes |

---

## 5. Practice mode

### 5.1 Shape

- Practice items: `items.purpose = 'practice'`, same family and construct as scored siblings,
  drawn from the easiest band (doc 03 §2).
- Practice section: `assessment_sections.section_role = 'practice'`,
  `time_limit_seconds` ignored by `start_section_for_session`, `allow_back_nav = true`.
- LR-M gets two practice items before the scored section (doc 03 §2).

### 5.2 The feedback flow

`src/app/actions/assess-practice.ts` (new module, `'use server'`):

```ts
export async function checkPracticeAnswer(input: {
  token: string; sessionId: string; itemId: string; responseValue: number
}): Promise<
  | { ok: true; correct: boolean; correctOptionId: string; explanation: string }
  | { ok: false; error: string }
> {
  // 1. zod-validate (new schema in src/lib/validations/assess.ts)
  // 2. await requireParticipantRuntimeSessionAccess(token, sessionId)   ← authz gate
  //    (satisfies tests/architecture/admin-actions-authz.test.ts's require* pattern)
  // 3. rate limit: checkAssessApiTokenRateLimit('practice-check', token)
  // 4. HARD GUARD — the load-bearing check:
  //      SELECT i.purpose, s.section_role
  //      FROM items i
  //      JOIN assessment_section_items asi ON asi.item_id = i.id
  //      JOIN assessment_sections s ON s.id = asi.section_id
  //      WHERE i.id = :itemId AND s.assessment_id = <session's assessment>
  //    Refuse unless i.purpose = 'practice' AND s.section_role = 'practice'.
  //    Refuse if the item also appears in ANY non-practice section of the assessment.
  // 5. Only then read item_answer_keys + item_option_diagnostics for the explanation.
  // 6. Return correctness + the correct option id + a plain-language explanation.
}
```

Revealing the key of a *practice* item is required (that is what practice is), and safe, because
practice items are excluded from scoring and never appear in a scored section — which step 4
enforces structurally rather than by convention. This is the single riskiest new surface in the
build; it gets its own integration test asserting that a scored item id returns
`{ ok: false }` and that no key material appears in the response.

The client calls it from `cognitive-response.tsx` when `item.isPractice` is true, after Confirm,
and renders correct/incorrect plus the explanation, then a Continue button.

### 5.3 Exclusion from scoring and analytics

- `scoreSessionAbility` writes `outcome='excluded', counts_toward_score=false` for
  `purpose='practice'` (§4.2 step 6) — they never enter any factor aggregate.
- Practice items **do** count for the completeness gate (they are delivered and must be answered);
  two items with feedback is not a burden and it keeps the gate logic uniform.
- Timing analytics exclude practice by joining on `counts_toward_score`.
- Seeds are the mirror image: `counts_toward_score = false` but outcomes are recorded, because
  seed responses are the calibration input (doc 06 §5.1).

---

## 6. Generator placement

**Recommendation: a pure TypeScript generator library under `src/lib/cognitive/generator/`, driven
by an offline Node script `scripts/cognitive/generate-matrix-bank.mjs` run by an engineer (and in
CI as a determinism check), writing through the service-role client and recording every run in
`cognitive_generation_runs`.**

Rejected alternatives, with reasons grounded in this repo:

| Option | Why not |
|---|---|
| **Next.js API route / server action** | Generation is batch (hundreds of items × the doc 03 §5.4 QA battery), not per-request. The existing AI-generation server action (`src/app/actions/generation.ts:496`) needs its progress-polling machinery precisely because it is LLM-latency-bound; matrix generation is deterministic CPU work with no model call, so it inherits all of that complexity and none of the benefit, while acquiring serverless execution limits. |
| **Supabase edge function** | The repo has **no** `supabase/functions` directory — zero precedent, a second (Deno) runtime, and it would need duplicate copies of the spec zod schema, the hash function, and the renderer, which are shared with delivery and tests. |
| **Background job queue** | No job-queue infrastructure exists. The four Vercel crons in `vercel.json` are sweeps, not work queues. Building one for a task that runs a handful of times per quarter is unjustified. |
| **Extend the AI-GENIE pipeline (`src/lib/ai/generation/pipeline.ts` + `generation_runs`)** | Its whole value is LLM batching + embeddings + EGA/bootEGA/walktrap redundancy pruning on *unkeyed self-report* items; `generated_items` is `NOT NULL construct_id` with `embedding`, `community_id`, `wto_max`, `boot_stability` columns that mean nothing for matrices. Matrix generation needs the opposite: deterministic rule composition, solution-uniqueness proof, and labelled distractors. Bending one into the other produces a table half-full of NULLs and a pipeline with two incompatible halves. **Reuse the *conventions*** (a run row, a params/seed record, per-run item rows, an audit trail) **not the tables.** When the deductive/verbal components need LLM drafting, extend AI-GENIE there — its prompt-management and run-audit layers genuinely fit that work. |

Concretely:

```
src/lib/cognitive/generator/
  rng.ts          # mulberry32 seeded PRNG (reuse the approach in src/lib/item-ordering.ts)
  rules.ts        # R0–R9 as pure transforms over the attribute space (doc 03 §3)
  compose.ts      # family → grid: apply rules row-wise, verify column-wise
  distractors.ts  # WR / IR / PM / RP generators (doc 03 §5.3), one per named error
  qa.ts           # the doc 03 §5.4 battery, all five checks, as hard assertions
  index.ts        # generateFamily(familySpec, seed, n) → CandidateItem[]
scripts/cognitive/generate-matrix-bank.mjs   # thin: parse args, call the lib, write DB
```

`qa.ts` is not optional post-hoc validation — `generateFamily` throws if any check fails, so an
invalid item cannot reach the database:

1. **Uniqueness** — enumerate the attribute space of candidate completions; assert exactly one
   satisfies all rules.
2. **Column consistency** — assert every rule holds down columns.
3. **Distractor audit** — assert each distractor violates ≥ 1 rule and matches its declared label.
4. **Accidental-regularity scan** — assert no unintended alternation/symmetry/count rule licenses
   another option.
5. **Render check** — render at 360 px and assert min element ≥ 8 px, stroke ≥ 1.5 px.

Reproducibility contract: `(generator_version, git_sha, seed, params)` → byte-identical specs,
asserted by a unit test that regenerates a committed fixture bank and compares `content_hash`.

The eight exemplars M1–M8 from doc 03 §6 are committed as **fixtures**
(`tests/fixtures/cognitive/matrices/M1.json` …) hand-written to the spec schema, used to pin the
renderer and the QA battery independently of the generator. The generator's job is to reproduce
their families' clones, not the exemplars themselves.

---

## 7. Reporting

### 7.1 What works with no new blocks

Because `scoreSessionAbility` writes ordinary factor rows with a 0–100 `scaled_score`, the existing
`score_overview`, `score_detail`, and `contents` blocks render an LR report today, via the
`scoreMap` built at `src/lib/reports/runner.ts:158-163`. That is the honest MVP: ship LR-M with the
standard template.

### 7.2 What needs a new block, and when

A new block is required the moment scores stop being 0–100 percent-correct, because the existing
blocks and band schemes assume that scale and carry no SEM, no norm-group attribution, and no
provisional labelling.

**New block: `cognitive_profile`** (category `score`).

Renders, per scale (LR-M, LR-D) and for the composite:

- Score in its stated metric with the metric named ("T = 62", "percent correct = 72%").
- **SEM band** drawn as a bar, with the plain-language framing doc 06 §4.5/§4.6 requires
  ("scores within this range are not meaningfully different").
- **Norm-group attribution line**: group name, N, collection window; suppressed with an explicit
  "no norm group" statement when `norm_group_id IS NULL` (never a silent percentile).
- **Provisional banner** when any contributing `participant_scores.provisional` is true:
  "Pilot — not for selection decisions" (doc 03 §11 requires product-level enforcement).
- Band label from the resolved band scheme, with the SEM bar drawn crossing band boundaries when it
  does (doc 06 §4.6 point 4).

**Touch list to add a block** (derived from the `score_overview` fan-out):

1. `src/lib/reports/types.ts` — add `'cognitive_profile'` to `BlockType` and a config interface to
   `BlockConfigMap`.
2. `src/lib/reports/registry.ts` — `BLOCK_REGISTRY.cognitive_profile` entry
   (`category: 'score'`, `supportedModes: ['open','featured']`, `defaultMode: 'open'`).
3. `src/lib/reports/runner.ts` — a resolver case building
   `{ scales: [{factorId, label, metric, score, sem, band, normGroup, provisional}], composite }`
   from `participant_scores` (the runner currently projects only `scaled_score` into `scoreMap`; the
   block resolver reads the full rows from `scoresResult.data`).
4. `src/components/reports/blocks/cognitive-profile.tsx` + registration in `BLOCK_COMPONENTS`
   (`src/components/reports/report-renderer.tsx:33`).
5. `src/lib/reports/sanitize-block-data.ts` — a case (no admin-authored HTML, so pass-through).
6. `src/lib/reports/sample-data.ts` and the builder UI
   (`add-block-gallery.tsx`, `block-content-panels.tsx`, `block-builder-client.tsx`).
7. `src/lib/reports/contents-sections.ts` if it should appear in the table of contents.
8. `tests/unit/block-registry.test.ts` — add the type assertion.

PDF needs no separate work: the PDF path renders the same React tree through the headless browser
(`src/lib/reports/pdf-browser.ts`), so there is no react-pdf block map to update.

**Explicitly not built:** per-item correctness in any candidate- or client-facing report. That is
key-equivalent (see `participant_item_outcomes` RLS) and doc 06 §7.1 forbids it. Item-level
analysis belongs in the internal psychometrics surface
(`src/app/(dashboard)/psychometrics/items/`), gated to `platform_admin`.

---

## 8. Testing

### Unit (`tests/unit/`, no DB)

| File | Asserts |
|---|---|
| `cognitive-spec-schema.test.ts` | `.strict()` rejects `key`/`answer`/`isCorrect`/unknown fields; valid M1–M8 fixtures parse; layer vocabulary is closed. |
| `cognitive-render-matrix.test.ts` | Snapshot of M1–M8 SVG; **no** `<script`, `<foreignObject`, `on\w+=`, `href`, `xlink:`; all numeric attributes finite; min element/stroke sizes at 360 px. |
| `cognitive-render-projection.test.ts` | `toRenderSpec()` output contains no `rules`, `radicals`, `distractorPlan`. |
| `cognitive-generator-rules.test.ts` | Each R0–R9 transform; composition invariants (disjoint attribute dimensions; 1–3 non-identity rules). |
| `cognitive-generator-qa.test.ts` | The five §5.4 checks each fail on a deliberately broken item (uniqueness violated, column-inconsistent, unlabelled distractor, accidental regularity, undersized element). |
| `cognitive-generator-determinism.test.ts` | Same `(version, seed, params)` → identical `content_hash` across two runs. |
| `ability-scoring.test.ts` | Pure aggregation helper: correct/incorrect/omitted/expired mapping, practice and seed exclusion, percent-correct maths, 70/30 composite. |
| `section-deadline.test.ts` | Pure deadline maths: multiplier application, grace window, skew-corrected remaining. |
| `section-timer.test.tsx` | Fires `onExpiry` once; no drift over 10 simulated minutes; re-syncs on visibility change. |

### Integration (`tests/integration/`, local Supabase only)

Every file starts with the mandated guard — `import { canRun, createAdminClient } from "./_helpers/rls-fixture"` and `describe.skipIf(!canRun)(…)` — which is what `tests/architecture/integration-host-guard.test.ts` statically enforces and `assertLocalSupabaseUrl()` enforces at runtime. Run with `npm run test:integration:local`.

| File | Asserts |
|---|---|
| `cognitive-key-isolation.test.ts` | An `authenticated` (anon-key + signed-in user) client gets **zero rows / permission denied** on `item_answer_keys`, `item_option_diagnostics`, `cognitive_item_specs`, `cognitive_option_specs`, `participant_item_outcomes`, `participant_section_forms`, `participant_accommodations`; `select('score_value')` on `item_options` errors; `item_media` is no longer anon-readable. |
| `cognitive-session-state-payload.test.ts` | Full `getSessionState` payload for a cognitive session, serialised, contains the grid/option SVG and contains none of: the key option id in a key-ish field, `correct`, `errorLabel`, `rules`, `radicals`, `score_value`. |
| `section-timing-rpc.test.ts` | `start_section_for_session` is idempotent across calls; applies a 1.5× accommodation; a save inside the deadline succeeds; a save past deadline+grace is absent from `savedItemIds` (both the batch and single RPCs); a save inside the grace window succeeds; a finalised section rejects all writes. |
| `session-form-freeze.test.ts` | Two concurrent `getSessionState` calls produce one form row; a second call after an item is archived still delivers the frozen set; the option order is stable across calls and differs across sessions. |
| `ability-scoring.test.ts` | End-to-end: seeded assessment with keys, mixed responses, one omitted, one practice, one seed → expected `participant_item_outcomes` rows, expected `participant_scores` (factor rows, `metric`, `raw_correct`), expected `composite_score`; a missing key aborts scoring rather than scoring zero; a mid-flight `content_hash` change aborts. |
| `scoring-dispatch.test.ts` | `scoring_profile='pomp_factor'` still routes to `scoreSessionCTT` (regression guard for every existing assessment); `ability_dichotomous` routes to the new scorer. |
| `practice-answer-check.test.ts` | `checkPracticeAnswer` returns feedback for a practice item; **refuses** for a scored item, for an item in another assessment, and for a bad token; response body contains no key material for the refusal cases. |
| `expired-section-submit.test.ts` | A session with an expired section and unanswered items **can** submit (the completeness gate excludes them) and the unanswered items land as `expired_unseen`. |
| `timing-sweep.test.ts` | The sweep finalises an abandoned expired section and completes+scores the session. |

### Architecture (`tests/architecture/`)

| File | Asserts |
|---|---|
| `answer-key-isolation.test.ts` (new) | §2.6: runner-path files never reference the secure set (single audited allowlist entry for `assess-practice.ts`, which must also contain the practice-purpose guard); runner DTO type declarations contain no key-ish field names. |
| `no-db-in-components.test.ts` (existing) | Passes unchanged — `cognitive-response.tsx` receives everything as props. |
| `admin-actions-authz.test.ts` (existing) | `checkPracticeAnswer` and `finaliseSection` must call `requireParticipantRuntime*` (matches the `require\w+\(` pattern) — **no allowlist entry needed**, and none should be added. |
| `integration-host-guard.test.ts` / `rls-fixture-guard.test.ts` (existing) | Cover the new integration tests automatically. |

### E2E (`tests/e2e/`)

One seeded smoke spec: practice item with feedback → scored section with a visible countdown →
refresh mid-section (timer resumes, does not reset) → complete → report renders. Keep it in
`tests/e2e/seeded`, not `smoke` (the smoke job gates CI and must stay fast).

---

## 9. Migration and deploy sequencing

Per `AGENTS.md`. **Every branch in a worktree**: `scripts/agent-worktree.sh feat/cognitive-<slice>`
off `origin/main`, never in the primary checkout.

### Migration order (hard constraints)

1. `<ts>_cognitive_enums.sql` — enum values **only**. Must be its own migration: Postgres forbids
   using a value in the transaction that adds it (SQLSTATE 55P04; the hazard is documented at
   `00001_initial_schema.sql:45-51` and previously broke `supabase db reset`).
2. `<ts>_cognitive_item_bank.sql` — §1.2 (constraint relax, families, item columns, lifecycle
   triggers, specs, keys, diagnostics, generation runs, RLS/grants).
3. `<ts>_item_key_privilege_hardening.sql` — §1.2.6 (column revoke on `score_value`,
   `item_media`/`item_scoring_rubrics`/`item_parameters`/`item_statistics` policy tightening).
   Separate file so it can be reverted independently if an unnoticed RLS-scoped reader surfaces.
4. `<ts>_cognitive_delivery_and_timing.sql` — §1.3 plus the three RPCs
   (`start_section_for_session`, `finalise_section_for_session`, and `CREATE OR REPLACE` of both
   save RPCs with the deadline block).
5. `<ts>_cognitive_scoring.sql` — §1.4 (`scoring_profile`, outcomes, `participant_scores` columns,
   `item_parameters` versioning).

### Per-migration procedure

1. Apply locally: `npx supabase db reset --local` (full reset, because of the enum ordering) and
   verify with `npm run test:integration:local`.
2. Apply to the live project with the Supabase MCP `apply_migration` — **before** opening the PR,
   so Vercel previews build against the new schema (AGENTS.md "Sequencing rationale").
3. Run `mcp__…__get_advisors` after **every** DDL migration. The three new `SECURITY DEFINER`
   functions need `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` + `GRANT … TO service_role`
   in the same migration (pattern: `20260424143500`, and the follow-up-revoke precedent
   `20260512150000_trajectory_revoke_trigger_fn_exec.sql`). Expect advisor warnings for the new
   RLS-enabled-no-policy tables; they are intentional and get a note in the PR body.
4. Commit the migration file so source matches live.
5. `gh pr create`, watch with `gh pr checks <num> --watch` (jobs: `security` → `quality` +
   `integration` → `e2e-smoke`). An `npm audit` failure upstream of the diff is repo maintenance:
   fix in a separate `chore(deps)` commit on the same branch.
6. `gh pr merge --squash --delete-branch`, then `git checkout main && git pull --ff-only &&
   git branch -D <branch>`, then `git worktree remove <path>`.

### Suggested PR slicing

| PR | Contents | Gate to merge |
|---|---|---|
| 1 | Migrations 1–3; `src/types/database.ts` enum additions; `answer-key-isolation` arch test; `cognitive-key-isolation` integration test. No behaviour change. | Key-isolation tests green; existing suite unchanged. |
| 2 | Migration 4; `start_section_for_session` + deadline enforcement + finalisation RPC; timing DAL; new `SectionTimer`; `section_role`/`allowBackNav` in the DTO; completeness-gate change; timing sweep cron + `vercel.json`. | `section-timing-rpc`, `expired-section-submit`, `timing-sweep` green. |
| 3 | Frozen forms: `participant_section_forms`, `session-forms.ts` DAL, `getSessionState` and `session-completeness.ts` refactor. Applies to **all** assessments — the highest-regression-risk PR. | `session-form-freeze` green plus the full existing integration suite. |
| 4 | Spec schema, renderer, `cognitive-items.ts` DAL, `CognitiveResponse` component, `item-card` dispatch, latency capture, `cognitive` in `response-formats.ts` + `ActiveResponseFormatType`. | Render unit tests + `cognitive-session-state-payload` green. |
| 5 | Migration 5; `scoreSessionAbility`, dispatcher, `submitSession` swap. | `ability-scoring`, `scoring-dispatch` green. |
| 6 | Practice mode: `assess-practice.ts`, practice UI, exclusion. | `practice-answer-check` green. |
| 7 | Generator library + script + fixtures + the LR-M pilot bank seed. | Generator unit tests; QA battery green over the whole generated bank. |
| 8 | `cognitive_profile` report block (only when metrics move beyond percent-correct). | Block registry + snapshot tests. |

PRs 1–3 are the foundations the other cognitive tests (numerical, verbal) reuse verbatim; PRs 4–7
are LR-M-specific.

---

## 10. Open questions to settle before PR 1

1. **`distractorPlan` placement** (§1.2.4) — I recommend moving it out of the spec into
   `item_option_diagnostics`. It is a one-line change now and a leak class later. Confirm.
2. **Grace period default of 20 s** (§3.2) — psychometrically it is a rounding error against a
   22-minute limit, but it is a policy choice that belongs in the technical manual. Confirm 20 s,
   or set it per section.
3. **Practice items in the completeness gate** (§5.3) — I have them counting as required. The
   alternative (optional, skippable) needs a "skip practice" affordance and a gate exception.
4. **Composite weighting storage** (§4.2) — I propose `assessment_factors.composite_weight`
   (additive, NULL = equal). The alternative is a constant in the scorer, which would make the
   70/30 undiscoverable from the data.
5. **`norm_group_versions`** — the 2026-06-13 note's snapshot table is out of scope here but is a
   hard prerequisite for showing any percentile. Confirm it stays deferred and that PR 5 ships with
   `percentile` NULL rather than a normal-approximation placeholder.
