-- Cognitive response format — Migration B: the row itself.
--
-- src/lib/item-bank/ingest.ts requires a `cognitive`-typed `response_formats`
-- row to hang figural-matrix items off. None existed in any environment.
--
-- Shape of the config, and why:
--   option_count 5   Five options is the figural-matrix standard this bank is
--                    built to (doc 03-logical-reasoning-design.md) and what
--                    every generated item emits — slots A-E. It also sets the
--                    blind-guess baseline at .200, which is the number every
--                    elimination-resistance gate in the QA battery is measured
--                    against.
--   selection        Single-select. A matrix has exactly one key
--                    (item_answer_keys is one row per item, PK item_id).
--   scoring          Dichotomous, and scored SERVER-SIDE against
--                    item_answer_keys — never from item_options.score_value,
--                    which 20260813101000's trigger actively forbids for any
--                    item carrying a cognitive spec. Recorded here so nobody
--                    reads the absence of a score_value as an oversight.
--   renderer         The option content is an SVG projected from
--                    cognitive_option_specs, not text. Flagged so a future
--                    editor does not offer a text field for these options.
--
-- Fixed UUID in the a5000000-… series, matching the other seeded formats, so
-- the id is stable across environments and the ingest can reference it without
-- a lookup.
--
-- Idempotent: ON CONFLICT DO UPDATE keeps a re-run from erroring and lets the
-- config be corrected by editing this file plus a follow-up migration.

INSERT INTO response_formats (id, name, type, config)
VALUES (
  'a5000000-0000-0000-0000-000000000009',
  'Figural Matrix (5-option)',
  'cognitive',
  jsonb_build_object(
    'option_count', 5,
    'selection', 'single',
    'scoring', 'dichotomous_server_side',
    'renderer', 'figural_matrix_svg',
    'chance_level', 0.2
  )
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      type = EXCLUDED.type,
      config = EXCLUDED.config;

COMMENT ON TABLE response_formats IS
  'Response format catalogue. The cognitive/figural-matrix format
   (a5000000-0000-0000-0000-000000000009) is scored server-side against
   item_answer_keys, NOT from item_options.score_value — a trigger added in
   20260813101000 rejects a score_value on any item with a cognitive spec.';
