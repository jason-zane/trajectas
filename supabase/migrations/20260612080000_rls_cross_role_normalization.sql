-- Normalize permissive RLS policies to one policy per (role, action).
--
-- Remaining multiple_permissive_policies advisor warnings come from
-- {public} policies overlapping {anon}/{authenticated} ones: public
-- applies to every role, so an authenticated query evaluated several
-- policies. Transform, per table that has any such overlap: drop every
-- permissive policy targeting the API roles and re-emit exactly one
-- policy per (role, action) whose USING/WITH CHECK is the OR of the
-- dropped policies visible to that role+action. Permissive policies OR
-- independently at the USING and WITH CHECK stages, so API-role
-- semantics are preserved exactly - including anon clauses that can
-- never pass (e.g. is_platform_admin()), which are re-emitted rather
-- than reasoned away. service_role policies and RESTRICTIVE policies
-- are untouched.

-- ai_model_configs: fold 2 policies into per-role-per-action form
drop policy if exists "ai_model_configs_all_platform_admin" on public.ai_model_configs;
drop policy if exists "ai_model_configs_select" on public.ai_model_configs;
create policy "ai_model_configs_select_anon" on public.ai_model_configs
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR ((auth_user_role() = ANY (ARRAY['platform_admin'::user_role, 'partner_admin'::user_role, 'org_admin'::user_role, 'consultant'::user_role])))
  );
create policy "ai_model_configs_select_authenticated" on public.ai_model_configs
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((auth_user_role() = ANY (ARRAY['platform_admin'::user_role, 'partner_admin'::user_role, 'org_admin'::user_role, 'consultant'::user_role])))
  );
create policy "ai_model_configs_insert_anon" on public.ai_model_configs
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "ai_model_configs_insert_authenticated" on public.ai_model_configs
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "ai_model_configs_update_anon" on public.ai_model_configs
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "ai_model_configs_update_authenticated" on public.ai_model_configs
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "ai_model_configs_delete_anon" on public.ai_model_configs
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "ai_model_configs_delete_authenticated" on public.ai_model_configs
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- ai_providers: fold 2 policies into per-role-per-action form
drop policy if exists "ai_providers_all_platform_admin" on public.ai_providers;
drop policy if exists "ai_providers_select" on public.ai_providers;
create policy "ai_providers_select_anon" on public.ai_providers
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR ((auth_user_role() = ANY (ARRAY['platform_admin'::user_role, 'partner_admin'::user_role, 'org_admin'::user_role, 'consultant'::user_role])))
  );
create policy "ai_providers_select_authenticated" on public.ai_providers
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((auth_user_role() = ANY (ARRAY['platform_admin'::user_role, 'partner_admin'::user_role, 'org_admin'::user_role, 'consultant'::user_role])))
  );
create policy "ai_providers_insert_anon" on public.ai_providers
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "ai_providers_insert_authenticated" on public.ai_providers
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "ai_providers_update_anon" on public.ai_providers
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "ai_providers_update_authenticated" on public.ai_providers
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "ai_providers_delete_anon" on public.ai_providers
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "ai_providers_delete_authenticated" on public.ai_providers
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- ai_system_prompts: fold 2 policies into per-role-per-action form
drop policy if exists "ai_system_prompts_all_platform_admin" on public.ai_system_prompts;
drop policy if exists "ai_system_prompts_select" on public.ai_system_prompts;
create policy "ai_system_prompts_select_anon" on public.ai_system_prompts
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR ((auth_user_role() = ANY (ARRAY['platform_admin'::user_role, 'partner_admin'::user_role, 'org_admin'::user_role, 'consultant'::user_role])))
  );
create policy "ai_system_prompts_select_authenticated" on public.ai_system_prompts
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((auth_user_role() = ANY (ARRAY['platform_admin'::user_role, 'partner_admin'::user_role, 'org_admin'::user_role, 'consultant'::user_role])))
  );
create policy "ai_system_prompts_insert_anon" on public.ai_system_prompts
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "ai_system_prompts_insert_authenticated" on public.ai_system_prompts
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "ai_system_prompts_update_anon" on public.ai_system_prompts
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "ai_system_prompts_update_authenticated" on public.ai_system_prompts
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "ai_system_prompts_delete_anon" on public.ai_system_prompts
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "ai_system_prompts_delete_authenticated" on public.ai_system_prompts
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- anchor_presets: fold 2 policies into per-role-per-action form
drop policy if exists "anchor_presets_all_platform_admin" on public.anchor_presets;
drop policy if exists "anchor_presets_select" on public.anchor_presets;
create policy "anchor_presets_select_anon" on public.anchor_presets
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR (true)
  );
create policy "anchor_presets_select_authenticated" on public.anchor_presets
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR (true)
  );
create policy "anchor_presets_insert_anon" on public.anchor_presets
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "anchor_presets_insert_authenticated" on public.anchor_presets
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "anchor_presets_update_anon" on public.anchor_presets
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "anchor_presets_update_authenticated" on public.anchor_presets
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "anchor_presets_delete_anon" on public.anchor_presets
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "anchor_presets_delete_authenticated" on public.anchor_presets
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- assessment_factors: fold 2 policies into per-role-per-action form
drop policy if exists "assessment_factors_all_platform_admin" on public.assessment_factors;
drop policy if exists "assessment_factors_select" on public.assessment_factors;
create policy "assessment_factors_select_anon" on public.assessment_factors
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR (true)
  );
create policy "assessment_factors_select_authenticated" on public.assessment_factors
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR (true)
  );
create policy "assessment_factors_insert_anon" on public.assessment_factors
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "assessment_factors_insert_authenticated" on public.assessment_factors
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "assessment_factors_update_anon" on public.assessment_factors
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "assessment_factors_update_authenticated" on public.assessment_factors
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "assessment_factors_delete_anon" on public.assessment_factors
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "assessment_factors_delete_authenticated" on public.assessment_factors
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- assessments: fold 3 policies into per-role-per-action form
drop policy if exists "assessments_all_public_merged" on public.assessments;
drop policy if exists "assessments_partner_admin_manage" on public.assessments;
drop policy if exists "assessments_select_all" on public.assessments;
create policy "assessments_select_anon" on public.assessments
  as permissive for select to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id()))))
  );
create policy "assessments_select_authenticated" on public.assessments
  as permissive for select to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id()))))
    OR (((partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_admin_ids()))))
    OR ((is_platform_admin() OR ((partner_id IS NULL) AND (client_id IS NULL)) OR (partner_id = ANY (auth_user_partner_ids())) OR (client_id = ANY (auth_user_client_ids()))))
  );
