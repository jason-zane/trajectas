-- =========================================================================
-- Public Role Builder — system client + storage tables.
--
-- Spec: docs/superpowers/specs/2026-09-17-public-role-builder-design.md
--
-- A fixed-UUID system client owns every assessment/campaign the public
-- Role Builder creates. Mirrors the Sample Data client pattern
-- (20260416082725_preview_sample_client.sql / PREVIEW_SAMPLE_CLIENT_ID):
-- because assessments/campaigns query by client_id, owning them under one
-- non-partner client keeps them out of every partner's library
-- (getPartnerAssessmentLibrary filters `client_id is null`) and out of
-- every other client's/partner's campaign views for free.
--
-- public_build_codes / public_builds are platform-administration data:
-- RLS grants platform-admin SELECT only. All writes happen through the
-- service-role (admin) client from src/app/actions/public-builds.ts, whose
-- gate is the signed tf_public_build cookie plus rate limits — not RLS.
--
-- IDEMPOTENT.
-- =========================================================================

INSERT INTO clients (id, partner_id, name, slug, is_active, settings)
VALUES (
  '00000000-0000-4000-8000-0000c0de6001'::uuid,
  NULL,
  'Public Role Builder',
  'public-role-builder',
  true,
  '{"system": true, "public_builds": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public_build_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL,
    code_hash   TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    consumed_at TIMESTAMPTZ,
    ip_hash     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT public_build_codes_email_not_empty CHECK (char_length(trim(email)) > 0),
    CONSTRAINT public_build_codes_attempts_nonneg CHECK (attempts >= 0)
);

COMMENT ON TABLE public_build_codes IS
    'One row per six-digit email-verification code requested by the public Role Builder (/build). Verification issues the signed tf_public_build cookie; no Supabase auth user is created.';

CREATE INDEX IF NOT EXISTS idx_public_build_codes_email ON public_build_codes (email);
CREATE INDEX IF NOT EXISTS idx_public_build_codes_ip_hash ON public_build_codes (ip_hash);
CREATE INDEX IF NOT EXISTS idx_public_build_codes_created_at ON public_build_codes (created_at);

ALTER TABLE public_build_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_build_codes_select_platform_admin ON public_build_codes;
CREATE POLICY public_build_codes_select_platform_admin ON public_build_codes
    FOR SELECT TO authenticated USING (is_platform_admin());

CREATE TABLE IF NOT EXISTS public_builds (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                  TEXT NOT NULL,
    ip_hash                TEXT,
    role_title             TEXT,
    pd_hash                TEXT,
    pd_text                TEXT,
    brief                  JSONB,
    ranking                JSONB,
    tier                   TEXT,
    picks                  JSONB,
    usage                  JSONB,
    status                 TEXT NOT NULL DEFAULT 'ranked',
    assessment_id          UUID REFERENCES assessments(id) ON DELETE SET NULL,
    campaign_id            UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    participant_id         UUID REFERENCES campaign_participants(id) ON DELETE SET NULL,
    error                  TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_assessment_at  TIMESTAMPTZ,
    started_at             TIMESTAMPTZ,
    completed_at           TIMESTAMPTZ,
    report_sent_at         TIMESTAMPTZ,

    CONSTRAINT public_builds_email_not_empty CHECK (char_length(trim(email)) > 0),
    CONSTRAINT public_builds_tier_valid CHECK (tier IS NULL OR tier IN ('essentials', 'core', 'full')),
    CONSTRAINT public_builds_status_valid CHECK (
        status IN ('ranked', 'created', 'started', 'completed', 'report_sent', 'failed')
    )
);

COMMENT ON TABLE public_builds IS
    'One row per public Role Builder run, from the first AI call through the report email. Owns the created assessment/campaign/participant via PUBLIC_BUILDS_CLIENT_ID. See docs/superpowers/specs/2026-09-17-public-role-builder-design.md.';

CREATE INDEX IF NOT EXISTS idx_public_builds_email ON public_builds (email);
CREATE INDEX IF NOT EXISTS idx_public_builds_ip_hash ON public_builds (ip_hash);
CREATE INDEX IF NOT EXISTS idx_public_builds_created_at ON public_builds (created_at);
CREATE INDEX IF NOT EXISTS idx_public_builds_pd_hash ON public_builds (pd_hash);
CREATE INDEX IF NOT EXISTS idx_public_builds_participant_id ON public_builds (participant_id);

ALTER TABLE public_builds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_builds_select_platform_admin ON public_builds;
CREATE POLICY public_builds_select_platform_admin ON public_builds
    FOR SELECT TO authenticated USING (is_platform_admin());
