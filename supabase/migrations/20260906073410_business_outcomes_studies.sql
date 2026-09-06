-- Business Outcomes: internal studies and immutable, aggregate client reports.
CREATE TABLE public.outcome_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  question text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (id, client_id)
);
CREATE INDEX outcome_studies_client_created_idx ON public.outcome_studies(client_id, created_at DESC);

CREATE TABLE public.outcome_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL,
  client_id uuid NOT NULL,
  filename text NOT NULL,
  checksum text NOT NULL,
  storage_path text NOT NULL,
  headers jsonb NOT NULL CHECK (jsonb_typeof(headers) = 'array'),
  rows jsonb NOT NULL CHECK (jsonb_typeof(rows) = 'array'),
  row_count integer NOT NULL CHECK (row_count BETWEEN 1 AND 5000),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (study_id,client_id) REFERENCES public.outcome_studies(id,client_id) ON DELETE CASCADE,
  UNIQUE (id,study_id,client_id),
  UNIQUE (study_id,checksum)
);
CREATE INDEX outcome_imports_study_created_idx ON public.outcome_imports(study_id,created_at DESC);
CREATE INDEX outcome_imports_client_idx ON public.outcome_imports(client_id);
CREATE INDEX outcome_imports_creator_idx ON public.outcome_imports(created_by);
CREATE INDEX outcome_studies_creator_idx ON public.outcome_studies(created_by);

CREATE TABLE public.outcome_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL,
  client_id uuid NOT NULL,
  import_id uuid NOT NULL,
  input jsonb NOT NULL,
  input_hash text NOT NULL,
  result jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  lease_id uuid,
  claimed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  error text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (study_id,client_id) REFERENCES public.outcome_studies(id,client_id) ON DELETE CASCADE,
  FOREIGN KEY (import_id,study_id,client_id) REFERENCES public.outcome_imports(id,study_id,client_id),
  CHECK ((status = 'completed') = (result IS NOT NULL)),
  UNIQUE (id,study_id,client_id)
);
CREATE INDEX outcome_runs_study_created_idx ON public.outcome_runs(study_id,created_at DESC);
CREATE INDEX outcome_runs_queue_idx ON public.outcome_runs(status,created_at) WHERE status IN ('queued','running');
CREATE INDEX outcome_runs_import_idx ON public.outcome_runs(import_id,study_id,client_id);
CREATE INDEX outcome_runs_client_idx ON public.outcome_runs(client_id);
CREATE INDEX outcome_runs_creator_idx ON public.outcome_runs(created_by);

CREATE TABLE public.outcome_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL,
  client_id uuid NOT NULL,
  run_id uuid NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL,
  published_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  FOREIGN KEY (study_id,client_id) REFERENCES public.outcome_studies(id,client_id) ON DELETE CASCADE,
  FOREIGN KEY (run_id,study_id,client_id) REFERENCES public.outcome_runs(id,study_id,client_id)
);
CREATE INDEX outcome_reports_study_created_idx ON public.outcome_reports(study_id,created_at DESC);
CREATE INDEX outcome_reports_client_created_idx ON public.outcome_reports(client_id,created_at DESC);
CREATE INDEX outcome_reports_run_idx ON public.outcome_reports(run_id,study_id,client_id);
CREATE INDEX outcome_reports_publisher_idx ON public.outcome_reports(published_by);

ALTER TABLE public.outcome_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_reports ENABLE ROW LEVEL SECURITY;
-- Mutations pass through the authorized server DAL. Direct authenticated writes
-- cannot publish a report or alter the input of a completed analysis.
REVOKE ALL ON public.outcome_studies,public.outcome_imports,public.outcome_runs,public.outcome_reports FROM anon,authenticated;
GRANT SELECT ON public.outcome_studies,public.outcome_imports,public.outcome_runs,public.outcome_reports TO authenticated;
GRANT ALL ON public.outcome_studies,public.outcome_imports,public.outcome_runs,public.outcome_reports TO service_role;
CREATE POLICY outcome_studies_internal_read ON public.outcome_studies FOR SELECT TO authenticated USING ((SELECT public.is_platform_admin()));
CREATE POLICY outcome_imports_internal_read ON public.outcome_imports FOR SELECT TO authenticated USING ((SELECT public.is_platform_admin()));
CREATE POLICY outcome_runs_internal_read ON public.outcome_runs FOR SELECT TO authenticated USING ((SELECT public.is_platform_admin()));
CREATE POLICY outcome_reports_published_read ON public.outcome_reports FOR SELECT TO authenticated USING (
  (SELECT public.is_platform_admin()) OR (revoked_at IS NULL AND client_id = ANY((SELECT public.auth_user_client_ids())::uuid[]))
);

