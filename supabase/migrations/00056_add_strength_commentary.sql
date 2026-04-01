-- =============================================================================
-- Migration 00056: Add strength_commentary to taxonomy entities
-- =============================================================================
-- Adds strength_commentary column to dimensions, factors, and constructs.
-- This field stores the narrative text shown when an entity is a participant's
-- top-scoring area (used by the Strengths Highlights report block).
-- The existing development_suggestion column serves as the development commentary.
-- =============================================================================

ALTER TABLE dimensions
ADD COLUMN IF NOT EXISTS strength_commentary TEXT;

ALTER TABLE factors
ADD COLUMN IF NOT EXISTS strength_commentary TEXT;

ALTER TABLE constructs
ADD COLUMN IF NOT EXISTS strength_commentary TEXT;
