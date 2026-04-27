BEGIN;
-- =========================================================================
-- Complete the competencies → factors naming refactor
-- Migration 00008 renamed competencies/traits tables but missed:
--   - assessment_competencies table + column
--   - diagnostic_competency_hints table + column (if it exists)
--   - candidate_scores.competency_id
--   - matching_results.competency_id
--   - item_selection_rules columns
-- =========================================================================

-- Ensure item_count column exists on assessment_competencies before rename
ALTER TABLE assessment_competencies
  ADD COLUMN IF NOT EXISTS item_count INT;
-- 1. Rename assessment_competencies table + column
ALTER TABLE assessment_competencies RENAME TO assessment_factors;
ALTER TABLE assessment_factors RENAME COLUMN competency_id TO factor_id;
-- 2. Rename columns in other tables
ALTER TABLE candidate_scores RENAME COLUMN competency_id TO factor_id;
ALTER TABLE matching_results RENAME COLUMN competency_id TO factor_id;
-- 3. Rename item_selection_rules columns
ALTER TABLE item_selection_rules RENAME COLUMN total_competency_min TO total_factor_min;
ALTER TABLE item_selection_rules RENAME COLUMN total_competency_max TO total_factor_max;
ALTER TABLE item_selection_rules RENAME COLUMN items_per_competency TO items_per_factor;
-- 4. Rename constraints on assessment_factors
ALTER TABLE assessment_factors RENAME CONSTRAINT assessment_competencies_unique TO assessment_factors_unique;
ALTER TABLE assessment_factors RENAME CONSTRAINT assessment_competencies_weight_positive TO assessment_factors_weight_positive;
ALTER TABLE assessment_factors RENAME CONSTRAINT assessment_competencies_items_valid TO assessment_factors_items_valid;
-- 5. Rename indexes
ALTER INDEX idx_assessment_competencies_assessment RENAME TO idx_assessment_factors_assessment;
ALTER INDEX idx_assessment_competencies_competency RENAME TO idx_assessment_factors_factor;
ALTER INDEX idx_matching_results_competency RENAME TO idx_matching_results_factor;
ALTER INDEX idx_candidate_scores_competency RENAME TO idx_candidate_scores_factor;
-- 6. Update RLS policies on assessment_factors
DROP POLICY IF EXISTS assessment_competencies_select ON assessment_factors;
DROP POLICY IF EXISTS assessment_competencies_all_platform_admin ON assessment_factors;
CREATE POLICY assessment_factors_select ON assessment_factors
    FOR SELECT USING (true);
CREATE POLICY assessment_factors_all_platform_admin ON assessment_factors
    FOR ALL USING (is_platform_admin());
-- 7. diagnostic_competency_hints — conditionally rename if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'diagnostic_competency_hints') THEN
    ALTER TABLE diagnostic_competency_hints RENAME TO diagnostic_factor_hints;
    ALTER TABLE diagnostic_factor_hints RENAME COLUMN competency_id TO factor_id;

    ALTER TABLE diagnostic_factor_hints RENAME CONSTRAINT diagnostic_competency_hints_unique TO diagnostic_factor_hints_unique;
    ALTER TABLE diagnostic_factor_hints RENAME CONSTRAINT diagnostic_competency_hints_weight_positive TO diagnostic_factor_hints_weight_positive;

    ALTER INDEX idx_diag_comp_hints_dimension RENAME TO idx_diag_factor_hints_dimension;
    ALTER INDEX idx_diag_comp_hints_competency RENAME TO idx_diag_factor_hints_factor;

    DROP POLICY IF EXISTS diagnostic_competency_hints_select ON diagnostic_factor_hints;
    DROP POLICY IF EXISTS diagnostic_competency_hints_insert ON diagnostic_factor_hints;
    DROP POLICY IF EXISTS diagnostic_competency_hints_update ON diagnostic_factor_hints;
    DROP POLICY IF EXISTS diagnostic_competency_hints_delete ON diagnostic_factor_hints;

    CREATE POLICY diagnostic_factor_hints_select ON diagnostic_factor_hints
        FOR SELECT USING (true);
    CREATE POLICY diagnostic_factor_hints_insert ON diagnostic_factor_hints
        FOR INSERT WITH CHECK (is_platform_admin() OR is_partner_admin());
    CREATE POLICY diagnostic_factor_hints_update ON diagnostic_factor_hints
        FOR UPDATE USING (is_platform_admin() OR is_partner_admin());
    CREATE POLICY diagnostic_factor_hints_delete ON diagnostic_factor_hints
        FOR DELETE USING (is_platform_admin());
  END IF;
END $$;
-- 8. Update table comments
COMMENT ON TABLE assessment_factors IS
    'Links factors to an assessment with ordering, weighting, and item-count constraints.';
COMMENT ON TABLE matching_results IS
    'Individual factor recommendations produced by an AI matching run, ranked by relevance.';
COMMENT ON TABLE candidate_scores IS
    'Computed scores per factor for a candidate session, including confidence intervals and percentiles.';
COMMIT;
