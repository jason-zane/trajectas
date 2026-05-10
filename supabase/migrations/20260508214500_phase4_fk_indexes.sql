-- Phase 4.7b — add B-tree indexes covering 38 foreign keys flagged by
-- Supabase advisor 0001_unindexed_foreign_keys. Without these,
-- DELETE/UPDATE on the parent tables performs a sequential scan of
-- the child table to enforce ON DELETE/UPDATE actions, which is slow
-- on larger tables.
--
-- Verified each (table, column) against pg_constraint before applying;
-- in particular norm_groups.client_id (the FK constraint name is
-- 'norm_groups_organization_id_fkey' from before the rename) and
-- participant_sessions.current_section_id (constraint name kept as
-- 'candidate_sessions_current_section_id_fkey').

CREATE INDEX IF NOT EXISTS idx_audit_events_support_session_id ON public.audit_events (support_session_id);
CREATE INDEX IF NOT EXISTS idx_campaign_assessment_constructs_construct_id ON public.campaign_assessment_constructs (construct_id);
CREATE INDEX IF NOT EXISTS idx_campaign_assessment_factors_factor_id ON public.campaign_assessment_factors (factor_id);
CREATE INDEX IF NOT EXISTS idx_campaign_favorites_campaign_id ON public.campaign_favorites (campaign_id);
CREATE INDEX IF NOT EXISTS idx_client_assessment_assignments_assessment_id ON public.client_assessment_assignments (assessment_id);
CREATE INDEX IF NOT EXISTS idx_client_assessment_assignments_assigned_by ON public.client_assessment_assignments (assigned_by);
CREATE INDEX IF NOT EXISTS idx_client_memberships_created_by ON public.client_memberships (created_by);
CREATE INDEX IF NOT EXISTS idx_client_memberships_revoked_by_profile_id ON public.client_memberships (revoked_by_profile_id);
CREATE INDEX IF NOT EXISTS idx_client_report_template_assignments_assigned_by ON public.client_report_template_assignments (assigned_by);
CREATE INDEX IF NOT EXISTS idx_crta_report_template_id ON public.client_report_template_assignments (report_template_id);
CREATE INDEX IF NOT EXISTS idx_client_roles_created_by ON public.client_roles (created_by);
CREATE INDEX IF NOT EXISTS idx_diagnostic_dimension_weights_dimension_id ON public.diagnostic_dimension_weights (dimension_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_updated_by ON public.email_templates (updated_by);
CREATE INDEX IF NOT EXISTS idx_generated_items_saved_item_id ON public.generated_items (saved_item_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_created_by ON public.integration_connections (created_by);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_created_by ON public.integration_credentials (created_by);
CREATE INDEX IF NOT EXISTS idx_integration_external_refs_campaign_id ON public.integration_external_refs (campaign_id);
CREATE INDEX IF NOT EXISTS idx_integration_external_refs_client_id ON public.integration_external_refs (client_id);
CREATE INDEX IF NOT EXISTS idx_integration_launches_campaign_id ON public.integration_launches (campaign_id);
CREATE INDEX IF NOT EXISTS idx_integration_launches_connection_id ON public.integration_launches (integration_connection_id);
CREATE INDEX IF NOT EXISTS idx_integration_launches_credential_id ON public.integration_launches (integration_credential_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_endpoints_created_by ON public.integration_webhook_endpoints (created_by);
CREATE INDEX IF NOT EXISTS idx_matching_runs_ai_model_config_id ON public.matching_runs (ai_model_config_id);
CREATE INDEX IF NOT EXISTS idx_matching_runs_system_prompt_id ON public.matching_runs (system_prompt_id);
CREATE INDEX IF NOT EXISTS idx_norm_groups_client_id ON public.norm_groups (client_id);
CREATE INDEX IF NOT EXISTS idx_org_diagnostic_campaigns_created_by ON public.org_diagnostic_campaigns (created_by);
CREATE INDEX IF NOT EXISTS idx_odc_pinned_baseline_snapshot_id ON public.org_diagnostic_campaigns (pinned_baseline_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_org_diagnostic_profiles_generated_by ON public.org_diagnostic_profiles (generated_by);
CREATE INDEX IF NOT EXISTS idx_participant_sessions_current_section_id ON public.participant_sessions (current_section_id);
CREATE INDEX IF NOT EXISTS idx_partner_assessment_assignments_assessment_id ON public.partner_assessment_assignments (assessment_id);
CREATE INDEX IF NOT EXISTS idx_partner_assessment_assignments_assigned_by ON public.partner_assessment_assignments (assigned_by);
CREATE INDEX IF NOT EXISTS idx_partner_memberships_created_by ON public.partner_memberships (created_by);
CREATE INDEX IF NOT EXISTS idx_partner_memberships_revoked_by_profile_id ON public.partner_memberships (revoked_by_profile_id);
CREATE INDEX IF NOT EXISTS idx_prta_assigned_by ON public.partner_report_template_assignments (assigned_by);
CREATE INDEX IF NOT EXISTS idx_prta_report_template_id ON public.partner_report_template_assignments (report_template_id);
CREATE INDEX IF NOT EXISTS idx_partner_taxonomy_assignments_assigned_by ON public.partner_taxonomy_assignments (assigned_by);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_released_by ON public.report_snapshots (released_by);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_template_id ON public.report_snapshots (template_id);
