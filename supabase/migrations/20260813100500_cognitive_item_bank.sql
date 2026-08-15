-- Cognitive item bank (LR-1 / #331) — Migration B: item bank, families,
-- lifecycle triggers, structured specs, answer keys, provenance.
--
-- Spec: docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
-- 02-platform-architecture.md §1.2.1-1.2.5, 1.2.7 (§1.2.6 is its own
-- migration, 20260813101000, so it can be reverted independently; §1.3/§1.4
-- — delivery/timing/scoring — are separate issues, #332/#333/#335).
--
-- Deviations from the doc, found by checking the live schema (00001, 00008,
-- 00016 migrations) before writing this file:
--   1. Table order: the doc's §1.2.4 (cognitive_item_specs) has a FK to
--      cognitive_generation_runs, which the doc only creates in §1.2.7,
--      later in the same file. Creating cognitive_item_specs before
--      cognitive_generation_runs exists would fail ("relation ... does not
--      exist"). This migration creates the §1.2.7 table first.
--   2. items_purpose_construct_check's *current* definition (verified
--      against 00016_validity_items.sql) is exactly what the doc assumes:
--      (purpose = 'construct' AND construct_id IS NOT NULL) OR
--      (purpose != 'construct' AND construct_id IS NULL). No drift there.
--   3. Added `trg_<table>_updated_at BEFORE UPDATE ... EXECUTE FUNCTION
--      set_updated_at()` triggers for item_families, cognitive_item_specs,
--      and item_answer_keys — the doc gives them nullable `updated_at`
--      columns but no trigger to stamp them. set_updated_at() is the
--      existing repo-wide convention (00001_initial_schema.sql), applied
--      to `items` itself via trg_items_updated_at.
--   4. Added an explicit `service_role full access` FOR ALL policy on each
--      new secure-set table, on top of the doc's "RLS-enabled, zero
--      policies" approach. Zero policies does deny every non-BYPASSRLS
--      role and would work — but this repo already went through exactly
--      that Supabase-advisor finding once (rls_enabled_no_policy, resolved
--      in 20260508214400_phase4_security_hardening.sql) by adding explicit
--      `FOR ALL TO service_role USING (true) WITH CHECK (true)` policies
--      rather than leaving tables policy-less. Matching that precedent
--      avoids reintroducing the same advisor finding and self-documents
--      intent; the REVOKE/GRANT statements from the doc are kept as
--      defense in depth underneath it.

-- ===========================================================================
-- §1.2.1 — Relax the purpose/construct constraint
-- ===========================================================================
-- Practice and seed items keep their construct_id — required so seeds
-- calibrate onto the right bank metric and practice items draw from the same
-- family pool. Validity items (impression_management/infrequency/
-- attention_check) remain construct-less.

ALTER TABLE items DROP CONSTRAINT items_purpose_construct_check;
ALTER TABLE items ADD CONSTRAINT items_purpose_construct_check CHECK (
  (purpose IN ('construct','practice','seed') AND construct_id IS NOT NULL)
  OR
  (purpose IN ('impression_management','infrequency','attention_check') AND construct_id IS NULL)
);

-- ===========================================================================
-- §1.2.2 — Item families and lineage
-- ===========================================================================

CREATE TABLE item_families (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL,                        -- 'LRM-XOR-XLAYER' (doc 03 §6)
  construct_id      UUID NOT NULL REFERENCES constructs(id) ON DELETE RESTRICT,
  kind              TEXT NOT NULL CHECK (kind IN ('figural_matrix','deductive')),
  rules             JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ['R6','R2'] etc.
  radicals          JSONB NOT NULL DEFAULT '{}'::jsonb,   -- doc 03 §4.1 radical profile
  predicted_b       NUMERIC,                              -- doc 03 §4.4 linear model
  band              TEXT CHECK (band IN ('easy','moderate','hard','very_hard')),
  exemplar_item_id  UUID,                                 -- FK added below, after items.family_id exists
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ,
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

CREATE TRIGGER trg_item_families_updated_at
  BEFORE UPDATE ON item_families
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===========================================================================
-- §1.2.3 — Lifecycle + immutability triggers
-- ===========================================================================
-- Operational/calibrated/retired items are frozen content: edits to
-- stem/construct_id/reverse_scored/content_hash must clone (parent_item_id +
-- item_version+1) instead of mutating in place. This is the concrete answer
-- to "editing an item mid-flight silently changes what a session was" — the
-- per-session form snapshot (delivery migration, out of scope here) records
-- content_hash so the scorer can detect drift and refuse rather than
-- mis-score.

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

-- ===========================================================================
-- §1.2.7 — Generation provenance
-- ===========================================================================
-- Created here (ahead of §1.2.4 in doc order) because cognitive_item_specs
-- below has a FK to this table — see the file-header note.

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
CREATE POLICY "service_role full access" ON cognitive_generation_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE cognitive_generation_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE cognitive_generation_runs TO service_role;

-- ===========================================================================
-- §1.2.4 — Structured item specs (the generated matrix)
-- ===========================================================================
-- The spec is the only structure rendered to the candidate. Nothing that
-- names or indexes the key may live in it — belt-and-braces to the zod
-- .strict() schema the application layer owns (src/lib/cognitive/spec/
-- schema.ts, out of scope here). `distractorPlan` (which slot has no error
-- label — i.e. is the key, by omission) lives in item_option_diagnostics
-- below, never in this spec column, per the doc's own recommendation.

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

  CONSTRAINT cognitive_item_specs_no_key CHECK (
    NOT (spec ? 'key') AND NOT (spec ? 'answer')
    AND NOT (spec ? 'correctOption') AND NOT (spec ? 'keyIndex')
    AND NOT (spec ? 'solution')
  ),
  CONSTRAINT cognitive_item_specs_shape CHECK (
    spec ? 'grid' AND jsonb_typeof(spec->'grid') = 'object'
  )
);

CREATE TRIGGER trg_cognitive_item_specs_updated_at
  BEFORE UPDATE ON cognitive_item_specs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cognitive_option_specs (
  option_id  UUID PRIMARY KEY REFERENCES item_options(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  spec       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cognitive_option_specs_item ON cognitive_option_specs(item_id);

-- ===========================================================================
-- §1.2.5 — Answer keys — the secure set
-- ===========================================================================
-- Keys live only in item_answer_keys / item_option_diagnostics: one row per
-- item identifying the correct option (item_answer_keys), plus per-option
-- error labels (item_option_diagnostics) that are key-revealing by omission
-- (whichever option has no error label is the key) and so live in the same
-- secure set, never in cognitive_item_specs.spec.

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

CREATE TRIGGER trg_item_answer_keys_updated_at
  BEFORE UPDATE ON item_answer_keys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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

-- RLS for the secure set — deny-all by absence of anon/authenticated
-- policies, plus an explicit service_role policy (see file-header note 4)
-- and explicit privilege revocation as defense in depth underneath the RLS
-- layer. Do NOT use FORCE ROW LEVEL SECURITY: the migration/table-owner role
-- would then be subject to the same deny and later DDL would fail
-- confusingly. Every read of item_options / item tables in the codebase
-- goes through the service-role admin client (src/app/actions/items.ts,
-- src/lib/scoring/ctt-session.ts, getSessionState) — no RLS-scoped
-- (@/lib/supabase/server) client touches item tables — so this is zero-risk
-- to existing behaviour.

ALTER TABLE item_answer_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_option_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_item_specs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_option_specs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_families           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access" ON item_answer_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access" ON item_option_diagnostics
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access" ON cognitive_item_specs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access" ON cognitive_option_specs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access" ON item_families
  FOR ALL TO service_role USING (true) WITH CHECK (true);

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
