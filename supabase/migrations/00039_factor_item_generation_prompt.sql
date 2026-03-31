-- =============================================================================
-- Migration 00039: Add factor_item_generation enum value
--
-- The new enum value cannot be USED in the same transaction it was added.
-- The seed INSERT lives in migration 00040 (separate transaction).
-- =============================================================================

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'factor_item_generation';
