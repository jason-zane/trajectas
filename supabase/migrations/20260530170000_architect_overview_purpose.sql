-- =============================================================================
-- Architect: add the `architect_overview` AI purpose
--
-- Generates a short plain-English summary of what a chosen competency set will
-- (and won't) reveal for a role — shown on the Architect's final review step.
--
-- Prompt + model-config seeding happens in a LATER migration because PostgreSQL
-- can't reference a newly added enum value in the same transaction.
-- =============================================================================

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'architect_overview';
