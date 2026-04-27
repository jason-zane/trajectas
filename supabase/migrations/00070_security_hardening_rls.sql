BEGIN;
-- ============================================================================
-- 00070_security_hardening_rls.sql
--
-- Repairs tenant-scoped helper functions and SELECT policies so authenticated
-- reads follow the same multi-membership model as the application layer.
-- ============================================================================

CREATE OR REPLACE FUNCTION auth_user_partner_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH membership_partner_ids AS (
    SELECT pm.partner_id
    FROM partner_memberships pm
    WHERE pm.profile_id = auth.uid()
      AND pm.revoked_at IS NULL
  ),
  legacy_partner_ids AS (
    SELECT p.partner_id
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.partner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM partner_memberships pm
        WHERE pm.profile_id = auth.uid()
      )
  )
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT partner_id
      FROM (
        SELECT partner_id FROM membership_partner_ids
        UNION
        SELECT partner_id FROM legacy_partner_ids
      ) partner_ids
    ),
    ARRAY[]::UUID[]
  );
$$;
COMMENT ON FUNCTION auth_user_partner_ids() IS
  'Returns all active partner IDs the current authenticated user can access.';
CREATE OR REPLACE FUNCTION auth_user_partner_admin_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH membership_partner_admin_ids AS (
    SELECT pm.partner_id
    FROM partner_memberships pm
    WHERE pm.profile_id = auth.uid()
      AND pm.role = 'admin'
      AND pm.revoked_at IS NULL
  ),
  legacy_partner_admin_ids AS (
    SELECT p.partner_id
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.partner_id IS NOT NULL
      AND p.role = 'partner_admin'
      AND NOT EXISTS (
        SELECT 1
        FROM partner_memberships pm
        WHERE pm.profile_id = auth.uid()
      )
  )
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT partner_id
      FROM (
        SELECT partner_id FROM membership_partner_admin_ids
        UNION
        SELECT partner_id FROM legacy_partner_admin_ids
      ) partner_ids
    ),
    ARRAY[]::UUID[]
  );
$$;
COMMENT ON FUNCTION auth_user_partner_admin_ids() IS
  'Returns all active partner IDs where the current authenticated user is an admin.';
CREATE OR REPLACE FUNCTION auth_user_client_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH membership_client_ids AS (
    SELECT cm.client_id
    FROM client_memberships cm
    WHERE cm.profile_id = auth.uid()
      AND cm.revoked_at IS NULL
  ),
  partner_client_ids AS (
    SELECT c.id
    FROM clients c
    WHERE c.partner_id = ANY(auth_user_partner_ids())
      AND c.deleted_at IS NULL
  ),
  legacy_client_ids AS (
    SELECT p.client_id
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.client_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM client_memberships cm
        WHERE cm.profile_id = auth.uid()
      )
  )
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT client_id
      FROM (
        SELECT client_id FROM membership_client_ids
        UNION
        SELECT id AS client_id FROM partner_client_ids
        UNION
        SELECT client_id FROM legacy_client_ids
      ) client_ids
    ),
    ARRAY[]::UUID[]
  );
$$;
COMMENT ON FUNCTION auth_user_client_ids() IS
  'Returns all active client IDs the current authenticated user can access, including partner-owned clients.';
CREATE OR REPLACE FUNCTION auth_user_client_admin_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH membership_client_admin_ids AS (
    SELECT cm.client_id
    FROM client_memberships cm
    WHERE cm.profile_id = auth.uid()
      AND cm.role = 'admin'
      AND cm.revoked_at IS NULL
  ),
  legacy_client_admin_ids AS (
    SELECT p.client_id
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.client_id IS NOT NULL
      AND p.role = 'org_admin'
      AND NOT EXISTS (
        SELECT 1
        FROM client_memberships cm
        WHERE cm.profile_id = auth.uid()
      )
  )
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT client_id
      FROM (
        SELECT client_id FROM membership_client_admin_ids
        UNION
        SELECT client_id FROM legacy_client_admin_ids
      ) client_ids
    ),
    ARRAY[]::UUID[]
  );
$$;
COMMENT ON FUNCTION auth_user_client_admin_ids() IS
  'Returns all active client IDs where the current authenticated user is an admin.';
