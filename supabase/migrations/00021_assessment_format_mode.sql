-- Add format mode to assessments
ALTER TABLE assessments
  ADD COLUMN format_mode TEXT NOT NULL DEFAULT 'traditional'
    CHECK (format_mode IN ('traditional', 'forced_choice'));
-- Block size for forced-choice assessments (3 or 4 items per block)
ALTER TABLE assessments
  ADD COLUMN fc_block_size INT
    CHECK (fc_block_size IS NULL OR fc_block_size IN (3, 4));
-- Constraint: fc_block_size required when forced_choice
ALTER TABLE assessments
  ADD CONSTRAINT assessments_fc_block_size_required
    CHECK (format_mode = 'traditional' OR fc_block_size IS NOT NULL);
-- Link blocks to assessments (auto-generated blocks are assessment-scoped)
ALTER TABLE forced_choice_blocks
  ADD COLUMN assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE;
-- Clean up any orphan seed data (manual blocks without assessment)
DELETE FROM forced_choice_block_items
  WHERE block_id IN (SELECT id FROM forced_choice_blocks WHERE assessment_id IS NULL);
DELETE FROM forced_choice_blocks WHERE assessment_id IS NULL;
-- Now make it NOT NULL
ALTER TABLE forced_choice_blocks
  ALTER COLUMN assessment_id SET NOT NULL;
-- Index for fast lookup
CREATE INDEX idx_fc_blocks_assessment ON forced_choice_blocks(assessment_id);
