DO $$
DECLARE
  library_factor_ids uuid[] := ARRAY[
    '0913e7aa-2940-4bfc-91e2-d3dfcaa52565'::uuid,
    '772e1b65-5aa0-4136-bf0a-ee3fdd42f542'::uuid,
    '69f680d6-a4c0-4667-a301-6fbf3ed4bdea'::uuid,
    'c8ce0a2a-5304-4b28-b0b7-3ea9ba987cdd'::uuid,
    '6a34f6bb-0bbe-4f54-8a86-c13fd17d5e4e'::uuid,
    'e1eee941-a73a-4168-9003-ec76d8d9016c'::uuid
  ];
  f record;
  new_dim_id uuid;
  next_display_order integer;
BEGIN
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
    SELECT id INTO new_dim_id
    FROM dimensions
    WHERE slug = f.slug AND deleted_at IS NULL
    LIMIT 1;

    IF new_dim_id IS NULL THEN
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

    INSERT INTO dimension_constructs (dimension_id, construct_id, weight, display_order)
    SELECT new_dim_id, fc.construct_id, fc.weight, fc.display_order
    FROM factor_constructs fc
    WHERE fc.factor_id = f.id
    ON CONFLICT (dimension_id, construct_id) DO NOTHING;

    UPDATE factors
    SET deleted_at = now(),
        is_active = false,
        updated_at = now()
    WHERE id = f.id;
  END LOOP;
END $$;;