CREATE OR REPLACE FUNCTION auth_user_partner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth_user_partner_ids())[1];
$$;
CREATE OR REPLACE FUNCTION auth_user_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth_user_client_ids())[1];
$$;
COMMENT ON FUNCTION auth_user_client_id() IS
  'Returns the first accessible client ID for the currently authenticated user.';
CREATE OR REPLACE FUNCTION is_partner_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_length(auth_user_partner_admin_ids(), 1), 0) > 0;
$$;
DROP POLICY IF EXISTS partners_select_own ON partners;
CREATE POLICY partners_select_own ON partners
  FOR SELECT TO authenticated
  USING (id = ANY(auth_user_partner_ids()));
DROP POLICY IF EXISTS partner_memberships_select ON partner_memberships;
CREATE POLICY partner_memberships_select ON partner_memberships
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR profile_id = auth.uid()
    OR partner_id = ANY(auth_user_partner_admin_ids())
  );
DROP POLICY IF EXISTS client_memberships_select ON client_memberships;
CREATE POLICY client_memberships_select ON client_memberships
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR profile_id = auth.uid()
    OR client_id = ANY(auth_user_client_admin_ids())
  );
DROP POLICY IF EXISTS user_invites_select ON user_invites;
CREATE POLICY user_invites_select ON user_invites
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR (tenant_type = 'partner' AND tenant_id = ANY(auth_user_partner_admin_ids()))
    OR (tenant_type = 'client' AND tenant_id = ANY(auth_user_client_admin_ids()))
  );
DROP POLICY IF EXISTS clients_select_partner ON clients;
CREATE POLICY clients_select_partner ON clients
  FOR SELECT TO authenticated
  USING (
    partner_id IS NOT NULL
    AND partner_id = ANY(auth_user_partner_ids())
  );
DROP POLICY IF EXISTS clients_select_own ON clients;
CREATE POLICY clients_select_own ON clients
  FOR SELECT TO authenticated
  USING (id = ANY(auth_user_client_ids()));
DROP POLICY IF EXISTS clients_insert_partner_admin ON clients;
CREATE POLICY clients_insert_partner_admin ON clients
  FOR INSERT TO authenticated
  WITH CHECK (
    partner_id IS NOT NULL
    AND partner_id = ANY(auth_user_partner_admin_ids())
  );
DROP POLICY IF EXISTS clients_update_partner_admin ON clients;
CREATE POLICY clients_update_partner_admin ON clients
  FOR UPDATE TO authenticated
  USING (
    partner_id IS NOT NULL
    AND partner_id = ANY(auth_user_partner_admin_ids())
  );
DROP POLICY IF EXISTS profiles_select_partner ON profiles;
CREATE POLICY profiles_select_partner ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM partner_memberships pm
      WHERE pm.profile_id = profiles.id
        AND pm.revoked_at IS NULL
        AND pm.partner_id = ANY(auth_user_partner_ids())
    )
    OR EXISTS (
      SELECT 1
      FROM client_memberships cm
      WHERE cm.profile_id = profiles.id
        AND cm.revoked_at IS NULL
        AND cm.client_id = ANY(auth_user_client_ids())
    )
  );
DROP POLICY IF EXISTS profiles_select_org ON profiles;
CREATE POLICY profiles_select_org ON profiles
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM client_memberships cm
      WHERE cm.profile_id = profiles.id
        AND cm.revoked_at IS NULL
        AND cm.client_id = ANY(auth_user_client_ids())
    )
    OR EXISTS (
      SELECT 1
      FROM partner_memberships pm
      WHERE pm.profile_id = profiles.id
        AND pm.revoked_at IS NULL
        AND pm.partner_id = ANY(auth_user_partner_ids())
    )
  );
DROP POLICY IF EXISTS assessments_select_all ON assessments;
CREATE POLICY assessments_select_all ON assessments
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id IS NULL
    OR client_id = ANY(auth_user_client_ids())
  );
DROP POLICY IF EXISTS factors_select ON factors;
CREATE POLICY factors_select ON factors
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id IS NULL
    OR client_id = ANY(auth_user_client_ids())
  );
DROP POLICY IF EXISTS diagnostic_sessions_select ON diagnostic_sessions;
CREATE POLICY diagnostic_sessions_select ON diagnostic_sessions
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
  );
