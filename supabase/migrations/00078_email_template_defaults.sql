-- Update platform default email templates with rich Maily.to editor JSON.
-- These replace the empty '{}' placeholders seeded in 00077.

UPDATE email_templates SET editor_json = '{
  "type": "doc",
  "content": [
    {"type": "heading", "attrs": {"level": 2}, "content": [
      {"type": "text", "text": "Sign in to "},
      {"type": "variable", "attrs": {"id": "brandName", "fallback": "Trajectas", "showIfKey": null}}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "Click the button below to sign in. This link expires in 10 minutes."}
    ]},
    {"type": "spacer", "attrs": {"height": 8}},
    {"type": "button", "attrs": {"text": "Sign In", "url": "signInUrl", "isUrlVariable": true, "variant": "filled", "buttonColor": "#000000", "textColor": "#ffffff", "borderRadius": "smooth", "alignment": "left"}},
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

UPDATE email_templates SET editor_json = '{
  "type": "doc",
  "content": [
    {"type": "heading", "attrs": {"level": 2}, "content": [
      {"type": "variable", "attrs": {"id": "campaignTitle", "fallback": "Assessment", "showIfKey": null}}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "Hi "},
      {"type": "variable", "attrs": {"id": "participantFirstName", "fallback": "there", "showIfKey": null}},
      {"type": "text", "text": ","}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "You have been invited to complete an assessment: "},
      {"type": "text", "text": "{{campaignTitle}}", "marks": [{"type": "bold"}]},
      {"type": "text", "text": "."}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "variable", "attrs": {"id": "campaignDescription", "fallback": "", "showIfKey": null}}
    ]},
    {"type": "spacer", "attrs": {"height": 8}},
    {"type": "button", "attrs": {"text": "Start Assessment", "url": "assessmentUrl", "isUrlVariable": true, "variant": "filled", "buttonColor": "#000000", "textColor": "#ffffff", "borderRadius": "smooth", "alignment": "left"}},
    {"type": "spacer", "attrs": {"height": 8}},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "If you have any questions, reply to this email."}
    ]}
  ]
}'::jsonb
WHERE type = 'assessment_invite' AND scope_type = 'platform' AND scope_id IS NULL;

UPDATE email_templates SET editor_json = '{
  "type": "doc",
  "content": [
    {"type": "heading", "attrs": {"level": 2}, "content": [
      {"type": "text", "text": "Reminder: "},
      {"type": "variable", "attrs": {"id": "campaignTitle", "fallback": "Assessment", "showIfKey": null}}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "Hi "},
      {"type": "variable", "attrs": {"id": "participantFirstName", "fallback": "there", "showIfKey": null}},
      {"type": "text", "text": ","}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "This is a friendly reminder that your assessment "},
      {"type": "text", "text": "{{campaignTitle}}", "marks": [{"type": "bold"}]},
      {"type": "text", "text": " is still awaiting completion. You have "},
      {"type": "variable", "attrs": {"id": "daysRemaining", "fallback": "a few", "showIfKey": null}},
      {"type": "text", "text": " days remaining."}
    ]},
    {"type": "spacer", "attrs": {"height": 8}},
    {"type": "button", "attrs": {"text": "Continue Assessment", "url": "assessmentUrl", "isUrlVariable": true, "variant": "filled", "buttonColor": "#000000", "textColor": "#ffffff", "borderRadius": "smooth", "alignment": "left"}}
  ]
}'::jsonb
WHERE type = 'assessment_reminder' AND scope_type = 'platform' AND scope_id IS NULL;

UPDATE email_templates SET editor_json = '{
  "type": "doc",
  "content": [
    {"type": "heading", "attrs": {"level": 2}, "content": [
      {"type": "text", "text": "Your Report is Ready"}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "Hi "},
      {"type": "variable", "attrs": {"id": "recipientName", "fallback": "there", "showIfKey": null}},
      {"type": "text", "text": ","}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "The report for "},
      {"type": "text", "text": "{{campaignTitle}}", "marks": [{"type": "bold"}]},
      {"type": "text", "text": " is now available for review."}
    ]},
    {"type": "spacer", "attrs": {"height": 8}},
    {"type": "button", "attrs": {"text": "View Report", "url": "reportUrl", "isUrlVariable": true, "variant": "filled", "buttonColor": "#000000", "textColor": "#ffffff", "borderRadius": "smooth", "alignment": "left"}}
  ]
}'::jsonb
WHERE type = 'report_ready' AND scope_type = 'platform' AND scope_id IS NULL;

UPDATE email_templates SET editor_json = '{
  "type": "doc",
  "content": [
    {"type": "heading", "attrs": {"level": 2}, "content": [
      {"type": "text", "text": "Welcome to "},
      {"type": "variable", "attrs": {"id": "brandName", "fallback": "Trajectas", "showIfKey": null}}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "Hi "},
      {"type": "variable", "attrs": {"id": "userName", "fallback": "there", "showIfKey": null}},
      {"type": "text", "text": ","}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "text", "text": "Your account has been created. You can sign in anytime to get started."}
    ]},
    {"type": "spacer", "attrs": {"height": 8}},
    {"type": "button", "attrs": {"text": "Get Started", "url": "loginUrl", "isUrlVariable": true, "variant": "filled", "buttonColor": "#000000", "textColor": "#ffffff", "borderRadius": "smooth", "alignment": "left"}}
  ]
}'::jsonb
WHERE type = 'welcome' AND scope_type = 'platform' AND scope_id IS NULL;

UPDATE email_templates SET editor_json = '{
  "type": "doc",
  "content": [
    {"type": "heading", "attrs": {"level": 2}, "content": [
      {"type": "variable", "attrs": {"id": "subject", "fallback": "Notification", "showIfKey": null}}
    ]},
    {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [
      {"type": "variable", "attrs": {"id": "message", "fallback": "", "showIfKey": null}}
    ]},
    {"type": "spacer", "attrs": {"height": 8}},
    {"type": "button", "attrs": {"text": "{{actionLabel}}", "url": "actionUrl", "isUrlVariable": true, "variant": "filled", "buttonColor": "#000000", "textColor": "#ffffff", "borderRadius": "smooth", "alignment": "left"}}
  ]
}'::jsonb
WHERE type = 'admin_notification' AND scope_type = 'platform' AND scope_id IS NULL;
