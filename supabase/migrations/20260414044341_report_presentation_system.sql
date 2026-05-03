-- Backfill schema changes from local migration 00044 that were never applied.
-- The original 00044 slot was taken by library_import_structuring_model in production.

-- 1. Add brand_mode to campaign_report_config
ALTER TABLE campaign_report_config
ADD COLUMN IF NOT EXISTS brand_mode text NOT NULL DEFAULT 'platform'
CHECK (brand_mode IN ('platform', 'client', 'custom'));

-- 2. Add page_header_logo to report_templates
ALTER TABLE report_templates
ADD COLUMN IF NOT EXISTS page_header_logo text NOT NULL DEFAULT 'none'
CHECK (page_header_logo IN ('primary', 'secondary', 'none'));

-- 3. Add 'neutral' to person_reference enum type
ALTER TYPE person_reference_type ADD VALUE IF NOT EXISTS 'neutral';;
