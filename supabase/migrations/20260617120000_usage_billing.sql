-- 20260617120000_usage_billing.sql
-- Usage-based billing for the Business Centre.
--
-- Decision (v1): bill on COMPLETED ASSESSMENTS, flat PER-UNIT (no allowance),
-- at a PER-CLIENT negotiated rate, billed monthly.
--
--   * billing_accounts gains per-client usage pricing.
--   * billing_usage_snapshots freezes the billed quantity for a period so it
--     cannot drift if participants are later withdrawn/deleted — the figure on
--     the invoice is the figure we keep. One row per account per period.

ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS usage_billing_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usage_unit TEXT NOT NULL DEFAULT 'completed_assessment'
    CHECK (usage_unit IN ('completed_assessment')),
  ADD COLUMN IF NOT EXISTS usage_unit_price_cents BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS billing_usage_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES billing_accounts(id) ON DELETE RESTRICT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  unit TEXT NOT NULL,
  quantity BIGINT NOT NULL,
  unit_price_cents BIGINT NOT NULL,
  amount_cents BIGINT NOT NULL,        -- quantity * unit_price_cents, GST-exclusive
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_usage_snapshot_period UNIQUE (billing_account_id, period_start, period_end)
);
COMMENT ON TABLE billing_usage_snapshots IS
  'Immutable per-period usage frozen at billing time, so a billed quantity cannot shift if participants are later withdrawn/deleted. One row per account per period (unique); links to the generated invoice. No updated_at — rows are never mutated.';

CREATE INDEX IF NOT EXISTS idx_usage_snapshots_account ON billing_usage_snapshots(billing_account_id);

ALTER TABLE billing_usage_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usage_snapshots_platform_admin_all" ON billing_usage_snapshots;
CREATE POLICY "usage_snapshots_platform_admin_all" ON billing_usage_snapshots
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());