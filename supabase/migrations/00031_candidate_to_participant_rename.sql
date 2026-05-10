BEGIN;
-- ==========================================================================
-- 00031_candidate_to_participant_rename.sql
-- Global rename: candidate → participant across all tables, enums, columns,
-- indexes, constraints, triggers, policies, and comments.
-- ==========================================================================

-- -------------------------------------------------------------------------
-- 1. Rename enum: campaign_candidate_status → campaign_participant_status
-- -------------------------------------------------------------------------
ALTER TYPE campaign_candidate_status RENAME TO campaign_participant_status;
-- -------------------------------------------------------------------------
-- 2. Rename tables
-- -------------------------------------------------------------------------
ALTER TABLE campaign_candidates RENAME TO campaign_participants;
ALTER TABLE candidate_sessions  RENAME TO participant_sessions;
ALTER TABLE candidate_responses RENAME TO participant_responses;
ALTER TABLE candidate_scores    RENAME TO participant_scores;
-- -------------------------------------------------------------------------
-- 3. Rename FK columns
-- -------------------------------------------------------------------------
-- participant_sessions: campaign_candidate_id → campaign_participant_id
ALTER TABLE participant_sessions RENAME COLUMN campaign_candidate_id TO campaign_participant_id;
-- participant_sessions: candidate_profile_id → participant_profile_id
ALTER TABLE participant_sessions RENAME COLUMN candidate_profile_id TO participant_profile_id;
-- -------------------------------------------------------------------------
-- 4. Rename constraints on campaign_participants
-- -------------------------------------------------------------------------
ALTER TABLE campaign_participants
  RENAME CONSTRAINT campaign_candidates_email_per_campaign TO campaign_participants_email_per_campaign;
ALTER TABLE campaign_participants
  RENAME CONSTRAINT campaign_candidates_token_unique TO campaign_participants_token_unique;
ALTER TABLE campaign_participants
  RENAME CONSTRAINT campaign_candidates_dates_valid TO campaign_participants_dates_valid;
-- -------------------------------------------------------------------------
-- 5. Rename constraints on participant_sessions
-- -------------------------------------------------------------------------
ALTER TABLE participant_sessions
  RENAME CONSTRAINT candidate_sessions_dates_valid TO participant_sessions_dates_valid;
-- -------------------------------------------------------------------------
-- 6. Rename constraints on participant_responses
-- -------------------------------------------------------------------------
ALTER TABLE participant_responses
  RENAME CONSTRAINT candidate_responses_unique TO participant_responses_unique;
ALTER TABLE participant_responses
  RENAME CONSTRAINT candidate_responses_time_positive TO participant_responses_time_positive;
-- -------------------------------------------------------------------------
-- 7. Rename constraints on participant_scores
-- -------------------------------------------------------------------------
ALTER TABLE participant_scores
  RENAME CONSTRAINT candidate_scores_unique TO participant_scores_unique;
ALTER TABLE participant_scores
  RENAME CONSTRAINT candidate_scores_percentile_range TO participant_scores_percentile_range;
ALTER TABLE participant_scores
  RENAME CONSTRAINT candidate_scores_ci_valid TO participant_scores_ci_valid;
-- -------------------------------------------------------------------------
-- 8. Rename indexes — campaign_participants (was campaign_candidates)
-- -------------------------------------------------------------------------
ALTER INDEX idx_campaign_candidates_campaign RENAME TO idx_campaign_participants_campaign;
ALTER INDEX idx_campaign_candidates_token    RENAME TO idx_campaign_participants_token;
ALTER INDEX idx_campaign_candidates_email    RENAME TO idx_campaign_participants_email;
ALTER INDEX idx_campaign_candidates_status   RENAME TO idx_campaign_participants_status;
-- -------------------------------------------------------------------------
-- 9. Rename indexes — participant_sessions (was candidate_sessions)
-- -------------------------------------------------------------------------
ALTER INDEX idx_candidate_sessions_assessment         RENAME TO idx_participant_sessions_assessment;
ALTER INDEX idx_candidate_sessions_candidate           RENAME TO idx_participant_sessions_participant;
ALTER INDEX idx_candidate_sessions_org                 RENAME TO idx_participant_sessions_org;
ALTER INDEX idx_candidate_sessions_status              RENAME TO idx_participant_sessions_status;
ALTER INDEX idx_candidate_sessions_campaign            RENAME TO idx_participant_sessions_campaign;
ALTER INDEX idx_candidate_sessions_campaign_candidate  RENAME TO idx_participant_sessions_campaign_participant;
-- -------------------------------------------------------------------------
-- 10. Rename indexes — participant_responses (was candidate_responses)
-- -------------------------------------------------------------------------
ALTER INDEX idx_candidate_responses_session RENAME TO idx_participant_responses_session;
ALTER INDEX idx_candidate_responses_item    RENAME TO idx_participant_responses_item;
ALTER INDEX idx_candidate_responses_section RENAME TO idx_participant_responses_section;
-- -------------------------------------------------------------------------
-- 11. Rename indexes — participant_scores (was candidate_scores)
-- -------------------------------------------------------------------------
ALTER INDEX idx_candidate_scores_session RENAME TO idx_participant_scores_session;
ALTER INDEX idx_candidate_scores_factor  RENAME TO idx_participant_scores_factor;
-- -------------------------------------------------------------------------
-- 12. Rename trigger on campaign_participants
-- -------------------------------------------------------------------------
ALTER TRIGGER set_campaign_candidates_updated_at ON campaign_participants
  RENAME TO set_campaign_participants_updated_at;
