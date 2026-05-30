-- Leadership 360: seed the platform default rater-reminder email template.
-- sendEmail() resolves templates from email_templates (no code fallback), so the
-- platform row must exist for rater_reminder to send.

INSERT INTO email_templates (type, scope_type, scope_id, subject, preview_text, editor_json, is_active)
VALUES (
  'rater_reminder',
  'platform',
  NULL,
  'Reminder: feedback for {{subjectName}}',
  'A quick nudge — your 360 feedback is still open.',
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2}, "content": [
        {"type": "text", "text": "A quick reminder"}
      ]},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
        {"type": "text", "text": "Hi "},
        {"type": "variable", "attrs": {"id": "raterName", "fallback": "there", "showIfKey": null}},
        {"type": "text", "text": ","}
      ]},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
        {"type": "text", "text": "Your 360 feedback for "},
        {"type": "text", "text": "{{subjectName}}", "marks": [{"type": "bold"}]},
        {"type": "text", "text": " is still open. It only takes a few minutes, and your input makes a real difference to their development. Your responses stay confidential and are shown only as group averages."}
      ]},
      {"type": "spacer", "attrs": {"height": 8}},
      {"type": "button", "attrs": {"text": "Give Feedback", "url": "assessmentUrl", "isUrlVariable": true, "variant": "filled", "buttonColor": "#000000", "textColor": "#ffffff", "borderRadius": "smooth", "alignment": "left"}},
      {"type": "spacer", "attrs": {"height": 8}},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
        {"type": "text", "text": "If you have already completed it, thank you — please ignore this message."}
      ]}
    ]
  }'::jsonb,
  true
)
ON CONFLICT (type, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
WHERE deleted_at IS NULL
DO NOTHING;
