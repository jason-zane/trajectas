-- Participant rendering and public marketing use server-side projections.
-- Browser/public API keys must not enumerate the underlying configuration.
REVOKE ALL ON TABLE public.dimensions, public.assessment_factors,
  public.content_sources, public.item_selection_rules, public.anchor_presets,
  public.brand_configs, public.forced_choice_blocks, public.forced_choice_block_items
  FROM anon, PUBLIC;

DROP POLICY IF EXISTS anchor_presets_select_anon ON public.anchor_presets;
DROP POLICY IF EXISTS assessment_factors_select_anon ON public.assessment_factors;
DROP POLICY IF EXISTS content_sources_select_anon ON public.content_sources;
DROP POLICY IF EXISTS item_selection_rules_select_anon ON public.item_selection_rules;
DROP POLICY IF EXISTS brand_configs_select_anon ON public.brand_configs;

-- Keep signed-in library use, but private compositions inherit the owning
-- assessment's RLS instead of becoming visible merely by signing in.
DROP POLICY IF EXISTS assessment_factors_select_authenticated ON public.assessment_factors;
CREATE POLICY assessment_factors_select_authenticated ON public.assessment_factors
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id)
  );

DROP POLICY IF EXISTS fc_blocks_select ON public.forced_choice_blocks;
CREATE POLICY fc_blocks_select ON public.forced_choice_blocks
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id)
  );
DROP POLICY IF EXISTS fc_block_items_select ON public.forced_choice_block_items;
CREATE POLICY fc_block_items_select ON public.forced_choice_block_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.forced_choice_blocks b WHERE b.id = block_id)
  );

DROP POLICY IF EXISTS dimensions_select ON public.dimensions;
CREATE POLICY dimensions_select ON public.dimensions
  FOR SELECT TO authenticated USING (
    public.is_unconfined_platform_admin()
    OR partner_id IS NULL
    OR partner_id = ANY(public.auth_user_partner_ids())
  );