-- -------------------------------------------------------------------------
-- 13. Drop & recreate RLS policies — campaign_participants
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS campaign_candidates_all_platform_admin ON campaign_participants;
DROP POLICY IF EXISTS campaign_candidates_select ON campaign_participants;
CREATE POLICY campaign_participants_all_platform_admin ON campaign_participants
    FOR ALL TO authenticated USING (is_platform_admin());
CREATE POLICY campaign_participants_select ON campaign_participants
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_id
            AND (
                is_platform_admin()
                OR (c.organization_id IS NOT NULL AND c.organization_id = auth_user_organization_id())
            )
        )
    );
-- -------------------------------------------------------------------------
-- 14. Drop & recreate RLS policies — participant_sessions
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS candidate_sessions_select ON participant_sessions;
DROP POLICY IF EXISTS candidate_sessions_all_platform_admin ON participant_sessions;
DROP POLICY IF EXISTS candidate_sessions_manage_org ON participant_sessions;
DROP POLICY IF EXISTS candidate_sessions_update_own ON participant_sessions;
CREATE POLICY participant_sessions_select ON participant_sessions
    FOR SELECT TO authenticated USING (
        is_platform_admin()
        OR (organization_id IS NOT NULL AND organization_id = auth_user_organization_id())
        OR participant_profile_id = auth.uid()
    );
CREATE POLICY participant_sessions_all_platform_admin ON participant_sessions
    FOR ALL TO authenticated USING (is_platform_admin());
CREATE POLICY participant_sessions_manage_org ON participant_sessions
    FOR INSERT TO authenticated WITH CHECK (
        is_platform_admin()
        OR (organization_id IS NOT NULL AND organization_id = auth_user_organization_id())
    );
CREATE POLICY participant_sessions_update_own ON participant_sessions
    FOR UPDATE TO authenticated USING (participant_profile_id = auth.uid());
-- -------------------------------------------------------------------------
-- 15. Drop & recreate RLS policies — participant_responses
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS candidate_responses_select ON participant_responses;
DROP POLICY IF EXISTS candidate_responses_all_platform_admin ON participant_responses;
DROP POLICY IF EXISTS candidate_responses_insert_own ON participant_responses;
CREATE POLICY participant_responses_select ON participant_responses
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM participant_sessions ps
            WHERE ps.id = session_id
            AND (
                is_platform_admin()
                OR (ps.organization_id IS NOT NULL AND ps.organization_id = auth_user_organization_id())
                OR ps.participant_profile_id = auth.uid()
            )
        )
    );
CREATE POLICY participant_responses_all_platform_admin ON participant_responses
    FOR ALL TO authenticated USING (is_platform_admin());
CREATE POLICY participant_responses_insert_own ON participant_responses
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM participant_sessions ps
            WHERE ps.id = session_id
            AND ps.participant_profile_id = auth.uid()
        )
    );
-- -------------------------------------------------------------------------
-- 16. Drop & recreate RLS policies — participant_scores
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS candidate_scores_select ON participant_scores;
DROP POLICY IF EXISTS candidate_scores_all_platform_admin ON participant_scores;
CREATE POLICY participant_scores_select ON participant_scores
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM participant_sessions ps
            WHERE ps.id = session_id
            AND (
                is_platform_admin()
                OR (ps.organization_id IS NOT NULL AND ps.organization_id = auth_user_organization_id())
                OR ps.participant_profile_id = auth.uid()
            )
        )
    );
CREATE POLICY participant_scores_all_platform_admin ON participant_scores
    FOR ALL TO authenticated USING (is_platform_admin());
-- -------------------------------------------------------------------------
-- 17. Update table comments
-- -------------------------------------------------------------------------
COMMENT ON TABLE campaign_participants IS
    'People invited to take assessments in a campaign. Token-based auth, no login required.';
COMMENT ON TABLE participant_sessions IS
    'A participant''s attempt at an assessment. Tracks lifecycle from invitation through completion.';
COMMENT ON TABLE participant_responses IS
    'Individual item responses captured during a participant session. Stores both numeric value and rich data.';
COMMENT ON TABLE participant_scores IS
    'Computed scores per factor for a participant session, including confidence intervals and percentiles.';
COMMIT;
