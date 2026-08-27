-- Internal pilot v3 — the six-option form over the widened family set:
-- the twelve v2 families with new surfaces plus eight new families
-- (reflection, fill×rotation, fill×count, count arithmetic, intersection,
-- corner XOR, stroke XOR, nested containers). Plan:
-- docs/superpowers/specs/2026-08-19-cognitive-v3-build-plan.md §4.
--
-- Every statement is idempotent; re-running completes a partial apply.
-- v1 (b3…0001) and v2 (b3…0002) are left exactly as they are.
--
-- ORDER OF OPERATIONS. (1) Apply migration
-- 20260819120000_figural_matrix_six_options.sql (response-format label and
-- option_count). (2) Ingest the v3 bank with seed v3-2026-08-19, 12 per
-- family, via /cognitive-items/generate (or ingest-to-live.ts). (3) Run this file.
-- Section 3 places items by family and generator seed; with no such items
-- present it places nothing, and re-running after the ingest completes it.
--
-- Parameters:
--   BANK_SEED      = 'v3-2026-08-19'  (placement pinned to EXACTLY this run:
--                   `generator_seed LIKE 'v3-2026-08-19/%'`)
--   SCORED_ITEMS   = 28  (JH: 24–30; 28 keeps 75 s/item at 35 min)
--   SECTION_SECS   = 2100 (35 min; Spearman–Brown from the v1 KR-20 puts 28
--                   items at the decision-grade end of the 24–30 range)

