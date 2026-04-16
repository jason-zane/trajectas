-- Promote the six library factors (Composure, Connection, Curiosity, Drive,
-- Influence, Integrity) to top-level dimensions, carrying their construct links
-- across to dimension_constructs, and soft-delete the original factor rows.
--
-- Safety: each of these factors currently has 0 assessment_factors,
-- 0 campaign_assessment_factors, 0 participant_scores, 0 matching_results.
-- Soft-deleting them does not break any historical data.
--
-- Idempotent: safe to re-run. The DO block filters factors by deleted_at IS NULL,
-- so a second run is a no-op. ON CONFLICT clauses guard the inserts.

DO $$
DECLARE
  library_factor_ids uuid[] := ARRAY[
    '0913e7aa-2940-4bfc-91e2-d3dfcaa52565'::uuid, -- Composure
    '772e1b65-5aa0-4136-bf0a-ee3fdd42f542'::uuid, -- Connection
    '69f680d6-a4c0-4667-a301-6fbf3ed4bdea'::uuid, -- Curiosity
    'c8ce0a2a-5304-4b28-b0b7-3ea9ba987cdd'::uuid, -- Drive
    '6a34f6bb-0bbe-4f54-8a86-c13fd17d5e4e'::uuid, -- Influence
    'e1eee941-a73a-4168-9003-ec76d8d9016c'::uuid  -- Integrity
  ];
  f record;
  new_dim_id uuid;
  next_display_order integer;
BEGIN
  -- Pick up where existing active dimensions leave off, so the promoted six
  -- appear after current library dimensions in the ordering.
  SELECT COALESCE(MAX(display_order), 0) + 1 INTO next_display_order
  FROM dimensions
  WHERE partner_id IS NULL AND deleted_at IS NULL;

  FOR f IN
    SELECT *
    FROM factors
    WHERE id = ANY(library_factor_ids)
      AND deleted_at IS NULL
    ORDER BY name
  LOOP
    -- Reuse an existing active dimension with the same slug if present,
    -- otherwise create one. dimensions.slug has a partial unique index
    -- (WHERE deleted_at IS NULL), so ON CONFLICT can't be used.
    SELECT id INTO new_dim_id
    FROM dimensions
    WHERE slug = f.slug AND deleted_at IS NULL
    LIMIT 1;

    IF new_dim_id IS NULL THEN
      -- factors table has no is_scored / display_order — default is_scored=true
      -- and assign display_order from the counter above.
      INSERT INTO dimensions (
        name, slug, description, is_scored, display_order, is_active,
        definition,
        indicators_low, indicators_mid, indicators_high,
        band_label_low, band_label_mid, band_label_high,
        pomp_threshold_low, pomp_threshold_high,
        development_suggestion, strength_commentary,
        anchor_low, anchor_high
      )
      VALUES (
        f.name, f.slug, f.description, true, next_display_order, true,
        f.definition,
        f.indicators_low, f.indicators_mid, f.indicators_high,
        f.band_label_low, f.band_label_mid, f.band_label_high,
        f.pomp_threshold_low, f.pomp_threshold_high,
        f.development_suggestion, f.strength_commentary,
        f.anchor_low, f.anchor_high
      )
      RETURNING id INTO new_dim_id;

      next_display_order := next_display_order + 1;
    END IF;

    -- Mirror construct links from factor_constructs to dimension_constructs.
    INSERT INTO dimension_constructs (dimension_id, construct_id, weight, display_order)
    SELECT new_dim_id, fc.construct_id, fc.weight, fc.display_order
    FROM factor_constructs fc
    WHERE fc.factor_id = f.id
    ON CONFLICT (dimension_id, construct_id) DO NOTHING;

    -- Soft-delete the source factor so it no longer appears in the library.
    UPDATE factors
    SET deleted_at = now(),
        is_active = false,
        updated_at = now()
    WHERE id = f.id;
  END LOOP;
END $$;
