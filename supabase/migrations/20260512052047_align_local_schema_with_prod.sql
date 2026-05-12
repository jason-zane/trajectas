-- Reconciliation migration: align local schema with prod after the
-- 2026-05-08 phase4 hardening work was applied to prod out-of-band
-- via MCP/psql. The actual DDL from those sessions wasn't captured
-- back to SQL files (see stub migrations 20260508214400,
-- 20260508214500, 20260508214600). This migration brings local in
-- sync by:
--   1. Dropping stale-named indexes left behind by older rename
--      migrations that renamed tables/columns but never renamed the
--      backing indexes.
--   2. Creating the prod-named indexes that the renames + phase4
--      work introduced.
--
-- All statements are idempotent (IF EXISTS / IF NOT EXISTS) so
-- re-applying to prod is a no-op except for the migration record.

-- 1. Drop stale-named indexes (renamed on prod, never renamed locally).
DROP INDEX IF EXISTS public.idx_assessment_competencies_assessment;
DROP INDEX IF EXISTS public.idx_assessment_competencies_competency;
DROP INDEX IF EXISTS public.idx_assessments_creation_mode;
DROP INDEX IF EXISTS public.idx_assessments_organization_id;
DROP INDEX IF EXISTS public.idx_audit_events_client_created;
DROP INDEX IF EXISTS public.idx_campaign_candidates_campaign;
DROP INDEX IF EXISTS public.idx_campaign_candidates_email;
DROP INDEX IF EXISTS public.idx_campaign_candidates_status;
DROP INDEX IF EXISTS public.idx_campaign_candidates_token;
DROP INDEX IF EXISTS public.idx_campaigns_org;
DROP INDEX IF EXISTS public.idx_candidate_responses_item;
DROP INDEX IF EXISTS public.idx_candidate_responses_section;
DROP INDEX IF EXISTS public.idx_candidate_responses_session;
DROP INDEX IF EXISTS public.idx_candidate_scores_competency;
DROP INDEX IF EXISTS public.idx_candidate_scores_session;
DROP INDEX IF EXISTS public.idx_candidate_sessions_assessment;
DROP INDEX IF EXISTS public.idx_candidate_sessions_campaign;
DROP INDEX IF EXISTS public.idx_candidate_sessions_campaign_candidate;
DROP INDEX IF EXISTS public.idx_candidate_sessions_candidate;
DROP INDEX IF EXISTS public.idx_candidate_sessions_org;
DROP INDEX IF EXISTS public.idx_candidate_sessions_status;
DROP INDEX IF EXISTS public.idx_client_assessment_assignments_org;
DROP INDEX IF EXISTS public.idx_client_memberships_client;
DROP INDEX IF EXISTS public.idx_client_report_template_assignments_org;
DROP INDEX IF EXISTS public.idx_competencies_active;
DROP INDEX IF EXISTS public.idx_competencies_dimension;
DROP INDEX IF EXISTS public.idx_competencies_partner;
DROP INDEX IF EXISTS public.idx_competency_traits_competency;
DROP INDEX IF EXISTS public.idx_competency_traits_trait;
DROP INDEX IF EXISTS public.idx_diag_comp_hints_competency;
DROP INDEX IF EXISTS public.idx_diag_comp_hints_dimension;
DROP INDEX IF EXISTS public.idx_diagnostic_sessions_org;
DROP INDEX IF EXISTS public.idx_diagnostic_snapshots_org;
DROP INDEX IF EXISTS public.idx_factors_organization;
DROP INDEX IF EXISTS public.idx_item_media_item;
DROP INDEX IF EXISTS public.idx_item_scoring_rubrics_item;
DROP INDEX IF EXISTS public.idx_item_scoring_rubrics_option;
DROP INDEX IF EXISTS public.idx_item_selection_rules_assessment;
DROP INDEX IF EXISTS public.idx_items_competency_id;
DROP INDEX IF EXISTS public.idx_items_trait;
DROP INDEX IF EXISTS public.idx_matching_results_competency;
DROP INDEX IF EXISTS public.idx_matching_runs_org;
DROP INDEX IF EXISTS public.idx_organizations_active;
DROP INDEX IF EXISTS public.idx_organizations_not_deleted;
DROP INDEX IF EXISTS public.idx_organizations_partner_id;
DROP INDEX IF EXISTS public.idx_profiles_organization_id;
DROP INDEX IF EXISTS public.idx_support_sessions_client;
DROP INDEX IF EXISTS public.idx_traits_active;
DROP INDEX IF EXISTS public.idx_traits_partner;

