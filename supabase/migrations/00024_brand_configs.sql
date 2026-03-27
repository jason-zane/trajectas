-- =============================================================================
-- Brand Configurations
--
-- Stores brand settings (colors, typography, shape) for the platform and
-- optionally for each organization. The token pipeline transforms these
-- into CSS variables, PDF styles, and email inline styles.
-- =============================================================================

-- Brand owner type
DO $$ BEGIN
  CREATE TYPE brand_owner_type AS ENUM ('platform', 'organization');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Main table
CREATE TABLE IF NOT EXISTS brand_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type  brand_owner_type NOT NULL DEFAULT 'platform',
  owner_id    UUID,                                        -- NULL for platform
  config      JSONB NOT NULL DEFAULT '{}',
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ                                  -- soft-delete
);

-- Unique: one active config per owner
CREATE UNIQUE INDEX IF NOT EXISTS brand_configs_owner_unique
  ON brand_configs (owner_type, owner_id)
  WHERE deleted_at IS NULL;

-- Index for fast org lookups
CREATE INDEX IF NOT EXISTS brand_configs_owner_id_idx
  ON brand_configs (owner_id)
  WHERE deleted_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION brand_configs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS brand_configs_updated_at ON brand_configs;
CREATE TRIGGER brand_configs_updated_at
  BEFORE UPDATE ON brand_configs
  FOR EACH ROW
  EXECUTE FUNCTION brand_configs_set_updated_at();

-- RLS policies
ALTER TABLE brand_configs ENABLE ROW LEVEL SECURITY;

-- Platform admins: full access
CREATE POLICY brand_configs_admin_all ON brand_configs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'platform_admin'
    )
  );

-- Org admins: read their own org config
CREATE POLICY brand_configs_org_read ON brand_configs
  FOR SELECT TO authenticated
  USING (
    owner_type = 'organization'
    AND owner_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'org_admin'
    )
  );

-- Org admins: update their own org config
CREATE POLICY brand_configs_org_update ON brand_configs
  FOR UPDATE TO authenticated
  USING (
    owner_type = 'organization'
    AND owner_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'org_admin'
    )
  );

-- Platform default is readable by everyone (for fallback resolution)
CREATE POLICY brand_configs_default_read ON brand_configs
  FOR SELECT TO authenticated
  USING (
    owner_type = 'platform' AND is_default = true
  );

-- Anonymous access to brand configs (for assessment runner)
CREATE POLICY brand_configs_anon_read ON brand_configs
  FOR SELECT TO anon
  USING (
    (owner_type = 'platform' AND is_default = true)
    OR owner_type = 'organization'
  );

-- =============================================================================
-- Seed: Talent Fit platform default
-- =============================================================================
INSERT INTO brand_configs (owner_type, owner_id, is_default, config)
VALUES (
  'platform',
  NULL,
  true,
  '{
    "name": "TalentFit",
    "primaryColor": "#2d6a5a",
    "accentColor": "#c9a962",
    "neutralTemperature": "neutral",
    "headingFont": "Plus Jakarta Sans",
    "bodyFont": "Plus Jakarta Sans",
    "monoFont": "Geist Mono",
    "borderRadius": "soft",
    "darkModeEnabled": true
  }'::jsonb
)
ON CONFLICT DO NOTHING;
