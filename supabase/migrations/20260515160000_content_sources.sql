-- =============================================================================
-- 20260515160000 — content_sources (provenance / IP attribution)
-- A simple admin-managed list of "where this content came from" — e.g.
-- "Executive Performance Partners". NOT linked to the clients table; it's a
-- label, not a tenant relationship. Nullable source_id sits on dimensions,
-- factors, constructs, items, and assessments so any level can be tagged.
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT content_sources_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT content_sources_slug_not_empty CHECK (length(trim(slug)) > 0)
);

COMMENT ON TABLE content_sources IS
  'Admin-managed provenance list — labels for where library content (assessments / factors / constructs / dimensions / items) originated. Independent of the clients table.';

ALTER TABLE content_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_sources_select_all ON content_sources
  FOR SELECT USING (true);

CREATE POLICY content_sources_admin_all ON content_sources
  FOR ALL USING (is_platform_admin() OR is_partner_admin());

DROP TRIGGER IF EXISTS set_content_sources_updated_at ON content_sources;
CREATE TRIGGER set_content_sources_updated_at
  BEFORE UPDATE ON content_sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Nullable source_id on the five entity tables. ON DELETE SET NULL so removing
-- a source doesn't take its content with it.
-- ---------------------------------------------------------------------------

ALTER TABLE dimensions
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES content_sources(id) ON DELETE SET NULL;
ALTER TABLE factors
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES content_sources(id) ON DELETE SET NULL;
ALTER TABLE constructs
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES content_sources(id) ON DELETE SET NULL;
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES content_sources(id) ON DELETE SET NULL;
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES content_sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dimensions_source_id ON dimensions(source_id);
CREATE INDEX IF NOT EXISTS idx_factors_source_id    ON factors(source_id);
CREATE INDEX IF NOT EXISTS idx_constructs_source_id ON constructs(source_id);
CREATE INDEX IF NOT EXISTS idx_items_source_id      ON items(source_id);
CREATE INDEX IF NOT EXISTS idx_assessments_source_id ON assessments(source_id);
