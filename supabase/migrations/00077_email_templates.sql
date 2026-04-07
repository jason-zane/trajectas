BEGIN;

-- =============================================================================
-- Email Templates
--
-- Stores editable email templates at the platform, partner, and client level.
-- Platform defaults serve as fallback when no scoped override exists.
-- =============================================================================

-- 1. Enums

DO $$ BEGIN
  CREATE TYPE email_template_type AS ENUM (
    'magic_link',
    'staff_invite',
    'assessment_invite',
    'assessment_reminder',
    'report_ready',
    'welcome',
    'admin_notification'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE email_template_scope AS ENUM (
    'platform',
    'partner',
    'client'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Main table

CREATE TABLE IF NOT EXISTS email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          email_template_type NOT NULL,
  scope_type    email_template_scope NOT NULL DEFAULT 'platform',
  scope_id      UUID,                                       -- NULL for platform scope
  subject       TEXT NOT NULL,
  preview_text  TEXT,
  editor_json   JSONB NOT NULL DEFAULT '{}',
  html_cache    TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES profiles(id),
  deleted_at    TIMESTAMPTZ,                                -- soft-delete

  CONSTRAINT email_templates_scope_check CHECK (
    (scope_type = 'platform' AND scope_id IS NULL)
    OR
    (scope_type IN ('partner', 'client') AND scope_id IS NOT NULL)
  )
);

COMMENT ON TABLE email_templates IS
  'Editable email templates for all transactional message types, scoped to platform, partner, or client.';

-- 3. Unique index: one active template per (type, scope)

CREATE UNIQUE INDEX IF NOT EXISTS email_templates_type_scope_unique
  ON email_templates (type, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL;

-- 4. Supporting indexes

CREATE INDEX IF NOT EXISTS idx_email_templates_scope_type_id
  ON email_templates (scope_type, scope_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_templates_type
  ON email_templates (type)
  WHERE deleted_at IS NULL;

-- 5. Updated-at trigger

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON email_templates;
CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. RLS

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Platform admins: full access to all templates
DROP POLICY IF EXISTS email_templates_platform_admin_all ON email_templates;
CREATE POLICY email_templates_platform_admin_all ON email_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'platform_admin'
        AND profiles.is_active = true
    )
  );

-- Partner admins: full access to own partner templates + SELECT on platform defaults
DROP POLICY IF EXISTS email_templates_partner_admin_select ON email_templates;
CREATE POLICY email_templates_partner_admin_select ON email_templates
  FOR SELECT TO authenticated
  USING (
    (scope_type = 'platform' AND scope_id IS NULL)
    OR (
      scope_type = 'partner'
      AND scope_id = ANY(auth_user_partner_admin_ids())
    )
  );

DROP POLICY IF EXISTS email_templates_partner_admin_insert ON email_templates;
CREATE POLICY email_templates_partner_admin_insert ON email_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    scope_type = 'partner'
    AND scope_id = ANY(auth_user_partner_admin_ids())
  );

DROP POLICY IF EXISTS email_templates_partner_admin_update ON email_templates;
CREATE POLICY email_templates_partner_admin_update ON email_templates
  FOR UPDATE TO authenticated
  USING (
    scope_type = 'partner'
    AND scope_id = ANY(auth_user_partner_admin_ids())
  );

DROP POLICY IF EXISTS email_templates_partner_admin_delete ON email_templates;
CREATE POLICY email_templates_partner_admin_delete ON email_templates
  FOR DELETE TO authenticated
  USING (
    scope_type = 'partner'
    AND scope_id = ANY(auth_user_partner_admin_ids())
  );

-- Client admins: full access to own client templates + SELECT on platform defaults
DROP POLICY IF EXISTS email_templates_client_admin_select ON email_templates;
CREATE POLICY email_templates_client_admin_select ON email_templates
  FOR SELECT TO authenticated
  USING (
    (scope_type = 'platform' AND scope_id IS NULL)
    OR (
      scope_type = 'client'
      AND scope_id = ANY(auth_user_client_admin_ids())
    )
  );

DROP POLICY IF EXISTS email_templates_client_admin_insert ON email_templates;
CREATE POLICY email_templates_client_admin_insert ON email_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    scope_type = 'client'
    AND scope_id = ANY(auth_user_client_admin_ids())
  );

DROP POLICY IF EXISTS email_templates_client_admin_update ON email_templates;
CREATE POLICY email_templates_client_admin_update ON email_templates
  FOR UPDATE TO authenticated
  USING (
    scope_type = 'client'
    AND scope_id = ANY(auth_user_client_admin_ids())
  );

DROP POLICY IF EXISTS email_templates_client_admin_delete ON email_templates;
CREATE POLICY email_templates_client_admin_delete ON email_templates
  FOR DELETE TO authenticated
  USING (
    scope_type = 'client'
    AND scope_id = ANY(auth_user_client_admin_ids())
  );

-- 7. Seed: platform default templates

INSERT INTO email_templates (type, scope_type, scope_id, subject, editor_json)
VALUES
  ('magic_link',          'platform', NULL, 'Your sign-in link for {{brandName}}',          '{}'),
  ('staff_invite',        'platform', NULL, 'You''ve been invited to join {{brandName}}',    '{}'),
  ('assessment_invite',   'platform', NULL, '{{campaignTitle}} — You''re invited',           '{}'),
  ('assessment_reminder', 'platform', NULL, 'Reminder: Complete your assessment',            '{}'),
  ('report_ready',        'platform', NULL, 'Your results are available',                    '{}'),
  ('welcome',             'platform', NULL, 'Welcome to {{brandName}}',                      '{}'),
  ('admin_notification',  'platform', NULL, '{{subject}}',                                   '{}')
ON CONFLICT DO NOTHING;

COMMIT;
