-- ==========================================================================
-- 20260703120000_aggregate_only_enforcement.sql
-- Enforce campaigns.confidentiality_mode = 'aggregate_only' at the RLS layer.
--
-- Aggregate-only campaigns promise participants that the client receives
-- group-level patterns only — never individual answers. This migration adds
-- that exclusion to the client/partner arms of the SELECT policies on the
-- three individual-result tables. Platform admins retain access for support
-- and scoring QA (the promise is about what the *client* receives; the
-- platform operates the pipeline and its access is audit-logged).
-- Participants keep access to their own rows.
--
-- App-layer enforcement lives in src/lib/reports/confidentiality.ts and the
-- server actions that consume it; this migration makes direct PostgREST
-- access follow the same rules.
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- Helper: is this campaign aggregate-only?
-- SECURITY DEFINER so policy evaluation doesn't depend on the caller's
-- campaigns visibility (same pattern as is_platform_admin()).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION campaign_is_aggregate_only(p_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM campaigns
        WHERE id = p_campaign_id
          AND confidentiality_mode = 'aggregate_only'
    );
$$;

-- Only RLS evaluation (as authenticated) needs to call this. It leaks nothing
-- beyond a boolean campaign setting, but there's no reason to expose it as an
-- anonymous RPC.
REVOKE EXECUTE ON FUNCTION campaign_is_aggregate_only(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION campaign_is_aggregate_only(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- report_snapshots: exclude aggregate-only campaigns from the consultant
-- (partner) and hr_manager (client) arms. Participant own-report and
-- platform-admin arms are unchanged.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS report_snapshots_select_authenticated_merged ON report_snapshots;
CREATE POLICY report_snapshots_select_authenticated_merged ON report_snapshots
FOR SELECT TO authenticated
USING (
    (
        audience_type = 'consultant'::report_audience_type
        AND released_at IS NOT NULL
        AND campaign_id IN (
            SELECT c.id FROM campaigns c
            WHERE c.partner_id = ANY (auth_user_partner_ids())
        )
        AND NOT campaign_is_aggregate_only(campaign_id)
    )
    OR (
        audience_type = 'hr_manager'::report_audience_type
        AND released_at IS NOT NULL
        AND campaign_id IN (
            SELECT c.id FROM campaigns c
            WHERE c.client_id = ANY (auth_user_client_ids())
        )
        AND NOT campaign_is_aggregate_only(campaign_id)
    )
    OR (
        audience_type = 'participant'::report_audience_type
        AND released_at IS NOT NULL
        AND participant_session_id IN (
            SELECT ps.id FROM participant_sessions ps
            WHERE ps.participant_profile_id = (SELECT auth.uid())
        )
    )
    OR is_platform_admin()
);

-- ---------------------------------------------------------------------------
-- participant_scores: the client-membership arm loses access when the
-- session belongs to an aggregate-only campaign. Own-session and
-- platform-admin arms unchanged.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS participant_scores_select_authenticated ON participant_scores;
CREATE POLICY participant_scores_select_authenticated ON participant_scores
FOR SELECT TO authenticated
USING (
    is_platform_admin()
    OR EXISTS (
        SELECT 1 FROM participant_sessions ps
        WHERE ps.id = participant_scores.session_id
          AND (
            (
                ps.client_id IS NOT NULL
                AND ps.client_id = ANY (auth_user_client_ids())
                AND (ps.campaign_id IS NULL OR NOT campaign_is_aggregate_only(ps.campaign_id))
            )
            OR ps.participant_profile_id = (SELECT auth.uid())
          )
    )
);

-- ---------------------------------------------------------------------------
-- participant_responses: same shape as participant_scores.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS participant_responses_select_authenticated ON participant_responses;
CREATE POLICY participant_responses_select_authenticated ON participant_responses
FOR SELECT TO authenticated
USING (
    is_platform_admin()
    OR EXISTS (
        SELECT 1 FROM participant_sessions ps
        WHERE ps.id = participant_responses.session_id
          AND (
            (
                ps.client_id IS NOT NULL
                AND ps.client_id = ANY (auth_user_client_ids())
                AND (ps.campaign_id IS NULL OR NOT campaign_is_aggregate_only(ps.campaign_id))
            )
            OR ps.participant_profile_id = (SELECT auth.uid())
          )
    )
);