create policy "assessments_insert_anon" on public.assessments
  as permissive for insert to anon
  with check (
    ((is_platform_admin() OR ((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id()))))
  );
create policy "assessments_insert_authenticated" on public.assessments
  as permissive for insert to authenticated
  with check (
    ((is_platform_admin() OR ((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id()))))
    OR (((partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_admin_ids()))))
  );
create policy "assessments_update_anon" on public.assessments
  as permissive for update to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id()))))
  )
  with check (
    ((is_platform_admin() OR ((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id()))))
  );
create policy "assessments_update_authenticated" on public.assessments
  as permissive for update to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id()))))
    OR (((partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_admin_ids()))))
  )
  with check (
    ((is_platform_admin() OR ((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id()))))
    OR (((partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_admin_ids()))))
  );
create policy "assessments_delete_anon" on public.assessments
  as permissive for delete to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id()))))
  );
create policy "assessments_delete_authenticated" on public.assessments
  as permissive for delete to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = 'org_admin'::user_role) AND (client_id = auth_user_client_id()))))
    OR (((partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_admin_ids()))))
  );

-- brand_configs: fold 4 policies into per-role-per-action form
drop policy if exists "brand_configs_admin_all" on public.brand_configs;
drop policy if exists "brand_configs_anon_read" on public.brand_configs;
drop policy if exists "brand_configs_client_update" on public.brand_configs;
drop policy if exists "brand_configs_select_authenticated_merged" on public.brand_configs;
create policy "brand_configs_select_anon" on public.brand_configs
  as permissive for select to anon
  using (
    ((((owner_type = 'platform'::brand_owner_type) AND (is_default = true)) OR (owner_type = 'client'::brand_owner_type) OR (owner_type = 'campaign'::brand_owner_type)))
  );
create policy "brand_configs_select_authenticated" on public.brand_configs
  as permissive for select to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
    OR ((((owner_type = 'platform'::brand_owner_type) AND (is_default = true)) OR ((owner_type = 'client'::brand_owner_type) AND (owner_id IS NOT NULL) AND (owner_id = ANY (auth_user_client_ids()))) OR ((owner_type = 'platform'::brand_owner_type) AND (is_default = true))))
  );
create policy "brand_configs_insert_authenticated" on public.brand_configs
  as permissive for insert to authenticated
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "brand_configs_update_authenticated" on public.brand_configs
  as permissive for update to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
    OR ((is_platform_admin() OR ((owner_type = 'client'::brand_owner_type) AND (owner_id IS NOT NULL) AND (owner_id = ANY (auth_user_client_admin_ids())))))
  )
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
    OR ((is_platform_admin() OR ((owner_type = 'client'::brand_owner_type) AND (owner_id IS NOT NULL) AND (owner_id = ANY (auth_user_client_admin_ids())))))
  );
create policy "brand_configs_delete_authenticated" on public.brand_configs
  as permissive for delete to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );

-- campaign_access_links: fold 2 policies into per-role-per-action form
drop policy if exists "campaign_access_links_all_platform_admin" on public.campaign_access_links;
drop policy if exists "campaign_access_links_select" on public.campaign_access_links;
create policy "campaign_access_links_select_authenticated" on public.campaign_access_links
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM campaigns c
  WHERE ((c.id = campaign_access_links.campaign_id) AND (is_platform_admin() OR ((c.client_id IS NOT NULL) AND (c.client_id = ANY (auth_user_client_ids()))) OR ((c.partner_id IS NOT NULL) AND (c.partner_id = ANY (auth_user_partner_ids()))))))))
  );
create policy "campaign_access_links_insert_authenticated" on public.campaign_access_links
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "campaign_access_links_update_authenticated" on public.campaign_access_links
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "campaign_access_links_delete_authenticated" on public.campaign_access_links
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- campaign_assessment_factors: fold 2 policies into per-role-per-action form
drop policy if exists "campaign_assessment_factors_select" on public.campaign_assessment_factors;
drop policy if exists "platform_admins_full_access" on public.campaign_assessment_factors;
create policy "campaign_assessment_factors_select_authenticated" on public.campaign_assessment_factors
  as permissive for select to authenticated
  using (
    ((campaign_assessment_id IN ( SELECT ca.id
   FROM (campaign_assessments ca
     JOIN campaigns c ON ((c.id = ca.campaign_id)))
  WHERE ((c.client_id = auth_user_client_id()) OR (c.partner_id = auth_user_partner_id())))))
    OR (is_platform_admin())
  );
create policy "campaign_assessment_factors_insert_authenticated" on public.campaign_assessment_factors
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "campaign_assessment_factors_update_authenticated" on public.campaign_assessment_factors
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "campaign_assessment_factors_delete_authenticated" on public.campaign_assessment_factors
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- campaign_assessments: fold 2 policies into per-role-per-action form
drop policy if exists "campaign_assessments_all_platform_admin" on public.campaign_assessments;
drop policy if exists "campaign_assessments_select" on public.campaign_assessments;
create policy "campaign_assessments_select_authenticated" on public.campaign_assessments
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM campaigns c
  WHERE ((c.id = campaign_assessments.campaign_id) AND (is_platform_admin() OR ((c.client_id IS NOT NULL) AND (c.client_id = ANY (auth_user_client_ids()))) OR ((c.partner_id IS NOT NULL) AND (c.partner_id = ANY (auth_user_partner_ids()))))))))
  );
create policy "campaign_assessments_insert_authenticated" on public.campaign_assessments
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "campaign_assessments_update_authenticated" on public.campaign_assessments
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "campaign_assessments_delete_authenticated" on public.campaign_assessments
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- campaign_participants: fold 2 policies into per-role-per-action form
drop policy if exists "campaign_participants_all_platform_admin" on public.campaign_participants;
drop policy if exists "campaign_participants_select" on public.campaign_participants;
create policy "campaign_participants_select_authenticated" on public.campaign_participants
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM campaigns c
  WHERE ((c.id = campaign_participants.campaign_id) AND (is_platform_admin() OR ((c.client_id IS NOT NULL) AND (c.client_id = ANY (auth_user_client_ids()))) OR ((c.partner_id IS NOT NULL) AND (c.partner_id = ANY (auth_user_partner_ids()))))))))
  );
