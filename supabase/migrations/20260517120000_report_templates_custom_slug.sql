-- Add custom_report_slug column to report_templates.
-- When set, the report runner bypasses the block-driven pipeline and
-- dispatches to a code-registered custom report (src/lib/reports/custom).
-- The blocks column is ignored for custom-slug templates but kept nullable
-- so we don't need a schema change to flip a template into custom mode.

alter table public.report_templates
  add column if not exists custom_report_slug text;

comment on column public.report_templates.custom_report_slug is
  'When set, runner dispatches to the named custom report (src/lib/reports/custom/<slug>) instead of resolving the blocks JSONB. Null for standard template-driven reports.';
