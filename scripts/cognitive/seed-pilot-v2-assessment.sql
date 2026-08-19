-- Internal pilot v2 — the first form built after the distractor redesign
-- (G-08′/G-20), the family-interleaved ordering, the bit-grid ceiling
-- families, and the tap-advances/Back-revises runner (PR #367). Plan:
-- docs/superpowers/specs/2026-08-19-cognitive-v2-build-plan.md §5.
--
-- Every statement is idempotent; re-running completes a partial apply.
-- v1 (seed-pilot-assessment.sql, ids b3…0001 / b4…0001-2 / b5…0001) is left
-- exactly as it is: it is the round-1 record.
--
-- ORDER OF OPERATIONS. The v2 bank must be ingested BEFORE this runs
-- (scripts/cognitive/ingest-to-live.ts --seed=v2-2026-08-19 --per-family=12,
-- or /item-bank/generate with the same seed). Section 3 below places items
-- by family and generator seed; with no such items present it places
-- nothing, and re-running after the ingest completes the placement.
--
-- REQUIRES migration 20260817103000_internal_pilot_assessments.sql
-- (`assessments.internal_pilot`, the named exception that lets unreviewed
-- draft items be served internally and only internally).
--
-- Parameters, deliberately at the top so 28/35 or 30/37 is a one-line change:
--   BANK_SEED      = 'v2-2026-08-19'  (the ingest seed; placement below is
--                   pinned to EXACTLY this run — `generator_seed` is stored
--                   as '<seed>/<family>/<n>', so the predicate is
--                   `LIKE 'v2-2026-08-19/%'`, not `'v2-%'`: another run whose
--                   seed merely starts with v2- must never mix into the form)
--   SCORED_ITEMS   = 24  (JH: 24–30)
--   SECTION_SECS   = 1800 (30 min = 75 s/item, HeiQ-S's validated pace;
--                   the pilot-1 90th-percentile item time was 135 s)

-- ---------------------------------------------------------------------------
-- 1. Taxonomy — unchanged from v1 (dimension b1…0001, factor b2…0001,
--    construct a2…0006). Nothing to do; v1's seed created them.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1b. Family priors — refresh for the families whose plans changed.
-- ---------------------------------------------------------------------------
-- The ingest deliberately leaves an existing item_families row untouched
-- (src/lib/item-bank/plan.ts: a re-authored family that produced different
-- radicals would surface as hash conflicts, and silently rewriting the row
-- would erase that evidence). The 2026-08-19 change is different in kind:
-- the plans changed on purpose and the prior gained a documented cheap-rule
-- discount (generator/difficulty.ts, build-plan §3), so the row is refreshed
-- here, explicitly. These are ORDERING PRIORS until calibration replaces
-- them; the v2 form does not order by them inside a tier (§3 below).
UPDATE item_families SET predicted_b = 0.35, band = 'moderate' WHERE code = 'LRM-2R-XLAYER'      AND predicted_b IS DISTINCT FROM 0.35;
UPDATE item_families SET predicted_b = 0.35, band = 'moderate' WHERE code = 'LRM-3R-DIST'        AND predicted_b IS DISTINCT FROM 0.35;
UPDATE item_families SET predicted_b = 1.30, band = 'hard'     WHERE code = 'LRM-3R-XLAYER'      AND predicted_b IS DISTINCT FROM 1.30;
UPDATE item_families SET predicted_b = 1.35, band = 'hard'     WHERE code = 'LRM-XOR-DIST-XLAYER' AND predicted_b IS DISTINCT FROM 1.35;
-- LRM-XOR-XLAYER stays +0.90 (its cheap R1 already weighed 0); single-rule
-- families are unchanged; LRM-BITS-XOR (+0.20) and LRM-BITS-2OP (+2.00) are
-- created by the ingest with their priors.

-- ---------------------------------------------------------------------------
-- 2. The assessment, its two sections, and the factor link.
-- ---------------------------------------------------------------------------
INSERT INTO assessments (id, client_id, title, slug, description, status, scoring_profile, internal_pilot, scoring_method, time_limit_minutes)
VALUES (
  'b3000000-0000-0000-0000-000000000002',
  '955087a4-e632-431b-a668-39d128f709c9',  -- Acme Test Co (TEST)
  'Figural Matrix Reasoning — Internal Pilot v2',
  'figural-matrix-reasoning-internal-pilot-v2',
  'A 24-item figural matrix reasoning test in three difficulty tiers with no two adjacent items from the same family, preceded by three unscored practice items from a family the scored section does not use. Built after the first pilot to remove the option-set leak (redesign spec 2026-08-19), the family-block reuse effect, and to add a Boolean bit-grid ceiling. Items are unreviewed and uncalibrated: the result is a raw number correct, not a percentile against any norm group.',
  'active', 'ability_dichotomous', true, 'ctt', 40
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_sections (id, assessment_id, response_format_id, title, instructions, display_order, section_role, item_ordering, allow_back_nav, time_limit_seconds)
VALUES
 ('b4000000-0000-0000-0000-000000000003','b3000000-0000-0000-0000-000000000002','a5000000-0000-0000-0000-000000000009',
  'Practice',
  'Three practice puzzles. Each grid follows a rule; work out the rule and pick the figure that completes it. These do not count towards your score — they are here so the format is familiar before the test starts. Take as long as you like.',
  1, 'practice', 'fixed', true, NULL),
 ('b4000000-0000-0000-0000-000000000004','b3000000-0000-0000-0000-000000000002','a5000000-0000-0000-0000-000000000009',
  'Matrix Reasoning',
  'Twenty-four puzzles, roughly easiest to hardest. Each grid follows one or more rules; pick the figure that completes it. There is exactly one correct answer. Choosing an answer takes you to the next puzzle; use Back if you want to change one. An unanswered item is scored as incorrect — so answer every one, even if you are guessing. You have 30 minutes; the clock is in the corner.',
  2, 'scored', 'fixed', true, 1800)
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_factors (assessment_id, factor_id, display_order, weight, composite_weight)
VALUES ('b3000000-0000-0000-0000-000000000002','b2000000-0000-0000-0000-000000000001',1,1,1)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Item placement — 3 practice + 24 scored, three tiers, interleaved.
-- ---------------------------------------------------------------------------
-- Why tiers and a round-robin rather than "ORDER BY predicted_b": ordering
-- by a per-family prior produces BLOCKS of the same family (v1: 3+3+3+3+2+…),
-- and in the round-1 sitting five of the six misses were the first item of
-- a block — the later items in each block looked like rule reuse, not
-- induction (benchmark doc §3.3). Round-robin over families inside a tier
-- guarantees no two adjacent items share a family; tiers keep the ramp.
--
-- Why PROG-COUNT is practice-only: round 1's scored positions 1–2 were the
-- same family as the three practice items — pre-taught.
--
-- Selection is deterministic (ordered by generator seed, then item id) so
-- re-running picks the same items. Only items from THE v2 generation run are
-- eligible: `generator_seed LIKE 'v2-2026-08-19/%'` — the ingest is run with
-- exactly that seed (see the hand-over note); a later v2 bank gets its own
-- seed AND its own copy of this file. Predicted b is read from the family
-- row at placement time for the report, not used for ordering inside a tier.
WITH quota(code, tier, family_order, practice_n, scored_n) AS (VALUES
  -- practice (unscored; family absent from the scored section)
  ('LRM-PROG-COUNT',      0, 1, 3, 0),
  -- tier 1 — single-rule
  ('LRM-ROT',             1, 1, 0, 2),
  ('LRM-MOVE',            1, 2, 0, 2),
  ('LRM-SUB',             1, 3, 0, 2),
  ('LRM-ADD',             1, 4, 0, 2),
  -- tier 2 — two rules, or one hard rule on a heavy surface
  ('LRM-2R-XLAYER',       2, 1, 0, 2),
  ('LRM-3R-DIST',         2, 2, 0, 2),
  ('LRM-XOR-XLAYER',      2, 3, 0, 2),
  ('LRM-BITS-XOR',        2, 4, 0, 2),
  -- tier 3 — the ceiling
  ('LRM-XOR-DIST-XLAYER', 3, 1, 0, 3),
  ('LRM-3R-XLAYER',       3, 2, 0, 3),
  ('LRM-BITS-2OP',        3, 3, 0, 2)
),
ranked AS (
  SELECT i.id, f.code, f.predicted_b,
         row_number() OVER (PARTITION BY f.code ORDER BY s.generator_seed, i.id) AS rn
  FROM items i
  JOIN item_families f ON f.id = i.family_id
  JOIN cognitive_item_specs s ON s.item_id = i.id
  WHERE s.generator_seed LIKE 'v2-2026-08-19/%'
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
  -- Inside a tier: round k = the k-th item of every family, families in
  -- family_order. Adjacent items therefore always differ in family.
  SELECT id, bucket,
         row_number() OVER (PARTITION BY bucket ORDER BY tier, k, family_order) AS display_order
  FROM picked
)
INSERT INTO assessment_section_items (section_id, item_id, display_order)
SELECT CASE WHEN bucket = 'practice'
            THEN 'b4000000-0000-0000-0000-000000000003'::uuid
            ELSE 'b4000000-0000-0000-0000-000000000004'::uuid END,
       id, display_order
FROM numbered
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. The internal campaign that delivers it (is_internal: excluded from
--    calibration — our own attempts at our own test are not item statistics).
-- ---------------------------------------------------------------------------
INSERT INTO campaigns (id, title, slug, description, status, client_id, is_internal, kind, opens_at, closes_at, allow_resume, show_progress)
VALUES (
  'b5000000-0000-0000-0000-000000000002',
  'Figural Matrix Pilot v2 — internal',
  'figural-matrix-pilot-v2-internal',
  'Second internal benchmarking round: redesigned option sets, interleaved form, bit-grid ceiling. Marked internal so these sessions are excluded from item calibration.',
  'active',
  '955087a4-e632-431b-a668-39d128f709c9',
  true, 'self',
  now(), now() + interval '90 days',
  true, true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO campaign_assessments (campaign_id, assessment_id, display_order, is_required)
VALUES ('b5000000-0000-0000-0000-000000000002','b3000000-0000-0000-0000-000000000002',1,true)
ON CONFLICT DO NOTHING;

-- To sit it, add a participant and visit /assess/<access_token>:
--   INSERT INTO campaign_participants (campaign_id, email, first_name, last_name, status, invited_at)
--   VALUES ('b5000000-0000-0000-0000-000000000002', 'you@example.com', 'First', 'Last', 'invited', now())
--   RETURNING access_token;

-- Sanity report (read-only): the placed form, in order, with family and prior.
-- SELECT s.title AS section, asi.display_order, f.code, f.predicted_b, cs.generator_seed
-- FROM assessment_section_items asi
-- JOIN assessment_sections s ON s.id = asi.section_id
-- JOIN items i ON i.id = asi.item_id
-- JOIN item_families f ON f.id = i.family_id
-- JOIN cognitive_item_specs cs ON cs.item_id = i.id
-- WHERE s.assessment_id = 'b3000000-0000-0000-0000-000000000002'
-- ORDER BY s.display_order, asi.display_order;
