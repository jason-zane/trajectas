-- Add assessment intro content column
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS intro_content JSONB DEFAULT NULL;
COMMENT ON COLUMN assessments.intro_content IS
  'Per-assessment intro page content: { enabled, heading, body, buttonLabel }. NULL = never configured.';
-- Add campaign-level intro override column
ALTER TABLE campaign_assessments
  ADD COLUMN IF NOT EXISTS intro_override JSONB DEFAULT NULL;
COMMENT ON COLUMN campaign_assessments.intro_override IS
  'Campaign override for assessment intro: null = use default, { suppress: true } = skip, or { heading, body, buttonLabel } = custom.';
-- Remove section_intro from all experience template flow configs
UPDATE experience_templates
SET flow_config = flow_config - 'section_intro'
WHERE flow_config ? 'section_intro';
-- Remove section_intro from page_content
UPDATE experience_templates
SET page_content = page_content - 'section_intro'
WHERE page_content ? 'section_intro';