create policy "campaign_participants_insert_authenticated" on public.campaign_participants
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "campaign_participants_update_authenticated" on public.campaign_participants
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "campaign_participants_delete_authenticated" on public.campaign_participants
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- campaigns: fold 2 policies into per-role-per-action form
drop policy if exists "campaigns_all_platform_admin" on public.campaigns;
drop policy if exists "campaigns_select" on public.campaigns;
create policy "campaigns_select_authenticated" on public.campaigns
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((is_platform_admin() OR ((client_id IS NOT NULL) AND (client_id = ANY (auth_user_client_ids()))) OR ((partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_ids())))))
  );
create policy "campaigns_insert_authenticated" on public.campaigns
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "campaigns_update_authenticated" on public.campaigns
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "campaigns_delete_authenticated" on public.campaigns
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- client_assessment_assignments: fold 2 policies into per-role-per-action form
drop policy if exists "client_members_select_own" on public.client_assessment_assignments;
drop policy if exists "platform_admins_full_access" on public.client_assessment_assignments;
create policy "client_assessment_assignments_select_authenticated" on public.client_assessment_assignments
  as permissive for select to authenticated
  using (
    ((is_platform_admin() OR (client_id = ANY (auth_user_client_ids()))))
    OR ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "client_assessment_assignments_insert_authenticated" on public.client_assessment_assignments
  as permissive for insert to authenticated
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "client_assessment_assignments_update_authenticated" on public.client_assessment_assignments
  as permissive for update to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  )
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "client_assessment_assignments_delete_authenticated" on public.client_assessment_assignments
  as permissive for delete to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );

-- client_report_template_assignments: fold 2 policies into per-role-per-action form
drop policy if exists "client_members_select_own" on public.client_report_template_assignments;
drop policy if exists "platform_admins_full_access" on public.client_report_template_assignments;
create policy "client_report_template_assignments_select_authenticated" on public.client_report_template_assignments
  as permissive for select to authenticated
  using (
    ((is_platform_admin() OR (client_id = ANY (auth_user_client_ids()))))
    OR ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "client_report_template_assignments_insert_authenticated" on public.client_report_template_assignments
  as permissive for insert to authenticated
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "client_report_template_assignments_update_authenticated" on public.client_report_template_assignments
  as permissive for update to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  )
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "client_report_template_assignments_delete_authenticated" on public.client_report_template_assignments
  as permissive for delete to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );

-- client_roles: fold 2 policies into per-role-per-action form
drop policy if exists "client_roles_all_platform_admin" on public.client_roles;
drop policy if exists "client_roles_select_client" on public.client_roles;
create policy "client_roles_select_authenticated" on public.client_roles
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((is_platform_admin() OR (client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE ((c.partner_id = ( SELECT profiles.partner_id
           FROM profiles
          WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (c.deleted_at IS NULL))))))
  );
create policy "client_roles_insert_authenticated" on public.client_roles
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "client_roles_update_authenticated" on public.client_roles
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "client_roles_delete_authenticated" on public.client_roles
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- clients: fold 5 policies into per-role-per-action form
drop policy if exists "clients_all_platform_admin" on public.clients;
drop policy if exists "clients_insert_partner_admin" on public.clients;
drop policy if exists "clients_select_authenticated_merged" on public.clients;
drop policy if exists "clients_select_platform_admin" on public.clients;
drop policy if exists "clients_update_partner_admin" on public.clients;
create policy "clients_select_anon" on public.clients
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR (is_platform_admin())
  );
create policy "clients_select_authenticated" on public.clients
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR (((id = ANY (auth_user_client_ids())) OR ((partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_ids())))))
    OR (is_platform_admin())
  );
create policy "clients_insert_anon" on public.clients
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "clients_insert_authenticated" on public.clients
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
    OR (((partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_admin_ids()))))
  );
create policy "clients_update_anon" on public.clients
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "clients_update_authenticated" on public.clients
  as permissive for update to authenticated
  using (
    (is_platform_admin())
    OR (((partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_admin_ids()))))
  )
  with check (
    (is_platform_admin())
    OR (((partner_id IS NOT NULL) AND (partner_id = ANY (auth_user_partner_admin_ids()))))
  );
create policy "clients_delete_anon" on public.clients
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "clients_delete_authenticated" on public.clients
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- content_sources: fold 2 policies into per-role-per-action form
drop policy if exists "content_sources_admin_all" on public.content_sources;
drop policy if exists "content_sources_select_all" on public.content_sources;
create policy "content_sources_select_anon" on public.content_sources
  as permissive for select to anon
  using (
    ((is_platform_admin() OR is_partner_admin()))
    OR (true)
  );
create policy "content_sources_select_authenticated" on public.content_sources
  as permissive for select to authenticated
  using (
    ((is_platform_admin() OR is_partner_admin()))
    OR (true)
  );
create policy "content_sources_insert_anon" on public.content_sources
  as permissive for insert to anon
  with check (
    ((is_platform_admin() OR is_partner_admin()))
  );
create policy "content_sources_insert_authenticated" on public.content_sources
  as permissive for insert to authenticated
  with check (
    ((is_platform_admin() OR is_partner_admin()))
  );
create policy "content_sources_update_anon" on public.content_sources
  as permissive for update to anon
  using (
    ((is_platform_admin() OR is_partner_admin()))
  )
  with check (
    ((is_platform_admin() OR is_partner_admin()))
  );
create policy "content_sources_update_authenticated" on public.content_sources
  as permissive for update to authenticated
  using (
    ((is_platform_admin() OR is_partner_admin()))
  )
  with check (
    ((is_platform_admin() OR is_partner_admin()))
  );
create policy "content_sources_delete_anon" on public.content_sources
  as permissive for delete to anon
  using (
    ((is_platform_admin() OR is_partner_admin()))
  );
create policy "content_sources_delete_authenticated" on public.content_sources
  as permissive for delete to authenticated
  using (
    ((is_platform_admin() OR is_partner_admin()))
  );

-- diagnostic_dimension_weights: fold 2 policies into per-role-per-action form
drop policy if exists "diagnostic_dimension_weights_all_platform_admin" on public.diagnostic_dimension_weights;
drop policy if exists "diagnostic_dimension_weights_select" on public.diagnostic_dimension_weights;
create policy "diagnostic_dimension_weights_select_anon" on public.diagnostic_dimension_weights
  as permissive for select to anon
  using (
    (is_platform_admin())
  );
create policy "diagnostic_dimension_weights_select_authenticated" on public.diagnostic_dimension_weights
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_dimension_weights.session_id) AND (is_platform_admin() OR (ds.client_id = ANY (auth_user_client_ids())))))))
  );
