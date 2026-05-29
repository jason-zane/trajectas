-- Leadership 360: observer-perspective item wording.
--
-- Each item carries an optional third-person "observer" phrasing alongside its
-- first-person self stem. Self sessions render `stem`; rater (observer) sessions
-- render `stem_observer`. NULL means no observer variant exists yet, which makes
-- the item ineligible for 360 use until backfilled/generated.
--
-- Both perspectives measure the SAME construct with the SAME reverse-scoring,
-- response format, and options — only the displayed text differs. So this is a
-- single nullable column, not a new table.
--
-- See docs/superpowers/specs/2026-05-29-leadership-360-campaigns-design.md §2.4.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS stem_observer TEXT;

COMMENT ON COLUMN items.stem_observer IS
  'Observer/rater-perspective phrasing (third person), e.g. "This leader communicates clearly". '
  'Self phrasing stays in stem. NULL = no observer variant yet (item not 360-eligible).';

-- If present, the observer stem must be non-empty (mirrors items_stem_not_empty).
ALTER TABLE items
  DROP CONSTRAINT IF EXISTS items_stem_observer_not_empty;
ALTER TABLE items
  ADD CONSTRAINT items_stem_observer_not_empty
  CHECK (stem_observer IS NULL OR length(trim(stem_observer)) > 0);

-- The generation pipeline can emit the observer variant alongside the self stem,
-- carried on the candidate row until the item is accepted into `items`.
ALTER TABLE generated_items
  ADD COLUMN IF NOT EXISTS stem_observer TEXT;

COMMENT ON COLUMN generated_items.stem_observer IS
  'Observer-perspective phrasing produced by dual-mode generation; copied to items.stem_observer on accept.';
