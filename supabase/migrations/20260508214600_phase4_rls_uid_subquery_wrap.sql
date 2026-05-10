-- Phase 4.7a — wrap auth.uid() calls in (select auth.uid()) for 77
-- RLS policies flagged by Supabase advisor 0003_auth_rls_initplan.
-- Without the wrap, the planner re-evaluates auth.uid() per row;
-- wrapped, it becomes an InitPlan evaluated once per query.
-- Each policy is dropped and recreated; only the auth.uid() calls
-- in qual / with_check are rewritten — predicates are otherwise
-- identical to the originals.

BEGIN;

DROP POLICY "assessment_section_items_delete" ON public.assessment_section_items;
CREATE POLICY "assessment_section_items_delete" ON public.assessment_section_items
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "assessment_section_items_insert" ON public.assessment_section_items;
CREATE POLICY "assessment_section_items_insert" ON public.assessment_section_items
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "assessment_section_items_update" ON public.assessment_section_items;
CREATE POLICY "assessment_section_items_update" ON public.assessment_section_items
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "assessment_sections_delete" ON public.assessment_sections;
CREATE POLICY "assessment_sections_delete" ON public.assessment_sections
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "assessment_sections_insert" ON public.assessment_sections;
CREATE POLICY "assessment_sections_insert" ON public.assessment_sections
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "assessment_sections_update" ON public.assessment_sections;
CREATE POLICY "assessment_sections_update" ON public.assessment_sections
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "brand_configs_admin_all" ON public.brand_configs;
CREATE POLICY "brand_configs_admin_all" ON public.brand_configs
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "calibration_runs_delete" ON public.calibration_runs;
CREATE POLICY "calibration_runs_delete" ON public.calibration_runs
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "calibration_runs_insert" ON public.calibration_runs;
CREATE POLICY "calibration_runs_insert" ON public.calibration_runs
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "calibration_runs_update" ON public.calibration_runs;
CREATE POLICY "calibration_runs_update" ON public.calibration_runs
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "Users can manage their own favorites" ON public.campaign_favorites;
CREATE POLICY "Users can manage their own favorites" ON public.campaign_favorites
  AS PERMISSIVE FOR ALL
  TO public
  USING ((profile_id = (select auth.uid())))
  WITH CHECK ((profile_id = (select auth.uid())));

DROP POLICY "platform_admins_full_access" ON public.client_assessment_assignments;
CREATE POLICY "platform_admins_full_access" ON public.client_assessment_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "client_memberships_select" ON public.client_memberships;
CREATE POLICY "client_memberships_select" ON public.client_memberships
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((is_platform_admin() OR (profile_id = (select auth.uid())) OR (client_id = ANY (auth_user_client_admin_ids()))));

DROP POLICY "platform_admins_full_access" ON public.client_report_template_assignments;
CREATE POLICY "platform_admins_full_access" ON public.client_report_template_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "client_roles_select_client" ON public.client_roles;
CREATE POLICY "client_roles_select_client" ON public.client_roles
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((is_platform_admin() OR (client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE ((c.partner_id = ( SELECT profiles.partner_id
           FROM profiles
          WHERE (profiles.id = (select auth.uid())))) AND (c.deleted_at IS NULL))))));

DROP POLICY "competency_categories_select_authenticated" ON public.competency_categories;
CREATE POLICY "competency_categories_select_authenticated" ON public.competency_categories
  AS PERMISSIVE FOR SELECT
  TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY "construct_reliability_delete" ON public.construct_reliability;
CREATE POLICY "construct_reliability_delete" ON public.construct_reliability
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "construct_reliability_insert" ON public.construct_reliability;
CREATE POLICY "construct_reliability_insert" ON public.construct_reliability
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "construct_reliability_update" ON public.construct_reliability;
CREATE POLICY "construct_reliability_update" ON public.construct_reliability
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "constructs_delete" ON public.constructs;
CREATE POLICY "constructs_delete" ON public.constructs
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "constructs_insert" ON public.constructs;
CREATE POLICY "constructs_insert" ON public.constructs
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "constructs_update" ON public.constructs;
CREATE POLICY "constructs_update" ON public.constructs
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "diagnostic_dimensions_select_authenticated" ON public.diagnostic_dimensions;
CREATE POLICY "diagnostic_dimensions_select_authenticated" ON public.diagnostic_dimensions
  AS PERMISSIVE FOR SELECT
  TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY "diagnostic_responses_insert_respondent" ON public.diagnostic_responses;