create policy "diagnostic_dimension_weights_insert_anon" on public.diagnostic_dimension_weights
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_dimension_weights_insert_authenticated" on public.diagnostic_dimension_weights
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_dimension_weights_update_anon" on public.diagnostic_dimension_weights
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_dimension_weights_update_authenticated" on public.diagnostic_dimension_weights
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_dimension_weights_delete_anon" on public.diagnostic_dimension_weights
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "diagnostic_dimension_weights_delete_authenticated" on public.diagnostic_dimension_weights
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- diagnostic_dimensions: fold 2 policies into per-role-per-action form
drop policy if exists "diagnostic_dimensions_all_platform_admin" on public.diagnostic_dimensions;
drop policy if exists "diagnostic_dimensions_select_authenticated" on public.diagnostic_dimensions;
create policy "diagnostic_dimensions_select_anon" on public.diagnostic_dimensions
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "diagnostic_dimensions_select_authenticated" on public.diagnostic_dimensions
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "diagnostic_dimensions_insert_anon" on public.diagnostic_dimensions
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_dimensions_insert_authenticated" on public.diagnostic_dimensions
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_dimensions_update_anon" on public.diagnostic_dimensions
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_dimensions_update_authenticated" on public.diagnostic_dimensions
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_dimensions_delete_anon" on public.diagnostic_dimensions
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "diagnostic_dimensions_delete_authenticated" on public.diagnostic_dimensions
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- diagnostic_respondents: fold 2 policies into per-role-per-action form
drop policy if exists "diagnostic_respondents_all_public_merged" on public.diagnostic_respondents;
drop policy if exists "diagnostic_respondents_select" on public.diagnostic_respondents;
create policy "diagnostic_respondents_select_anon" on public.diagnostic_respondents
  as permissive for select to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id()))))))))))
  );
create policy "diagnostic_respondents_select_authenticated" on public.diagnostic_respondents
  as permissive for select to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id()))))))))))
    OR ((EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND (is_platform_admin() OR (ds.client_id = ANY (auth_user_client_ids())))))))
  );
create policy "diagnostic_respondents_insert_anon" on public.diagnostic_respondents
  as permissive for insert to anon
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id()))))))))))
  );
create policy "diagnostic_respondents_insert_authenticated" on public.diagnostic_respondents
  as permissive for insert to authenticated
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id()))))))))))
  );
create policy "diagnostic_respondents_update_anon" on public.diagnostic_respondents
  as permissive for update to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id()))))))))))
  )
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id()))))))))))
  );
create policy "diagnostic_respondents_update_authenticated" on public.diagnostic_respondents
  as permissive for update to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id()))))))))))
  )
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id()))))))))))
  );
create policy "diagnostic_respondents_delete_anon" on public.diagnostic_respondents
  as permissive for delete to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id()))))))))))
  );
create policy "diagnostic_respondents_delete_authenticated" on public.diagnostic_respondents
  as permissive for delete to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND (EXISTS ( SELECT 1
   FROM diagnostic_sessions ds
  WHERE ((ds.id = diagnostic_respondents.session_id) AND ((ds.client_id = auth_user_client_id()) OR (ds.client_id IN ( SELECT c.id
           FROM clients c
          WHERE (c.partner_id = auth_user_partner_id()))))))))))
  );

-- diagnostic_responses: fold 3 policies into per-role-per-action form
drop policy if exists "diagnostic_responses_all_platform_admin" on public.diagnostic_responses;
drop policy if exists "diagnostic_responses_insert_respondent" on public.diagnostic_responses;
drop policy if exists "diagnostic_responses_select" on public.diagnostic_responses;
create policy "diagnostic_responses_select_anon" on public.diagnostic_responses
  as permissive for select to anon
  using (
    (is_platform_admin())
  );
create policy "diagnostic_responses_select_authenticated" on public.diagnostic_responses
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM (diagnostic_respondents dr
     JOIN diagnostic_sessions ds ON ((ds.id = dr.session_id)))
  WHERE ((dr.id = diagnostic_responses.respondent_id) AND (is_platform_admin() OR (ds.client_id = ANY (auth_user_client_ids())))))))
  );
create policy "diagnostic_responses_insert_anon" on public.diagnostic_responses
  as permissive for insert to anon
  with check (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM diagnostic_respondents dr
  WHERE ((dr.id = diagnostic_responses.respondent_id) AND (dr.profile_id = ( SELECT auth.uid() AS uid))))))
  );
create policy "diagnostic_responses_insert_authenticated" on public.diagnostic_responses
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM diagnostic_respondents dr
  WHERE ((dr.id = diagnostic_responses.respondent_id) AND (dr.profile_id = ( SELECT auth.uid() AS uid))))))
  );
create policy "diagnostic_responses_update_anon" on public.diagnostic_responses
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_responses_update_authenticated" on public.diagnostic_responses
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_responses_delete_anon" on public.diagnostic_responses
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "diagnostic_responses_delete_authenticated" on public.diagnostic_responses
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- diagnostic_sessions: fold 2 policies into per-role-per-action form
drop policy if exists "diagnostic_sessions_all_public_merged" on public.diagnostic_sessions;
drop policy if exists "diagnostic_sessions_select" on public.diagnostic_sessions;
create policy "diagnostic_sessions_select_anon" on public.diagnostic_sessions
  as permissive for select to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "diagnostic_sessions_select_authenticated" on public.diagnostic_sessions
  as permissive for select to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
    OR ((is_platform_admin() OR (client_id = ANY (auth_user_client_ids()))))
  );
create policy "diagnostic_sessions_insert_anon" on public.diagnostic_sessions
  as permissive for insert to anon
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "diagnostic_sessions_insert_authenticated" on public.diagnostic_sessions
  as permissive for insert to authenticated
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "diagnostic_sessions_update_anon" on public.diagnostic_sessions
  as permissive for update to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  )
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "diagnostic_sessions_update_authenticated" on public.diagnostic_sessions
  as permissive for update to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  )
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "diagnostic_sessions_delete_anon" on public.diagnostic_sessions
  as permissive for delete to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "diagnostic_sessions_delete_authenticated" on public.diagnostic_sessions
  as permissive for delete to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );

-- diagnostic_snapshots: fold 2 policies into per-role-per-action form
drop policy if exists "diagnostic_snapshots_all_platform_admin" on public.diagnostic_snapshots;
drop policy if exists "diagnostic_snapshots_select" on public.diagnostic_snapshots;
create policy "diagnostic_snapshots_select_anon" on public.diagnostic_snapshots
  as permissive for select to anon
  using (
    (is_platform_admin())
  );
