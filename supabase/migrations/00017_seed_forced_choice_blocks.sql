-- =============================================================================
-- Migration 00017: Seed Forced Choice Blocks
-- =============================================================================
-- Creates 2 example forced choice blocks using existing seeded items.
-- UUID prefix: ab for blocks, ac for block-item links.
-- Uses ON CONFLICT DO NOTHING for idempotency.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Block 1: Three items from different constructs
-- (Analytical Reasoning, Empathy, Change Management)
-- ---------------------------------------------------------------------------
INSERT INTO forced_choice_blocks (id, name, description, display_order) VALUES
  ('ab000000-0000-0000-0000-000000000001',
   'Cognitive vs Interpersonal vs Leadership',
   'Forced choice block comparing analytical, empathetic, and change management behaviours.',
   1)
ON CONFLICT DO NOTHING;

INSERT INTO forced_choice_block_items (id, block_id, item_id, position) VALUES
  ('ac000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001',
   'a6000000-0000-0000-0000-000000000001', 1),  -- Analytical Reasoning item
  ('ac000000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-000000000001',
   'a6000000-0000-0000-0000-000000000002', 2),  -- Empathy item
  ('ac000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000001',
   'a6000000-0000-0000-0000-000000000004', 3)   -- Adaptability/Change Management item
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Block 2: Three items from different constructs
-- (Empathy, Adaptability, Analytical)
-- ---------------------------------------------------------------------------
INSERT INTO forced_choice_blocks (id, name, description, display_order) VALUES
  ('ab000000-0000-0000-0000-000000000002',
   'People Skills vs Adaptability',
   'Forced choice block comparing interpersonal sensitivity, group facilitation, and adaptability.',
   2)
ON CONFLICT DO NOTHING;

INSERT INTO forced_choice_block_items (id, block_id, item_id, position) VALUES
  ('ac000000-0000-0000-0000-000000000004', 'ab000000-0000-0000-0000-000000000002',
   'a6000000-0000-0000-0000-000000000005', 1),  -- Group facilitation / Empathy item
  ('ac000000-0000-0000-0000-000000000005', 'ab000000-0000-0000-0000-000000000002',
   'a6000000-0000-0000-0000-000000000004', 2),  -- Adaptability item
  ('ac000000-0000-0000-0000-000000000006', 'ab000000-0000-0000-0000-000000000002',
   'a6000000-0000-0000-0000-000000000001', 3)   -- Analytical Reasoning item
ON CONFLICT DO NOTHING;
