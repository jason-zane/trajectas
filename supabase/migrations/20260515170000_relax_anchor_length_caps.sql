-- =============================================================================
-- 20260515170000 — Relax anchor_low / anchor_high length caps
-- The 150-char check was too tight for real-world report-narrative anchors.
-- Bump to 500 chars to match the application validation schemas.
-- =============================================================================

ALTER TABLE dimensions DROP CONSTRAINT IF EXISTS dimensions_anchor_low_check;
ALTER TABLE dimensions DROP CONSTRAINT IF EXISTS dimensions_anchor_high_check;
ALTER TABLE factors    DROP CONSTRAINT IF EXISTS factors_anchor_low_check;
ALTER TABLE factors    DROP CONSTRAINT IF EXISTS factors_anchor_high_check;
ALTER TABLE constructs DROP CONSTRAINT IF EXISTS constructs_anchor_low_check;
ALTER TABLE constructs DROP CONSTRAINT IF EXISTS constructs_anchor_high_check;

ALTER TABLE dimensions ADD CONSTRAINT dimensions_anchor_low_check  CHECK (char_length(anchor_low)  <= 500);
ALTER TABLE dimensions ADD CONSTRAINT dimensions_anchor_high_check CHECK (char_length(anchor_high) <= 500);
ALTER TABLE factors    ADD CONSTRAINT factors_anchor_low_check     CHECK (char_length(anchor_low)  <= 500);
ALTER TABLE factors    ADD CONSTRAINT factors_anchor_high_check    CHECK (char_length(anchor_high) <= 500);
ALTER TABLE constructs ADD CONSTRAINT constructs_anchor_low_check  CHECK (char_length(anchor_low)  <= 500);
ALTER TABLE constructs ADD CONSTRAINT constructs_anchor_high_check CHECK (char_length(anchor_high) <= 500);
