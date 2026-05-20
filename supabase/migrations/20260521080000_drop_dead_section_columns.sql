-- Drop dead columns from assessment_sections.
--
-- Both columns were configurable in the legacy builder UI but never consulted
-- by the assessment runner:
--   * items_per_page  — runner is hardcoded one-per-page in
--                       src/components/assess/section-wrapper.tsx (it
--                       increments localItemIndex one at a time regardless
--                       of this field).
--   * allow_back_nav  — the runner's canGoBack flag is purely positional
--                       (localItemIndex > 0 || sectionIndex > 0); it does
--                       not read this column.
--
-- Removed from the UI and code paths in PRs #123 and #130. This migration
-- drops the underlying storage so the schema matches reality.

ALTER TABLE assessment_sections
  DROP CONSTRAINT IF EXISTS assessment_sections_items_per_page_positive;

ALTER TABLE assessment_sections
  DROP COLUMN IF EXISTS items_per_page,
  DROP COLUMN IF EXISTS allow_back_nav;