CREATE POLICY "diagnostic_responses_insert_respondent" ON public.diagnostic_responses
  AS PERMISSIVE FOR INSERT
  TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM diagnostic_respondents dr
  WHERE ((dr.id = diagnostic_responses.respondent_id) AND (dr.profile_id = (select auth.uid()))))));

DROP POLICY "diagnostic_template_dimensions_select_authenticated" ON public.diagnostic_template_dimensions;
CREATE POLICY "diagnostic_template_dimensions_select_authenticated" ON public.diagnostic_template_dimensions
  AS PERMISSIVE FOR SELECT
  TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY "diagnostic_templates_select_authenticated" ON public.diagnostic_templates;
CREATE POLICY "diagnostic_templates_select_authenticated" ON public.diagnostic_templates
  AS PERMISSIVE FOR SELECT
  TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY "dif_results_delete" ON public.dif_results;
CREATE POLICY "dif_results_delete" ON public.dif_results
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "dif_results_insert" ON public.dif_results;
CREATE POLICY "dif_results_insert" ON public.dif_results
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "dimension_constructs_delete" ON public.dimension_constructs;
CREATE POLICY "dimension_constructs_delete" ON public.dimension_constructs
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "dimension_constructs_insert" ON public.dimension_constructs;
CREATE POLICY "dimension_constructs_insert" ON public.dimension_constructs
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "dimension_constructs_update" ON public.dimension_constructs;
CREATE POLICY "dimension_constructs_update" ON public.dimension_constructs
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "email_templates_platform_admin_all" ON public.email_templates;
CREATE POLICY "email_templates_platform_admin_all" ON public.email_templates
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role) AND (profiles.is_active = true)))));

DROP POLICY "experience_templates_admin_all" ON public.experience_templates;
CREATE POLICY "experience_templates_admin_all" ON public.experience_templates
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "experience_templates_campaign_write" ON public.experience_templates;
CREATE POLICY "experience_templates_campaign_write" ON public.experience_templates
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (((owner_type = 'campaign'::text) AND (owner_id IN ( SELECT c.id
   FROM (campaigns c
     JOIN profiles p ON ((p.client_id = c.client_id)))
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['org_admin'::user_role, 'platform_admin'::user_role])))))));

DROP POLICY "factor_analysis_results_delete" ON public.factor_analysis_results;
CREATE POLICY "factor_analysis_results_delete" ON public.factor_analysis_results
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "factor_analysis_results_insert" ON public.factor_analysis_results;
CREATE POLICY "factor_analysis_results_insert" ON public.factor_analysis_results
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "factor_constructs_delete" ON public.factor_constructs;
CREATE POLICY "factor_constructs_delete" ON public.factor_constructs
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "factor_constructs_insert" ON public.factor_constructs;
CREATE POLICY "factor_constructs_insert" ON public.factor_constructs
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "factor_constructs_update" ON public.factor_constructs;
CREATE POLICY "factor_constructs_update" ON public.factor_constructs
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "factors_delete" ON public.factors;
CREATE POLICY "factors_delete" ON public.factors
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "factors_insert" ON public.factors;
CREATE POLICY "factors_insert" ON public.factors
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "factors_update" ON public.factors;
CREATE POLICY "factors_update" ON public.factors
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "item_options_select_authenticated" ON public.item_options;
CREATE POLICY "item_options_select_authenticated" ON public.item_options
  AS PERMISSIVE FOR SELECT
  TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY "item_parameters_select_authenticated" ON public.item_parameters;
CREATE POLICY "item_parameters_select_authenticated" ON public.item_parameters
  AS PERMISSIVE FOR SELECT
  TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY "item_statistics_delete" ON public.item_statistics;
CREATE POLICY "item_statistics_delete" ON public.item_statistics
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "item_statistics_insert" ON public.item_statistics;
CREATE POLICY "item_statistics_insert" ON public.item_statistics
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "item_statistics_update" ON public.item_statistics;
CREATE POLICY "item_statistics_update" ON public.item_statistics
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "items_select_authenticated" ON public.items;
CREATE POLICY "items_select_authenticated" ON public.items
  AS PERMISSIVE FOR SELECT
  TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY "norm_groups_delete" ON public.norm_groups;
