BEGIN;

-- Atomic wipe-and-replace for an assessment's factor selection.
--
-- The builder's Composition tab previously issued DELETE then INSERT as two
-- separate auto-commit statements with the delete's error unchecked. Two
-- writers (second tab, partner portal, admin + partner) could interleave as
-- del/del/ins/ins → unique violation (assessment_factors_unique) or a merged
-- union, and a failure between the statements stranded the assessment with
-- zero factors. The advisory xact lock serialises writers per assessment and
-- the single transaction makes the replacement all-or-nothing.
--
-- Array order is meaningful: display_order is assigned from jsonb position so
-- the canvas ordering the user arranged survives a round trip.
CREATE OR REPLACE FUNCTION replace_assessment_factors(
  p_assessment_id uuid,
  p_factors jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('assessment_factors:' || p_assessment_id::text, 0)
  );

  DELETE FROM assessment_factors WHERE assessment_id = p_assessment_id;

  INSERT INTO assessment_factors (assessment_id, factor_id, weight, item_count, display_order)
  SELECT
    p_assessment_id,
    (t.elem->>'factor_id')::uuid,
    COALESCE((t.elem->>'weight')::numeric, 1),
    COALESCE((t.elem->>'item_count')::int, 0),
    (t.ord - 1)::int
  FROM jsonb_array_elements(COALESCE(p_factors, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord);
END;
$$;

-- Service-role only: not intended for direct client RPC (see
-- 20260512150000_trajectory_revoke_trigger_fn_exec.sql for the pattern).
REVOKE EXECUTE ON FUNCTION replace_assessment_factors(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION replace_assessment_factors(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION replace_assessment_factors(uuid, jsonb) FROM authenticated;

COMMIT;
