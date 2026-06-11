-- Merge same-role, same-action permissive RLS policies.
--
-- Postgres ORs permissive policies together but evaluates each one per
-- query; the Supabase advisor flags this as multiple_permissive_policies.
-- OR-merging policies with identical role arrays and commands is exactly
-- equivalent (USING clauses OR at the row stage, WITH CHECK clauses OR at
-- the write stage). Cross-role-array overlaps ({public} vs {authenticated})
-- are deliberately NOT merged here - that changes which roles a policy
-- nominally targets and needs per-qual anon reasoning.

-- assessments / ALL / to public: merge assessments_all_platform_admin, assessments_manage_org_admin
drop policy if exists "assessments_all_platform_admin" on public.assessments;
drop policy if exists "assessments_manage_org_admin" on public.assessments;
create policy "assessments_all_public_merged" on public.assessments
  as permissive for all to public
  using (
    (is_platform_admin())
    OR (((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id())))
  )
  with check (
    (is_platform_admin())
    OR (((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id())))
  );

-- brand_configs / SELECT / to authenticated: merge brand_configs_client_read, brand_configs_default_read
drop policy if exists "brand_configs_client_read" on public.brand_configs;
drop policy if exists "brand_configs_default_read" on public.brand_configs;
create policy "brand_configs_select_authenticated_merged" on public.brand_configs
  as permissive for select to authenticated
  using (
    ((((owner_type = 'platform'::brand_owner_type) AND (is_default = true)) OR ((owner_type = 'client'::brand_owner_type) AND (owner_id IS NOT NULL) AND (owner_id = ANY (auth_user_client_ids())))))
    OR (((owner_type = 'platform'::brand_owner_type) AND (is_default = true)))
  );

-- clients / SELECT / to authenticated: merge clients_select_own, clients_select_partner
drop policy if exists "clients_select_own" on public.clients;
drop policy if exists "clients_select_partner" on public.clients;
create policy "clients_select_authenticated_merged" on public.clients
  as permissive for select to authenticated
  using (
    ((id = ANY (auth_user_client_ids())))
    OR (((partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_ids()))))
  );

-- comparisons / SELECT / to public: merge comparisons_owner_select, comparisons_team_client_select, comparisons_team_partner_select, comparisons_team_platform_select
drop policy if exists "comparisons_owner_select" on public.comparisons;
drop policy if exists "comparisons_team_client_select" on public.comparisons;
drop policy if exists "comparisons_team_partner_select" on public.comparisons;
drop policy if exists "comparisons_team_platform_select" on public.comparisons;
create policy "comparisons_select_public_merged" on public.comparisons
  as permissive for select to public
  using (
    ((owner_id = ( SELECT auth.uid() AS uid)))
    OR (((share_scope = 'team'::text) AND (client_id IS NOT NULL) AND (client_id = ANY (auth_user_client_ids()))))
    OR (((share_scope = 'team'::text) AND (partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_ids()))))
    OR (((share_scope = 'team'::text) AND (client_id IS NULL) AND (partner_id IS NULL) AND is_platform_admin()))
  );

-- comparisons / UPDATE / to public: merge comparisons_owner_update, comparisons_team_client_update, comparisons_team_partner_update, comparisons_team_platform_update
drop policy if exists "comparisons_owner_update" on public.comparisons;
drop policy if exists "comparisons_team_client_update" on public.comparisons;
drop policy if exists "comparisons_team_partner_update" on public.comparisons;
drop policy if exists "comparisons_team_platform_update" on public.comparisons;
create policy "comparisons_update_public_merged" on public.comparisons
  as permissive for update to public
  using (
    ((owner_id = ( SELECT auth.uid() AS uid)))
    OR (((share_scope = 'team'::text) AND (client_id IS NOT NULL) AND (client_id = ANY (auth_user_client_ids()))))
    OR (((share_scope = 'team'::text) AND (partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_ids()))))
    OR (((share_scope = 'team'::text) AND (client_id IS NULL) AND (partner_id IS NULL) AND is_platform_admin()))
  )
  with check (
    ((owner_id = ( SELECT auth.uid() AS uid)))
    OR (((share_scope = 'team'::text) AND (client_id IS NOT NULL) AND (client_id = ANY (auth_user_client_ids()))))
    OR (((share_scope = 'team'::text) AND (partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_ids()))))
    OR (((share_scope = 'team'::text) AND (client_id IS NULL) AND (partner_id IS NULL) AND is_platform_admin()))
  );

-- diagnostic_respondents / ALL / to public: merge diagnostic_respondents_all_platform_admin, diagnostic_respondents_manage
drop policy if exists "diagnostic_respondents_all_platform_admin" on public.diagnostic_respondents;
drop policy if exists "diagnostic_respondents_manage" on public.diagnostic_respondents;
create policy "diagnostic_respondents_all_public_merged" on public.diagnostic_respondents
  as permissive for all to public
  using (
    (is_platform_admin())
    OR (((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id())))))))))
  )
  with check (
    (is_platform_admin())
    OR (((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id())))))))))
  );

