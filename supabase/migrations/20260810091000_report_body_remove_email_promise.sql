-- The participant report page promised "You will receive an email when it is
-- ready", but no automatic participant report-ready email exists — only the
-- manual/admin send path. Remove the promise from stored experience templates
-- still carrying the verbatim old default (stored templates override code
-- defaults). Customised copy is left untouched.

UPDATE experience_templates
SET page_content = jsonb_set(
  page_content,
  '{report,body}',
  '"Your report is being prepared. It will appear here automatically once it is ready."'
)
WHERE page_content #>> '{report,body}' =
  'Your report is being prepared. You will receive an email when it is ready.';
