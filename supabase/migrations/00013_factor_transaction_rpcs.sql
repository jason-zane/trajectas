BEGIN;

-- Upsert a factor and replace all factor_constructs links atomically
CREATE OR REPLACE FUNCTION upsert_factor_with_constructs(
  p_factor_id uuid,
  p_factor jsonb,
  p_construct_links jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factor_id uuid;
  v_link jsonb;
BEGIN
  -- Upsert the factor row
  INSERT INTO factors (
    id,
    name,
    slug,
    description,
    definition,
    dimension_id,
    is_active,
    is_match_eligible,
    organization_id,
    indicators_low,
    indicators_mid,
    indicators_high
  ) VALUES (
    p_factor_id,
    (p_factor->>'name'),
    (p_factor->>'slug'),
    (p_factor->>'description'),
    (p_factor->>'definition'),
    (p_factor->>'dimension_id')::uuid,
    COALESCE((p_factor->>'is_active')::boolean, true),
    COALESCE((p_factor->>'is_match_eligible')::boolean, true),
    (p_factor->>'organization_id')::uuid,
    (p_factor->>'indicators_low'),
    (p_factor->>'indicators_mid'),
    (p_factor->>'indicators_high')
  )
  ON CONFLICT (id) DO UPDATE SET
    name             = EXCLUDED.name,
    slug             = EXCLUDED.slug,
    description      = EXCLUDED.description,
    definition       = EXCLUDED.definition,
    dimension_id     = EXCLUDED.dimension_id,
    is_active        = EXCLUDED.is_active,
    is_match_eligible = EXCLUDED.is_match_eligible,
    organization_id  = EXCLUDED.organization_id,
    indicators_low   = EXCLUDED.indicators_low,
    indicators_mid   = EXCLUDED.indicators_mid,
    indicators_high  = EXCLUDED.indicators_high,
    updated_at       = now()
  RETURNING id INTO v_factor_id;

  -- Remove existing construct links for this factor
  DELETE FROM factor_constructs WHERE factor_id = v_factor_id;

  -- Insert the new construct links
  FOR v_link IN SELECT * FROM jsonb_array_elements(p_construct_links)
  LOOP
    INSERT INTO factor_constructs (
      factor_id,
      construct_id,
      weight,
      display_order
    ) VALUES (
      v_factor_id,
      (v_link->>'construct_id')::uuid,
      COALESCE((v_link->>'weight')::numeric, 1.0),
      COALESCE((v_link->>'display_order')::integer, 0)
    );
  END LOOP;

  RETURN v_factor_id;
END;
$$;

-- Delete a factor and its construct links in one transaction
CREATE OR REPLACE FUNCTION delete_factor_cascade(p_factor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove construct links first
  DELETE FROM factor_constructs WHERE factor_id = p_factor_id;

  -- Remove the factor
  DELETE FROM factors WHERE id = p_factor_id;
END;
$$;

COMMIT;
