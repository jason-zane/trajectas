-- =============================================================================
-- 20260525160000 — migrate report_templates.display_level = 'construct' to 'factor'
-- Phase 4 of taxonomy unification. Construct is no longer a customer-facing
-- displayLevel value; templates that referenced it now render at factor level
-- (semantically equivalent given that construct-mode assessments were wrapped
-- in 1:1 factors during Phase 3).
-- =============================================================================

UPDATE report_templates
SET display_level = 'factor'
WHERE display_level = 'construct';