create policy "diagnostic_snapshots_select_authenticated" on public.diagnostic_snapshots
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((is_platform_admin() OR (client_id = ANY (auth_user_client_ids()))))
  );
create policy "diagnostic_snapshots_insert_anon" on public.diagnostic_snapshots
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_snapshots_insert_authenticated" on public.diagnostic_snapshots
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_snapshots_update_anon" on public.diagnostic_snapshots
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_snapshots_update_authenticated" on public.diagnostic_snapshots
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_snapshots_delete_anon" on public.diagnostic_snapshots
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "diagnostic_snapshots_delete_authenticated" on public.diagnostic_snapshots
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- diagnostic_template_dimensions: fold 2 policies into per-role-per-action form
drop policy if exists "diagnostic_template_dimensions_all_platform_admin" on public.diagnostic_template_dimensions;
drop policy if exists "diagnostic_template_dimensions_select_authenticated" on public.diagnostic_template_dimensions;
create policy "diagnostic_template_dimensions_select_anon" on public.diagnostic_template_dimensions
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "diagnostic_template_dimensions_select_authenticated" on public.diagnostic_template_dimensions
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "diagnostic_template_dimensions_insert_anon" on public.diagnostic_template_dimensions
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_template_dimensions_insert_authenticated" on public.diagnostic_template_dimensions
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_template_dimensions_update_anon" on public.diagnostic_template_dimensions
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_template_dimensions_update_authenticated" on public.diagnostic_template_dimensions
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_template_dimensions_delete_anon" on public.diagnostic_template_dimensions
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "diagnostic_template_dimensions_delete_authenticated" on public.diagnostic_template_dimensions
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- diagnostic_templates: fold 2 policies into per-role-per-action form
drop policy if exists "diagnostic_templates_all_platform_admin" on public.diagnostic_templates;
drop policy if exists "diagnostic_templates_select_authenticated" on public.diagnostic_templates;
create policy "diagnostic_templates_select_anon" on public.diagnostic_templates
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "diagnostic_templates_select_authenticated" on public.diagnostic_templates
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "diagnostic_templates_insert_anon" on public.diagnostic_templates
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_templates_insert_authenticated" on public.diagnostic_templates
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_templates_update_anon" on public.diagnostic_templates
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_templates_update_authenticated" on public.diagnostic_templates
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "diagnostic_templates_delete_anon" on public.diagnostic_templates
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "diagnostic_templates_delete_authenticated" on public.diagnostic_templates
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- email_templates: fold 5 policies into per-role-per-action form
drop policy if exists "email_templates_delete_authenticated_merged" on public.email_templates;
drop policy if exists "email_templates_insert_authenticated_merged" on public.email_templates;
drop policy if exists "email_templates_platform_admin_all" on public.email_templates;
drop policy if exists "email_templates_select_authenticated_merged" on public.email_templates;
drop policy if exists "email_templates_update_authenticated_merged" on public.email_templates;
create policy "email_templates_select_authenticated" on public.email_templates
  as permissive for select to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role) AND (profiles.is_active = true)))))
    OR ((((scope_type = 'platform'::email_template_scope) AND (scope_id IS NULL)) OR ((scope_type = 'client'::email_template_scope) AND (scope_id = ANY (auth_user_client_admin_ids()))) OR (((scope_type = 'platform'::email_template_scope) AND (scope_id IS NULL)) OR ((scope_type = 'partner'::email_template_scope) AND (scope_id = ANY (auth_user_partner_admin_ids()))))))
  );
create policy "email_templates_insert_authenticated" on public.email_templates
  as permissive for insert to authenticated
  with check (
    ((((scope_type = 'client'::email_template_scope) AND (scope_id = ANY (auth_user_client_admin_ids()))) OR ((scope_type = 'partner'::email_template_scope) AND (scope_id = ANY (auth_user_partner_admin_ids())))))
    OR ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role) AND (profiles.is_active = true)))))
  );
create policy "email_templates_update_authenticated" on public.email_templates
  as permissive for update to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role) AND (profiles.is_active = true)))))
    OR ((((scope_type = 'client'::email_template_scope) AND (scope_id = ANY (auth_user_client_admin_ids()))) OR ((scope_type = 'partner'::email_template_scope) AND (scope_id = ANY (auth_user_partner_admin_ids())))))
  )
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role) AND (profiles.is_active = true)))))
    OR ((((scope_type = 'client'::email_template_scope) AND (scope_id = ANY (auth_user_client_admin_ids()))) OR ((scope_type = 'partner'::email_template_scope) AND (scope_id = ANY (auth_user_partner_admin_ids())))))
  );
create policy "email_templates_delete_authenticated" on public.email_templates
  as permissive for delete to authenticated
  using (
    ((((scope_type = 'client'::email_template_scope) AND (scope_id = ANY (auth_user_client_admin_ids()))) OR ((scope_type = 'partner'::email_template_scope) AND (scope_id = ANY (auth_user_partner_admin_ids())))))
    OR ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role) AND (profiles.is_active = true)))))
  );

-- experience_templates: fold 4 policies into per-role-per-action form
drop policy if exists "experience_templates_admin_all" on public.experience_templates;
drop policy if exists "experience_templates_anon_read" on public.experience_templates;
drop policy if exists "experience_templates_campaign_write" on public.experience_templates;
drop policy if exists "experience_templates_select_authenticated_merged" on public.experience_templates;
create policy "experience_templates_select_anon" on public.experience_templates
  as permissive for select to anon
  using (
    ((((owner_type = 'platform'::text) AND (owner_id IS NULL)) OR (owner_type = 'campaign'::text)))
  );
create policy "experience_templates_select_authenticated" on public.experience_templates
  as permissive for select to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
    OR ((((owner_type = 'platform'::text) AND (owner_id IS NULL)) OR ((owner_type = 'campaign'::text) AND (owner_id IN ( SELECT c.id
   FROM campaigns c
  WHERE (c.client_id = ANY (auth_user_client_ids()))))) OR ((owner_type = 'platform'::text) AND (owner_id IS NULL))))
  );
create policy "experience_templates_insert_authenticated" on public.experience_templates
  as permissive for insert to authenticated
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "experience_templates_update_authenticated" on public.experience_templates
  as permissive for update to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
    OR (((owner_type = 'campaign'::text) AND (owner_id IN ( SELECT c.id
   FROM (campaigns c
     JOIN profiles p ON ((p.client_id = c.client_id)))
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = ANY (ARRAY['org_admin'::user_role, 'platform_admin'::user_role])))))))
  )
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
    OR (((owner_type = 'campaign'::text) AND (owner_id IN ( SELECT c.id
   FROM (campaigns c
     JOIN profiles p ON ((p.client_id = c.client_id)))
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = ANY (ARRAY['org_admin'::user_role, 'platform_admin'::user_role])))))))
  );
