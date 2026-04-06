-- ==========================================================================
-- 00068_rename_organizations_to_clients.sql
--
-- Terminology alignment: "organization" → "client" throughout the database.
-- Renames the table, all organization_id columns, the RLS helper function,
-- the quota function, the brand_owner_type enum value, and all affected
-- RLS policies, indexes, constraints, and triggers.
--
-- IDEMPOTENT: safe to re-run after partial application.
-- ==========================================================================

-- =========================================================================
-- 1. RENAME TABLE: organizations → clients
-- =========================================================================
DO $$ BEGIN
  ALTER TABLE organizations RENAME TO clients;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Rename constraints that reference the old name
DO $$ BEGIN
  ALTER TABLE clients RENAME CONSTRAINT organizations_slug_unique TO clients_slug_unique;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE clients RENAME CONSTRAINT organizations_slug_format TO clients_slug_format;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE clients RENAME CONSTRAINT organizations_name_not_empty TO clients_name_not_empty;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Rename indexes on the clients table itself
DO $$ BEGIN
  ALTER INDEX idx_organizations_partner_id RENAME TO idx_clients_partner_id;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_organizations_not_deleted RENAME TO idx_clients_not_deleted;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_organizations_active RENAME TO idx_clients_active;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Rename trigger
DO $$ BEGIN
  ALTER TRIGGER trg_organizations_updated_at ON clients RENAME TO trg_clients_updated_at;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- =========================================================================
-- 2. RENAME organization_id → client_id IN ALL TABLES
-- =========================================================================
DO $$ BEGIN
  ALTER TABLE profiles RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assessments RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE diagnostic_sessions RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE diagnostic_snapshots RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE matching_runs RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE participant_sessions RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE campaigns RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE client_memberships RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE support_sessions RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE audit_events RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE client_assessment_assignments RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE client_report_template_assignments RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE factors RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE norm_groups RENAME COLUMN organization_id TO client_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- =========================================================================
-- 3. RENAME INDEXES that reference organization_id
-- =========================================================================
DO $$ BEGIN
  ALTER INDEX idx_profiles_organization_id RENAME TO idx_profiles_client_id;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_assessments_organization_id RENAME TO idx_assessments_client_id;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_diagnostic_sessions_org RENAME TO idx_diagnostic_sessions_client;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_diagnostic_snapshots_org RENAME TO idx_diagnostic_snapshots_client;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_matching_runs_org RENAME TO idx_matching_runs_client;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_participant_sessions_org RENAME TO idx_participant_sessions_client;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_campaigns_org RENAME TO idx_campaigns_client;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_client_memberships_client RENAME TO idx_client_memberships_client_id;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_support_sessions_client RENAME TO idx_support_sessions_client_id;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_audit_events_client_created RENAME TO idx_audit_events_client_id_created;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_client_assessment_assignments_org RENAME TO idx_client_assessment_assignments_client;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_client_report_template_assignments_org RENAME TO idx_client_report_template_assignments_client;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER INDEX idx_factors_organization RENAME TO idx_factors_client;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- =========================================================================
-- 4. RENAME CONSTRAINTS referencing organization_id
-- =========================================================================
DO $$ BEGIN
  ALTER TABLE client_memberships
    RENAME CONSTRAINT client_memberships_unique TO client_memberships_profile_client_unique;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE support_sessions
    RENAME CONSTRAINT support_sessions_target_scope_check TO support_sessions_target_scope_check_old;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE client_assessment_assignments
    RENAME CONSTRAINT uq_client_assessment TO uq_client_assessment_assignment;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE client_report_template_assignments
    RENAME CONSTRAINT uq_client_report_template TO uq_client_report_template_assignment;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Recreate the support_sessions target scope check with new column name
DO $$ BEGIN
  ALTER TABLE support_sessions DROP CONSTRAINT support_sessions_target_scope_check_old;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Drop+recreate to be idempotent: drop the new-name constraint if it exists, then create
DO $$ BEGIN
  ALTER TABLE support_sessions DROP CONSTRAINT support_sessions_target_scope_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE support_sessions ADD CONSTRAINT support_sessions_target_scope_check CHECK (
    (target_surface = 'partner' AND partner_id IS NOT NULL AND client_id IS NULL)
    OR
    (target_surface = 'client' AND client_id IS NOT NULL)
);

