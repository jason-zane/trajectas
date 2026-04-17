-- Two fixes to platform default email templates:
--
-- 1. magic_link: promote the OTP code from a plain paragraph to a level-1
--    heading so the code is visually prominent.
--
-- 2. staff_invite: restore the "Accept Invitation" button using the
--    acceptUrl variable. A prior migration (20260409140000) incorrectly
--    rewrote this template to show an otpCode variable, but the staff
--    invite flow passes acceptUrl (a tokenised link), not otpCode, so the
--    template rendered an empty code and no clickable link.

UPDATE email_templates SET editor_json = '{
  "type": "doc",
  "content": [
    {"type": "heading", "attrs": {"level": 2}, "content": [
      {"type": "text", "text": "Sign in to "},
      {"type": "variable", "attrs": {"id": "brandName", "fallback": "Trajectas", "showIfKey": null}}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "Enter this code to sign in. It expires in 10 minutes."}
    ]},
    {"type": "spacer", "attrs": {"height": 8}},
    {"type": "heading", "attrs": {"level": 1}, "content": [
      {"type": "variable", "attrs": {"id": "otpCode", "fallback": "------", "showIfKey": null}}
    ]},
    {"type": "spacer", "attrs": {"height": 8}},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "If you did not request this email, you can safely ignore it."}
    ]}
  ]
}'::jsonb
WHERE type = 'magic_link' AND scope_type = 'platform' AND scope_id IS NULL;

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