CREATE POLICY "norm_groups_delete" ON public.norm_groups
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "norm_groups_insert" ON public.norm_groups;
CREATE POLICY "norm_groups_insert" ON public.norm_groups
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "norm_groups_update" ON public.norm_groups;
CREATE POLICY "norm_groups_update" ON public.norm_groups
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "norm_tables_delete" ON public.norm_tables;
CREATE POLICY "norm_tables_delete" ON public.norm_tables
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "norm_tables_insert" ON public.norm_tables;
CREATE POLICY "norm_tables_insert" ON public.norm_tables
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "norm_tables_update" ON public.norm_tables;
CREATE POLICY "norm_tables_update" ON public.norm_tables
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "org_diag_tracks_select_via_campaign" ON public.org_diagnostic_campaign_tracks;
CREATE POLICY "org_diag_tracks_select_via_campaign" ON public.org_diagnostic_campaign_tracks
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM org_diagnostic_campaigns c
  WHERE ((c.id = org_diagnostic_campaign_tracks.campaign_id) AND (is_platform_admin() OR (c.client_id = auth_user_client_id()) OR (c.client_id IN ( SELECT cl.id
           FROM clients cl
          WHERE ((cl.partner_id = ( SELECT profiles.partner_id
                   FROM profiles
                  WHERE (profiles.id = (select auth.uid())))) AND (cl.deleted_at IS NULL)))))))));

DROP POLICY "org_diag_campaigns_select_client" ON public.org_diagnostic_campaigns;
CREATE POLICY "org_diag_campaigns_select_client" ON public.org_diagnostic_campaigns
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((is_platform_admin() OR (client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE ((c.partner_id = ( SELECT profiles.partner_id
           FROM profiles
          WHERE (profiles.id = (select auth.uid())))) AND (c.deleted_at IS NULL))))));

DROP POLICY "org_diag_profiles_select_client" ON public.org_diagnostic_profiles;
CREATE POLICY "org_diag_profiles_select_client" ON public.org_diagnostic_profiles
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((is_platform_admin() OR (client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE ((c.partner_id = ( SELECT profiles.partner_id
           FROM profiles
          WHERE (profiles.id = (select auth.uid())))) AND (c.deleted_at IS NULL))))));

DROP POLICY "participant_responses_insert_own" ON public.participant_responses;
CREATE POLICY "participant_responses_insert_own" ON public.participant_responses
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM participant_sessions ps
  WHERE ((ps.id = participant_responses.session_id) AND (ps.participant_profile_id = (select auth.uid()))))));

DROP POLICY "participant_responses_select" ON public.participant_responses;
CREATE POLICY "participant_responses_select" ON public.participant_responses
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM participant_sessions ps
  WHERE ((ps.id = participant_responses.session_id) AND (is_platform_admin() OR ((ps.client_id IS NOT NULL) AND (ps.client_id = ANY (auth_user_client_ids()))) OR (ps.participant_profile_id = (select auth.uid())))))));

DROP POLICY "participant_scores_select" ON public.participant_scores;
CREATE POLICY "participant_scores_select" ON public.participant_scores
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM participant_sessions ps
  WHERE ((ps.id = participant_scores.session_id) AND (is_platform_admin() OR ((ps.client_id IS NOT NULL) AND (ps.client_id = ANY (auth_user_client_ids()))) OR (ps.participant_profile_id = (select auth.uid())))))));

DROP POLICY "participant_sessions_select" ON public.participant_sessions;
CREATE POLICY "participant_sessions_select" ON public.participant_sessions
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((is_platform_admin() OR ((client_id IS NOT NULL) AND (client_id = ANY (auth_user_client_ids()))) OR (participant_profile_id = (select auth.uid()))));

DROP POLICY "participant_sessions_update_own" ON public.participant_sessions;
CREATE POLICY "participant_sessions_update_own" ON public.participant_sessions
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((participant_profile_id = (select auth.uid())));