-- diagnostic_sessions / ALL / to public: merge diagnostic_sessions_all_platform_admin, diagnostic_sessions_manage_org
drop policy if exists "diagnostic_sessions_all_platform_admin" on public.diagnostic_sessions;
drop policy if exists "diagnostic_sessions_manage_org" on public.diagnostic_sessions;
create policy "diagnostic_sessions_all_public_merged" on public.diagnostic_sessions
  as permissive for all to public
  using (
    (is_platform_admin())
    OR (((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id()))))))
  )
  with check (
    (is_platform_admin())
    OR (((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id()))))))
  );

-- email_templates / DELETE / to authenticated: merge email_templates_client_admin_delete, email_templates_partner_admin_delete
drop policy if exists "email_templates_client_admin_delete" on public.email_templates;
drop policy if exists "email_templates_partner_admin_delete" on public.email_templates;
create policy "email_templates_delete_authenticated_merged" on public.email_templates
  as permissive for delete to authenticated
  using (
    (((scope_type = 'client'::email_template_scope) AND (scope_id = ANY (auth_user_client_admin_ids()))))
    OR (((scope_type = 'partner'::email_template_scope) AND (scope_id = ANY (auth_user_partner_admin_ids()))))
  );

-- email_templates / INSERT / to authenticated: merge email_templates_client_admin_insert, email_templates_partner_admin_insert
drop policy if exists "email_templates_client_admin_insert" on public.email_templates;
drop policy if exists "email_templates_partner_admin_insert" on public.email_templates;
create policy "email_templates_insert_authenticated_merged" on public.email_templates
  as permissive for insert to authenticated
  with check (
    (((scope_type = 'client'::email_template_scope) AND (scope_id = ANY (auth_user_client_admin_ids()))))
    OR (((scope_type = 'partner'::email_template_scope) AND (scope_id = ANY (auth_user_partner_admin_ids()))))
  );

-- email_templates / SELECT / to authenticated: merge email_templates_client_admin_select, email_templates_partner_admin_select
drop policy if exists "email_templates_client_admin_select" on public.email_templates;
drop policy if exists "email_templates_partner_admin_select" on public.email_templates;
create policy "email_templates_select_authenticated_merged" on public.email_templates
  as permissive for select to authenticated
  using (
    ((((scope_type = 'platform'::email_template_scope) AND (scope_id IS NULL)) OR ((scope_type = 'client'::email_template_scope) AND (scope_id = ANY (auth_user_client_admin_ids())))))
    OR ((((scope_type = 'platform'::email_template_scope) AND (scope_id IS NULL)) OR ((scope_type = 'partner'::email_template_scope) AND (scope_id = ANY (auth_user_partner_admin_ids())))))
  );

-- email_templates / UPDATE / to authenticated: merge email_templates_client_admin_update, email_templates_partner_admin_update
drop policy if exists "email_templates_client_admin_update" on public.email_templates;
drop policy if exists "email_templates_partner_admin_update" on public.email_templates;
create policy "email_templates_update_authenticated_merged" on public.email_templates
  as permissive for update to authenticated
  using (
    (((scope_type = 'client'::email_template_scope) AND (scope_id = ANY (auth_user_client_admin_ids()))))
    OR (((scope_type = 'partner'::email_template_scope) AND (scope_id = ANY (auth_user_partner_admin_ids()))))
  )
  with check (
    (((scope_type = 'client'::email_template_scope) AND (scope_id = ANY (auth_user_client_admin_ids()))))
    OR (((scope_type = 'partner'::email_template_scope) AND (scope_id = ANY (auth_user_partner_admin_ids()))))
  );

-- experience_templates / SELECT / to authenticated: merge experience_templates_campaign_read, experience_templates_default_read
drop policy if exists "experience_templates_campaign_read" on public.experience_templates;
drop policy if exists "experience_templates_default_read" on public.experience_templates;
create policy "experience_templates_select_authenticated_merged" on public.experience_templates
  as permissive for select to authenticated
  using (
    ((((owner_type = 'platform'::text) AND (owner_id IS NULL)) OR ((owner_type = 'campaign'::text) AND (owner_id IN ( SELECT c.id
   FROM campaigns c
  WHERE (c.client_id = ANY (auth_user_client_ids())))))))
    OR (((owner_type = 'platform'::text) AND (owner_id IS NULL)))
  );