create policy "experience_templates_delete_authenticated" on public.experience_templates
  as permissive for delete to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );

-- item_options: fold 2 policies into per-role-per-action form
drop policy if exists "item_options_all_platform_admin" on public.item_options;
drop policy if exists "item_options_select_authenticated" on public.item_options;
create policy "item_options_select_anon" on public.item_options
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "item_options_select_authenticated" on public.item_options
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "item_options_insert_anon" on public.item_options
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "item_options_insert_authenticated" on public.item_options
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "item_options_update_anon" on public.item_options
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "item_options_update_authenticated" on public.item_options
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "item_options_delete_anon" on public.item_options
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "item_options_delete_authenticated" on public.item_options
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- item_parameters: fold 2 policies into per-role-per-action form
drop policy if exists "item_parameters_all_platform_admin" on public.item_parameters;
drop policy if exists "item_parameters_select_authenticated" on public.item_parameters;
create policy "item_parameters_select_anon" on public.item_parameters
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "item_parameters_select_authenticated" on public.item_parameters
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "item_parameters_insert_anon" on public.item_parameters
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "item_parameters_insert_authenticated" on public.item_parameters
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "item_parameters_update_anon" on public.item_parameters
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "item_parameters_update_authenticated" on public.item_parameters
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "item_parameters_delete_anon" on public.item_parameters
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "item_parameters_delete_authenticated" on public.item_parameters
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- item_selection_rules: fold 2 policies into per-role-per-action form
drop policy if exists "Admins can manage item_selection_rules" on public.item_selection_rules;
drop policy if exists "Anyone can read item_selection_rules" on public.item_selection_rules;
create policy "item_selection_rules_select_anon" on public.item_selection_rules
  as permissive for select to anon
  using (
    ((is_platform_admin() OR is_partner_admin()))
    OR (true)
  );
create policy "item_selection_rules_select_authenticated" on public.item_selection_rules
  as permissive for select to authenticated
  using (
    ((is_platform_admin() OR is_partner_admin()))
    OR (true)
  );
create policy "item_selection_rules_insert_anon" on public.item_selection_rules
  as permissive for insert to anon
  with check (
    ((is_platform_admin() OR is_partner_admin()))
  );
create policy "item_selection_rules_insert_authenticated" on public.item_selection_rules
  as permissive for insert to authenticated
  with check (
    ((is_platform_admin() OR is_partner_admin()))
  );
create policy "item_selection_rules_update_anon" on public.item_selection_rules
  as permissive for update to anon
  using (
    ((is_platform_admin() OR is_partner_admin()))
  )
  with check (
    ((is_platform_admin() OR is_partner_admin()))
  );
create policy "item_selection_rules_update_authenticated" on public.item_selection_rules
  as permissive for update to authenticated
  using (
    ((is_platform_admin() OR is_partner_admin()))
  )
  with check (
    ((is_platform_admin() OR is_partner_admin()))
  );
create policy "item_selection_rules_delete_anon" on public.item_selection_rules
  as permissive for delete to anon
  using (
    ((is_platform_admin() OR is_partner_admin()))
  );
create policy "item_selection_rules_delete_authenticated" on public.item_selection_rules
  as permissive for delete to authenticated
  using (
    ((is_platform_admin() OR is_partner_admin()))
  );

-- items: fold 2 policies into per-role-per-action form
drop policy if exists "items_all_platform_admin" on public.items;
drop policy if exists "items_select_authenticated" on public.items;
create policy "items_select_anon" on public.items
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "items_select_authenticated" on public.items
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "items_insert_anon" on public.items
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "items_insert_authenticated" on public.items
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "items_update_anon" on public.items
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "items_update_authenticated" on public.items
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "items_delete_anon" on public.items
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "items_delete_authenticated" on public.items
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- matching_results: fold 2 policies into per-role-per-action form
drop policy if exists "matching_results_all_platform_admin" on public.matching_results;
drop policy if exists "matching_results_select" on public.matching_results;
create policy "matching_results_select_anon" on public.matching_results
  as permissive for select to anon
  using (
    (is_platform_admin())
  );
create policy "matching_results_select_authenticated" on public.matching_results
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM matching_runs mr
  WHERE ((mr.id = matching_results.matching_run_id) AND (is_platform_admin() OR (mr.client_id = ANY (auth_user_client_ids())))))))
  );
create policy "matching_results_insert_anon" on public.matching_results
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "matching_results_insert_authenticated" on public.matching_results
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "matching_results_update_anon" on public.matching_results
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "matching_results_update_authenticated" on public.matching_results
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "matching_results_delete_anon" on public.matching_results
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "matching_results_delete_authenticated" on public.matching_results
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- matching_runs: fold 2 policies into per-role-per-action form
drop policy if exists "matching_runs_all_public_merged" on public.matching_runs;
drop policy if exists "matching_runs_select" on public.matching_runs;
create policy "matching_runs_select_anon" on public.matching_runs
  as permissive for select to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "matching_runs_select_authenticated" on public.matching_runs
  as permissive for select to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
    OR ((is_platform_admin() OR (client_id = ANY (auth_user_client_ids()))))
  );
create policy "matching_runs_insert_anon" on public.matching_runs
  as permissive for insert to anon
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "matching_runs_insert_authenticated" on public.matching_runs
  as permissive for insert to authenticated
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "matching_runs_update_anon" on public.matching_runs
  as permissive for update to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  )
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "matching_runs_update_authenticated" on public.matching_runs
  as permissive for update to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  )
  with check (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "matching_runs_delete_anon" on public.matching_runs
  as permissive for delete to anon
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );
create policy "matching_runs_delete_authenticated" on public.matching_runs
  as permissive for delete to authenticated
  using (
    ((is_platform_admin() OR ((auth_user_role() = ANY (ARRAY['org_admin'::user_role, 'consultant'::user_role])) AND ((client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE (c.partner_id = auth_user_partner_id())))))))
  );

