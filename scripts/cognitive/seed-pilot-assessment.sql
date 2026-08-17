-- The internal pilot: a takeable figural matrix test built from the generated
-- bank, for finding out whether the instrument produces sensible scores before
-- anyone spends a day reviewing 98 items.
--
-- Applied to production 2026-08-17. Committed so that what is live is
-- reproducible from source rather than existing only as a chat transcript.
-- Every statement is idempotent; re-running completes a partial apply.
--
-- REQUIRES migration 20260817103000_internal_pilot_assessments.sql, which
-- creates `assessments.internal_pilot`. Without it the item placement in
-- section 3 below is refused by the review gate, which is the point of the
-- gate.
--
-- What this deliberately does NOT do: write to `item_reviews`. The 98 items
-- are unreviewed and stay unreviewed. `internal_pilot` states that out loud
-- and the triggers keep the claim honest — the assessment cannot be attached
-- to a non-internal campaign, and the flag cannot be cleared while unreviewed
-- items remain placed.

-- ---------------------------------------------------------------------------
-- 1. Taxonomy. Kept out of the Five Brains dimensions on purpose.
-- ---------------------------------------------------------------------------
-- Those five describe developable capability measured by self-report on a
-- 1-5 scale. These are ability items scored 0/1. A rollup averaging the two
-- means nothing, which is the mistake that put this bank under "Analytical
-- Thinking" the first time (fixed by 20260815073143).
INSERT INTO dimensions (id, name, slug, description, definition, is_scored, is_active, display_order)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'Cognitive Ability',
  'cognitive-ability',
  'Maximal-performance reasoning measures, scored right/wrong against an answer key.',
  'Cognitive Ability is deliberately separate from the Five Brains capability dimensions. Those describe developable workplace capability and are measured by self-report on a rating scale; these are ability tests with a correct answer. Mixing the two into one rollup would average 1-5 ratings with 0/1 correctness, which is meaningless. Keeping them apart is what makes each rollup interpretable.',
  true, true, 99
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO factors (
  id, name, slug, dimension_id, primary_category_id, description, definition,
  readiness, is_active, is_match_eligible,
  band_label_low, band_label_mid, band_label_high,
  indicators_low, indicators_mid, indicators_high,
  theoretical_lineage
)
VALUES (
  'b2000000-0000-0000-0000-000000000001',
  'Figural Matrix Reasoning',
  'figural-matrix-reasoning',
  'b1000000-0000-0000-0000-000000000001',
  '2e8a9d55-a661-42d7-9335-3e5601d41444',  -- library category: Thinking
  'Inferring the rule that governs a grid of abstract figures and applying it to identify the missing cell.',
  'Figural matrix reasoning is the ability to induce an abstract relational rule from a partially complete figural matrix and apply it to select the completing element. Items are language-free and knowledge-free by design, so performance depends on rule induction rather than acquired vocabulary or domain knowledge. Scored dichotomously against a single keyed answer; distractors are constructed to catch specific reasoning errors rather than to be arbitrarily wrong.',
  'assessment_ready', true, false,
  'Developing', 'Established', 'Advanced',
  'Solves single-rule matrices reliably. Struggles when two rules operate at once or when a rule applies across rows and columns simultaneously.',
  'Handles two concurrent rules and cross-layer relations. Accuracy falls away on items combining a logical operation with a distractor-heavy layout.',
  'Sustains accuracy on three-rule and XOR items where several transformations interact and near-miss distractors are present.',
  'Descends from Spearman''s g research and the figural-matrix tradition (Raven''s Progressive Matrices; Carpenter, Just & Shell 1990 on rule taxonomy; Embretson 1998 on generating items from radicals). Difficulty here is predicted from the item''s radicals before anyone answers, not measured.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO factor_constructs (factor_id, construct_id, weight, display_order)
VALUES ('b2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000006', 1, 1)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. The assessment.
-- ---------------------------------------------------------------------------
-- `ability_dichotomous` is load-bearing: the default `pomp_factor` scorer
-- would read the option positions as if they were 1-5 ratings and report a
-- percentage-of-maximum, which for a keyed test is a number with no meaning.
INSERT INTO assessments (id, client_id, title, slug, description, status, scoring_profile, internal_pilot, scoring_method, time_limit_minutes)
VALUES (
  'b3000000-0000-0000-0000-000000000001',
  '955087a4-e632-431b-a668-39d128f709c9',  -- Acme Test Co (TEST)
  'Figural Matrix Reasoning — Internal Pilot',
  'figural-matrix-reasoning-internal-pilot',
  'A 24-item figural matrix reasoning test, ordered easiest to hardest, preceded by three unscored practice items. Built to find out whether the generated bank produces sensible scores. The items have not been through content or fairness review, and nothing here is calibrated: the result is a raw number correct, not a percentile against any norm group.',
  'active', 'ability_dichotomous', true, 'ctt', 40
)
ON CONFLICT (id) DO NOTHING;

-- `fixed` ordering, because difficulty ascends and the default is `randomised`.
-- `allow_back_nav=false` on the scored section is the ability-test convention:
-- revisiting earlier items turns a timed power test into something else.
INSERT INTO assessment_sections (id, assessment_id, response_format_id, title, instructions, display_order, section_role, item_ordering, allow_back_nav, time_limit_seconds)
VALUES
 ('b4000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000009',
  'Practice',
  'Three practice puzzles. Each grid follows a rule; work out the rule and pick the figure that completes it. These do not count towards your score — they are here so the format is familiar before the test starts. Take as long as you like.',
  1, 'practice', 'fixed', true, NULL),
 ('b4000000-0000-0000-0000-000000000002','b3000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000009',
  'Matrix Reasoning',
  'Twenty-four puzzles, ordered from easiest to hardest. Each grid follows one or more rules; pick the figure that completes it. There is exactly one correct answer. You cannot go back to a previous item, and an unanswered item is scored as incorrect — so answer every one, even if you are guessing. You have 30 minutes, which is generous for 24 items.',
  2, 'scored', 'fixed', false, 1800)
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_factors (assessment_id, factor_id, display_order, weight, composite_weight)
VALUES ('b3000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000001',1,1,1)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Item placement — 3 practice + 24 scored, spanning all ten families.
-- ---------------------------------------------------------------------------
-- Quotas are weighted toward the easy end so the test discriminates across the
-- middle of the range rather than flooring. Selection is deterministic
-- (ordered by generator seed) so re-running picks the same items, and the
-- scored order is by the family's predicted difficulty, easiest first.
--
-- Predicted difficulty spans b = -2.00 to +2.20 across these ten families.
WITH quota(code, practice_n, scored_n) AS (VALUES
  ('LRM-PROG-COUNT', 3, 2),        -- b -2.00
  ('LRM-MOVE',       0, 3),        -- b -1.40
  ('LRM-ROT',        0, 3),        -- b -1.40
  ('LRM-SUB',        0, 3),        -- b -0.90
  ('LRM-ADD',        0, 3),        -- b -0.90
  ('LRM-2R-XLAYER',  0, 2),        -- b  0.80
  ('LRM-XOR-XLAYER', 0, 2),        -- b  0.90
  ('LRM-3R-DIST',    0, 2),        -- b  1.25
  ('LRM-XOR-DIST-XLAYER', 0, 2),   -- b  1.80
  ('LRM-3R-XLAYER',  0, 2)         -- b  2.20
),
ranked AS (
  SELECT i.id, f.code, f.predicted_b,
         row_number() OVER (PARTITION BY f.code ORDER BY s.generator_seed, i.id) AS rn
  FROM items i
  JOIN item_families f ON f.id = i.family_id
  JOIN cognitive_item_specs s ON s.item_id = i.id
),
picked AS (
  SELECT r.id, r.code, r.predicted_b, r.rn,
         CASE WHEN r.rn <= q.practice_n THEN 'practice' ELSE 'scored' END AS bucket
  FROM ranked r
  JOIN quota q ON q.code = r.code
  WHERE r.rn <= q.practice_n + q.scored_n
),
numbered AS (
  SELECT id, bucket,
         row_number() OVER (PARTITION BY bucket ORDER BY predicted_b, code, rn) AS display_order
  FROM picked
)
INSERT INTO assessment_section_items (section_id, item_id, display_order)
SELECT CASE WHEN bucket = 'practice'
            THEN 'b4000000-0000-0000-0000-000000000001'::uuid
            ELSE 'b4000000-0000-0000-0000-000000000002'::uuid END,
       id, display_order
FROM numbered
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. The internal campaign that delivers it.
-- ---------------------------------------------------------------------------
-- `is_internal` is not decoration. src/lib/dal/calibration.ts excludes these
-- sessions from item calibration, which is exactly right: our own attempts at
-- our own test must never become the item statistics.
--
-- No participant row here. A participant carries an access token that lets
-- anyone holding it sit the test, so they are created ad hoc rather than
-- committed. To add one:
--
--   INSERT INTO campaign_participants (campaign_id, email, first_name, last_name, status, invited_at)
--   VALUES ('b5000000-0000-0000-0000-000000000001', 'you@example.com', 'First', 'Last', 'invited', now())
--   RETURNING access_token;   -- then visit /assess/<access_token>
INSERT INTO campaigns (id, title, slug, description, status, client_id, is_internal, kind, opens_at, closes_at, allow_resume, show_progress)
VALUES (
  'b5000000-0000-0000-0000-000000000001',
  'Figural Matrix Pilot — internal',
  'figural-matrix-pilot-internal',
  'Internal benchmarking round for the generated figural matrix bank. Marked internal so these sessions are excluded from item calibration.',
  'active',
  '955087a4-e632-431b-a668-39d128f709c9',
  true, 'self',
  now(), now() + interval '90 days',
  true, true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO campaign_assessments (campaign_id, assessment_id, display_order, is_required)
VALUES ('b5000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001',1,true)
ON CONFLICT DO NOTHING;
