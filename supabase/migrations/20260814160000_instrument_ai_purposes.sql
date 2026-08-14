-- =============================================================================
-- Add six new AI purposes for the instrument builder engine:
-- - instrument_structure: proposes full construct set from a brief
-- - instrument_blueprint: turns a construct into a facet × intensity grid
-- - instrument_items: writes candidate items for a single blueprint cell
-- - instrument_critique: second-pass review of generated items
-- - instrument_fairness: screens items for reading level and bias
-- - instrument_congruence: blind rater assigning items to constructs
--
-- Prompts + model configs seeded in the next migration (enum-commit rule).
-- =============================================================================

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'instrument_structure';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'instrument_blueprint';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'instrument_items';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'instrument_critique';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'instrument_fairness';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'instrument_congruence';
