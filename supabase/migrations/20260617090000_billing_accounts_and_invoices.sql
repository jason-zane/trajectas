-- 20260617090000_billing_accounts_and_invoices.sql
-- Business Centre — billing foundation.
--
-- Two tables that mirror Stripe (the system of record for money) while keeping
-- Trajectas as the system of record for *who* the customer is:
--   * billing_accounts — the party Trajectas invoices. v1 only ever points at a
--     client (Trajectas-direct billing). partner_id is present but unused for
--     now, so partner-level / reseller billing can be added later without a
--     reshape. Exactly one owner (client XOR partner) is enforced.
--   * invoices — a thin local mirror of Stripe invoices (status, amounts split
--     GST-exclusive / GST / inclusive, hosted URLs). Stripe owns the canonical
--     line items and PDF; this table powers the admin list and revenue views.
--
-- RLS: platform-admin only. There is no client/partner SELECT policy — billing
-- is Trajectas-internal in v1. App access is via the service-role admin client
-- behind an assertAdminOnly() gate; the is_platform_admin() policy is defence
-- in depth for any authenticated path.

CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE RESTRICT,
  partner_id UUID REFERENCES partners(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT UNIQUE,
  legal_name TEXT,                            -- entity name shown on the invoice
  billing_email TEXT,                         -- where Stripe sends the invoice
  country TEXT NOT NULL DEFAULT 'AU',         -- ISO 3166-1 alpha-2
  tax_id TEXT,                                -- customer ABN (optional, B2B)
  payment_terms_days INT NOT NULL DEFAULT 14,
  currency TEXT NOT NULL DEFAULT 'aud',       -- ISO 4217, lowercase (Stripe)
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT billing_accounts_one_owner
    CHECK ((client_id IS NOT NULL)::int + (partner_id IS NOT NULL)::int = 1)
);
COMMENT ON TABLE billing_accounts IS
  'The party Trajectas invoices. v1 bills clients directly (client_id set, partner_id null); partner_id is scaffolding for future reseller billing. Exactly one owner.';

-- One active billing account per owner.
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_accounts_client
  ON billing_accounts(client_id) WHERE client_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_accounts_partner
  ON billing_accounts(partner_id) WHERE partner_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES billing_accounts(id) ON DELETE RESTRICT,
  stripe_invoice_id TEXT UNIQUE,
  number TEXT,                                -- Stripe invoice number, once finalized
  kind TEXT NOT NULL DEFAULT 'one_off'
    CHECK (kind IN ('one_off', 'usage', 'subscription')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  currency TEXT NOT NULL DEFAULT 'aud',
  subtotal_cents BIGINT NOT NULL DEFAULT 0,   -- GST-exclusive, minor units
  tax_cents BIGINT NOT NULL DEFAULT 0,        -- GST, minor units
  total_cents BIGINT NOT NULL DEFAULT 0,      -- GST-inclusive, minor units
  amount_due_cents BIGINT NOT NULL DEFAULT 0,
  amount_paid_cents BIGINT NOT NULL DEFAULT 0,
  description TEXT,                            -- short summary for the admin list
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,  -- display snapshot; Stripe canonical
  hosted_invoice_url TEXT,                     -- Stripe-hosted payment page
  invoice_pdf_url TEXT,                        -- Stripe-rendered PDF
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,                        -- finalized/sent
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE invoices IS
  'Local mirror of Stripe invoices. Amounts are integer minor units (cents) split GST-exclusive/GST/inclusive. Stripe owns canonical line items + PDF; hosted_invoice_url/invoice_pdf_url link out.';

CREATE INDEX IF NOT EXISTS idx_invoices_billing_account ON invoices(billing_account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- updated_at triggers (set_updated_at() already exists repo-wide).
DROP TRIGGER IF EXISTS trg_billing_accounts_updated ON billing_accounts;
CREATE TRIGGER trg_billing_accounts_updated
  BEFORE UPDATE ON billing_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_invoices_updated ON invoices;
CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: platform-admin only (Trajectas-internal in v1).
ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_accounts_platform_admin_all" ON billing_accounts;
CREATE POLICY "billing_accounts_platform_admin_all" ON billing_accounts
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_platform_admin_all" ON invoices;
CREATE POLICY "invoices_platform_admin_all" ON invoices
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
