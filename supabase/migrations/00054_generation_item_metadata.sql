-- =============================================================================
-- Migration 00054: Add psychometric metadata columns to generated_items
--
-- Adds difficulty_tier, sd_risk, and facet columns for richer AI-generated
-- item metadata produced by upgraded prompts.
-- =============================================================================

ALTER TABLE generated_items
  ADD COLUMN IF NOT EXISTS difficulty_tier TEXT CHECK (
    difficulty_tier IS NULL OR difficulty_tier IN (
      'easy', 'moderate', 'hard',
      'foundation', 'applied', 'demanding'
    )
  ),
  ADD COLUMN IF NOT EXISTS sd_risk TEXT CHECK (
    sd_risk IS NULL OR sd_risk IN ('low', 'moderate', 'high')
  ),
  ADD COLUMN IF NOT EXISTS facet TEXT;
