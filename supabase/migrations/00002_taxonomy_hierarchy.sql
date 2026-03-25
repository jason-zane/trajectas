-- =============================================================================
-- Migration 00002: Taxonomy Hierarchy
-- =============================================================================
-- Adds the four-level assessment hierarchy:
--   Dimension → Competency → Trait → Item
--
-- Dimensions: top-level ideological groupings (e.g., "Leadership Focus")
-- Competencies: behavioural manifestations, optionally grouped into dimensions
-- Traits: innate person-level metrics, linked to competencies with weights
-- Items: questions/stimuli, linked to traits (or directly to competencies)
--
-- The trait layer is optional — items can link directly to a competency
-- when trait-level measurement isn't needed.
-- =============================================================================

-- Add 'ranking' response format if not present
ALTER TYPE response_format_type ADD VALUE IF NOT EXISTS 'ranking';

-- ---------------------------------------------------------------------------
-- dimensions (replaces the concept of competency_categories)
-- ---------------------------------------------------------------------------
CREATE TABLE dimensions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id    UUID        REFERENCES partners(id) ON DELETE SET NULL,
    name          TEXT        NOT NULL,
    slug          CITEXT      NOT NULL,
    description   TEXT,
    is_scored     BOOLEAN     NOT NULL DEFAULT false,
    display_order INT         NOT NULL DEFAULT 0,
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT dimensions_slug_unique UNIQUE (slug),
    CONSTRAINT dimensions_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$' AND length(slug) >= 2),
    CONSTRAINT dimensions_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE dimensions IS
    'Top-level groupings for competencies (e.g., Leadership Focus, Cognitive). Optional layer — competencies can exist without a dimension.';

-- ---------------------------------------------------------------------------
-- Add dimension_id to competencies
-- ---------------------------------------------------------------------------
ALTER TABLE competencies
    ADD COLUMN dimension_id UUID REFERENCES dimensions(id) ON DELETE SET NULL;

COMMENT ON COLUMN competencies.dimension_id IS
    'Optional parent dimension. NULL means the competency is ungrouped.';

-- ---------------------------------------------------------------------------
-- traits
-- ---------------------------------------------------------------------------
CREATE TABLE traits (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id    UUID        REFERENCES partners(id) ON DELETE SET NULL,
    name          TEXT        NOT NULL,
    slug          CITEXT      NOT NULL,
    description   TEXT,
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT traits_slug_unique UNIQUE (slug),
    CONSTRAINT traits_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$' AND length(slug) >= 2),
    CONSTRAINT traits_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE traits IS
    'Innate person-level metrics measured by assessment items. Traits feed into competencies via weighted links.';

-- ---------------------------------------------------------------------------
-- competency_traits (junction with configurable weights)
-- ---------------------------------------------------------------------------
CREATE TABLE competency_traits (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_id  UUID    NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
    trait_id       UUID    NOT NULL REFERENCES traits(id) ON DELETE CASCADE,
    weight         NUMERIC NOT NULL DEFAULT 1.0,
    display_order  INT     NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT competency_traits_unique UNIQUE (competency_id, trait_id),
    CONSTRAINT competency_traits_weight_positive CHECK (weight > 0)
);

COMMENT ON TABLE competency_traits IS
    'Links traits to competencies with configurable weights for score rollup. A competency can have multiple traits.';

-- ---------------------------------------------------------------------------
-- Add trait_id to items (optional — items can link to trait OR directly to competency)
-- ---------------------------------------------------------------------------
ALTER TABLE items
    ADD COLUMN trait_id UUID REFERENCES traits(id) ON DELETE SET NULL;

COMMENT ON COLUMN items.trait_id IS
    'Optional trait this item measures. When NULL, the item measures the competency directly.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_dimensions_partner ON dimensions(partner_id);
CREATE INDEX idx_dimensions_active ON dimensions(is_active) WHERE is_active = true;
CREATE INDEX idx_competencies_dimension ON competencies(dimension_id);
CREATE INDEX idx_traits_partner ON traits(partner_id);
CREATE INDEX idx_traits_active ON traits(is_active) WHERE is_active = true;
CREATE INDEX idx_competency_traits_competency ON competency_traits(competency_id);
CREATE INDEX idx_competency_traits_trait ON competency_traits(trait_id);
CREATE INDEX idx_items_trait ON items(trait_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE traits ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_traits ENABLE ROW LEVEL SECURITY;

-- Dimensions: readable by all, writable by platform/partner admins
CREATE POLICY dimensions_select ON dimensions FOR SELECT USING (true);
CREATE POLICY dimensions_insert ON dimensions FOR INSERT WITH CHECK (is_platform_admin() OR is_partner_admin());
CREATE POLICY dimensions_update ON dimensions FOR UPDATE USING (is_platform_admin() OR is_partner_admin());
CREATE POLICY dimensions_delete ON dimensions FOR DELETE USING (is_platform_admin());

-- Traits: readable by all, writable by platform/partner admins
CREATE POLICY traits_select ON traits FOR SELECT USING (true);
CREATE POLICY traits_insert ON traits FOR INSERT WITH CHECK (is_platform_admin() OR is_partner_admin());
CREATE POLICY traits_update ON traits FOR UPDATE USING (is_platform_admin() OR is_partner_admin());
CREATE POLICY traits_delete ON traits FOR DELETE USING (is_platform_admin());

-- Competency-trait links: readable by all, writable by platform/partner admins
CREATE POLICY competency_traits_select ON competency_traits FOR SELECT USING (true);
CREATE POLICY competency_traits_insert ON competency_traits FOR INSERT WITH CHECK (is_platform_admin() OR is_partner_admin());
CREATE POLICY competency_traits_update ON competency_traits FOR UPDATE USING (is_platform_admin() OR is_partner_admin());
CREATE POLICY competency_traits_delete ON competency_traits FOR DELETE USING (is_platform_admin());

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_dimensions_updated_at
    BEFORE UPDATE ON dimensions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_traits_updated_at
    BEFORE UPDATE ON traits
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
