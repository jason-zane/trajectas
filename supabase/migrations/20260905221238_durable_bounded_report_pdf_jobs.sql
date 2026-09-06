-- Durable PDF jobs and atomic resource bounds across all Vercel instances.
-- These worker RPCs are service-role-only; callers never choose the limits.
ALTER TABLE public.report_snapshots
  ADD COLUMN IF NOT EXISTS pdf_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pdf_claim_token uuid,
  ADD COLUMN IF NOT EXISTS pdf_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_next_attempt_at timestamptz;

-- Recover released reports whose old in-process PDF callback never started.
UPDATE public.report_snapshots SET pdf_status = 'queued'
WHERE status = 'released' AND pdf_url IS NULL AND pdf_status IS NULL;

CREATE INDEX IF NOT EXISTS report_snapshots_pdf_queue_idx
  ON public.report_snapshots (pdf_next_attempt_at, created_at)
  WHERE pdf_status = 'queued' AND pdf_url IS NULL;
CREATE INDEX IF NOT EXISTS report_snapshots_pdf_started_idx
  ON public.report_snapshots (pdf_started_at)
  WHERE pdf_status = 'generating';

CREATE OR REPLACE FUNCTION public.claim_report_snapshot_for_generation(p_snapshot_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Serialize count+claim, rather than letting simultaneous completions all
  -- observe free capacity. Same lock is shared by every server/cron request.
  PERFORM pg_advisory_xact_lock(hashtextextended('trajectas:report-generation', 0));
  IF (SELECT count(*) FROM report_snapshots WHERE status = 'generating') >= 6 THEN
    RETURN false;
  END IF;
  UPDATE report_snapshots
  SET status = 'generating', pdf_url = NULL, pdf_status = NULL,
      pdf_error_message = NULL, pdf_claim_token = NULL,
      pdf_started_at = NULL, pdf_next_attempt_at = NULL, pdf_attempt_count = 0
  WHERE id = p_snapshot_id AND status = 'pending'
    -- Regeneration must not release a PDF slot while its old browser is live.
    AND pdf_status IS DISTINCT FROM 'generating';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_report_pdf_generation(p_snapshot_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claim_token uuid := gen_random_uuid();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('trajectas:report-pdf', 0));
  IF (SELECT count(*) FROM report_snapshots WHERE pdf_status = 'generating') >= 2 THEN
    RETURN NULL;
  END IF;
  UPDATE report_snapshots
  SET pdf_status = 'generating', pdf_claim_token = claim_token,
      pdf_started_at = now(), pdf_attempt_count = pdf_attempt_count + 1,
      pdf_error_message = NULL
  WHERE id = p_snapshot_id
    AND status IN ('ready', 'released') AND pdf_url IS NULL
    AND pdf_status = 'queued' AND pdf_attempt_count < 3
    AND (pdf_next_attempt_at IS NULL OR pdf_next_attempt_at <= now());
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN claim_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_report_pdf_jobs(p_snapshot_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recovered integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('trajectas:report-pdf', 0));
  UPDATE report_snapshots
  SET pdf_status = CASE WHEN pdf_attempt_count >= 3 THEN 'failed' ELSE 'queued' END,
      pdf_error_message = CASE WHEN pdf_attempt_count >= 3
        THEN 'PDF worker timed out after three attempts'
        ELSE 'PDF worker timed out; queued for retry' END,
      pdf_claim_token = NULL, pdf_started_at = NULL, pdf_next_attempt_at = NULL
  WHERE pdf_status = 'generating'
    AND (p_snapshot_id IS NULL OR id = p_snapshot_id)
    AND COALESCE(pdf_started_at, updated_at) < now() - interval '15 minutes';
  GET DIAGNOSTICS recovered = ROW_COUNT;
  RETURN recovered;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_report_pdf_generation(p_snapshot_id uuid, p_claim_token uuid, p_error text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_status text;
BEGIN
  -- Decide retries from the authoritative attempt count, never a pre-claim
  -- client read that could predate recovery or an explicit manual retry.
  UPDATE report_snapshots
  SET pdf_status = CASE WHEN pdf_attempt_count >= 3 THEN 'failed' ELSE 'queued' END,
      pdf_error_message = left(p_error, 2000),
      pdf_claim_token = NULL, pdf_started_at = NULL,
      pdf_next_attempt_at = now() + interval '30 seconds'
  WHERE id = p_snapshot_id AND pdf_claim_token = p_claim_token
    AND pdf_status = 'generating'
  RETURNING pdf_status INTO next_status;
  RETURN next_status;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_report_snapshot_for_generation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_report_pdf_generation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recover_report_pdf_jobs(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_report_snapshot_for_generation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_report_pdf_generation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_report_pdf_jobs(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fail_report_pdf_generation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_report_pdf_generation(uuid, uuid, text) TO service_role;