DROP POLICY IF EXISTS diagnostic_respondents_select ON diagnostic_respondents;
CREATE POLICY diagnostic_respondents_select ON diagnostic_respondents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM diagnostic_sessions ds
      WHERE ds.id = session_id
        AND (
          is_platform_admin()
          OR ds.client_id = ANY(auth_user_client_ids())
        )
    )
  );
DROP POLICY IF EXISTS diagnostic_responses_select ON diagnostic_responses;
CREATE POLICY diagnostic_responses_select ON diagnostic_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM diagnostic_respondents dr
      JOIN diagnostic_sessions ds ON ds.id = dr.session_id
      WHERE dr.id = respondent_id
        AND (
          is_platform_admin()
          OR ds.client_id = ANY(auth_user_client_ids())
        )
    )
  );
DROP POLICY IF EXISTS diagnostic_dimension_weights_select ON diagnostic_dimension_weights;
CREATE POLICY diagnostic_dimension_weights_select ON diagnostic_dimension_weights
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM diagnostic_sessions ds
      WHERE ds.id = session_id
        AND (
          is_platform_admin()
          OR ds.client_id = ANY(auth_user_client_ids())
        )
    )
  );
DROP POLICY IF EXISTS diagnostic_snapshots_select ON diagnostic_snapshots;
CREATE POLICY diagnostic_snapshots_select ON diagnostic_snapshots
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
  );
DROP POLICY IF EXISTS matching_runs_select ON matching_runs;
CREATE POLICY matching_runs_select ON matching_runs
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
  );
DROP POLICY IF EXISTS matching_results_select ON matching_results;
CREATE POLICY matching_results_select ON matching_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM matching_runs mr
      WHERE mr.id = matching_run_id
        AND (
          is_platform_admin()
          OR mr.client_id = ANY(auth_user_client_ids())
        )
    )
  );
DROP POLICY IF EXISTS campaigns_select ON campaigns;
CREATE POLICY campaigns_select ON campaigns
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR (client_id IS NOT NULL AND client_id = ANY(auth_user_client_ids()))
    OR (partner_id IS NOT NULL AND partner_id = ANY(auth_user_partner_ids()))
  );
DROP POLICY IF EXISTS campaign_assessments_select ON campaign_assessments;
CREATE POLICY campaign_assessments_select ON campaign_assessments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM campaigns c
      WHERE c.id = campaign_id
        AND (
          is_platform_admin()
          OR (c.client_id IS NOT NULL AND c.client_id = ANY(auth_user_client_ids()))
          OR (c.partner_id IS NOT NULL AND c.partner_id = ANY(auth_user_partner_ids()))
        )
    )
  );
DROP POLICY IF EXISTS campaign_participants_select ON campaign_participants;
CREATE POLICY campaign_participants_select ON campaign_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM campaigns c
      WHERE c.id = campaign_id
        AND (
          is_platform_admin()
          OR (c.client_id IS NOT NULL AND c.client_id = ANY(auth_user_client_ids()))
          OR (c.partner_id IS NOT NULL AND c.partner_id = ANY(auth_user_partner_ids()))
        )
    )
  );
DROP POLICY IF EXISTS campaign_access_links_select ON campaign_access_links;
CREATE POLICY campaign_access_links_select ON campaign_access_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM campaigns c
      WHERE c.id = campaign_id
        AND (
          is_platform_admin()
          OR (c.client_id IS NOT NULL AND c.client_id = ANY(auth_user_client_ids()))
          OR (c.partner_id IS NOT NULL AND c.partner_id = ANY(auth_user_partner_ids()))
        )
    )
  );
DROP POLICY IF EXISTS participant_sessions_select ON participant_sessions;
CREATE POLICY participant_sessions_select ON participant_sessions
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR (client_id IS NOT NULL AND client_id = ANY(auth_user_client_ids()))
    OR participant_profile_id = auth.uid()
  );
DROP POLICY IF EXISTS participant_responses_select ON participant_responses;
CREATE POLICY participant_responses_select ON participant_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM participant_sessions ps
      WHERE ps.id = session_id
        AND (
          is_platform_admin()
          OR (ps.client_id IS NOT NULL AND ps.client_id = ANY(auth_user_client_ids()))
          OR ps.participant_profile_id = auth.uid()
        )
    )
  );
