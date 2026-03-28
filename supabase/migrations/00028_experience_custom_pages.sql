ALTER TABLE experience_templates
  ADD COLUMN IF NOT EXISTS custom_page_content JSONB NOT NULL DEFAULT '{}'::jsonb;
