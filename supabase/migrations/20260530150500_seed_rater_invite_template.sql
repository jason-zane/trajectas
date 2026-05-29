-- Leadership 360: seed the platform default rater-invitation email template.
--
-- sendEmail() resolves templates from email_templates (no code fallback), so the
-- platform row must exist for rater_invite to send. Mirrors the editor JSON
-- produced by RATER_INVITE in src/lib/email/default-templates.ts.

INSERT INTO email_templates (type, scope_type, scope_id, subject, preview_text, editor_json, is_active)
VALUES (
  'rater_invite',
  'platform',
  NULL,
  'Feedback request for {{subjectName}}',
  'Your feedback is confidential and supports their development.',
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2}, "content": [
        {"type": "text", "text": "Feedback request for "},
        {"type": "variable", "attrs": {"id": "subjectName", "fallback": "a colleague", "showIfKey": null}}
      ]},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
        {"type": "text", "text": "Hi "},
        {"type": "variable", "attrs": {"id": "raterName", "fallback": "there", "showIfKey": null}},
        {"type": "text", "text": ","}
      ]},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
        {"type": "text", "text": "You have been asked to give 360-degree feedback on "},
        {"type": "text", "text": "{{subjectName}}", "marks": [{"type": "bold"}]},
        {"type": "text", "text": " as their "},
        {"type": "variable", "attrs": {"id": "relationshipLabel", "fallback": "colleague", "showIfKey": null}},
        {"type": "text", "text": ". Your input helps them understand their leadership strengths and development areas."}
      ]},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
        {"type": "text", "text": "Your responses are confidential. They are combined with other raters and shown only as group averages — "},
        {"type": "text", "text": "{{subjectName}}", "marks": [{"type": "bold"}]},
        {"type": "text", "text": " will never see your individual answers."}
      ]},
      {"type": "spacer", "attrs": {"height": 8}},
      {"type": "button", "attrs": {"text": "Give Feedback", "url": "assessmentUrl", "isUrlVariable": true, "variant": "filled", "buttonColor": "#000000", "textColor": "#ffffff", "borderRadius": "smooth", "alignment": "left"}},
      {"type": "spacer", "attrs": {"height": 8}},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
        {"type": "text", "text": "If you have any questions, reply to this email."}
      ]}
    ]
  }'::jsonb,
  true
)
ON CONFLICT (type, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
WHERE deleted_at IS NULL
DO NOTHING;
