-- Restore the platform staff invite template to acceptance-link email copy.
-- OTP codes continue to use the generic magic_link template.

UPDATE email_templates SET editor_json = '{
  "type": "doc",
  "content": [
    {"type": "heading", "attrs": {"level": 2}, "content": [
      {"type": "text", "text": "You''re Invited"}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "Hi "},
      {"type": "variable", "attrs": {"id": "inviteeName", "fallback": "there", "showIfKey": null}},
      {"type": "text", "text": ","}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "You have been invited to join "},
      {"type": "text", "text": "Trajectas", "marks": [{"type": "bold"}]},
      {"type": "text", "text": " as a team member. Click below to accept your invitation and set up your account."}
    ]},
    {"type": "spacer", "attrs": {"height": 8}},
    {"type": "button", "attrs": {"text": "Accept Invitation", "url": "acceptUrl", "isUrlVariable": true, "variant": "filled", "buttonColor": "#000000", "textColor": "#ffffff", "borderRadius": "smooth", "alignment": "left"}},
    {"type": "spacer", "attrs": {"height": 8}},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "This invitation link will expire in 7 days."}
    ]}
  ]
}'::jsonb
WHERE type = 'staff_invite' AND scope_type = 'platform' AND scope_id IS NULL;