DROP POLICY "partner_members_select_own" ON public.partner_assessment_assignments;
CREATE POLICY "partner_members_select_own" ON public.partner_assessment_assignments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((partner_id IN ( SELECT pm.partner_id
   FROM partner_memberships pm
  WHERE ((pm.profile_id = (select auth.uid())) AND (pm.revoked_at IS NULL)))));

DROP POLICY "platform_admins_full_access" ON public.partner_assessment_assignments;
CREATE POLICY "platform_admins_full_access" ON public.partner_assessment_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "partner_memberships_select" ON public.partner_memberships;
CREATE POLICY "partner_memberships_select" ON public.partner_memberships
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((is_platform_admin() OR (profile_id = (select auth.uid())) OR (partner_id = ANY (auth_user_partner_admin_ids()))));

DROP POLICY "partner_members_select_own" ON public.partner_report_template_assignments;
CREATE POLICY "partner_members_select_own" ON public.partner_report_template_assignments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((partner_id IN ( SELECT pm.partner_id
   FROM partner_memberships pm
  WHERE ((pm.profile_id = (select auth.uid())) AND (pm.revoked_at IS NULL)))));

DROP POLICY "platform_admins_full_access" ON public.partner_report_template_assignments;
CREATE POLICY "platform_admins_full_access" ON public.partner_report_template_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "partner_members_select_own" ON public.partner_taxonomy_assignments;
CREATE POLICY "partner_members_select_own" ON public.partner_taxonomy_assignments
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((partner_id IN ( SELECT pm.partner_id
   FROM partner_memberships pm
  WHERE ((pm.profile_id = (select auth.uid())) AND (pm.revoked_at IS NULL)))));

DROP POLICY "platform_admins_full_access" ON public.partner_taxonomy_assignments;
CREATE POLICY "platform_admins_full_access" ON public.partner_taxonomy_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'platform_admin'::user_role)))));

DROP POLICY "profiles_select_org" ON public.profiles;
CREATE POLICY "profiles_select_org" ON public.profiles
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((is_platform_admin() OR (id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.profile_id = profiles.id) AND (cm.revoked_at IS NULL) AND (cm.client_id = ANY (auth_user_client_ids()))))) OR (EXISTS ( SELECT 1
   FROM partner_memberships pm
  WHERE ((pm.profile_id = profiles.id) AND (pm.revoked_at IS NULL) AND (pm.partner_id = ANY (auth_user_partner_ids())))))));

DROP POLICY "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  AS PERMISSIVE FOR SELECT
  TO public
  USING ((id = (select auth.uid())));

DROP POLICY "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  AS PERMISSIVE FOR UPDATE
  TO public
  USING ((id = (select auth.uid())))
  WITH CHECK (((id = (select auth.uid())) AND (role = ( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = (select auth.uid()))))));

DROP POLICY "report_snapshots_participant_select" ON public.report_snapshots;
CREATE POLICY "report_snapshots_participant_select" ON public.report_snapshots
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (((audience_type = 'participant'::report_audience_type) AND (released_at IS NOT NULL) AND (participant_session_id IN ( SELECT ps.id
   FROM participant_sessions ps
  WHERE (ps.participant_profile_id = (select auth.uid()))))));

DROP POLICY "report_templates_insert" ON public.report_templates;
CREATE POLICY "report_templates_insert" ON public.report_templates
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((partner_id IN ( SELECT pm.partner_id
   FROM partner_memberships pm
  WHERE ((pm.profile_id = (select auth.uid())) AND (pm.role = 'admin'::text)))));

DROP POLICY "report_templates_update" ON public.report_templates;
CREATE POLICY "report_templates_update" ON public.report_templates
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((partner_id IN ( SELECT pm.partner_id
   FROM partner_memberships pm
  WHERE ((pm.profile_id = (select auth.uid())) AND (pm.role = 'admin'::text)))));

DROP POLICY "response_formats_select_authenticated" ON public.response_formats;
CREATE POLICY "response_formats_select_authenticated" ON public.response_formats
  AS PERMISSIVE FOR SELECT
  TO public
  USING (((select auth.uid()) IS NOT NULL));

DROP POLICY "support_sessions_select" ON public.support_sessions;
CREATE POLICY "support_sessions_select" ON public.support_sessions
  AS PERMISSIVE FOR SELECT
  TO public
  USING ((is_platform_admin() OR (actor_profile_id = (select auth.uid()))));

COMMIT;