-- org_diagnostic_campaign_tracks: fold 2 policies into per-role-per-action form
drop policy if exists "org_diag_tracks_all_platform_admin" on public.org_diagnostic_campaign_tracks;
drop policy if exists "org_diag_tracks_select_via_campaign" on public.org_diagnostic_campaign_tracks;
create policy "org_diagnostic_campaign_tracks_select_authenticated" on public.org_diagnostic_campaign_tracks
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM org_diagnostic_campaigns c
  WHERE ((c.id = org_diagnostic_campaign_tracks.campaign_id) AND (is_platform_admin() OR (c.client_id = auth_user_client_id()) OR (c.client_id IN ( SELECT cl.id
           FROM clients cl
          WHERE ((cl.partner_id = ( SELECT profiles.partner_id
                   FROM profiles
                  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (cl.deleted_at IS NULL)))))))))
  );
create policy "org_diagnostic_campaign_tracks_insert_authenticated" on public.org_diagnostic_campaign_tracks
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "org_diagnostic_campaign_tracks_update_authenticated" on public.org_diagnostic_campaign_tracks
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "org_diagnostic_campaign_tracks_delete_authenticated" on public.org_diagnostic_campaign_tracks
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- org_diagnostic_campaigns: fold 2 policies into per-role-per-action form
drop policy if exists "org_diag_campaigns_all_platform_admin" on public.org_diagnostic_campaigns;
drop policy if exists "org_diag_campaigns_select_client" on public.org_diagnostic_campaigns;
create policy "org_diagnostic_campaigns_select_authenticated" on public.org_diagnostic_campaigns
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((is_platform_admin() OR (client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE ((c.partner_id = ( SELECT profiles.partner_id
           FROM profiles
          WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (c.deleted_at IS NULL))))))
  );
create policy "org_diagnostic_campaigns_insert_authenticated" on public.org_diagnostic_campaigns
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "org_diagnostic_campaigns_update_authenticated" on public.org_diagnostic_campaigns
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "org_diagnostic_campaigns_delete_authenticated" on public.org_diagnostic_campaigns
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- org_diagnostic_profiles: fold 2 policies into per-role-per-action form
drop policy if exists "org_diag_profiles_all_platform_admin" on public.org_diagnostic_profiles;
drop policy if exists "org_diag_profiles_select_client" on public.org_diagnostic_profiles;
create policy "org_diagnostic_profiles_select_authenticated" on public.org_diagnostic_profiles
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((is_platform_admin() OR (client_id = auth_user_client_id()) OR (client_id IN ( SELECT c.id
   FROM clients c
  WHERE ((c.partner_id = ( SELECT profiles.partner_id
           FROM profiles
          WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (c.deleted_at IS NULL))))))
  );
create policy "org_diagnostic_profiles_insert_authenticated" on public.org_diagnostic_profiles
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "org_diagnostic_profiles_update_authenticated" on public.org_diagnostic_profiles
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "org_diagnostic_profiles_delete_authenticated" on public.org_diagnostic_profiles
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- participant_responses: fold 3 policies into per-role-per-action form
drop policy if exists "participant_responses_all_platform_admin" on public.participant_responses;
drop policy if exists "participant_responses_insert_own" on public.participant_responses;
drop policy if exists "participant_responses_select" on public.participant_responses;
create policy "participant_responses_select_authenticated" on public.participant_responses
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM participant_sessions ps
  WHERE ((ps.id = participant_responses.session_id) AND (is_platform_admin() OR ((ps.client_id IS NOT NULL) AND (ps.client_id = ANY (auth_user_client_ids()))) OR (ps.participant_profile_id = ( SELECT auth.uid() AS uid)))))))
  );
create policy "participant_responses_insert_authenticated" on public.participant_responses
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM participant_sessions ps
  WHERE ((ps.id = participant_responses.session_id) AND (ps.participant_profile_id = ( SELECT auth.uid() AS uid))))))
  );
create policy "participant_responses_update_authenticated" on public.participant_responses
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "participant_responses_delete_authenticated" on public.participant_responses
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- participant_scores: fold 2 policies into per-role-per-action form
drop policy if exists "participant_scores_all_platform_admin" on public.participant_scores;
drop policy if exists "participant_scores_select" on public.participant_scores;
create policy "participant_scores_select_authenticated" on public.participant_scores
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((EXISTS ( SELECT 1
   FROM participant_sessions ps
  WHERE ((ps.id = participant_scores.session_id) AND (is_platform_admin() OR ((ps.client_id IS NOT NULL) AND (ps.client_id = ANY (auth_user_client_ids()))) OR (ps.participant_profile_id = ( SELECT auth.uid() AS uid)))))))
  );
create policy "participant_scores_insert_authenticated" on public.participant_scores
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "participant_scores_update_authenticated" on public.participant_scores
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "participant_scores_delete_authenticated" on public.participant_scores
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- participant_sessions: fold 4 policies into per-role-per-action form
drop policy if exists "participant_sessions_all_platform_admin" on public.participant_sessions;
drop policy if exists "participant_sessions_manage_org" on public.participant_sessions;
drop policy if exists "participant_sessions_select" on public.participant_sessions;
drop policy if exists "participant_sessions_update_own" on public.participant_sessions;
create policy "participant_sessions_select_authenticated" on public.participant_sessions
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((is_platform_admin() OR ((client_id IS NOT NULL) AND (client_id = ANY (auth_user_client_ids()))) OR (participant_profile_id = ( SELECT auth.uid() AS uid))))
  );
create policy "participant_sessions_insert_authenticated" on public.participant_sessions
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
    OR ((is_platform_admin() OR ((client_id IS NOT NULL) AND (client_id = auth_user_client_id()))))
  );
create policy "participant_sessions_update_authenticated" on public.participant_sessions
  as permissive for update to authenticated
  using (
    (is_platform_admin())
    OR ((participant_profile_id = ( SELECT auth.uid() AS uid)))
  )
  with check (
    (is_platform_admin())
    OR ((participant_profile_id = ( SELECT auth.uid() AS uid)))
  );
create policy "participant_sessions_delete_authenticated" on public.participant_sessions
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- partner_assessment_assignments: fold 2 policies into per-role-per-action form
drop policy if exists "partner_members_select_own" on public.partner_assessment_assignments;
drop policy if exists "platform_admins_full_access" on public.partner_assessment_assignments;
create policy "partner_assessment_assignments_select_authenticated" on public.partner_assessment_assignments
  as permissive for select to authenticated
  using (
    ((partner_id IN ( SELECT pm.partner_id
   FROM partner_memberships pm
  WHERE ((pm.profile_id = ( SELECT auth.uid() AS uid)) AND (pm.revoked_at IS NULL)))))
    OR ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "partner_assessment_assignments_insert_authenticated" on public.partner_assessment_assignments
  as permissive for insert to authenticated
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "partner_assessment_assignments_update_authenticated" on public.partner_assessment_assignments
  as permissive for update to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  )
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "partner_assessment_assignments_delete_authenticated" on public.partner_assessment_assignments
  as permissive for delete to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );

