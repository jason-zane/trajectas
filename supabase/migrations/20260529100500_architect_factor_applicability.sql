-- =============================================================================
-- Architect: factor applicability metadata
--
-- The Architect matcher filters the factor pool by the brief's decision
-- (outcome) and seniority (level) before ranking. These tag arrays are the
-- eligibility signal.
--
--   applicable_outcomes  — selection | development | team_composition
--                          (coarse on purpose; see the build-plan spec)
--   applicable_levels    — ic | first_line_manager | mid_manager |
--                          senior_leader | executive
--   applicable_functions — free tags (sales, engineering, ops, ...)
--
-- Values are validated in the app layer rather than via CHECK constraints so
-- the vocabulary can evolve without a migration. An empty array means
-- "applies to all" — the matcher treats unset tags as no filter, so the tool
-- works before any backfill lands.
-- =============================================================================

ALTER TABLE factors
  ADD COLUMN IF NOT EXISTS applicable_outcomes  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicable_levels    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicable_functions TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN factors.applicable_outcomes IS
  'Architect eligibility: which decision types this factor suits (selection|development|team_composition). Empty = applies to all.';
COMMENT ON COLUMN factors.applicable_levels IS
  'Architect eligibility: seniority levels this factor suits (ic|first_line_manager|mid_manager|senior_leader|executive). Empty = applies to all.';
COMMENT ON COLUMN factors.applicable_functions IS
  'Architect eligibility: free-tag job functions this factor suits. Empty = applies to all.';