-- =========================================================================
-- 5. REPLACE auth_user_organization_id() → auth_user_client_id()
-- =========================================================================
-- Create the new function first
CREATE OR REPLACE FUNCTION auth_user_client_id()
RETURNS UUID AS $$
    SELECT client_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION auth_user_client_id() IS
    'Returns the client ID for the currently authenticated user.';

-- Drop the old function with CASCADE — this drops the dependent RLS policies,
-- which we recreate immediately below with the new function reference.
DROP FUNCTION IF EXISTS auth_user_organization_id() CASCADE;

-- =========================================================================
-- 6. UPDATE auth_user_client_ids() function (from 00038)
-- =========================================================================
CREATE OR REPLACE FUNCTION auth_user_client_ids()
RETURNS UUID[] AS $$
    SELECT COALESCE(
        ARRAY(
            SELECT DISTINCT client_id
            FROM (
                SELECT cm.client_id
                FROM client_memberships cm
                WHERE cm.profile_id = auth.uid()
                UNION
                SELECT p.client_id
                FROM profiles p
                WHERE p.id = auth.uid() AND p.client_id IS NOT NULL
            ) client_ids
        ),
        ARRAY[]::UUID[]
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION auth_user_client_ids() IS
    'Returns all client IDs the current authenticated user belongs to, including legacy direct profile ownership.';

-- =========================================================================
-- 7. UPDATE get_assessment_quota_usage() function
-- =========================================================================
DROP FUNCTION IF EXISTS get_assessment_quota_usage(UUID, UUID);
CREATE FUNCTION get_assessment_quota_usage(p_client_id UUID, p_assessment_id UUID)
RETURNS INT AS $$
  SELECT COALESCE(COUNT(*)::INT, 0)
  FROM campaign_participants cp
  JOIN campaign_assessments ca ON ca.campaign_id = cp.campaign_id
  JOIN campaigns c ON c.id = cp.campaign_id
  WHERE ca.assessment_id = p_assessment_id
    AND c.client_id = p_client_id
    AND c.deleted_at IS NULL
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_assessment_quota_usage IS
  'Computes live quota usage for a given client + assessment. NULL-safe (returns 0 if no matches).';

-- =========================================================================
-- 8. UPDATE upsert_factor_with_constructs() function
-- =========================================================================
CREATE OR REPLACE FUNCTION upsert_factor_with_constructs(
  p_factor_id uuid,
  p_factor jsonb,
  p_construct_links jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factor_id uuid;
  v_link jsonb;
BEGIN
  INSERT INTO factors (
    id,
    name,
    slug,
    description,
    definition,
    dimension_id,
    is_active,
    is_match_eligible,
    client_id,
    indicators_low,
    indicators_mid,
    indicators_high
  ) VALUES (
    p_factor_id,
    (p_factor->>'name'),
    (p_factor->>'slug'),
    (p_factor->>'description'),
    (p_factor->>'definition'),
    (p_factor->>'dimension_id')::uuid,
    COALESCE((p_factor->>'is_active')::boolean, true),
    COALESCE((p_factor->>'is_match_eligible')::boolean, true),
    COALESCE((p_factor->>'client_id')::uuid, (p_factor->>'organization_id')::uuid),
    (p_factor->>'indicators_low'),
    (p_factor->>'indicators_mid'),
    (p_factor->>'indicators_high')
  )
  ON CONFLICT (id) DO UPDATE SET
    name             = EXCLUDED.name,
    slug             = EXCLUDED.slug,
    description      = EXCLUDED.description,
    definition       = EXCLUDED.definition,
    dimension_id     = EXCLUDED.dimension_id,
    is_active        = EXCLUDED.is_active,
    is_match_eligible = EXCLUDED.is_match_eligible,
    client_id        = EXCLUDED.client_id,
    indicators_low   = EXCLUDED.indicators_low,
    indicators_mid   = EXCLUDED.indicators_mid,
    indicators_high  = EXCLUDED.indicators_high,
    updated_at       = now()
  RETURNING id INTO v_factor_id;

  DELETE FROM factor_constructs WHERE factor_id = v_factor_id;

  FOR v_link IN SELECT * FROM jsonb_array_elements(p_construct_links)
  LOOP
    INSERT INTO factor_constructs (
      factor_id,
      construct_id,
      weight,
      display_order
    ) VALUES (
      v_factor_id,
      (v_link->>'construct_id')::uuid,
      COALESCE((v_link->>'weight')::numeric, 1.0),
      COALESCE((v_link->>'display_order')::integer, 0)
    );
  END LOOP;

  RETURN v_factor_id;
END;
$$;

-- =========================================================================
-- 9. UPDATE brand_owner_type ENUM: 'organization' → 'client'
-- =========================================================================
DO $$ BEGIN
  ALTER TYPE brand_owner_type RENAME VALUE 'organization' TO 'client';
EXCEPTION WHEN invalid_parameter_value THEN NULL;
END $$;

-- =========================================================================
-- 10. UPDATE brand_configs RLS policies that reference 'organization'
-- =========================================================================
DROP POLICY IF EXISTS brand_configs_org_read ON brand_configs;
DROP POLICY IF EXISTS brand_configs_client_read ON brand_configs;
CREATE POLICY brand_configs_client_read ON brand_configs
  FOR SELECT TO authenticated
  USING (
    owner_type = 'client'
    AND owner_id IN (
      SELECT client_id FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'org_admin'
    )
  );

DROP POLICY IF EXISTS brand_configs_org_update ON brand_configs;
DROP POLICY IF EXISTS brand_configs_client_update ON brand_configs;
CREATE POLICY brand_configs_client_update ON brand_configs
  FOR UPDATE TO authenticated
  USING (
    owner_type = 'client'
    AND owner_id IN (
      SELECT client_id FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'org_admin'
    )
  );

DROP POLICY IF EXISTS brand_configs_anon_read ON brand_configs;
CREATE POLICY brand_configs_anon_read ON brand_configs
  FOR SELECT TO anon
  USING (
    (owner_type = 'platform' AND is_default = true)
    OR owner_type = 'client'
    OR owner_type = 'campaign'
  );

-- =========================================================================
-- 11. DROP & RECREATE RLS POLICIES ON clients (was organizations)
-- =========================================================================
DROP POLICY IF EXISTS organizations_select_platform_admin ON clients;
DROP POLICY IF EXISTS organizations_select_partner ON clients;
DROP POLICY IF EXISTS organizations_select_own ON clients;
DROP POLICY IF EXISTS organizations_all_platform_admin ON clients;
DROP POLICY IF EXISTS organizations_insert_partner_admin ON clients;
DROP POLICY IF EXISTS organizations_update_partner_admin ON clients;

DROP POLICY IF EXISTS clients_select_platform_admin ON clients;
CREATE POLICY clients_select_platform_admin ON clients
    FOR SELECT USING (is_platform_admin());

DROP POLICY IF EXISTS clients_select_partner ON clients;
CREATE POLICY clients_select_partner ON clients
    FOR SELECT USING (partner_id IS NOT NULL AND partner_id = auth_user_partner_id());

DROP POLICY IF EXISTS clients_select_own ON clients;
CREATE POLICY clients_select_own ON clients
    FOR SELECT USING (id = auth_user_client_id());

DROP POLICY IF EXISTS clients_all_platform_admin ON clients;
CREATE POLICY clients_all_platform_admin ON clients
    FOR ALL USING (is_platform_admin());

DROP POLICY IF EXISTS clients_insert_partner_admin ON clients;
CREATE POLICY clients_insert_partner_admin ON clients
    FOR INSERT WITH CHECK (
        is_partner_admin() AND partner_id = auth_user_partner_id()
    );

DROP POLICY IF EXISTS clients_update_partner_admin ON clients;
CREATE POLICY clients_update_partner_admin ON clients
    FOR UPDATE USING (
        is_partner_admin() AND partner_id = auth_user_partner_id()
    );

-- =========================================================================
-- 12. DROP & RECREATE RLS POLICIES ON profiles
-- =========================================================================
DROP POLICY IF EXISTS profiles_select_partner ON profiles;
DROP POLICY IF EXISTS profiles_select_org ON profiles;

CREATE POLICY profiles_select_partner ON profiles
    FOR SELECT USING (
        auth_user_role() IN ('partner_admin', 'consultant')
        AND (
            partner_id = auth_user_partner_id()
            OR client_id IN (
                SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
            )
        )
    );

CREATE POLICY profiles_select_org ON profiles
    FOR SELECT USING (
        auth_user_role() = 'org_admin'
        AND client_id = auth_user_client_id()
    );

-- =========================================================================
-- 13. DROP & RECREATE RLS POLICIES ON assessments
-- =========================================================================
DROP POLICY IF EXISTS assessments_select_all ON assessments;
DROP POLICY IF EXISTS assessments_manage_org_admin ON assessments;

CREATE POLICY assessments_select_all ON assessments
    FOR SELECT USING (
        is_platform_admin()
        OR client_id IS NULL
        OR client_id = auth_user_client_id()
        OR client_id IN (
            SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
        )
    );

CREATE POLICY assessments_manage_org_admin ON assessments
    FOR ALL USING (
        auth_user_role() = 'org_admin'
        AND client_id = auth_user_client_id()
    );

-- Assessment sub-tables (assessment_competencies removed — table does not exist)
DROP POLICY IF EXISTS item_selection_rules_select ON item_selection_rules;
CREATE POLICY item_selection_rules_select ON item_selection_rules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM assessments a WHERE a.id = assessment_id
            AND (
                is_platform_admin()
                OR a.client_id IS NULL
                OR a.client_id = auth_user_client_id()
                OR a.client_id IN (
                    SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
                )
            )
        )
    );