-- partner_report_template_assignments: fold 2 policies into per-role-per-action form
drop policy if exists "partner_members_select_own" on public.partner_report_template_assignments;
drop policy if exists "platform_admins_full_access" on public.partner_report_template_assignments;
create policy "partner_report_template_assignments_select_authenticated" on public.partner_report_template_assignments
  as permissive for select to authenticated
  using (
    ((partner_id IN ( SELECT pm.partner_id
   FROM partner_memberships pm
  WHERE ((pm.profile_id = ( SELECT auth.uid() AS uid)) AND (pm.revoked_at IS NULL)))))
    OR ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "partner_report_template_assignments_insert_authenticated" on public.partner_report_template_assignments
  as permissive for insert to authenticated
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "partner_report_template_assignments_update_authenticated" on public.partner_report_template_assignments
  as permissive for update to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  )
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "partner_report_template_assignments_delete_authenticated" on public.partner_report_template_assignments
  as permissive for delete to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );

-- partner_taxonomy_assignments: fold 2 policies into per-role-per-action form
drop policy if exists "partner_members_select_own" on public.partner_taxonomy_assignments;
drop policy if exists "platform_admins_full_access" on public.partner_taxonomy_assignments;
create policy "partner_taxonomy_assignments_select_authenticated" on public.partner_taxonomy_assignments
  as permissive for select to authenticated
  using (
    ((partner_id IN ( SELECT pm.partner_id
   FROM partner_memberships pm
  WHERE ((pm.profile_id = ( SELECT auth.uid() AS uid)) AND (pm.revoked_at IS NULL)))))
    OR ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "partner_taxonomy_assignments_insert_authenticated" on public.partner_taxonomy_assignments
  as permissive for insert to authenticated
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "partner_taxonomy_assignments_update_authenticated" on public.partner_taxonomy_assignments
  as permissive for update to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  )
  with check (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );
create policy "partner_taxonomy_assignments_delete_authenticated" on public.partner_taxonomy_assignments
  as permissive for delete to authenticated
  using (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'platform_admin'::user_role)))))
  );

-- partners: fold 3 policies into per-role-per-action form
drop policy if exists "partners_all_platform_admin" on public.partners;
drop policy if exists "partners_select_own" on public.partners;
drop policy if exists "partners_select_platform_admin" on public.partners;
create policy "partners_select_anon" on public.partners
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR (is_platform_admin())
  );
create policy "partners_select_authenticated" on public.partners
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((id = ANY (auth_user_partner_ids())))
    OR (is_platform_admin())
  );
create policy "partners_insert_anon" on public.partners
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "partners_insert_authenticated" on public.partners
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "partners_update_anon" on public.partners
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "partners_update_authenticated" on public.partners
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "partners_delete_anon" on public.partners
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "partners_delete_authenticated" on public.partners
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- profiles: fold 4 policies into per-role-per-action form
drop policy if exists "profiles_all_platform_admin" on public.profiles;
drop policy if exists "profiles_select_authenticated_merged" on public.profiles;
drop policy if exists "profiles_select_public_merged" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_anon" on public.profiles
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR (((id = ( SELECT auth.uid() AS uid)) OR is_platform_admin()))
  );
create policy "profiles_select_authenticated" on public.profiles
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((is_platform_admin() OR (id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.profile_id = profiles.id) AND (cm.revoked_at IS NULL) AND (cm.client_id = ANY (auth_user_client_ids()))))) OR (EXISTS ( SELECT 1
   FROM partner_memberships pm
  WHERE ((pm.profile_id = profiles.id) AND (pm.revoked_at IS NULL) AND (pm.partner_id = ANY (auth_user_partner_ids()))))) OR ((EXISTS ( SELECT 1
   FROM partner_memberships pm
  WHERE ((pm.profile_id = profiles.id) AND (pm.revoked_at IS NULL) AND (pm.partner_id = ANY (auth_user_partner_ids()))))) OR (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.profile_id = profiles.id) AND (cm.revoked_at IS NULL) AND (cm.client_id = ANY (auth_user_client_ids()))))))))
    OR (((id = ( SELECT auth.uid() AS uid)) OR is_platform_admin()))
  );
create policy "profiles_insert_anon" on public.profiles
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "profiles_insert_authenticated" on public.profiles
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "profiles_update_anon" on public.profiles
  as permissive for update to anon
  using (
    (is_platform_admin())
    OR ((id = ( SELECT auth.uid() AS uid)))
  )
  with check (
    (is_platform_admin())
    OR (((id = ( SELECT auth.uid() AS uid)) AND (role = ( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = ( SELECT auth.uid() AS uid))))))
  );
create policy "profiles_update_authenticated" on public.profiles
  as permissive for update to authenticated
  using (
    (is_platform_admin())
    OR ((id = ( SELECT auth.uid() AS uid)))
  )
  with check (
    (is_platform_admin())
    OR (((id = ( SELECT auth.uid() AS uid)) AND (role = ( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = ( SELECT auth.uid() AS uid))))))
  );
create policy "profiles_delete_anon" on public.profiles
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "profiles_delete_authenticated" on public.profiles
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

-- response_formats: fold 2 policies into per-role-per-action form
drop policy if exists "response_formats_all_platform_admin" on public.response_formats;
drop policy if exists "response_formats_select_authenticated" on public.response_formats;
create policy "response_formats_select_anon" on public.response_formats
  as permissive for select to anon
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "response_formats_select_authenticated" on public.response_formats
  as permissive for select to authenticated
  using (
    (is_platform_admin())
    OR ((( SELECT auth.uid() AS uid) IS NOT NULL))
  );
create policy "response_formats_insert_anon" on public.response_formats
  as permissive for insert to anon
  with check (
    (is_platform_admin())
  );
create policy "response_formats_insert_authenticated" on public.response_formats
  as permissive for insert to authenticated
  with check (
    (is_platform_admin())
  );
create policy "response_formats_update_anon" on public.response_formats
  as permissive for update to anon
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "response_formats_update_authenticated" on public.response_formats
  as permissive for update to authenticated
  using (
    (is_platform_admin())
  )
  with check (
    (is_platform_admin())
  );
create policy "response_formats_delete_anon" on public.response_formats
  as permissive for delete to anon
  using (
    (is_platform_admin())
  );
create policy "response_formats_delete_authenticated" on public.response_formats
  as permissive for delete to authenticated
  using (
    (is_platform_admin())
  );

