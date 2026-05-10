-- =============================================================================
-- 00010_psychometric_infrastructure.sql
-- Calibration runs, item statistics, construct reliability, norm infrastructure,
-- factor analysis results, and DIF results.
-- =============================================================================

BEGIN;
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE calibration_run_type AS ENUM (
  'initial',
  'monitoring',
  'recalibration',
  'on_demand'
);
CREATE TYPE calibration_method AS ENUM (
  'ctt_only',
  'irt_2pl',
  'irt_3pl',
  'concurrent'
);
CREATE TYPE calibration_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed'
);
CREATE TYPE dif_method AS ENUM (
  'mantel_haenszel',
  'logistic_regression',
  'lord_chi_square'
);
CREATE TYPE dif_classification AS ENUM (
  'A',
  'B',
  'C'
);
-- ─────────────────────────────────────────────────────────────────────────────
-- 2. calibration_runs — audit trail for psychometric analyses
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE calibration_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type        calibration_run_type NOT NULL DEFAULT 'initial',
  method          calibration_method NOT NULL DEFAULT 'ctt_only',
  status          calibration_status NOT NULL DEFAULT 'pending',
  sample_size     INT,
  date_range_start TIMESTAMPTZ,
  date_range_end  TIMESTAMPTZ,
  notes           TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ,

  CONSTRAINT calibration_runs_sample_positive CHECK (sample_size IS NULL OR sample_size > 0)
);
-- ─────────────────────────────────────────────────────────────────────────────
-- 3. item_statistics — per-item quality metrics per calibration run
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE item_statistics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id             UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  calibration_run_id  UUID NOT NULL REFERENCES calibration_runs(id) ON DELETE CASCADE,

  -- CTT statistics
  difficulty          NUMERIC(6,4),            -- p-value (proportion correct / mean/max)
  discrimination      NUMERIC(6,4),            -- corrected item-total correlation
  alpha_if_deleted    NUMERIC(6,4),            -- Cronbach's alpha with item removed
  response_count      INT,                     -- N responses in this analysis

  -- Response distribution (JSON: option_value → count)
  response_distribution JSONB,

  -- IRT statistics (when calibrated)
  irt_information_at_0    NUMERIC(8,4),        -- information at theta=0
  irt_max_information     NUMERIC(8,4),        -- peak information
  irt_theta_at_max_info   NUMERIC(6,4),        -- theta where info peaks
  irt_infit               NUMERIC(6,4),        -- infit mean square
  irt_outfit              NUMERIC(6,4),        -- outfit mean square
  irt_param_se_a          NUMERIC(6,4),        -- SE of discrimination
  irt_param_se_b          NUMERIC(6,4),        -- SE of difficulty
  irt_param_se_c          NUMERIC(6,4),        -- SE of guessing

  -- Flags
  flagged             BOOLEAN NOT NULL DEFAULT false,
  flag_reasons        TEXT[],

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT item_statistics_unique UNIQUE (item_id, calibration_run_id)
);
-- ─────────────────────────────────────────────────────────────────────────────
-- 4. construct_reliability — per-construct reliability per calibration run
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE construct_reliability (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  construct_id        UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,
  calibration_run_id  UUID NOT NULL REFERENCES calibration_runs(id) ON DELETE CASCADE,

  -- Reliability indices
  cronbach_alpha      NUMERIC(6,4),
  omega_total         NUMERIC(6,4),            -- McDonald's omega total
  omega_hierarchical  NUMERIC(6,4),            -- McDonald's omega hierarchical
  composite_reliability NUMERIC(6,4),          -- CFA-based CR
  split_half          NUMERIC(6,4),            -- Spearman-Brown corrected

  -- Error
  sem                 NUMERIC(6,4),            -- Standard Error of Measurement
  csem_by_score       JSONB,                   -- Conditional SEM at score levels

  -- Distribution statistics
  item_count          INT,
  response_count      INT,
  mean                NUMERIC(8,4),
  standard_deviation  NUMERIC(8,4),
  skewness            NUMERIC(6,4),
  kurtosis            NUMERIC(6,4),

  -- Item contribution summary (JSON: item_id → { discrimination, alpha_if_deleted })
  item_contributions  JSONB,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT construct_reliability_unique UNIQUE (construct_id, calibration_run_id)
);
-- ─────────────────────────────────────────────────────────────────────────────
-- 5. norm_groups — segmentation for norm-referenced scoring
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE norm_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,

  -- Segmentation criteria
  industry        TEXT,
  role_level      TEXT,
  job_function    TEXT,
  region          TEXT,
  organization_id UUID REFERENCES organizations(id),

  -- Sample metadata
  sample_size     INT NOT NULL DEFAULT 0,
  collection_start TIMESTAMPTZ,
  collection_end  TIMESTAMPTZ,
  last_refreshed  TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ,

  CONSTRAINT norm_groups_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT norm_groups_sample_non_negative CHECK (sample_size >= 0)
);
-- ─────────────────────────────────────────────────────────────────────────────
-- 6. norm_tables — per-construct per-norm-group distribution data
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE norm_tables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  norm_group_id   UUID NOT NULL REFERENCES norm_groups(id) ON DELETE CASCADE,
  construct_id    UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,

  -- Distribution parameters
  mean            NUMERIC(8,4) NOT NULL,
  standard_deviation NUMERIC(8,4) NOT NULL,
  sample_size     INT NOT NULL,

  -- Lookup data (JSON: percentile → score, stanine cutpoints, etc.)
  percentile_lookup JSONB,
  stanine_cutpoints NUMERIC(8,4)[],            -- 8 cutpoints → 9 stanines
  sten_cutpoints    NUMERIC(8,4)[],            -- 9 cutpoints → 10 stens

  -- Metadata
  score_type      TEXT NOT NULL DEFAULT 'pomp', -- what scale the mean/SD are in
  last_computed   TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ,

  CONSTRAINT norm_tables_unique UNIQUE (norm_group_id, construct_id),
  CONSTRAINT norm_tables_sd_positive CHECK (standard_deviation > 0),
  CONSTRAINT norm_tables_sample_positive CHECK (sample_size > 0)
);
-- ─────────────────────────────────────────────────────────────────────────────
-- 7. factor_analysis_results — CFA/EFA fit indices and loadings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE factor_analysis_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_run_id  UUID NOT NULL REFERENCES calibration_runs(id) ON DELETE CASCADE,
  analysis_type       TEXT NOT NULL,            -- 'efa' or 'cfa'
  estimation_method   TEXT,                     -- 'ml', 'wlsmv', 'paf'

  -- Fit indices
  cfi                 NUMERIC(6,4),
  tli                 NUMERIC(6,4),
  rmsea               NUMERIC(6,4),
  rmsea_ci_lower      NUMERIC(6,4),
  rmsea_ci_upper      NUMERIC(6,4),
  srmr                NUMERIC(6,4),
  chi_square          NUMERIC(12,4),
  chi_square_df       INT,
  chi_square_p        NUMERIC(6,4),

  -- Factor loadings (JSON: item_id → { factor: loading })
  loadings            JSONB,

  -- Validity evidence
  ave                 JSONB,                    -- Average Variance Extracted per construct
  htmt                JSONB,                    -- Heterotrait-Monotrait matrix
  construct_correlations JSONB,                 -- Inter-construct correlations

  -- Metadata
  sample_size         INT,
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT factor_analysis_results_type_check
    CHECK (analysis_type IN ('efa', 'cfa'))
);
-- ─────────────────────────────────────────────────────────────────────────────
-- 8. dif_results — Differential Item Functioning per item per group
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE dif_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id             UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  calibration_run_id  UUID NOT NULL REFERENCES calibration_runs(id) ON DELETE CASCADE,

  -- Group definition
  grouping_variable   TEXT NOT NULL,             -- e.g. 'gender', 'ethnicity'
  reference_group     TEXT NOT NULL,
  focal_group         TEXT NOT NULL,

  -- Method & results
  method              dif_method NOT NULL,
  effect_size         NUMERIC(8,4),              -- MH delta or similar
  p_value             NUMERIC(8,6),
  classification      dif_classification,        -- A, B, or C

  -- Metadata
  reference_n         INT,
  focal_n             INT,
  flagged             BOOLEAN NOT NULL DEFAULT false,
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_calibration_runs_status ON calibration_runs(status);
CREATE INDEX idx_calibration_runs_created ON calibration_runs(created_at DESC);
CREATE INDEX idx_item_statistics_item ON item_statistics(item_id);
CREATE INDEX idx_item_statistics_run ON item_statistics(calibration_run_id);
CREATE INDEX idx_item_statistics_flagged ON item_statistics(flagged) WHERE flagged = true;
CREATE INDEX idx_construct_reliability_construct ON construct_reliability(construct_id);
CREATE INDEX idx_construct_reliability_run ON construct_reliability(calibration_run_id);
CREATE INDEX idx_norm_groups_active ON norm_groups(is_active) WHERE is_active = true;
CREATE INDEX idx_norm_tables_group ON norm_tables(norm_group_id);
CREATE INDEX idx_norm_tables_construct ON norm_tables(construct_id);
CREATE INDEX idx_factor_analysis_results_run ON factor_analysis_results(calibration_run_id);
CREATE INDEX idx_dif_results_item ON dif_results(item_id);
CREATE INDEX idx_dif_results_run ON dif_results(calibration_run_id);
CREATE INDEX idx_dif_results_flagged ON dif_results(flagged) WHERE flagged = true;
-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Triggers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER set_calibration_runs_updated_at
  BEFORE UPDATE ON calibration_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_norm_groups_updated_at
  BEFORE UPDATE ON norm_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_norm_tables_updated_at
  BEFORE UPDATE ON norm_tables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Row-Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE calibration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE construct_reliability ENABLE ROW LEVEL SECURITY;
