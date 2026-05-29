-- =============================================================================
-- Architect: add the `brief_extraction` AI purpose
--
-- The Assessment Architect extracts a structured "brief" from a pasted /
-- uploaded position description before matching it against the factor library.
-- That extraction is its own AI task, so it needs its own prompt + model
-- config purpose.
--
-- Seeding of the prompt + model-config rows happens in a LATER migration
-- (20260529101000) because PostgreSQL does not allow a newly added enum value
-- to be referenced in the same transaction that adds it.
-- =============================================================================

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'brief_extraction';
