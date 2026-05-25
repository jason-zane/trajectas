-- =============================================================================
-- Taxonomy unification — Phase 3a: data migration only (no DROPs).
-- Converts every (construct, dimension) pair from dimension_constructs and
-- assessment_constructs into a 1:1 composition-locked factor, then migrates
-- assessment_constructs → assessment_factors and participant_scores from
-- construct-mode to factor-mode. Leaves the old tables/columns intact so we
-- can verify before dropping (Phase 3b).
--
-- Wrapped in apply_migration's implicit transaction — any RAISE rolls back.
-- See docs/superpowers/specs/2026-05-25-taxonomy-unification-design.md.
-- =============================================================================

-- 1. Backup soon-to-be-removed data as JSONB rows.
CREATE TABLE IF NOT EXISTS _taxonomy_unification_backup (
  id SERIAL PRIMARY KEY,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_table TEXT NOT NULL,
  row_data JSONB NOT NULL
);

INSERT INTO _taxonomy_unification_backup (source_table, row_data)
SELECT 'dimension_constructs', to_jsonb(dc) FROM dimension_constructs dc;

INSERT INTO _taxonomy_unification_backup (source_table, row_data)
SELECT 'assessment_constructs', to_jsonb(ac) FROM assessment_constructs ac;

INSERT INTO _taxonomy_unification_backup (source_table, row_data)
SELECT 'campaign_assessment_constructs', to_jsonb(cac) FROM campaign_assessment_constructs cac;

INSERT INTO _taxonomy_unification_backup (source_table, row_data)
SELECT 'participant_scores_construct_mode', to_jsonb(ps)
FROM participant_scores ps WHERE scoring_level = 'construct';

INSERT INTO _taxonomy_unification_backup (source_table, row_data)
SELECT 'assessments_construct_mode', to_jsonb(a)
FROM assessments a WHERE scoring_level = 'construct';

-- 2. Build wrapper map: every unique (construct, dimension) pair that needs a
--    1:1 factor.
CREATE TABLE IF NOT EXISTS _migration_wrapper_map (
  construct_id UUID NOT NULL,
  dimension_id UUID NOT NULL,
  factor_id UUID NOT NULL,
  PRIMARY KEY (construct_id, dimension_id)
);

DO $$
DECLARE
  pair RECORD;
  new_factor_id UUID;
  existing_factor_id UUID;
  candidate_slug TEXT;
  slug_n INT;
BEGIN
  FOR pair IN
    SELECT DISTINCT
      pairs.construct_id,
      pairs.dimension_id,
      c.name           AS construct_name,
      c.slug           AS construct_slug,
      c.description, c.definition,
      c.indicators_low, c.indicators_mid, c.indicators_high,
      c.anchor_low, c.anchor_high,
      c.strength_commentary, c.development_suggestion,
      c.source_id, c.is_active
    FROM (
      SELECT construct_id, dimension_id FROM dimension_constructs
      UNION
      SELECT construct_id, dimension_id FROM assessment_constructs
        WHERE dimension_id IS NOT NULL
    ) pairs
    JOIN constructs c ON c.id = pairs.construct_id
    JOIN dimensions d ON d.id = pairs.dimension_id
  LOOP
    SELECT f.id INTO existing_factor_id
    FROM factors f
    JOIN factor_constructs fc ON fc.factor_id = f.id
    WHERE f.dimension_id = pair.dimension_id
      AND fc.construct_id = pair.construct_id
      AND f.deleted_at IS NULL
    LIMIT 1;

    IF existing_factor_id IS NOT NULL THEN
      INSERT INTO _migration_wrapper_map(construct_id, dimension_id, factor_id)
      VALUES (pair.construct_id, pair.dimension_id, existing_factor_id);
      CONTINUE;
    END IF;

    candidate_slug := pair.construct_slug;
    slug_n := 1;
    WHILE EXISTS (SELECT 1 FROM factors WHERE slug = candidate_slug) LOOP
      slug_n := slug_n + 1;
      candidate_slug := pair.construct_slug || '-' || slug_n;
    END LOOP;

    INSERT INTO factors (
      name, slug, description, definition, dimension_id,
      is_active, is_match_eligible,
      indicators_low, indicators_mid, indicators_high,
      anchor_low, anchor_high,
      strength_commentary, development_suggestion,
      source_id, composition_locked
    ) VALUES (
      pair.construct_name, candidate_slug, pair.description, pair.definition, pair.dimension_id,
      COALESCE(pair.is_active, true), true,
      pair.indicators_low, pair.indicators_mid, pair.indicators_high,
      pair.anchor_low, pair.anchor_high,
      pair.strength_commentary, pair.development_suggestion,
      pair.source_id, true
    ) RETURNING id INTO new_factor_id;

    INSERT INTO factor_constructs (factor_id, construct_id, weight, display_order)
    VALUES (new_factor_id, pair.construct_id, 1.0, 1);

    INSERT INTO _migration_wrapper_map(construct_id, dimension_id, factor_id)
    VALUES (pair.construct_id, pair.dimension_id, new_factor_id);
  END LOOP;
END $$;

-- 3. Convert assessment_constructs → assessment_factors
INSERT INTO assessment_factors (assessment_id, factor_id, weight, item_count, display_order, min_items, max_items)
SELECT
  ac.assessment_id,
  m.factor_id,
  ac.weight,
  ac.item_count,
  ac.display_order,
  ac.min_items,
  ac.max_items
FROM assessment_constructs ac
JOIN _migration_wrapper_map m
  ON m.construct_id = ac.construct_id AND m.dimension_id = ac.dimension_id
WHERE NOT EXISTS (
  SELECT 1 FROM assessment_factors af
  WHERE af.assessment_id = ac.assessment_id AND af.factor_id = m.factor_id
);

-- 4. Flip the assessments themselves to factor mode (column still exists; we drop in 3b).
UPDATE assessments
SET scoring_level = 'factor'
WHERE scoring_level = 'construct';

-- 5. Convert participant_scores.
UPDATE participant_scores ps
SET factor_id = m.factor_id,
    construct_id = NULL,
    scoring_level = 'factor'
FROM participant_sessions s,
     assessment_constructs ac,
     _migration_wrapper_map m
WHERE ps.scoring_level = 'construct'
  AND s.id = ps.session_id
  AND ac.assessment_id = s.assessment_id
  AND ac.construct_id = ps.construct_id
  AND m.construct_id = ps.construct_id
  AND m.dimension_id = ac.dimension_id;

-- 6. Validate: no construct-mode rows should remain.
DO $$
DECLARE
  remaining_construct_scores INT;
  remaining_construct_assessments INT;
BEGIN
  SELECT COUNT(*) INTO remaining_construct_scores
    FROM participant_scores WHERE scoring_level = 'construct';
  SELECT COUNT(*) INTO remaining_construct_assessments
    FROM assessments WHERE scoring_level = 'construct';

  IF remaining_construct_scores > 0 THEN
    RAISE EXCEPTION 'taxonomy unification: % participant_scores rows still in construct mode after migration', remaining_construct_scores;
  END IF;
  IF remaining_construct_assessments > 0 THEN
    RAISE EXCEPTION 'taxonomy unification: % assessments still in construct mode after migration', remaining_construct_assessments;
  END IF;
END $$;
