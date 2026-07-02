-- Scoring-integrity hardening.
--
-- 1. Normalize likert anchors to the canonical 1-keyed record shape.
--    The admin form historically persisted anchors as a JSON array; consumers
--    deriving option values from array indices produced 0-based values against
--    1-based scoring bounds (the off-by-one fixed in code by PR #305). This
--    fixes the stored shape so no future consumer can trip on it.
--
-- 2. Retire forced_choice from the authoring surface. Ipsative scoring is out
--    of scope (decision 2026-07-02): deactivate forced_choice formats so they
--    no longer appear in item/section authoring. Rows, items, and runtime
--    rendering are preserved for any legacy data.

update response_formats
set config = jsonb_set(
  config,
  '{anchors}',
  (
    select coalesce(jsonb_object_agg(t.idx::text, to_jsonb(t.elem)), '{}'::jsonb)
    from jsonb_array_elements_text(config -> 'anchors') with ordinality as t(elem, idx)
  )
)
where type = 'likert'
  and jsonb_typeof(config -> 'anchors') = 'array';

update response_formats
set is_active = false
where type = 'forced_choice';
