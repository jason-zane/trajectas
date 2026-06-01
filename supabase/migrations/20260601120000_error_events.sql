-- =============================================================================
-- Migration 20260601120000: error_events
-- =============================================================================
-- A lightweight, self-hosted error/incident store so production failures are
-- visible beyond Vercel's ephemeral log window. Written by the server-only
-- reportError() helper (service role bypasses RLS); readable by platform
-- admins only. Designed as the seam for a future Sentry integration.
-- =============================================================================

CREATE TABLE IF NOT EXISTS error_events (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 'warning' | 'error' | 'fatal'
    severity          TEXT        NOT NULL DEFAULT 'error',
    -- logical origin, e.g. 'reports.runner', 'actions.campaigns', 'cron.account-deletion'
    source            TEXT        NOT NULL,
    message           TEXT        NOT NULL,
    stack             TEXT,
    -- stable grouping key (source + normalised message) for dedup/aggregation
    fingerprint       TEXT,
    context           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    actor_profile_id  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    request_id        TEXT,
    -- whether an ops alert (email) was dispatched for this event
    alerted           BOOLEAN     NOT NULL DEFAULT false,

    CONSTRAINT error_events_severity_valid CHECK (severity IN ('warning', 'error', 'fatal')),
    CONSTRAINT error_events_source_not_empty CHECK (length(trim(source)) > 0)
);

COMMENT ON TABLE error_events IS
    'Server-side error/incident log. Written by reportError() via the service role; read by platform admins. Seam for future Sentry forwarding.';

CREATE INDEX IF NOT EXISTS idx_error_events_occurred ON error_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_fingerprint ON error_events (fingerprint, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_severity ON error_events (severity, occurred_at DESC);

-- RLS: platform admins may read; nobody (except the service role, which bypasses
-- RLS) may write. No INSERT/UPDATE/DELETE policies are defined intentionally.
ALTER TABLE error_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY error_events_select_platform_admin ON error_events
    FOR SELECT
    USING (is_platform_admin());
