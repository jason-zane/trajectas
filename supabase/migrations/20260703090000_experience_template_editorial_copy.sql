-- ==========================================================================
-- 20260703090000_experience_template_editorial_copy.sql
--
-- The dark-editorial runner redesign updated the DEFAULT_PAGE_CONTENT code
-- defaults, but resolved copy prefers the platform experience_templates row,
-- which still carries the old seeded strings. Migrate each field to the new
-- editorial copy ONLY where it still equals a known historic default — any
-- admin-customised value is left untouched.
-- ==========================================================================

CREATE OR REPLACE FUNCTION pg_temp.migrate_copy(
  content jsonb, page text, field text, old_values text[], new_value text
) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN content #>> ARRAY[page, field] = ANY (old_values)
    THEN jsonb_set(content, ARRAY[page, field], to_jsonb(new_value))
    ELSE content
  END
$$;

UPDATE experience_templates
SET page_content =
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
    page_content,
    'welcome', 'eyebrow',
    ARRAY['Welcome, {{participantName}}', 'Welcome, {{candidateName}}'],
    '{{campaignTitle}}'),
    'welcome', 'heading',
    ARRAY['{{campaignTitle}}'],
    '{{timeOfDayGreeting}}, {{participantName}}. This is about how you work best.'),
    'welcome', 'body',
    ARRAY['{{campaignDescription}}'],
    'There are no right answers — your first instinct is usually the truest one. Your responses save automatically, and you can pause and return any time.'),
    'welcome', 'buttonLabel',
    ARRAY['Begin Assessment', 'Begin assessment'],
    'Begin assessment'),
    'welcome', 'resumeButtonLabel',
    ARRAY['Resume Assessment', 'Resume assessment'],
    'Resume assessment'),
    'consent', 'eyebrow',
    ARRAY['Information & Consent'],
    'Before you begin'),
    'consent', 'heading',
    ARRAY['Before We Begin'],
    'How your answers are used.'),
    'consent', 'body',
    ARRAY[E'This assessment is being administered as part of a structured evaluation process. Your responses will be used to generate a profile based on validated psychometric constructs.\n\n**What to expect:**\n- The assessment will take approximately 15–25 minutes\n- Your responses are confidential and stored securely\n- Results are used for professional development and/or selection purposes\n- You may withdraw at any time by closing this page\n\nBy proceeding, you confirm that you consent to participate in this assessment and that your responses may be used for the purposes described above.'],
    E'- Your responses are used to generate a profile based on validated psychometric constructs.\n- Results are used for professional development and/or selection purposes.\n- Your responses save automatically — you may pause, or withdraw at any time by closing this page.'),
    'demographics', 'eyebrow',
    ARRAY['About You'],
    'A little about you'),
    'demographics', 'heading',
    ARRAY['Demographics'],
    'Help us read the results fairly.'),
    'demographics', 'body',
    ARRAY['The following information helps us ensure fair and accurate assessment results. All fields are optional unless marked as required.'],
    'Used only to compare groups fairly — never to identify you.'),
    'join', 'heading',
    ARRAY['Join Assessment'],
    'Register to begin.'),
    'join', 'body',
    ARRAY['Enter your details to begin the assessment.'],
    E'We’ll use this to create your personal access link.'),
    'review', 'eyebrow',
    ARRAY['{{campaignTitle}}'],
    'Review & submit'),
    'complete', 'heading',
    ARRAY['Thank You'],
    'Thank you, {{participantName}}.'),
    'complete', 'body',
    ARRAY['Your assessment has been submitted successfully. You can safely close this page.'],
    'Your assessment has been submitted. You can safely close this page.')
WHERE owner_type = 'platform' AND deleted_at IS NULL;

-- Runner save-status strings live under page_content->'runner' too.
UPDATE experience_templates
SET page_content =
  pg_temp.migrate_copy(
  pg_temp.migrate_copy(
    page_content,
    'runner', 'saveStatusIdle',
    ARRAY['Responses saved automatically'],
    'Autosave on'),
    'runner', 'saveStatusSaving',
    ARRAY['Saving...'],
    E'Saving…')
WHERE owner_type = 'platform' AND deleted_at IS NULL;

DROP FUNCTION pg_temp.migrate_copy(jsonb, text, text, text[], text);
