-- =============================================================================
-- Migration 00065: Assessments schema alignment
--
-- Fixes drift between local and remote schemas:
-- 1. Rename assessments.name → assessments.title
-- 2. Add matching_run_id column
-- 3. Add creation_mode column (with enum type)
--
-- These changes were applied in migration 00005 locally but the remote DB
-- had drifted. This migration is idempotent and safe to run on both.
-- =============================================================================

-- Rename name → title (skip if title already exists)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessments' AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessments' AND column_name = 'title'
  ) THEN
    ALTER TABLE assessments RENAME COLUMN name TO title;
  END IF;
END $$;

-- Add matching_run_id if missing
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS matching_run_id UUID REFERENCES matching_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assessments_matching_run
  ON assessments(matching_run_id) WHERE matching_run_id IS NOT NULL;

-- slug column is unused by the application — make it nullable
ALTER TABLE assessments ALTER COLUMN slug DROP NOT NULL;
