-- =========================================================================
-- 20260512140000_trajectory_person_key.sql
--
-- Phase 1 of the Trajectory feature
-- (see docs/superpowers/specs/2026-05-12-trajectory-design.md).
--
-- Adds a `person_key` UUID column to `campaign_participants` that groups
-- rows referring to the same human within a single client. The auto-link
-- trigger reuses an existing row's `person_key` when (client_id, email)
-- matches an existing participant; otherwise a fresh UUID is generated.
--
-- Identity grouping is intentionally scoped to ONE client. The trigger
-- never crosses client boundaries; manual merge/split actions enforce
-- the same boundary at the application layer.
--
-- Also adds `person_link_audit` to record manual merge / split actions.
--
-- No new RLS is required on `campaign_participants` — the existing
-- `campaign_participants_select` policy (00070) already gates rows by
-- `campaigns.client_id ∈ auth_user_client_ids()`, which transparently
-- covers platform_admin, client_admin, and partner_admin.
--
-- IDEMPOTENT.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Column on campaign_participants
-- -------------------------------------------------------------------------

ALTER TABLE campaign_participants
    ADD COLUMN IF NOT EXISTS person_key UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_campaign_participants_person_key
    ON campaign_participants (person_key);

COMMENT ON COLUMN campaign_participants.person_key IS
    'Stable identifier grouping rows that refer to the same human within a client. '
    'Default is unique; auto-populated to match an existing row when (client_id, email) '
    'matches at insert time. Manually merged/split by admin actions.';

-- -------------------------------------------------------------------------
-- 2. Auto-link trigger
--
-- On INSERT, if another participant exists with the same email under the
-- same client (looked up via campaigns.client_id), copy that row's
-- person_key. Otherwise leave the default fresh UUID in place.
--
-- The matching is exact (CITEXT — case-insensitive). Ties — multiple
-- existing rows for the same (client, email) pair — already share the
-- same person_key by construction (this trigger is the only mechanism
-- that sets it on the campaign_participants insert path), so picking the
-- earliest by created_at is a safe deterministic choice.
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION campaign_participants_auto_link_person()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client_id    UUID;
    v_existing_key UUID;
BEGIN
    SELECT client_id INTO v_client_id
    FROM campaigns
    WHERE id = NEW.campaign_id;

    IF v_client_id IS NULL THEN
        -- Campaign has no client (shouldn't happen in practice, but the FK
        -- is ON DELETE SET NULL on campaigns.client_id, so be defensive).
        RETURN NEW;
    END IF;

    SELECT cp.person_key INTO v_existing_key
    FROM campaign_participants cp
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.client_id = v_client_id
      AND cp.email = NEW.email
      AND cp.id IS DISTINCT FROM NEW.id
    ORDER BY cp.created_at ASC
    LIMIT 1;

    IF v_existing_key IS NOT NULL THEN
        NEW.person_key := v_existing_key;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION campaign_participants_auto_link_person() IS
    'BEFORE INSERT trigger that reuses an existing person_key when a participant '
    'with the same email exists under the same client.';

DROP TRIGGER IF EXISTS campaign_participants_auto_link_person_trg
    ON campaign_participants;

CREATE TRIGGER campaign_participants_auto_link_person_trg
    BEFORE INSERT ON campaign_participants
    FOR EACH ROW
    EXECUTE FUNCTION campaign_participants_auto_link_person();

-- -------------------------------------------------------------------------
-- 3. person_link_audit — append-only record of merge / split actions
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS person_link_audit (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    action                   TEXT NOT NULL CHECK (action IN ('merge', 'split')),
    source_person_key        UUID NOT NULL,
    target_person_key        UUID NOT NULL,
    affected_participant_ids UUID[] NOT NULL,
    performed_by             UUID REFERENCES profiles(id) ON DELETE SET NULL,
    performed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason                   TEXT,

    CONSTRAINT person_link_audit_affected_not_empty
        CHECK (array_length(affected_participant_ids, 1) > 0)
);

COMMENT ON TABLE person_link_audit IS
    'Append-only log of manual merge / split actions on campaign_participants.person_key.';

CREATE INDEX IF NOT EXISTS idx_person_link_audit_client
    ON person_link_audit (client_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_person_link_audit_target
    ON person_link_audit (target_person_key);

-- -------------------------------------------------------------------------
-- 4. Row Level Security on person_link_audit
--
-- SELECT: any member of the client (auth_user_client_ids() folds in
-- partner-owned clients, so partner_admins see their clients' audit
-- rows without a separate policy).
--
-- INSERT: client_admin or platform_admin only (writing audit rows is
-- a side-effect of the merge/split server actions, which gate on the
-- same role check).
--
-- No UPDATE / DELETE policies — audit rows are immutable from the
-- authenticated app role.
-- -------------------------------------------------------------------------

ALTER TABLE person_link_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS person_link_audit_select ON person_link_audit;
CREATE POLICY person_link_audit_select ON person_link_audit
    FOR SELECT TO authenticated
    USING (
        is_platform_admin()
        OR client_id = ANY(auth_user_client_ids())
    );

DROP POLICY IF EXISTS person_link_audit_insert ON person_link_audit;
CREATE POLICY person_link_audit_insert ON person_link_audit
    FOR INSERT TO authenticated
    WITH CHECK (
        is_platform_admin()
        OR client_id = ANY(auth_user_client_admin_ids())
    );