-- 2. Create the prod-named indexes (covers both rename targets and
-- the FK indexes added by 20260508214500_phase4_fk_indexes stub).
CREATE INDEX IF NOT EXISTS idx_assessment_factors_assessment ON public.assessment_factors USING btree (assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_factors_factor ON public.assessment_factors USING btree (factor_id);
CREATE INDEX IF NOT EXISTS idx_assessments_client_id ON public.assessments USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audit_events_client_id_created ON public.audit_events USING btree (client_id, created_at DESC) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_campaign_favorites_profile ON public.campaign_favorites USING btree (profile_id);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_campaign ON public.campaign_participants USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_email ON public.campaign_participants USING btree (email);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_status ON public.campaign_participants USING btree (status);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_token ON public.campaign_participants USING btree (access_token);
CREATE INDEX IF NOT EXISTS idx_campaigns_client ON public.campaigns USING btree (client_id) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_client_assessment_assignments_client ON public.client_assessment_assignments USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_client_id ON public.client_memberships USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_client_report_template_assignments_client ON public.client_report_template_assignments USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_clients_active ON public.clients USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_clients_not_deleted ON public.clients USING btree (deleted_at) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_clients_partner_id ON public.clients USING btree (partner_id) WHERE (partner_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_constructs_active ON public.constructs USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_constructs_partner ON public.constructs USING btree (partner_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_client ON public.diagnostic_sessions USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_snapshots_client ON public.diagnostic_snapshots USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_factor_constructs_construct ON public.factor_constructs USING btree (construct_id);
CREATE INDEX IF NOT EXISTS idx_factor_constructs_factor ON public.factor_constructs USING btree (factor_id);
CREATE INDEX IF NOT EXISTS idx_factors_active ON public.factors USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_factors_client ON public.factors USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_factors_dimension ON public.factors USING btree (dimension_id);
CREATE INDEX IF NOT EXISTS idx_factors_partner ON public.factors USING btree (partner_id);
CREATE INDEX IF NOT EXISTS idx_items_construct ON public.items USING btree (construct_id);
CREATE INDEX IF NOT EXISTS idx_matching_results_factor ON public.matching_results USING btree (factor_id);
CREATE INDEX IF NOT EXISTS idx_matching_runs_client ON public.matching_runs USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_participant_responses_item ON public.participant_responses USING btree (item_id);
CREATE INDEX IF NOT EXISTS idx_participant_responses_section ON public.participant_responses USING btree (section_id);
CREATE INDEX IF NOT EXISTS idx_participant_responses_session ON public.participant_responses USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_participant_scores_factor ON public.participant_scores USING btree (factor_id);
CREATE INDEX IF NOT EXISTS idx_participant_scores_session ON public.participant_scores USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_participant_sessions_assessment ON public.participant_sessions USING btree (assessment_id);
CREATE INDEX IF NOT EXISTS idx_participant_sessions_campaign ON public.participant_sessions USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_participant_sessions_campaign_participant ON public.participant_sessions USING btree (campaign_participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_sessions_client ON public.participant_sessions USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_participant_sessions_participant ON public.participant_sessions USING btree (participant_profile_id);
CREATE INDEX IF NOT EXISTS idx_participant_sessions_status ON public.participant_sessions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles USING btree (client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_support_sessions_client_id ON public.support_sessions USING btree (client_id) WHERE (client_id IS NOT NULL);