-- =========================================================================
-- 14. DROP & RECREATE RLS POLICIES ON diagnostic_sessions
-- =========================================================================
DROP POLICY IF EXISTS diagnostic_sessions_select ON diagnostic_sessions;
DROP POLICY IF EXISTS diagnostic_sessions_manage_org ON diagnostic_sessions;

CREATE POLICY diagnostic_sessions_select ON diagnostic_sessions
    FOR SELECT USING (
        is_platform_admin()
        OR client_id = auth_user_client_id()
        OR client_id IN (
            SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
        )
    );

CREATE POLICY diagnostic_sessions_manage_org ON diagnostic_sessions
    FOR ALL USING (
        auth_user_role() IN ('org_admin', 'consultant')
        AND (
            client_id = auth_user_client_id()
            OR client_id IN (
                SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
            )
        )
    );

-- Diagnostic sub-tables
DROP POLICY IF EXISTS diagnostic_respondents_select ON diagnostic_respondents;
CREATE POLICY diagnostic_respondents_select ON diagnostic_respondents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM diagnostic_sessions ds WHERE ds.id = session_id
            AND (
                is_platform_admin()
                OR ds.client_id = auth_user_client_id()
                OR ds.client_id IN (
                    SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
                )
            )
        )
    );

DROP POLICY IF EXISTS diagnostic_respondents_manage ON diagnostic_respondents;
CREATE POLICY diagnostic_respondents_manage ON diagnostic_respondents
    FOR ALL USING (
        auth_user_role() IN ('org_admin', 'consultant')
        AND EXISTS (
            SELECT 1 FROM diagnostic_sessions ds WHERE ds.id = session_id
            AND (
                ds.client_id = auth_user_client_id()
                OR ds.client_id IN (
                    SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
                )
            )
        )
    );