-- matching_runs / ALL / to public: merge matching_runs_all_platform_admin, matching_runs_manage
drop policy if exists "matching_runs_all_platform_admin" on public.matching_runs;
drop policy if exists "matching_runs_manage" on public.matching_runs;
create policy "matching_runs_all_public_merged" on public.matching_runs
  as permissive for all to public
  using (
    (is_platform_admin())
    OR (((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id()))))))
  )
  with check (
    (is_platform_admin())
    OR (((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id()))))))
  );

-- profiles / SELECT / to authenticated: merge profiles_select_org, profiles_select_partner
drop policy if exists "profiles_select_org" on public.profiles;
drop policy if exists "profiles_select_partner" on public.profiles;
create policy "profiles_select_authenticated_merged" on public.profiles
  as permissive for select to authenticated
  using (
    ((is_platform_admin() OR (id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.profile_id = profiles.id) AND (cm.revoked_at IS NULL) AND (cm.client_id = ANY (auth_user_client_ids()))))) OR (EXISTS ( SELECT 1
   FROM partner_memberships pm
  WHERE ((pm.profile_id = profiles.id) AND (pm.revoked_at IS NULL) AND (pm.partner_id = ANY (auth_user_partner_ids())))))))
    OR (((EXISTS ( SELECT 1
   FROM partner_memberships pm
  WHERE ((pm.profile_id = profiles.id) AND (pm.revoked_at IS NULL) AND (pm.partner_id = ANY (auth_user_partner_ids()))))) OR (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.profile_id = profiles.id) AND (cm.revoked_at IS NULL) AND (cm.client_id = ANY (auth_user_client_ids())))))))
  );

-- profiles / SELECT / to public: merge profiles_select_own, profiles_select_platform_admin
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_platform_admin" on public.profiles;
create policy "profiles_select_public_merged" on public.profiles
  as permissive for select to public
  using (
    ((id = ( SELECT auth.uid() AS uid)))
    OR (is_platform_admin())
  );

-- report_snapshots / SELECT / to authenticated: merge report_snapshots_consultant_select, report_snapshots_hr_manager_select, report_snapshots_participant_select, report_snapshots_platform_admin_select
drop policy if exists "report_snapshots_consultant_select" on public.report_snapshots;
drop policy if exists "report_snapshots_hr_manager_select" on public.report_snapshots;
drop policy if exists "report_snapshots_participant_select" on public.report_snapshots;
drop policy if exists "report_snapshots_platform_admin_select" on public.report_snapshots;
create policy "report_snapshots_select_authenticated_merged" on public.report_snapshots
  as permissive for select to authenticated
  using (
    (((audience_type = 'consultant'::report_audience_type) AND (released_at IS NOT NULL) AND (campaign_id IN ( SELECT c.id
   FROM campaigns c
  WHERE (c.partner_id = ANY (auth_user_partner_ids()))))))
    OR (((audience_type = 'hr_manager'::report_audience_type) AND (released_at IS NOT NULL) AND (campaign_id IN ( SELECT c.id
   FROM campaigns c
  WHERE (c.client_id = ANY (auth_user_client_ids()))))))
    OR (((audience_type = 'participant'::report_audience_type) AND (released_at IS NOT NULL) AND (participant_session_id IN ( SELECT ps.id
   FROM participant_sessions ps
  WHERE (ps.participant_profile_id = ( SELECT auth.uid() AS uid))))))
    OR (is_platform_admin())
  );


-- ---------------------------------------------------------------------------
-- auth_rls_initplan: generation_presets_admin_all re-evaluated auth.uid() per
-- row. Wrap in a scalar subquery so the planner runs it once per statement.
-- ---------------------------------------------------------------------------
drop policy if exists "generation_presets_admin_all" on public.generation_presets;
create policy "generation_presets_admin_all" on public.generation_presets
  as permissive for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'platform_admin'::user_role
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'platform_admin'::user_role
    )
  );

-- ---------------------------------------------------------------------------
-- Unindexed foreign keys (advisor: unindexed_foreign_keys). Cheap inserts,
-- and joins/cascades on these columns stop seq-scanning as data grows.
-- ---------------------------------------------------------------------------
create index if not exists idx_campaign_360_snapshots_generated_by on public.campaign_360_snapshots (generated_by);
create index if not exists idx_campaign_raters_approved_by on public.campaign_raters (approved_by);
create index if not exists idx_campaign_raters_nominated_by on public.campaign_raters (nominated_by);
create index if not exists idx_error_events_actor_profile_id on public.error_events (actor_profile_id);
create index if not exists idx_factors_reviewed_by on public.factors (reviewed_by);
create index if not exists idx_generation_presets_created_by on public.generation_presets (created_by);
create index if not exists idx_generation_presets_response_format_id on public.generation_presets (response_format_id);
create index if not exists idx_person_link_audit_performed_by on public.person_link_audit (performed_by);
