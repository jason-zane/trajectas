-- Add brand_mode to campaign_report_config
ALTER TABLE campaign_report_config
ADD COLUMN brand_mode text NOT NULL DEFAULT 'platform'
CHECK (brand_mode IN ('platform', 'client', 'custom'));

-- Add page_header_logo to report_templates
ALTER TABLE report_templates
ADD COLUMN page_header_logo text NOT NULL DEFAULT 'none'
CHECK (page_header_logo IN ('primary', 'secondary', 'none'));

-- Add 'neutral' to person_reference enum type
ALTER TYPE person_reference_type ADD VALUE IF NOT EXISTS 'neutral';