-- ---------------------------------------------------------------------------
-- 1. Taxonomy — unchanged (dimension b1…0001, factor b2…0001, construct
--    a2…0006). Family rows for the eight new families are created by the
--    ingest with their priors; existing family rows keep their v2 priors.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2. The assessment, its two sections, and the factor link.
-- ---------------------------------------------------------------------------
INSERT INTO assessments (id, client_id, title, slug, description, status, scoring_profile, internal_pilot, scoring_method, time_limit_minutes)
VALUES (
  'b3000000-0000-0000-0000-000000000003',
  '955087a4-e632-431b-a668-39d128f709c9',  -- Acme Test Co (TEST)
  'Figural Matrix Reasoning — Internal Pilot v3',
  'figural-matrix-reasoning-internal-pilot-v3',
  'A 28-item figural matrix reasoning test with six options per item, in three difficulty tiers with no two adjacent items from the same family, preceded by three unscored practice items from a family the scored section does not use. Twenty families: rules R0–R12 (constant, progression, rotation, movement, union, difference, distribution of three, XOR, size, fill, reflection, intersection, count arithmetic) over shapes, fills, sizes, corner marks, bars, strokes, nested containers and bit-grids. Items are unreviewed and uncalibrated: the result is a raw number correct, not a percentile against any norm group.',
  'active', 'ability_dichotomous', true, 'ctt', 45
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_sections (id, assessment_id, response_format_id, title, instructions, display_order, section_role, item_ordering, allow_back_nav, time_limit_seconds)
VALUES
 ('b4000000-0000-0000-0000-000000000005','b3000000-0000-0000-0000-000000000003','a5000000-0000-0000-0000-000000000009',
  'Practice',
  'Three practice puzzles. Each grid follows a rule; work out the rule and pick the figure that completes it. These do not count towards your score — they are here so the format is familiar before the test starts. Take as long as you like.',
  1, 'practice', 'fixed', true, NULL),
 ('b4000000-0000-0000-0000-000000000006','b3000000-0000-0000-0000-000000000003','a5000000-0000-0000-0000-000000000009',
  'Matrix Reasoning',
  'Twenty-eight puzzles, roughly easiest to hardest. Each grid follows one or more rules; pick the one of six figures that completes it. There is exactly one correct answer. Choosing an answer takes you to the next puzzle; use Back if you want to change one. An unanswered item is scored as incorrect — so answer every one, even if you are guessing. You have 35 minutes; the clock is in the corner.',
  2, 'scored', 'fixed', true, 2100)
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_factors (assessment_id, factor_id, display_order, weight, composite_weight)
VALUES ('b3000000-0000-0000-0000-000000000003','b2000000-0000-0000-0000-000000000001',1,1,1)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Item placement — 3 practice + 28 scored, three tiers, interleaved.
-- ---------------------------------------------------------------------------
-- Same construction as v2 (round-robin over families inside a tier: round k
-- = the k-th item of every family, families in family_order, so adjacent
-- items always differ in family; tiers keep the ramp). Tier 3 holds the
-- ceiling families with BITS-2OP last in family_order, so the form ends on
-- the two hardest items without placing them next to each other.
--
-- Only items from THE v3 generation run are eligible:
-- `generator_seed LIKE 'v3-2026-08-19/%'`.
WITH quota(code, tier, family_order, practice_n, scored_n) AS (VALUES
  -- practice (unscored; family absent from the scored section)
  ('LRM-PROG-COUNT',      0, 1, 3, 0),
  -- tier 1 — easy (7): single cheap rule, or reflection
  ('LRM-MIRROR',          1, 1, 0, 2),
  ('LRM-ROT',             1, 2, 0, 2),
  ('LRM-FILL-COUNT',      1, 3, 0, 2),
  ('LRM-MOVE',            1, 4, 0, 1),
  -- tier 2 — moderate (9): one operator rule, or two rules
  ('LRM-SUB',             2, 1, 0, 1),
  ('LRM-NEST-ADD',        2, 2, 0, 1),
  ('LRM-SUM',             2, 3, 0, 1),
  ('LRM-DOTS-AND',        2, 4, 0, 1),
  ('LRM-ADD',             2, 5, 0, 1),
  ('LRM-FILL-ROT',        2, 6, 0, 1),
  ('LRM-2R-XLAYER',       2, 7, 0, 1),
  ('LRM-3R-DIST',         2, 8, 0, 1),
  ('LRM-STROKE-XOR',      2, 9, 0, 1),
  -- tier 3 — hard and the ceiling (12)
  ('LRM-BITS-XOR',        3, 1, 0, 2),
  ('LRM-XOR-XLAYER',      3, 2, 0, 2),
  ('LRM-CORNER-XOR',      3, 3, 0, 2),
  ('LRM-XOR-DIST-XLAYER', 3, 4, 0, 2),
  ('LRM-3R-XLAYER',       3, 5, 0, 2),
  ('LRM-BITS-2OP',        3, 6, 0, 2)
),
ranked AS (
  SELECT i.id, f.code, f.predicted_b,
         row_number() OVER (PARTITION BY f.code ORDER BY s.generator_seed, i.id) AS rn
  FROM items i
  JOIN item_families f ON f.id = i.family_id
  JOIN cognitive_item_specs s ON s.item_id = i.id
  WHERE s.generator_seed LIKE 'v3-2026-08-19/%'
    AND i.deleted_at IS NULL
),
picked AS (
  SELECT r.id, r.code, r.predicted_b, r.rn, q.tier, q.family_order,
         CASE WHEN r.rn <= q.practice_n THEN 'practice' ELSE 'scored' END AS bucket,
         CASE WHEN r.rn <= q.practice_n THEN r.rn ELSE r.rn - q.practice_n END AS k
  FROM ranked r
  JOIN quota q ON q.code = r.code
  WHERE r.rn <= q.practice_n + q.scored_n
),
numbered AS (
  SELECT id, bucket,
         row_number() OVER (PARTITION BY bucket ORDER BY tier, k, family_order) AS display_order
  FROM picked
)
INSERT INTO assessment_section_items (section_id, item_id, display_order)
SELECT CASE WHEN bucket = 'practice'
            THEN 'b4000000-0000-0000-0000-000000000005'::uuid
            ELSE 'b4000000-0000-0000-0000-000000000006'::uuid END,
       id, display_order
FROM numbered
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. The internal campaign that delivers it (is_internal: excluded from
--    calibration).
-- ---------------------------------------------------------------------------
INSERT INTO campaigns (id, title, slug, description, status, client_id, is_internal, kind, opens_at, closes_at, allow_resume, show_progress)
VALUES (
  'b5000000-0000-0000-0000-000000000003',
  'Figural Matrix Pilot v3 — internal',
  'figural-matrix-pilot-v3-internal',
  'Third internal benchmarking round: six options, twenty families across rules R0–R12 and eight surfaces, 28 scored items in 35 minutes. Marked internal so these sessions are excluded from item calibration.',
  'active',
  '955087a4-e632-431b-a668-39d128f709c9',
  true, 'self',
  now(), now() + interval '90 days',
  true, true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO campaign_assessments (campaign_id, assessment_id, display_order, is_required)
VALUES ('b5000000-0000-0000-0000-000000000003','b3000000-0000-0000-0000-000000000003',1,true)
ON CONFLICT DO NOTHING;

-- To sit it, add a participant and visit /assess/<access_token>:
--   INSERT INTO campaign_participants (campaign_id, email, first_name, last_name, status, invited_at)
--   VALUES ('b5000000-0000-0000-0000-000000000003', 'you@example.com', 'First', 'Last', 'invited', now())
--   RETURNING access_token;

-- Sanity report (read-only): the placed form, in order, with family and prior.
-- SELECT s.title AS section, asi.display_order, f.code, f.predicted_b, cs.generator_seed
-- FROM assessment_section_items asi
-- JOIN assessment_sections s ON s.id = asi.section_id
-- JOIN items i ON i.id = asi.item_id
-- JOIN item_families f ON f.id = i.family_id
-- JOIN cognitive_item_specs cs ON cs.item_id = i.id
-- WHERE s.assessment_id = 'b3000000-0000-0000-0000-000000000003'
-- ORDER BY s.display_order, asi.display_order;
