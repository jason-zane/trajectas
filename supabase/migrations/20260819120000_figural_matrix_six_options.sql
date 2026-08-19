-- Figural matrix items carry SIX options from v3 (2026-08-19 v3 build plan
-- §1). The response format row is shared by every figural-matrix item; items
-- generated before v3 (the v1 and v2 banks) carry five and stay valid — the
-- option count is a per-item fact (cognitive_option_specs rows per item), not
-- a format-level one. The label loses "(5-option)" and the config records the
-- current generator default alongside the legacy count, so the generate page
-- (src/app/(dashboard)/item-bank/generate) shows the right number and nothing
-- downstream can read the format as a promise about older items.
--
-- Idempotent: plain UPDATE on a single known row.
UPDATE response_formats
SET name = 'Figural Matrix',
    config = coalesce(config, '{}'::jsonb)
           || jsonb_build_object(
                'option_count', 6,
                'legacy_option_count', 5,
                'option_count_note', 'per item: 5 for items generated before the 2026-08-19 v3 generator, 6 from v3 on',
                'chance_level', 0.1667
              )
WHERE id = 'a5000000-0000-0000-0000-000000000009'
  AND (name IS DISTINCT FROM 'Figural Matrix' OR coalesce(config->>'option_count', '') IS DISTINCT FROM '6');
