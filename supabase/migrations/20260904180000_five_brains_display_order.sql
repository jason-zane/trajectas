BEGIN;

-- Author the 5Brains framework order into the taxonomy.
--
-- Every one of the five brain dimensions sat at display_order = 0, so nothing
-- in the data said what order they belong in. Each results surface therefore
-- invented its own tiebreak: the session results panel and the consultant
-- summary email ranked by score, builder-driven reports sorted alphabetically,
-- and the comparison matrix took raw Postgres row order. Only the hand-coded
-- 5Brains PDF was right, because it hardcodes the sequence.
--
-- The framework order is red → orange → green → blue → pink. Writing it here
-- makes dimensions.display_order the single source of truth that every surface
-- now sorts by; the report keeps its own constant as a belt-and-braces
-- guarantee for that one document.
--
-- Idempotent and slug-keyed: a no-op on any database that does not carry these
-- dimensions (a fresh local reset, CI), and safe to replay.

UPDATE dimensions AS d
SET    display_order = v.display_order
FROM (
  VALUES
    ('red-brain',    1),
    ('orange-brain', 2),
    ('green-brain',  3),
    ('blue-brain',   4),
    ('pink-brain',   5)
) AS v(slug, display_order)
WHERE d.slug = v.slug::citext
  AND d.display_order IS DISTINCT FROM v.display_order;

COMMIT;
