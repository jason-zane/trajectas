-- =============================================================================
-- Factor readiness — the two-tier quality gate (Phase 1)
--
-- Two trust levels (see design spec 2026-06-02):
--   assessment_ready — usable in a consultant-curated assessment (well-defined,
--                      categorised, measurable).
--   match_ready      — usable by the Architect / AI matching, where there's no
--                      human in the loop; adds applicability tags, overuse
--                      signature, contrasts, lineage, + human sign-off.
--                      (Distinctness check is added in Phase 2.)
--
-- Plus the richer metadata fields the match-ready bar requires.
-- =============================================================================

CREATE TYPE factor_readiness AS ENUM ('draft', 'assessment_ready', 'match_ready');

ALTER TABLE factors
  ADD COLUMN IF NOT EXISTS readiness            factor_readiness NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS overuse_signature    TEXT,
  ADD COLUMN IF NOT EXISTS contrasts_with       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS theoretical_lineage  TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by          UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at          TIMESTAMPTZ;

COMMENT ON COLUMN factors.readiness IS
  'Two-tier quality gate: draft < assessment_ready < match_ready. match_ready governs Architect eligibility.';
COMMENT ON COLUMN factors.overuse_signature IS
  'What this looks like when overused / the derailer (negative pole). Required for match_ready.';
COMMENT ON COLUMN factors.contrasts_with IS
  'Factor slugs this is meant to be distinct from (nomological net). Required for match_ready.';
COMMENT ON COLUMN factors.theoretical_lineage IS
  'Where the construct comes from (framework / origin). Required for match_ready.';

-- The existing curated library is categorised, defined, and measurable → it
-- already clears the assessment-ready bar. It lacks the new match-ready fields,
-- so it stays below match_ready until those are backfilled (next step). The
-- Architect continues to run on is_match_eligible during the transition.
UPDATE factors
  SET readiness = 'assessment_ready'
  WHERE deleted_at IS NULL
    AND is_active
    AND primary_category_id IS NOT NULL
    AND coalesce(definition, '') <> ''
    AND readiness = 'draft';
