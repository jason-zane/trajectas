ALTER TABLE report_snapshots
  ADD COLUMN IF NOT EXISTS pdf_status TEXT,
  ADD COLUMN IF NOT EXISTS pdf_error_message TEXT;

ALTER TABLE report_snapshots
  DROP CONSTRAINT IF EXISTS report_snapshots_pdf_status_check;

ALTER TABLE report_snapshots
  ADD CONSTRAINT report_snapshots_pdf_status_check
  CHECK (
    pdf_status IS NULL
    OR pdf_status IN ('queued', 'generating', 'ready', 'failed')
  );

UPDATE report_snapshots
SET
  pdf_status = 'ready',
  pdf_error_message = NULL
WHERE pdf_url IS NOT NULL
  AND pdf_status IS DISTINCT FROM 'ready';

CREATE INDEX IF NOT EXISTS report_snapshots_pdf_status_idx
  ON report_snapshots (pdf_status)
  WHERE pdf_status IS NOT NULL;;
