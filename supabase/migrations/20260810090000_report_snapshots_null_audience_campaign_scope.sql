-- Restore client/partner dashboard access to report snapshots created after
-- the April 2026 report simplification.
--
-- History: 00042_report_generation_system created one snapshot per
-- (session, audience) and keyed SELECT access on audience_type.
-- 20260414060826_report_simplification moved to one snapshot per
-- (session, template), made audience_type nullable, and app code stopped
-- writing it entirely. The merged SELECT policy (latest:
-- 20260703120000_aggregate_only_enforcement) still requires an explicit
-- audience, so every post-simplification snapshot (audience_type IS NULL)
-- is invisible to client and partner members — generation succeeds but the
-- people the report is for cannot read it.
--
-- Fix: audience_type IS NULL now means "campaign-scoped default" — readable
-- by the campaign's client members (hr_manager arm) and partner members
-- (consultant arm), with the released_at and aggregate-only guards
-- unchanged. Rows with an explicit audience keep their original, stricter
-- semantics. The participant arm stays explicit-only: participant report
-- reads go through the service role after server-side access-token
-- validation and never rely on this policy.

DROP POLICY IF EXISTS report_snapshots_select_authenticated_merged ON report_snapshots;
CREATE POLICY report_snapshots_select_authenticated_merged ON report_snapshots
FOR SELECT TO authenticated
USING (
    (
        (audience_type = 'consultant'::report_audience_type OR audience_type IS NULL)
        AND released_at IS NOT NULL
        AND campaign_id IN (
            SELECT c.id FROM campaigns c
            WHERE c.partner_id = ANY (auth_user_partner_ids())
        )
        AND NOT campaign_is_aggregate_only(campaign_id)
    )
    OR (
        (audience_type = 'hr_manager'::report_audience_type OR audience_type IS NULL)
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

COMMENT ON COLUMN report_snapshots.audience_type IS
  'NULL = campaign-scoped default (readable by the campaign''s client and partner members once released). Explicit values retain the original per-audience semantics from 00042.';
