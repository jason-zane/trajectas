-- Migration 00029 seeded experience_templates.page_content.runner.footerText
-- with "Powered by TalentFit" (pre-rename). That platform row has since been
-- cloned into campaign-owned experience_templates, and one campaign brand
-- config also carries the legacy product name. Scrub all of them.

UPDATE experience_templates
SET page_content = jsonb_set(
      page_content,
      '{runner,footerText}',
      to_jsonb('Powered by Trajectas'::text),
      true
    )
WHERE page_content->'runner'->>'footerText' IN (
  'Powered by TalentFit',
  'Powered by Talent Fit'
);

UPDATE brand_configs
SET config = jsonb_set(config, '{name}', to_jsonb('Trajectas'::text), true)
WHERE config->>'name' IN ('TalentFit', 'Talent Fit');
