-- =============================================================================
-- 00007_item_refinement.sql
-- Item layer refinement: construct-centric linking, forced choice blocks,
-- response format activation flags.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1a. Fix seed data — assign NULL trait_id items to Adaptability trait
-- ---------------------------------------------------------------------------
UPDATE items SET trait_id = 'a2000000-0000-0000-0000-000000000003'
  WHERE id IN (
    'a6000000-0000-0000-0000-000000000002',
    'a6000000-0000-0000-0000-000000000005'
  )
  AND trait_id IS NULL;

-- ---------------------------------------------------------------------------
-- 1b. Swap FK direction — trait_id required, competency_id optional
-- ---------------------------------------------------------------------------
ALTER TABLE items ALTER COLUMN trait_id SET NOT NULL;
ALTER TABLE items ALTER COLUMN competency_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 1c. Add is_active flag to response_formats
-- (No inactive types to deactivate — all 4 current formats remain active)
-- ---------------------------------------------------------------------------
ALTER TABLE response_formats ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 1d. Forced choice block tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forced_choice_blocks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    description   TEXT,
    display_order INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fc_blocks_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS forced_choice_block_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id    UUID NOT NULL REFERENCES forced_choice_blocks(id) ON DELETE CASCADE,
    item_id     UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    position    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fc_block_items_unique UNIQUE (block_id, item_id),
    CONSTRAINT fc_block_items_position_unique UNIQUE (block_id, position)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fc_block_items_block ON forced_choice_block_items(block_id);
CREATE INDEX IF NOT EXISTS idx_fc_block_items_item  ON forced_choice_block_items(item_id);

-- Updated_at trigger for blocks
CREATE OR REPLACE TRIGGER set_forced_choice_blocks_updated_at
    BEFORE UPDATE ON forced_choice_blocks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — admin-writable pattern (matching dimensions/traits)
-- ---------------------------------------------------------------------------
ALTER TABLE forced_choice_blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fc_blocks_select') THEN
    CREATE POLICY fc_blocks_select ON forced_choice_blocks FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fc_blocks_insert') THEN
    CREATE POLICY fc_blocks_insert ON forced_choice_blocks FOR INSERT WITH CHECK (is_platform_admin() OR is_partner_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fc_blocks_update') THEN
    CREATE POLICY fc_blocks_update ON forced_choice_blocks FOR UPDATE USING (is_platform_admin() OR is_partner_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fc_blocks_delete') THEN
    CREATE POLICY fc_blocks_delete ON forced_choice_blocks FOR DELETE USING (is_platform_admin());
  END IF;
END $$;

ALTER TABLE forced_choice_block_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fc_block_items_select') THEN
    CREATE POLICY fc_block_items_select ON forced_choice_block_items FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fc_block_items_insert') THEN
    CREATE POLICY fc_block_items_insert ON forced_choice_block_items FOR INSERT WITH CHECK (is_platform_admin() OR is_partner_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fc_block_items_update') THEN
    CREATE POLICY fc_block_items_update ON forced_choice_block_items FOR UPDATE USING (is_platform_admin() OR is_partner_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fc_block_items_delete') THEN
    CREATE POLICY fc_block_items_delete ON forced_choice_block_items FOR DELETE USING (is_platform_admin());
  END IF;
END $$;