DROP POLICY IF EXISTS diagnostic_responses_select ON diagnostic_responses;
CREATE POLICY diagnostic_responses_select ON diagnostic_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM diagnostic_respondents dr
            JOIN diagnostic_sessions ds ON ds.id = dr.session_id
            WHERE dr.id = respondent_id
            AND (
                is_platform_admin()
                OR ds.client_id = auth_user_client_id()
                OR ds.client_id IN (
                    SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
                )
            )
        )
    );

DROP POLICY IF EXISTS diagnostic_dimension_weights_select ON diagnostic_dimension_weights;
CREATE POLICY diagnostic_dimension_weights_select ON diagnostic_dimension_weights
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM diagnostic_sessions ds WHERE ds.id = session_id
            AND (
                is_platform_admin()
                OR ds.client_id = auth_user_client_id()
                OR ds.client_id IN (
                    SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
                )
            )
        )
    );

DROP POLICY IF EXISTS diagnostic_snapshots_select ON diagnostic_snapshots;
CREATE POLICY diagnostic_snapshots_select ON diagnostic_snapshots
    FOR SELECT USING (
        is_platform_admin()
        OR client_id = auth_user_client_id()
        OR client_id IN (
            SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
        )
    );

-- =========================================================================
-- 15. DROP & RECREATE RLS POLICIES ON matching_runs & matching_results
-- =========================================================================
DROP POLICY IF EXISTS matching_runs_select ON matching_runs;
DROP POLICY IF EXISTS matching_runs_manage ON matching_runs;