DROP POLICY IF EXISTS participant_scores_select ON participant_scores;
CREATE POLICY participant_scores_select ON participant_scores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM participant_sessions ps
      WHERE ps.id = session_id
        AND (
          is_platform_admin()
          OR (ps.client_id IS NOT NULL AND ps.client_id = ANY(auth_user_client_ids()))
          OR ps.participant_profile_id = auth.uid()
        )
    )
  );
DROP POLICY IF EXISTS "client_members_select_own" ON client_assessment_assignments;
CREATE POLICY "client_members_select_own" ON client_assessment_assignments
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
  );
DROP POLICY IF EXISTS "client_members_select_own" ON client_report_template_assignments;
CREATE POLICY "client_members_select_own" ON client_report_template_assignments
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR client_id = ANY(auth_user_client_ids())
  );
DROP POLICY IF EXISTS report_templates_select ON report_templates;
CREATE POLICY report_templates_select ON report_templates
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR partner_id IS NULL
    OR partner_id = ANY(auth_user_partner_ids())
  );
DROP POLICY IF EXISTS report_snapshots_consultant_select ON report_snapshots;
CREATE POLICY report_snapshots_consultant_select ON report_snapshots
  FOR SELECT TO authenticated
  USING (
    audience_type = 'consultant'
    AND released_at IS NOT NULL
    AND campaign_id IN (
      SELECT c.id
      FROM campaigns c
      WHERE c.partner_id = ANY(auth_user_partner_ids())
    )
  );
DROP POLICY IF EXISTS report_snapshots_participant_select ON report_snapshots;
CREATE POLICY report_snapshots_participant_select ON report_snapshots
  FOR SELECT TO authenticated
  USING (
    audience_type = 'participant'
    AND released_at IS NOT NULL
    AND participant_session_id IN (
      SELECT ps.id
      FROM participant_sessions ps
      WHERE ps.participant_profile_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS report_snapshots_hr_manager_select ON report_snapshots;
CREATE POLICY report_snapshots_hr_manager_select ON report_snapshots
  FOR SELECT TO authenticated
  USING (
    audience_type = 'hr_manager'
    AND released_at IS NOT NULL
    AND campaign_id IN (
      SELECT c.id
      FROM campaigns c
      WHERE c.client_id = ANY(auth_user_client_ids())
    )
  );
DROP POLICY IF EXISTS report_snapshots_platform_admin_select ON report_snapshots;
CREATE POLICY report_snapshots_platform_admin_select ON report_snapshots
  FOR SELECT TO authenticated
  USING (is_platform_admin());
DROP POLICY IF EXISTS brand_configs_client_read ON brand_configs;
CREATE POLICY brand_configs_client_read ON brand_configs
  FOR SELECT TO authenticated
  USING (
    (owner_type = 'platform' AND is_default = true)
    OR (
      owner_type = 'client'
      AND owner_id IS NOT NULL
      AND owner_id = ANY(auth_user_client_ids())
    )
  );
DROP POLICY IF EXISTS brand_configs_client_update ON brand_configs;
CREATE POLICY brand_configs_client_update ON brand_configs
  FOR UPDATE TO authenticated
  USING (
    is_platform_admin()
    OR (
      owner_type = 'client'
      AND owner_id IS NOT NULL
      AND owner_id = ANY(auth_user_client_admin_ids())
    )
  );
DROP POLICY IF EXISTS experience_templates_campaign_read ON experience_templates;
CREATE POLICY experience_templates_campaign_read ON experience_templates
  FOR SELECT TO authenticated
  USING (
    (owner_type = 'platform' AND owner_id IS NULL)
    OR (
      owner_type = 'campaign'
      AND owner_id IN (
        SELECT c.id
        FROM campaigns c
        WHERE c.client_id = ANY(auth_user_client_ids())
      )
    )
  );
DROP POLICY IF EXISTS audit_events_select ON audit_events;
CREATE POLICY audit_events_select ON audit_events
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR (partner_id IS NOT NULL AND partner_id = ANY(auth_user_partner_ids()))
    OR (client_id IS NOT NULL AND client_id = ANY(auth_user_client_ids()))
  );
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type_created
  ON audit_events (event_type, created_at DESC);
COMMIT;
