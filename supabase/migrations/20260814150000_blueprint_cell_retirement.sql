-- 20260814150000_blueprint_cell_retirement.sql
-- Preserve blueprint→item provenance across a blueprint redraft.
--
-- Why this exists:
--   instrument_candidate_items.blueprint_cell_id is ON DELETE SET NULL. Saving a
--   blueprint hard-deleted any cell the new grid no longer listed, which silently
--   cut every item generated from that cell loose from the facet it was written
--   for. An AI redraft renames every facet at once, so in practice a single
--   redraft orphaned an entire build's items (observed 2026-08-14: all 33
--   candidate items on the first live build lost their cell link this way).
--
--   Blueprint→item traceability IS the content-validity argument for the
--   instrument, so losing it is not a cosmetic issue — it destroys the evidence
--   that an item measures the facet it claims to.
--
-- Fix: a cell that has candidate items attached is retired, never deleted.
-- Retired cells stay resolvable as provenance but are excluded from the working
-- grid. Re-adding the same (facet_label, intensity) un-retires the original row
-- and reunites it with its items.

ALTER TABLE instrument_blueprint_cells
  ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;

COMMENT ON COLUMN instrument_blueprint_cells.retired_at IS
  'Set when a cell is removed from the working grid but still has candidate items attached. Retired cells are excluded from the grid but remain resolvable so item provenance survives a blueprint redraft.';

-- The working grid is the common read; retired rows are the rare tail.
CREATE INDEX IF NOT EXISTS idx_instrument_blueprint_cells_active
  ON instrument_blueprint_cells(blueprint_id, display_order)
  WHERE retired_at IS NULL;
