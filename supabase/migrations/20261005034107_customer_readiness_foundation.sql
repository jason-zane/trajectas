-- Customer-readiness foundation. Apply to an isolated database before deployment.
BEGIN;
ALTER TABLE public.report_snapshots ADD COLUMN consultant_notification_claimed_at timestamptz;
CREATE INDEX report_snapshots_pending_consultant_notifications ON public.report_snapshots(created_at)
  WHERE status = 'released' AND consultant_notified_at IS NULL;

ALTER TABLE public.participant_scores ADD COLUMN items_expected integer CHECK (items_expected >= 0);

ALTER TABLE public.campaign_participants
  ADD COLUMN demographics_schema_snapshot jsonb,
  ADD COLUMN research_use_permitted boolean NOT NULL DEFAULT false,
  ADD COLUMN research_consent_at timestamptz,
  ADD COLUMN research_consent_snapshot jsonb,
  ADD COLUMN consent_content_snapshot jsonb;
ALTER TABLE public.campaign_participants ADD CONSTRAINT research_permission_requires_record
  CHECK (NOT research_use_permitted OR (research_consent_at IS NOT NULL AND research_consent_snapshot IS NOT NULL));

ALTER TABLE public.participant_sessions
  ADD COLUMN observation_origin_review jsonb,
  ADD COLUMN observation_origin text NOT NULL DEFAULT 'unknown'
  CHECK (observation_origin IN ('unknown', 'synthetic', 'preview', 'staff_test', 'real'));
-- Jason confirmed that all data existing at the audit date is non-real. Keep it,
-- but never turn it into empirical evidence by toggling an internal-data filter.
UPDATE public.participant_sessions SET observation_origin = 'synthetic'
  WHERE created_at < '2026-10-05T03:41:07Z';
CREATE INDEX participant_sessions_empirical ON public.participant_sessions(assessment_id, completed_at)
  WHERE observation_origin = 'real' AND status = 'completed' AND NOT is_internal;

-- The supported participant write contract is the guarded token RPC / server
-- action. Raw table writes must not bypass delivery and scoring invariants.
REVOKE INSERT, UPDATE, DELETE ON public.participant_sessions, public.participant_responses FROM anon, authenticated;
DO $body$
DECLARE entry record;
BEGIN
  FOR entry IN SELECT table_name, column_name, privilege_type, grantee
    FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name IN ('participant_sessions', 'participant_responses')
      AND grantee IN ('anon', 'authenticated') AND privilege_type IN ('INSERT', 'UPDATE')
  LOOP
    EXECUTE format('REVOKE %s (%I) ON public.%I FROM %I', entry.privilege_type, entry.column_name, entry.table_name, entry.grantee);
  END LOOP;
END;
$body$;

-- Private assessment children inherit the visibility of their parent through
-- its existing RLS policies. Shared library visibility stays with the parent.
DROP POLICY IF EXISTS assessment_sections_select ON public.assessment_sections;
CREATE POLICY assessment_sections_select ON public.assessment_sections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_sections.assessment_id));
DROP POLICY IF EXISTS assessment_section_items_select ON public.assessment_section_items;
CREATE POLICY assessment_section_items_select ON public.assessment_section_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessment_sections s WHERE s.id = assessment_section_items.section_id));

CREATE TABLE public.norm_cohort_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norm_group_id uuid NOT NULL REFERENCES public.norm_groups(id),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id),
  reference_population text NOT NULL CHECK (length(trim(reference_population)) BETWEEN 1 AND 2000),
  demographic_filters jsonb NOT NULL DEFAULT '{}',
  intended_use text NOT NULL DEFAULT 'development_coaching' CHECK (intended_use = 'development_coaching'),
  minimum_sample_size integer NOT NULL DEFAULT 100 CHECK (minimum_sample_size >= 2),
  sampling_plan text NOT NULL CHECK (length(trim(sampling_plan)) BETWEEN 1 AND 4000),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.norm_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_definition_id uuid NOT NULL REFERENCES public.norm_cohort_definitions(id),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id),
  scorer_version text NOT NULL,
  form_hash text NOT NULL,
  cohort_manifest_hash text NOT NULL,
  reference_population text NOT NULL,
  sample_size integer NOT NULL CHECK (sample_size >= 2),
  distributions jsonb NOT NULL,
  cohort_definition_snapshot jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft' CHECK (status = 'draft')
);
COMMENT ON TABLE public.norm_versions IS 'Immutable descriptive study snapshots. Drafts are never published norms and must not be read by participant scoring.';
CREATE SCHEMA IF NOT EXISTS private;
CREATE FUNCTION private.reject_norm_snapshot_mutation() RETURNS trigger
  LANGUAGE plpgsql SET search_path = '' AS $body$
BEGIN
  RAISE EXCEPTION 'Norm study snapshots are immutable. Create a new version.';