ALTER TABLE norm_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE norm_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE factor_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE dif_results ENABLE ROW LEVEL SECURITY;
-- All authenticated users can read; platform_admin can write

-- calibration_runs
CREATE POLICY calibration_runs_select ON calibration_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY calibration_runs_insert ON calibration_runs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY calibration_runs_update ON calibration_runs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY calibration_runs_delete ON calibration_runs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
-- item_statistics
CREATE POLICY item_statistics_select ON item_statistics FOR SELECT TO authenticated USING (true);
CREATE POLICY item_statistics_insert ON item_statistics FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY item_statistics_update ON item_statistics FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY item_statistics_delete ON item_statistics FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
-- construct_reliability
CREATE POLICY construct_reliability_select ON construct_reliability FOR SELECT TO authenticated USING (true);
CREATE POLICY construct_reliability_insert ON construct_reliability FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY construct_reliability_update ON construct_reliability FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY construct_reliability_delete ON construct_reliability FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
-- norm_groups
CREATE POLICY norm_groups_select ON norm_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY norm_groups_insert ON norm_groups FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY norm_groups_update ON norm_groups FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY norm_groups_delete ON norm_groups FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
-- norm_tables
CREATE POLICY norm_tables_select ON norm_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY norm_tables_insert ON norm_tables FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY norm_tables_update ON norm_tables FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY norm_tables_delete ON norm_tables FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
-- factor_analysis_results
CREATE POLICY factor_analysis_results_select ON factor_analysis_results FOR SELECT TO authenticated USING (true);
CREATE POLICY factor_analysis_results_insert ON factor_analysis_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY factor_analysis_results_delete ON factor_analysis_results FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
-- dif_results
CREATE POLICY dif_results_select ON dif_results FOR SELECT TO authenticated USING (true);
CREATE POLICY dif_results_insert ON dif_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
CREATE POLICY dif_results_delete ON dif_results FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'));
-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Seed a General Population norm group
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO norm_groups (id, name, description, is_active) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'General Population',
   'Baseline norm group encompassing all assessed candidates. Used as the default when more specific norms are not available.',
   true)
ON CONFLICT DO NOTHING;
COMMIT;
