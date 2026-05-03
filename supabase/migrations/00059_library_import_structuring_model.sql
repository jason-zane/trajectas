-- =============================================================================
-- Migration 00059: Add library_import_structuring AI purpose + seed model config
-- =============================================================================

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'library_import_structuring';
-- Model-config seeding for this new purpose happens in a later migration after
-- the enum addition above has committed.;
