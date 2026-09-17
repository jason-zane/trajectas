-- Public Role Builder: seed the platform default email templates.
--
-- sendEmail() resolves templates from email_templates (no code fallback), so
-- these platform rows must exist for public_build_code / public_build_report
-- to send. Mirrors the editor JSON produced by PUBLIC_BUILD_CODE /
-- PUBLIC_BUILD_REPORT in src/lib/email/default-templates.ts.

INSERT INTO email_templates (type, scope_type, scope_id, subject, preview_text, editor_json, is_active)
VALUES (
  'public_build_code',
  'platform',
  NULL,
  'Your Role Builder code',
  'Enter this code to continue building your assessment.',
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2}, "content": [
        {"type": "text", "text": "Your Role Builder code"}
      ]},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
        {"type": "text", "text": "Enter this code to continue. It expires in 10 minutes."}
      ]},
      {"type": "spacer", "attrs": {"height": 8}},
      {"type": "heading", "attrs": {"level": 1}, "content": [
        {"type": "variable", "attrs": {"id": "code", "fallback": "------", "showIfKey": null}}
      ]},
      {"type": "spacer", "attrs": {"height": 8}},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
        {"type": "text", "text": "If you did not request this, you can safely ignore it."}
      ]}
    ]
  }'::jsonb,
  true
)
ON CONFLICT (type, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
WHERE deleted_at IS NULL
DO NOTHING;

INSERT INTO email_templates (type, scope_type, scope_id, subject, preview_text, editor_json, is_active)
VALUES (
  'public_build_report',
  'platform',
  NULL,
  'Your Role Builder report is ready',
  'Your report is attached, and available online.',
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2}, "content": [
        {"type": "text", "text": "Your report is ready"}
      ]},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
        {"type": "text", "text": "The assessment you built for "},
        {"type": "variable", "attrs": {"id": "roleTitle", "fallback": "this role", "showIfKey": null}},
        {"type": "text", "text": " has been completed. Your report is attached as a PDF, and you can also view it online."}
      ]},
      {"type": "spacer", "attrs": {"height": 8}},
      {"type": "button", "attrs": {"text": "View Report", "url": "reportUrl", "isUrlVariable": true, "variant": "filled", "buttonColor": "#000000", "textColor": "#ffffff", "borderRadius": "smooth", "alignment": "left"}}
    ]
  }'::jsonb,
  true
)
ON CONFLICT (type, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
WHERE deleted_at IS NULL
DO NOTHING;
