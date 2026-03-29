-- Add privacy and terms URL fields to experience_templates
alter table experience_templates
  add column if not exists privacy_url text,
  add column if not exists terms_url text;
