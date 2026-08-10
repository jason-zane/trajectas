-- Incomplete submissions are now refused server-side (submitSession
-- completeness gate), so the review screen's default warning copy changes
-- from "you can still submit" to "every question needs an answer".
--
-- Stored experience templates override code defaults, so rows still carrying
-- the verbatim old default are rewritten in place. Customised copy (anything
-- that does not exactly match the old default) is left untouched.

UPDATE experience_templates
SET page_content = jsonb_set(
  page_content,
  '{review,incompleteWarning}',
  '"You have unanswered questions. Every question needs an answer before you can submit."'
)
WHERE page_content #>> '{review,incompleteWarning}' =
  'You have unanswered questions. You can still submit, but incomplete sections may affect your results.';
