-- =============================================================================
-- Expand brand_configs seed data with new BrandConfig fields
--
-- The brand_configs table uses JSONB, so no schema change is needed.
-- This migration updates the platform default seed data to include the
-- newly supported fields: portalAccents, sidebarColor, semanticColors,
-- taxonomyColors, and emailStyles.
-- =============================================================================

UPDATE brand_configs
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          config,
          '{portalAccents}',
          '{"admin": "#6d28d9", "partner": "#d4a032", "client": "#b85c3a"}'::jsonb
        ),
        '{sidebarColor}',
        '"#2d6a5a"'::jsonb
      ),
      '{semanticColors}',
      '{"destructive": "#c53030", "success": "#2f855a", "warning": "#c27803"}'::jsonb
    ),
    '{taxonomyColors}',
    '{"dimension": "#5b3fc5", "competency": "#2d6a5a", "trait": "#a33fa3", "item": "#c27803"}'::jsonb
  ),
  '{emailStyles}',
  '{"textColor": "#1a1a1a", "highlightColor": "#2d6a5a", "footerTextColor": "#737373"}'::jsonb
),
updated_at = now()
WHERE owner_type = 'platform'
  AND is_default = true
  AND deleted_at IS NULL
  AND config->>'portalAccents' IS NULL;