END;
$body$;
REVOKE ALL ON FUNCTION private.reject_norm_snapshot_mutation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER norm_snapshot_immutable BEFORE UPDATE OR DELETE ON public.norm_versions
  FOR EACH ROW EXECUTE FUNCTION private.reject_norm_snapshot_mutation();
CREATE TRIGGER norm_cohort_definition_immutable BEFORE UPDATE OR DELETE ON public.norm_cohort_definitions
  FOR EACH ROW EXECUTE FUNCTION private.reject_norm_snapshot_mutation();
ALTER TABLE public.norm_cohort_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.norm_versions ENABLE ROW LEVEL SECURITY;
-- Only guarded server operations access study records; no new raw API surface.
REVOKE ALL ON public.norm_cohort_definitions, public.norm_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.norm_cohort_definitions, public.norm_versions TO service_role;

-- Enforce the configured collection prerequisite in the database as well as UI.
-- Trigger functions live outside exposed schemas and confer no caller privilege.
CREATE FUNCTION private.require_collection_consent() RETURNS trigger
  LANGUAGE plpgsql SET search_path = '' AS $body$
DECLARE participant_id uuid; campaign_id uuid; accepted_at timestamptz; enabled boolean;
BEGIN
  IF TG_TABLE_NAME = 'participant_sessions' THEN
    participant_id := NEW.campaign_participant_id;
    campaign_id := NEW.campaign_id;
  ELSE
    SELECT ps.campaign_participant_id, ps.campaign_id INTO participant_id, campaign_id
      FROM public.participant_sessions ps WHERE ps.id = NEW.session_id;
  END IF;
  IF participant_id IS NULL OR campaign_id IS NULL THEN RETURN NEW; END IF;
  -- Report-builder previews are synthetic records under the dedicated Sample
  -- Data client, not a person's collection event. Never fabricate their consent.
  IF EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id
      AND c.client_id = '00000000-0000-4000-8000-00008a4dc11e' AND c.is_internal)
  THEN
    IF TG_TABLE_NAME = 'participant_sessions' THEN
      IF NEW.observation_origin = 'preview' AND NEW.is_internal THEN RETURN NEW; END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM public.participant_sessions ps WHERE ps.id = NEW.session_id
        AND ps.observation_origin = 'preview' AND ps.is_internal) THEN RETURN NEW; END IF;
    END IF;
  END IF;
  SELECT COALESCE(
    (SELECT et.flow_config #>> '{consent,enabled}' FROM public.experience_templates et
      WHERE et.owner_type = 'campaign' AND et.owner_id = campaign_id AND et.deleted_at IS NULL LIMIT 1),
    (SELECT et.flow_config #>> '{consent,enabled}' FROM public.experience_templates et
      WHERE et.owner_type = 'platform' AND et.deleted_at IS NULL LIMIT 1),
    'false')::boolean INTO enabled;
  SELECT cp.consent_given_at INTO accepted_at FROM public.campaign_participants cp WHERE cp.id = participant_id;
  IF enabled AND accepted_at IS NULL THEN
    RAISE EXCEPTION 'Please review and accept the consent information before starting.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION private.require_collection_consent() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER participant_session_collection_consent BEFORE INSERT OR UPDATE ON public.participant_sessions
  FOR EACH ROW EXECUTE FUNCTION private.require_collection_consent();
CREATE TRIGGER participant_response_collection_consent BEFORE INSERT OR UPDATE ON public.participant_responses
  FOR EACH ROW EXECUTE FUNCTION private.require_collection_consent();
-- Upgrade exact legacy defaults while preserving deliberately customised copy.
UPDATE public.experience_templates SET page_content = jsonb_set(page_content, '{consent,body}', to_jsonb($copy$- Your responses are used to generate a self-report profile for professional development and coaching.
- Five Brains is currently a development pilot; real population norms and validation for selection are not yet available.
- Your responses save automatically. Closing this page pauses participation; it does not delete saved data or withdraw permission. Contact your campaign administrator for withdrawal or deletion requests.
- See the privacy information for the purposes, recipients and retention of your identifiable data.$copy$::text)) WHERE deleted_at IS NULL AND page_content #>> '{consent,body}' = $copy$- Your responses are used to generate a profile based on validated psychometric constructs.
- Results are used for professional development and/or selection purposes.
- Your responses save automatically — you may pause, or withdraw at any time by closing this page.$copy$;
UPDATE public.experience_templates SET page_content = jsonb_set(page_content, '{demographics,body}', to_jsonb($copy$These answers are stored with your participant record and may be used for approved group-level research. Optional fields can be left unanswered. See the privacy information for who can access the data and how long it is retained.$copy$::text)) WHERE deleted_at IS NULL AND page_content #>> '{demographics,body}' = $copy$Used only to compare groups fairly — never to identify you.$copy$;

COMMIT;
