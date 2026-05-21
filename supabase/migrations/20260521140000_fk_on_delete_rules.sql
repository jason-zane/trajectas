-- =========================================================================
-- 20260521140000_fk_on_delete_rules.sql
--
-- Eleven public-schema foreign keys were created with the default
-- ON DELETE NO ACTION. That default means deletes on referenced rows
-- silently fail with a constraint violation only when checked at COMMIT,
-- which is the worst of both worlds — neither an explicit refusal nor a
-- defined cleanup behaviour. This migration replaces every default with
-- an explicit policy chosen per-FK.
--
-- Decision matrix (rationale below the SQL):
--
--   audit "assigned_by" / "released_by" / "updated_by" → SET NULL
--     Preserve the assignment/release row when the actor profile goes
--     away (e.g. via account deletion). Lose attribution, keep the
--     record. Columns that were NOT NULL are relaxed to nullable.
--
--   structural lookups (response_formats, report_templates) → RESTRICT
--     These are referenced by content that depends on them structurally
--     (sections need their format definition; snapshots are bound to a
--     template). Refuse to delete the parent if any child still points
--     at it; force the developer to clean up explicitly.
--
--   client-scoped child (norm_groups.client_id) → CASCADE
--     Norm groups are meaningless without their client. If a client is
--     hard-deleted (rare — clients have deleted_at), sweep their
--     norm_groups along with them.
--
--   participant_responses.section_id → RESTRICT
--     Responses are immutable historical records. The section is
--     necessary context for analysis. Refuse section deletion while
--     responses point at it.
-- =========================================================================

-- ----- audit attribution: SET NULL (drop NOT NULL on the columns that need it)

ALTER TABLE public.client_assessment_assignments
  ALTER COLUMN assigned_by DROP NOT NULL;
ALTER TABLE public.client_assessment_assignments
  DROP CONSTRAINT IF EXISTS client_assessment_assignments_assigned_by_fkey;
ALTER TABLE public.client_assessment_assignments
  ADD CONSTRAINT client_assessment_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.client_report_template_assignments
  ALTER COLUMN assigned_by DROP NOT NULL;
ALTER TABLE public.client_report_template_assignments
  DROP CONSTRAINT IF EXISTS client_report_template_assignments_assigned_by_fkey;
ALTER TABLE public.client_report_template_assignments
  ADD CONSTRAINT client_report_template_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.partner_assessment_assignments
  ALTER COLUMN assigned_by DROP NOT NULL;
ALTER TABLE public.partner_assessment_assignments
  DROP CONSTRAINT IF EXISTS partner_assessment_assignments_assigned_by_fkey;
ALTER TABLE public.partner_assessment_assignments
  ADD CONSTRAINT partner_assessment_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.partner_report_template_assignments
  ALTER COLUMN assigned_by DROP NOT NULL;
ALTER TABLE public.partner_report_template_assignments
  DROP CONSTRAINT IF EXISTS partner_report_template_assignments_assigned_by_fkey;
ALTER TABLE public.partner_report_template_assignments
  ADD CONSTRAINT partner_report_template_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.partner_taxonomy_assignments
  ALTER COLUMN assigned_by DROP NOT NULL;
ALTER TABLE public.partner_taxonomy_assignments
  DROP CONSTRAINT IF EXISTS partner_taxonomy_assignments_assigned_by_fkey;
ALTER TABLE public.partner_taxonomy_assignments
  ADD CONSTRAINT partner_taxonomy_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- email_templates.updated_by is already nullable
ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_updated_by_fkey;
ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- report_snapshots.released_by is already nullable
ALTER TABLE public.report_snapshots
  DROP CONSTRAINT IF EXISTS report_snapshots_released_by_fkey;
ALTER TABLE public.report_snapshots
  ADD CONSTRAINT report_snapshots_released_by_fkey
  FOREIGN KEY (released_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ----- structural lookups: RESTRICT

ALTER TABLE public.assessment_sections
  DROP CONSTRAINT IF EXISTS assessment_sections_response_format_id_fkey;
ALTER TABLE public.assessment_sections
  ADD CONSTRAINT assessment_sections_response_format_id_fkey
  FOREIGN KEY (response_format_id) REFERENCES public.response_formats(id) ON DELETE RESTRICT;

ALTER TABLE public.report_snapshots
  DROP CONSTRAINT IF EXISTS report_snapshots_template_id_fkey;
ALTER TABLE public.report_snapshots
  ADD CONSTRAINT report_snapshots_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.report_templates(id) ON DELETE RESTRICT;

-- ----- client-scoped child: CASCADE

ALTER TABLE public.norm_groups
  DROP CONSTRAINT IF EXISTS norm_groups_organization_id_fkey;
ALTER TABLE public.norm_groups
  ADD CONSTRAINT norm_groups_organization_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- ----- immutable historical record: RESTRICT

ALTER TABLE public.participant_responses
  DROP CONSTRAINT IF EXISTS candidate_responses_section_id_fkey;
ALTER TABLE public.participant_responses
  ADD CONSTRAINT candidate_responses_section_id_fkey
  FOREIGN KEY (section_id) REFERENCES public.assessment_sections(id) ON DELETE RESTRICT;
