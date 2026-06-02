-- =============================================================================
-- AI field assist — draft a single library metadata field for a factor
-- (overuse signature, theoretical lineage, contrasts-with) in the authoring UI.
-- Prompt + model config seeded in the next migration (enum-commit rule).
-- =============================================================================

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'library_field_assist';
