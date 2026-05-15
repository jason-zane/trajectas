-- =============================================================================
-- 20260515120000 — Item difficulty
-- Adds an `easy / medium / hard` difficulty band on items so the assessment
-- composer can spread items evenly across the difficulty spectrum.
--
-- Replaces the old "selection_priority" + per-construct band rules as the
-- primary mechanism for picking which items go into an assessment.
-- selection_priority is kept as a deterministic tiebreaker within a band.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_difficulty') THEN
    CREATE TYPE item_difficulty AS ENUM ('easy', 'medium', 'hard');
  END IF;
END$$;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS difficulty item_difficulty NOT NULL DEFAULT 'medium';

COMMENT ON COLUMN items.difficulty IS
  'Difficulty band — easy / medium / hard. The assessment composer spreads items evenly across these bands; the default is medium so legacy items keep working.';

CREATE INDEX IF NOT EXISTS idx_items_construct_difficulty
  ON items (construct_id, difficulty);
