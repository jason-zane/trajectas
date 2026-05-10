-- Migration: Add soft-delete support to entity tables
-- Adds `deleted_at` column; NULL = active, timestamp = soft-deleted.

ALTER TABLE dimensions    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE factors       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE constructs    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE items         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE assessments   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
-- Index for fast filtering of non-deleted rows
CREATE INDEX IF NOT EXISTS idx_dimensions_not_deleted    ON dimensions    (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_factors_not_deleted       ON factors       (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_constructs_not_deleted    ON constructs    (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_not_deleted         ON items         (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assessments_not_deleted   ON assessments   (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_not_deleted ON organizations (deleted_at) WHERE deleted_at IS NULL;