CREATE OR REPLACE FUNCTION public.guard_outcome_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'outcome_studies' THEN
    IF NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Study ownership and provenance are immutable.' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'outcome_imports' THEN
    RAISE EXCEPTION 'Imports are immutable; upload a new source.' USING ERRCODE='23514';
  ELSIF TG_TABLE_NAME = 'outcome_runs' THEN
    IF (to_jsonb(NEW) - ARRAY['status','result','lease_id','claimed_at','attempts','error','completed_at','input_summary']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','result','lease_id','claimed_at','attempts','error','completed_at','input_summary'])
       OR OLD.status IN ('completed','failed') THEN
      RAISE EXCEPTION 'Analysis inputs and finished runs are immutable.' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'outcome_reports' THEN
    IF (to_jsonb(NEW) - 'revoked_at') IS DISTINCT FROM (to_jsonb(OLD) - 'revoked_at') OR OLD.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Published reports are immutable; publish a new version.' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_outcome_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_outcome_study BEFORE UPDATE ON public.outcome_studies FOR EACH ROW EXECUTE FUNCTION public.guard_outcome_snapshot();
CREATE TRIGGER guard_outcome_import BEFORE UPDATE ON public.outcome_imports FOR EACH ROW EXECUTE FUNCTION public.guard_outcome_snapshot();
CREATE TRIGGER guard_outcome_run BEFORE UPDATE ON public.outcome_runs FOR EACH ROW EXECUTE FUNCTION public.guard_outcome_snapshot();
CREATE TRIGGER guard_outcome_report BEFORE UPDATE ON public.outcome_reports FOR EACH ROW EXECUTE FUNCTION public.guard_outcome_snapshot();
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('outcome-sources','outcome-sources',false,5242880,ARRAY['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'])
ON CONFLICT(id) DO NOTHING;
-- No object policies: source downloads are service-only, behind study access.
CREATE UNIQUE INDEX outcome_runs_one_active_per_study ON public.outcome_runs(study_id) WHERE status IN ('queued','running');
-- Globally bound numerical work to two leases, even when several consultants
-- submit simultaneously. Invoker rights and service-only execution.
CREATE FUNCTION public.claim_outcome_run(p_run_id uuid DEFAULT NULL) RETURNS SETOF public.outcome_runs
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('outcome-worker-claim',0)) THEN RETURN; END IF;
  UPDATE public.outcome_runs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,
    error='The worker lease expired. Retry the analysis if recovery fails.',lease_id=NULL,claimed_at=NULL
    WHERE status='running' AND claimed_at<now()-interval '6 minutes';
  IF (SELECT count(*) FROM public.outcome_runs WHERE status='running')>=2 THEN RETURN; END IF;
  SELECT id INTO v_id FROM public.outcome_runs WHERE status='queued' AND attempts<3
    AND (p_run_id IS NULL OR id=p_run_id) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF v_id IS NULL THEN RETURN; END IF;
  RETURN QUERY UPDATE public.outcome_runs SET status='running',lease_id=gen_random_uuid(),claimed_at=now(),attempts=attempts+1,error=NULL WHERE id=v_id RETURNING *;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_outcome_run(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outcome_run(uuid) TO service_role;
CREATE TABLE public.outcome_report_drafts (
  run_id uuid PRIMARY KEY,
  study_id uuid NOT NULL,
  client_id uuid NOT NULL,
  draft jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(run_id,study_id,client_id) REFERENCES public.outcome_runs(id,study_id,client_id) ON DELETE CASCADE
);
CREATE INDEX outcome_report_drafts_study_idx ON public.outcome_report_drafts(study_id);
CREATE INDEX outcome_report_drafts_client_idx ON public.outcome_report_drafts(client_id);
CREATE INDEX outcome_report_drafts_editor_idx ON public.outcome_report_drafts(updated_by);
ALTER TABLE public.outcome_report_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outcome_report_drafts FROM anon,authenticated;
GRANT SELECT ON public.outcome_report_drafts TO authenticated;
GRANT ALL ON public.outcome_report_drafts TO service_role;
CREATE POLICY outcome_drafts_internal_read ON public.outcome_report_drafts FOR SELECT TO authenticated USING ((SELECT public.is_platform_admin()));

-- Preserve the platform-wide deactivated-account boundary on newly added tables.
CREATE POLICY authenticated_active_account ON public.outcome_studies AS RESTRICTIVE TO authenticated USING ((SELECT private.auth_profile_is_active())) WITH CHECK ((SELECT private.auth_profile_is_active()));
CREATE POLICY authenticated_active_account ON public.outcome_imports AS RESTRICTIVE TO authenticated USING ((SELECT private.auth_profile_is_active())) WITH CHECK ((SELECT private.auth_profile_is_active()));
CREATE POLICY authenticated_active_account ON public.outcome_runs AS RESTRICTIVE TO authenticated USING ((SELECT private.auth_profile_is_active())) WITH CHECK ((SELECT private.auth_profile_is_active()));
CREATE POLICY authenticated_active_account ON public.outcome_reports AS RESTRICTIVE TO authenticated USING ((SELECT private.auth_profile_is_active())) WITH CHECK ((SELECT private.auth_profile_is_active()));
CREATE POLICY authenticated_active_account ON public.outcome_report_drafts AS RESTRICTIVE TO authenticated USING ((SELECT private.auth_profile_is_active())) WITH CHECK ((SELECT private.auth_profile_is_active()));

-- Small, generated read models keep polling and source previews independent of
-- the size of the frozen person-level data. They cannot diverge from the source.
ALTER TABLE public.outcome_imports ADD COLUMN preview jsonb GENERATED ALWAYS AS (jsonb_path_query_array(rows, '$[0 to 7]')) STORED;
ALTER TABLE public.outcome_runs ADD COLUMN input_summary jsonb GENERATED ALWAYS AS (input - 'rows') STORED;
