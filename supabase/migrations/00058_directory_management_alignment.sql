-- Align tenant directory tables with the current app model.

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS size_range TEXT;
UPDATE organizations
SET size_range = size
WHERE size_range IS NULL
  AND size IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_not_deleted
  ON partners (deleted_at)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partners_active
  ON partners (is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_organizations_active
  ON organizations (is_active)
  WHERE is_active = true;
