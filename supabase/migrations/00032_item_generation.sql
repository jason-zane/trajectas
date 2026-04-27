BEGIN;
-- ==========================================================================
-- 00032_item_generation.sql
-- AI-GENIE Item Generator: generation_runs, generated_items, generation_run_logs
-- ==========================================================================

-- Enums
CREATE TYPE generation_run_status AS ENUM (
  'configuring', 'generating', 'embedding',
  'analysing', 'reviewing', 'completed', 'failed'
);
-- Main run table
CREATE TABLE generation_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status            generation_run_status NOT NULL DEFAULT 'configuring',
  current_step      TEXT,
  progress_pct      INT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),

  config            JSONB NOT NULL DEFAULT '{}'::jsonb,

  items_generated   INT NOT NULL DEFAULT 0,
  items_after_uva   INT,
  items_after_boot  INT,
  items_accepted    INT,
  nmi_initial       NUMERIC,
  nmi_final         NUMERIC,

  prompt_version    INT,
  model_used        TEXT,
  token_usage       JSONB DEFAULT '{}'::jsonb,
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ
);
-- Candidate items (before acceptance)
CREATE TABLE generated_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_run_id UUID NOT NULL REFERENCES generation_runs(id) ON DELETE CASCADE,
  construct_id      UUID NOT NULL REFERENCES constructs(id) ON DELETE RESTRICT,

  stem              TEXT NOT NULL,
  reverse_scored    BOOLEAN NOT NULL DEFAULT false,
  rationale         TEXT,

  embedding         FLOAT8[] NOT NULL DEFAULT '{}',
  community_id      INT,
  wto_max           NUMERIC,
  boot_stability    NUMERIC CHECK (boot_stability IS NULL OR boot_stability BETWEEN 0 AND 1),
  is_redundant      BOOLEAN NOT NULL DEFAULT false,
  is_unstable       BOOLEAN NOT NULL DEFAULT false,

  is_accepted       BOOLEAN,
  saved_item_id     UUID REFERENCES items(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Audit log
CREATE TABLE generation_run_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_run_id UUID NOT NULL REFERENCES generation_runs(id) ON DELETE CASCADE,
  step              TEXT NOT NULL,
  status            TEXT NOT NULL,
  details           JSONB DEFAULT '{}'::jsonb,
  duration_ms       INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Indexes
CREATE INDEX idx_generation_runs_status ON generation_runs(status);
CREATE INDEX idx_generated_items_run ON generated_items(generation_run_id);
CREATE INDEX idx_generated_items_construct ON generated_items(construct_id);
CREATE INDEX idx_generation_run_logs_run ON generation_run_logs(generation_run_id);
COMMIT;
