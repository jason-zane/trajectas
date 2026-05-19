-- =============================================================================
-- 20260519180000 — Clean up legacy report-attachment artefacts.
--
-- 1. Drop the dormant create_report_snapshots_on_completion() trigger function.
--    It was never wired to a trigger after migration 20260414060826 dropped its
--    backing table (campaign_report_config); it also referenced an ON CONFLICT
--    target (participant_session_id, audience_type) that doesn't exist on
--    report_snapshots, so calling it via the RPC route would error. Leaving
--    it in keeps tripping the Supabase advisor.
--
-- 2. Soft-delete the stale duplicate "5Brains Report" template (created
--    2026-05-16 during early exploration) that pre-dates the real custom
--    "5Brains Capability Report" registered via PR #122.
--
-- 3. Detach the "Consultant Report" from every campaign it was auto-attached
--    to by the now-removed is_default cascade. The session-completion
--    resolver in src/app/actions/assess.ts now reads is_default live as a
--    Layer-3 fallback — so the Consultant Report still fires for assessments
--    that have no other report bound, but it no longer pollutes
--    campaign_report_templates as if it were an explicit campaign override.
--
-- All steps are idempotent.
-- =============================================================================

-- 1. Dead trigger function — drop if present.
DROP FUNCTION IF EXISTS public.create_report_snapshots_on_completion();

-- 2. Soft-delete the stale duplicate 5Brains row by name + created_at + null
--    custom_report_slug. Skip the canonical one (custom_report_slug='5brains').
UPDATE report_templates
SET deleted_at = now()
WHERE id = '369eaf94-211b-4d06-92fd-38506e225447'
  AND custom_report_slug IS NULL
  AND deleted_at IS NULL;

-- 3. Detach the Consultant Report from every campaign. The is_default cascade
--    is gone; templates marked is_default=true are now resolved live at
--    session-completion only when nothing more specific applies.
DELETE FROM campaign_report_templates
WHERE template_id = '39ef4c8a-5030-4b0e-928c-45cfcd6925c0';
