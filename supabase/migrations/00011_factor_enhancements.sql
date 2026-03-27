BEGIN;

-- Matching engine eligibility (separate from is_active)
ALTER TABLE factors
  ADD COLUMN IF NOT EXISTS is_match_eligible BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_factors_match_eligible
  ON factors(is_match_eligible) WHERE is_match_eligible = true;

-- Client organisation ownership (NULL = platform-global)
ALTER TABLE factors
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_factors_organization
  ON factors(organization_id) WHERE organization_id IS NOT NULL;

COMMIT;