CREATE POLICY matching_runs_select ON matching_runs
    FOR SELECT USING (
        is_platform_admin()
        OR client_id = auth_user_client_id()
        OR client_id IN (
            SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
        )
    );

CREATE POLICY matching_runs_manage ON matching_runs
    FOR ALL USING (
        auth_user_role() IN ('org_admin', 'consultant')
        AND (
            client_id = auth_user_client_id()
            OR client_id IN (
                SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
            )
        )
    );

DROP POLICY IF EXISTS matching_results_select ON matching_results;
CREATE POLICY matching_results_select ON matching_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM matching_runs mr WHERE mr.id = matching_run_id
            AND (
                is_platform_admin()
                OR mr.client_id = auth_user_client_id()
                OR mr.client_id IN (
                    SELECT c.id FROM clients c WHERE c.partner_id = auth_user_partner_id()
                )
            )
        )
    );

-- =========================================================================
-- 16. DROP & RECREATE RLS POLICIES ON campaigns
-- =========================================================================
DROP POLICY IF EXISTS campaigns_select ON campaigns;

CREATE POLICY campaigns_select ON campaigns
    FOR SELECT TO authenticated USING (
        is_platform_admin()
        OR (client_id IS NOT NULL AND client_id = auth_user_client_id())
        OR (partner_id IS NOT NULL AND partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid()))
    );

-- =========================================================================
-- 17. DROP & RECREATE RLS POLICIES ON campaign_assessments
-- =========================================================================
DROP POLICY IF EXISTS campaign_assessments_select ON campaign_assessments;

CREATE POLICY campaign_assessments_select ON campaign_assessments
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_id
            AND (
                is_platform_admin()
                OR (c.client_id IS NOT NULL AND c.client_id = auth_user_client_id())
                OR (c.partner_id IS NOT NULL AND c.partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid()))
            )
        )
    );

-- =========================================================================
-- 18. DROP & RECREATE RLS POLICIES ON campaign_participants
-- =========================================================================
DROP POLICY IF EXISTS campaign_participants_select ON campaign_participants;

CREATE POLICY campaign_participants_select ON campaign_participants
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_id
            AND (
                is_platform_admin()
                OR (c.client_id IS NOT NULL AND c.client_id = auth_user_client_id())
            )
        )
    );

-- =========================================================================
-- 19. DROP & RECREATE RLS POLICIES ON campaign_access_links
-- =========================================================================
DROP POLICY IF EXISTS campaign_access_links_select ON campaign_access_links;

CREATE POLICY campaign_access_links_select ON campaign_access_links
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_id
            AND (
                is_platform_admin()
                OR (c.client_id IS NOT NULL AND c.client_id = auth_user_client_id())
            )
        )
    );

-- =========================================================================
-- 20. DROP & RECREATE RLS POLICIES ON participant_sessions
-- =========================================================================
DROP POLICY IF EXISTS participant_sessions_select ON participant_sessions;
DROP POLICY IF EXISTS participant_sessions_manage_org ON participant_sessions;

CREATE POLICY participant_sessions_select ON participant_sessions
    FOR SELECT TO authenticated USING (
        is_platform_admin()
        OR (client_id IS NOT NULL AND client_id = auth_user_client_id())
        OR participant_profile_id = auth.uid()
    );

CREATE POLICY participant_sessions_manage_org ON participant_sessions
    FOR INSERT TO authenticated WITH CHECK (
        is_platform_admin()
        OR (client_id IS NOT NULL AND client_id = auth_user_client_id())
    );

