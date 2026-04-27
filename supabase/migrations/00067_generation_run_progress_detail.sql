-- Add progress_detail column to generation_runs for granular progress messages
ALTER TABLE generation_runs
  ADD COLUMN IF NOT EXISTS progress_detail TEXT;
COMMENT ON COLUMN generation_runs.progress_detail IS
  'Human-readable detail text for the current pipeline step (e.g. "Resilience: batch 3, 42/60 items")';
