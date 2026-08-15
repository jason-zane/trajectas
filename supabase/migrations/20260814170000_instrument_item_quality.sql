-- Migration: Add item-quality tracking columns to instrument builder engine
-- Date: 2026-08-14
-- Purpose: Instrument engine quality machinery — redundancy detection, critique verdicts, item versioning

-- Add columns to instrument_candidate_items for quality tracking
-- All columns are nullable; populated only when quality passes run
ALTER TABLE IF EXISTS instrument_candidate_items
  ADD COLUMN IF NOT EXISTS redundancy_peer_id UUID REFERENCES instrument_candidate_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redundancy_score NUMERIC,
  ADD COLUMN IF NOT EXISTS critique_verdict TEXT,
  ADD COLUMN IF NOT EXISTS critique_reason TEXT;

-- Add CHECK constraint for critique_verdict values, guarded for replayability
-- Only add if the constraint does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'instrument_candidate_items_critique_verdict_check'
      AND conrelid = 'instrument_candidate_items'::regclass::oid
  ) THEN
    ALTER TABLE instrument_candidate_items
      ADD CONSTRAINT instrument_candidate_items_critique_verdict_check
      CHECK (critique_verdict IS NULL OR critique_verdict IN ('keep', 'revise', 'drop'));
  END IF;
END $$;

-- Add target_item_version to instrument_evidence for versioning snapshots
ALTER TABLE IF EXISTS instrument_evidence
  ADD COLUMN IF NOT EXISTS target_item_version INT;

-- Document each new column
COMMENT ON COLUMN instrument_candidate_items.redundancy_peer_id IS
  'UUID of another item in the same blueprint_cell if identified as redundant via WTO (Weighted Topological Overlap) analysis. '
  'Populated by findRedundantItems() or findRedundantItemsIterative() after embeddings are computed. '
  'Pointers are symmetric. ON DELETE SET NULL ensures deleting a peer does not cascade.';

COMMENT ON COLUMN instrument_candidate_items.redundancy_score IS
  'WTO overlap score [0, 1] quantifying structural similarity to redundancy_peer_id. '
  'Computed from correlation or network adjacency matrix. Informs UI review and automated filtering of redundant candidates.';

COMMENT ON COLUMN instrument_candidate_items.critique_verdict IS
  'Tier 2 quality gate: ''keep'' | ''revise'' | ''drop'' assigned by item-critique LLM pass. '
  'NULL indicates not yet critiqued. Guides filtering and revision workflow before blueprint acceptance.';

COMMENT ON COLUMN instrument_candidate_items.critique_reason IS
  'Free-text explanation for the critique verdict, captured from LLM response (e.g., "conflates constructs" for revise, "poor grammar" for drop). '
  'Enables audit trail and user-facing feedback.';

COMMENT ON COLUMN instrument_evidence.target_item_version IS
  'Versioning hint for instrument_candidate_items rows referenced in this evidence audit record. '
  'Allows evidence snapshots to track which generation/iteration of an item was analyzed.';