-- =========================================================================
-- 21. DROP & RECREATE RLS POLICIES ON participant_responses
-- =========================================================================
DROP POLICY IF EXISTS participant_responses_select ON participant_responses;

CREATE POLICY participant_responses_select ON participant_responses
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM participant_sessions ps
            WHERE ps.id = session_id
            AND (
                is_platform_admin()
                OR (ps.client_id IS NOT NULL AND ps.client_id = auth_user_client_id())
                OR ps.participant_profile_id = auth.uid()
            )
        )
    );

-- =========================================================================
-- 22. DROP & RECREATE RLS POLICIES ON participant_scores
-- =========================================================================
DROP POLICY IF EXISTS participant_scores_select ON participant_scores;

CREATE POLICY participant_scores_select ON participant_scores
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM participant_sessions ps
            WHERE ps.id = session_id
            AND (
                is_platform_admin()
                OR (ps.client_id IS NOT NULL AND ps.client_id = auth_user_client_id())
                OR ps.participant_profile_id = auth.uid()
            )
        )
    );

-- =========================================================================
-- 23. DROP & RECREATE RLS POLICIES ON client_assessment_assignments
-- =========================================================================
DROP POLICY IF EXISTS "client_members_select_own" ON client_assessment_assignments;

CREATE POLICY "client_members_select_own" ON client_assessment_assignments
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT cm.client_id FROM client_memberships cm
      WHERE cm.profile_id = auth.uid() AND cm.revoked_at IS NULL
    )
  );

-- =========================================================================
-- 24. DROP & RECREATE RLS POLICIES ON client_report_template_assignments
-- =========================================================================
DROP POLICY IF EXISTS "client_members_select_own" ON client_report_template_assignments;

CREATE POLICY "client_members_select_own" ON client_report_template_assignments
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT cm.client_id FROM client_memberships cm
      WHERE cm.profile_id = auth.uid() AND cm.revoked_at IS NULL
    )
  );

-- =========================================================================
-- 25. DROP & RECREATE RLS POLICY ON report_snapshots (hr_manager)
-- =========================================================================
DROP POLICY IF EXISTS "report_snapshots_hr_manager_select" ON report_snapshots;

CREATE POLICY "report_snapshots_hr_manager_select" ON report_snapshots
  FOR SELECT TO authenticated
  USING (
    audience_type = 'hr_manager'
    AND released_at IS NOT NULL
    AND campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN client_memberships cm ON cm.client_id = c.client_id
      WHERE cm.profile_id = auth.uid()
    )
  );

-- =========================================================================
-- 26. DROP & RECREATE RLS POLICIES ON experience_templates
-- =========================================================================
DROP POLICY IF EXISTS experience_templates_campaign_read ON experience_templates;
CREATE POLICY experience_templates_campaign_read ON experience_templates
  FOR SELECT TO authenticated
  USING (
    owner_type = 'campaign'
    AND owner_id IN (
      SELECT c.id FROM campaigns c
      JOIN profiles p ON p.client_id = c.client_id
      WHERE p.id = auth.uid()
        AND p.role IN ('org_admin', 'platform_admin')
    )
  );

DROP POLICY IF EXISTS experience_templates_campaign_write ON experience_templates;
CREATE POLICY experience_templates_campaign_write ON experience_templates
  FOR UPDATE TO authenticated
  USING (
    owner_type = 'campaign'
    AND owner_id IN (
      SELECT c.id FROM campaigns c
      JOIN profiles p ON p.client_id = c.client_id
      WHERE p.id = auth.uid()
        AND p.role IN ('org_admin', 'platform_admin')
    )
  );

-- =========================================================================
-- 27. UPDATE TABLE COMMENTS
-- =========================================================================
COMMENT ON TABLE clients IS
    'Client organisations. May belong to a partner (consulting firm) or operate directly on the platform.';

COMMENT ON TABLE client_memberships IS
    'Client-scoped memberships for multi-membership tenancy resolution.';

COMMENT ON TABLE client_assessment_assignments IS
    'Links clients to the assessments they can use in campaigns, with optional per-row quota limits.';

COMMENT ON TABLE client_report_template_assignments IS
    'Links clients to the report templates they can generate from campaign results.';
