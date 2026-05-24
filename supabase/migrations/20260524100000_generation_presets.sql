-- =============================================================================
-- Generation Presets — Playbook templates for the AI item generator
--
-- A preset bundles measurement mode + audience + use-context + rating scale
-- defaults with a writing rubric and exemplar items. At run time the rubric
-- and exemplars are injected into the generation and critique prompts so that
-- the LLM is steered toward the kind of item the playbook describes.
--
-- Admin-only. RLS predicate is platform_admin (matches requireAdminScope on
-- the existing generation actions).
--
-- Spec: docs/superpowers/specs/2026-05-24-ai-item-generator-refactor-design.md
-- =============================================================================

CREATE TABLE IF NOT EXISTS generation_presets (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                              TEXT NOT NULL,
  description                       TEXT,

  measurement_mode                  TEXT NOT NULL
    CHECK (measurement_mode IN ('behavioural', 'trait', 'capability', 'situational', 'open')),
  measurement_mode_description      TEXT,

  audience                          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { level?: 'entry'|'mid'|'senior'|'executive'|'mixed'|'open', description?: string }

  use_context                       TEXT NOT NULL
    CHECK (use_context IN ('development', 'selection', 'research', 'open')),
  use_context_description           TEXT,

  response_format_id                UUID REFERENCES response_formats(id) ON DELETE RESTRICT,
  response_format_rationale         TEXT,

  rubric                            TEXT,
  exemplars                         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array<{ stem: string, verdict: 'good'|'bad', reason: string }>

  critique_emphasis                 TEXT,
  sd_tolerance                      TEXT
    CHECK (sd_tolerance IS NULL OR sd_tolerance IN ('low', 'moderate', 'high')),
  difficulty_mix                    JSONB,
  -- { easy?: number, moderate?: number, hard?: number }  (ratios, optional)
  critique_strictness               TEXT NOT NULL DEFAULT 'standard'
    CHECK (critique_strictness IN ('lenient', 'standard', 'strict')),

  pipeline_defaults                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { enableItemCritique?: bool, enableLeakageGuard?: bool,
  --   enableDifficultyTargeting?: bool, enableSyntheticValidation?: bool }

  recommended_target_per_construct  INTEGER NOT NULL DEFAULT 60
    CHECK (recommended_target_per_construct BETWEEN 20 AND 200),

  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                        TIMESTAMPTZ,
  created_by                        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT generation_presets_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE generation_presets IS
  'Playbook templates for the AI item generator. Carries config defaults + a writing rubric + exemplars that are injected into prompts at run time. Admin-only.';

CREATE INDEX IF NOT EXISTS generation_presets_active_idx
  ON generation_presets (deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS generation_presets_mode_context_idx
  ON generation_presets (measurement_mode, use_context)
  WHERE deleted_at IS NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION generation_presets_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generation_presets_updated_at ON generation_presets;
CREATE TRIGGER generation_presets_updated_at
  BEFORE UPDATE ON generation_presets
  FOR EACH ROW
  EXECUTE FUNCTION generation_presets_set_updated_at();

-- =============================================================================
-- RLS — platform admins only.
-- =============================================================================

ALTER TABLE generation_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY generation_presets_admin_all ON generation_presets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'platform_admin'
    )
  );
