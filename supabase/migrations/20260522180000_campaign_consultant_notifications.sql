-- =============================================================================
-- 20260522180000 — Per-campaign consultant notification settings.
--
-- Columns drive the post-snapshot-release hook in
-- src/app/actions/reports.ts:sendConsultantNotification:
--
--   consultant_emails                       — recipient list (defaults to the
--                                              campaign creator's email at
--                                              creation time, editable later)
--   consultant_notification_enabled         — master toggle
--   consultant_notification_include_summary — include composite + per-dimension
--                                              score table in the email body
--   consultant_notification_attach_pdf      — attach the rendered PDF to the
--                                              email
--
-- The three toggles map directly to the three knobs from the design
-- conversation. Defaults are off for the master toggle so existing campaigns
-- don't silently start emailing consultants; the two inner toggles default to
-- true so when a user turns notifications on they get the full payload.
-- =============================================================================

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS consultant_emails text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS consultant_notification_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consultant_notification_include_summary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS consultant_notification_attach_pdf boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN campaigns.consultant_emails IS
  'Email addresses to notify when a session in this campaign produces a released report snapshot. Defaults to the creator''s email at campaign creation, editable in campaign settings.';

COMMENT ON COLUMN campaigns.consultant_notification_enabled IS
  'Master toggle for the post-release consultant notification email. When false, no email is sent regardless of the other consultant_notification_* flags.';

COMMENT ON COLUMN campaigns.consultant_notification_include_summary IS
  'When true, the consultant email body includes a composite score + per-dimension breakdown. Only consulted when consultant_notification_enabled is true.';

COMMENT ON COLUMN campaigns.consultant_notification_attach_pdf IS
  'When true, the rendered report PDF is attached to the consultant email. Only consulted when consultant_notification_enabled is true.';
